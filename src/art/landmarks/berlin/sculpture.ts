/**
 * Berlin sculpture billboards: the Quadriga (four horses composed from one hand-drawn horse,
 * far horses a step darker) and Goldelse.
 */
import type { PixelBuffer } from '../../lib/pixels';
import { grid } from '../../lib/grid';
import { figure } from '../props';
import { GOLDELSE, QUADRIGA_HORSE, QUADRIGA_STAFF, QUADRIGA_VICTORIA } from './sprites.grid';

const rows = (src: string): string[] =>
  src
    .trim()
    .split('\n')
    .map((r) => r.trim());

/** Stamp `src` rows into `dst` at (ox, oy), remapping keys (opaque pixels only). */
function stamp(
  dst: string[][],
  src: string,
  ox: number,
  oy: number,
  remap: Record<string, string> = {},
): void {
  rows(src).forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const k = r[x]!;
      if (k === '.') continue;
      const row = dst[oy + y];
      if (!row || ox + x >= row.length) continue;
      row[ox + x] = remap[k] ?? k;
    }
  });
}

/** Quadriga, frontal: four horses abreast, winged Victoria behind, her staff to the left. */
export function quadriga(): PixelBuffer {
  const W = 26;
  const H = 23;
  const g: string[][] = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  stamp(g, QUADRIGA_VICTORIA, 6, 2);
  for (const [k, x] of [1, 7, 13, 19].entries()) {
    stamp(g, QUADRIGA_HORSE, x, 10 + (k % 2), k % 3 === 0 ? {} : { h: 'l' });
  }
  for (let y = 5; y < 14; y++) g[y]![3] = 'o';
  stamp(g, QUADRIGA_STAFF, 1, 0);
  return grid(g.map((r) => r.join('')).join('\n'), COPPER, {}, 'quadriga');
}

/** Pale copper-green patina (Quadriga). */
const COPPER = { o: 'green0', k: 'ink', d: 'green1', m: 'teal1', l: 'teal2', h: 'sky' };

export function goldelse(): PixelBuffer {
  return figure(GOLDELSE, 'gold', 'goldelse');
}
