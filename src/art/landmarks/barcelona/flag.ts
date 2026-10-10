import { FLAG_H, type FlagDef } from '../types';
export { SPAIN } from '../madrid/flag';

/** Catalonia: la Senyera — four red bars on gold (nine equal stripes, top and bottom gold). */
export const SENYERA: FlagDef = {
  h: FLAG_H,
  d: (_x, y) => (Math.floor(((y + 0.5) * 9) / FLAG_H) % 2 === 1 ? 'r' : 'y'),
};
