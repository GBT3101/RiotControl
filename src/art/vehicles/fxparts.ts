/**
 * Animated 2D effects attached to vehicle models as overlays: smoke columns, fires.
 * All loops are 4 frames.
 */
import type { Model, V3 } from './render3d';
import { FLAMES_L, FLAMES_S, puff, type PuffTone } from './stamps';

const PUFFS = {
  dark: [puff('s', 'dark'), puff('m', 'dark'), puff('l', 'dark')],
  grey: [puff('s', 'grey'), puff('m', 'grey'), puff('l', 'grey')],
  light: [puff('s', 'light'), puff('m', 'light'), puff('l', 'light')],
  dust: [puff('s', 'dust'), puff('m', 'dust'), puff('l', 'dust')],
} satisfies Record<PuffTone, unknown>;

/**
 * Rising smoke column from `base` (model space): `n` puffs 4 px apart that rise 1 px per frame
 * and drift right with the wind, growing as they rise. Seamless over 4 frames.
 */
export function smokeColumn(m: Model, base: V3, frame: number, tone: PuffTone, n = 3, spacing = 4): void {
  const set = PUFFS[tone];
  for (let k = n - 1; k >= 0; k--) {
    const h = k * spacing + ((frame % 4) * spacing) / 4;
    const img = set[Math.min(2, Math.floor((k * 3) / n + 0.34))]!;
    m.overlay({
      at: base,
      img,
      origin: { x: img.w >> 1, y: img.h - 1 },
      dy: -Math.round(h),
      dx: Math.round(h * 0.35) + (k % 2 === 0 ? 0 : 1),
      front: true,
    });
  }
}

/** Flame tongue at `at` (model space); big or small, frame-shifted by `shift`. */
export function flame(m: Model, at: V3, frame: number, big = true, shift = 0, front = false): void {
  const set = big ? FLAMES_L : FLAMES_S;
  const img = set[(frame + shift) % 4]!;
  m.overlay({ at, img, origin: { x: img.w >> 1, y: img.h - 1 }, front });
}
