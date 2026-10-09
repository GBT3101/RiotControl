/**
 * Hand-drawn detail sprites used as billboards inside landmark scenes (lions, statues, lamps).
 */
import { grid } from '../lib/grid';
import type { PixelBuffer } from '../lib/pixels';
import { GUARD, LAMP, LAMP_NIGHT, LION, STATUE_SEATED, STATUE_STANDING } from './sprites.grid';

const BRONZE = { o: 'earth0', k: 'ink', d: 'earth1', m: 'earth2', l: 'earth3', h: 'ochre1' };

/** Congreso bronze lion; `toppled` lies on the ground, `headless` = decapitated (state 4). */
export function bronzeLion(toppled: boolean, headless = false): PixelBuffer {
  if (toppled) {
    // Knocked off its pedestal: lying on its back, legs in the air.
    const rows = LION.trim()
      .split('\n')
      .map((r) => r.trim())
      .reverse();
    return grid(rows.join('\n'), BRONZE, {}, 'lionToppled');
  }
  if (!headless) return grid(LION, BRONZE, {}, 'lion');
  // Knock the head off: clear the mane/head block and leave a jagged neck.
  const rows = LION.trim()
    .split('\n')
    .map((r) => r.trim());
  const cut = rows.map((r, y) =>
    r
      .split('')
      .map((ch, x) => (x < 9 && y < 9 ? (x === 8 && y > 3 ? 'o' : '.') : ch))
      .join(''),
  );
  return grid(cut.join('\n'), BRONZE, {}, 'lionHeadless');
}

export function lamp(broken: boolean): { img: PixelBuffer; night: PixelBuffer } {
  const img = grid(
    LAMP,
    { o: 'ink', y: broken ? 'gray1' : 'stone5', Y: broken ? 'ink' : 'white' },
    {},
    'lamp',
  );
  const night = grid(LAMP_NIGHT, { Y: 'ochre3', W: 'ochre4' }, {}, 'lampNight');
  return { img, night };
}

const MARBLE = { o: 'gray3', d: 'gray5', m: 'gray6', l: 'gray7', h: 'white' };
const STONE_STATUE = { o: 'stone0', d: 'stone1', m: 'stone2', l: 'stone3', h: 'stone5' };

/** Marble statue; `toppled` lies on its back (rows reversed + rotated feel). */
export function marbleStatue(
  kind: 'seated' | 'standing',
  toppled = false,
  stone = false,
): PixelBuffer {
  const src = kind === 'seated' ? STATUE_SEATED : STATUE_STANDING;
  const keys = stone ? STONE_STATUE : MARBLE;
  if (!toppled) return grid(src, keys, {}, `statue.${kind}`);
  // Lying on the ground: transpose the grid (figure falls toward the viewer-left).
  const rows = src
    .trim()
    .split('\n')
    .map((r) => r.trim());
  const h = rows.length;
  const w = rows[0]!.length;
  const out: string[] = [];
  for (let x = 0; x < w; x++) {
    let r = '';
    for (let y = h - 1; y >= 0; y--) r += rows[y]![x]!;
    out.push(r);
  }
  return grid(out.reverse().join('\n'), keys, {}, `statue.${kind}.toppled`);
}

const GOLD = { o: 'earth1', k: 'earth0', d: 'ochre1', m: 'ochre1', l: 'ochre2', h: 'ochre3' };
const BRONZE_FIG = {
  o: 'ink',
  k: 'ink',
  d: 'earth0',
  m: 'earth1',
  l: 'earth2',
  h: 'earth3',
  r: 'crim2',
};
const GREEN_BRONZE = { o: 'green0', k: 'ink', d: 'teal1', m: 'green2', l: 'green3', h: 'teal2' };

export type FigMaterial = 'marble' | 'gold' | 'bronze' | 'verdigris' | 'stone';
const FIG_KEYS: Record<FigMaterial, Record<string, string>> = {
  marble: { ...MARBLE, k: 'gray2', r: 'crim2' },
  gold: { ...GOLD, r: 'crim2' },
  bronze: BRONZE_FIG,
  verdigris: { ...GREEN_BRONZE, r: 'crim2' },
  stone: { ...STONE_STATUE, k: 'stone0', r: 'crim2' },
};

/** A statue sprite from sprites.grid.ts in the given material. */
export function figure(src: string, mat: FigMaterial, name = 'figure'): PixelBuffer {
  return grid(src, FIG_KEYS[mat], {}, name);
}

/** Queen's Guard sentry (fixed colours). */
export function guard(): PixelBuffer {
  return grid(GUARD, { o: 'ink', k: 'gray1', r: 'crim2' }, {}, 'guard');
}

export { CIBELES, NEPTUNE, VICTORY, CERVANTES, NELSON, CHURCHILL, LION } from './sprites.grid';
