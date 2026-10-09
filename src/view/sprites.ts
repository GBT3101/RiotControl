/**
 * Sprite helpers. Pixi only applies a texture's `defaultAnchor` at construction, but our atlas
 * frames carry per-sprite anchors (trimmed protester frames differ per animation), so every
 * texture swap goes through `setTex`.
 */
import type { Sprite, Texture } from 'pixi.js';

export function setTex(s: Sprite, tex: Texture): void {
  if (s.texture === tex) return;
  s.texture = tex;
  const a = tex.defaultAnchor;
  if (a) s.anchor.set(a.x, a.y);
  else s.anchor.set(0, 0);
}

/** Place a sprite at an integer world point, optionally mirrored (registry-style: +1 px). */
export function placeAt(s: Sprite, x: number, y: number, flip = false): void {
  s.position.set(flip ? x + 1 : x, y);
  const sx = flip ? -1 : 1;
  if (s.scale.x !== sx) s.scale.x = sx;
}
