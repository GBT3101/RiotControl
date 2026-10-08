/**
 * DOM-free RGBA pixel buffers and the pixel operations every art module builds on.
 * Everything here runs in Node (tests) and the browser alike.
 */
import type { RGBA } from '../palette';

export interface PixelBuffer {
  readonly w: number;
  readonly h: number;
  /** Straight (non-premultiplied) RGBA, row-major, 4 bytes per pixel. */
  readonly data: Uint8ClampedArray;
}

export interface Point {
  x: number;
  y: number;
}

export function createBuffer(w: number, h: number): PixelBuffer {
  if (!(w > 0 && h > 0)) throw new Error(`createBuffer: bad size ${w}×${h}`);
  return { w, h, data: new Uint8ClampedArray(w * h * 4) };
}

export function cloneBuffer(src: PixelBuffer): PixelBuffer {
  return { w: src.w, h: src.h, data: new Uint8ClampedArray(src.data) };
}

export function inBounds(buf: PixelBuffer, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < buf.w && y < buf.h;
}

/** Packed 0xRRGGBBAA, or 0 outside the buffer. */
export function getPixel(buf: PixelBuffer, x: number, y: number): RGBA {
  if (!inBounds(buf, x, y)) return 0;
  const i = (y * buf.w + x) * 4;
  const d = buf.data;
  return (((d[i]! << 24) | (d[i + 1]! << 16) | (d[i + 2]! << 8) | d[i + 3]!) >>> 0) as RGBA;
}

export function setPixel(buf: PixelBuffer, x: number, y: number, c: RGBA): void {
  if (!inBounds(buf, x, y)) return;
  const i = (y * buf.w + x) * 4;
  const d = buf.data;
  d[i] = (c >>> 24) & 255;
  d[i + 1] = (c >>> 16) & 255;
  d[i + 2] = (c >>> 8) & 255;
  d[i + 3] = c & 255;
}

export function alphaAt(buf: PixelBuffer, x: number, y: number): number {
  if (!inBounds(buf, x, y)) return 0;
  return buf.data[(y * buf.w + x) * 4 + 3]!;
}

export function isOpaque(buf: PixelBuffer, x: number, y: number): boolean {
  return alphaAt(buf, x, y) === 255;
}

/**
 * Palette-safe blit of `src` onto `dst` at (dx, dy):
 * - opaque source pixels overwrite;
 * - semi-transparent source pixels (shadow layers) are written only where `dst` is fully
 *   transparent, so no off-palette blended colours are ever produced.
 */
export function blit(dst: PixelBuffer, src: PixelBuffer, dx: number, dy: number): void {
  for (let y = 0; y < src.h; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= dst.h) continue;
    for (let x = 0; x < src.w; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= dst.w) continue;
      const si = (y * src.w + x) * 4;
      const a = src.data[si + 3]!;
      if (a === 0) continue;
      const di = (ty * dst.w + tx) * 4;
      if (a < 255 && dst.data[di + 3]! !== 0) continue;
      dst.data[di] = src.data[si]!;
      dst.data[di + 1] = src.data[si + 1]!;
      dst.data[di + 2] = src.data[si + 2]!;
      dst.data[di + 3] = a;
    }
  }
}

/** Horizontally mirrored copy. */
export function mirrorX(src: PixelBuffer): PixelBuffer {
  const out = createBuffer(src.w, src.h);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const si = (y * src.w + x) * 4;
      const di = (y * src.w + (src.w - 1 - x)) * 4;
      out.data[di] = src.data[si]!;
      out.data[di + 1] = src.data[si + 1]!;
      out.data[di + 2] = src.data[si + 2]!;
      out.data[di + 3] = src.data[si + 3]!;
    }
  }
  return out;
}

/** Anchor of a horizontally mirrored sprite (pixel-index semantics: column stays put). */
export function mirrorAnchor(anchor: Point, w: number): Point {
  return { x: w - 1 - anchor.x, y: anchor.y };
}

/** Copy with `n` transparent pixels of padding on every side (or per side). */
export function pad(
  src: PixelBuffer,
  n: number | { top: number; right: number; bottom: number; left: number },
): PixelBuffer {
  const p = typeof n === 'number' ? { top: n, right: n, bottom: n, left: n } : n;
  const out = createBuffer(src.w + p.left + p.right, src.h + p.top + p.bottom);
  blit(out, src, p.left, p.top);
  return out;
}

/** Sub-rectangle copy (clipped to the source). */
export function crop(src: PixelBuffer, x: number, y: number, w: number, h: number): PixelBuffer {
  const out = createBuffer(w, h);
  blit(out, src, -x, -y);
  return out;
}

/** Bounding box of non-transparent pixels, or null if empty. */
export function opaqueBounds(
  src: PixelBuffer,
): { x: number; y: number; w: number; h: number } | null {
  let minX = src.w;
  let minY = src.h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      if (src.data[(y * src.w + x) * 4 + 3]! === 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export interface OutlineOptions {
  /** Also outline diagonal neighbours (thicker look). Default false (4-neighbourhood). */
  corners?: boolean;
  /** Only add outline pixels on these sides of the shape (default: all). */
  sides?: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean };
}

/**
 * Auto 1-px exterior outline, in place. Every pixel that is not fully opaque and touches a
 * fully opaque pixel becomes the outline colour. `colour` may be a function of the touching
 * pixel's colour (e.g. darkest step of that material's ramp) for coloured outlines.
 * Shadow pixels (partial alpha) never *cause* an outline, but are overwritten by it.
 * Leave a 1-px transparent margin in the source so the outline fits (see `pad`).
 */
export function outline(
  buf: PixelBuffer,
  colour: RGBA | ((neighbour: RGBA) => RGBA),
  opts: OutlineOptions = {},
): PixelBuffer {
  const sides = opts.sides ?? {};
  const dirs: Array<[number, number, boolean]> = [
    // [dx, dy, enabled]: neighbour offset of the opaque source pixel.
    [1, 0, sides.left ?? true], // opaque pixel to the right → outline on its left side
    [-1, 0, sides.right ?? true],
    [0, 1, sides.top ?? true],
    [0, -1, sides.bottom ?? true],
  ];
  if (opts.corners) dirs.push([1, 1, true], [-1, 1, true], [1, -1, true], [-1, -1, true]);
  const marks: Array<[number, number, RGBA]> = [];
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      if (isOpaque(buf, x, y)) continue;
      for (const [dx, dy, on] of dirs) {
        if (!on || !isOpaque(buf, x + dx, y + dy)) continue;
        const c = typeof colour === 'function' ? colour(getPixel(buf, x + dx, y + dy)) : colour;
        marks.push([x, y, c]);
        break;
      }
    }
  }
  for (const [x, y, c] of marks) setPixel(buf, x, y, c);
  return buf;
}

/** Recolour in place: exact RGB matches in `map` (keys/values packed RGBA, alpha ignored on match). */
export function recolour(buf: PixelBuffer, map: ReadonlyMap<RGBA, RGBA>): PixelBuffer {
  const byRgb = new Map<number, RGBA>();
  for (const [from, to] of map) byRgb.set(from >>> 8, to);
  const d = buf.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! === 0) continue;
    const rgb = (d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!;
    const to = byRgb.get(rgb);
    if (to === undefined) continue;
    d[i] = (to >>> 24) & 255;
    d[i + 1] = (to >>> 16) & 255;
    d[i + 2] = (to >>> 8) & 255;
  }
  return buf;
}

/** Fill every opaque pixel with one colour (hit-flash frames, silhouettes). */
export function silhouette(src: PixelBuffer, c: RGBA): PixelBuffer {
  const out = cloneBuffer(src);
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! !== 255) continue;
    d[i] = (c >>> 24) & 255;
    d[i + 1] = (c >>> 16) & 255;
    d[i + 2] = (c >>> 8) & 255;
  }
  return out;
}

/** Iterate all distinct colours of a buffer (packed RGBA incl. alpha), excluding transparent. */
export function distinctColours(buf: PixelBuffer): Set<RGBA> {
  const s = new Set<RGBA>();
  const d = buf.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! === 0) continue;
    s.add((((d[i]! << 24) | (d[i + 1]! << 16) | (d[i + 2]! << 8) | d[i + 3]!) >>> 0) as RGBA);
  }
  return s;
}
