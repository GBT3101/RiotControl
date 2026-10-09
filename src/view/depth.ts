/**
 * Iso depth helpers shared by the art jobs (workers) and the world view.
 *
 * Painter's ordering uses one numeric key per drawable: entities sort by their foot point
 * (`core/iso.depthKey`), square boxes by `boxDepthKey` (correct for anything outside the box).
 * Non-square footprints (most buildings, every Capitol) have no single correct key, so their
 * sprites are **split into square pieces**: the footprint is cut into g×g sub-boxes
 * (g = gcd(w, d)) and every opaque pixel is given to the sub-box whose vertical prism the pixel
 * belongs to (the front-most sub-box hit by the view ray, treating the building as a box of
 * height H). Each piece then sorts with `boxDepthKey` of its own square — so units walking along
 * a long facade are never cut by the wrong half of the building.
 *
 * Pure (no DOM / Pixi): runs in the art workers and in Node tests.
 */
import { createBuffer, type PixelBuffer, type Point } from '../art/lib/pixels';

export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export interface FootprintAssignment {
  /** Sub-box size in tiles. */
  g: number;
  /** Sub-boxes along i and j. */
  na: number;
  nb: number;
  /** Image size the map was computed for. */
  w: number;
  h: number;
  /** Per pixel: sub-box index (a + b·na). */
  map: Int16Array;
}

/**
 * Assign every pixel of a `iw × ih` image anchored on the footprint's top vertex (`anchor`,
 * pixel-index convention) to a g×g sub-box of a `w × d` footprint, for a box of height `H` px.
 */
export function footprintAssignment(
  iw: number,
  ih: number,
  anchor: Point,
  w: number,
  d: number,
  H: number,
  g = gcd(w, d),
): FootprintAssignment {
  const na = Math.max(1, Math.round(w / g));
  const nb = Math.max(1, Math.round(d / g));
  const map = new Int16Array(iw * ih);
  for (let py = 0; py < ih; py++) {
    const y = py + 0.5 - anchor.y;
    const sTop = (y + H) / 8;
    for (let px = 0; px < iw; px++) {
      const q = (px + 0.5 - anchor.x) / 16; // a − b
      let s = Math.min(2 * w - q, 2 * d + q, sTop);
      const sMin = Math.abs(q);
      if (s < sMin) s = sMin;
      s -= 1e-4;
      const a = (s + q) / 2;
      const b = (s - q) / 2;
      let ai = Math.floor(a / g);
      let bi = Math.floor(b / g);
      if (ai < 0) ai = 0;
      else if (ai >= na) ai = na - 1;
      if (bi < 0) bi = 0;
      else if (bi >= nb) bi = nb - 1;
      map[py * iw + px] = ai + bi * na;
    }
  }
  return { g, na, nb, w: iw, h: ih, map };
}

export interface Piece {
  /** Sub-box indices (tiles from the footprint origin = a·g, b·g). */
  a: number;
  b: number;
  /** Crop rectangle in the source image. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Cropped frames (only this piece's pixels). */
  frames: PixelBuffer[];
  /** Anchor inside the crop (source anchor − crop origin). */
  anchor: Point;
}

/**
 * Split `frames` (same size, same anchor) into per-sub-box pieces. Pieces without any opaque
 * pixel in any frame are dropped. Pass the same assignment to split companion layers (night
 * lights) identically.
 */
export function splitFrames(
  frames: readonly PixelBuffer[],
  anchor: Point,
  as: FootprintAssignment,
): Piece[] {
  const n = as.na * as.nb;
  const minX = new Int32Array(n).fill(1 << 30);
  const minY = new Int32Array(n).fill(1 << 30);
  const maxX = new Int32Array(n).fill(-1);
  const maxY = new Int32Array(n).fill(-1);
  const iw = as.w;
  for (const f of frames) {
    if (f.w !== as.w || f.h !== as.h) throw new Error('splitFrames: size mismatch');
    const data = f.data;
    for (let y = 0; y < f.h; y++) {
      for (let x = 0; x < f.w; x++) {
        const k = y * iw + x;
        if (data[k * 4 + 3] === 0) continue;
        const p = as.map[k]!;
        if (x < minX[p]!) minX[p] = x;
        if (x > maxX[p]!) maxX[p] = x;
        if (y < minY[p]!) minY[p] = y;
        if (y > maxY[p]!) maxY[p] = y;
      }
    }
  }
  const out: Piece[] = [];
  for (let p = 0; p < n; p++) {
    if (maxX[p]! < 0) continue;
    const x0 = minX[p]!;
    const y0 = minY[p]!;
    const w = maxX[p]! - x0 + 1;
    const h = maxY[p]! - y0 + 1;
    const pf = frames.map((f) => {
      const b = createBuffer(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const sk = (y0 + y) * iw + (x0 + x);
          if (as.map[sk] !== p) continue;
          const si = sk * 4;
          if (f.data[si + 3] === 0) continue;
          const di = (y * w + x) * 4;
          b.data[di] = f.data[si]!;
          b.data[di + 1] = f.data[si + 1]!;
          b.data[di + 2] = f.data[si + 2]!;
          b.data[di + 3] = f.data[si + 3]!;
        }
      }
      return b;
    });
    out.push({
      a: p % as.na,
      b: Math.floor(p / as.na),
      x: x0,
      y: y0,
      w,
      h,
      frames: pf,
      anchor: { x: anchor.x - x0, y: anchor.y - y0 },
    });
  }
  return out;
}

/** Crop frames to their union opaque bounds; returns null when fully transparent. */
export function trimToContent(
  frames: readonly PixelBuffer[],
  anchor: Point,
): { frames: PixelBuffer[]; anchor: Point } | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (const f of frames) {
    for (let y = 0; y < f.h; y++) {
      for (let x = 0; x < f.w; x++) {
        if (f.data[(y * f.w + x) * 4 + 3] === 0) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  return {
    frames: frames.map((f) => {
      const b = createBuffer(w, h);
      for (let y = 0; y < h; y++) {
        const s = ((y0 + y) * f.w + x0) * 4;
        b.data.set(f.data.subarray(s, s + w * 4), y * w * 4);
      }
      return b;
    }),
    anchor: { x: anchor.x - x0, y: anchor.y - y0 },
  };
}

/** Depth key for a square g×g box at tile (i, j) — same as core/iso.boxDepthKey. */
export function pieceDepthKey(i: number, j: number, g: number): number {
  return Math.round((i + j + g) * 8) * 65536;
}
