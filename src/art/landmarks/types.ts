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
