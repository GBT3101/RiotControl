/**
 * M4a unit-art kit: a tiny "pose compositor" on top of the shared art pipeline.
 *
 * Every unit is authored as a **part book** (hand-drawn key grids, see `*.grid.ts`) plus
 * **pose strings** that place parts on a fixed per-unit canvas. Each part is drawn at its
 * natural position (header `== name x,y` = top-left on the canvas), so a pose only states
 * which parts appear, in painter's order, with small deltas:
 *
 *   'shadow legs.walk:3 >0,1 torso head arm.near:2+1,0 !flash'
 *
 *   name          part `name`, frame 0, at its home position
 *   name:2        frame 2 of a multi-frame part
 *   name+1,-1     shifted by (1, -1)
 *   name@4,7      placed with its top-left at (4, 7) instead of its home position
 *   ~name         horizontally mirrored (around its own box)
 *   name%1        rotated 90° clockwise ×n (pre-drawn spin frames; light direction rotates too)
 *   >dx,dy        group offset applied to every following token (body bob); '>' alone resets
 *   !name         drawn after the outline pass (muzzle flashes, glints — no ink outline)
 *   _name         drawn before everything else, never outlined (ground shadows / decals)
 *
 * Frames are composed palette-pure (lib/pixels `blit`), auto-outlined in `ink`, and registered
 * for SE / NE (+ mirrored SW / NW). Static metadata (impact frames, muzzle pixels) lives next to
 * the poses so integrators can read it without building textures — see `catalog.ts`.
 */
import { resolveColor } from '../palette';
import { keyGrid, renderKeys, type KeyGrid, type KeyMap, type SlotMap } from '../lib/grid';
import {
  blit,
  cloneBuffer,
  createBuffer,
  mirrorX,
  outline,
  type PixelBuffer,
  type Point,
} from '../lib/pixels';
import type { SpriteRegistry } from '../lib/registry';

// ---------------------------------------------------------------------------------------------
// Part books
// ---------------------------------------------------------------------------------------------

export interface Part {
  readonly name: string;
  readonly frames: readonly KeyGrid[];
  /** Home position (top-left on the unit canvas). */
  readonly x: number;
  readonly y: number;
}

export type PartBook = ReadonlyMap<string, Part>;

/**
 * Parse a part book: blocks introduced by `== name x,y` headers, frames separated by blank
 * lines. Rows are trimmed; `#` starts a comment line.
 */
export function parseParts(src: string, bookName = 'parts'): Map<string, Part> {
  const book = new Map<string, Part>();
  let cur: { name: string; x: number; y: number; frames: string[][] } | null = null;
  let rows: string[] = [];
  const flushFrame = (): void => {
    if (cur && rows.length) cur.frames.push(rows);
    rows = [];
  };
  const flushPart = (): void => {
    flushFrame();
    if (!cur) return;
    if (book.has(cur.name)) throw new Error(`${bookName}: duplicate part "${cur.name}"`);
    const c = cur;
    if (c.frames.length === 0) throw new Error(`${bookName}: part "${c.name}" is empty`);
    book.set(c.name, {
      name: c.name,
      x: c.x,
      y: c.y,
      frames: c.frames.map((f, i) => keyGrid(f, `${bookName}:${c.name}[${i}]`)),
    });
    cur = null;
  };
  for (const raw of src.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (line.startsWith('==')) {
      flushPart();
      const m = /^==\s*([\w.-]+)(?:\s+(-?\d+)\s*,\s*(-?\d+))?\s*$/.exec(line);
      if (!m) throw new Error(`${bookName}: bad header "${line}"`);
      cur = { name: m[1]!, x: Number(m[2] ?? 0), y: Number(m[3] ?? 0), frames: [] };
      continue;
    }
    if (line.startsWith('#')) continue;
    if (line === '') {
      flushFrame();
      continue;
    }
    if (!cur) throw new Error(`${bookName}: grid row before any "== part" header: "${line}"`);
    rows.push(line);
  }
  flushPart();
  return book;
}

/** Merge several books (later books may not redefine earlier parts). */
export function mergeBooks(...books: ReadonlyArray<ReadonlyMap<string, Part>>): Map<string, Part> {
  const out = new Map<string, Part>();
  for (const b of books) {
    for (const [k, v] of b) {
      if (out.has(k)) throw new Error(`mergeBooks: duplicate part "${k}"`);
      out.set(k, v);
    }
  }
  return out;
}

/** Merge books where later books may override earlier parts of the same name. */
export function overrideBooks(...books: ReadonlyArray<ReadonlyMap<string, Part>>): Map<string, Part> {
  const out = new Map<string, Part>();
  for (const b of books) for (const [k, v] of b) out.set(k, v);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Poses
// ---------------------------------------------------------------------------------------------

interface Token {
  name: string;
  frame: number;
  dx: number;
  dy: number;
  abs: Point | null;
  mirror: boolean;
  rot: number;
  layer: 'pre' | 'body' | 'post';
}

const TOKEN_RE = /^([!_]?)(~?)([\w.-]+?)(?::(\d+))?(?:%(\d))?(?:([+@])(-?\d+),(-?\d+))?$/;

export function parsePose(pose: string): Token[] {
  const out: Token[] = [];
  let gx = 0;
  let gy = 0;
  for (const t of pose.trim().split(/\s+/)) {
    if (t === '') continue;
    if (t.startsWith('>')) {
      if (t === '>') {
        gx = gy = 0;
      } else {
        const m = /^>(-?\d+),(-?\d+)$/.exec(t);
        if (!m) throw new Error(`pose: bad group offset "${t}" in "${pose}"`);
        gx = Number(m[1]);
        gy = Number(m[2]);
      }
      continue;
    }
    const m = TOKEN_RE.exec(t);
    if (!m) throw new Error(`pose: bad token "${t}" in "${pose}"`);
    const isAbs = m[6] === '@';
    const px = Number(m[7] ?? 0);
    const py = Number(m[8] ?? 0);
    out.push({
      layer: m[1] === '!' ? 'post' : m[1] === '_' ? 'pre' : 'body',
      mirror: m[2] === '~',
      name: m[3]!,
      frame: Number(m[4] ?? 0),
      rot: Number(m[5] ?? 0) % 4,
      dx: (isAbs ? 0 : px) + gx,
      dy: (isAbs ? 0 : py) + gy,
      abs: isAbs ? { x: px, y: py } : null,
    });
  }
  return out;
}

export interface Canvas {
  readonly w: number;
  readonly h: number;
}

export interface Look {
  readonly keys: KeyMap;
  readonly slots?: SlotMap;
}

const INK = resolveColor('ink');
const WHITE = resolveColor('white');

const renderCache = new WeakMap<KeyGrid, Map<string, PixelBuffer>>();

function renderPart(g: KeyGrid, look: Look, ctx: string): PixelBuffer {
  let byLook = renderCache.get(g);
  if (!byLook) {
    byLook = new Map();
    renderCache.set(g, byLook);
  }
  const key = lookKey(look);
  let buf = byLook.get(key);
  if (!buf) {
    buf = renderKeys(g, look.keys, { slots: look.slots }, ctx);
    byLook.set(key, buf);
  }
  return buf;
}

const lookIds = new WeakMap<object, number>();
let nextLookId = 1;
function lookKey(look: Look): string {
  const id = (o: object | undefined): number => {
    if (!o) return 0;
    let n = lookIds.get(o);
    if (n === undefined) {
      n = nextLookId++;
      lookIds.set(o, n);
    }
    return n;
  };
  return `${id(look.keys)}/${id(look.slots)}`;
}

/** Compose one pose into a palette-pure, ink-outlined frame. */
export function composePose(
  book: PartBook,
  look: Look,
  canvas: Canvas,
  pose: string,
  ctx = 'pose',
  origin: Point = { x: 0, y: 0 },
): PixelBuffer {
  const tokens = parsePose(pose);
  const out = createBuffer(canvas.w, canvas.h);
  const draw = (target: PixelBuffer, t: Token): void => {
    const part = book.get(t.name);
    if (!part) throw new Error(`${ctx}: unknown part "${t.name}" in "${pose}"`);
    const g = part.frames[t.frame];
    if (!g) throw new Error(`${ctx}: part "${t.name}" has no frame ${t.frame}`);
    let img = renderPart(g, look, `${ctx}:${t.name}`);
    if (t.mirror) img = mirrorX(img);
    for (let r = 0; r < t.rot; r++) img = rotate90(img);
    const x = (t.abs ? t.abs.x : part.x) + t.dx + origin.x;
    const y = (t.abs ? t.abs.y : part.y) + t.dy + origin.y;
    blit(target, img, x, y);
  };
  // Body first (outlined), shadows + post layers composited around it.
  for (const t of tokens) if (t.layer === 'body') draw(out, t);
  outline(out, INK);
  const pre = tokens.filter((t) => t.layer === 'pre');
  let result = out;
  if (pre.length) {
    result = createBuffer(canvas.w, canvas.h);
    for (const t of pre) draw(result, t);
    blit(result, out, 0, 0);
  }
  for (const t of tokens) if (t.layer === 'post') draw(result, t);
  return result;
}

/** White hit-flash: every opaque pixel except ink becomes `white` (outline stays). */
export function whiteFlash(src: PixelBuffer): PixelBuffer {
  const out = cloneBuffer(src);
  const d = out.data;
  const ink = [(INK >>> 24) & 255, (INK >>> 16) & 255, (INK >>> 8) & 255];
  const wh = [(WHITE >>> 24) & 255, (WHITE >>> 16) & 255, (WHITE >>> 8) & 255];
  const exterior = (x: number, y: number): boolean =>
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => {
      const nx = x + dx!;
      const ny = y + dy!;
      if (nx < 0 || ny < 0 || nx >= src.w || ny >= src.h) return true;
      return src.data[(ny * src.w + nx) * 4 + 3]! !== 255;
    });
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! !== 255) continue;
    const p = i / 4;
    const isInk = d[i] === ink[0] && d[i + 1] === ink[1] && d[i + 2] === ink[2];
    if (isInk && exterior(p % src.w, Math.floor(p / src.w))) continue;
    d[i] = wh[0]!;
    d[i + 1] = wh[1]!;
    d[i + 2] = wh[2]!;
  }
  return out;
}

/** Rotate 90° clockwise (exact pixel permutation). */
export function rotate90(src: PixelBuffer): PixelBuffer {
  const out = createBuffer(src.h, src.w);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const si = (y * src.w + x) * 4;
      const di = (x * out.w + (src.h - 1 - y)) * 4;
      for (let k = 0; k < 4; k++) out.data[di + k] = src.data[si + k]!;
    }
  }
  return out;
}

/** Shift a frame by (dx, dy) on the same canvas; pixels pushed outside are dropped. */
export function shift(src: PixelBuffer, dx: number, dy: number): PixelBuffer {
  const out = createBuffer(src.w, src.h);
  blit(out, src, dx, dy);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Unit definitions → registry
// ---------------------------------------------------------------------------------------------

export type Facing = 'se' | 'ne';
export const MIRROR_OF: Readonly<Record<Facing, 'sw' | 'nw'>> = { se: 'sw', ne: 'nw' };

export interface AnimDef {
  /** Animation name (third segment of the sprite name). */
  readonly anim: string;
  readonly fps: number;
  readonly loop: boolean;
  /** Poses per facing. `ne` may be omitted for facing-agnostic anims (registered SE/SW only). */
  readonly se: readonly string[];
  readonly ne?: readonly string[];
  /** Frame index on which the hit/shot lands (attacks). */
  readonly impact?: number;
  /** Muzzle / release pixel per frame (SE canvas coords, null = no flash that frame). */
  readonly muzzle?: { readonly se: readonly (Point | null)[]; readonly ne?: readonly (Point | null)[] };
  /** Free text for the catalog. */
  readonly note?: string;
}

export interface UnitDef {
  readonly id: string;
  readonly group: string;
  readonly canvas: Canvas;
  /** Ground-contact pixel (SE / NE canvases share it). */
  readonly anchor: Point;
  readonly book: PartBook;
  readonly look: Look;
  readonly anims: readonly AnimDef[];
  /**
   * Hit reaction: generated from frame 0 of this anim — 2 frames: white flash + 1 px knock-back,
   * then the knocked-back plain frame. Omit to skip.
   */
  readonly hitFrom?: string;
  /** True if frames contain shadow pixels (all ground units). */
  readonly hasShadow: boolean;
  /** Offset added to every part position (extra headroom without re-authoring parts). */
  readonly origin?: Point;
}

export function spriteName(unit: string, anim: string, facing: string): string {
  return `unit.${unit}.${anim}.${facing}`;
}

/** Compose every frame of one anim/facing (pure; used by registration and tests). */
export function buildFrames(def: UnitDef, a: AnimDef, facing: Facing): PixelBuffer[] {
  const poses = facing === 'se' ? a.se : (a.ne ?? a.se);
  return poses.map((p, i) =>
    composePose(
      def.book,
      def.look,
      def.canvas,
      p,
      `unit.${def.id}.${a.anim}.${facing}[${i}]`,
      def.origin,
    ),
  );
}

export interface RegisterOptions {
  /** Sprite name prefix override (default `unit.<id>`). */
  readonly prefix?: string;
  readonly group?: string;
  /** Only register these anims. */
  readonly only?: readonly string[];
  readonly tags?: readonly string[];
}

/** Register every anim of a unit (SE + NE, mirrored to SW + NW) plus its hit reaction. */
export function registerUnitDef(
  reg: SpriteRegistry,
  def: UnitDef,
  opts: RegisterOptions = {},
): void {
  const prefix = opts.prefix ?? `unit.${def.id}`;
  const group = opts.group ?? def.group;
  const anims = opts.only ? def.anims.filter((a) => opts.only!.includes(a.anim)) : def.anims;
  const firstFrames = new Map<string, PixelBuffer>();
  for (const a of anims) {
    const facings: Facing[] = a.ne ? ['se', 'ne'] : ['se'];
    for (const f of facings) {
      const frames = buildFrames(def, a, f);
      firstFrames.set(`${a.anim}.${f}`, frames[0]!);
      reg.add(`${prefix}.${a.anim}.${f}`, {
        group,
        frames,
        fps: a.fps,
        loop: a.loop,
        anchor: def.anchor,
        hasShadow: def.hasShadow,
        tags: opts.tags,
        mirrorAs: `${prefix}.${a.anim}.${MIRROR_OF[f]}`,
      });
    }
  }
  if (def.hitFrom && (!opts.only || opts.only.includes('hit'))) {
    for (const f of ['se', 'ne'] as const) {
      const base =
        firstFrames.get(`${def.hitFrom}.${f}`) ??
        buildFrames(def, def.anims.find((a) => a.anim === def.hitFrom)!, f)[0]!;
      // Knock-back is away from the facing direction: SE/NE both face screen-right.
      const knocked = shift(base, -1, 0);
      reg.add(`${prefix}.hit.${f}`, {
        group,
        frames: [whiteFlash(knocked), knocked],
        fps: 12,
        loop: false,
        anchor: def.anchor,
        hasShadow: def.hasShadow,
        tags: opts.tags,
        mirrorAs: `${prefix}.hit.${MIRROR_OF[f]}`,
      });
    }
  }
}
