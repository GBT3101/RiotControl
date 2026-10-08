/**
 * Seeded, deterministic PRNG (sfc32, seeded through splitmix32).
 * Fast, 128-bit state, good statistical quality; identical output in browser and Node.
 */

/** Hash a string to a 32-bit seed (FNV-1a). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
}

export type Seed = number | string;

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: Seed = 1) {
    const sm = splitmix32(typeof seed === 'string' ? hashString(seed) : seed);
    this.a = sm();
    this.b = sm();
    this.c = sm();
    this.d = sm();
    // Warm up so that similar seeds diverge quickly.
    for (let i = 0; i < 12; i++) this.nextU32();
  }

  /** Raw 32-bit unsigned integer. */
  nextU32(): number {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) >>> 0;
    return t;
  }

  /** Float in [0, 1). */
  next(): number {
    return this.nextU32() / 4294967296;
  }

  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Uniformly pick one element. Throws on an empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: empty array');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** Pick by weight. `weights` may be an array parallel to `items` or a weight getter. */
  weighted<T>(items: readonly T[], weights: readonly number[] | ((item: T) => number)): T {
    if (items.length === 0) throw new Error('Rng.weighted: empty array');
    const w = (i: number): number =>
      typeof weights === 'function' ? weights(items[i] as T) : (weights[i] ?? 0);
    let total = 0;
    for (let i = 0; i < items.length; i++) total += Math.max(0, w(i));
    if (total <= 0) return this.pick(items);
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= Math.max(0, w(i));
      if (r < 0) return items[i] as T;
    }
    return items[items.length - 1] as T;
  }

  /** In-place Fisher–Yates shuffle; returns the same array. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = items[i] as T;
      items[i] = items[j] as T;
      items[j] = tmp;
    }
    return items;
  }

  /**
   * Derive an independent child generator. With a `salt`, the child depends only on this
   * generator's *current* state and the salt (does not advance this generator's stream more
   * than one draw), so sub-systems can get stable streams: `rng.fork('crowd')`.
   */
  fork(salt?: Seed): Rng {
    const base = this.nextU32();
    const s = salt === undefined ? 0 : typeof salt === 'string' ? hashString(salt) : salt >>> 0;
    return new Rng((base ^ Math.imul(s, 0x9e3779b1)) >>> 0);
  }

  /** Snapshot / restore state (for deterministic replays and save games). */
  getState(): [number, number, number, number] {
    return [this.a, this.b, this.c, this.d];
  }

  setState(state: readonly [number, number, number, number]): void {
    [this.a, this.b, this.c, this.d] = state;
  }
}
