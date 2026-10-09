/**
 * Small shared helpers for the environment kit: integer hashing, a tiny seeded RNG wrapper,
 * pixel plotting shortcuts and grid → buffer caching.
 */
import { grid, type KeyMap } from '../lib/grid';
import { createBuffer, getPixel, setPixel, type PixelBuffer } from '../lib/pixels';
import type { RGBA } from '../palette';
import { darker } from './color';

/** 32-bit integer hash of up to 4 integers (deterministic, well mixed). */
export function hash(a: number, b = 0, c = 0, d = 0): number {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca77);
  h ^= Math.imul(c | 0, 0xc2b2ae3d) ^ Math.imul(d | 0, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
}

/** Hash → float in [0, 1). */
export function hashF(a: number, b = 0, c = 0, d = 0): number {
  return hash(a, b, c, d) / 4294967296;
}

/** Minimal seeded generator (mulberry32) — cheap enough to create per sprite. */
export class Dice {
  private s: number;
  constructor(seed: number) {
    this.s = hash(seed, 0x51ed) || 1;
  }
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)] as T;
  }
  weighted<T>(items: ReadonlyArray<readonly [T, number]>): T {
    let total = 0;
    for (const [, w] of items) total += w;
    let r = this.next() * total;
    for (const [v, w] of items) {
      r -= w;
      if (r < 0) return v;
    }
    return items[items.length - 1]![0];
  }
}

export const mod = (a: number, m: number): number => ((a % m) + m) % m;

/** Set a pixel only if (x, y) is inside and the colour is opaque-ish (non-zero alpha). */
export function plot(buf: PixelBuffer, x: number, y: number, c: RGBA): void {
  if (x < 0 || y < 0 || x >= buf.w || y >= buf.h) return;
  setPixel(buf, x, y, c);
}

/** Fill a rectangle. */
export function rect(buf: PixelBuffer, x: number, y: number, w: number, h: number, c: RGBA): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) plot(buf, xx, yy, c);
}

/** Darken in place every opaque pixel for which `pred` holds. */
export function darkenWhere(
  buf: PixelBuffer,
  pred: (x: number, y: number) => boolean,
  n = 1,
): void {
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      const c = getPixel(buf, x, y);
      if ((c & 255) !== 255 || !pred(x, y)) continue;
      setPixel(buf, x, y, darker(c, n));
    }
  }
}

/** Opaque-only blit (skips transparent pixels; no shadow semantics). */
export function stamp(dst: PixelBuffer, src: PixelBuffer, dx: number, dy: number): void {
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
      dst.data[di] = src.data[si]!;
      dst.data[di + 1] = src.data[si + 1]!;
      dst.data[di + 2] = src.data[si + 2]!;
      dst.data[di + 3] = a;
    }
  }
}

const gridCache = new Map<string, PixelBuffer>();

/** Parse + colour a grid once per (name) — modules are reused across thousands of sprites. */
export function cachedGrid(name: string, src: string, keys: KeyMap): PixelBuffer {
  let b = gridCache.get(name);
  if (!b) {
    b = grid(src, keys, {}, name);
    gridCache.set(name, b);
  }
  return b;
}

/** Shift every opaque pixel of `src` by `n` shade steps (negative = darker) into a copy. */
export function shadeBuffer(src: PixelBuffer, n: number): PixelBuffer {
  const out = createBuffer(src.w, src.h);
  out.data.set(src.data);
  if (n === 0) return out;
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      const c = getPixel(out, x, y);
      if ((c & 255) === 0) continue;
      setPixel(out, x, y, n < 0 ? darker(c, -n) : c);
    }
  }
  return out;
}
