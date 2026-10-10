/**
 * Special skills (docs/specials.md): Mounted Riot Police ram, Armed Cops rapid fire, Soldiers'
 * frag grenade, the Tank's player-aimed missile and the Helicopter's painted air strike (the Tear
 * Gas Shooter's grenade lives in behaviours/unit/specials.ts and is dispatched from here too).
 *
 * A skill charges (`chargeAbility`, paused while the unit is stunned or knocked down), then a
 * player command (`useSkill`) starts a *run* that resolves in the fixed step: the ram gallops the
 * horse down its lane, rapid fire spaces its shots, the frag / missile go off after their flight
 * time, the air strike walks its impacts along the painted line while the helicopter flies it.
 * The flight and impact timings are the ones the view's FX recipes use
 * (art/fx/specialRecipes.ts), so the blasts on screen and the kills line up. Skills never hurt the
 * player's own units; kills go through `hurtProtester` (normal Hate rules, kill credit).
 *
 * Events: `skillUsed` when a run starts, `skillHit` per blast / impact / bowled protester,
 * `skillShot` per rapid-fire shot, `skillEnded` when a unit-driving run is over.
 */
import { DMG, type DamageId } from '../data/damage';
import type {
  AbilityDef,
  AirStrikeAbility,
  FragAbility,
  MissileAbility,
  RamAbility,
  RapidFireAbility,
} from '../data/units';
import { arrive, isDisabled, leaveTile, settle } from './behaviours/unit/common';
import { densest, findDensest, useGasGrenade } from './behaviours/unit/specials';
import {
  aimAt,
  dir8Fast,
  findTarget,
  hurtProtester,
  lineHits,
  pierceS,
  pierceT,
  validateHolders,
} from './combat';
import { PS } from './crowd';
import { facing4, US, type Unit } from './units';
import type { World } from './world';

/** Where a player aimed a skill: a ground point (missile) or a painted line (air strike). */
export type SkillAim = { x: number; y: number } | { path: readonly number[] };

export interface SkillUseOptions {
  /**
   * Bots / auto-aim: aim the point and line skills at the densest crowd themselves, and only
   * fire when the target is worth it (`BOT_MIN`).
   */
  bot?: boolean;
}

/** Bots' minimum crowd for each skill (protesters in the lane / 3×3 cells / corridor). */
const BOT_MIN: Record<AbilityDef['id'], number> = {
  gasGrenade: 1,
  ram: 3,
  rapidFire: 1,
  fragGrenade: 6,
  missile: 14,
  airStrike: 14,
};

interface RunBase {
  id: number;
  unitId: number;
  /** Seconds since the run started. */
  t: number;
}

interface RamRun extends RunBase {
  kind: 'ram';
  ab: RamAbility;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Gallop time (s). */
  dur: number;
  /** Handles already bowled over (each protester is hit once per run). */
  hit: number[];
}

interface RapidRun extends RunBase {
  kind: 'rapid';
  ab: RapidFireAbility;
  shot: number;
}

interface BlastRun extends RunBase {
  kind: 'blast';
  skill: 'fragGrenade' | 'missile';
  at: number;
  x: number;
  y: number;
  radius: number;
  damage: number;
}

interface StrikeRun extends RunBase {
  kind: 'strike';
  ab: AirStrikeAbility;
  /** The line (flat tile coords) and the arc length at each point. */
  pts: number[];
  cum: number[];
  total: number;
  /** Impacts: count, next index, first impact time. */
  n: number;
  k: number;
  lead: number;
  /** Strafing speed (tiles/s), the heli's start point and when it reaches the run-in point. */
  speed: number;
  hx: number;
  hy: number;
  tEntry: number;
  tEnd: number;
}

export type SkillRun = RamRun | RapidRun | BlastRun | StrikeRun;

/** Active skill runs (owned by the World; deterministic order = start order). */
export class SkillRuns {
  active: SkillRun[] = [];
  nextId = 1;
}

// ── Charging ──────────────────────────────────────────────────────────────────────────

/** Charge a unit's skill; pauses while it is stunned / knocked down or busy with a run. */
export function chargeAbility(w: World, u: Unit, dt: number): void {
  const ab = u.def.ability;
  if (!ab || u.abilityReady || u.skillLock || isDisabled(u)) return;
  u.charge += dt;
  if (u.charge >= ab.charge) {
    u.charge = ab.charge;
    u.abilityReady = true;
    w.events.push('abilityReady', { unitId: u.id, skill: ab.id });
  }
}

function spend(w: World, u: Unit): void {
  u.abilityReady = false;
  u.charge = 0;
  w.stats.skillsUsed++;
}

/** `hurtProtester` that tallies the skill's kills (stats). */
function strike(
  w: World,
  s: number,
  amount: number,
  dmg: DamageId,
  lethal: boolean,
  by: number,
): boolean {
  const died = hurtProtester(w, s, amount, dmg, lethal, by);
  if (died) w.stats.skillKills++;
  return died;
}

// ── Use ───────────────────────────────────────────────────────────────────────────────

/**
 * Fire a unit's charged skill. Auto skills (gas, ram, rapid fire, frag) pick their own target;
 * the missile needs a ground point and the air strike a painted line (`aim`), unless `o.bot`
 * aims them at the densest crowd. Returns false (and keeps the charge) when it can't fire.
 */
export function useSkill(w: World, u: Unit, aim?: SkillAim, o: SkillUseOptions = {}): boolean {
  const ab = u.def.ability;
  if (!ab || !u.alive || !u.abilityReady || u.skillLock || isDisabled(u)) return false;
  const min = o.bot ? BOT_MIN[ab.id] : 1;
  switch (ab.id) {
    case 'gasGrenade': {
      const ok = useGasGrenade(w, u);
      if (ok) w.stats.skillsUsed++;
      return ok;
    }
    case 'ram':
      return startRam(w, u, ab, min);
    case 'rapidFire':
      return startRapid(w, u, ab);
    case 'fragGrenade':
      return throwFrag(w, u, ab, min);
    case 'missile': {
      let p = aim && 'x' in aim ? aim : null;
      if (!p && o.bot) {
        if (!findDensest(w, u.x, u.y, ab.range - 0.5) || densest.count < min) return false;
        p = { x: densest.x, y: densest.y };
      }
      return p ? fireMissile(w, u, ab, p.x, p.y) : false;
    }
    case 'airStrike': {
      let path = aim && 'path' in aim ? aim.path : null;
      if (!path && o.bot) path = botStrikeLine(w, u, ab, min);
      return path ? startStrike(w, u, ab, path) : false;
    }
  }
}

function emitUsed(
  w: World,
  u: Unit,
  run: SkillRun,
  x1: number,
  y1: number,
  impactAt: number,
  dur: number,
  radius: number,
  path: number[] | null = null,
  lead = 0,
): void {
  w.events.push('skillUsed', {
    unitId: u.id,
    unit: u.type,
    skill: u.def.ability!.id,
    x0: u.x,
    y0: u.y,
    x1,
    y1,
    path,
    impactAt,
    lead,
    dur,
    radius,
    seed: run.id,
  });
}

// ── Ram ───────────────────────────────────────────────────────────────────────────────

const buf = new Int32Array(1024);

/** Protesters on the ground (not climbing / on a roof). */
function onGround(w: World, s: number): boolean {
  const st = w.crowd.state[s]!;
  return st !== PS.ON_ROOF && st !== PS.CLIMBING && st !== PS.CLIMB_DOWN;
}

/** How far (tiles, ≤ len) the horse can gallop from (x, y) along (ux, uy) on driveable road. */
export function laneLength(
  w: World,
  x: number,
  y: number,
  ux: number,
  uy: number,
  len: number,
): number {
  const step = 0.25;
  let d = 0;
  while (d + step <= len + 1e-6) {
    const t = w.nav.tileAt(x + ux * (d + step), y + uy * (d + step));
    if (t < 0 || !w.nav.driveable(t)) break;
    d += step;
  }
  return d;
}

/** Ground protesters in the lane from (x, y) along (ux, uy), `len` long, `half` wide. */
function laneCount(
  w: World,
  x: number,
  y: number,
  ux: number,
  uy: number,
  len: number,
  half: number,
): number {
  const c = w.crowd;
  const n = w.hash.query(c, x + ux * len * 0.5, y + uy * len * 0.5, len * 0.5 + half, buf);
  let m = 0;
  for (let k = 0; k < n; k++) {
    const s = buf[k]!;
    if (!onGround(w, s)) continue;
    const dx = c.x[s]! - x;
    const dy = c.y[s]! - y;
    const t = dx * ux + dy * uy;
    if (t < 0 || t > len) continue;
    if (Math.abs(dx * uy - dy * ux) <= half) m++;
  }
  return m;
}

/** Ram heading: the straight lane (16 headings) through the most protesters within reach. */
export function bestRamLane(
  w: World,
  u: Unit,
  ab: RamAbility,
): { ux: number; uy: number; len: number; count: number } {
  let best = { ux: 1, uy: 0, len: 0, count: 0 };
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const len = laneLength(w, u.x, u.y, ux, uy, ab.length);
    if (len < 1) continue;
    const count = laneCount(w, u.x, u.y, ux, uy, len, ab.halfWidth);
    if (count > best.count || (count === best.count && count > 0 && len > best.len))
      best = { ux, uy, len, count };
  }
  return best;
}

function startRam(w: World, u: Unit, ab: RamAbility, min: number): boolean {
  if (u.building >= 0) return false;
  const lane = bestRamLane(w, u, ab);
  if (lane.count < min) return false;
  spend(w, u);
  leaveTile(w, u);
  validateHolders(w, u, true);
  u.path = [];
  u.pathIdx = 0;
  u.skillLock = true;
  u.moving = true;
  u.state = US.MOVING;
  const x1 = u.x + lane.ux * lane.len;
  const y1 = u.y + lane.uy * lane.len;
  aimAt(u, x1, y1);
  u.dir8 = dir8Fast(lane.ux, lane.uy);
  const run: RamRun = {
    kind: 'ram',
    id: w.skills.nextId++,
    unitId: u.id,
    t: 0,
    ab,
    x0: u.x,
    y0: u.y,
    x1,
    y1,
    dur: lane.len / ab.speed,
    hit: [],
  };
  w.skills.active.push(run);
  emitUsed(w, u, run, x1, y1, ab.windup, ab.windup + run.dur, ab.halfWidth);
  return true;
}

/** Gallop step: move along the lane and bowl over everyone the horse reaches. */
function updateRam(w: World, r: RamRun, u: Unit): boolean {
  const ab = r.ab;
  if (r.t < ab.windup) {
    u.state = US.IDLE;
    return false;
  }
  const f = Math.min(1, (r.t - ab.windup) / Math.max(1e-3, r.dur));
  u.x = r.x0 + (r.x1 - r.x0) * f;
  u.y = r.y0 + (r.y1 - r.y0) * f;
  u.moving = true;
  u.state = US.MOVING;
  const c = w.crowd;
  const dx = r.x1 - r.x0;
  const dy = r.y1 - r.y0;
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const n = w.hash.query(c, u.x, u.y, u.def.radius + ab.halfWidth, buf);
  for (let k = 0; k < n; k++) {
    const s = buf[k]!;
    if (!onGround(w, s)) continue;
    const h = c.handle(s);
    if (r.hit.includes(h)) continue;
    r.hit.push(h);
    const px = c.x[s]!;
    const py = c.y[s]!;
    // Bowled aside, away from the horse's path.
    const side = (px - u.x) * -uy + (py - u.y) * ux >= 0 ? 1 : -1;
    const died = strike(w, s, ab.damage, DMG.melee, false, u.id);
    if (!died) {
      c.stun[s] = Math.max(c.stun[s]!, ab.stun);
      c.vx[s] = (-uy * side + ux * 0.5) * ab.impulse;
      c.vy[s] = (ux * side + uy * 0.5) * ab.impulse;
    }
    w.events.push('skillHit', {
      unitId: u.id,
      skill: 'ram',
      x: px,
      y: py,
      radius: 0,
      index: r.hit.length - 1,
      kills: died ? 1 : 0,
    });
  }
  if (f < 1) return false;
  u.skillLock = false;
  u.moving = false;
  arrive(w, u);
  if (u.pathIdx < u.path.length) u.moving = true;
  return true;
}

// ── Rapid fire ────────────────────────────────────────────────────────────────────────

function startRapid(w: World, u: Unit, ab: RapidFireAbility): boolean {
  const t = findTarget(w, u.x, u.y, ab.range, false, u.building);
  if (t < 0) return false;
  spend(w, u);
  u.skillLock = true;
  const run: RapidRun = { kind: 'rapid', id: w.skills.nextId++, unitId: u.id, t: 0, ab, shot: 0 };
  w.skills.active.push(run);
  const c = w.crowd;
  emitUsed(w, u, run, c.x[t]!, c.y[t]!, 0, ab.shots * ab.interval, 0);
  return true;
}

/** One piercing shot at the nearest target (like the pistol). False when nobody is in range. */
function rapidShot(w: World, u: Unit, ab: RapidFireAbility, index: number): boolean {
  const c = w.crowd;
  const t = findTarget(w, u.x, u.y, ab.range, false, u.building);
  if (t < 0) return false;
  const dx = c.x[t]! - u.x;
  const dy = c.y[t]! - u.y;
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  aimAt(u, c.x[t]!, c.y[t]!);
  let n = lineHits(w, u.x, u.y, ux, uy, ab.range, ab.pierceWidth, ab.pierce);
  if (n === 0) {
    pierceS[0] = t;
    pierceT[0] = l;
    n = 1;
  }
  const far = pierceT[n - 1]!;
  w.events.push('skillShot', {
    unitId: u.id,
    x0: u.x,
    y0: u.y,
    x1: u.x + ux * far,
    y1: u.y + uy * far,
    hits: n,
    index,
  });
  // pierceS is not touched by hurtProtester (no nested line queries).
  for (let k = 0; k < n; k++) strike(w, pierceS[k]!, ab.damage, DMG.bullet, true, u.id);
  u.lastAttack = w.time;
  u.state = US.ATTACKING;
  return true;
}

function updateRapid(w: World, r: RapidRun, u: Unit): boolean {
  const ab = r.ab;
  while (r.shot < ab.shots && r.t >= r.shot * ab.interval) {
    if (!rapidShot(w, u, ab, r.shot)) r.shot = ab.shots;
    else r.shot++;
  }
  if (r.shot < ab.shots) return false;
  u.skillLock = false;
  return true;
}

// ── Frag grenade & missile ────────────────────────────────────────────────────────────

/** Frag flight time: the recipe's arc (0.35 s + 0.07 s per tile) plus the fuse. */
export function fragTime(dist: number, ab: FragAbility): number {
  return 0.35 + dist * 0.07 + ab.fuse;
}

/** Missile flight time (recipe: 0.45 s + 0.045 s per tile, launched 0.02 s in). */
export function missileTime(dist: number): number {
  return 0.45 + dist * 0.045 + 0.02;
}

function throwFrag(w: World, u: Unit, ab: FragAbility, min: number): boolean {
  if (!findDensest(w, u.x, u.y, ab.range) || densest.count < min) return false;
  const x = densest.x;
  const y = densest.y;
  const at = fragTime(Math.hypot(x - u.x, y - u.y), ab);
  return startBlast(w, u, 'fragGrenade', x, y, at, ab.radius, ab.damage);
}

function fireMissile(w: World, u: Unit, ab: MissileAbility, x: number, y: number): boolean {
  const d = Math.hypot(x - u.x, y - u.y);
  if (d > ab.range + 0.25 || !w.nav.inBounds(Math.floor(x), Math.floor(y))) return false;
  return startBlast(w, u, 'missile', x, y, missileTime(d), ab.radius, ab.damage);
}

function startBlast(
  w: World,
  u: Unit,
  skill: BlastRun['skill'],
  x: number,
  y: number,
  at: number,
  radius: number,
  damage: number,
): boolean {
  spend(w, u);
  aimAt(u, x, y);
  u.lastAttack = w.time;
  const run: BlastRun = {
    kind: 'blast',
    id: w.skills.nextId++,
    unitId: u.id,
    t: 0,
    skill,
    at,
    x,
    y,
    radius,
    damage,
  };
  w.skills.active.push(run);
  emitUsed(w, u, run, x, y, at, at, radius);
  return true;
}

/** Kill (lethal blast damage) every ground protester within `r` of (x, y). Returns the kills. */
function killZone(w: World, x: number, y: number, r: number, damage: number, by: number): number {
  const c = w.crowd;
  const n = w.hash.query(c, x, y, r, buf);
  let kills = 0;
  for (let k = 0; k < n; k++) {
    const s = buf[k]!;
    const st = c.state[s]!;
    if (st === PS.ON_ROOF || st === PS.CLIMBING) continue;
    if (strike(w, s, damage, DMG.explosion, true, by)) kills++;
  }
  return kills;
}

function updateBlast(w: World, r: BlastRun): boolean {
  if (r.t < r.at) return false;
  const kills = killZone(w, r.x, r.y, r.radius, r.damage, r.unitId);
  w.events.push('skillHit', {
    unitId: r.unitId,
    skill: r.skill,
    x: r.x,
    y: r.y,
    radius: r.radius,
    index: 0,
    kills,
  });
  return true;
}

// ── Air strike ────────────────────────────────────────────────────────────────────────

/**
 * Clean a painted line (flat tile coords): clamp into the map, drop repeated points, cut it at
 * `maxLength`. Returns null when it is shorter than `minLength`.
 */
export function strikePath(
  w: World,
  path: readonly number[],
  ab: AirStrikeAbility,
): { pts: number[]; cum: number[]; total: number } | null {
  const pts: number[] = [];
  const cum: number[] = [];
  let total = 0;
  const mw = w.map.w;
  const mh = w.map.h;
  for (let k = 0; k + 1 < path.length; k += 2) {
    const x = Math.min(mw - 0.01, Math.max(0.01, path[k]!));
    const y = Math.min(mh - 0.01, Math.max(0.01, path[k + 1]!));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (pts.length === 0) {
      pts.push(x, y);
      cum.push(0);
      continue;
    }
    const px = pts[pts.length - 2]!;
    const py = pts[pts.length - 1]!;
    const d = Math.hypot(x - px, y - py);
    if (d < 1e-3) continue;
    if (total + d >= ab.maxLength) {
      const f = (ab.maxLength - total) / d;
      pts.push(px + (x - px) * f, py + (y - py) * f);
      total = ab.maxLength;
      cum.push(total);
      break;
    }
    total += d;
    pts.push(x, y);
    cum.push(total);
  }
  return total >= ab.minLength ? { pts, cum, total } : null;
}

/** Point at arc length `s` along the line (extended straight past both ends). */
function pathAt(
  pts: readonly number[],
  cum: readonly number[],
  s: number,
  out: { x: number; y: number },
): void {
  const last = cum.length - 1;
  let k = 0;
  if (s <= 0) k = 0;
  else if (s >= cum[last]!) k = last - 1;
  else while (k < last - 1 && cum[k + 1]! < s) k++;
  const ax = pts[k * 2]!;
  const ay = pts[k * 2 + 1]!;
  const bx = pts[k * 2 + 2]!;
  const by = pts[k * 2 + 3]!;
  const len = cum[k + 1]! - cum[k]! || 1;
  const f = (s - cum[k]!) / len;
  out.x = ax + (bx - ax) * f;
  out.y = ay + (by - ay) * f;
}

/** Distance from (x, y) to the line between arc lengths s0 and s1. */
function distToSection(
  pts: readonly number[],
  cum: readonly number[],
  s0: number,
  s1: number,
  x: number,
  y: number,
): number {
  let best = Infinity;
  for (let k = 0; k + 1 < cum.length; k++) {
    const a = Math.max(s0, cum[k]!);
    const b = Math.min(s1, cum[k + 1]!);
    if (b < a) continue;
    const len = cum[k + 1]! - cum[k]! || 1;
    const ax = pts[k * 2]!;
    const ay = pts[k * 2 + 1]!;
    const ex = pts[k * 2 + 2]! - ax;
    const ey = pts[k * 2 + 3]! - ay;
    const fa = (a - cum[k]!) / len;
    const fb = (b - cum[k]!) / len;
    // Project onto the segment, clamped to [fa, fb].
    let f = ((x - ax) * ex + (y - ay) * ey) / (len * len);
    f = Math.min(fb, Math.max(fa, f));
    best = Math.min(best, Math.hypot(ax + ex * f - x, ay + ey * f - y));
  }
  return best;
}

/** Impact count for a line `total` tiles long (the recipe's: one every `spacing` tiles). */
export function strikeImpacts(total: number, ab: AirStrikeAbility): number {
  return Math.max(2, Math.round(total / ab.spacing) + 1);
}

const tmpP = { x: 0, y: 0 };

function startStrike(w: World, u: Unit, ab: AirStrikeAbility, path: readonly number[]): boolean {
  const line = strikePath(w, path, ab);
  if (!line) return false;
  const { pts, cum, total } = line;
  const n = strikeImpacts(total, ab);
  const speed = total / Math.max(0.2, (n - 1) * ab.cadence);
  // Run-in point 3 tiles before the start; the heli dives to it, then strafes the line.
  pathAt(pts, cum, -3, tmpP);
  const approach = Math.hypot(tmpP.x - u.x, tmpP.y - u.y) / ab.diveSpeed;
  const lead = Math.max(ab.lead, approach + 0.22 + 1.4 / speed);
  const tAt = (s: number): number => lead - 0.22 + (s + 1.6) / speed;
  spend(w, u);
  u.skillLock = true;
  u.path = [];
  u.pathIdx = 0;
  u.moving = true;
  u.state = US.MOVING;
  const run: StrikeRun = {
    kind: 'strike',
    id: w.skills.nextId++,
    unitId: u.id,
    t: 0,
    ab,
    pts,
    cum,
    total,
    n,
    k: 0,
    lead,
    speed,
    hx: u.x,
    hy: u.y,
    tEntry: tAt(-3),
    tEnd: tAt(total + 4),
  };
  w.skills.active.push(run);
  const ex = pts[pts.length - 2]!;
  const ey = pts[pts.length - 1]!;
  emitUsed(w, u, run, ex, ey, lead, run.tEnd, ab.width, pts.slice(), lead);
  return true;
}

function updateStrike(w: World, r: StrikeRun, u: Unit | undefined): boolean {
  const ab = r.ab;
  // The helicopter flies the run (dive to the run-in point, strafe the line, pull out).
  if (u) {
    const ox = u.x;
    const oy = u.y;
    if (r.t < r.tEntry) {
      pathAt(r.pts, r.cum, -3, tmpP);
      const f = r.t / Math.max(1e-3, r.tEntry);
      u.x = r.hx + (tmpP.x - r.hx) * f;
      u.y = r.hy + (tmpP.y - r.hy) * f;
    } else {
      const s = Math.min(r.total + 4, (r.t - (r.lead - 0.22)) * r.speed - 1.6);
      pathAt(r.pts, r.cum, s, tmpP);
      u.x = tmpP.x;
      u.y = tmpP.y;
    }
    u.x = Math.min(w.map.w - 0.5, Math.max(0.5, u.x));
    u.y = Math.min(w.map.h - 0.5, Math.max(0.5, u.y));
    const dx = u.x - ox;
    const dy = u.y - oy;
    if (dx * dx + dy * dy > 1e-8) {
      u.dir8 = dir8Fast(dx, dy);
      u.aim8 = u.dir8;
      u.facing = facing4(dx, dy);
    }
    u.moving = true;
    u.state = US.MOVING;
  }
  // Impacts walk along the line on the recipe's timings.
  while (r.k < r.n && r.t >= r.lead + r.k * ab.cadence) {
    const s1 = (r.k / (r.n - 1)) * r.total;
    const s0 = r.k === 0 ? 0 : ((r.k - 1) / (r.n - 1)) * r.total;
    pathAt(r.pts, r.cum, (s0 + s1) / 2, tmpP);
    const c = w.crowd;
    const q = w.hash.query(c, tmpP.x, tmpP.y, (s1 - s0) / 2 + ab.width, buf);
    let kills = 0;
    for (let k = 0; k < q; k++) {
      const s = buf[k]!;
      const st = c.state[s]!;
      if (st === PS.ON_ROOF || st === PS.CLIMBING) continue;
      if (distToSection(r.pts, r.cum, s0, s1, c.x[s]!, c.y[s]!) > ab.width) continue;
      if (strike(w, s, ab.damage, DMG.explosion, true, r.unitId)) kills++;
    }
    pathAt(r.pts, r.cum, s1, tmpP);
    w.events.push('skillHit', {
      unitId: r.unitId,
      skill: 'airStrike',
      x: tmpP.x,
      y: tmpP.y,
      radius: ab.width,
      index: r.k,
      kills,
    });
    r.k++;
  }
  if (r.k < r.n || r.t < r.tEnd) return false;
  if (u) {
    u.skillLock = false;
    settle(w, u);
  }
  return true;
}

/**
 * Bots: a 10-tile line through the densest crowd near the helicopter (the heading, of 8, that
 * crosses the most protesters within the corridor). Null when nothing is worth it.
 */
function botStrikeLine(w: World, u: Unit, ab: AirStrikeAbility, min: number): number[] | null {
  if (!findDensest(w, u.x, u.y, 30)) return null;
  const cx = densest.x;
  const cy = densest.y;
  const half = Math.min(5, ab.maxLength / 2 - 0.1);
  let best: number[] | null = null;
  let bestN = min - 1;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const n = laneCount(w, cx - ux * half, cy - uy * half, ux, uy, half * 2, ab.width);
    if (n > bestN) {
      bestN = n;
      best = [cx - ux * half, cy - uy * half, cx + ux * half, cy + uy * half];
    }
  }
  return best;
}

// ── Step ──────────────────────────────────────────────────────────────────────────────

/** Advance every skill run (call once per step, after the units). */
export function updateSkills(w: World, dt: number): void {
  const list = w.skills.active;
  if (list.length === 0) return;
  let keep = 0;
  for (let k = 0; k < list.length; k++) {
    const r = list[k]!;
    r.t += dt;
    const u = w.units.get(r.unitId);
    let done: boolean;
    switch (r.kind) {
      case 'ram':
        done = !u || updateRam(w, r, u);
        break;
      case 'rapid':
        done = !u || updateRapid(w, r, u);
        break;
      case 'blast':
        done = updateBlast(w, r);
        break;
      case 'strike':
        done = updateStrike(w, r, u);
        break;
    }
    if (done) {
      if (u && r.kind !== 'blast') {
        u.skillLock = false;
        w.events.push('skillEnded', { unitId: u.id, skill: u.def.ability!.id });
      }
    } else list[keep++] = r;
  }
  list.length = keep;
}
