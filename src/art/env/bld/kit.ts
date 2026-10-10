/**
 * Facade helpers shared by the painter (facade.ts) and the per-city facade hooks
 * (src/art/env/cities/<city>.ts): night-glow colours, spray tags, hanging-flag colours.
 */
import type { RGBA } from '../../palette';
import { C } from '../color';
import type { Dice } from '../util';
import { K_GLASS, parseGrid, type Face, type KeyResolver } from './face';

/** Lit-window glow (night layer) and its highlight. */
export const GLOW = C('ochre3');
export const GLOW_HI = C('ochre4');

// Tiny spray tags for shutters and walls.
const TAGS = [
  `
r.rr.
rrr.r
r.r.r
`,
  `
.yy..
y..yy
.yy..
`,
  `
p.p.p
ppp.p
`,
];

export function tag(f: Face, x0: number, y0: number, d: Dice): void {
  const g = parseGrid(d.pick(TAGS));
  const col = C(d.pick(['crim2', 'pink2', 'lime', 'sky', 'white', 'ochre3', 'purple']));
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (g.rows[y]![x] === '.') continue;
      if (f.kindAt(x0 + x, y0 + y) === K_GLASS) continue;
      f.tint(x0 + x, y0 + y, col);
    }
  }
}

/** Hanging balcony flag (BALCONY_FLAG module): keys c / C get the flag's two colours. */
export function flagRes(res: KeyResolver, c: RGBA, C2: RGBA): KeyResolver {
  return (k, x, y) => (k === 'c' ? c : k === 'C' ? C2 : res(k, x, y));
}
