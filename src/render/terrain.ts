/**
 * Chunked terrain: ground tiles are baked into render textures, one per 16×16-tile chunk,
 * and only chunks overlapping the view are shown. Re-bake a chunk when its tiles change.
 */
import { Container, RenderTexture, Sprite, type Renderer, type Texture } from 'pixi.js';
import { HALF_TH, HALF_TW, type CameraView } from '../core/iso';

export interface TerrainSource {
  readonly tilesU: number;
  readonly tilesV: number;
  /** Texture for tile (i, j) (anchored on the diamond's top vertex) or null for none. */
  tileTexture(i: number, j: number): Texture | null;
}

interface Chunk {
  ci: number;
  cj: number;
  sprite: Sprite;
  rt: RenderTexture;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Extra headroom above a chunk for tiles taller than 16 px (kerbs, raised plazas). */
const TOP_MARGIN = 16;

export class ChunkedTerrain {
  readonly container = new Container({ label: 'terrain-chunks' });
  private chunks: Chunk[] = [];

  constructor(
    private readonly renderer: Renderer,
    private readonly source: TerrainSource,
    readonly chunkSize = 16,
  ) {}

  /** Bake every chunk (call after the art atlas is built). */
  bakeAll(): void {
    for (const c of this.chunks) {
      c.rt.destroy(true);
      c.sprite.destroy();
    }
    this.chunks = [];
    this.container.removeChildren();
    const nu = Math.ceil(this.source.tilesU / this.chunkSize);
    const nv = Math.ceil(this.source.tilesV / this.chunkSize);
    for (let cj = 0; cj < nv; cj++) {
      for (let ci = 0; ci < nu; ci++) this.chunks.push(this.bakeChunk(ci, cj));
    }
  }

  /** Re-bake the chunk containing tile (i, j). */
  rebakeAt(i: number, j: number): void {
    const ci = Math.floor(i / this.chunkSize);
    const cj = Math.floor(j / this.chunkSize);
    const idx = this.chunks.findIndex((c) => c.ci === ci && c.cj === cj);
    if (idx < 0) return;
    const old = this.chunks[idx]!;
    old.rt.destroy(true);
    old.sprite.destroy();
    this.chunks[idx] = this.bakeChunk(ci, cj);
  }

  private bakeChunk(ci: number, cj: number): Chunk {
    const i0 = ci * this.chunkSize;
    const j0 = cj * this.chunkSize;
    const i1 = Math.min(i0 + this.chunkSize, this.source.tilesU);
    const j1 = Math.min(j0 + this.chunkSize, this.source.tilesV);
    // World AABB of the chunk's diamond.
    const minX = (i0 - j1) * HALF_TW;
    const maxX = (i1 - j0) * HALF_TW;
    const minY = (i0 + j0) * HALF_TH - TOP_MARGIN;
    const maxY = (i1 + j1) * HALF_TH;
    const rt = RenderTexture.create({
      width: maxX - minX,
      height: maxY - minY,
      resolution: 1,
      scaleMode: 'nearest',
      antialias: false,
    });
    const tmp = new Container();
    // Draw back to front so taller tiles overlap correctly.
    for (let s = i0 + j0; s <= i1 + j1 - 2; s++) {
      for (let i = i0; i < i1; i++) {
        const j = s - i;
        if (j < j0 || j >= j1) continue;
        const tex = this.source.tileTexture(i, j);
        if (!tex) continue;
        const sp = new Sprite(tex);
        sp.position.set((i - j) * HALF_TW - minX, (i + j) * HALF_TH - minY);
        tmp.addChild(sp);
      }
    }
    this.renderer.render({ container: tmp, target: rt, clear: true, clearColor: [0, 0, 0, 0] });
    tmp.destroy({ children: true });
    const sprite = new Sprite(rt);
    sprite.position.set(minX, minY);
    this.container.addChild(sprite);
    return { ci, cj, sprite, rt, minX, minY, maxX, maxY };
  }

  /** Show only chunks overlapping the camera view. Returns the number visible. */
  cull(view: CameraView): number {
    const hw = view.width / 2 / view.zoom;
    const hh = view.height / 2 / view.zoom;
    const vx0 = view.x - hw;
    const vx1 = view.x + hw;
    const vy0 = view.y - hh;
    const vy1 = view.y + hh;
    let n = 0;
    for (const c of this.chunks) {
      const vis = c.maxX > vx0 && c.minX < vx1 && c.maxY > vy0 && c.minY < vy1;
      c.sprite.visible = vis;
      if (vis) n++;
    }
    return n;
  }

  get chunkCount(): number {
    return this.chunks.length;
  }
}
