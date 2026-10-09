/**
 * District rally points (M7): a static distance field per spawn district toward its `rally`
 * tile (base ground costs only — rallies happen before the fighting), sampled like the Capitol
 * flow field. Fresh protesters walk to their district's rally point, gather a moment, then
 * march on the Capitol together. Fields are built lazily (≈ 0.5 ms each) and deterministically.
 */
import { MinHeap, type Nav } from './nav';

const SQRT2 = Math.SQRT2;
const NDX = [1, -1, 0, 0, 1, 1, -1, -1];
const NDY = [0, 0, 1, -1, 1, -1, 1, -1];
const NLEN = [1, 1, 1, 1, SQRT2, SQRT2, SQRT2, SQRT2];

export interface RallyField {
  goal: number;
  dist: Float32Array;
  fx: Float32Array;
  fy: Float32Array;
}

/** Dijkstra from `goal` over walkable tiles (8-connected, no corner cutting). */
export function buildRallyField(nav: Nav, goal: number): RallyField {
  const { w, h, size, walk, baseCost } = nav;
  const dist = new Float32Array(size).fill(Infinity);
  const fx = new Float32Array(size);
  const fy = new Float32Array(size);
  const heap = new MinHeap(size * 4);
  if (goal >= 0 && walk[goal]) {
    dist[goal] = 0;
    heap.push(0, goal);
  }
  while (heap.size > 0) {
    const t = heap.pop();
    const d = heap.lastKey;
    if (d > dist[t]!) continue;
    const ti = t % w;
    const tj = (t - ti) / w;
    for (let k = 0; k < 8; k++) {
      const ni = ti + NDX[k]!;
      const nj = tj + NDY[k]!;
      if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
      const n = nj * w + ni;
      if (!walk[n]) continue;
      if (k >= 4 && (!walk[tj * w + ni] || !walk[nj * w + ti])) continue;
      const nd = d + NLEN[k]! * 0.5 * (baseCost[t]! + baseCost[n]!);
      if (nd < dist[n]!) {
        dist[n] = nd;
        heap.push(dist[n]!, n);
      }
    }
  }
  for (let t = 0; t < size; t++) {
    if (!walk[t] || dist[t] === Infinity || dist[t] === 0) continue;
    const ti = t % w;
    const tj = (t - ti) / w;
    let best = dist[t]!;
    let bk = -1;
    for (let k = 0; k < 8; k++) {
      const ni = ti + NDX[k]!;
      const nj = tj + NDY[k]!;
      if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
      const n = nj * w + ni;
      if (!walk[n]) continue;
      if (k >= 4 && (!walk[tj * w + ni] || !walk[nj * w + ti])) continue;
      if (dist[n]! < best) {
        best = dist[n]!;
        bk = k;
      }
    }
    if (bk >= 0) {
      fx[t] = NDX[bk]! / NLEN[bk]!;
      fy[t] = NDY[bk]! / NLEN[bk]!;
    }
  }
  return { goal, dist, fx, fy };
}

/** Bilinear sample of a rally field at (x, y) → `out` (not normalised; may be 0). */
export function sampleRally(
  nav: Nav,
  f: RallyField,
  x: number,
  y: number,
  out: { x: number; y: number },
): void {
  const w = nav.w;
  const h = nav.h;
  const fxp = x - 0.5;
  const fyp = y - 0.5;
  const i0 = Math.floor(fxp);
  const j0 = Math.floor(fyp);
  const tx = fxp - i0;
  const ty = fyp - j0;
  let sx = 0;
  let sy = 0;
  let wsum = 0;
  for (let q = 0; q < 4; q++) {
    const i = i0 + (q & 1);
    const j = j0 + (q >> 1);
    if (i < 0 || j < 0 || i >= w || j >= h) continue;
    const t = j * w + i;
    if (!nav.walk[t] || f.dist[t] === Infinity) continue;
    const wt = ((q & 1) === 1 ? tx : 1 - tx) * (q >> 1 === 1 ? ty : 1 - ty);
    sx += f.fx[t]! * wt;
    sy += f.fy[t]! * wt;
    wsum += wt;
  }
  out.x = wsum > 0 ? sx / wsum : 0;
  out.y = wsum > 0 ? sy / wsum : 0;
}
