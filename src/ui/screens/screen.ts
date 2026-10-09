/**
 * Full-screen / modal UI screens (title, city select, pause, settings, credits, end of run).
 * Screens stack on the app's top layer; the top-most one gets keys first.
 */
import type { Container } from 'pixi.js';
import { Sprite, Texture } from 'pixi.js';
import { makeInteractive } from '../core/node';
import type { HudLayout } from '../layout';

export interface Screen {
  readonly root: Container;
  /** Swallows the world/HUD underneath (modal). */
  readonly modal: boolean;
  layout(l: HudLayout): void;
  update(dt: number): void;
  /** Key handling (return true when consumed). */
  key?(code: string): boolean;
  destroy(): void;
}

/** Full-screen dim layer that swallows input (modal backdrop). */
export function backdrop(alpha = 0.6, colour = 0x1a1424): Sprite {
  const s = new Sprite(Texture.WHITE);
  s.tint = colour;
  s.alpha = alpha;
  makeInteractive(s, { blockOnly: true });
  return s;
}

export function fitBackdrop(s: Sprite, l: HudLayout): void {
  s.position.set(0, 0);
  s.width = l.W;
  s.height = l.H;
}
