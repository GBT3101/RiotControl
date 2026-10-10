import { FLAG_H, FLAG_W, type FlagDef } from '../types';

/** Czech Republic: white over red with the blue wedge reaching the middle of the cloth. */
export const CZECHIA: FlagDef = {
  h: FLAG_H,
  d: (x, y) => {
    const half = (FLAG_H - 1) / 2;
    if (x + 0.5 < (FLAG_W / 2) * (1 - Math.abs(y - half) / (half + 0.5))) return 'k';
    return y < FLAG_H / 2 ? 'w' : 'r';
  },
};
