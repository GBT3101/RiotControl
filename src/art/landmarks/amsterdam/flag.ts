import { FLAG_H, type FlagDef } from '../types';

/** The Netherlands: red-white-blue horizontal bands (5 · 4 · 5). */
export const NETHERLANDS: FlagDef = {
  h: FLAG_H,
  d: (_x, y) => (y < 5 ? 'r' : y < 9 ? 'w' : 'b'),
};
