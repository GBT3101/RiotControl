/**
 * Ministry units: all player units and their animations — sprite registration entry point (owned by milestone M4a).
 */
import type { SpriteRegistry } from '../lib/registry';
import { registerUnitDef } from './kit';
import { registerPortraits } from './portraits';
import { registerBlockade } from './blockade';
import { BRIGADE, BRIGADE_THROWN } from './brigade';
import { COP } from './cop';
import { GAS } from './gas';
import { HORSE } from './horse';
import { COP_SKINS, RIOT } from './riot';
import { SNIPER, SNIPER_THROWN } from './sniper';
import { SOLDIER } from './soldier';

export { unitAnimCatalog, unitAnimMeta, BRIGADE_SQUAD_OFFSETS, type UnitAnimMeta } from './catalog';
export { BLOCKADE_PIECES, BLOCKADE_STATES } from './blockade';
export { COP_SKINS } from './riot';
export { rammedStars } from './rammed';

export function registerUnits(reg: SpriteRegistry): void {
  registerUnitDef(reg, RIOT);
  // Skin variants of the riot officer (idle + walk) for crowds of officers (demo / M8).
  COP_SKINS.slice(1).forEach((skin, i) =>
    registerUnitDef(
      reg,
      { ...RIOT, look: { ...RIOT.look, slots: { skin } } },
      { prefix: `unit.riot.v${i + 1}`, group: 'variants', only: ['idle', 'walk'] },
    ),
  );
  registerUnitDef(reg, COP);
  registerUnitDef(reg, SOLDIER);
  registerUnitDef(reg, GAS);
  registerUnitDef(reg, HORSE);
  registerUnitDef(reg, SNIPER);
  registerUnitDef(reg, SNIPER_THROWN);
  registerUnitDef(reg, BRIGADE);
  registerUnitDef(reg, BRIGADE_THROWN);
  registerBlockade(reg);
  registerPortraits(reg);
}
