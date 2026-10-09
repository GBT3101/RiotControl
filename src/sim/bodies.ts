/**
 * Bodies: sim-light SoA ring buffer. A body stays `ttl` seconds (trampling by crowds shortens
 * it); when the buffer is full the oldest body is recycled. The view keys sprites by `id`
 * (an id that vanishes from the live set = fade the body out).
 */
import { BALANCE } from '../data/balance';
import type { Rng } from '../core/rng';
import type { SpatialHash } from './spatialHash';

export const BODY_KIND = { PROTESTER: 0, UNIT: 1 } as const;

export class Bodies {
  readonly capacity: number;
  readonly id: Uint32Array;
  readonly alive: Uint8Array;
  readonly x: Float32Array;
  readonly y: Float32Array;
  /** 0 protester, 1 unit (`BODY_KIND`). */
  readonly kind: Uint8Array;
  /** Protester type index or unit type index. */
  readonly type: Uint8Array;
  readonly variant: Uint32Array;
  readonly lethal: Uint8Array;
  readonly facing: Uint8Array;
  readonly ttl: Float32Array;
  /** Times crowds walked over it (view: trample dust, squash frames). */
  readonly trample: Uint16Array;
  /** Damage type index of the killing blow. */
  readonly cause: Uint8Array;
  count = 0;
  private head = 0;
  private nextId = 1;

  constructor(capacity = BALANCE.maxBodies) {
    this.capacity = capacity;
    this.id = new Uint32Array(capacity);
    this.alive = new Uint8Array(capacity);
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.kind = new Uint8Array(capacity);
    this.type = new Uint8Array(capacity);
    this.variant = new Uint32Array(capacity);
    this.lethal = new Uint8Array(capacity);
    this.facing = new Uint8Array(capacity);
    this.ttl = new Float32Array(capacity);
    this.trample = new Uint16Array(capacity);
    this.cause = new Uint8Array(capacity);
  }

  /** Add a body; returns its id. Recycles the oldest slot when full. */
  add(
    rng: Rng,
    x: number,
    y: number,
    kind: number,
    type: number,
    variant: number,
    lethal: boolean,
    facing: number,
    cause: number,
  ): number {
    const k = this.head;
    this.head = (this.head + 1) % this.capacity;
    if (!this.alive[k]) this.count++;
    const id = this.nextId++;
    this.id[k] = id;
    this.alive[k] = 1;
    this.x[k] = x;
    this.y[k] = y;
    this.kind[k] = kind;
    this.type[k] = type;
    this.variant[k] = variant;
    this.lethal[k] = lethal ? 1 : 0;
    this.facing[k] = facing;
    const [lo, hi] = BALANCE.bodyTtl;
    this.ttl[k] = kind === BODY_KIND.UNIT ? hi : rng.range(lo, hi);
    this.trample[k] = 0;
    this.cause[k] = cause;
    return id;
  }

  update(dt: number, tick: number, hash: SpatialHash): void {
    const checkTrample = tick % BALANCE.trampleCheckTicks === 0;
    const cost = BALANCE.trampleTtlCost;
    for (let k = 0; k < this.capacity; k++) {
      if (!this.alive[k]) continue;
      let ttl = this.ttl[k]! - dt;
      if (checkTrample) {
        const n = hash.cellCount(this.x[k]! | 0, this.y[k]! | 0);
        if (n > 0) {
          this.trample[k] = Math.min(65535, this.trample[k]! + n);
          ttl -= cost * Math.min(n, 6);
        }
      }
      if (ttl <= 0) {
        this.alive[k] = 0;
        this.count--;
      } else this.ttl[k] = ttl;
    }
  }
}
