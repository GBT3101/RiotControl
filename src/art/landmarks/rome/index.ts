/**
 * ROME landmark art (E4 South): Palazzo Montecitorio with its obelisk (Capitol), the Pantheon,
 * the Trevi Fountain, the Vittoriano, the Colosseum, the Tricolore and travertine steps.
 */
import type { LandmarkCity } from '../registry';
import { S } from './common';
import { ITALY } from './flag';
import { LANDMARKS_ROME } from './landmarks';
import { buildMontecitorio, MONTECITORIO_D, MONTECITORIO_W } from './montecitorio';

export const rome: LandmarkCity = {
  capitol: { w: MONTECITORIO_W, d: MONTECITORIO_D, top: 122, build: buildMontecitorio },
  stepStone: S.travertine,
  landmarks: LANDMARKS_ROME,
  flags: { it: ITALY },
};
