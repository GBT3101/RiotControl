/**
 * FX: projectiles, gas, fire, explosions, blood, KO stars, debris, lights and world markers —
 * sprite registration entry point (milestone M5). Catalogue: docs/art/M5.md.
 */
import type { SpriteRegistry } from '../lib/registry';
import { registerCombat } from './combat';
import { registerExplosions } from './explosions';
import { registerFire } from './fire';
import { registerGas } from './gas';
import { registerLights } from './lights';
import { registerMarkers } from './markers';
import { registerMisc } from './misc';
import { registerParticles } from './particles';
import { registerRam } from './ram';
import { registerSpecials } from './specials';
import { registerWaveMarkers } from './waveMarkers';

export { ghostTint, rangeRing, rangeRadiusPx } from './markers';
export { lightPool } from './lights';
export { waxSeal } from './misc';
export { DIRS, DIR_VEC, type Dir8 } from './particles';
export { GAS_PUFF_VARIANTS, gasCloudLayout, type PuffPlacement } from './gas';

export function registerFx(reg: SpriteRegistry): void {
  registerGas(reg);
  registerExplosions(reg);
  registerFire(reg);
  registerParticles(reg);
  registerCombat(reg);
  registerRam(reg);
  registerMisc(reg);
  registerLights(reg);
  registerMarkers(reg);
  registerWaveMarkers(reg);
  registerSpecials(reg);
}
