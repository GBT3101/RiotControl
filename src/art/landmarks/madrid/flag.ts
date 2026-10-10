import { FLAG_H, type FlagDef } from '../types';

/** Spain: red-yellow-red with the coat of arms near the hoist. */
export const SPAIN: FlagDef = {
  h: FLAG_H,
  d: (x, y) => {
    if (y < 4 || y >= 11) return 'r';
    // Coat of arms near the hoist.
    if (x >= 4 && x <= 7 && y >= 5 && y <= 9) {
      if (x === 4 || x === 7) return y === 5 || y === 9 ? 'y' : 'o';
      return (x + y) % 2 === 0 ? 'R' : 'o';
    }
    return 'y';
  },
};
