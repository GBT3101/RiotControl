/**
 * STOCKHOLM landmark art: Riksdagshuset with its curved water front (Capitol), the Royal
 * Palace, Stadshuset with the Three Crowns, Riddarholmen's iron spire, the Swedish flag and
 * granite Capitol steps.
 */
import { R } from '../engine/materials';
import type { LandmarkCity } from '../registry';
import { SWEDEN } from './flag';
import { LANDMARKS_STOCKHOLM } from './landmarks';
import { buildRiksdag, RIKSDAG_D, RIKSDAG_W } from './riksdag';

export const stockholm: LandmarkCity = {
  capitol: { w: RIKSDAG_W, d: RIKSDAG_D, top: 112, build: buildRiksdag },
  stepStone: R.granite,
  landmarks: LANDMARKS_STOCKHOLM,
  flags: { se: SWEDEN },
};
