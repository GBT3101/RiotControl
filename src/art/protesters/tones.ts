/**
 * Local tone ramps for protester variants (M4b).
 *
 * The global RIOT-64 `RAMPS` have uneven lengths, so protester parts use their own fixed-length
 * ramps built from palette swatches only. Part key maps reference them semantically as
 * `$slot.step` (e.g. `$top.2`), exactly like the shared paper-doll slots, but resolved here:
 *
 *   cloth ramps — 4 steps: 0 dark (folds / seams), 1 shade, 2 base, 3 light (sun, upper-left)
 *   skin  ramps — 3 steps: 0 shade, 1 base, 2 light
 *   hair  ramps — 3 steps: 0 shade, 1 base, 2 light
 *
 * Team language (art bible §3.5): protesters are warm and multicolour. Navy, hi-vis and olive
 * are the Ministry's colours, so they are absent (denim uses the zinc blue-greys instead).
 */
import type { SwatchName } from '../palette';

export type Tone = readonly SwatchName[];

export const CLOTH = {
  red: ['rust0', 'rust1', 'rust2', 'rust3'],
  scarlet: ['rust0', 'crim1', 'crim2', 'rust4'],
  orange: ['rust1', 'rust2', 'rust3', 'rust4'],
  mustard: ['earth3', 'ochre1', 'ochre2', 'ochre3'],
  yellow: ['ochre1', 'ochre2', 'ochre3', 'ochre4'],
  cream: ['stone2', 'stone3', 'stone4', 'stone5'],
  khaki: ['stone0', 'stone1', 'stone2', 'stone3'],
  brown: ['earth0', 'earth1', 'earth2', 'earth3'],
  tan: ['earth2', 'earth3', 'earth4', 'earth5'],
  forest: ['green0', 'green1', 'green2', 'green3'],
  green: ['green1', 'green2', 'green3', 'green4'],
  lime: ['green2', 'green3', 'green4', 'lime'],
  teal: ['zinc0', 'teal1', 'teal2', 'sky'],
  denim: ['zinc0', 'zinc1', 'zinc2', 'zinc3'],
  stonewash: ['zinc1', 'zinc2', 'zinc3', 'zinc4'],
  sky: ['zinc2', 'blue1', 'blue2', 'sky'],
  purple: ['plum0', 'plum1', 'purple', 'lilac'],
  plum: ['ink', 'plum0', 'plum1', 'purple'],
  pink: ['plum1', 'pink1', 'pink2', 'pink3'],
  magenta: ['plum0', 'plum1', 'pink1', 'pink2'],
  lilac: ['plum1', 'purple', 'lilac', 'pink3'],
  white: ['gray5', 'gray6', 'gray7', 'white'],
  grey: ['gray2', 'gray3', 'gray4', 'gray5'],
  charcoal: ['gray1', 'gray2', 'gray3', 'gray4'],
  black: ['ink', 'gray1', 'gray2', 'gray3'],
  maroon: ['earth0', 'rust0', 'rust1', 'rust2'],
  cult: ['rust0', 'rust1', 'rust2', 'ochre1'],
  ochre: ['earth2', 'earth3', 'ochre1', 'ochre2'],
  sack: ['stone0', 'stone1', 'stone2', 'stone3'],
  robe: ['gray5', 'gray6', 'gray7', 'white'],
  cardboard: ['earth3', 'stone2', 'stone3', 'stone4'],
  metal: ['gray1', 'zinc1', 'zinc2', 'zinc4'],
  wood: ['earth0', 'earth2', 'earth3', 'earth4'],
  cone: ['rust1', 'rust3', 'rust4', 'white'],
  foil: ['gray4', 'zinc3', 'zinc4', 'white'],
} as const satisfies Record<string, Tone>;
export type ClothTone = keyof typeof CLOTH;

/** Six skin tones, darkest → lightest (named after the shared skin1–skin6 ramps). */
export const SKIN = {
  skin1: ['earth1', 'earth2', 'earth3'],
  skin2: ['earth2', 'earth3', 'earth4'],
  skin3: ['earth3', 'earth4', 'earth5'],
  skin4: ['earth4', 'earth5', 'earth6'],
  skin5: ['earth5', 'earth6', 'earth7'],
  skin6: ['earth6', 'earth7', 'stone5'],
} as const satisfies Record<string, Tone>;
export type SkinTone = keyof typeof SKIN;
export const SKIN_TONES = Object.keys(SKIN) as SkinTone[];

export const HAIR = {
  black: ['ink', 'gray1', 'gray3'],
  darkBrown: ['earth0', 'earth1', 'earth2'],
  brown: ['earth1', 'earth2', 'earth3'],
  auburn: ['rust0', 'rust1', 'rust2'],
  ginger: ['rust1', 'rust2', 'rust3'],
  blonde: ['ochre1', 'ochre2', 'ochre3'],
  platinum: ['stone3', 'stone4', 'stone5'],
  grey: ['gray4', 'gray6', 'gray7'],
  white: ['gray6', 'gray7', 'white'],
  // Dyes (Violent Woke & friends).
  pink: ['pink1', 'pink2', 'pink3'],
  hotPink: ['plum1', 'pink1', 'pink2'],
  blue: ['blue1', 'blue2', 'sky'],
  purple: ['plum1', 'purple', 'lilac'],
  green: ['green3', 'green4', 'lime'],
  teal: ['teal1', 'teal2', 'sky'],
  orange: ['rust2', 'rust3', 'rust4'],
  red: ['crim1', 'crim2', 'rust4'],
} as const satisfies Record<string, Tone>;
export type HairTone = keyof typeof HAIR;
export const NATURAL_HAIR: readonly HairTone[] = [
  'black',
  'darkBrown',
  'brown',
  'auburn',
  'ginger',
  'blonde',
  'platinum',
  'grey',
];
export const DYED_HAIR: readonly HairTone[] = [
  'pink',
  'hotPink',
  'blue',
  'purple',
  'green',
  'teal',
  'orange',
  'red',
];

/** Slot name → tone ramp, resolved per variant. */
export type ToneMap = Readonly<Record<string, Tone>>;

/** Resolve one `$slot.step` reference against local tones (negative step = from the light end). */
export function toneSwatch(tones: ToneMap, slot: string, step: number): SwatchName {
  const r = tones[slot];
  if (!r) throw new Error(`protesters: tone slot "$${slot}" not set`);
  const i = step < 0 ? r.length + step : step;
  return r[Math.max(0, Math.min(r.length - 1, i))]!;
}

/** Resolve a key map's `$slot.step` values into plain swatch references. */
export function resolveToneKeys(
  keys: Readonly<Record<string, string>>,
  tones: ToneMap,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(keys)) {
    if (v.startsWith('$')) {
      const body = v.slice(1);
      const dot = body.lastIndexOf('.');
      const slot = dot > 0 ? body.slice(0, dot) : body;
      const step = dot > 0 ? Number(body.slice(dot + 1)) : 0;
      out[k] = toneSwatch(tones, slot, step);
    } else out[k] = v;
  }
  return out;
}
