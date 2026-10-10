/**
 * Soldiers deployed on a roof can be stormed by climbers and thrown off, like the snipers: the
 * grabbed / flail / impact / splat set (`unit.soldier.grabbed.se` …) built by the shared rooftop
 * skeleton (sniper.ts `makeRooftop`) from the Soldier's own thrown part book and keys. Only the
 * thrown half is used: on the roof the Soldier keeps his standing ground poses (soldier.ts).
 */
import { SOLDIER_KEYS } from './soldier';
import { SOLDIER_THROWN_PARTS } from './soldierThrown.grid';
import { parseParts, type UnitDef } from './kit';
import { makeRooftop, SNIPER_BOOK } from './sniper';

const [, thrown] = makeRooftop({
  id: 'soldier',
  // Unused (the kneeling rooftop set is discarded); the thrown set is all we take.
  book: SNIPER_BOOK,
  thrownBook: parseParts(SOLDIER_THROWN_PARTS, 'soldierThrown'),
  keys: SOLDIER_KEYS,
  skin: 'skin3',
  flash: { se: 'flash', ne: 'flash.small@23,4' },
  muzzle: { se: { x: 26, y: 15 }, ne: { x: 24, y: 6 } },
  fireNote: '',
});

export const SOLDIER_THROWN: UnitDef = thrown;
