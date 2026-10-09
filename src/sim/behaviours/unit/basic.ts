/**
 * Generic unit behaviours: melee fighter (Riot Control), ranged shooter (Armed Cops,
 * Soldiers), rooftop shooter (Rubber Sniper, Sniper Brigade), blockade.
 */
import { validateHolders } from '../../combat';
import type { UnitBehaviour } from '../types';
import { meleeStrike, rangedFire, recruit } from './common';

/** Holds up to `meleeSlots` protesters and clubs them (or passers-by in reach). */
export const meleeFighter: UnitBehaviour = {
  id: 'melee',
  update(w, u, dt) {
    validateHolders(w, u);
    recruit(w, u);
    meleeStrike(w, u, dt);
  },
};

/** Static ground shooter: hitscan with pierce / burst / spread from data. */
export const rangedShooter: UnitBehaviour = {
  id: 'ranged',
  update(w, u, dt) {
    validateHolders(w, u);
    recruit(w, u);
    rangedFire(w, u, dt);
  },
};

/**
 * Rooftop shooter: same targeting from the roof centre (u.z = storeys, so tracers start high).
 * Climbers fighting on the roof are handled by the climber behaviour (they damage the unit;
 * a kill throws the sniper off the roof).
 */
export const rooftopShooter: UnitBehaviour = {
  id: 'rooftop',
  update(w, u, dt) {
    rangedFire(w, u, dt);
  },
};

/** Passive obstacle: its tiles are solid; pressing protesters attack it. */
export const blockade: UnitBehaviour = {
  id: 'blockade',
  update(w, u) {
    validateHolders(w, u);
  },
};
