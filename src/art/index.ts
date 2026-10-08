/**
 * Art registry entry point: every art module registers its sprites here.
 * Pure (no DOM) so the gallery, the game, the PNG exporter and Node tests share it.
 */
import { registerStubBoxes } from './buildings/stubBoxes';
import { registerEnvironment } from './env';
import { registerFx } from './fx';
import { registerLandmarks } from './landmarks';
import { registerProtesters } from './protesters';
import { registerUiKit } from './uikit';
import { registerUnits } from './units';
import { registerVehicles } from './vehicles';
import { registerRiotCop } from './characters/riotCop';
import { SpriteRegistry } from './lib/registry';
import { registerStubTiles } from './tiles/stubTiles';
import { registerCursors } from './ui/cursors';

/** Build a fresh registry containing every sprite in the game. */
export function createArtRegistry(): SpriteRegistry {
  const reg = new SpriteRegistry();
  registerStubTiles(reg);
  registerStubBoxes(reg);
  registerRiotCop(reg);
  registerCursors(reg);
  registerEnvironment(reg);
  registerLandmarks(reg);
  registerUnits(reg);
  registerProtesters(reg);
  registerVehicles(reg);
  registerFx(reg);
  registerUiKit(reg);
  return reg;
}
