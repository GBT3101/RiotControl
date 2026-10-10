/**
 * VIENNA landmark art: the Austrian Parliament with the Pallas Athene fountain (Capitol), the
 * Rathaus, the Hofburg, the Stephansdom, the Austrian flag and granite steps.
 */
import { R } from '../engine/materials';
import type { LandmarkCity } from '../registry';
import { AUSTRIA } from './flag';
import { LANDMARKS_VIENNA } from './landmarks';
import { buildParlament, PARLAMENT_D, PARLAMENT_W } from './parlament';

export const vienna: LandmarkCity = {
  capitol: { w: PARLAMENT_W, d: PARLAMENT_D, top: 72, build: buildParlament },
  stepStone: R.granite,
  landmarks: LANDMARKS_VIENNA,
  flags: { at: AUSTRIA },
};
