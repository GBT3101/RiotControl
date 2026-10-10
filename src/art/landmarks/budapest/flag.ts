import { FLAG_H, type FlagDef } from '../types';

/** Hungary: red-white-green horizontal tricolour. */
export const HUNGARY: FlagDef = {
  h: FLAG_H,
  d: (_x, y) => (y < 5 ? 'r' : y < 9 ? 'w' : 'g'),
};
