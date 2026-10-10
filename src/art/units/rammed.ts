/**
 * "Rammed over" (playtest round): when a mob outnumbers a lone officer 5:1 it bowls him over
 * (sim `mob.ts`: a crush hit and `BALANCE.mob.ramStun` = 1.2 s knocked down). Every rammable
 * ground unit gets a `rammed` one-shot on the same 12-frame, 10 fps timeline so the view can
 * play it straight from `Unit.rammedAt`:
 *
 *   0      shove      knocked back off his feet, kit flying
 *   1–3    fall       hits the street, bounce
 *   4–5    flat       lying dazed (KO stars orbit his head: `rammedStars`)
 *   6–8    sit up     sitting in the street, head lolling (kit lying beside him)
 *   9–11   get up     crouch for the kit → brace → standing again
 *
 * The horse never goes down: it shies and rears with the rider clinging on, then stamps.
 */
import type { Point } from '../lib/pixels';
import type { AnimDef } from './kit';

export const RAMMED_FPS = 10;
export const RAMMED_FRAMES = 12;

/** Build the `rammed` anim from its SE / NE poses (12 each). */
export function rammedAnim(se: readonly string[], ne: readonly string[], note: string): AnimDef {
  if (se.length !== RAMMED_FRAMES || ne.length !== RAMMED_FRAMES) {
    throw new Error(`rammed: expected ${RAMMED_FRAMES} poses, got ${se.length} / ${ne.length}`);
  }
  return { anim: 'rammed', fps: RAMMED_FPS, loop: false, se, ne, note };
}

/** KO-star orbit centre per frame (SE canvas, px from the anchor; mirror x for SW / NW). */
const STARS_PERSON: readonly (Point | null)[] = [
  null,
  null,
  null,
  null,
  { x: -7, y: -12 }, // flat on his back: over the head on the street
  { x: -7, y: -12 },
  { x: 1, y: -21 }, // sitting up
  { x: 1, y: -21 },
  { x: 1, y: -21 },
];
const STARS_HORSE: readonly (Point | null)[] = [
  null,
  null,
  null,
  null,
  null,
  { x: -2, y: -32 }, // rider slumped in the saddle after the rear
  { x: -2, y: -33 },
  { x: -2, y: -33 },
  { x: -2, y: -33 },
];

/** Where KO stars orbit on `frame` of `unit.<unit>.rammed.se`, or null (not dazed). */
export function rammedStars(unit: string, frame: number): Point | null {
  return (unit === 'horse' ? STARS_HORSE : STARS_PERSON)[frame] ?? null;
}
