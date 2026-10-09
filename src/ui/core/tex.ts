/**
 * Texture helpers for the pixel UI: PixelBuffer → nearest-sampled Texture, a keyed cache for
 * static pieces (panels, buttons, icons) and pixel extraction from the worker-built atlas (unit
 * portraits, protester sprites) so the UI kit generators can compose them into cards.
 */
import { Texture, type Container } from 'pixi.js';
import { art } from '../../art/lib/atlas';
import { createBuffer, type PixelBuffer } from '../../art/lib/pixels';
import { bufferTexture } from '../../art/uikit/pixi';

const cache = new Map<string, Texture>();
/** Textures owned by a sprite (not cached): freed by `destroyOwned`. */
const owned = new WeakSet<Texture>();

/** Mark a texture as owned by whoever displays it (freed by `destroyOwned`). */
export function markOwned<T extends Texture>(t: T): T {
  owned.add(t);
  return t;
}

/**
 * Destroy a UI subtree and every owned texture shown in it (cached `uiTex` textures and atlas
 * frames stay). Use instead of `root.destroy({ children: true })` for HUD/screens: dynamic
 * panels, labels and counters would otherwise leak their GPU textures on every restart.
 */
export function destroyOwned(root: Container): void {
  const walk = (c: Container): void => {
    const t = (c as Container & { texture?: Texture }).texture;
    if (t && owned.has(t)) {
      owned.delete(t);
      if (!t.destroyed) t.destroy(true);
    }
    for (const ch of c.children) walk(ch);
  };
  walk(root);
  root.destroy({ children: true });
}

/** Cached static texture (generated once per key). */
export function uiTex(key: string, make: () => PixelBuffer): Texture {
  let t = cache.get(key);
  if (!t) {
    t = bufferTexture(make(), key);
    cache.set(key, t);
  }
  return t;
}

/** Uncached texture (caller owns it: destroy(true) when replaced). */
export function ownTex(buf: PixelBuffer, label = 'ui'): Texture {
  return markOwned(bufferTexture(buf, label));
}

/** Replace a sprite-owned texture, destroying the previous one if it was owned. */
export function swapOwned(
  holder: { texture: Texture },
  buf: PixelBuffer,
  label = 'ui:owned',
): void {
  const old = holder.texture;
  holder.texture = markOwned(bufferTexture(buf, label));
  if (old && old !== Texture.EMPTY && (old.label === label || owned.has(old))) {
    owned.delete(old);
    old.destroy(true);
  }
}

const extracted = new Map<string, PixelBuffer | null>();

/**
 * Pixels of a sprite in the global atlas (null if missing or not CPU-readable). Atlas pages
 * from the art workers are BufferImageSources whose `resource` is the raw RGBA page.
 */
export function atlasBuffer(name: string, frame = 0): PixelBuffer | null {
  const key = `${name}#${frame}`;
  if (extracted.has(key)) return extracted.get(key)!;
  if (!art.has(name)) return null;
  let out: PixelBuffer | null = null;
  try {
    const t = art.tex(name, frame);
    const src = t.source as unknown as {
      resource?: unknown;
      pixelWidth?: number;
      width: number;
    };
    const res = src.resource;
    const pw = src.pixelWidth ?? src.width;
    if (res instanceof Uint8Array || res instanceof Uint8ClampedArray) {
      const f = t.frame;
      const b = createBuffer(f.width, f.height);
      for (let y = 0; y < f.height; y++) {
        const o = ((f.y + y) * pw + f.x) * 4;
        b.data.set(res.subarray(o, o + f.width * 4), y * f.width * 4);
      }
      out = b;
    }
  } catch {
    out = null;
  }
  // Only cache hits: a missing sprite may arrive with deferred art.
  if (out) extracted.set(key, out);
  return out;
}

/** Forget extracted pixels (city switch: atlas pages were replaced). */
export function clearAtlasBuffers(): void {
  extracted.clear();
}
