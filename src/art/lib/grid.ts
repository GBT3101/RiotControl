/**
 * String-grid sprite authoring.
 *
 * A grid is a block of rows of single-character keys; `.` is transparent, `%` is the shadow
 * colour at SHADOW_ALPHA (both overridable). Keys map to colour references (see palette.ts):
 *
 *   const COP_KEYS = { o: 'ink', N: 'navy.2', n: 'navy.3', S: '$skin.1' };
 *   const idle = sheet(`
 *     ..oo..
 *     .oNNo.
 *
 *     ..oo..
 *     .onno.
 *   `, COP_KEYS, { slots: { skin: 'skin4' } });
 *
 * - Common leading indentation and leading/trailing blank lines are stripped.
 * - In a *sheet*, frames are separated by one or more blank lines.
 * - `$slot.step` references are **semantic slots** resolved through `slots` (slot → ramp
 *   name). This is how paper-doll variants recolour hair/skin/clothes (see paperdoll.ts).
 * - Spaces inside a row are not allowed (use `.`), so alignment mistakes fail loudly.
 */
import { SHADOW, SHADOW_ALPHA, isRampName, rampSwatch, resolveColor, type RGBA } from '../palette';
import type { RampName } from '../palette';
import { createBuffer, type PixelBuffer } from './pixels';

/** A colour reference string, or a reference with explicit alpha (shadow layers only). */
export type ColorSpec = string | { ref: string; alpha: number };
export type KeyMap = Readonly<Record<string, ColorSpec>>;
/** Semantic slot name → ramp name (e.g. { hair: 'dyePink', skin: 'skin3' }). */
export type SlotMap = Readonly<Record<string, RampName>>;

export interface RenderOptions {
  slots?: SlotMap;
}

/** Parsed, not-yet-coloured grid of key characters. */
export interface KeyGrid {
  readonly w: number;
  readonly h: number;
  readonly rows: readonly string[];
}

export const TRANSPARENT_KEY = '.';
export const SHADOW_KEY = '%';

const DEFAULT_KEYS: KeyMap = {
  [SHADOW_KEY]: { ref: SHADOW, alpha: SHADOW_ALPHA },
};

/** Split source text into trimmed rows (dedented, blank edges removed). */
export function splitRows(src: string): string[] {
  const lines = src.replace(/\r/g, '').split('\n');
  while (lines.length && lines[0]!.trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1]!.trim() === '') lines.pop();
  return lines.map((l) => l.trim());
}

/** Split a sheet into frame row-blocks, separated by blank lines. */
export function splitFrames(src: string): string[][] {
  const frames: string[][] = [];
  let cur: string[] = [];
  for (const raw of src.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (line === '') {
      if (cur.length) frames.push(cur);
      cur = [];
    } else cur.push(line);
  }
  if (cur.length) frames.push(cur);
  return frames;
}

export function keyGrid(rowsOrSrc: string | readonly string[], name = 'grid'): KeyGrid {
  const rows = typeof rowsOrSrc === 'string' ? splitRows(rowsOrSrc) : [...rowsOrSrc];
  if (rows.length === 0) throw new Error(`${name}: empty grid`);
  const w = rows[0]!.length;
  rows.forEach((r, i) => {
    if (r.length !== w) {
      throw new Error(`${name}: row ${i} has width ${r.length}, expected ${w}: "${r}"`);
    }
    if (/\s/.test(r)) throw new Error(`${name}: row ${i} contains whitespace: "${r}"`);
  });
  return { w, h: rows.length, rows };
}

export function keyFrames(src: string, name = 'sheet'): KeyGrid[] {
  return splitFrames(src).map((rows, i) => keyGrid(rows, `${name}[${i}]`));
}

/** Resolve a colour spec (with `$slot.step` support) to packed RGBA. */
export function resolveSpec(spec: ColorSpec, slots: SlotMap | undefined, ctx = ''): RGBA {
  const ref = typeof spec === 'string' ? spec : spec.ref;
  const alpha = typeof spec === 'string' ? 255 : spec.alpha;
  if (ref.startsWith('$')) {
    const body = ref.slice(1);
    const dot = body.lastIndexOf('.');
    const slot = dot > 0 ? body.slice(0, dot) : body;
    const step = dot > 0 ? Number(body.slice(dot + 1)) : 0;
    const ramp = slots?.[slot];
    if (!ramp || !isRampName(ramp)) {
      throw new Error(`${ctx}: slot "$${slot}" has no ramp (slots: ${JSON.stringify(slots)})`);
    }
    return resolveColor(rampSwatch(ramp, step), alpha);
  }
  return resolveColor(ref, alpha);
}

/** Colour a key grid into an RGBA buffer. Unknown keys throw. */
export function renderKeys(
  grid: KeyGrid,
  keys: KeyMap,
  opts: RenderOptions = {},
  name = 'grid',
): PixelBuffer {
  const merged: KeyMap = { ...DEFAULT_KEYS, ...keys };
  const cache = new Map<string, RGBA>();
  const buf = createBuffer(grid.w, grid.h);
  for (let y = 0; y < grid.h; y++) {
    const row = grid.rows[y]!;
    for (let x = 0; x < grid.w; x++) {
      const k = row[x]!;
      if (k === TRANSPARENT_KEY) continue;
      let c = cache.get(k);
      if (c === undefined) {
        const spec = merged[k];
        if (spec === undefined) throw new Error(`${name}: unknown key "${k}" at ${x},${y}`);
        c = resolveSpec(spec, opts.slots, `${name} key "${k}"`);
        cache.set(k, c);
      }
      const i = (y * grid.w + x) * 4;
      buf.data[i] = (c >>> 24) & 255;
      buf.data[i + 1] = (c >>> 16) & 255;
      buf.data[i + 2] = (c >>> 8) & 255;
      buf.data[i + 3] = c & 255;
    }
  }
  return buf;
}

/** Parse + colour a single-frame grid. */
export function grid(
  src: string,
  keys: KeyMap,
  opts: RenderOptions = {},
  name = 'grid',
): PixelBuffer {
  return renderKeys(keyGrid(src, name), keys, opts, name);
}

/** Parse + colour a multi-frame sheet (frames separated by blank lines, equal sizes). */
export function sheet(
  src: string,
  keys: KeyMap,
  opts: RenderOptions = {},
  name = 'sheet',
): PixelBuffer[] {
  const frames = keyFrames(src, name);
  const f0 = frames[0];
  if (!f0) throw new Error(`${name}: no frames`);
  frames.forEach((f, i) => {
    if (f.w !== f0.w || f.h !== f0.h) {
      throw new Error(`${name}: frame ${i} is ${f.w}×${f.h}, expected ${f0.w}×${f0.h}`);
    }
  });
  return frames.map((f, i) => renderKeys(f, keys, opts, `${name}[${i}]`));
}

/** `n` fully transparent w×h key grids (a blank paper-doll base). */
export function blankFrames(w: number, h: number, n: number): KeyGrid[] {
  const g = keyGrid(Array.from({ length: h }, () => TRANSPARENT_KEY.repeat(w)));
  return Array.from({ length: n }, () => g);
}

/** Convenience: the set of keys used by a grid (for validation / tooling). */
export function usedKeys(grid: KeyGrid): Set<string> {
  const s = new Set<string>();
  for (const r of grid.rows) for (const k of r) if (k !== TRANSPARENT_KEY) s.add(k);
  return s;
}
