/**
 * "Rammed over" (playtest round): when a mob outnumbers a lone officer 5:1 it bowls him over
 * (sim `mob.ts`: a crush hit and `BALANCE.mob.ramStun` = 1.2 s knocked down). Every rammable
 * ground unit gets a `rammed` one-shot on the same 12-frame, 10 fps timeline so the view can
 * play it straight from `Unit.rammedAt`:
 *
 *   0      shove      knocked back off his feet, kit flying
 *   1–3    fall       hits the street, bounce
 *   4–5    flat       lying dazed (the view orbits KO stars over him from frame 4)
 *   6–8    sit up     sitting in the street, head lolling (kit lying beside him)
 *   9–11   get up     crouch for the kit → brace → standing again
 *
 * The horse never goes down: it shies and rears with the rider clinging on, then stamps.
 */
import type { AnimDef } from './kit';

export const RAMMED_FPS = 10;
export const RAMMED_FRAMES = 12;
/** Frames on which the unit is down and dazed (KO stars / birds orbit his head). */
export const RAMMED_DAZED: readonly [number, number] = [4, 8];

/** Build the `rammed` anim from its SE / NE poses (12 each). */
export function rammedAnim(se: readonly string[], ne: readonly string[], note: string): AnimDef {
  if (se.length !== RAMMED_FRAMES || ne.length !== RAMMED_FRAMES) {
    throw new Error(`rammed: expected ${RAMMED_FRAMES} poses, got ${se.length} / ${ne.length}`);
  }
  return { anim: 'rammed', fps: RAMMED_FPS, loop: false, se, ne, note };
}
