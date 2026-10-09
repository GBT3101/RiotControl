/**
 * Generic protester behaviours used by the crowd update:
 *  - crowd marcher: follow the Capitol flow field with a slow lateral weave so hordes spread
 *    across wide roads;
 *  - melee fighter: when held in a unit's slot (or pressing a blockade), strike it;
 *  - capitol attacker: on the steps, chip Integrity every second until killed.
 */
import { BALANCE } from '../../../data/balance';
import { DMG } from '../../../data/damage';
import { PROTESTERS } from '../../../data/protesters';
import { hurtUnit, releaseHolder } from '../../combat';
import { PS } from '../../crowd';
import type { World } from '../../world';
import { D } from './desire';

/** Seconds between Capitol hits (damage per hit = capitolDps × this). */
export const CAPITOL_HIT_INTERVAL = 1;

// ── Crowd marcher ──────────────────────────────────────────────────────────────────────

/** Flow direction + weave into D. */
export function marchDesire(w: World, s: number): void {
  const c = w.crowd;
  const nav = w.nav;
  nav.sample(c.x[s]!, c.y[s]!);
  let fx = nav.sx;
  let fy = nav.sy;
  const l = Math.sqrt(fx * fx + fy * fy);
  if (l < 1e-4) {
    D.x = 0;
    D.y = 0;
    return;
  }
  fx /= l;
  fy /= l;
  // Triangle-wave weave (no trig): period ≈ 6 s, phase from the lane value.
  let ph = w.time * 0.17 + c.lane[s]! * 3.1;
  ph -= Math.floor(ph);
  const tri = Math.abs(ph * 4 - 2) - 1; // −1..1
  const lat = (tri * 0.6 + c.lane[s]! * 0.4) * BALANCE.laneSpread;
  const dx = fx - fy * lat;
  const dy = fy + fx * lat;
  const l2 = Math.sqrt(dx * dx + dy * dy);
  D.x = dx / l2;
  D.y = dy / l2;
}

// ── Melee fighter (protester side) ─────────────────────────────────────────────────────

/** Engaged with a unit: approach to contact and strike on cooldown. */
export function engagedDesire(w: World, s: number): void {
  const c = w.crowd;
  const eu = c.engUnit[s]!;
  const u = eu >= 0 ? w.units.at(eu) : undefined;
  if (!u) {
    c.engUnit[s] = -1;
    c.state[s] = PS.MARCH;
    marchDesire(w, s);
    return;
  }
  const def = PROTESTERS[c.type[s]!]!;
  const x = c.x[s]!;
  const y = c.y[s]!;
  let dx: number;
  let dy: number;
  let d: number;
  let contact: number;
  const isBlockade = u.type === 'blockade';
  const mw = w.map.w;
  if (isBlockade) {
    // Distance to the nearest blockade tile square.
    let best = Infinity;
    let bx = 0;
    let by = 0;
    for (const t of u.tiles) {
      const ti = t % mw;
      const tj = (t - ti) / mw;
      const px = Math.min(Math.max(x, ti), ti + 1);
      const py = Math.min(Math.max(y, tj), tj + 1);
      const ddx = px - x;
      const ddy = py - y;
      const dd = ddx * ddx + ddy * ddy;
      if (dd < best) {
        best = dd;
        bx = px;
        by = py;
      }
    }
    dx = bx - x;
    dy = by - y;
    d = Math.sqrt(best);
    contact = def.radius + 0.12;
  } else {
    dx = u.x - x;
    dy = u.y - y;
    d = Math.sqrt(dx * dx + dy * dy);
    contact = u.def.radius + def.radius + 0.08;
  }
  if (d > contact + 1.2 || (u.moving && !isBlockade)) {
    releaseHolder(u, c.handle(s));
    c.engUnit[s] = -1;
    c.state[s] = PS.MARCH;
    marchDesire(w, s);
    return;
  }
  if (d > 1e-6) {
    D.face = true;
    D.fx = dx;
    D.fy = dy;
  }
  if (isBlockade) {
    // Keep pressing along the flow: the jam forms against the blockade.
    marchDesire(w, s);
    D.speed = 0.5;
  } else if (d > contact) {
    D.x = dx / d;
    D.y = dy / d;
    D.speed = 0.6;
  }
  const ld = def.loadouts[c.loadout[s]!]!;
  const m = ld.melee;
  if (m && c.cd[s]! <= 0 && c.stun[s]! <= 0 && d <= contact + 0.35) {
    const dmg = m.dps * m.interval;
    c.cd[s] = m.interval;
    c.lastAtk[s] = w.time;
    D.attacked = true;
    w.events.push('attacked', {
      attackerKind: 'protester',
      attackerId: c.handle(s),
      targetKind: 'unit',
      targetId: u.id,
      x: u.x,
      y: u.y,
      damage: dmg,
      dmgType: m.dmgType,
    });
    hurtUnit(w, u, dmg, DMG[m.dmgType], m.lethal, 'protester', c.handle(s));
  }
}

// ── Capitol attacker ───────────────────────────────────────────────────────────────────

export function capitolDesire(w: World, s: number): void {
  const c = w.crowd;
  marchDesire(w, s);
  D.speed = 0.3;
  if (c.cd[s]! <= 0 && c.stun[s]! <= 0) {
    const def = PROTESTERS[c.type[s]!]!;
    c.cd[s] = CAPITOL_HIT_INTERVAL;
    c.lastAtk[s] = w.time;
    D.attacked = true;
    w.capitol.damage(w, def.capitolDps * CAPITOL_HIT_INTERVAL);
  }
}
