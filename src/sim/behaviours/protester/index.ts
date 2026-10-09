/**
 * Protester behaviour tables: per protester type, the list of modules whose `think` /
 * `onContact` hooks the crowd update calls. Generic per-state updates (march, melee, Capitol,
 * climbing, flocking) are exported for the crowd update.
 */
import { PROTESTERS, type ProtesterDef } from '../../../data/protesters';
import type { ProtesterBehaviour } from '../types';
import { climber, paparazzi, prophet, rangedAttacker } from './specials';

export function behavioursFor(def: ProtesterDef): ProtesterBehaviour[] {
  const list: ProtesterBehaviour[] = [];
  if (def.loadouts.some((l) => l.ranged)) list.push(rangedAttacker);
  if (def.climbs) list.push(climber);
  if (def.flash) list.push(paparazzi);
  if (def.explode) list.push(prophet);
  return list;
}

/** Indexed by protester type id. */
export const PROTESTER_BEHAVIOURS: readonly ProtesterBehaviour[][] = PROTESTERS.map(behavioursFor);

export { D, resetDesire } from './desire';
export { marchDesire, engagedDesire, capitolDesire, CAPITOL_HIT_INTERVAL } from './generic';
export {
  climbUpdate,
  explodeProphet,
  followDesire,
  auraFactor,
  nearestUnit,
  rangedAttacker,
  climber,
  prophet,
  paparazzi,
} from './specials';
