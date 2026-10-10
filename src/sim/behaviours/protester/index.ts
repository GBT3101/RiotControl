/**
 * Protester behaviour tables: per protester type, the list of modules whose `think` /
 * `onContact` hooks the crowd update calls. Generic per-state updates (march, melee, Capitol,
 * climbing, flocking) are exported for the crowd update.
 */
import { PROTESTERS, type ProtesterDef } from '../../../data/protesters';
import type { ProtesterBehaviour } from '../types';
import { aggro } from './hunt';
import { climber, paparazzi, prophet, rangedAttacker } from './specials';

export function behavioursFor(def: ProtesterDef): ProtesterBehaviour[] {
  const list: ProtesterBehaviour[] = [];
  if (def.loadouts.some((l) => l.ranged)) list.push(rangedAttacker);
  if (def.climbs) list.push(climber);
  if (def.flash) list.push(paparazzi);
  if (def.explode) list.push(prophet);
  // Everyone goes after units in reach, except Breta (she only came to be photographed).
  // After the climber, so a climb diversion wins its roll first.
  if (!def.bounty) list.push(aggro);
  return list;
}

/** Indexed by protester type id. */
export const PROTESTER_BEHAVIOURS: readonly ProtesterBehaviour[][] = PROTESTERS.map(behavioursFor);

export { D, resetDesire } from './desire';
export {
  marchDesire,
  engagedDesire,
  capitolDesire,
  afterMill,
  rallyDesire,
  gatherDesire,
  CAPITOL_HIT_INTERVAL,
} from './generic';
export { aggro, endHunt, huntDesire, huntTarget } from './hunt';
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
