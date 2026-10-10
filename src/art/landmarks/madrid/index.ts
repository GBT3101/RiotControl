/**
 * MADRID landmark art: Congreso de los Diputados (Capitol), the Prado/Cibeles landmarks, the
 * Spanish flag and the granite Capitol steps.
 */
import { R } from '../engine/materials';
import type { LandmarkCity } from '../registry';
import { buildCongreso, CONGRESO_D, CONGRESO_W } from './congreso';
import { SPAIN } from './flag';
import { LANDMARKS_MADRID } from './landmarks';

export const madrid: LandmarkCity = {
  capitol: { w: CONGRESO_W, d: CONGRESO_D, top: 122, build: buildCongreso },
  stepStone: R.granite,
  landmarks: LANDMARKS_MADRID,
  flags: { es: SPAIN },
};
