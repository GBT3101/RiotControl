import { FLAG_H, type FlagDef } from '../types';

/** Austria: red-white-red. */
export const AUSTRIA: FlagDef = {
  h: FLAG_H,
  d: (_x, y) => (y >= 5 && y < 9 ? 'w' : 'r'),
};
