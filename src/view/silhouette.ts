/**
 * Crisp one-colour silhouettes of atlas frames (x-ray ghosts of people behind buildings).
 *
 * A tinted copy of the real sprite smears (dark shading × team colour, plus the cast shadow);
 * instead each frame is copied once into a small silhouette atlas as pure white (opaque pixels
 * only — the semi-transparent cast shadow is dropped): a dim 1-px rim and no fill, so
 * `sprite.tint = colour` gives an exact team-colour x-ray outline. Pages are 1024² shelves
 * filled on demand; textures keep the frame's anchor.
 *
 * M13a — ghosts are a hint, not a second crowd: `GhostGate` decides which hidden allies get
 * one (selected, in combat, or near the camera focus; at most one per screen cell, capped),
 * and `GhostMarkers` draws a single small team-coloured chevron over each group of hidden
 * allies that got no ghost, instead of a stack of outlines.
 */
import { BufferImageSource, Rectangle, Sprite, Texture, type Container } from 'pixi.js';

const PAGE = 1024;
/** Rim alpha (team colour from the layer tint): a dim 1-px outline, no interior fill. */
const RIM_ALPHA = 168;
const FILL_ALPHA = 0;

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
          d[o + 3] = edge ? RIM_ALPHA : FILL_ALPHA;
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

/* ------------------------------------------------------------------ gating */

export interface GhostGateOptions {
  /** Max ghosts per frame (selected units always get theirs). */
  max: number;
  /** Radius around the focus point (world px, iso-corrected: hypot(dx, 2·dy)). */
  radius: number;
  /** De-stacking cell (world px): one ghost per cell. */
  cellW: number;
  cellH: number;
  /** Marker cell (world px): one chevron per cell for allies refused a ghost. */
  groupW: number;
  groupH: number;
  /** Smallest group that earns a chevron. */
  minGroup: number;
}

export interface GhostGroup {
  /** Head position (world px) of the topmost hidden ally of the group. */
  x: number;
  y: number;
  n: number;
}

const DEFAULT_GATE: GhostGateOptions = {
  max: 8,
  radius: 120,
  cellW: 28,
  cellH: 20,
  groupW: 72,
  groupH: 48,
  minGroup: 2,
};

/**
 * Per-frame policy for ally x-ray ghosts. Call `begin(focusX, focusY)` once per frame, then
 * `allow(...)` for every fully hidden ally (x, y = feet, world px). Allies refused a ghost are
 * tallied per cell into `groups` (for `GhostMarkers`).
 */
export class GhostGate {
  private readonly o: GhostGateOptions;
  private readonly used = new Set<number>();
  private count = 0;
  private fx = 0;
  private fy = 0;
  private readonly tally = new Map<number, GhostGroup>();

  constructor(opts: Partial<GhostGateOptions> = {}) {
    this.o = { ...DEFAULT_GATE, ...opts };
  }

  begin(focusX: number, focusY: number): void {
    this.used.clear();
    this.tally.clear();
    this.count = 0;
    this.fx = focusX;
    this.fy = focusY;
  }

  private key(x: number, y: number): number {
    return Math.floor(x / this.o.cellW) * 65536 + Math.floor(y / this.o.cellH);
  }

  /** Should this fully hidden ally get a ghost? `head` = sprite height above the feet. */
  allow(x: number, y: number, selected: boolean, engaged: boolean, head = 18): boolean {
    const k = this.key(x, y);
    if (selected) {
      this.used.add(k);
      this.count++;
      return true;
    }
    const near = Math.hypot(x - this.fx, (y - this.fy) * 2) <= this.o.radius;
    if ((engaged || near) && this.count < this.o.max && !this.used.has(k)) {
      this.used.add(k);
      this.count++;
      return true;
    }
    const gk = Math.floor(x / this.o.groupW) * 65536 + Math.floor(y / this.o.groupH);
    const g = this.tally.get(gk);
    if (!g) this.tally.set(gk, { x, y: y - head, n: 1 });
    else {
      g.n++;
      if (y - head < g.y) {
        g.x = x;
        g.y = y - head;
      }
    }
    return false;
  }

  /** Groups (≥ minGroup) of hidden allies that got no ghost. */
  *groups(): IterableIterator<GhostGroup> {
    for (const g of this.tally.values()) if (g.n >= this.o.minGroup) yield g;
  }
}

/* ----------------------------------------------------------------- markers */

/** 5×4 chevron (white; tinted by the ghost layer) with a 1-px dark keyline. */
const CHEVRON = ['XXXXX', '.XXX.', '..X..'];
let chevronTex: Texture | null = null;

function chevron(): Texture {
  if (chevronTex) return chevronTex;
  const w = 7;
  const h = 5;
  const data = new Uint8Array(w * h * 4);
  const on = (x: number, y: number): boolean =>
    x >= 1 && y >= 1 && x <= 5 && y <= 3 && CHEVRON[y - 1]![x - 1] === 'X';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (on(x, y)) {
        data[o] = data[o + 1] = data[o + 2] = 255;
        data[o + 3] = 230;
      } else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) {
        // Keyline: near-black so the chevron reads on bright roofs (tint keeps it dark).
        data[o] = 26;
        data[o + 1] = 20;
        data[o + 2] = 36;
        data[o + 3] = 200;
      }
    }
  }
  const source = new BufferImageSource({
    resource: data,
    width: w,
    height: h,
    format: 'rgba8unorm',
    scaleMode: 'nearest',
    resolution: 1,
    autoGenerateMipmaps: false,
    label: 'ghost-chevron',
  });
  chevronTex = new Texture({ source, defaultAnchor: { x: 0.5, y: 1 }, label: 'ghost-chevron' });
  return chevronTex;
}

/**
 * One small chevron per group of hidden allies without a ghost (a "your people are behind
 * this block" pip). Sprites are pooled inside `parent` (the ally ghost layer: tinted, on top).
 */
export class GhostMarkers {
  private readonly pool: Sprite[] = [];

  constructor(
    private readonly parent: Container,
    private readonly max = 12,
  ) {}

  draw(groups: Iterable<GhostGroup>, now: number): void {
    let n = 0;
    for (const g of groups) {
      if (n >= this.max) break;
      let s = this.pool[n];
      if (!s) {
        s = new Sprite(chevron());
        this.parent.addChild(s);
        this.pool.push(s);
      }
      // Gentle 1-px bob (integer positions only).
      const bob = Math.floor(now * 2 + g.x * 0.05) % 2;
      s.position.set(Math.round(g.x), Math.round(g.y - 3 - bob));
      s.visible = true;
      n++;
    }
    for (let k = n; k < this.pool.length; k++) this.pool[k]!.visible = false;
  }
}
