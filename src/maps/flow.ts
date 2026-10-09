/**
 * Small, dependency-free distance fields over a MapData (Dijkstra with GROUND_COST, 4- or
 * 8-connected). Used by the validators and the map viewer's flow preview; M6 builds its own
 * production flow fields but can reuse this for tooling.
 */
import { GROUNDS, GROUND_COST, WALKABLE, type MapData, type TilePos } from './contract';

const COST = new Float32Array(GROUNDS.length);
GROUNDS.forEach((g, k) => {
  COST[k] = WALKABLE.has(g) ? (GROUND_COST[g] ?? 1) : Infinity;
});

export interface FieldOptions {
  /** Use per-ground movement costs (default true); false = plain BFS step counts. */
  costs?: boolean;
  /** Allow diagonal steps (default false). Diagonals never cut blocked corners. */
  diagonal?: boolean;
  /** Extra tiles treated as blocked (index = j * w + i). */
  blocked?: Uint8Array;
}

/** Binary min-heap of (key, value) pairs, keyed by float priority. */
class Heap {
  private k: number[] = [];
  private v: number[] = [];
  get size(): number {
    return this.v.length;
  }
  push(key: number, value: number): void {
    const k = this.k;
    const v = this.v;
    let n = v.length;
    k.push(key);
    v.push(value);
    while (n > 0) {
      const p = (n - 1) >> 1;
      if (k[p]! <= key) break;
      k[n] = k[p]!;
      v[n] = v[p]!;
      n = p;
    }
    k[n] = key;
    v[n] = value;
  }
  pop(): [number, number] {
    const k = this.k;
    const v = this.v;
    const topK = k[0]!;
    const topV = v[0]!;
    const lastK = k.pop()!;
    const lastV = v.pop()!;
    const n = v.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && k[r]! < k[l]! ? r : l;
        if (k[c]! >= lastK) break;
        k[i] = k[c]!;
        v[i] = v[c]!;
        i = c;
      }
      k[i] = lastK;
      v[i] = lastV;
    }
    return [topK, topV];
  }
}

/** Distance from every tile to the nearest target (Infinity = unreachable). */
export function distanceField(
  map: MapData,
  targets: readonly TilePos[],
  opts: FieldOptions = {},
): Float32Array {
  const { w, h, ground } = map;
  const useCost = opts.costs ?? true;
  const diag = opts.diagonal ?? false;
  const blocked = opts.blocked;
  const dist = new Float32Array(w * h).fill(Infinity);
  const heap = new Heap();
  const passable = (k: number): boolean => COST[ground[k]!]! < Infinity && !(blocked && blocked[k]);
  for (const t of targets) {
    if (t.i < 0 || t.j < 0 || t.i >= w || t.j >= h) continue;
    const k = t.j * w + t.i;
    if (!passable(k)) continue;
    dist[k] = 0;
    heap.push(0, k);
  }
  const step = (to: number, mul: number, d: number): void => {
    if (!passable(to)) return;
    const nd = d + (useCost ? COST[ground[to]!]! : 1) * mul;
    if (nd < dist[to]!) {
      dist[to] = nd;
      heap.push(nd, to);
    }
  };
  while (heap.size) {
    const [d, k] = heap.pop();
    if (d > dist[k]!) continue;
    const i = k % w;
    const j = (k - i) / w;
    if (i > 0) step(k - 1, 1, d);
    if (i < w - 1) step(k + 1, 1, d);
    if (j > 0) step(k - w, 1, d);
    if (j < h - 1) step(k + w, 1, d);
    if (diag) {
      for (const [di, dj] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ] as const) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
        if (!passable(j * w + ni) || !passable(nj * w + i)) continue;
        step(nj * w + ni, Math.SQRT2, d);
      }
    }
  }
  return dist;
}

/** Follow the steepest descent of a distance field from `from` to a target (4-connected). */
export function descend(map: MapData, field: Float32Array, from: TilePos, maxSteps = 4000): TilePos[] {
  const { w, h } = map;
  const path: TilePos[] = [{ ...from }];
  let i = from.i;
  let j = from.j;
  for (let s = 0; s < maxSteps; s++) {
    const d = field[j * w + i]!;
    if (d === 0 || !Number.isFinite(d)) break;
    let best = d;
    let bi = i;
    let bj = j;
    for (const [di, dj] of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ] as const) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
      const nd = field[nj * w + ni]!;
      if (nd < best) {
        best = nd;
        bi = ni;
        bj = nj;
      }
    }
    if (bi === i && bj === j) break;
    i = bi;
    j = bj;
    path.push({ i, j });
  }
  return path;
}
