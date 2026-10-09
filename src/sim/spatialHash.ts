/**
 * Uniform spatial hash over the tile grid (cell = 1 tile) for protesters, rebuilt every tick
 * with a counting sort (O(n), no allocation). Items of cell c are
 * `items[start[c] .. start[c+1])` (protester slots).
 */
import type { Crowd } from './crowd';

export class SpatialHash {
  readonly w: number;
  readonly h: number;
  /** Cell size in tiles (1). */
  readonly cell = 1;
  readonly start: Int32Array;
  readonly items: Int32Array;
  /** Per-protester cell (−1 if outside). */
  readonly cellOf: Int32Array;
  private readonly cursor: Int32Array;

  constructor(w: number, h: number, capacity: number) {
    this.w = w;
    this.h = h;
    this.start = new Int32Array(w * h + 1);
    this.cursor = new Int32Array(w * h + 1);
    this.items = new Int32Array(capacity);
    this.cellOf = new Int32Array(capacity);
  }

  rebuild(c: Crowd): void {
    const { w, h, start, items, cellOf, cursor } = this;
    const cells = w * h;
    start.fill(0);
    const hi = c.hi;
    const alive = c.alive;
    const xs = c.x;
    const ys = c.y;
    for (let s = 0; s < hi; s++) {
      if (!alive[s]) {
        cellOf[s] = -1;
        continue;
      }
      const i = xs[s]! | 0;
      const j = ys[s]! | 0;
      if (i < 0 || j < 0 || i >= w || j >= h) {
        cellOf[s] = -1;
        continue;
      }
      const k = j * w + i;
      cellOf[s] = k;
      start[k + 1]!++;
    }
    for (let k = 0; k < cells; k++) start[k + 1]! += start[k]!;
    cursor.set(start);
    for (let s = 0; s < hi; s++) {
      const k = cellOf[s]!;
      if (k >= 0) items[cursor[k]!++] = s;
    }
  }

  /** Protesters in cell (i, j) (count). */
  cellCount(i: number, j: number): number {
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return 0;
    const k = j * this.w + i;
    return this.start[k + 1]! - this.start[k]!;
  }

  /**
   * Collect slots of alive protesters within `r` of (x, y) into `out`; returns the count
   * (capped at out.length). Unordered.
   */
  query(c: Crowd, x: number, y: number, r: number, out: Int32Array): number {
    const { w, h, start, items } = this;
    const i0 = Math.max(0, Math.floor(x - r));
    const i1 = Math.min(w - 1, Math.floor(x + r));
    const j0 = Math.max(0, Math.floor(y - r));
    const j1 = Math.min(h - 1, Math.floor(y + r));
    const r2 = r * r;
    const xs = c.x;
    const ys = c.y;
    let n = 0;
    const cap = out.length;
    for (let j = j0; j <= j1; j++) {
      const row = j * w;
      for (let i = i0; i <= i1; i++) {
        const k = row + i;
        const e = start[k + 1]!;
        for (let p = start[k]!; p < e; p++) {
          const s = items[p]!;
          const dx = xs[s]! - x;
          const dy = ys[s]! - y;
          if (dx * dx + dy * dy <= r2) {
            out[n++] = s;
            if (n >= cap) return n;
          }
        }
      }
    }
    return n;
  }

  /**
   * Best protester within `r` of (x, y) minimising `dist² × weight(slot)` where `weight`
   * returns a factor (≤ 0 = skip). Ring search from the centre with an exact early-out:
   * `minWeight` must be a lower bound of every weight. Returns slot or -1.
   */
  best(
    c: Crowd,
    x: number,
    y: number,
    r: number,
    weight: (slot: number) => number,
    minWeight = 1,
  ): number {
    const { w, h, start, items } = this;
    const ci = Math.floor(x);
    const cj = Math.floor(y);
    const r2 = r * r;
    const xs = c.x;
    const ys = c.y;
    let best = -1;
    let bestScore = Infinity;
    const maxRing = Math.ceil(r) + 1;
    for (let ring = 0; ring <= maxRing; ring++) {
      // Closest possible distance of any point in this ring of cells.
      const ringD = Math.max(0, ring - 1);
      if (ringD * ringD * minWeight > bestScore) break;
      const j0 = cj - ring;
      const j1 = cj + ring;
      for (let j = j0; j <= j1; j++) {
        if (j < 0 || j >= h) continue;
        const edgeRow = j === j0 || j === j1;
        const step = edgeRow ? 1 : 2 * ring;
        for (let i = ci - ring; i <= ci + ring; i += step || 1) {
          if (i < 0 || i >= w) continue;
          const k = j * w + i;
          const e = start[k + 1]!;
          for (let p = start[k]!; p < e; p++) {
            const s = items[p]!;
            const dx = xs[s]! - x;
            const dy = ys[s]! - y;
            const d2 = dx * dx + dy * dy;
            if (d2 > r2) continue;
            const wt = weight(s);
            if (wt <= 0) continue;
            const sc = d2 * wt;
            if (sc < bestScore) {
              bestScore = sc;
              best = s;
            }
          }
        }
      }
    }
    return best;
  }
}
