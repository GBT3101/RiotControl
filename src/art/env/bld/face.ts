/**
 * Face canvas: one wall face painted in unsheared face space (columns along the wall, rows from
 * the top), with a per-pixel kind (wall / relief / glass) and a night-light layer. The building
 * rasterizer samples it when shearing the face onto the iso box.
 */
import type { RGBA } from '../../palette';
import { darker, lighter } from '../color';
import { hash } from '../util';

export const K_WALL = 0;
export const K_RELIEF = 1;
export const K_GLASS = 2;
export const K_HOLE = 3;

export class Face {
  readonly w: number;
  readonly h: number;
  readonly col: Uint32Array;
  readonly kind: Uint8Array;
  readonly light: Uint32Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.col = new Uint32Array(w * h);
    this.kind = new Uint8Array(w * h);
    this.light = new Uint32Array(w * h);
  }

  in(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): RGBA {
    return this.in(x, y) ? this.col[y * this.w + x]! : 0;
  }

  kindAt(x: number, y: number): number {
    return this.in(x, y) ? this.kind[y * this.w + x]! : K_WALL;
  }

  set(x: number, y: number, c: RGBA, kind = K_RELIEF, light: RGBA = 0): void {
    if (!this.in(x, y)) return;
    const i = y * this.w + x;
    this.col[i] = c;
    this.kind[i] = kind;
    this.light[i] = light;
  }

  /** Recolour a wall pixel without changing its kind. */
  tint(x: number, y: number, c: RGBA): void {
    if (!this.in(x, y)) return;
    this.col[y * this.w + x] = c;
  }

  darken(x: number, y: number, n = 1): void {
    if (!this.in(x, y)) return;
    const i = y * this.w + x;
    this.col[i] = darker(this.col[i]!, n);
  }

  lighten(x: number, y: number, n = 1): void {
    if (!this.in(x, y)) return;
    const i = y * this.w + x;
    this.col[i] = lighter(this.col[i]!, n);
  }

  fillRect(x: number, y: number, w: number, h: number, c: RGBA, kind = K_RELIEF): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c, kind);
  }

  /** Relief drop shadow: wall pixels just below / right of relief catch a one-step shadow. */
  dropShadows(): void {
    const marks: number[] = [];
    for (let y = 1; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        if (this.kind[i] !== K_WALL) continue;
        const up = this.kind[i - this.w]!;
        const left = x > 0 ? this.kind[i - 1]! : K_WALL;
        const upLeft = x > 0 ? this.kind[i - this.w - 1]! : K_WALL;
        if (up === K_RELIEF || (left === K_RELIEF && upLeft === K_RELIEF)) marks.push(i);
      }
    }
    for (const i of marks) this.col[i] = darker(this.col[i]!);
  }
}

// -------------------------------------------------------------------------- module stamping ---

export interface ParsedGrid {
  w: number;
  h: number;
  rows: string[];
}

const parsed = new Map<string, ParsedGrid>();
export function parseGrid(src: string): ParsedGrid {
  let g = parsed.get(src);
  if (!g) {
    const rows = src
      .replace(/\r/g, '')
      .split('\n')
      .map((r) => r.trim())
      .filter((r) => r.length > 0);
    g = { w: Math.max(...rows.map((r) => r.length)), h: rows.length, rows };
    parsed.set(src, g);
  }
  return g;
}

/** Key → colour resolver; return null to leave the pixel untouched. */
export type KeyResolver = (key: string, x: number, y: number) => RGBA | null;

const GLASS_KEYS = new Set(['g', 'G', 'k']);

/**
 * Stamp a module at (x0, y0). Glass pixels become K_GLASS and, if `glow` is given, write the
 * night-light layer (`glowHi` on reflection pixels).
 */
export function stampModule(
  f: Face,
  src: string,
  x0: number,
  y0: number,
  res: KeyResolver,
  glow: RGBA = 0,
  glowHi: RGBA = 0,
): void {
  const g = parseGrid(src);
  for (let y = 0; y < g.h; y++) {
    const row = g.rows[y]!;
    for (let x = 0; x < row.length; x++) {
      const k = row[x]!;
      if (k === '.') continue;
      const c = res(k, x0 + x, y0 + y);
      if (c === null) continue;
      const glass = GLASS_KEYS.has(k);
      const kind = glass ? K_GLASS : k === 'w' || k === 'W' ? K_WALL : K_RELIEF;
      f.set(x0 + x, y0 + y, c, kind, glass && glow ? (k === 'G' ? glowHi : glow) : 0);
    }
  }
}

/** Deterministic per-pixel noise in [0, 1) for wall textures. */
export function n2(x: number, y: number, s: number): number {
  return hash(x, y, s) / 4294967296;
}
