/**
 * PRAGUE landmark art: Prague Castle with St Vitus (Capitol), the Old Town Bridge Tower, the
 * Old Town Hall with the astronomical clock, Týn Church, the Dancing House, the Czech flag and
 * terrace-stone steps.
 */
import type { LandmarkCity } from '../registry';
import { CZECHIA } from './flag';
import { buildHrad, HRAD_D, HRAD_W } from './hrad';
import { LANDMARKS_PRAGUE } from './landmarks';

export const prague: LandmarkCity = {
  capitol: { w: HRAD_W, d: HRAD_D, top: 186, build: buildHrad },
  stepStone: ['stone0', 'stone1', 'gray4', 'stone2', 'stone3'],
  landmarks: LANDMARKS_PRAGUE,
  flags: { cz: CZECHIA },
};
