/**
 * RIOT-64 — the master palette (art bible §3.2).
 *
 * 64 named swatches, organised as hue-shifted families: shadows lean cool (violet / blue),
 * highlights lean warm (cream / yellow). Named **ramps** (darkest → lightest) index into the
 * swatches and freely share them; every sprite must use swatches only (enforced by
 * tests/palette-compliance.test.ts). The single exception is the `shadow` swatch drawn at
 * partial alpha in shadow layers.
 *
 * Colour references used by sprite key maps (see lib/grid.ts):
 *   'ink'        a swatch by name
 *   'navy.2'     ramp `navy`, step 2 (0 = darkest). Negative steps count from the light end:
 *                'navy.-1' = lightest. Out-of-range steps clamp.
 *   '#rrggbb'    raw hex — allowed by the parser but rejected by the compliance test unless
 *                it is a palette swatch.
 */

/** The 64 swatches. Order = display order in the gallery palette strip. */
export const SWATCHES = {
  // Violet-greys: outlines, asphalt, concrete, kerbs.
  ink: '#1a1424',
  gray1: '#2b2538',
  gray2: '#3d364b',
  gray3: '#524b60',
  gray4: '#6a6476',
  gray5: '#857f8e',
  gray6: '#a39ea8',
  gray7: '#c4bfc0',
  white: '#f7f1e6',
  // Cool blue-greys: zinc, slate, metal, glass.
  zinc0: '#26304a',
  zinc1: '#3a4a68',
  zinc2: '#586c8a',
  zinc3: '#8296ae',
  zinc4: '#b6c6d2',
  // Warm stones: limestone, Portland, paving, sackcloth, parchment.
  stone0: '#4c3c4b',
  stone1: '#706061',
  stone2: '#988676',
  stone3: '#bea990',
  stone4: '#ddcdab',
  stone5: '#f3e8c8',
  // Earth ladder: skin tones, natural hair, wood, ochre shadows.
  earth0: '#2d1a24',
  earth1: '#4b2a2e',
  earth2: '#6c3e36',
  earth3: '#8f5840',
  earth4: '#b37352',
  earth5: '#d39470',
  earth6: '#ebb791',
  earth7: '#f8dbbf',
  // Ochre / brass / blonde / flame.
  ochre1: '#b98132',
  ochre2: '#dca848',
  ochre3: '#f3d46e',
  ochre4: '#fff3ad',
  // Rust: brick, terracotta, auburn, embers.
  rust0: '#561e32',
  rust1: '#873036',
  rust2: '#b4483b',
  rust3: '#da6c45',
  rust4: '#f19a62',
  // Crimson: cartoon blood, Ministry red.
  crim1: '#a1203c',
  crim2: '#e03c44',
  // Plum / purple / pink: dyed hair, garish clothes, neon.
  plum0: '#3a1d4a',
  plum1: '#682c78',
  purple: '#9a52c4',
  lilac: '#c890ea',
  pink1: '#c23e88',
  pink2: '#f06ca8',
  pink3: '#ffb4cf',
  // Navy / blue: police, water, glass, blue dye.
  navy0: '#151b38',
  navy1: '#212d5c',
  navy2: '#2f4488',
  blue1: '#3e6cc2',
  blue2: '#5c9ce2',
  sky: '#a0d4f2',
  // Teal.
  teal1: '#1d7e86',
  teal2: '#3cc8b4',
  // Greens: foliage, grass, green dye, gas.
  green0: '#13292e',
  green1: '#1c4a35',
  green2: '#2e6438',
  green3: '#4a8a3a',
  green4: '#82b44a',
  lime: '#c6e35c',
  // Olive / hi-vis: army, safety vests.
  olive1: '#565c30',
  olive2: '#858a3c',
  hivis1: '#c8d63a',
  hivis2: '#f0f56c',
} as const;

export type SwatchName = keyof typeof SWATCHES;

/** Named ramps, darkest → lightest. Ramps share swatches freely. */
export const RAMPS = {
  // --- Ground & city materials ---
  asphalt: ['ink', 'gray1', 'gray2', 'gray3', 'gray4'],
  kerb: ['gray3', 'gray5', 'gray6', 'gray7', 'white'],
  sidewalk: ['stone0', 'gray4', 'gray5', 'gray6', 'gray7'],
  cobble: ['gray2', 'stone0', 'stone1', 'stone2', 'stone3'],
  plaza: ['stone1', 'stone2', 'stone3', 'stone4', 'stone5'],
  madridOchre: ['earth2', 'earth3', 'ochre1', 'ochre2', 'ochre3'],
  madridTerracotta: ['rust0', 'rust1', 'rust2', 'rust3', 'rust4'],
  londonBrick: ['earth0', 'rust0', 'rust1', 'rust2', 'rust3'],
  portlandStone: ['stone1', 'gray6', 'gray7', 'stone4', 'white'],
  slate: ['ink', 'gray1', 'zinc0', 'zinc1', 'zinc2'],
  parisLimestone: ['stone1', 'stone2', 'stone3', 'stone4', 'stone5'],
  zinc: ['zinc0', 'zinc1', 'zinc2', 'zinc3', 'zinc4'],
  wood: ['earth0', 'earth1', 'earth2', 'earth3', 'earth4'],
  foliage: ['green0', 'green1', 'green2', 'green3', 'green4'],
  grass: ['green1', 'green2', 'green3', 'green4', 'lime'],
  water: ['navy0', 'navy1', 'zinc1', 'teal1', 'blue2', 'sky'],
  metal: ['gray1', 'zinc1', 'zinc2', 'zinc3', 'zinc4', 'white'],
  glass: ['navy1', 'zinc2', 'blue2', 'sky', 'white'],
  // --- People ---
  skin1: ['earth0', 'earth1', 'earth2'],
  skin2: ['earth1', 'earth2', 'earth3'],
  skin3: ['earth2', 'earth3', 'earth4'],
  skin4: ['earth3', 'earth4', 'earth5'],
  skin5: ['earth4', 'earth5', 'earth6'],
  skin6: ['earth5', 'earth6', 'earth7'],
  hairBlack: ['ink', 'gray1', 'gray3'],
  hairBrown: ['earth0', 'earth1', 'earth2'],
  hairAuburn: ['rust0', 'rust1', 'rust2'],
  hairBlonde: ['earth3', 'ochre1', 'ochre2', 'ochre3'],
  hairGrey: ['gray4', 'gray6', 'gray7'],
  dyePink: ['plum1', 'pink1', 'pink2', 'pink3'],
  dyeBlue: ['navy2', 'blue1', 'blue2', 'sky'],
  dyePurple: ['plum0', 'plum1', 'purple', 'lilac'],
  dyeGreen: ['green1', 'green3', 'green4', 'lime'],
  dyeTeal: ['zinc0', 'teal1', 'teal2', 'sky'],
  // --- Factions ---
  navy: ['ink', 'navy0', 'navy1', 'navy2', 'blue1'],
  hivis: ['olive2', 'hivis1', 'hivis2'],
  olive: ['green0', 'olive1', 'olive2', 'stone3'],
  sackcloth: ['stone0', 'stone1', 'stone2', 'stone3'],
  cultRed: ['rust0', 'rust1', 'rust2', 'ochre1'],
  whiteRobe: ['gray5', 'gray6', 'gray7', 'white'],
  // --- FX ---
  fire: ['rust1', 'rust3', 'ochre2', 'ochre3', 'ochre4'],
  gas: ['olive1', 'olive2', 'green4', 'lime', 'stone5'],
  blood: ['rust0', 'crim1', 'crim2'],
  smoke: ['gray2', 'gray4', 'gray5', 'gray6', 'gray7'],
  // --- UI: "The Ministry Dossier" ---
  parchment: ['stone1', 'stone2', 'stone3', 'stone4', 'stone5'],
  manila: ['earth3', 'ochre1', 'stone3', 'stone4', 'stone5'],
  brass: ['earth1', 'earth3', 'ochre1', 'ochre2', 'ochre3', 'ochre4'],
  ministryRed: ['rust0', 'crim1', 'crim2', 'rust4'],
  night: ['ink', 'navy0', 'navy1'],
} as const satisfies Record<string, readonly SwatchName[]>;

export type RampName = keyof typeof RAMPS;

/** Exterior outline colour for characters (never pure black). */
export const INK: SwatchName = 'ink';
/** Swatch used (only) for semi-transparent shadow layers. */
export const SHADOW: SwatchName = 'ink';
/** Standard alpha of blob / cast shadows (0..255). */
export const SHADOW_ALPHA = 115; // ≈ 45%
/** Night tint swatch for colour grading. */
export const NIGHT_TINT: SwatchName = 'navy0';

/** Packed colour: 0xRRGGBBAA as an unsigned 32-bit number. */
export type RGBA = number;

export function hexToRgba(hex: string, alpha = 255): RGBA {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Bad hex colour: ${hex}`);
  return ((parseInt(h, 16) << 8) | (alpha & 255)) >>> 0;
}

export function rgbaToHex(c: RGBA): string {
  return '#' + (c >>> 8).toString(16).padStart(6, '0');
}

export const SWATCH_NAMES = Object.keys(SWATCHES) as SwatchName[];
/** Flat list of the 64 hex colours. */
export const PALETTE_HEX: readonly string[] = SWATCH_NAMES.map((n) => SWATCHES[n]);
/** Set of opaque packed RGB (alpha stripped, i.e. 0xRRGGBB) palette colours. */
export const PALETTE_RGB: ReadonlySet<number> = new Set(
  PALETTE_HEX.map((h) => parseInt(h.slice(1), 16)),
);

/** Swatch name for a packed colour, if it is in the palette. */
export function swatchOf(c: RGBA): SwatchName | undefined {
  const rgb = c >>> 8;
  return SWATCH_NAMES.find((n) => parseInt(SWATCHES[n].slice(1), 16) === rgb);
}

export function isRampName(name: string): name is RampName {
  return Object.prototype.hasOwnProperty.call(RAMPS, name);
}

export function isSwatchName(name: string): name is SwatchName {
  return Object.prototype.hasOwnProperty.call(SWATCHES, name);
}

/** Swatch of `ramp` at `step` (negative = from the light end, clamped). */
export function rampSwatch(ramp: RampName, step: number): SwatchName {
  const r: readonly SwatchName[] = RAMPS[ramp];
  const i = step < 0 ? r.length + step : step;
  return r[Math.max(0, Math.min(r.length - 1, i))] as SwatchName;
}

/**
 * Resolve a colour reference ('ink', 'navy.2', 'navy.-1', '#aabbcc') to packed RGBA.
 * Throws on unknown names so typos fail loudly at boot / in tests.
 */
export function resolveColor(ref: string, alpha = 255): RGBA {
  if (ref.startsWith('#')) return hexToRgba(ref, alpha);
  if (isSwatchName(ref)) return hexToRgba(SWATCHES[ref], alpha);
  const dot = ref.lastIndexOf('.');
  if (dot > 0) {
    const ramp = ref.slice(0, dot);
    const step = Number(ref.slice(dot + 1));
    if (isRampName(ramp) && Number.isInteger(step)) {
      return hexToRgba(SWATCHES[rampSwatch(ramp, step)], alpha);
    }
  }
  throw new Error(`Unknown colour reference: "${ref}"`);
}

/** Lookup: palette colour → the ramp(s) it belongs to (for ramp-aware outlines/recolours). */
export function rampsContaining(swatch: SwatchName): RampName[] {
  return (Object.keys(RAMPS) as RampName[]).filter((r) =>
    (RAMPS[r] as readonly SwatchName[]).includes(swatch),
  );
}
