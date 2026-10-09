/**
 * Occlusion grid: which ground tiles are hidden behind a building on screen. A person standing
 * on an occluded tile gets an x-ray silhouette (ally blue / enemy red) drawn above the
 * buildings. Pure maths over footprints + heights, computed once per map.
 */

export interface Box {
  i: number;
  j: number;
  w: number;
  d: number;
  /** Height above ground (px). */
  h: number;
}

/** Vertical extent of a footprint diamond at screen x (world px), or null if x misses it. */
function diamondSpan(b: Box, x: number): [number, number] | null {
  const c = x / 16; // u − v
  const uMin = Math.max(b.i, b.j + c);
  const uMax = Math.min(b.i + b.w, b.j + b.d + c);
  if (uMin > uMax) return null;
  return [(2 * uMin - c) * 8, (2 * uMax - c) * 8];
}

/** Is world point (x, y) covered by box `b` (its screen silhouette), with the point behind it? */
export function covers(b: Box, x: number, y: number): boolean {
  const s = diamondSpan(b, x);
  if (!s) return false;
  return y >= s[0] - b.h && y < s[1];
}

/**
 * Per tile (row-major): 1 when a person standing on that tile is hidden by a box in front of
 * it — tested just above the feet, so people who are only cut at the head stay unghosted.
 */
export function occlusionGrid(w: number, h: number, boxes: readonly Box[], blocked: (t: number) => boolean): Uint8Array {
  const out = new Uint8Array(w * h);
  // Bucket boxes by tile for a local search.
  const at = new Int32Array(w * h).fill(-1);
  boxes.forEach((b, k) => {
    for (let j = b.j; j < b.j + b.d; j++)
      for (let i = b.i; i < b.i + b.w; i++) if (i >= 0 && j >= 0 && i < w && j < h) at[j * w + i] = k;
  });
  const seen = new Set<number>();
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const t = j * w + i;
      if (blocked(t)) continue;
      const x = (i - j) * 16;
      const y = (i + j + 1) * 8 - 4;
      seen.clear();
      let occ = 0;
      // Boxes in front on screen: walk down the screen column (i+k, j+k) and its neighbours.
      for (let k = 1; k <= 14 && !occ; k++) {
        for (const [di, dj] of [
          [k, k],
          [k, k - 1],
          [k - 1, k],
        ] as const) {
          const ii = i + di;
          const jj = j + dj;
          if (ii >= w || jj >= h) continue;
          const bk = at[jj * w + ii]!;
          if (bk < 0 || seen.has(bk)) continue;
          seen.add(bk);
          if (covers(boxes[bk]!, x, y)) {
            occ = 1;
            break;
          }
        }
      }
      out[t] = occ;
    }
  }
  return out;
}
