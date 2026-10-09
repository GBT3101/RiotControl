/**
 * Atlas: packs every registered sprite frame into a few GPU texture pages at boot and exposes
 * the art lookup API used by game code:
 *
 *   await buildArt(registry);          // once at boot (after registerAllArt)
 *   new Sprite(art.tex('tile.grass')); // static sprite (anchor pre-set from the def)
 *   const clip = art.anim('unit.riot.walk.se');
 *   sprite.texture = clip.frames[clip.frameAt(timeSeconds)];
 *
 * Textures use nearest-neighbour sampling; `defaultAnchor` is set so that a Sprite positioned
 * at an integer world pixel puts the def's anchor pixel exactly there.
 */
import { BufferImageSource, CanvasSource, Rectangle, Texture } from 'pixi.js';
import { packShelves } from './packer';
import type { SpriteDef, SpriteRegistry } from './registry';
import type { PixelBuffer, Point } from './pixels';

export interface AnimClip {
  readonly name: string;
  readonly frames: readonly Texture[];
  readonly fps: number;
  readonly loop: boolean;
  readonly anchor: Point;
  readonly width: number;
  readonly height: number;
  /** Frame index for a time in seconds (loops or clamps on the last frame). */
  frameAt(t: number): number;
  /** Duration of one pass in seconds (0 for static). */
  readonly duration: number;
}

export interface AtlasPage {
  /** Canvas backing (buildArt) — absent for buffer-backed pages (packSprites/installPacked). */
  canvas?: HTMLCanvasElement;
  texture: Texture;
}

/** Sprite description without pixels attached to the registry (packing input). */
export type PackableDef = Pick<
  SpriteDef,
  'name' | 'group' | 'frames' | 'fps' | 'loop' | 'anchor' | 'tags' | 'hasShadow'
>;

/** DOM-free packed atlas: RGBA page buffers + frame rectangles (transferable). */
export interface PackedAtlas {
  pages: Array<{ w: number; h: number; data: Uint8Array }>;
  sprites: Array<{
    def: Omit<PackableDef, 'frames'> & { w: number; h: number };
    frames: Array<{ page: number; x: number; y: number }>;
  }>;
}

/** Pack sprite frames into RGBA page buffers (pure; runs in workers and Node). */
export function packSprites(defs: readonly PackableDef[], pageSize = 2048): PackedAtlas {
  const items: Array<{ d: number; f: number; buf: PixelBuffer }> = [];
  defs.forEach((def, d) => def.frames.forEach((buf, f) => items.push({ d, f, buf })));
  const { placements, pages } = packShelves(
    items.map((i) => ({ w: i.buf.w, h: i.buf.h })),
    pageSize,
    1,
  );
  const out: PackedAtlas = {
    pages: pages.map((p) => {
      const w = Math.max(1, p.w);
      const h = Math.max(1, p.h);
      return { w, h, data: new Uint8Array(w * h * 4) };
    }),
    sprites: defs.map((def) => {
      const f0 = def.frames[0]!;
      return {
        def: {
          name: def.name,
          group: def.group,
          fps: def.fps,
          loop: def.loop,
          anchor: def.anchor,
          tags: def.tags,
          hasShadow: def.hasShadow,
          w: f0.w,
          h: f0.h,
        },
        frames: [],
      };
    }),
  };
  items.forEach((it, i) => {
    const pl = placements[i]!;
    const page = out.pages[pl.page]!;
    const src = it.buf.data;
    const rowBytes = it.buf.w * 4;
    for (let y = 0; y < it.buf.h; y++) {
      page.data.set(
        src.subarray(y * rowBytes, (y + 1) * rowBytes),
        ((pl.y + y) * page.w + pl.x) * 4,
      );
    }
    out.sprites[it.d]!.frames[it.f] = { page: pl.page, x: pl.x, y: pl.y };
  });
  return out;
}

/**
 * Turn a packed atlas into GPU textures (nearest, premultiplied on upload) and merge its clips
 * into `target` (default: the global `art`). Returns the created pages.
 */
export function installPacked(packed: PackedAtlas, target: Art = art): AtlasPage[] {
  const pages: AtlasPage[] = packed.pages.map((p, i) => {
    const source = new BufferImageSource({
      resource: p.data,
      width: p.w,
      height: p.h,
      format: 'rgba8unorm',
      scaleMode: 'nearest',
      resolution: 1,
      autoGenerateMipmaps: false,
      label: `atlas#${i}`,
    });
    return { texture: new Texture({ source }) };
  });
  const clips = new Map<string, AnimClip>();
  for (const s of packed.sprites) {
    const d = s.def;
    const frames = s.frames.map(
      (f, k) =>
        new Texture({
          source: pages[f.page]!.texture.source,
          label: `${d.name}#${k}`,
          frame: new Rectangle(f.x, f.y, d.w, d.h),
          defaultAnchor: { x: d.anchor.x / d.w, y: d.anchor.y / d.h },
        }),
    );
    const sizeOnly = { w: d.w, h: d.h, data: new Uint8ClampedArray(0) };
    const def = { ...d, frames: frames.map(() => sizeOnly) } as SpriteDef;
    clips.set(d.name, makeClip(def, frames));
  }
  target._merge(clips, pages);
  return pages;
}

class Art {
  private clips = new Map<string, AnimClip>();
  pages: AtlasPage[] = [];
  private built = false;

  /** Static texture (frame `frame` of the sprite, default 0). */
  tex(name: string, frame = 0): Texture {
    const c = this.anim(name);
    const t = c.frames[frame];
    if (!t) throw new Error(`art.tex: "${name}" has no frame ${frame}`);
    return t;
  }

  anim(name: string): AnimClip {
    const c = this.clips.get(name);
    if (!c) {
      throw new Error(
        this.built ? `art: unknown sprite "${name}"` : `art: atlas not built (asked "${name}")`,
      );
    }
    return c;
  }

  has(name: string): boolean {
    return this.clips.has(name);
  }

  names(): string[] {
    return [...this.clips.keys()];
  }

  /** @internal */
  _install(clips: Map<string, AnimClip>, pages: AtlasPage[]): void {
    this.clips = clips;
    this.pages = pages;
    this.built = true;
  }

  /**
   * Merge more clips/pages into this atlas (lazy loading: a core set at boot, per-city sets at
   * map load). Existing names are replaced.
   */
  _merge(clips: Map<string, AnimClip>, pages: AtlasPage[]): void {
    for (const [k, v] of clips) this.clips.set(k, v);
    this.pages.push(...pages);
    this.built = true;
  }

  /** Forget clips whose name starts with `prefix` (city switch); pages are the caller's to destroy. */
  removePrefix(prefix: string): void {
    for (const k of [...this.clips.keys()]) if (k.startsWith(prefix)) this.clips.delete(k);
  }
}

/** Global art lookup, populated by buildArt(). */
export const art = new Art();

export function makeClip(def: SpriteDef, frames: readonly Texture[]): AnimClip {
  const n = frames.length;
  const f0 = def.frames[0]!;
  const duration = def.fps > 0 ? n / def.fps : 0;
  return {
    name: def.name,
    frames,
    fps: def.fps,
    loop: def.loop,
    anchor: def.anchor,
    width: f0.w,
    height: f0.h,
    duration,
    frameAt(t: number): number {
      if (def.fps <= 0 || n <= 1) return 0;
      const i = Math.floor(t * def.fps);
      return def.loop ? ((i % n) + n) % n : Math.min(Math.max(i, 0), n - 1);
    },
  };
}

function bufferToCanvas(page: { w: number; h: number }): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  img: ImageData;
} {
  const canvas = document.createElement('canvas');
  canvas.width = page.w;
  canvas.height = page.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('atlas: no 2D context');
  return { canvas, ctx, img: ctx.createImageData(page.w, page.h) };
}

function writeFrame(img: ImageData, buf: PixelBuffer, x0: number, y0: number): void {
  for (let y = 0; y < buf.h; y++) {
    const srcStart = y * buf.w * 4;
    img.data.set(
      buf.data.subarray(srcStart, srcStart + buf.w * 4),
      ((y0 + y) * img.width + x0) * 4,
    );
  }
}

/**
 * Pack a registry into atlas pages and install the result into `art` (or a fresh Art for
 * dynamic sets such as per-wave protester variants — pass `target`).
 */
export function buildArt(registry: SpriteRegistry, pageSize = 2048, target: Art = art): Art {
  const defs = registry.list();
  const items: Array<{ def: SpriteDef; frame: number; buf: PixelBuffer }> = [];
  for (const def of defs) def.frames.forEach((buf, frame) => items.push({ def, frame, buf }));
  const { placements, pages } = packShelves(
    items.map((i) => ({ w: i.buf.w, h: i.buf.h })),
    pageSize,
    1,
  );

  const pageData = pages.map((p) => bufferToCanvas({ w: Math.max(1, p.w), h: Math.max(1, p.h) }));
  items.forEach((it, i) => {
    const pl = placements[i]!;
    writeFrame(pageData[pl.page]!.img, it.buf, pl.x, pl.y);
  });
  const atlasPages: AtlasPage[] = pageData.map(({ canvas, ctx, img }) => {
    ctx.putImageData(img, 0, 0);
    const source = new CanvasSource({ resource: canvas, scaleMode: 'nearest', resolution: 1 });
    return { canvas, texture: new Texture({ source }) };
  });

  const frameTex = new Map<SpriteDef, Texture[]>();
  items.forEach((it, i) => {
    const pl = placements[i]!;
    const source = atlasPages[pl.page]!.texture.source;
    const t = new Texture({
      source,
      label: `${it.def.name}#${it.frame}`,
      frame: new Rectangle(pl.x, pl.y, it.buf.w, it.buf.h),
      defaultAnchor: { x: it.def.anchor.x / it.buf.w, y: it.def.anchor.y / it.buf.h },
    });
    let list = frameTex.get(it.def);
    if (!list) frameTex.set(it.def, (list = []));
    list[it.frame] = t;
  });

  const clips = new Map<string, AnimClip>();
  for (const def of defs) clips.set(def.name, makeClip(def, frameTex.get(def) ?? []));
  target._install(clips, atlasPages);
  return target;
}

export type { Art };
export function createArt(): Art {
  return new Art();
}
