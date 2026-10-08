/**
 * Sprite registry (DOM-free). Art modules register named sprites/animations as RGBA frames;
 * the atlas (atlas.ts) packs them into GPU textures at boot, the gallery lists them, and the
 * palette-compliance test scans them in Node.
 *
 * Naming convention: dot-separated, lowercase — `<category>.<subject>.<anim>.<facing>`, e.g.
 * `unit.riot.walk.se`, `tile.grass`, `bld.stub.box3`. Groups are gallery categories
 * ('units', 'protesters', 'tiles', 'buildings', 'props', 'fx', 'ui', …).
 */
import { mirrorAnchor, mirrorX, type PixelBuffer, type Point } from './pixels';

export interface SpriteDef {
  readonly name: string;
  readonly group: string;
  readonly frames: readonly PixelBuffer[];
  /** Playback rate; 0 = static. */
  readonly fps: number;
  readonly loop: boolean;
  /**
   * Anchor in *pixel-index* coordinates: the pixel (x, y) of the frame that sits on the
   * entity's position (usually the foot / ground contact pixel). Mirroring keeps the column.
   */
  readonly anchor: Point;
  readonly tags: readonly string[];
  /** True if the frames intentionally contain shadow (partial-alpha) pixels. */
  readonly hasShadow: boolean;
}

export interface SpriteInput {
  group: string;
  frames: PixelBuffer | readonly PixelBuffer[];
  fps?: number;
  loop?: boolean;
  /** Default: bottom-centre pixel (floor(w/2), h-1). */
  anchor?: Point;
  tags?: readonly string[];
  hasShadow?: boolean;
  /** Also register a horizontally mirrored copy under this name (SE → SW, NE → NW). */
  mirrorAs?: string;
}

export class SpriteRegistry {
  private readonly defs = new Map<string, SpriteDef>();

  add(name: string, input: SpriteInput): SpriteDef {
    if (this.defs.has(name)) throw new Error(`Sprite "${name}" registered twice`);
    const frames = Array.isArray(input.frames)
      ? (input.frames as readonly PixelBuffer[])
      : [input.frames as PixelBuffer];
    const f0 = frames[0];
    if (!f0) throw new Error(`Sprite "${name}" has no frames`);
    for (const f of frames) {
      if (f.w !== f0.w || f.h !== f0.h) throw new Error(`Sprite "${name}": frame sizes differ`);
    }
    const def: SpriteDef = {
      name,
      group: input.group,
      frames,
      fps: input.fps ?? 0,
      loop: input.loop ?? true,
      anchor: input.anchor ?? { x: Math.floor(f0.w / 2), y: f0.h - 1 },
      tags: input.tags ?? [],
      hasShadow: input.hasShadow ?? false,
    };
    this.defs.set(name, def);
    if (input.mirrorAs) {
      this.add(input.mirrorAs, {
        ...input,
        frames: frames.map(mirrorX),
        anchor: mirrorAnchor(def.anchor, f0.w),
        tags: [...def.tags, 'mirrored'],
        mirrorAs: undefined,
      });
    }
    return def;
  }

  get(name: string): SpriteDef {
    const d = this.defs.get(name);
    if (!d) throw new Error(`Unknown sprite "${name}"`);
    return d;
  }

  has(name: string): boolean {
    return this.defs.has(name);
  }

  /** All sprites, in registration order, optionally filtered by group. */
  list(group?: string): SpriteDef[] {
    const all = [...this.defs.values()];
    return group ? all.filter((d) => d.group === group) : all;
  }

  groups(): string[] {
    return [...new Set([...this.defs.values()].map((d) => d.group))];
  }

  get size(): number {
    return this.defs.size;
  }
}
