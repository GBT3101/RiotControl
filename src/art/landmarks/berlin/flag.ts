import { FLAG_H, type FlagDef } from '../types';

/** Germany: black-red-gold horizontal bands (14 rows: 5 · 4 · 5). */
export const GERMANY: FlagDef = {
  h: FLAG_H,
  d: (_x, y) => (y < 5 ? 'K' : y < 9 ? 'r' : 'y'),
};
