/**
 * Special protester behaviours: ranged attackers (pistols, rifles, molotovs, bazookas vs
 * rooftops), climbers (divert → climb → fight on the roof → throw the sniper off → climb
 * down), Prophets (explode on contact), Breta (speed aura) and her paparazzi (flock + flash).
 */
import { BALANCE } from '../../../data/balance';
import { DMG } from '../../../data/damage';
import { PROTESTERS, PT } from '../../../data/protesters';
import { blast, hurtUnit, killProtester } from '../../combat';
import { PANIM, PS } from '../../crowd';
import { TEAM_PROTESTERS } from '../../projectiles';
import { facing4, type Unit } from '../../units';
import type { World } from '../../world';
import type { ProtesterBehaviour } from '../types';
import { D } from './desire';
import { marchDesire } from './generic';

// ── Ranged attackers ───────────────────────────────────────────────────────────────────

/**
 * Nearest attackable unit within `range`. With `roofs`, rooftop units are eligible and
 * preferred (bazookas go for snipers first); otherwise only ground units.
 */
export function nearestUnit(
  w: World,
  x: number,
  y: number,
  range: number,
  roofs: boolean,
): Unit | null {
  let best: Unit | null = null;
  let bd = Infinity;
  const r2 = range * range;
  const list = w.units.active;
  for (let k = 0; k < list.length; k++) {
    const u = list[k]!;
    if (!u.alive || u.def.invulnerable || u.def.placement === 'air') continue;
    const roof = u.building >= 0;
    if (roof && !roofs) continue;
    const dx = u.x - x;
    const dy = u.y - y;
    const d = dx * dx + dy * dy;
    if (d > r2) continue;
    const score = roof ? d * 0.1 : d;
    if (score < bd) {
      bd = score;
      best = u;
    }
  }
  return best;
}

export const rangedAttacker: ProtesterBehaviour = {
  id: 'ranged',
  think(w, s) {
    const c = w.crowd;
    if (c.cd2[s]! > 0 || c.stun[s]! > 0 || c.actT[s]! > 0) return;
    const st = c.state[s]!;
    if (st !== PS.MARCH && st !== PS.ENGAGED && st !== PS.CAPITOL && st !== PS.FOLLOW) return;
    const def = PROTESTERS[c.type[s]!]!;
    const r = def.loadouts[c.loadout[s]!]!.ranged;
    if (!r) return;
    const x = c.x[s]!;
    const y = c.y[s]!;
    const u = nearestUnit(w, x, y, r.range, r.targetsRooftops === true);
    if (!u) return;
    const handle = c.handle(s);
    const dmg = DMG[r.dmgType];
    c.cd2[s] = r.cooldown;
    c.actT[s] = 0.45;
    c.lastAtk[s] = w.time;
    c.facing[s] = facing4(u.x - x, u.y - y);
    if (r.delivery === 'hitscan') {
      c.anim[s] = PANIM.SHOOT;
      w.events.push('fired', {
        shooterKind: 'protester',
        shooterId: handle,
        weapon: r.weapon,
        x0: x,
        y0: y,
        z0: 0,
        x1: u.x,
        y1: u.y,
        projectileId: -1,
        hits: 1,
      });
      w.events.push('attacked', {
        attackerKind: 'protester',
        attackerId: handle,
        targetKind: 'unit',
        targetId: u.id,
        x: u.x,
        y: u.y,
        damage: r.damage,
        dmgType: r.dmgType,
      });
      hurtUnit(w, u, r.damage, dmg, r.lethal, 'protester', handle);
      return;
    }
    c.anim[s] = PANIM.THROW;
    const kind = r.weapon === 'bazooka' ? 'bazooka' : 'molotov';
    const p = w.projectiles.spawn(
      kind,
      TEAM_PROTESTERS,
      handle,
      x,
      y,
      0,
      u.x,
      u.y,
      r.projectileSpeed ?? 6,
    );
    p.damage = r.damage;
    p.radius = r.aoeRadius ?? 1;
    p.dmg = dmg;
    p.lethal = r.lethal;
    p.crowdFactor = 0;
    p.unitFactor = 1;
    if (u.building >= 0) {
      // Rooftop hit: the projectile damages that unit directly on impact.
      p.roofTarget = u.slot;
      p.roofGen = u.gen;
      p.unitFactor = 0;
    }
    if (r.fire) {
      p.areaKind = 'fire';
      p.areaRadius = r.fire.radius;
      p.areaTtl = r.fire.duration;
      p.areaDps = r.fire.dps;
    }
    w.events.push('fired', {
      shooterKind: 'protester',
      shooterId: handle,
      weapon: r.weapon,
      x0: x,
      y0: y,
      z0: 0,
      x1: u.x,
      y1: u.y,
      projectileId: p.id,
      hits: 0,
    });
  },
};

// ── Climbers ───────────────────────────────────────────────────────────────────────────

/** Total climb time for building b. */
function climbTime(w: World, b: number): number {
  return w.map.buildings[b]!.storeys * BALANCE.climbSecondsPerStorey;
}

export const climber: ProtesterBehaviour = {
  id: 'climber',
  think(w, s) {
    const c = w.crowd;
    if (c.state[s] !== PS.MARCH || w.roofBuildings.length === 0) return;
    const x = c.x[s]!;
    const y = c.y[s]!;
    const R = BALANCE.climbDetectRadius;
    const pr = PROTESTERS[c.type[s]!]!.radius;
    for (const b of w.roofBuildings) {
      if (w.roofGuarded[b] || w.roofClimbers[b]! >= BALANCE.maxClimbersPerRoof) continue;
      const B = w.map.buildings[b]!;
      const dx = Math.max(B.i - x, 0, x - (B.i + B.w));
      const dy = Math.max(B.j - y, 0, y - (B.j + B.d));
      if (dx * dx + dy * dy > R * R) continue;
      const pts = w.climbPointsOf(b);
      if (pts.length === 0) continue;
      const mw = w.map.w;
      let best = -1;
      let bd = Infinity;
      for (let k = 0; k < pts.length; k++) {
        const t = pts[k]!;
        const ti = t % mw;
        const tj = (t - ti) / mw;
        const ex = ti + 0.5 - x;
        const ey = tj + 0.5 - y;
        const d = ex * ex + ey * ey;
        if (d < bd) {
          bd = d;
          best = t;
        }
      }
      const ti = best % mw;
      const tj = (best - ti) / mw;
      // Stand against the facade.
      const cx = ti + 0.5;
      const cy = tj + 0.5;
      const qx = Math.min(Math.max(cx, B.i), B.i + B.w);
      const qy = Math.min(Math.max(cy, B.j), B.j + B.d);
      const ox = cx - qx;
      const oy = cy - qy;
      const ol = Math.sqrt(ox * ox + oy * oy) || 1;
      c.gx[s] = qx + (ox / ol) * (pr + 0.05);
      c.gy[s] = qy + (oy / ol) * (pr + 0.05);
      c.state[s] = PS.TO_CLIMB;
      c.bld[s] = b;
      c.stT[s] = BALANCE.climbGiveUp;
      w.roofClimbers[b]!++;
      return;
    }
  },
};

function abortClimb(w: World, s: number): void {
  const c = w.crowd;
  const b = c.bld[s]!;
  if (b >= 0) w.roofClimbers[b] = Math.max(0, w.roofClimbers[b]! - 1);
  c.bld[s] = -1;
  c.climb[s] = 0;
  c.state[s] = PS.MARCH;
}

/**
 * Per-tick update for TO_CLIMB / CLIMBING / ON_ROOF / CLIMB_DOWN. Writes D for TO_CLIMB;
 * returns false when the protester is on the facade/roof (no ground movement this tick).
 */
export function climbUpdate(w: World, s: number, dt: number): boolean {
  const c = w.crowd;
  const b = c.bld[s]!;
  const st = c.state[s]!;
  const ru = b >= 0 ? w.roofUnitAt(b) : undefined;
  if (st === PS.TO_CLIMB) {
    if (!ru || w.roofGuarded[b]) {
      abortClimb(w, s);
      marchDesire(w, s);
      return true;
    }
    c.stT[s] = c.stT[s]! - dt;
    if (c.stT[s]! <= 0) {
      abortClimb(w, s);
      marchDesire(w, s);
      return true;
    }
    const dx = c.gx[s]! - c.x[s]!;
    const dy = c.gy[s]! - c.y[s]!;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.3) {
      c.state[s] = PS.CLIMBING;
      c.x[s] = c.gx[s]!;
      c.y[s] = c.gy[s]!;
      c.vx[s] = c.vy[s] = 0;
      const dur = climbTime(w, b);
      c.stT[s] = dur;
      c.climb[s] = 0;
      c.anim[s] = PANIM.CLIMB;
      c.facing[s] = facing4(dx, dy); // face the wall
      w.events.push('climbStart', {
        handle: c.handle(s),
        building: b,
        x: c.x[s]!,
        y: c.y[s]!,
        duration: dur,
      });
      return false;
    }
    D.x = dx / d;
    D.y = dy / d;
    return true;
  }
  const total = climbTime(w, b);
  if (st === PS.CLIMBING) {
    c.stT[s] = c.stT[s]! - dt;
    c.climb[s] = Math.min(1, 1 - c.stT[s]! / total);
    c.anim[s] = PANIM.CLIMB;
    if (c.stT[s]! <= 0) {
      if (ru) {
        c.state[s] = PS.ON_ROOF;
        c.climb[s] = 1;
        ru.roofAttackers++;
        c.anim[s] = PANIM.ROOF;
        w.events.push('reachedRoof', { handle: c.handle(s), building: b });
      } else {
        c.state[s] = PS.CLIMB_DOWN;
        c.stT[s] = total * 0.5;
      }
    }
    return false;
  }
  if (st === PS.ON_ROOF) {
    if (!ru) {
      c.state[s] = PS.CLIMB_DOWN;
      c.stT[s] = total * 0.5;
      return false;
    }
    c.anim[s] = PANIM.ROOF;
    const def = PROTESTERS[c.type[s]!]!;
    const m = def.loadouts[c.loadout[s]!]!.melee;
    if (c.cd[s]! <= 0 && c.stun[s]! <= 0) {
      const dps = m ? m.dps : 3;
      const interval = m ? m.interval : 1;
      c.cd[s] = interval;
      c.lastAtk[s] = w.time;
      c.anim[s] = PANIM.ATTACK;
      const handle = c.handle(s);
      w.events.push('attacked', {
        attackerKind: 'protester',
        attackerId: handle,
        targetKind: 'unit',
        targetId: ru.id,
        x: ru.x,
        y: ru.y,
        damage: dps * interval,
        dmgType: 'melee',
      });
      const killed = hurtUnit(w, ru, dps * interval, DMG.melee, true, 'protester', handle, true);
      if (killed && !ru.alive) {
        // Whole squad gone: everyone on this roof climbs down.
        c.state[s] = PS.CLIMB_DOWN;
        c.stT[s] = total * 0.5;
      }
    }
    return false;
  }
  if (st === PS.CLIMB_DOWN) {
    c.stT[s] = c.stT[s]! - dt;
    c.climb[s] = Math.max(0, c.stT[s]! / (total * 0.5));
    c.anim[s] = PANIM.CLIMB;
    if (c.stT[s]! <= 0) abortClimb(w, s);
    return false;
  }
  return true;
}

// ── Prophets ───────────────────────────────────────────────────────────────────────────

export function explodeProphet(w: World, s: number): void {
  const c = w.crowd;
  const def = PROTESTERS[c.type[s]!]!;
  const e = def.explode;
  if (!e) return;
  const x = c.x[s]!;
  const y = c.y[s]!;
  const handle = c.handle(s);
  const nearCapitol = w.nav.distAt(x, y) <= BALANCE.capitolReach + 1;
  w.events.push('exploded', { kind: 'prophet', x, y, radius: e.radius });
  killProtester(w, s, DMG.explosion, true, -1);
  blast(w, x, y, e.radius, e.damage, DMG.explosion, true, {
    crowd: e.crowdFactor,
    units: 1,
    roofs: false,
    vsTankFraction: e.vsTankFraction,
    attackerKind: 'protester',
    attackerId: handle,
    by: -1,
  });
  if (nearCapitol) w.capitol.damage(w, e.capitolDamage);
}

export const prophet: ProtesterBehaviour = {
  id: 'prophet',
  onContact(w, s) {
    explodeProphet(w, s);
    return true;
  },
};

// ── Breta & paparazzi ──────────────────────────────────────────────────────────────────

/** Paparazzi flock around Breta (ring position from their lane value). */
export function followDesire(w: World, s: number): void {
  const c = w.crowd;
  const b = w.bretaSlot;
  if (b < 0 || !c.alive[b]) {
    c.state[s] = PS.MARCH;
    marchDesire(w, s);
    return;
  }
  // Ring slot from the lane value via the rational circle parametrisation (no trig, so
  // results do not depend on the engine's Math.sin/cos).
  const t = c.lane[s]! * 2.4;
  const den = 1 + t * t;
  const tx = c.x[b]! + ((1 - t * t) / den) * 1.3;
  const ty = c.y[b]! + ((2 * t) / den) * 1.3;
  const dx = tx - c.x[s]!;
  const dy = ty - c.y[s]!;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.25) {
    // In formation: drift with Breta along the flow.
    marchDesire(w, s);
    D.speed = 0.7;
    return;
  }
  D.x = dx / d;
  D.y = dy / d;
  D.speed = d > 3 ? 1.3 : 1;
}

export const paparazzi: ProtesterBehaviour = {
  id: 'paparazzi',
  think(w, s) {
    const c = w.crowd;
    const f = PROTESTERS[c.type[s]!]!.flash;
    if (!f || c.cd2[s]! > 0 || c.stun[s]! > 0) return;
    const u = nearestUnit(w, c.x[s]!, c.y[s]!, f.range, false);
    if (!u) return;
    u.stun = Math.max(u.stun, f.blind);
    u.blind = Math.max(u.blind, f.blind);
    c.cd2[s] = f.cooldown;
    c.lastAtk[s] = w.time;
    w.events.push('flash', { handle: c.handle(s), x: c.x[s]!, y: c.y[s]!, unitId: u.id });
  },
};

/** Breta's aura: speed factor for a protester at (x, y). */
export function auraFactor(w: World, x: number, y: number): number {
  const b = w.bretaSlot;
  if (b < 0) return 1;
  const c = w.crowd;
  const a = PROTESTERS[PT.breta]!.aura!;
  const dx = c.x[b]! - x;
  const dy = c.y[b]! - y;
  return dx * dx + dy * dy <= a.radius * a.radius ? 1 + a.speedBonus : 1;
}
