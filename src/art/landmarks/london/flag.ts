import { FLAG_H, FLAG_W, type FlagDef } from '../types';

/**
 * Union flag, pixel-authored for the 22×14 cloth (M13a): 2-px red St George cross with 1-px
 * white fimbriation; each quadrant is 9×5, so the saltire diagonals are clean 2:1 stairs
 * (1-px red over a 3-px white band) instead of thresholded distance fields that broke up into
 * noise once the columns were waved.
 */
export const UNION: FlagDef = {
  h: FLAG_H,
  d: (x, y) => {
    if (x === 10 || x === 11 || y === 6 || y === 7) return 'R';
    if (x === 9 || x === 12 || y === 5 || y === 8) return 'w';
    const u = x < 9 ? x : FLAG_W - 1 - x;
    const v = y < 5 ? y : FLAG_H - 1 - y;
    const line = Math.floor(u / 2);
    if (v === line) return 'R';
    if (Math.abs(v - line) === 1 || (u % 2 === 1 && v === line + 1)) return 'w';
    return 'b';
  },
};
