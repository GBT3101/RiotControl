/**
 * Materials for the landmark renderer: 5-level light ramps (RIOT-64 swatches only), the
 * coloured-outline table, and face-space module stamping (hand-authored grids placed on
 * walls; the 2:1 shear comes for free from the face-space → screen mapping).
 */
import { SWATCHES, hexToRgba, type RGBA, type SwatchName } from '../../palette';
import { keyGrid, type KeyGrid } from '../../lib/grid';
import type { Material, ShadeCtx } from './scene';

/**
 * A light ramp indexed by light level: [0 contact/deep shade, 1 shaded face, 2 half-light,
 * 3 lit wall, 4 sunlit top]. Swatch names only.
 */
export type Ramp5 = readonly [SwatchName, SwatchName, SwatchName, SwatchName, SwatchName];

// --- Landmark ramps (hue-shifted: cool violet shadows → warm cream lights) ----------------------
export const R = {
  /** Madrid Congreso: warm cream stucco / limestone. */
  cream: ['stone0', 'stone1', 'stone2', 'stone4', 'stone5'],
  creamWarm: ['stone1', 'stone2', 'stone3', 'stone4', 'stone5'],
  /** Granite base courses (cool grey). */
  granite: ['stone0', 'gray3', 'gray5', 'gray6', 'gray7'],
  /** Ochre render. */
  ochre: ['earth2', 'earth3', 'ochre1', 'ochre2', 'ochre3'],
  /** London Westminster honey limestone (Anston stone). */
  honey: ['stone0', 'stone1', 'stone2', 'stone3', 'stone4'],
  honeyLit: ['stone1', 'stone2', 'stone3', 'stone4', 'stone5'],
  /** Portland stone (white-grey). */
  portland: ['stone1', 'gray5', 'gray6', 'gray7', 'white'],
  /** Paris limestone (pale). */
  lime: ['stone1', 'stone2', 'stone3', 'stone4', 'stone5'],
  limePale: ['stone2', 'stone3', 'stone4', 'stone5', 'white'],
  /** Slate / lead roofs. */
  slate: ['ink', 'gray1', 'zinc0', 'zinc1', 'zinc2'],
  slateLit: ['gray1', 'zinc0', 'zinc1', 'zinc2', 'zinc3'],
  /** Paris zinc roofs. */
  zinc: ['zinc0', 'zinc1', 'zinc2', 'zinc3', 'zinc4'],
  /** Westminster cast-iron roof (blue-grey with green hint). */
  iron: ['ink', 'zinc0', 'zinc1', 'zinc2', 'zinc3'],
  /** Gilding. */
  gold: ['earth1', 'ochre1', 'ochre2', 'ochre3', 'ochre4'],
  /** Bronze statues (dark patina). */
  bronze: ['ink', 'earth0', 'earth1', 'earth2', 'earth3'],
  verdigris: ['green0', 'teal1', 'green3', 'teal2', 'green4'],
  /** Glass panes. */
  glass: ['navy0', 'navy1', 'zinc1', 'zinc2', 'sky'],
  glassSky: ['navy1', 'zinc1', 'zinc2', 'blue2', 'sky'],
  /** Window recess (dark interior). */
  dark: ['ink', 'navy0', 'navy0', 'navy1', 'navy1'],
  /** Eiffel puddle-iron brown. */
  eiffel: ['earth0', 'earth1', 'earth2', 'earth3', 'earth4'],
  /** White marble. */
  marble: ['gray4', 'gray5', 'gray6', 'gray7', 'white'],
  /** Red granite (obelisk, Luxor: warm pinkish). */
  pinkGranite: ['earth1', 'earth3', 'earth4', 'earth5', 'earth6'],
  /** Red brick (Westminster / Victorian). */
  brick: ['earth0', 'rust0', 'rust1', 'rust2', 'rust3'],
  /** Water. */
  water: ['navy0', 'navy1', 'teal1', 'blue2', 'sky'],
  /** Lawn. */
  grass: ['green1', 'green2', 'green3', 'green4', 'lime'],
  /** Sand / gravel (Champ de Mars). */
  gravel: ['stone0', 'stone1', 'stone2', 'stone3', 'stone4'],
  /** Plaza paving. */
  paving: ['gray3', 'stone1', 'stone2', 'stone3', 'stone4'],
  /** Soot / charred. */
  char: ['ink', 'gray1', 'gray2', 'gray3', 'gray4'],
  /** Iron / painted metal (railings, poles). */
  metal: ['ink', 'gray1', 'zinc1', 'zinc2', 'zinc3'],
  /** White paint (London Eye). */
  whiteSteel: ['gray4', 'gray5', 'gray6', 'gray7', 'white'],
} as const satisfies Record<string, Ramp5>;

// --- Outline colours: the darkest member of each swatch's family -------------------------------
const INK_FAMILY: Partial<Record<SwatchName, SwatchName>> = {
  white: 'gray3',
  gray7: 'gray2',
  gray6: 'gray2',
  gray5: 'gray1',
  gray4: 'gray1',
  gray3: 'ink',
  gray2: 'ink',
  gray1: 'ink',
  stone5: 'stone1',
  stone4: 'stone0',
  stone3: 'stone0',
  stone2: 'stone0',
  stone1: 'earth0',
  stone0: 'ink',
  earth7: 'earth3',
  earth6: 'earth2',
  earth5: 'earth1',
  earth4: 'earth1',
  earth3: 'earth0',
  earth2: 'earth0',
  ochre4: 'earth3',
  ochre3: 'earth2',
  ochre2: 'earth1',
  ochre1: 'earth0',
  rust4: 'rust1',
  rust3: 'rust0',
  rust2: 'rust0',
  rust1: 'earth0',
  crim2: 'rust0',
  crim1: 'rust0',
  zinc4: 'zinc1',
  zinc3: 'zinc0',
  zinc2: 'zinc0',
  zinc1: 'navy0',
  zinc0: 'ink',
  sky: 'navy1',
  blue2: 'navy1',
  blue1: 'navy0',
  navy2: 'navy0',
  teal2: 'teal1',
  teal1: 'navy0',
  green4: 'green1',
  green3: 'green0',
  green2: 'green0',
  lime: 'green1',
  hivis2: 'olive1',
  pink3: 'pink1',
  pink2: 'plum1',
};
const INK_RGBA = new Map<number, RGBA>();
for (const [k, v] of Object.entries(SWATCHES)) {
  const out = INK_FAMILY[k as SwatchName] ?? 'ink';
  INK_RGBA.set(parseInt(v.slice(1), 16), hexToRgba(SWATCHES[out]));
}
const INK = hexToRgba(SWATCHES.ink);
/** Outline colour for a pixel colour (packed RGBA). */
export function inkOf(c: RGBA): RGBA {
  return INK_RGBA.get(c >>> 8) ?? INK;
}

// --- Material builders -------------------------------------------------------------------------

/** Plain ramp material: light level → swatch; contact edges darken to level 0. */
export function plain(r: Ramp5, o: { rim?: boolean; edge?: boolean } = {}): Material {
  return (c) => {
    if (c.edge && o.edge !== false) return r[0];
    let l = c.level;
    if (o.rim && c.rim && l >= 3) l = 4;
    return r[l]!;
  };
}

/** Pick a ramp swatch by level with an offset (clamped). */
export function lv(r: Ramp5, level: number, d = 0): SwatchName {
  return r[Math.max(0, Math.min(4, level + d))]!;
}

/** Positive modulo. */
export const mod = (a: number, m: number): number => ((a % m) + m) % m;

/** Deterministic hash → [0, 1). */
export function hash(a: number, b = 0, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 100000) / 100000;
}

// --- Face-space modules ------------------------------------------------------------------------

/**
 * Module key colours: a fixed swatch, a Ramp5 lit by the face's light level (optionally
 * offset), or '-' to leave the underlying wall showing.
 */
export type ModKey = SwatchName | Ramp5 | { r: Ramp5; d: number };
export type ModKeys = Readonly<Record<string, ModKey>>;

export interface Module {
  g: KeyGrid;
  keys: ModKeys;
  /** Night colours for keys (e.g. glass glows) — keys not listed stay dark. */
  night?: Readonly<Record<string, SwatchName>>;
}

export function mod_(src: string, keys: ModKeys, night?: Module['night']): Module {
  return { g: keyGrid(src), keys, night };
}

export function keyColour(k: ModKey, level: number): SwatchName {
  if (typeof k === 'string') return k;
  if (Array.isArray(k)) return (k as Ramp5)[Math.max(0, Math.min(4, level))]!;
  const o = k as { r: Ramp5; d: number };
  return o.r[Math.max(0, Math.min(4, level + o.d))]!;
}

/**
 * Sample a module whose top-left lands at face column `c0` and face row `zTop` (z of the
 * module's first row). Returns the key char or null outside / transparent.
 */
export function sampleModule(m: Module, c: ShadeCtx, c0: number, zTop: number): string | null {
  const mx = c.fx - c0;
  const my = zTop - c.fz;
  if (mx < 0 || my < 0 || mx >= m.g.w || my >= m.g.h) return null;
  const k = m.g.rows[my]![mx]!;
  return k === '.' ? null : k;
}

/** Paint helper: colour of a module key at this pixel (day or night). */
export function moduleColour(m: Module, k: string, c: ShadeCtx): string | null {
  if (c.night) return m.night?.[k] ?? null;
  const spec = m.keys[k];
  if (spec === undefined) throw new Error(`module key "${k}" has no colour`);
  return keyColour(spec, c.level);
}

/** Repeat a module along a face every `pitch` columns starting at `start` (count times). */
export function repeatAt(
  c: ShadeCtx,
  m: Module,
  start: number,
  pitch: number,
  count: number,
  zTop: number,
): string | null {
  const rel = c.fx - start;
  if (rel < 0) return null;
  const n = Math.floor(rel / pitch);
  if (n >= count) return null;
  return sampleModule(m, c, start + n * pitch, zTop);
}
