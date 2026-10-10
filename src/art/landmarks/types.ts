import type { Scene } from './engine/scene';

/** An animated overlay sprite placed at a footprint-space point (see docs/art/M3b.md). */
export interface Overlay {
  sprite: string;
  u: number;
  v: number;
  z: number;
  /** Flags: the sprite's anchor is the pole attachment pixel. */
  flag?: boolean;
}

export interface Build {
  scene: Scene;
  overlays: Overlay[];
}

/** Flag cloth size (px) of `lm.flag.<code>` (fx.ts waves it). */
export const FLAG_W = 22;
export const FLAG_H = 14;

/**
 * A flag design: cloth key of pixel (x, y) on the FLAG_W × h cloth. Keys are the cloth ramps in
 * fx.ts: r red · R deep red · y yellow · o gold · b blue · k dark blue · w white · g green ·
 * K black.
 */
export type FlagDesign = (x: number, y: number) => string;

export interface FlagDef {
  d: FlagDesign;
  h: number;
}
