/**
 * Protester storage: struct-of-arrays typed arrays with a free-list.
 *
 * Slots are reused; each (re)allocation bumps `gen[slot]`, so a **handle**
 * (`slot | gen << 16`) uniquely identifies one protester's life. `uid` is a monotonically
 * increasing id (never reused) — the view may key sprites by either.
 *
 * Positions are continuous tile coordinates (u = x, v = y). `px/py` hold the previous step
 * for render interpolation.
 */

/** Protester state machine (see steering.ts). */
export const PS = {
  /** Just left a door, milling around it. */
  SPAWNING: 0,
  /** Following the flow field toward the Capitol. */
  MARCH: 1,
  /** Held in a unit's melee slot (or pressing a blockade). */
  ENGAGED: 2,
  /** On/near the Capitol steps, attacking it. */
  CAPITOL: 3,
  /** Walking to a facade climb point. */
  TO_CLIMB: 4,
  /** Climbing a facade (stT = remaining s). */
  CLIMBING: 5,
  /** Fighting on a roof. */
  ON_ROOF: 6,
  /** Climbing back down. */
  CLIMB_DOWN: 7,
  /** Paparazzi flocking around Breta. */
  FOLLOW: 8,
  /** Walking to the district's rally point (M7). */
  RALLY: 9,
  /** Gathering at the rally point (chanting) before the march. */
  GATHER: 10,
} as const;
export type ProtesterState = (typeof PS)[keyof typeof PS];

/** Animation hints for the view (derived each tick). */
export const PANIM = {
  IDLE: 0,
  WALK: 1,
  RUN: 2,
  ATTACK: 3,
  SHOOT: 4,
  THROW: 5,
  CLIMB: 6,
  ROOF: 7,
  STUNNED: 8,
  /** Attacking the Capitol (fist pumping / smashing). */
  RIOT: 9,
  /** Choking in gas (still moving). */
  COUGH: 10,
} as const;
export type ProtesterAnim = (typeof PANIM)[keyof typeof PANIM];

/** Facings, same order as `core/iso.Facing`. */
export const FACINGS = ['se', 'sw', 'ne', 'nw'] as const;

export class Crowd {
  readonly capacity: number;
  /** One past the highest slot that may be alive (loop bound). */
  hi = 0;
  /** Alive protesters. */
  count = 0;
  private nextUid = 1;
  private readonly free: Int32Array;
  private freeTop = 0;

  readonly alive: Uint8Array;
  readonly gen: Uint16Array;
  readonly uid: Uint32Array;
  readonly type: Uint8Array;
  readonly loadout: Uint8Array;
  /** Paper-doll seed (look, gait phase, sign…). */
  readonly variant: Uint32Array;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly px: Float32Array;
  readonly py: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly hp: Float32Array;
  readonly maxHp: Float32Array;
  readonly state: Uint8Array;
  readonly anim: Uint8Array;
  readonly facing: Uint8Array;
  /** Walk speed (tiles/s) incl. gait variation. */
  readonly speed: Float32Array;
  /** Lateral lane bias in [-1, 1]. */
  readonly lane: Float32Array;
  /** Primary attack cooldown (s). */
  readonly cd: Float32Array;
  /** Special cooldown (molotov/bazooka/flash). */
  readonly cd2: Float32Array;
  /** Action lock (s): shooting/throwing pose, no movement. */
  readonly actT: Float32Array;
  /** Sim time of the last attack impact/shot (view: sync the impact frame). */
  readonly lastAtk: Float32Array;
  readonly stun: Float32Array;
  /** Gas choking status (s remaining; DoT while > 0). */
  readonly gasT: Float32Array;
  /** Burning status (s remaining; DoT while > 0). */
  readonly burnT: Float32Array;
  /** Unit pool slot holding this protester in melee (or blockade being pressed), -1. */
  readonly engUnit: Int16Array;
  /** Ranged target unit slot + generation. */
  readonly tgtUnit: Int16Array;
  readonly tgtGen: Uint16Array;
  /** Building being climbed / occupied roof, -1. */
  readonly bld: Int16Array;
  /** State timer (mill/climb). */
  readonly stT: Float32Array;
  /** Climb target point. */
  readonly gx: Float32Array;
  readonly gy: Float32Array;
  /** Climb progress 0..1 (view: height on the facade = progress × storeys). */
  readonly climb: Float32Array;
  /** Spawn district index (rally point), -1. */
  readonly district: Int8Array;

  constructor(capacity: number) {
    this.capacity = capacity;
    if (capacity > 65536) throw new Error('Crowd capacity must be ≤ 65536 (16-bit slots)');
    const n = capacity;
    this.free = new Int32Array(n);
    this.alive = new Uint8Array(n);
    this.gen = new Uint16Array(n);
    this.uid = new Uint32Array(n);
    this.type = new Uint8Array(n);
    this.loadout = new Uint8Array(n);
    this.variant = new Uint32Array(n);
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.hp = new Float32Array(n);
    this.maxHp = new Float32Array(n);
    this.state = new Uint8Array(n);
    this.anim = new Uint8Array(n);
    this.facing = new Uint8Array(n);
    this.speed = new Float32Array(n);
    this.lane = new Float32Array(n);
    this.cd = new Float32Array(n);
    this.cd2 = new Float32Array(n);
    this.actT = new Float32Array(n);
    this.lastAtk = new Float32Array(n);
    this.stun = new Float32Array(n);
    this.gasT = new Float32Array(n);
    this.burnT = new Float32Array(n);
    this.engUnit = new Int16Array(n);
    this.tgtUnit = new Int16Array(n);
    this.tgtGen = new Uint16Array(n);
    this.bld = new Int16Array(n);
    this.stT = new Float32Array(n);
    this.gx = new Float32Array(n);
    this.gy = new Float32Array(n);
    this.climb = new Float32Array(n);
    this.district = new Int8Array(n);
    // Free list: lowest slots on top so the live range stays compact.
    for (let i = 0; i < n; i++) this.free[i] = n - 1 - i;
    this.freeTop = n;
  }

  get full(): boolean {
    return this.freeTop === 0;
  }

  /** Allocate a slot (fields reset); returns -1 when full. */
  alloc(): number {
    if (this.freeTop === 0) return -1;
    const s = this.free[--this.freeTop]!;
    this.alive[s] = 1;
    this.gen[s] = (this.gen[s]! + 1) & 0xffff;
    this.uid[s] = this.nextUid++;
    this.vx[s] = this.vy[s] = 0;
    this.cd[s] = this.cd2[s] = this.actT[s] = this.lastAtk[s] = 0;
    this.stun[s] = this.gasT[s] = this.burnT[s] = 0;
    this.engUnit[s] = -1;
    this.tgtUnit[s] = -1;
    this.tgtGen[s] = 0;
    this.bld[s] = -1;
    this.stT[s] = 0;
    this.climb[s] = 0;
    this.district[s] = -1;
    this.anim[s] = PANIM.IDLE;
    this.facing[s] = 0;
    this.loadout[s] = 0;
    if (s >= this.hi) this.hi = s + 1;
    this.count++;
    return s;
  }

  release(s: number): void {
    if (!this.alive[s]) return;
    this.alive[s] = 0;
    this.count--;
    this.free[this.freeTop++] = s;
    while (this.hi > 0 && !this.alive[this.hi - 1]) this.hi--;
  }

  /** Stable reference to the protester currently in `slot`. */
  handle(slot: number): number {
    return (slot | (this.gen[slot]! << 16)) >>> 0;
  }

  /** Slot of a still-alive handle, or -1. */
  resolve(handle: number): number {
    const s = handle & 0xffff;
    if (s >= this.capacity || !this.alive[s] || this.gen[s] !== handle >>> 16) return -1;
    return s;
  }

  /**
   * Keep the free list sorted (lowest slot reused first). Called rarely (wave ends) to keep
   * `hi` tight after big waves; deterministic.
   */
  compactFreeList(): void {
    let k = 0;
    for (let s = this.capacity - 1; s >= 0; s--) if (!this.alive[s]) this.free[k++] = s;
    this.freeTop = k;
  }
}
