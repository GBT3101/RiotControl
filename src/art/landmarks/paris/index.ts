/**
 * PARIS landmark art: the Palais Bourbon (Capitol), Concorde, the Eiffel Tower, the Invalides,
 * Orsay, the tricolour and pale limestone steps.
 */
import { R } from '../engine/materials';
import type { LandmarkCity } from '../registry';
import { buildBourbon, BOURBON_D, BOURBON_W } from './bourbon';
import { FRANCE } from './flag';
import { LANDMARKS_PARIS } from './landmarks';

export const paris: LandmarkCity = {
  capitol: { w: BOURBON_W, d: BOURBON_D, top: 124, build: buildBourbon },
  stepStone: R.limePale,
  landmarks: LANDMARKS_PARIS,
  flags: { fr: FRANCE },
};
