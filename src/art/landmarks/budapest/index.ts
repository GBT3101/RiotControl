/**
 * BUDAPEST landmark art: the Hungarian Parliament (Országház, Capitol), St Stephen's Basilica,
 * Buda Castle, Fisherman's Bastion, the Kossuth memorial, the Hungarian flag and granite steps.
 */
import { R } from '../engine/materials';
import type { LandmarkCity } from '../registry';
import { HUNGARY } from './flag';
import { LANDMARKS_BUDAPEST } from './landmarks';
import { buildOrszaghaz, ORSZAGHAZ_D, ORSZAGHAZ_W } from './orszaghaz';

export const budapest: LandmarkCity = {
  capitol: { w: ORSZAGHAZ_W, d: ORSZAGHAZ_D, top: 138, build: buildOrszaghaz },
  stepStone: R.granite,
  landmarks: LANDMARKS_BUDAPEST,
  flags: { hu: HUNGARY },
};
