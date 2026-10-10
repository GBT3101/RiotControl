/**
 * Outnumbering (playtest round: "protesters should ram units over when they're alone or just a
 * few vs many").
 *
 * Every `BALANCE.mob.everyTicks` each ground unit counts the protesters around it and its
 * support (itself + friendly ground units nearby, weighted by `UnitDef.mobWeight`). The ratio
 * is its `odds`. Beyond `UnitDef.mobHold` attackers per supporter protester melee hits it
 * harder, below it softer (`Unit.mob`, applied in `combat.hurtUnit`). A rammable unit facing
 * long odds may be knocked down: a crush hit that ignores armour plus a short stun (an
 * `attacked` event with `dmgType: 'crush'`, so the view flashes the hit and the audio plays its
 * crunch). Rooftop units count the climbers on their roof against themselves (ground cover
 * nearby counts as a second defender).
 *
 * The same pass accumulates rooftop units' `rage` (seconds spent shooting at the crowd), which
 * makes climbers more eager (behaviours/protester/specials.ts).
 */
import { BALANCE } from '../data/balance';
import { DMG } from '../data/damage';
import { hurtUnit } from './combat';
import { PS } from './crowd';
import type { Unit } from './units';
import type { World } from './world';

const buf = new Int32Array(256);

/** Damage multiplier for `odds` attackers per supporter against a unit holding `hold`. */
export function mobMultiplier(odds: number, hold: number): number {
  const m = BALANCE.mob;
  return Math.min(m.maxMult, Math.max(m.minMult, 1 + m.slope * (odds - hold)));
}

/** Protesters on the ground within `r` of (x, y) (climbers and roof fighters excluded). */
function crowdAround(w: World, x: number, y: number, r: number): number {
  const c = w.crowd;
  const n = w.hash.query(c, x, y, r, buf);
  let m = 0;
  for (let k = 0; k < n; k++) {
    const st = c.state[buf[k]!]!;
    if (st !== PS.CLIMBING && st !== PS.ON_ROOF && st !== PS.CLIMB_DOWN) m++;
  }
  return m;
}

/** Support of ground unit u: itself plus the weight of friendly ground units nearby. */
function supportOf(w: World, u: Unit): number {
  const r2 = BALANCE.mob.supportRadius ** 2;
  let sup = 1;
  const list = w.units.active;
  for (let k = 0; k < list.length; k++) {
    const o = list[k]!;
    if (o === u || !o.alive || o.building >= 0 || o.def.placement !== 'road') continue;
    const dx = o.x - u.x;
    const dy = o.y - u.y;
    if (dx * dx + dy * dy <= r2) sup += o.def.mobWeight;
  }
  return sup;
}

/** Refresh odds / multipliers, roll knockdowns and rooftop rage. Call once per step. */
export function updateMob(w: World): void {
  const M = BALANCE.mob;
  if (w.tick % M.everyTicks !== 0) return;
  const step = M.everyTicks * w.dt;
  const list = w.units.active;
  for (let k = 0; k < list.length; k++) {
    const u = list[k]!;
    if (!u.alive || u.def.invulnerable) continue;
    const def = u.def;
    if (u.building >= 0) {
      // Rooftop: climbers vs the defender (ground cover nearby counts as a second one); rage
      // while it keeps shooting at the crowd.
      u.odds = u.roofAttackers / (w.roofCovered[u.building] ? 2 : 1);
      u.mob = mobMultiplier(u.odds, def.mobHold);
      const firing = u.lastAttack >= 0 && w.time - u.lastAttack < (def.attack?.cooldown ?? 1) + 1;
      u.rage = firing ? u.rage + step : Math.max(0, u.rage - step * 0.5);
      continue;
    }
    if (def.placement !== 'road') continue;
    // Blockades span up to three tiles: count around the whole barrier.
    const r = M.radius + (u.type === 'blockade' ? 1 : def.radius);
    const mob = crowdAround(w, u.x, u.y, r);
    u.odds = mob === 0 ? 0 : mob / supportOf(w, u);
    u.mob = mobMultiplier(u.odds, def.mobHold);
    if (def.rammable && u.odds >= M.ramOdds && u.stun <= 0 && !u.moving) {
      const p = Math.min(0.6, M.ramChance * (u.odds - M.ramOdds + 1));
      if (w.rng.chance(p)) ram(w, u);
    }
  }
}

/** Knock u down: a crush hit through its armour and a short stun. */
function ram(w: World, u: Unit): void {
  const M = BALANCE.mob;
  let by = -1;
  for (let k = 0; k < u.holders.length && by < 0; k++) by = u.holders[k]!;
  const damage = u.def.hp * M.ramDamage;
  u.stun = Math.max(u.stun, M.ramStun);
  u.rammedAt = w.time;
  w.stats.officersRammed++;
  w.events.push('attacked', {
    attackerKind: 'protester',
    attackerId: by,
    targetKind: 'unit',
    targetId: u.id,
    x: u.x,
    y: u.y,
    damage,
    dmgType: 'crush',
  });
  hurtUnit(w, u, damage, DMG.crush, true, 'protester', by, false, true);
}
