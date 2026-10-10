import { FLAG_H, type FlagDef } from '../types';

/** France: blue-white-red. */
export const FRANCE: FlagDef = { h: FLAG_H, d: (x) => (x < 7 ? 'b' : x < 15 ? 'w' : 'r') };
