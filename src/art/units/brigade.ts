/**
 * Sniper Brigade — three elite rooftop snipers per roof (place three of these sprites on the
 * roof with the offsets in docs/art/M4a.md). Black tactical kit, ghillie tufts, balaclava,
 * long suppressed rifle with a big flash. Reuses the rooftop skeleton (sniper.ts) recoloured,
 * so it also gets the climb-up deploy and the thrown-off-the-roof sequence in its own look.
 */
import type { KeyMap } from '../lib/grid';
import { BRIGADE_PARTS } from './brigade.grid';
import { overrideBooks, parseParts } from './kit';
import { makeRooftop, SNIPER_BOOK, SNIPER_KEYS, THROWN_BOOK } from './sniper';

export const BRIGADE_KEYS: KeyMap = {
  ...SNIPER_KEYS,
  '1': 'ink',
  '2': 'gray1',
  '3': 'gray2',
  '4': 'gray3',
  K: 'gray1',
  y: 'olive.1',
  Y: 'olive.2',
  P: 'olive.1',
  E: 'earth4',
  R: 'olive1',
  r: 'green0',
  x: 'ink',
  X: 'gray3',
  w: 'crim2',
  n: 'gray2',
  B: 'gray1',
  b: 'ink',
};

export const [BRIGADE, BRIGADE_THROWN] = makeRooftop({
  id: 'brigade',
  book: overrideBooks(SNIPER_BOOK, parseParts(BRIGADE_PARTS, 'brigade')),
  thrownBook: THROWN_BOOK,
  keys: BRIGADE_KEYS,
  // Balaclava + gloves: the skin slot is mapped to the asphalt greys.
  skin: 'asphalt',
  width: 38,
  flash: { se: 'flash.big@31,12', ne: 'flash.big@25,0' },
  muzzle: { se: { x: 31, y: 15 }, ne: { x: 28, y: 3 } },
  fireNote: 'Lethal round: big flash on frame 1 (spawn tracer/impact; splash r=1), recoil, bolt.',
});
