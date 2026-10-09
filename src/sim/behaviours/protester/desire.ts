/**
 * Scratch output of the per-state protester updates: desired unit direction, speed factor and
 * facing override. One shared object (no allocation); valid until the next protester.
 */
export const D = {
  /** Desired direction (unit vector or 0). */
  x: 0,
  y: 0,
  /** Speed multiplier for this tick. */
  speed: 1,
  /** Face (fx, fy) instead of the velocity (attacking). */
  face: false,
  fx: 0,
  fy: 0,
  /** Hit this tick (animation hint). */
  attacked: false,
};

export function resetDesire(): void {
  D.x = 0;
  D.y = 0;
  D.speed = 1;
  D.face = false;
  D.attacked = false;
}
