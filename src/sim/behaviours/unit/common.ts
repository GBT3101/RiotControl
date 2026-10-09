/**
 * Shared unit behaviour building blocks: melee strikes, ranged fire (hitscan bursts /
 * ballistic shells), commandable movement.
 */
import { BALANCE } from '../../../data/balance';
import { DMG } from '../../../data/damage';
import {
  acquireTarget,
  aimAt,
  dir8Fast,
  engage,
  findTarget,
  findTargetBeyond,
  fireHitscan,
  hurtProtester,
  validateHolders,
} from '../../combat';
import { PS } from '../../crowd';
import { TEAM_POLICE } from '../../projectiles';
import { facing4, US, type Unit } from '../../units';
import type { World } from '../../world';

export function isDisabled(u: Unit): boolean {
  return u.stun > 0 || u.blind > 0;
}

const recruitBuf = new Int32Array(64);

/**
 * Blocking: a stationary unit with free melee slots pulls nearby marching protesters into
 * them (Kingdom-Rush style interception) — they walk up and fight it instead of passing by.
 * Throttled (every 4 ticks, staggered by unit id).
 */
export function recruit(w: World, u: Unit): void {
  const slots = u.holders.length;
  if (slots === 0 || u.nHolders >= slots || u.moving || ((w.tick + u.id) & 3) !== 0) return;
  const c = w.crowd;
  const n = w.hash.query(c, u.x, u.y, u.def.radius + BALANCE.engageRadius, recruitBuf);
  for (let k = 0; k < n && u.nHolders < slots; k++) {
    const s = recruitBuf[k]!;
    const st = c.state[s]!;
    if (st !== PS.MARCH && st !== PS.FOLLOW) continue;
    engage(w, s, u);
  }
}

/** Melee: hit a slot holder (or the nearest protester in reach) every cooldown. */
export function meleeStrike(w: World, u: Unit, dt: number): void {
  const a = u.def.attack;
  if (!a) return;
  if (isDisabled(u)) {
    u.state = US.STUNNED;
    return;
  }
  if (u.cd > 0) u.cd -= dt;
  if (u.cd > 0) return;
  const c = w.crowd;
  let t = -1;
  const hs = u.holders;
  for (let k = 0; k < hs.length; k++) {
    const h = hs[k]!;
    if (h === -1) continue;
    const s = c.resolve(h);
    if (s >= 0) {
      t = s;
      break;
    }
  }
  if (t < 0) t = findTarget(w, u.x, u.y, a.range + u.def.radius, true);
  if (t < 0) {
    if (w.time - u.lastAttack > 0.6) u.state = US.IDLE;
    return;
  }
  const tx = c.x[t]!;
  const ty = c.y[t]!;
  aimAt(u, tx, ty);
  w.events.push('attacked', {
    attackerKind: 'unit',
    attackerId: u.id,
    targetKind: 'protester',
    targetId: c.handle(t),
    x: tx,
    y: ty,
    damage: a.damage,
    dmgType: a.dmgType,
  });
  hurtProtester(w, t, a.damage, DMG[a.dmgType], a.lethal, u.id);
  u.cd = a.cooldown;
  u.lastAttack = w.time;
  u.state = US.ATTACKING;
}

/** Ranged: acquire a target with hysteresis and fire (hitscan bursts or ballistic). */
export function rangedFire(w: World, u: Unit, dt: number): void {
  const a = u.def.attack;
  if (!a) return;
  if (isDisabled(u)) {
    u.state = US.STUNNED;
    u.burstLeft = 0;
    return;
  }
  if (u.cd > 0) u.cd -= dt;
  const t = acquireTarget(w, u, a.range, dt);
  if (u.burstLeft > 0) {
    u.burstT -= dt;
    if (u.burstT <= 0) {
      if (t >= 0) fireHitscan(w, u, t, a);
      u.burstLeft--;
      u.burstT += a.burst?.interval ?? 0.1;
    }
  }
  if (t < 0) {
    if (u.burstLeft === 0 && w.time - u.lastAttack > 0.6 && u.state !== US.MOVING)
      u.state = US.IDLE;
    return;
  }
  if (u.cd > 0) return;
  if (a.delivery === 'ballistic') {
    const c = w.crowd;
    let bt = t;
    if (a.minRange && (c.x[bt]! - u.x) ** 2 + (c.y[bt]! - u.y) ** 2 < a.minRange * a.minRange) {
      // Too close for the shell: pick the best target outside the safety radius.
      bt = findTargetBeyond(w, u.x, u.y, a.range, a.minRange);
      if (bt < 0) return;
    }
    const tx = c.x[bt]!;
    const ty = c.y[bt]!;
    aimAt(u, tx, ty);
    const p = w.projectiles.spawn(
      'shell',
      TEAM_POLICE,
      u.id,
      u.x,
      u.y,
      u.z,
      tx,
      ty,
      a.projectileSpeed ?? 10,
    );
    p.damage = a.damage;
    p.radius = a.aoe?.radius ?? 1;
    p.dmg = DMG[a.dmgType];
    p.lethal = a.lethal;
    p.crowdFactor = 1;
    p.unitFactor = a.aoe?.friendlyFire ?? 0;
    w.events.push('fired', {
      shooterKind: 'unit',
      shooterId: u.id,
      weapon: a.weapon,
      x0: u.x,
      y0: u.y,
      z0: u.z,
      x1: tx,
      y1: ty,
      projectileId: p.id,
      hits: 0,
    });
    u.lastAttack = w.time;
    u.state = US.ATTACKING;
  } else {
    fireHitscan(w, u, t, a);
    if (a.burst && a.burst.count > 1) {
      u.burstLeft = a.burst.count - 1;
      u.burstT = a.burst.interval;
    }
  }
  u.cd += a.cooldown;
  if (u.cd < 0) u.cd = 0;
}

// ── Commandable movement ───────────────────────────────────────────────────────────────

/** Leave the home tile (stop blocking/claiming it). */
export function leaveTile(w: World, u: Unit): void {
  if (u.tile >= 0) {
    w.nav.addUnitCost(u.tile, -BALANCE.unitTileCost);
    if (w.unitTile[u.tile] === u.slot) w.unitTile[u.tile] = -1;
    u.tile = -1;
  }
}

/** Claim the tile under a stopped ground unit. */
export function settle(w: World, u: Unit): void {
  u.moving = false;
  u.state = US.IDLE;
  if (u.def.placement !== 'road') return;
  const t = w.nav.tileAt(u.x, u.y);
  if (t >= 0 && w.unitTile[t]! < 0) {
    u.tile = t;
    w.unitTile[t] = u.slot;
    w.nav.addUnitCost(t, BALANCE.unitTileCost);
  }
}

/** Send a commandable unit to tile (i, j). Ground units path on roads only; the helicopter flies. */
export function commandUnit(w: World, u: Unit, i: number, j: number): boolean {
  if (!u.alive || !u.def.commandable || !w.nav.inBounds(i, j)) return false;
  let path: number[];
  if (u.def.placement === 'air') {
    path = [j * w.map.w + i];
  } else {
    const p = w.nav.findPath(Math.floor(u.x), Math.floor(u.y), i, j);
    if (!p) return false;
    path = p;
  }
  leaveTile(w, u);
  validateHolders(w, u, true);
  u.path = path;
  u.pathIdx = 0;
  u.destI = i;
  u.destJ = j;
  w.events.push('commanded', { unitId: u.id, toI: i, toJ: j, pathLength: path.length });
  if (path.length === 0) settle(w, u);
  else {
    u.moving = true;
    u.state = US.MOVING;
  }
  return true;
}

/** Advance along the path. Returns true while moving. */
export function moverUpdate(w: World, u: Unit, dt: number): boolean {
  if (u.pathIdx >= u.path.length) {
    if (u.moving) settle(w, u);
    return false;
  }
  if (u.stun > 0) return true;
  const mw = w.map.w;
  const next = u.path[u.pathIdx]!;
  const tx = (next % mw) + 0.5;
  const ty = Math.floor(next / mw) + 0.5;
  const dx = tx - u.x;
  const dy = ty - u.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const step = u.def.speed * dt;
  if (d > 1e-6) {
    u.dir8 = dir8Fast(dx, dy);
    u.facing = facing4(dx, dy);
  }
  if (d <= step) {
    u.x = tx;
    u.y = ty;
    u.pathIdx++;
    if (u.pathIdx >= u.path.length) {
      settle(w, u);
      return false;
    }
  } else {
    u.x += (dx / d) * step;
    u.y += (dy / d) * step;
  }
  u.moving = true;
  if (u.state !== US.ATTACKING || w.time - u.lastAttack > 0.3) u.state = US.MOVING;
  return true;
}
