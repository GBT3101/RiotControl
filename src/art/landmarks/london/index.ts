/**
 * LONDON landmark art: the Palace of Westminster with Elizabeth Tower (Capitol), the Abbey,
 * Nelson, the Eye, Buckingham Palace, Churchill, the Union flag, Big Ben's hands, granite steps.
 */
import { R } from '../engine/materials';
import type { LandmarkCity } from '../registry';
import { registerClockHands } from './clock';
import { UNION } from './flag';
import { LANDMARKS_LONDON } from './landmarks';
import { buildWestminster, WESTMINSTER_D, WESTMINSTER_W } from './westminster';

export const london: LandmarkCity = {
  capitol: { w: WESTMINSTER_W, d: WESTMINSTER_D, top: 212, build: buildWestminster },
  stepStone: R.granite,
  landmarks: LANDMARKS_LONDON,
  flags: { uk: UNION },
  registerFx: registerClockHands,
};
