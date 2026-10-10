/**
 * MILAN landmark art (E4 South): Palazzo Marino (Capitol), the Duomo, the Galleria, La Scala,
 * the Castello Sforzesco, the Tricolore.
 */
import type { LandmarkCity } from '../registry';
import { S } from '../rome/common';
import { ITALY } from '../rome/flag';
import { LANDMARKS_MILAN } from './landmarks';
import { buildMarino, MARINO_D, MARINO_W } from './marino';

export const milan: LandmarkCity = {
  capitol: { w: MARINO_W, d: MARINO_D, top: 124, build: buildMarino },
  stepStone: S.milanStone,
  landmarks: LANDMARKS_MILAN,
  flags: { it: ITALY },
};
