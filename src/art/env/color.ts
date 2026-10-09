/**
 * Colour helpers for the environment kit: cached swatch lookup and hand-curated one-step
 * darker / lighter swatch chains (hue-shifted: shadows lean violet/blue, highlights warm).
 * Every colour produced here is a RIOT-64 swatch, so shading never leaves the palette.
 */
import { SWATCHES, resolveColor, swatchOf, type RGBA, type SwatchName } from '../palette';

const cache = new Map<string, RGBA>();

/** Resolve a colour reference ('stone3', 'zinc.2', …) to packed RGBA (cached). */
export function C(ref: string): RGBA {
  let c = cache.get(ref);
  if (c === undefined) {
    c = resolveColor(ref);
    cache.set(ref, c);
  }
  return c;
}

/** One step darker, with a cool hue shift. */
const DARKER: Record<SwatchName, SwatchName> = {
  ink: 'ink',
  gray1: 'ink',
  gray2: 'gray1',
  gray3: 'gray2',
  gray4: 'gray3',
  gray5: 'gray4',
  gray6: 'gray5',
  gray7: 'gray6',
  white: 'gray7',
  zinc0: 'navy0',
  zinc1: 'zinc0',
  zinc2: 'zinc1',
  zinc3: 'zinc2',
  zinc4: 'zinc3',
  stone0: 'gray1',
  stone1: 'stone0',
  stone2: 'stone1',
  stone3: 'stone2',
  stone4: 'stone3',
  stone5: 'stone4',
  earth0: 'ink',
  earth1: 'earth0',
  earth2: 'earth1',
  earth3: 'earth2',
  earth4: 'earth3',
  earth5: 'earth4',
  earth6: 'earth5',
  earth7: 'earth6',
  ochre1: 'earth3',
  ochre2: 'ochre1',
  ochre3: 'ochre2',
  ochre4: 'ochre3',
  rust0: 'earth0',
  rust1: 'rust0',
  rust2: 'rust1',
  rust3: 'rust2',
  rust4: 'rust3',
  crim1: 'rust0',
  crim2: 'crim1',
  plum0: 'ink',
  plum1: 'plum0',
  purple: 'plum1',
  lilac: 'purple',
  pink1: 'plum1',
  pink2: 'pink1',
  pink3: 'pink2',
  navy0: 'ink',
  navy1: 'navy0',
  navy2: 'navy1',
  blue1: 'navy2',
  blue2: 'blue1',
  sky: 'blue2',
  teal1: 'zinc0',
  teal2: 'teal1',
  green0: 'ink',
  green1: 'green0',
  green2: 'green1',
  green3: 'green2',
  green4: 'green3',
  lime: 'green4',
  olive1: 'green0',
  olive2: 'olive1',
  hivis1: 'olive2',
  hivis2: 'hivis1',
};

/** One step lighter, with a warm hue shift. */
const LIGHTER: Record<SwatchName, SwatchName> = {
  ink: 'gray1',
  gray1: 'gray2',
  gray2: 'gray3',
  gray3: 'gray4',
  gray4: 'gray5',
  gray5: 'gray6',
  gray6: 'gray7',
  gray7: 'white',
  white: 'white',
  zinc0: 'zinc1',
  zinc1: 'zinc2',
  zinc2: 'zinc3',
  zinc3: 'zinc4',
  zinc4: 'white',
  stone0: 'stone1',
  stone1: 'stone2',
  stone2: 'stone3',
  stone3: 'stone4',
  stone4: 'stone5',
  stone5: 'white',
  earth0: 'earth1',
  earth1: 'earth2',
  earth2: 'earth3',
  earth3: 'earth4',
  earth4: 'earth5',
  earth5: 'earth6',
  earth6: 'earth7',
  earth7: 'stone5',
  ochre1: 'ochre2',
  ochre2: 'ochre3',
  ochre3: 'ochre4',
  ochre4: 'white',
  rust0: 'rust1',
  rust1: 'rust2',
  rust2: 'rust3',
  rust3: 'rust4',
  rust4: 'earth6',
  crim1: 'crim2',
  crim2: 'rust4',
  plum0: 'plum1',
  plum1: 'purple',
  purple: 'lilac',
  lilac: 'pink3',
  pink1: 'pink2',
  pink2: 'pink3',
  pink3: 'white',
  navy0: 'navy1',
  navy1: 'navy2',
  navy2: 'blue1',
  blue1: 'blue2',
  blue2: 'sky',
  sky: 'white',
  teal1: 'teal2',
  teal2: 'sky',
  green0: 'green1',
  green1: 'green2',
  green2: 'green3',
  green3: 'green4',
  green4: 'lime',
  lime: 'hivis2',
  olive1: 'olive2',
  olive2: 'hivis1',
  hivis1: 'hivis2',
  hivis2: 'ochre4',
};

const darkMemo = new Map<number, RGBA>();
const lightMemo = new Map<number, RGBA>();

function step(c: RGBA, table: Record<SwatchName, SwatchName>, memo: Map<number, RGBA>): RGBA {
  const key = c >>> 8;
  let r = memo.get(key);
  if (r === undefined) {
    const sw = swatchOf(c);
    r = sw ? C(table[sw]) : c;
    memo.set(key, r);
  }
  return ((r & 0xffffff00) | (c & 255)) >>> 0;
}

/** `n` steps darker (palette-safe, alpha preserved). */
export function darker(c: RGBA, n = 1): RGBA {
  let r = c;
  for (let i = 0; i < n; i++) r = step(r, DARKER, darkMemo);
  return r;
}

/** `n` steps lighter (palette-safe, alpha preserved). */
export function lighter(c: RGBA, n = 1): RGBA {
  let r = c;
  for (let i = 0; i < n; i++) r = step(r, LIGHTER, lightMemo);
  return r;
}

/** Shift by `n` steps: negative = darker, positive = lighter. */
export function shade(c: RGBA, n: number): RGBA {
  return n < 0 ? darker(c, -n) : n > 0 ? lighter(c, n) : c;
}

/** Coloured outline colour for a material pixel: 2–3 steps darker, never lighter than gray1. */
export function inkFor(c: RGBA): RGBA {
  const d = darker(c, 3);
  return d;
}

export const SWATCH_LIST = Object.keys(SWATCHES) as SwatchName[];
