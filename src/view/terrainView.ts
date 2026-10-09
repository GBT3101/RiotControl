/**
 * Terrain from the worker-baked chunks (jobs.ts `terrain`): one sprite per 16×16-tile chunk,
 * buffer-backed textures; chunks with water carry WATER_FRAMES frames swapped at WATER_FPS
 * (river shimmer). Off-screen chunks are hidden.
 */
import { BufferImageSource, Sprite, Texture, type Container } from 'pixi.js';
import { WATER_FPS } from '../art/env/ground';
import type { TerrainChunkData } from '../game/assets/jobs';

interface Chunk {
  sprite: Sprite;
  frames: Texture[];
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ViewRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export class TerrainView {
  private readonly chunks: Chunk[] = [];
  visible = 0;

  constructor(parent: Container, data: readonly TerrainChunkData[]) {
    const sorted = [...data].sort((a, b) => a.ci + a.cj - (b.ci + b.cj) || a.ci - b.ci);
    for (const c of sorted) {
      const frames = c.frames.map(
        (buf, k) =>
          new Texture({
            source: new BufferImageSource({
              resource: buf,
              width: c.w,
              height: c.h,
              format: 'rgba8unorm',
              scaleMode: 'nearest',
              autoGenerateMipmaps: false,
              label: `terrain ${c.ci},${c.cj}#${k}`,
            }),
          }),
      );
      const sprite = new Sprite(frames[0]!);
      sprite.position.set(c.x, c.y);
      parent.addChild(sprite);
      this.chunks.push({ sprite, frames, x0: c.x, y0: c.y, x1: c.x + c.w, y1: c.y + c.h });
    }
  }

  update(now: number, view: ViewRect): void {
    const f = Math.floor(now * WATER_FPS);
    let n = 0;
    for (const c of this.chunks) {
      const vis = c.x1 > view.x0 && c.x0 < view.x1 && c.y1 > view.y0 && c.y0 < view.y1;
      c.sprite.visible = vis;
      if (!vis) continue;
      n++;
      if (c.frames.length > 1) c.sprite.texture = c.frames[f % c.frames.length]!;
    }
    this.visible = n;
  }

  /** Upload every chunk texture now (avoids first-frame hitches). */
  sources(): Texture[] {
    return this.chunks.flatMap((c) => c.frames);
  }

  destroy(): void {
    for (const c of this.chunks) {
      for (const t of c.frames) t.destroy(true);
      c.sprite.destroy();
    }
    this.chunks.length = 0;
  }
}
