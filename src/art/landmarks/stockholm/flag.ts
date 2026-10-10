import { FLAG_H, type FlagDef } from '../types';

/** Sweden: blue with the yellow Nordic cross, upright set toward the hoist (7 · 2 · 13). */
export const SWEDEN: FlagDef = {
  h: FLAG_H,
  d: (x, y) => (x === 7 || x === 8 || y === 6 || y === 7 ? 'y' : 'b'),
};
