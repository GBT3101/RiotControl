/**
 * Ministry units (incl. blockades and vehicles): a compact object pool. Units are few
 * (tens to a few hundred), so they are plain objects; `UnitPool.active` is a dense list of the
 * living ones (rebuilt only when units are added/removed). Each unit has a stable `id` (never
 * reused, for the view) and a pool `slot` + `gen` (for cheap references from the crowd SoA).
 */
import { armourTable } from '../data/damage';
import { UNITS, type UnitDef, type UnitId } from '../data/units';

/** Unit state hints for the view/UI. */
export const US = {
  IDLE: 0,
  MOVING: 1,
  ATTACKING: 2,
  STUNNED: 3,
  DEAD: 4,
} as const;
export type UnitState = (typeof US)[keyof typeof US];

export class Unit {
  slot = -1;
  gen = 0;
  /** Stable id (never reused). */
  id = 0;
  alive = false;
  type: UnitId = 'riot';
  def: UnitDef = UNITS.riot;
  /** Damage multipliers per DamageId (from def.armour). */
  armour: Float32Array = armourTable(undefined);
  /** Position (continuous tiles); rooftop units sit on the footprint centre. */
  x = 0;
  y = 0;
  px = 0;
  py = 0;
  /** Elevation in storeys (rooftop units: building storeys; helicopter: flight height). */
  z = 0;
  hp = 0;
  maxHp = 0;
  /** Squad members alive (Sniper Brigade: 3). `hp` is the current member's HP. */
  members = 1;
  state: UnitState = US.IDLE;
  /** 0..3 = se, sw, ne, nw (humans). */
  facing = 0;
  /** 8-way body direction for vehicles: 0=E(screen right),1=SE,2=S,3=SW,4=W,5=NW,6=N,7=NE. */
  dir8 = 1;
  /** 8-way turret/aim direction (tank, humvee, helicopter gunner). */
  aim8 = 1;
  /** Attack cooldown (s). */
  cd = 0;
  burstLeft = 0;
  burstT = 0;
  /** Current target protester handle (-1). */
  target = -1;
  retargetT = 0;
  /** Melee slot holders (protester handles; -1 = free). */
  holders: Int32Array = new Int32Array(0);
  nHolders = 0;
  /** Commandable movement. */
  path: number[] = [];
  pathIdx = 0;
  destI = -1;
  destJ = -1;
  /** Rooftop: building index, -1. */
  building = -1;
  /** Home tile (stationary ground units) — tile index; -1 while moving / not on the ground. */
  tile = -1;
  /** Blockade tiles (tile indices). */
  tiles: number[] = [];
  /** Ability charge (s accumulated) and readiness. */
  charge = 0;
  abilityReady = false;
  /** Status effects (s remaining). */
  stun = 0;
  blind = 0;
  burnT = 0;
  burnDps = 0;
  /** Sim time of the last attack impact / shot (view: sync attack frames, muzzle flashes). */
  lastAttack = -1;
  /** Sim time of the last damage taken (view: hit flash). */
  lastHurt = -1;
  /** Protesters fighting this unit on its roof (rooftop units). */
  roofAttackers = 0;
  kills = 0;
  /** Gas cone aim (unit vector) — view draws the spray while `state === ATTACKING`. */
  aimX = 1;
  aimY = 0;
  /** Recently moved (tank crush). */
  moving = false;
  /** Damage-state bucket for the view (blockade: 0 pristine, 1 dented, 2 wrecked). */
  get damageState(): number {
    const f = this.hp / this.maxHp;
    return f > 0.66 ? 0 : f > 0.33 ? 1 : 2;
  }
}

export class UnitPool {
  readonly items: Unit[] = [];
  /** Living units in deploy order. */
  active: Unit[] = [];
  private readonly free: number[] = [];
  private nextId = 1;
  private readonly byId = new Map<number, Unit>();

  alloc(type: UnitId): Unit {
    let u: Unit;
    const slot = this.free.length > 0 ? this.free.pop()! : -1;
    if (slot >= 0) {
      u = this.items[slot]!;
    } else {
      u = new Unit();
      u.slot = this.items.length;
      this.items.push(u);
      if (this.items.length > 32767) throw new Error('UnitPool: too many units');
    }
    const def = UNITS[type];
    u.gen = (u.gen + 1) & 0xffff;
    u.id = this.nextId++;
    u.alive = true;
    u.type = type;
    u.def = def;
    u.armour = armourTable(def.armour);
    u.members = def.squad;
    u.hp = u.maxHp = def.hp;
    u.state = US.IDLE;
    u.cd = 0;
    u.burstLeft = 0;
    u.burstT = 0;
    u.target = -1;
    u.retargetT = 0;
    if (u.holders.length !== def.meleeSlots) u.holders = new Int32Array(def.meleeSlots);
    u.holders.fill(-1);
    u.nHolders = 0;
    u.path = [];
    u.pathIdx = 0;
    u.destI = u.destJ = -1;
    u.building = -1;
    u.tile = -1;
    u.tiles = [];
    u.charge = 0;
    u.abilityReady = false;
    u.stun = u.blind = u.burnT = u.burnDps = 0;
    u.lastAttack = -1;
    u.lastHurt = -1;
    u.roofAttackers = 0;
    u.kills = 0;
    u.z = 0;
    u.moving = false;
    u.facing = 0;
    u.dir8 = 1;
    u.aim8 = 1;
    this.byId.set(u.id, u);
    this.active.push(u);
    return u;
  }

  release(u: Unit): void {
    if (!u.alive) return;
    u.alive = false;
    u.state = US.DEAD;
    this.byId.delete(u.id);
    this.free.push(u.slot);
    // Keep deterministic order (deploy order); rare event, allocation acceptable.
    this.active = this.active.filter((a) => a !== u);
  }

  get(id: number): Unit | undefined {
    return this.byId.get(id);
  }

  /** Living unit at pool slot with matching generation (or undefined). */
  at(slot: number, gen?: number): Unit | undefined {
    const u = this.items[slot];
    if (!u || !u.alive) return undefined;
    if (gen !== undefined && u.gen !== gen) return undefined;
    return u;
  }

  get count(): number {
    return this.active.length;
  }
}

/** 8-way direction index from a tile-space delta (screen-space octants). */
export function dir8FromDelta(du: number, dv: number): number {
  // Screen: x ∝ du − dv, y ∝ (du + dv) / 2.
  const sx = du - dv;
  const sy = (du + dv) * 0.5;
  if (sx === 0 && sy === 0) return 2;
  const a = Math.atan2(sy, sx); // 0 = E, +π/2 = S
  let o = Math.round(a / (Math.PI / 4));
  if (o < 0) o += 8;
  // atan2 octant order: 0 E, 1 SE, 2 S, 3 SW, 4 W, -3→5 NW, -2→6 N, -1→7 NE
  return o % 8;
}

/** 4-way facing (0 se, 1 sw, 2 ne, 3 nw) from a tile-space delta. */
export function facing4(du: number, dv: number): number {
  const sx = du - dv;
  const sy = du + dv;
  if (sy >= 0) return sx >= 0 ? 0 : 1;
  return sx >= 0 ? 2 : 3;
}
