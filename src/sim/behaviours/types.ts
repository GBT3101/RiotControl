/**
 * Behaviour module interfaces.
 *
 * Units are objects, so a unit behaviour is a small strategy object selected by
 * `UnitDef.behaviour` and called once per tick per unit (after common status handling).
 *
 * Protesters live in SoA arrays, so protester behaviours are stateless function bundles that
 * receive the crowd **slot**. The crowd update (steering.ts) calls:
 *  - `think` at a throttled rate (every `BALANCE.thinkTicks` ticks, staggered by slot) for
 *    decisions: targeting, ranged attacks, climb diversions, flashes;
 *  - `onContact` when the protester touches a ground unit (Prophets explode);
 * Movement and the per-state updates (march, engaged melee, Capitol attack, climbing) are the
 * generic modules in `protester/` used directly by the crowd update.
 */
import type { UnitBehaviourId } from '../../data/units';
import type { Unit } from '../units';
import type { World } from '../world';

export interface UnitBehaviour {
  readonly id: UnitBehaviourId;
  update(w: World, u: Unit, dt: number): void;
}

export interface ProtesterBehaviour {
  readonly id: string;
  /** Throttled decision step. May change state, fire, etc. Must tolerate the slot dying. */
  think?(w: World, s: number): void;
  /** Touching ground unit `u` this tick. Return true if the protester was consumed (died). */
  onContact?(w: World, s: number, u: Unit): boolean;
}
