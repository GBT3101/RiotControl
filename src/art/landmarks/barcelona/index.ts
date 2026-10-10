/**
 * BARCELONA landmark art (E4 South): the Parlament de Catalunya (Capitol), the Arc de Triomf,
 * the Cascada, the Columbus monument, the Sagrada Família, the Senyera + Spanish flag.
 */
import { R } from '../engine/materials';
import type { LandmarkCity } from '../registry';
import { SENYERA, SPAIN } from './flag';
import { LANDMARKS_BARCELONA } from './landmarks';
import { buildParlament, PARLAMENT_D, PARLAMENT_W } from './parlament';

export const barcelona: LandmarkCity = {
  capitol: { w: PARLAMENT_W, d: PARLAMENT_D, top: 116, build: buildParlament },
  stepStone: R.limePale,
  landmarks: LANDMARKS_BARCELONA,
  flags: { cat: SENYERA, es: SPAIN },
};
