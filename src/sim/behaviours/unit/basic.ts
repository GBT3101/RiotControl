/**
 * Generic unit behaviours: melee fighter (Riot Control), ranged shooter (Armed Cops,
 * Soldiers), rooftop shooter (Rubber Sniper, Sniper Brigade), blockade.
 */
import { BALANCE } from '../../../data/balance';
import { DMG } from '../../../data/damage';
import { aimAt, hurtProtester, validateHolders } from '../../combat';
import { PS } from '../../crowd';
import { US, type Unit } from '../../units';
import type { World } from '../../world';
import type { UnitBehaviour } from '../types';
import { isDisabled, meleeStrike, rangedFire, recruit } from './common';

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
 * When climbers make it onto the roof the unit turns on them point-blank (M7): it hits the
 * nearest one on its roof with its own weapon (rubber = KO, brigade = lethal) every cooldown, at
 * `BALANCE.climb.defendFactor` of its damage (clumsy at point-blank).
 * Climbers that win throw the sniper off the roof (climber behaviour).
 */
export const rooftopShooter: UnitBehaviour = {
  id: 'rooftop',
  update(w, u, dt) {
    if (u.roofAttackers > 0 && defendRoof(w, u, dt)) return;
    rangedFire(w, u, dt);
  },
};

const roofBuf = new Int32Array(64);

/** Point-blank fight against climbers on the unit's own roof. Returns true while busy. */
function defendRoof(w: World, u: Unit, dt: number): boolean {
  const a = u.def.attack;
  const B = w.map.buildings[u.building];
  if (!a || !B) return false;
  if (isDisabled(u)) {
    u.state = US.STUNNED;
    return true;
  }
  if (u.cd > 0) u.cd -= dt;
  const c = w.crowd;
  const r = Math.max(B.w, B.d) * 0.75 + 0.5;
  const n = w.hash.query(c, B.i + B.w * 0.5, B.j + B.d * 0.5, r, roofBuf);
  let t = -1;
  let bd = Infinity;
  for (let k = 0; k < n; k++) {
    const s = roofBuf[k]!;
    if (c.state[s] !== PS.ON_ROOF || c.bld[s] !== u.building) continue;
    const dx = c.x[s]! - u.x;
    const dy = c.y[s]! - u.y;
    const d = dx * dx + dy * dy;
    if (d < bd) {
      bd = d;
      t = s;
    }
  }
  if (t < 0) return false;
  aimAt(u, c.x[t]!, c.y[t]!);
  u.state = US.ATTACKING;
  if (u.cd > 0) return true;
  // Point-blank with a long gun is clumsy (playtest round: climbers must be able to win).
  const dmg = a.damage * BALANCE.climb.defendFactor;
  w.events.push('attacked', {
    attackerKind: 'unit',
    attackerId: u.id,
    targetKind: 'protester',
    targetId: c.handle(t),
    x: c.x[t]!,
    y: c.y[t]!,
    damage: dmg,
    dmgType: a.dmgType,
  });
  hurtProtester(w, t, dmg, DMG[a.dmgType], a.lethal, u.id);
  u.cd = a.cooldown;
  u.lastAttack = w.time;
  return true;
}

/** Passive obstacle: its tiles are solid; pressing protesters attack it. */
export const blockade: UnitBehaviour = {
  id: 'blockade',
  update(w, u) {
    validateHolders(w, u);
  },
};
