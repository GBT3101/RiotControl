/**
 * Crowd update (the hot loop): status effects, throttled decisions, per-state behaviour,
 * then local steering — flow field + separation through the spatial hash + wall avoidance +
 * unit/blockade contact — and animation hints.
 *
 * No allocation per protester: all scratch lives in module-level variables / typed arrays.
 */
import { BALANCE } from '../data/balance';
import { DMG } from '../data/damage';
import { PROTESTERS, PT } from '../data/protesters';
import {
  auraFactor,
  capitolDesire,
  climbUpdate,
  D,
  engagedDesire,
  explodeProphet,
  followDesire,
  marchDesire,
  PROTESTER_BEHAVIOURS,
  resetDesire,
} from './behaviours/protester';
import { engage, hurtProtester } from './combat';
import { PANIM, PS } from './crowd';
import type { World } from './world';

const SEP_R = BALANCE.separationRadius;
const SEP_R2 = SEP_R * SEP_R;
const SEP_K = BALANCE.separationStrength;
const SEP_MAX = BALANCE.separationMaxNeighbours;
const BAND = BALANCE.wallBand;
const WALL_K = 4;
const THINK = BALANCE.thinkTicks;

/** Per-type constants pulled out of the defs for the hot loop. */
const P_RADIUS = Float32Array.from(PROTESTERS.map((p) => p.radius));
const P_HAS_THINK = Uint8Array.from(
  PROTESTER_BEHAVIOURS.map((b) => (b.some((x) => x.think) ? 1 : 0)),
);
const P_HAS_CONTACT = Uint8Array.from(
  PROTESTER_BEHAVIOURS.map((b) => (b.some((x) => x.onContact) ? 1 : 0)),
);
const P_HAS_MELEE = Uint8Array.from(
  PROTESTERS.map((p) => (p.loadouts.some((l) => l.melee) ? 1 : 0)),
);

export function updateCrowd(w: World, dt: number): void {
  const c = w.crowd;
  const nav = w.nav;
  const hash = w.hash;
  const hi = c.hi;
  const tickMod = w.tick % THINK;
  const capReach = BALANCE.capitolReach;
  const gasDps = BALANCE.gasDps;
  const burnDps = BALANCE.burnDps;
  const alive = c.alive;
  const state = c.state;
  const xs = c.x;
  const ys = c.y;
  const vxs = c.vx;
  const vys = c.vy;
  const mw = nav.w;
  const mh = nav.h;
  const solid = nav.solid;
  const hStart = hash.start;
  const hItems = hash.items;
  const ugStart = w.ugStart;
  const ugItems = w.ugItems;
  const units = w.units.items;
  const accel = Math.min(1, BALANCE.acceleration * dt);
  const hasBreta = w.bretaSlot >= 0;
  let capAttackers = 0;

  for (let s = 0; s < hi; s++) {
    if (!alive[s]) continue;
    const type = c.type[s]!;

    // ── Status effects ───────────────────────────────────────────────────────────────
    let stun = c.stun[s]!;
    if (stun > 0) {
      stun -= dt;
      c.stun[s] = stun > 0 ? stun : 0;
    }
    if (c.gasT[s]! > 0) {
      c.gasT[s] = c.gasT[s]! - dt;
      if (hurtProtester(w, s, gasDps * dt, DMG.gas, false, -1)) continue;
    }
    if (c.burnT[s]! > 0) {
      c.burnT[s] = c.burnT[s]! - dt;
      if (hurtProtester(w, s, burnDps * dt, DMG.fire, true, -1)) continue;
    }
    if (c.cd[s]! > 0) c.cd[s] = c.cd[s]! - dt;
    if (c.cd2[s]! > 0) c.cd2[s] = c.cd2[s]! - dt;
    const act = c.actT[s]!;
    if (act > 0) c.actT[s] = act - dt;

    // ── Throttled decisions ──────────────────────────────────────────────────────────
    if (P_HAS_THINK[type] && s % THINK === tickMod) {
      const bs = PROTESTER_BEHAVIOURS[type]!;
      for (let k = 0; k < bs.length; k++) {
        const b = bs[k]!;
        if (b.think) b.think(w, s);
        if (!alive[s]) break;
      }
      if (!alive[s]) continue;
    }

    // ── Per-state behaviour → desired direction ─────────────────────────────────────
    resetDesire();
    switch (state[s]!) {
      case PS.SPAWNING: {
        const t = c.stT[s]! - dt;
        c.stT[s] = t;
        marchDesire(w, s);
        D.speed = 0.35;
        if (t <= 0) {
          state[s] = type === PT.paparazzi && w.bretaSlot >= 0 ? PS.FOLLOW : PS.MARCH;
        }
        break;
      }
      case PS.MARCH: {
        const tile = (ys[s]! | 0) * mw + (xs[s]! | 0);
        if (nav.dist[tile]! <= capReach) {
          if (type === PT.prophet) {
            explodeProphet(w, s);
            continue;
          }
          state[s] = PS.CAPITOL;
          capitolDesire(w, s);
          capAttackers++;
        } else marchDesire(w, s);
        break;
      }
      case PS.ENGAGED:
        engagedDesire(w, s);
        break;
      case PS.CAPITOL:
        capAttackers++;
        capitolDesire(w, s);
        break;
      case PS.FOLLOW: {
        const tile = (ys[s]! | 0) * mw + (xs[s]! | 0);
        if (nav.dist[tile]! <= capReach) {
          state[s] = PS.CAPITOL;
          capitolDesire(w, s);
          capAttackers++;
        } else followDesire(w, s);
        break;
      }
      default: {
        // Climbing states: TO_CLIMB moves on the ground; the rest stay on the facade/roof.
        if (!climbUpdate(w, s, dt)) {
          vxs[s] = 0;
          vys[s] = 0;
          if (!alive[s]) continue;
          continue;
        }
      }
    }
    if (!alive[s]) continue;
    let st = state[s]!;

    // ── Steering ─────────────────────────────────────────────────────────────────────
    const x = xs[s]!;
    const y = ys[s]!;
    let spd = c.speed[s]! * D.speed;
    const stunned = c.stun[s]! > 0;
    if (stunned || c.actT[s]! > 0) spd = 0;
    if (hasBreta) spd *= auraFactor(w, x, y);
    if (c.gasT[s]! > 0) spd *= 0.6;
    let dvx = D.x * spd;
    let dvy = D.y * spd;

    // Separation (bounded neighbour count).
    const ci = x | 0;
    const cj = y | 0;
    let sx = 0;
    let sy = 0;
    let n = 0;
    outer: for (let j = cj - 1; j <= cj + 1; j++) {
      if (j < 0 || j >= mh) continue;
      for (let i = ci - 1; i <= ci + 1; i++) {
        if (i < 0 || i >= mw) continue;
        const k = j * mw + i;
        const e = hStart[k + 1]!;
        for (let p = hStart[k]!; p < e; p++) {
          const o = hItems[p]!;
          if (o === s) continue;
          let ox = x - xs[o]!;
          let oy = y - ys[o]!;
          let d2 = ox * ox + oy * oy;
          if (d2 >= SEP_R2) continue;
          if (d2 < 1e-8) {
            // Exactly stacked: deterministic nudge.
            ox = s < o ? 0.01 : -0.01;
            oy = (s & 1) === 0 ? 0.007 : -0.007;
            d2 = ox * ox + oy * oy;
          }
          const d = Math.sqrt(d2);
          const f = (SEP_R - d) / (SEP_R * d);
          sx += ox * f;
          sy += oy * f;
          if (++n >= SEP_MAX) break outer;
        }
      }
    }
    dvx += sx * SEP_K;
    dvy += sy * SEP_K;

    // Wall avoidance (blocked neighbour tiles within the band).
    const fx = x - ci;
    const fy = y - cj;
    if (fx < BAND && (ci === 0 || solid[cj * mw + ci - 1])) dvx += (BAND - fx) * WALL_K;
    else if (fx > 1 - BAND && (ci === mw - 1 || solid[cj * mw + ci + 1]))
      dvx -= (fx - 1 + BAND) * WALL_K;
    if (fy < BAND && (cj === 0 || solid[(cj - 1) * mw + ci])) dvy += (BAND - fy) * WALL_K;
    else if (fy > 1 - BAND && (cj === mh - 1 || solid[(cj + 1) * mw + ci]))
      dvy -= (fy - 1 + BAND) * WALL_K;

    let vx = vxs[s]! + (dvx - vxs[s]!) * accel;
    let vy = vys[s]! + (dvy - vys[s]!) * accel;
    let nx = x + vx * dt;
    let ny = y + vy * dt;

    // Tile collision (slide along walls); blockade contact engages.
    const curSolid = ci < 0 || cj < 0 || ci >= mw || cj >= mh || solid[cj * mw + ci] === 1;
    if (!curSolid) {
      const ni = Math.floor(nx);
      const nj = Math.floor(ny);
      if (ni < 0 || nj < 0 || ni >= mw || nj >= mh || solid[nj * mw + ni]) {
        if (ni >= 0 && nj >= 0 && ni < mw && nj < mh) {
          const bslot = nav.blockade[nj * mw + ni]!;
          if (bslot >= 0 && (st === PS.MARCH || st === PS.FOLLOW)) {
            const bu = units[bslot];
            if (bu && bu.alive) {
              if (P_HAS_CONTACT[type]) {
                const bs = PROTESTER_BEHAVIOURS[type]!;
                let consumed = false;
                for (let k = 0; k < bs.length && !consumed; k++) {
                  const oc = bs[k]!.onContact;
                  if (oc) consumed = oc(w, s, bu);
                }
                if (consumed || !alive[s]) continue;
              }
              engage(w, s, bu);
            }
          }
        }
        if (!isSolid(nav.solid, mw, mh, nx, y)) {
          ny = y;
          vy = 0;
        } else if (!isSolid(nav.solid, mw, mh, x, ny)) {
          nx = x;
          vx = 0;
        } else {
          nx = x;
          ny = y;
          vx = 0;
          vy = 0;
        }
      }
    }

    // Unit contact: push out of unit circles; engage free slots; Prophets explode.
    const ti = nx | 0;
    const tj = ny | 0;
    if (ti >= 0 && tj >= 0 && ti < mw && tj < mh) {
      const tk = tj * mw + ti;
      const ue = ugStart[tk + 1]!;
      const pr = P_RADIUS[type]!;
      for (let p = ugStart[tk]!; p < ue; p++) {
        const u = units[ugItems[p]!]!;
        if (!u.alive) continue;
        const rr = u.def.radius + pr;
        const ddx = nx - u.x;
        const ddy = ny - u.y;
        const d2 = ddx * ddx + ddy * ddy;
        if (d2 >= rr * rr) continue;
        // A moving tank does not push people aside — it runs them over (tank behaviour).
        if (u.moving && u.def.crushes && type !== PT.prophet) continue;
        if (P_HAS_CONTACT[type]) {
          const bs = PROTESTER_BEHAVIOURS[type]!;
          let consumed = false;
          for (let k = 0; k < bs.length && !consumed; k++) {
            const oc = bs[k]!.onContact;
            if (oc) consumed = oc(w, s, u);
          }
          if (consumed || !alive[s]) break;
        }
        const d = Math.sqrt(d2);
        if (d > 1e-6) {
          const px = u.x + (ddx / d) * rr;
          const py = u.y + (ddy / d) * rr;
          if (!isSolid(nav.solid, mw, mh, px, py)) {
            nx = px;
            ny = py;
          }
        }
        if ((st === PS.MARCH || st === PS.FOLLOW) && !u.moving && u.holders.length > 0) {
          if (engage(w, s, u)) st = PS.ENGAGED;
        }
      }
      if (!alive[s]) continue;
    }

    xs[s] = nx;
    ys[s] = ny;
    vxs[s] = vx;
    vys[s] = vy;

    // ── Facing & animation hints ─────────────────────────────────────────────────────
    const sp2 = vx * vx + vy * vy;
    if (D.face) c.facing[s] = facing4i(D.fx, D.fy);
    else if (sp2 > 0.04) c.facing[s] = facing4i(vx, vy);
    let anim: number;
    if (stunned) anim = PANIM.STUNNED;
    else if (c.actT[s]! > 0) anim = c.anim[s]!;
    else if (st === PS.CAPITOL) anim = PANIM.RIOT;
    else if (st === PS.ENGAGED && P_HAS_MELEE[type] && w.time - c.lastAtk[s]! < 0.5)
      anim = PANIM.ATTACK;
    else if (sp2 > 0.04) {
      anim = c.gasT[s]! > 0 ? PANIM.COUGH : sp2 > 2.6 ? PANIM.RUN : PANIM.WALK;
    } else anim = PANIM.IDLE;
    c.anim[s] = anim;
  }
  w.capitol.attackers = capAttackers;
}

function isSolid(solid: Uint8Array, mw: number, mh: number, x: number, y: number): boolean {
  const i = Math.floor(x);
  const j = Math.floor(y);
  if (i < 0 || j < 0 || i >= mw || j >= mh) return true;
  return solid[j * mw + i] === 1;
}

/** 0 se, 1 sw, 2 ne, 3 nw (same as units.facing4). */
function facing4i(du: number, dv: number): number {
  const sx = du - dv;
  const sy = du + dv;
  if (sy >= 0) return sx >= 0 ? 0 : 1;
  return sx >= 0 ? 2 : 3;
}
