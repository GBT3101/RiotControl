/**
 * BERLIN landmark art: the Reichstag with Foster's glass dome (Capitol), the Brandenburg Gate,
 * the Victory Column, the Fernsehturm, the German flag and sandstone Capitol steps.
 * northkit.ts holds helpers shared with Stockholm and Amsterdam.
 */
import type { LandmarkCity } from '../registry';
import { GERMANY } from './flag';
import { LANDMARKS_BERLIN } from './landmarks';
import { RN } from './northkit';
import { buildReichstag, REICHSTAG_D, REICHSTAG_W } from './reichstag';

export const berlin: LandmarkCity = {
  capitol: { w: REICHSTAG_W, d: REICHSTAG_D, top: 112, build: buildReichstag },
  stepStone: RN.sandstone,
  landmarks: LANDMARKS_BERLIN,
  flags: { de: GERMANY },
};
