/** Unit behaviour registry keyed by `UnitDef.behaviour`. */
import type { UnitBehaviourId } from '../../../data/units';
import type { UnitBehaviour } from '../types';
import { blockade, meleeFighter, rangedShooter, rooftopShooter } from './basic';
import { gasser, heli, mountedMelee, tank, vehicleGun } from './specials';

export const UNIT_BEHAVIOURS: Readonly<Record<UnitBehaviourId, UnitBehaviour>> = {
  melee: meleeFighter,
  ranged: rangedShooter,
  rooftop: rooftopShooter,
  blockade,
  gasser,
  mountedMelee,
  vehicleGun,
  tank,
  heli,
};

export { commandUnit, moverUpdate, meleeStrike, rangedFire } from './common';
export { useGasGrenade, findDensest, densest } from './specials';
