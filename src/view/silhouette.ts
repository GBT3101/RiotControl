/**
 * Crisp one-colour silhouettes of atlas frames (x-ray ghosts of people behind buildings).
 *
 * A tinted copy of the real sprite smears (dark shading × team colour, plus the cast shadow);
 * instead each frame is copied once into a small silhouette atlas as pure white (opaque pixels
 * only — the semi-transparent cast shadow is dropped): a solid 1-px rim plus a faint flat fill,
 * so `sprite.tint = colour` gives an exact team-colour x-ray outline. Pages are 1024² shelves
 * filled on demand; textures keep the frame's anchor.
 */
import { BufferImageSource, Rectangle, Texture } from 'pixi.js';

const PAGE = 1024;
/** Interior alpha: a crisp 1-px rim in the team colour over a faint flat fill. */
const FILL_ALPHA = 56;

interface Page {
  source: BufferImageSource;
  data: Uint8Array;
  x: number;
  y: number;
  rowH: number;
  dirty: boolean;
}

const pages: Page[] = [];
const cache = new WeakMap<Texture, Texture | null>();

function newPage(): Page {
  const data = new Uint8Array(PAGE * PAGE * 4);
  const source = new BufferImageSource({
    resource: data,
    width: PAGE,
    height: PAGE,
    format: 'rgba8unorm',
    scaleMode: 'nearest',
    resolution: 1,
    autoGenerateMipmaps: false,
    label: `silhouettes#${pages.length}`,
  });
  const p = { source, data, x: 0, y: 0, rowH: 0, dirty: false };
  pages.push(p);
  return p;
}

function alloc(w: number, h: number): { p: Page; x: number; y: number } | null {
  if (w + 1 > PAGE || h + 1 > PAGE) return null;
  let p = pages[pages.length - 1] ?? newPage();
  if (p.x + w + 1 > PAGE) {
    p.x = 0;
    p.y += p.rowH;
    p.rowH = 0;
  }
  if (p.y + h + 1 > PAGE) {
    // Cap the number of pages (silhouettes are a garnish).
    if (pages.length >= 4) return null;
    p = newPage();
  }
  const r = { p, x: p.x, y: p.y };
  p.x += w + 1;
  p.rowH = Math.max(p.rowH, h + 1);
  return r;
}

/** White silhouette of an atlas frame (buffer-backed pages only), or null. */
export function silhouetteOf(tex: Texture): Texture | null {
  const hit = cache.get(tex);
  if (hit !== undefined) return hit;
  const src = tex.source.resource as unknown;
  let out: Texture | null = null;
  if (src instanceof Uint8Array) {
    const f = tex.frame;
    const w = Math.round(f.width);
    const h = Math.round(f.height);
    const a = alloc(w, h);
    if (a) {
      const pw = tex.source.width;
      const d = a.p.data;
      // Opaque pixels only (cast shadows are ≈45 % alpha).
      const solid = (x: number, y: number): boolean =>
        x >= 0 && y >= 0 && x < w && y < h && src[((f.y + y) * pw + f.x + x) * 4 + 3]! >= 200;
      for (let y = 0; y < h; y++) {
        let o = ((a.y + y) * PAGE + a.x) * 4;
        for (let x = 0; x < w; x++, o += 4) {
          if (!solid(x, y)) continue;
          const edge = !solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1);
          d[o] = d[o + 1] = d[o + 2] = 255;
          d[o + 3] = edge ? 255 : FILL_ALPHA;
        }
      }
      a.p.dirty = true;
      out = new Texture({
        source: a.p.source,
        frame: new Rectangle(a.x, a.y, w, h),
        defaultAnchor: tex.defaultAnchor ? { ...tex.defaultAnchor } : { x: 0.5, y: 1 },
        label: `sil:${tex.label ?? ''}`,
      });
    }
  }
  cache.set(tex, out);
  return out;
}

/** Upload silhouette pages written this frame (call once per frame). */
export function flushSilhouettes(): void {
  for (const p of pages) {
    if (!p.dirty) continue;
    p.dirty = false;
    p.source.update();
  }
}
