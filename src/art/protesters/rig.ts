/**
 * Protester rig (M4b): low-level compositing helpers shared by the figure builder.
 *
 * Coordinates: every frame is composed on a WORK canvas with the ground point (between the
 * feet, sole row) at (GX, GY). Parts attach through origins/anchors (see book.ts).
 */
import { renderKeys, type KeyMap } from '../lib/grid';
import { blit, createBuffer, type PixelBuffer, type Point } from '../lib/pixels';
import { resolveToneKeys, type ToneMap } from './tones';
import type { PartDef } from './book';

export const WORK_W = 64;
export const WORK_H = 64;
export const GX = 32;
export const GY = 46;

/** Shared key alphabet of body / hair / headwear / face parts ($slot.step → local tones). */
export const BODY_KEYS: Readonly<Record<string, string>> = {
  // skin
  S: '$skin.1',
  s: '$skin.0',
  L: '$skin.2',
  e: 'ink',
  o: 'rust0',
  // hair
  H: '$hair.1',
  h: '$hair.0',
  G: '$hair.2',
  // top
  d: '$top.0',
  t: '$top.1',
  T: '$top.2',
  U: '$top.3',
  // forearm: sleeve or bare skin
  f: '$fore.1',
  F: '$fore.2',
  // accent (shirt under jacket, stripes, trims, belt)
  a: '$acc.1',
  A: '$acc.2',
  V: '$acc.3',
  // bottoms + shins (shin = bottoms or skin for shorts / skirts)
  q: '$bot.0',
  p: '$bot.1',
  P: '$bot.2',
  Q: '$bot.3',
  j: '$shin.1',
  J: '$shin.2',
  // shoes, W = sole
  b: '$shoe.1',
  B: '$shoe.2',
  W: '$sole.2',
  // headwear
  z: '$hat.0',
  n: '$hat.1',
  M: '$hat.2',
  N: '$hat.3',
  // fixed
  k: 'ink',
  w: 'white',
  g: 'gray5',
  Y: 'ochre3',
  x: 'rust2',
};

/** Arms: sleeves come from the `sleeve` slot (a vest's sleeves are the shirt's). */
export const ARM_KEYS: Readonly<Record<string, string>> = {
  ...BODY_KEYS,
  t: '$sleeve.1',
  T: '$sleeve.2',
};

/** Torso / back gear (backpacks, totes, straps, boards). */
export const GEAR_KEYS: Readonly<Record<string, string>> = {
  X: '$gear.2',
  x: '$gear.1',
  Z: '$gear.3',
  y: '$gear.0',
  g: 'green3',
  k: 'ink',
  w: 'white',
  R: 'crim2',
  r: 'crim1',
  c: 'stone3',
  C: 'stone4',
};

/** Held items. */
export const ITEM_KEYS: Readonly<Record<string, string>> = {
  I: '$item.2',
  i: '$item.1',
  Y: '$item.3',
  y: '$item.0',
  O: 'earth4',
  o: 'earth3',
  m: 'zinc3',
  M: 'zinc2',
  w: 'white',
  k: 'ink',
  g: 'green3',
  G: 'green4',
  b: 'gray2',
  B: 'gray3',
  c: 'stone3',
  C: 'stone4',
  R: 'crim2',
  r: 'crim1',
  f: 'ochre4',
  F: 'ochre3',
  x: 'rust3',
};

export interface Placed {
  part: PartDef;
  /** Work-canvas position of the part origin. */
  at: Point;
  z: number;
  keys?: Readonly<Record<string, string>>;
  /** Alternative tones for pixels at work x ≥ fromX (split-dye hair). */
  split?: { tones: ToneMap; fromX: number };
}

export function anchorAt(p: Placed, name: string, fallback?: Point): Point {
  const a = p.part.anchors[name] ?? fallback;
  if (!a) throw new Error(`protesters: part "${p.part.name}" has no anchor "${name}"`);
  return { x: p.at.x + a.x - p.part.origin.x, y: p.at.y + a.y - p.part.origin.y };
}

const keyCache = new WeakMap<ToneMap, Map<Readonly<Record<string, string>>, KeyMap>>();
function keysFor(keys: Readonly<Record<string, string>>, tones: ToneMap): KeyMap {
  let m = keyCache.get(tones);
  if (!m) keyCache.set(tones, (m = new Map()));
  let k = m.get(keys);
  if (!k) m.set(keys, (k = resolveToneKeys(keys, tones)));
  return k;
}

/** Draw placed parts (stable-sorted by z) onto a fresh work canvas. */
export function drawParts(parts: readonly Placed[], tones: ToneMap): PixelBuffer {
  const out = createBuffer(WORK_W, WORK_H);
  const sorted = parts.map((p, i) => ({ p, i })).sort((a, b) => a.p.z - b.p.z || a.i - b.i);
  for (const { p } of sorted) {
    const keys = p.keys ?? BODY_KEYS;
    const x0 = p.at.x - p.part.origin.x;
    const y0 = p.at.y - p.part.origin.y;
    const img = renderKeys(p.part.grid, keysFor(keys, tones), {}, p.part.name);
    if (p.split) {
      const alt = renderKeys(p.part.grid, keysFor(keys, p.split.tones), {}, p.part.name);
      const cut = p.split.fromX - x0;
      for (let y = 0; y < img.h; y++) {
        for (let x = Math.max(0, cut); x < img.w; x++) {
          const i = (y * img.w + x) * 4;
          img.data[i] = alt.data[i]!;
          img.data[i + 1] = alt.data[i + 1]!;
          img.data[i + 2] = alt.data[i + 2]!;
        }
      }
    }
    blit(out, img, x0, y0);
  }
  return out;
}

/** Rotate a buffer 90° clockwise (pixel-exact). */
export function rotCW(src: PixelBuffer): PixelBuffer {
  const out = createBuffer(src.h, src.w);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const si = (y * src.w + x) * 4;
      const di = (x * out.w + (src.h - 1 - y)) * 4;
      for (let k = 0; k < 4; k++) out.data[di + k] = src.data[si + k]!;
    }
  }
  return out;
}

/** Rotate a buffer 90° counter-clockwise (pixel-exact). */
export function rotCCW(src: PixelBuffer): PixelBuffer {
  const out = createBuffer(src.h, src.w);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const si = (y * src.w + x) * 4;
      const di = ((src.w - 1 - x) * out.w + y) * 4;
      for (let k = 0; k < 4; k++) out.data[di + k] = src.data[si + k]!;
    }
  }
  return out;
}

/**
 * Shear rows horizontally around the ground row: row y moves by round((GY - y) * k) px
 * (k > 0 leans right). Pixel-exact (rows are shifted, never resampled).
 */
export function shearRows(src: PixelBuffer, k: number, pivotY = GY): PixelBuffer {
  const out = createBuffer(src.w, src.h);
  for (let y = 0; y < src.h; y++) {
    const dx = Math.round((pivotY - y) * k);
    for (let x = 0; x < src.w; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= src.w) continue;
      const si = (y * src.w + x) * 4;
      const di = (y * src.w + tx) * 4;
      for (let c = 0; c < 4; c++) out.data[di + c] = src.data[si + c]!;
    }
  }
  return out;
}

/** Drop every n-th row above the pivot (vertical squash for falling / lying poses). */
export function squashRows(src: PixelBuffer, every: number, pivotY = GY): PixelBuffer {
  const out = createBuffer(src.w, src.h);
  let ty = pivotY;
  for (let y = pivotY; y >= 0; y--) {
    if (y < pivotY && (pivotY - y) % every === 0) continue;
    for (let x = 0; x < src.w; x++) {
      const si = (y * src.w + x) * 4;
      const di = (ty * src.w + x) * 4;
      for (let c = 0; c < 4; c++) out.data[di + c] = src.data[si + c]!;
    }
    ty--;
  }
  for (let y = pivotY + 1; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const si = (y * src.w + x) * 4;
      for (let c = 0; c < 4; c++) out.data[si + c] = src.data[si + c]!;
    }
  }
  return out;
}

/** Move the whole buffer by (dx, dy). */
export function shift(src: PixelBuffer, dx: number, dy: number): PixelBuffer {
  const out = createBuffer(src.w, src.h);
  blit(out, src, dx, dy);
  return out;
}
