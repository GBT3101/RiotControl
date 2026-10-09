/**
 * The simulation world: deterministic fixed-step (30 Hz) state built from a MapData + seed.
 * Headless (no DOM/Pixi). The view reads state + drains `events`; the UI calls the command API
 * (`deploy`, `command`, `useAbility`, `startWaves`, `callNextWaveEarly`). Pause/speed are the
 * loop's business (`core/loop.FixedStepLoop` calls `step()`).
 *
 * Step order: prev positions → director (spawns) → flow field (throttled) → spatial hash +
 * unit grid → roof guards → units → crowd → projectiles → areas → bodies → Capitol.
 */
import { BALANCE, type QualityTier } from '../data/balance';
import { WIN_LEGITIMACY } from '../data/levels';
import type { UnitId } from '../data/units';
import type { MapData } from '../maps/contract';
import { Rng, type Seed } from '../core/rng';
import { Areas } from './areas';
import { UNIT_BEHAVIOURS, commandUnit, useGasGrenade } from './behaviours/unit';
import { Bodies } from './bodies';
import { Capitol } from './capitol';
import { hurtUnit } from './combat';
import { Crowd } from './crowd';
import { Director } from './director';
import { Economy } from './economy';
import { EventBuffer } from './events';
import { hashWorld } from './hash';
import { Nav } from './nav';
import { checkDeploy, deployUnit, type DeployCheck } from './placement';
import { Projectiles } from './projectiles';
import { buildRallyField, type RallyField } from './rally';
import { SpatialHash } from './spatialHash';
import { spawnProtester, type SpawnOpts } from './spawn';
import { createStats, type StatsLedger } from './stats';
import { updateCrowd } from './steering';
import { UnitPool, type Unit } from './units';
import { DMG } from '../data/damage';
import { protesterResistTable } from '../data/protesters';

export type GamePhase = 'playing' | 'victory' | 'defeat';

export interface WorldOptions {
  seed?: Seed;
  /** Concurrency cap tier (default 'desktop'). */
  quality?: QualityTier;
  /** Crowd storage (default BALANCE.crowdCapacity = 4096). */
  crowdCapacity?: number;
}

export class World {
  readonly map: MapData;
  readonly rng: Rng;
  readonly quality: QualityTier;
  /** Fixed step (s). */
  readonly dt = 1 / BALANCE.hz;
  tick = 0;
  /** Simulated seconds. */
  time = 0;
  phase: GamePhase = 'playing';

  readonly crowd: Crowd;
  readonly hash: SpatialHash;
  readonly nav: Nav;
  readonly units = new UnitPool();
  readonly bodies = new Bodies();
  readonly projectiles = new Projectiles();
  readonly areas = new Areas();
  readonly economy = new Economy();
  readonly capitol = new Capitol();
  readonly director: Director;
  readonly events = new EventBuffer();
  readonly stats: StatsLedger = createStats();
  /** Protester damage multipliers (`type × DAMAGE_TYPES.length + DamageId`), from data. */
  readonly resist: Float32Array = protesterResistTable();

  /** Per tile: pool slot of the stationary ground unit standing on it, -1. */
  readonly unitTile: Int16Array;
  /** Per building: rooftop unit pool slot, -1. */
  readonly roofUnit: Int16Array;
  /** Per building: an alive ground melee unit guards it (no climbing). */
  readonly roofGuarded: Uint8Array;
  /** Per building: protesters heading to / on its facade or roof. */
  readonly roofClimbers: Int16Array;
  /** Buildings currently hosting a rooftop unit. */
  roofBuildings: number[] = [];
  private readonly climbPts: (Int32Array | null)[];
  /** Crowd slot of Breta, -1. */
  bretaSlot = -1;
  /** Lazily built rally fields per spawn district. */
  private readonly rallyFields: (RallyField | null)[];

  /** Ground-unit grid (counting sort per tick): units overlapping each tile. */
  ugStart: Int32Array;
  ugItems: Int32Array = new Int32Array(256);
  private readonly ugCursor: Int32Array;

  constructor(map: MapData, opts: WorldOptions = {}) {
    this.map = map;
    this.rng = new Rng(opts.seed ?? 1).fork('sim');
    this.quality = opts.quality ?? 'desktop';
    const cap = opts.crowdCapacity ?? BALANCE.crowdCapacity;
    this.crowd = new Crowd(cap);
    this.hash = new SpatialHash(map.w, map.h, cap);
    this.nav = new Nav(map);
    const tiles = map.w * map.h;
    this.unitTile = new Int16Array(tiles).fill(-1);
    this.ugStart = new Int32Array(tiles + 1);
    this.ugCursor = new Int32Array(tiles + 1);
    const nb = map.buildings.length;
    this.roofUnit = new Int16Array(nb).fill(-1);
    this.roofGuarded = new Uint8Array(nb);
    this.roofClimbers = new Int16Array(nb);
    this.climbPts = new Array<Int32Array | null>(nb).fill(null);
    this.rallyFields = map.spawns.map(() => null);
    this.director = new Director(this);
    this.hash.rebuild(this.crowd);
  }

  // ── Stepping ───────────────────────────────────────────────────────────────────────

  /** Advance exactly one fixed step. No-op once the run is over. */
  step(): void {
    if (this.phase !== 'playing') return;
    const dt = this.dt;
    this.tick++;
    this.time += dt;
    this.events.tick = this.tick;
    const c = this.crowd;
    c.px.set(c.x);
    c.py.set(c.y);
    for (const u of this.units.active) {
      u.px = u.x;
      u.py = u.y;
    }
    this.director.update(this, dt);
    this.nav.update(dt);
    this.hash.rebuild(c);
    this.buildUnitGrid();
    if (this.tick % 15 === 0) this.updateRoofGuards();
    this.updateUnits(dt);
    if (this.phase !== 'playing') return;
    updateCrowd(this, dt);
    this.projectiles.update(this, dt);
    this.areas.update(this, dt);
    this.bodies.update(dt, this.tick, this.hash);
    this.capitol.update(this, dt);
    if (c.count > this.stats.peakCrowd) this.stats.peakCrowd = c.count;
    this.stats.time = this.time;
  }

  /** Run `seconds` of simulated time (headless / tests). */
  run(seconds: number): void {
    const n = Math.round(seconds / this.dt);
    for (let k = 0; k < n && this.phase === 'playing'; k++) this.step();
  }

  private updateUnits(dt: number): void {
    const list = this.units.active;
    for (let k = 0; k < list.length; k++) {
      const u = list[k]!;
      if (!u.alive) continue;
      if (u.stun > 0) u.stun = Math.max(0, u.stun - dt);
      if (u.blind > 0) u.blind = Math.max(0, u.blind - dt);
      if (u.burnT > 0) {
        u.burnT -= dt;
        hurtUnit(this, u, u.burnDps * dt, DMG.fire, true, 'none', -1);
        if (u.burnT <= 0) u.burnDps = 0;
        if (!u.alive) continue;
      }
      UNIT_BEHAVIOURS[u.def.behaviour].update(this, u, dt);
      if (this.phase !== 'playing') return;
    }
  }

  private buildUnitGrid(): void {
    const mw = this.map.w;
    const mh = this.map.h;
    const start = this.ugStart;
    start.fill(0);
    const list = this.units.active;
    const margin = 0.3;
    let total = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 0; k < list.length; k++) {
        const u = list[k]!;
        if (!u.alive || u.building >= 0 || u.def.placement !== 'road' || u.type === 'blockade')
          continue;
        const R = u.def.radius + margin;
        const i0 = Math.max(0, Math.floor(u.x - R));
        const i1 = Math.min(mw - 1, Math.floor(u.x + R));
        const j0 = Math.max(0, Math.floor(u.y - R));
        const j1 = Math.min(mh - 1, Math.floor(u.y + R));
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            const t = j * mw + i;
            if (pass === 0) {
              start[t + 1]!++;
              total++;
            } else this.ugItems[this.ugCursor[t]!++] = u.slot;
          }
        }
      }
      if (pass === 0) {
        for (let t = 0; t < mw * mh; t++) start[t + 1]! += start[t]!;
        if (this.ugItems.length < total) this.ugItems = new Int32Array(total * 2);
        this.ugCursor.set(start);
      }
    }
  }

  private updateRoofGuards(): void {
    const R = BALANCE.guardRadius;
    for (const b of this.roofBuildings) {
      const B = this.map.buildings[b]!;
      let guarded = 0;
      for (const u of this.units.active) {
        if (!u.alive || !u.def.guardsRooftops || u.building >= 0) continue;
        const dx = Math.max(B.i - u.x, 0, u.x - (B.i + B.w));
        const dy = Math.max(B.j - u.y, 0, u.y - (B.j + B.d));
        if (dx * dx + dy * dy <= R * R) {
          guarded = 1;
          break;
        }
      }
      this.roofGuarded[b] = guarded;
    }
  }

  // ── Buildings / rooftops ───────────────────────────────────────────────────────────

  roofUnitAt(b: number): Unit | undefined {
    const slot = this.roofUnit[b]!;
    return slot >= 0 ? this.units.at(slot) : undefined;
  }

  refreshRoofList(): void {
    const out: number[] = [];
    for (let b = 0; b < this.roofUnit.length; b++) if (this.roofUnit[b]! >= 0) out.push(b);
    this.roofBuildings = out;
    this.updateRoofGuards();
  }

  /** Distance field toward district d's rally point (null if the district has none). */
  rallyField(d: number): RallyField | null {
    if (d < 0 || d >= this.rallyFields.length) return null;
    let f = this.rallyFields[d] ?? null;
    if (f === null) {
      const r = this.map.spawns[d]!.rally;
      const goal = this.nav.inBounds(r.i, r.j) ? r.j * this.map.w + r.i : -1;
      f = buildRallyField(this.nav, goal >= 0 && this.nav.walk[goal] ? goal : -1);
      this.rallyFields[d] = f;
    }
    return f.goal >= 0 ? f : null;
  }

  /** Walkable tiles 4-adjacent to building b's footprint (facade climb points). */
  climbPointsOf(b: number): Int32Array {
    let pts = this.climbPts[b];
    if (pts) return pts;
    const B = this.map.buildings[b]!;
    const list: number[] = [];
    const mw = this.map.w;
    const add = (i: number, j: number): void => {
      if (!this.nav.inBounds(i, j)) return;
      const t = j * mw + i;
      if (this.nav.walk[t]) list.push(t);
    };
    for (let i = B.i; i < B.i + B.w; i++) {
      add(i, B.j - 1);
      add(i, B.j + B.d);
    }
    for (let j = B.j; j < B.j + B.d; j++) {
      add(B.i - 1, j);
      add(B.i + B.w, j);
    }
    pts = Int32Array.from(list);
    this.climbPts[b] = pts;
    return pts;
  }

  // ── Public command API (UI / M9) ───────────────────────────────────────────────────

  /** Validate a deployment (ghost preview: `tiles`, `x/y`, `reason`). */
  canDeploy(unit: UnitId, i: number, j: number): DeployCheck {
    return checkDeploy(this, unit, i, j);
  }

  /** Deploy (spends Hate). Returns the new unit or null. */
  deploy(unit: UnitId, i: number, j: number): Unit | null {
    return deployUnit(this, unit, i, j);
  }

  /** Send a commandable unit (by id) to tile (i, j). Roads only (helicopter: anywhere). */
  command(unitId: number, i: number, j: number): boolean {
    if (this.phase !== 'playing') return false;
    const u = this.units.get(unitId);
    return u ? commandUnit(this, u, i, j) : false;
  }

  /** Throw a charged gas grenade at the densest crowd in range. */
  useAbility(unitId: number): boolean {
    if (this.phase !== 'playing') return false;
    const u = this.units.get(unitId);
    return u ? useGasGrenade(this, u) : false;
  }

  /** Desktop `G`: every charged unit throws. Returns how many threw. */
  useAllAbilities(): number {
    let n = 0;
    for (const u of [...this.units.active]) if (u.abilityReady && this.useAbility(u.id)) n++;
    return n;
  }

  /** "Let them come": leave the prep phase. */
  startWaves(): boolean {
    return this.phase === 'playing' && this.director.startWaves(this);
  }

  /** During a breather: next wave now, bonus Hate = seconds remaining / 2. Returns the bonus. */
  callNextWaveEarly(): number {
    return this.phase === 'playing' ? this.director.callNextWaveEarly(this) : 0;
  }

  /** Spawn a protester directly (tests, debug, scripted events). */
  spawnProtester(type: number, x: number, y: number, opts?: SpawnOpts): number {
    return spawnProtester(this, type, x, y, opts);
  }

  // ── Read helpers ───────────────────────────────────────────────────────────────────

  get hate(): number {
    return this.economy.hate;
  }
  get legit(): number {
    return this.economy.legit;
  }
  get level(): number {
    return this.economy.level;
  }
  /** Fraction of the way to victory. */
  get progress(): number {
    return Math.min(1, this.economy.legit / WIN_LEGITIMACY);
  }

  /** Refresh time-derived stats fields. */
  syncStats(): void {
    this.stats.time = this.time;
    this.stats.level = this.economy.level;
    this.stats.wave = this.director.wave;
    this.stats.capitolIntegrity = this.capitol.integrity;
  }

  /** 32-bit hash of the simulation state (determinism checks). */
  stateHash(): number {
    return hashWorld(this);
  }
}
