import { FLAG_H, type FlagDef } from '../types';

/** Italy: il Tricolore — green, white, red (vertical). Milan flies it too (milan/flag.ts). */
export const ITALY: FlagDef = { h: FLAG_H, d: (x) => (x < 7 ? 'g' : x < 15 ? 'w' : 'r') };
