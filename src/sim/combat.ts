/**
 * Combat primitives: damage & death for protesters and units, area damage, targeting,
 * hitscan shots (piercing / spread / splash). All randomness goes through `w.rng`.
 */
import { BALANCE } from '../data/balance';
import { DAMAGE_TYPES, DMG, type DamageId } from '../data/damage';
import { PROTESTERS, PT } from '../data/protesters';
import { unitIndex, type AttackDef } from '../data/units';
import { BODY_KIND } from './bodies';
import { PS } from './crowd';
import { gainHate, gainLegit, protesterHate } from './economy';
import type { ActorKind } from './events';
import { facing4, US, type Unit } from './units';
import type { World } from './world';

const NDMG = DAMAGE_TYPES.length;

// ── Protesters ──────────────────────────────────────────────────────────────────────────

/**
 * Damage a protester (per-type resistances applied). Returns true if it died. `by` = unit id of
 * the source or -1.
 */
export function hurtProtester(
  w: World,
  s: number,
  amount: number,
  dmg: DamageId,
  lethal: boolean,
  by: number,
): boolean {
  const c = w.crowd;
  if (!c.alive[s] || amount <= 0) return false;
  const hp = c.hp[s]! - amount * w.resist[c.type[s]! * NDMG + dmg]!;
  c.hp[s] = hp;
  if (hp > 0) return false;
  killProtester(w, s, dmg, lethal, by);
  return true;
}

export function killProtester(
  w: World,
  s: number,
  dmg: DamageId,
  lethal: boolean,
  by: number,
): void {
  const c = w.crowd;
  if (!c.alive[s]) return;
  const type = c.type[s]!;
  const def = PROTESTERS[type]!;
  const x = c.x[s]!;
  const y = c.y[s]!;
  const handle = c.handle(s);
  detachProtester(w, s);
  const bodyId = w.bodies.add(
    w.rng,
    x,
    y,
    BODY_KIND.PROTESTER,
    type,
    c.variant[s]!,
    lethal,
    c.facing[s]!,
    dmg,
  );
  w.events.push('died', {
    handle,
    ptype: def.id,
    x,
    y,
    cause: DAMAGE_TYPES[dmg]!,
    lethal,
    bodyId,
    by,
  });
  const st = w.stats;
  st.protestersFallen[def.id]++;
  if (lethal) st.protestersKilled++;
  else st.protestersKO++;
  if (type === PT.breta) {
    st.bretaDowned++;
    w.bretaSlot = -1;
  }
  if (by >= 0) {
    const u = w.units.get(by);
    if (u) u.kills++;
  }
  c.release(s);
  protesterHate(w, def.hate, def.bounty === true, x, y);
}

/** Remove a protester's references from units/roofs (before death or state change). */
export function detachProtester(w: World, s: number): void {
  const c = w.crowd;
  const eu = c.engUnit[s]!;
  if (eu >= 0) {
    const u = w.units.at(eu);
    if (u) releaseHolder(u, c.handle(s));
    c.engUnit[s] = -1;
  }
  const b = c.bld[s]!;
  if (b >= 0) {
    const st = c.state[s]!;
    if (st === PS.TO_CLIMB || st === PS.CLIMBING || st === PS.ON_ROOF || st === PS.CLIMB_DOWN) {
      w.roofClimbers[b] = Math.max(0, w.roofClimbers[b]! - 1);
    }
    if (st === PS.ON_ROOF) {
      const ru = w.roofUnitAt(b);
      if (ru) ru.roofAttackers = Math.max(0, ru.roofAttackers - 1);
    }
    c.bld[s] = -1;
  }
}

export function releaseHolder(u: Unit, handle: number): void {
  const hs = u.holders;
  for (let k = 0; k < hs.length; k++) {
    if (hs[k] === handle) {
      hs[k] = -1;
      u.nHolders--;
      return;
    }
  }
}

/** Try to put a protester into a free melee slot of `u`. */
export function engage(w: World, s: number, u: Unit): boolean {
  const hs = u.holders;
  const slots =
    u.type === 'blockade' ? Math.min(hs.length, u.def.meleeSlots * u.tiles.length) : hs.length;
  if (u.nHolders >= slots) return false;
  const c = w.crowd;
  for (let k = 0; k < slots; k++) {
    if (hs[k] === -1) {
      hs[k] = c.handle(s);
      u.nHolders++;
      c.engUnit[s] = u.slot;
      c.state[s] = PS.ENGAGED;
      return true;
    }
  }
  return false;
}

/** Drop holders that died / left; release everyone (unit moves away or dies). */
export function validateHolders(w: World, u: Unit, releaseAll = false): void {
  const c = w.crowd;
  const hs = u.holders;
  for (let k = 0; k < hs.length; k++) {
    const h = hs[k]!;
    if (h === -1) continue;
    const s = c.resolve(h);
    if (s < 0 || c.engUnit[s] !== u.slot || releaseAll) {
      hs[k] = -1;
      u.nHolders--;
      if (s >= 0 && c.engUnit[s] === u.slot) {
        c.engUnit[s] = -1;
        if (c.state[s] === PS.ENGAGED) c.state[s] = PS.MARCH;
      }
    }
  }
}

// ── Units ───────────────────────────────────────────────────────────────────────────────

/**
 * Damage a unit (armour applied). Returns true if the unit (or a squad member) died.
 * `thrownOff`: killed by climbers on its roof.
 */
export function hurtUnit(
  w: World,
  u: Unit,
  amount: number,
  dmg: DamageId,
  lethal: boolean,
  attackerKind: ActorKind,
  attackerId: number,
  thrownOff = false,
  armourPiercing = false,
): boolean {
  if (!u.alive || u.def.invulnerable || amount <= 0) return false;
  let dealt = armourPiercing ? amount : amount * u.armour[dmg]!;
  // Outnumbered (sim/mob.ts): a mob's blows land harder on a lone unit.
  if (attackerKind === 'protester' && dmg === DMG.melee) dealt *= u.mob;
  u.hp -= dealt;
  u.lastHurt = w.time;
  w.stats.damageTaken += dealt;
  if (u.hp > 0) return false;
  killUnitMember(w, u, dmg, lethal, thrownOff, attackerKind === 'protester' ? attackerId : -1);
  return true;
}

/** Kill one squad member (or the whole unit when it is the last). */
export function killUnitMember(
  w: World,
  u: Unit,
  dmg: DamageId,
  lethal: boolean,
  thrownOff: boolean,
  attackerHandle = -1,
): void {
  const def = u.def;
  const member = def.squad - u.members;
  let bx = u.x;
  let by = u.y;
  if (thrownOff && u.building >= 0) {
    // Land beyond the facade on the attacker's side.
    const b = w.map.buildings[u.building]!;
    const as = attackerHandle >= 0 ? w.crowd.resolve(attackerHandle) : -1;
    let tx = as >= 0 ? w.crowd.gx[as]! : b.i + b.w * 0.5;
    let ty = as >= 0 ? w.crowd.gy[as]! : b.j + b.d + 0.5;
    const dx = tx - u.x;
    const dy = ty - u.y;
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    tx += (dx / l) * 0.6;
    ty += (dy / l) * 0.6;
    if (w.nav.isSolidAt(tx, ty)) {
      tx -= (dx / l) * 0.6;
      ty -= (dy / l) * 0.6;
    }
    bx = tx;
    by = ty;
    w.events.push('thrownOffRoof', {
      unitId: u.id,
      unit: u.type,
      member,
      building: u.building,
      fromX: u.x,
      fromY: u.y,
      height: b.storeys,
      toX: bx,
      toY: by,
    });
  }
  const bodyId = w.bodies.add(
    w.rng,
    bx,
    by,
    BODY_KIND.UNIT,
    unitIndex(u.type),
    u.id,
    lethal,
    u.facing,
    dmg,
  );
  u.members--;
  w.stats.officersLost[u.type]++;
  const last = u.members <= 0;
  w.events.push('unitDied', {
    unitId: u.id,
    unit: u.type,
    x: bx,
    y: by,
    cause: DAMAGE_TYPES[dmg]!,
    lethal,
    bodyId,
    member,
    squadLeft: Math.max(0, u.members),
    thrownOff,
  });
  gainHate(w, BALANCE.hatePerUnitDeath, bx, by, 'unit');
  if (!last) {
    u.hp = u.maxHp;
    return;
  }
  removeUnit(w, u);
  if (def.legit > 0) gainLegit(w, def.legit, u.x, u.y, u.type);
}

/** Remove a unit from the world (death). */
export function removeUnit(w: World, u: Unit): void {
  validateHolders(w, u, true);
  const nav = w.nav;
  if (u.type === 'blockade') {
    for (const t of u.tiles) if (nav.blockade[t] === u.slot) nav.setBlockade(t, -1);
  }
  if (u.tile >= 0) {
    nav.addUnitCost(u.tile, -BALANCE.unitTileCost);
    if (w.unitTile[u.tile] === u.slot) w.unitTile[u.tile] = -1;
    u.tile = -1;
  }
  if (u.building >= 0) {
    if (w.roofUnit[u.building] === u.slot) w.roofUnit[u.building] = -1;
    w.refreshRoofList();
  }
  if (u.def.wreck) {
    const wr = u.def.wreck;
    w.areas.spawnArea(w, 'fire', u.x, u.y, wr.radius, wr.duration, wr.dps, 0, 0);
  }
  u.state = US.DEAD;
  w.units.release(u);
}

// ── Area damage ─────────────────────────────────────────────────────────────────────────

export interface BlastOpts {
  /** Damage factor for protesters (0 = none). */
  crowd: number;
  /** Damage factor for own ground units (0 = none). */
  units: number;
  /** Hit units on rooftops whose building centre is within the radius (bazooka). */
  roofs?: boolean;
  /** Tanks take this fraction of max HP instead (Prophets). */
  vsTankFraction?: number;
  attackerKind: ActorKind;
  attackerId: number;
  /** Unit id credited for protester kills. */
  by: number;
}

const blastBuf = new Int32Array(2048);

/** Flat damage to everything (per opts) within `r` of (x, y). */
export function blast(
  w: World,
  x: number,
  y: number,
  r: number,
  damage: number,
  dmg: DamageId,
  lethal: boolean,
  o: BlastOpts,
): void {
  if (o.crowd > 0) {
    const n = w.hash.query(w.crowd, x, y, r, blastBuf);
    for (let k = 0; k < n; k++) {
      const s = blastBuf[k]!;
      const st = w.crowd.state[s]!;
      if (st === PS.ON_ROOF || st === PS.CLIMBING) continue;
      hurtProtester(w, s, damage * o.crowd, dmg, lethal, o.by);
    }
  }
  if (o.units > 0 || o.roofs) {
    const list = w.units.active;
    for (let k = 0; k < list.length; k++) {
      const u = list[k]!;
      if (!u.alive || u.def.invulnerable) continue;
      const roof = u.building >= 0;
      if (roof ? !o.roofs : o.units <= 0) continue;
      const dx = u.x - x;
      const dy = u.y - y;
      const rr = r + u.def.radius;
      if (dx * dx + dy * dy > rr * rr) continue;
      let amount = roof ? damage : damage * o.units;
      let ap = false;
      if (o.vsTankFraction !== undefined && u.type === 'tank') {
        amount = u.maxHp * o.vsTankFraction;
        ap = true;
      }
      w.events.push('attacked', {
        attackerKind: o.attackerKind,
        attackerId: o.attackerId,
        targetKind: 'unit',
        targetId: u.id,
        x: u.x,
        y: u.y,
        damage: amount,
        dmgType: DAMAGE_TYPES[dmg]!,
      });
      hurtUnit(w, u, amount, dmg, lethal, o.attackerKind, o.attackerId, false, ap);
    }
  }
}

// ── Targeting ───────────────────────────────────────────────────────────────────────────

let tw: World | null = null;
let tMelee = false;
/** Building the shooter stands on (-1 = ground): it cannot see down its own facade. */
let tRoof = -1;

/** Threat weighting: lower = preferred (score = dist² × weight). */
function targetWeight(s: number): number {
  const c = tw!.crowd;
  const st = c.state[s]!;
  if (st === PS.ON_ROOF || st === PS.CLIMB_DOWN) return 0;
  if (st === PS.CLIMBING) return tMelee || c.bld[s] === tRoof ? 0 : 0.5;
  const t = c.type[s]!;
  if (t === PT.prophet) return 0.35;
  if (st === PS.CAPITOL) return 0.6;
  // Cover shoots climbers on their way; the target itself does not single them out.
  if (st === PS.TO_CLIMB) return c.bld[s] === tRoof ? 1 : 0.6;
  if (st === PS.ENGAGED || st === PS.HUNT) return 0.8;
  if (t === PT.breta) return 0.9;
  return 1;
}
const MIN_WEIGHT = 0.35;

/** Score of a protester for a shooter at (x, y) (Infinity = invalid). */
export function targetScore(
  w: World,
  x: number,
  y: number,
  s: number,
  melee = false,
  roof = -1,
): number {
  tw = w;
  tMelee = melee;
  tRoof = roof;
  const wt = targetWeight(s);
  if (wt <= 0) return Infinity;
  const dx = w.crowd.x[s]! - x;
  const dy = w.crowd.y[s]! - y;
  return (dx * dx + dy * dy) * wt;
}

/** Best protester within `range` (threat-weighted nearest), or -1. `roof`: shooter's building. */
export function findTarget(
  w: World,
  x: number,
  y: number,
  range: number,
  melee = false,
  roof = -1,
): number {
  tw = w;
  tMelee = melee;
  tRoof = roof;
  return w.hash.best(w.crowd, x, y, range, targetWeight, MIN_WEIGHT);
}

let tmx = 0;
let tmy = 0;
let tmMin2 = 0;
function targetWeightMin(s: number): number {
  const c = tw!.crowd;
  const dx = c.x[s]! - tmx;
  const dy = c.y[s]! - tmy;
  if (dx * dx + dy * dy < tmMin2) return 0;
  return targetWeight(s);
}

/** Like findTarget but ignores protesters closer than `minRange` (ballistic weapons). */
export function findTargetBeyond(
  w: World,
  x: number,
  y: number,
  range: number,
  minRange: number,
): number {
  tw = w;
  tMelee = false;
  tRoof = -1;
  tmx = x;
  tmy = y;
  tmMin2 = minRange * minRange;
  return w.hash.best(w.crowd, x, y, range, targetWeightMin, MIN_WEIGHT);
}

/**
 * Keep/replace a unit's target with hysteresis. Returns the target slot or -1.
 * Retargets at most every `BALANCE.unitRetarget` seconds (staggered by unit id).
 */
export function acquireTarget(w: World, u: Unit, range: number, dt: number, melee = false): number {
  const c = w.crowd;
  let cur = u.target >= 0 ? c.resolve(u.target) : -1;
  let curScore = Infinity;
  if (cur >= 0) {
    curScore = targetScore(w, u.x, u.y, cur, melee, u.building);
    const r = range * 1.05;
    if (!(curScore < Infinity) || dist2(u.x, u.y, c.x[cur]!, c.y[cur]!) > r * r) {
      cur = -1;
      curScore = Infinity;
    }
  }
  u.retargetT -= dt;
  if (cur < 0 || u.retargetT <= 0) {
    u.retargetT = BALANCE.unitRetarget + (u.id % 5) * 0.01;
    const best = findTarget(w, u.x, u.y, range, melee, u.building);
    if (best >= 0 && best !== cur) {
      const sc = targetScore(w, u.x, u.y, best, melee, u.building);
      if (cur < 0 || sc < curScore * BALANCE.targetHysteresis) cur = best;
    }
  }
  u.target = cur >= 0 ? c.handle(cur) : -1;
  return cur;
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

// ── Hitscan ─────────────────────────────────────────────────────────────────────────────

const shotBuf = new Int32Array(512);
/** `lineHits` results: protester slots and their distances along the line. */
export const pierceS = new Int32Array(16);
export const pierceT = new Float32Array(16);

/** Random protester within `r` of (x, y) (or -1). */
export function randomNear(w: World, x: number, y: number, r: number): number {
  const n = w.hash.query(w.crowd, x, y, r, shotBuf);
  if (n === 0) return -1;
  for (let tries = 0; tries < 4; tries++) {
    const s = shotBuf[w.rng.int(0, n - 1)]!;
    const st = w.crowd.state[s]!;
    if (st !== PS.ON_ROOF && st !== PS.CLIMB_DOWN) return s;
  }
  return -1;
}

/**
 * Fire one hitscan shot from unit `u` at protester slot `t` using attack `a`.
 * Handles spread, piercing lines and splash. Emits `fired` (tracer) + damage events.
 */
export function fireHitscan(w: World, u: Unit, t: number, a: AttackDef): void {
  const c = w.crowd;
  if (a.spread && a.spreadChance && w.rng.chance(a.spreadChance)) {
    const alt = randomNear(w, c.x[t]!, c.y[t]!, a.spread);
    if (alt >= 0) t = alt;
  }
  const tx = c.x[t]!;
  const ty = c.y[t]!;
  const dmg = DMG[a.dmgType];
  let ix = tx;
  let iy = ty;
  aimAt(u, tx, ty);
  if (a.pierce && a.pierce > 1) {
    const dx = tx - u.x;
    const dy = ty - u.y;
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / l;
    const uy = dy / l;
    const n = lineHits(w, u.x, u.y, ux, uy, a.range, a.pierceWidth ?? 0.35, a.pierce);
    // The aimed target is always hit even if the line search missed it (edge of width).
    if (n === 0) {
      pierceS[0] = t;
      pierceT[0] = l;
    }
    const m = Math.max(n, 1);
    const far = pierceT[m - 1]!;
    ix = u.x + ux * far;
    iy = u.y + uy * far;
    w.events.push('fired', {
      shooterKind: 'unit',
      shooterId: u.id,
      weapon: a.weapon,
      x0: u.x,
      y0: u.y,
      z0: u.z,
      x1: ix,
      y1: iy,
      projectileId: -1,
      hits: m,
    });
    // pierceS is not touched by hurtProtester (no nested line queries).
    for (let k = 0; k < m; k++) hurtProtester(w, pierceS[k]!, a.damage, dmg, a.lethal, u.id);
  } else {
    w.events.push('fired', {
      shooterKind: 'unit',
      shooterId: u.id,
      weapon: a.weapon,
      x0: u.x,
      y0: u.y,
      z0: u.z,
      x1: ix,
      y1: iy,
      projectileId: -1,
      hits: 1,
    });
    hurtProtester(w, t, a.damage, dmg, a.lethal, u.id);
    if (a.stun) w.crowd.stun[t] = Math.max(w.crowd.stun[t]!, a.stun);
    if (a.splash) {
      const n = w.hash.query(c, ix, iy, a.splash.radius, shotBuf);
      for (let k = 0; k < n; k++) {
        const s = shotBuf[k]!;
        if (s === t) continue;
        const st = c.state[s]!;
        if (st === PS.ON_ROOF || st === PS.CLIMBING) continue;
        hurtProtester(w, s, a.damage * a.splash.factor, dmg, a.lethal, u.id);
      }
    }
  }
  u.lastAttack = w.time;
  u.state = US.ATTACKING;
}

/**
 * Protesters within `width` of the ray (x, y) + t·(ux, uy), 0 < t ≤ len, sorted by t,
 * at most `max` (≤ 16). Results in pierceS/pierceT; returns the count.
 */
export function lineHits(
  w: World,
  x: number,
  y: number,
  ux: number,
  uy: number,
  len: number,
  width: number,
  max: number,
): number {
  const c = w.crowd;
  const cx = x + ux * len * 0.5;
  const cy = y + uy * len * 0.5;
  const n = w.hash.query(c, cx, cy, len * 0.5 + width, shotBuf);
  let m = 0;
  const cap = Math.min(max, 16);
  for (let k = 0; k < n; k++) {
    const s = shotBuf[k]!;
    const st = c.state[s]!;
    if (st === PS.ON_ROOF || st === PS.CLIMB_DOWN) continue;
    const dx = c.x[s]! - x;
    const dy = c.y[s]! - y;
    const t = dx * ux + dy * uy;
    if (t <= 0 || t > len) continue;
    const lat = Math.abs(dx * uy - dy * ux);
    if (lat > width) continue;
    // Insertion into the sorted top-`cap` list.
    if (m === cap && t >= pierceT[m - 1]!) continue;
    let p = m < cap ? m++ : m - 1;
    while (p > 0 && pierceT[p - 1]! > t) {
      pierceT[p] = pierceT[p - 1]!;
      pierceS[p] = pierceS[p - 1]!;
      p--;
    }
    pierceT[p] = t;
    pierceS[p] = s;
  }
  return m;
}

/** Point a unit (facing, aim direction) at (tx, ty). */
export function aimAt(u: Unit, tx: number, ty: number): void {
  const dx = tx - u.x;
  const dy = ty - u.y;
  if (dx === 0 && dy === 0) return;
  const l = Math.sqrt(dx * dx + dy * dy);
  u.aimX = dx / l;
  u.aimY = dy / l;
  u.facing = facing4(dx, dy);
  u.aim8 = dir8Fast(dx, dy);
}

/** 8-way direction without trig (screen octants; see units.dir8FromDelta). */
export function dir8Fast(du: number, dv: number): number {
  const sx = du - dv;
  const sy = (du + dv) * 0.5;
  const ax = Math.abs(sx);
  const ay = Math.abs(sy);
  // tan(22.5°) ≈ 0.4142
  if (ay <= ax * 0.41421356) return sx >= 0 ? 0 : 4;
  if (ax <= ay * 0.41421356) return sy >= 0 ? 2 : 6;
  if (sx >= 0) return sy >= 0 ? 1 : 7;
  return sy >= 0 ? 3 : 5;
}
