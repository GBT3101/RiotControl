/**
 * Permanent ground marks baked into one render texture covering the map: blood splats, scorch,
 * rubble, litter, tyre marks, and bodies above the live-body cap (oldest-first). Bakes are
 * queued and rendered in one batch per frame.
 */
import { Container, RenderTexture, Sprite, type Renderer, type Texture } from 'pixi.js';
import { art } from '../art/lib/atlas';
import { mapWorldBounds } from '../core/iso';

interface Bake {
  tex: Texture;
  x: number;
  y: number;
  alpha: number;
  flip: boolean;
  tint: number;
}

export class DecalLayer {
  readonly sprite: Sprite;
  private readonly rt: RenderTexture;
  private readonly ox: number;
  private readonly oy: number;
  private readonly queue: Bake[] = [];
  private readonly batch = new Container();
  private readonly pool: Sprite[] = [];
  /** Total bakes (diagnostics). */
  baked = 0;

  constructor(
    private readonly renderer: Renderer,
    tilesW: number,
    tilesH: number,
  ) {
    const b = mapWorldBounds(tilesW, tilesH);
    const margin = 32;
    this.ox = Math.floor(b.minX - margin);
    this.oy = Math.floor(b.minY - margin);
    this.rt = RenderTexture.create({
      width: Math.ceil(b.maxX - b.minX + margin * 2),
      height: Math.ceil(b.maxY - b.minY + margin * 2),
      resolution: 1,
      scaleMode: 'nearest',
      antialias: false,
    });
    this.sprite = new Sprite(this.rt);
    this.sprite.position.set(this.ox, this.oy);
    this.sprite.label = 'decal-rt';
    // Clear once.
    this.renderer.render({
      container: this.batch,
      target: this.rt,
      clear: true,
      clearColor: [0, 0, 0, 0],
    });
  }

  /** Queue a sprite (by name or texture) anchored at world (x, y). */
  bake(
    what: string | Texture,
    x: number,
    y: number,
    o: { alpha?: number; flip?: boolean; frame?: number; tint?: number } = {},
  ): void {
    let tex: Texture;
    if (typeof what === 'string') {
      if (!art.has(what)) return;
      const clip = art.anim(what);
      tex = clip.frames[Math.min(o.frame ?? 0, clip.frames.length - 1)]!;
    } else tex = what;
    if (this.queue.length > 400) return;
    this.queue.push({
      tex,
      x: Math.round(x),
      y: Math.round(y),
      alpha: o.alpha ?? 1,
      flip: o.flip ?? false,
      tint: o.tint ?? 0xffffff,
    });
  }

  flush(): void {
    if (this.queue.length === 0) return;
    let k = 0;
    for (const b of this.queue) {
      let s = this.pool[k];
      if (!s) {
        s = new Sprite();
        this.pool.push(s);
        this.batch.addChild(s);
      }
      k++;
      s.visible = true;
      s.texture = b.tex;
      const a = b.tex.defaultAnchor;
      s.anchor.set(a?.x ?? 0, a?.y ?? 0);
      s.position.set(b.x - this.ox + (b.flip ? 1 : 0), b.y - this.oy);
      s.scale.x = b.flip ? -1 : 1;
      s.alpha = b.alpha;
      s.tint = b.tint;
    }
    for (let i = k; i < this.pool.length; i++) this.pool[i]!.visible = false;
    this.renderer.render({ container: this.batch, target: this.rt, clear: false });
    this.baked += this.queue.length;
    this.queue.length = 0;
  }

  destroy(): void {
    this.sprite.destroy();
    this.rt.destroy(true);
    this.batch.destroy({ children: true });
  }
}
