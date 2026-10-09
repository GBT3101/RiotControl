/**
 * 2D stamps for vehicles: stencils, micro-font text, flames, smoke, dust and muzzle flashes.
 */
import { grid, keyGrid, renderKeys, sheet, type KeyMap } from '../lib/grid';
import { createBuffer, setPixel, type PixelBuffer } from '../lib/pixels';
import { resolveColor } from '../palette';
import {
  CHEVRON,
  CROSS,
  FLAME_L,
  FLAME_S,
  MICRO_FONT,
  PUFF_L,
  PUFF_M,
  PUFF_S,
  RATP,
  ROUNDEL,
  STAR,
} from './stamps.grid';

const FIRE: KeyMap = { r: 'rust1', o: 'rust3', y: 'ochre2', Y: 'ochre3', W: 'ochre4' };
const SMOKE_DARK: KeyMap = { a: 'gray3', b: 'gray2', c: 'gray1', d: 'ink' };
const SMOKE_GREY: KeyMap = { a: 'gray6', b: 'gray5', c: 'gray4', d: 'gray3' };
const SMOKE_LIGHT: KeyMap = { a: 'gray7', b: 'gray6', c: 'gray5', d: 'gray4' };
const DUST: KeyMap = { a: 'stone4', b: 'stone3', c: 'stone2', d: 'stone1' };

export const FLAMES_L = sheet(FLAME_L, FIRE, {}, 'flameL');
export const FLAMES_S = sheet(FLAME_S, FIRE, {}, 'flameS');

export type PuffTone = 'dark' | 'grey' | 'light' | 'dust';
const TONES: Record<PuffTone, KeyMap> = {
  dark: SMOKE_DARK,
  grey: SMOKE_GREY,
  light: SMOKE_LIGHT,
  dust: DUST,
};
export function puff(size: 's' | 'm' | 'l', tone: PuffTone): PixelBuffer {
  const src = size === 's' ? PUFF_S : size === 'm' ? PUFF_M : PUFF_L;
  return grid(src, TONES[tone], {}, `puff.${size}`);
}

const WHITE: KeyMap = { W: 'gray7' };
export const STENCILS = {
  star: grid(STAR, WHITE, {}, 'star'),
  chevron: grid(CHEVRON, WHITE, {}, 'chevron'),
  cross: grid(CROSS, { R: 'crim2' }, {}, 'cross'),
  ratp: grid(RATP, { T: 'teal2' }, {}, 'ratp'),
  roundel: grid(ROUNDEL, { R: 'crim2', B: 'navy1' }, {}, 'roundel'),
};

/** Micro-font lettering (3×5 glyphs, 1 px tracking) in one swatch; `cells` maps each column to its glyph's first column (decals step
 *  whole glyphs along a slanted face — see Decal.cells). */
export function text(s: string, colour = 'white'): PixelBuffer & { cells: number[] } {
  const glyphs = [...s.toUpperCase()].map((ch) => {
    const g = MICRO_FONT[ch];
    if (!g) throw new Error(`micro font: no glyph "${ch}"`);
    return renderKeys(keyGrid(g, `glyph ${ch}`), { W: colour });
  });
  const w = glyphs.reduce((a, g) => a + g.w + 1, -1);
  const out = createBuffer(Math.max(1, w), 5);
  const cells: number[] = [];
  let x = 0;
  for (const g of glyphs) {
    for (let i = 0; i <= g.w; i++) cells[x + i] = x;
    for (let y = 0; y < g.h; y++)
      for (let gx = 0; gx < g.w; gx++) {
        if (g.data[(y * g.w + gx) * 4 + 3] === 255) setPixel(out, x + gx, y, resolveColor(colour));
      }
    x += g.w + 1;
  }
  return Object.assign(out, { cells: cells.slice(0, out.w) });
}

/** Solid w×h block in one colour (stripes, number plates). */
export function block(w: number, h: number, colour: string): PixelBuffer {
  const out = createBuffer(w, h);
  const c = resolveColor(colour);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) setPixel(out, x, y, c);
  return out;
}

/** Battenburg chequer (hi-vis / blue or green) w×h with cell size `c`. */
export function battenburg(w: number, h: number, a: string, b: string, c = 2): PixelBuffer {
  const out = createBuffer(w, h);
  const ca = resolveColor(a);
  const cb = resolveColor(b);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      setPixel(out, x, y, (Math.floor(x / c) + Math.floor(y / c)) % 2 ? cb : ca);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Muzzle flashes: star bursts drawn along a screen direction (hand-tuned shape rules).
// ---------------------------------------------------------------------------------------------

/**
 * Muzzle flash pointing along screen vector (dx, dy). `size` 1 = MG, 2 = tank cannon.
 * `phase` 0 = full burst, 1 = fading. Returns the image and the pixel that sits on the muzzle.
 */
export function muzzleFlash(
  dx: number,
  dy: number,
  size: 1 | 2,
  phase: 0 | 1,
): { img: PixelBuffer; origin: { x: number; y: number } } {
  const R = size === 1 ? 7 : 13;
  const W = R * 2 + 1;
  const img = createBuffer(W, W);
  const l = Math.hypot(dx, dy) || 1;
  const fx = dx / l;
  const fy = dy / l;
  const core = resolveColor('white');
  const hot = resolveColor('ochre4');
  const mid = resolveColor('ochre3');
  const out = resolveColor('ochre2');
  const rim = resolveColor('rust3');
  // Spikes: forward main, two side petals at ±50°, small back-side sparks.
  const spikes: Array<[number, number]> =
    size === 1
      ? phase === 0
        ? [
            [0, 6.2],
            [50, 3.2],
            [-50, 3.2],
            [125, 1.8],
            [-125, 1.8],
          ]
        : [
            [0, 3.8],
            [60, 2.0],
            [-60, 2.0],
          ]
      : phase === 0
        ? [
            [0, 12],
            [38, 7],
            [-38, 7],
            [90, 4.5],
            [-90, 4.5],
            [140, 2.6],
            [-140, 2.6],
          ]
        : [
            [0, 7],
            [45, 4.5],
            [-45, 4.5],
            [100, 2.6],
            [-100, 2.6],
          ];
  const coreR = size === 1 ? (phase === 0 ? 1.6 : 1.1) : phase === 0 ? 3.2 : 2.2;
  const off = size === 1 ? 1.2 : 2.5; // flash centre sits slightly in front of the muzzle
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const px = x - R - fx * off;
      const py = (y - R - fy * off) * 1.15;
      const d = Math.hypot(px, py);
      let v = d <= coreR ? 1 - d / (coreR * 3) : 0;
      const ang = Math.atan2(py, px);
      for (const [deg, len] of spikes) {
        const a = Math.atan2(fy, fx) + (deg * Math.PI) / 180;
        let da = Math.abs(ang - a);
        if (da > Math.PI) da = 2 * Math.PI - da;
        const width = size === 1 ? 0.42 : 0.3;
        if (d <= len && da < width * (1 - d / (len + 0.8)))
          v = Math.max(v, 0.85 - (d / len) * 0.75);
      }
      if (v <= 0.02) continue;
      const c = v > 0.8 ? core : v > 0.6 ? hot : v > 0.4 ? mid : v > 0.22 ? out : rim;
      setPixel(img, x, y, phase === 1 && c === core ? hot : c);
    }
  }
  return { img, origin: { x: R, y: R } };
}
