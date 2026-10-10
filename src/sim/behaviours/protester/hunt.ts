/**
 * Aggro (owner: "when there are soldiers or cops in range, the protesters should prioritise
 * them over the Capitol and try to kill them first").
 *
 * `aggro.think` (staggered think ticks): a protester marching, rallying, gathering or rioting
 * on the Capitol steps with a ground unit in `BALANCE.aggro.radius` (and a clear straight walk
 * to it) breaks off and goes after it (`PS.HUNT`). Hunters re-check on every think: they switch
 * to a clearly better unit (one with a free melee slot, or less swamped), so overflow spreads
 * over the units nearby instead of the whole crowd stacking on one officer.
 *
 * `huntDesire` (every tick): walk at the unit; on contact the crowd update puts the hunter in a
 * free melee slot (`PS.ENGAGED`, the usual brawl) or leaves it pressing against the unit —
 * queued for a slot and counting toward the unit's outnumbering odds (sim/mob.ts). Shooters
 * without a melee weapon stop at stand-off range and shoot it (rangedAttacker). The hunt ends
 * when the unit dies, leaves for a roof, or gets beyond `BALANCE.aggro.leash`; the protester
 * then marches on (straight back to rioting when it is on the steps).
 */
import { BALANCE } from '../../../data/balance';
import { PROTESTERS } from '../../../data/protesters';
import { PS } from '../../crowd';
import { findPrey, preyScore } from '../../prey';
import type { Unit } from '../../units';
import type { World } from '../../world';
import type { ProtesterBehaviour } from '../types';
import { D } from './desire';
import { marchDesire } from './generic';

/** The unit protester s is hunting, or undefined. */
export function huntTarget(w: World, s: number): Unit | undefined {
  const c = w.crowd;
  const slot = c.tgtUnit[s]!;
  if (slot < 0) return undefined;
  return w.units.at(slot, c.tgtGen[s]);
}

/** Stop hunting: back to the march. */
export function endHunt(w: World, s: number): void {
  const c = w.crowd;
  c.tgtUnit[s] = -1;
  if (c.state[s] === PS.HUNT) c.state[s] = PS.MARCH;
}

export const aggro: ProtesterBehaviour = {
  id: 'aggro',
  think(w, s) {
    const c = w.crowd;
    const st = c.state[s]!;
    if (
      st !== PS.MARCH &&
      st !== PS.RALLY &&
      st !== PS.GATHER &&
      st !== PS.CAPITOL &&
      st !== PS.HUNT
    )
      return;
    const x = c.x[s]!;
    const y = c.y[s]!;
    const u = findPrey(w, x, y);
    if (!u) return; // nothing new in reach: a hunter keeps its current unit (leash in huntDesire)
    if (st === PS.HUNT) {
      const cur = huntTarget(w, s);
      if (cur === u) return;
      if (cur) {
        const now = preyScore(cur, x, y, BALANCE.aggro.leash);
        if (!(preyScore(u, x, y, BALANCE.aggro.radius) < now * BALANCE.aggro.hysteresis)) return;
      }
    } else w.stats.huntsStarted++;
    c.state[s] = PS.HUNT;
    c.tgtUnit[s] = u.slot;
    c.tgtGen[s] = u.gen;
  },
};

/** Going after the hunted unit (writes D). */
export function huntDesire(w: World, s: number): void {
  const c = w.crowd;
  const u = huntTarget(w, s);
  if (!u || u.building >= 0) {
    endHunt(w, s);
    marchDesire(w, s);
    return;
  }
  const dx = u.x - c.x[s]!;
  const dy = u.y - c.y[s]!;
  const d = Math.sqrt(dx * dx + dy * dy);
  const leash = BALANCE.aggro.leash;
  if (d > leash) {
    endHunt(w, s);
    marchDesire(w, s);
    return;
  }
  if (d < 1e-6) return;
  D.face = true;
  D.fx = dx;
  D.fy = dy;
  const def = PROTESTERS[c.type[s]!]!;
  const ld = def.loadouts[c.loadout[s]!]!;
  if (!ld.melee && ld.ranged && !def.explode) {
    // Gunmen hold at stand-off range and shoot (the ranged think fires on its cooldown).
    if (d <= ld.ranged.range * BALANCE.aggro.standOff) {
      D.speed = 0;
      return;
    }
  }
  D.x = dx / d;
  D.y = dy / d;
  // Pressing in on a unit whose slots are all taken: lean on it, wait for a gap.
  const contact = u.def.radius + def.radius + 0.15;
  if (d < contact + 0.4 && u.nHolders >= u.holders.length) D.speed = 0.35;
}
