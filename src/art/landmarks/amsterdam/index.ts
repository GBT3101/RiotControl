/**
 * AMSTERDAM landmark art: the Royal Palace on the Dam with its cupola and gilded ship
 * (Capitol), the National Monument, Nieuwe Kerk, Centraal Station, Westerkerk, the Dutch flag
 * and granite Capitol steps.
 */
import { R } from '../engine/materials';
import type { LandmarkCity } from '../registry';
import { NETHERLANDS } from './flag';
import { LANDMARKS_AMSTERDAM } from './landmarks';
import { buildPaleis, PALEIS_D, PALEIS_W } from './paleis';

export const amsterdam: LandmarkCity = {
  capitol: { w: PALEIS_W, d: PALEIS_D, top: 136, build: buildPaleis },
  stepStone: R.granite,
  landmarks: LANDMARKS_AMSTERDAM,
  flags: { nl: NETHERLANDS },
};
