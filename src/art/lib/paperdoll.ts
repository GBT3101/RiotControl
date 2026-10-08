/**
 * Paper-doll compositor: base body frames + anchored overlay parts, coloured through
 * **semantic slots** so one hand-drawn base yields thousands of variants (M4b protesters).
 *
 *   const base: DollBase = {
 *     frames: keyFrames(BODY_WALK_SE),                  // grids using keys like S (skin), T (top)
 *     keys: { S: '$skin.1', s: '$skin.0', T: '$top.2', o: 'ink' },
 *     anchors: { head: [{ x: 6, y: 2 }, { x: 6, y: 3 }, ...] },   // per-frame (or one point)
 *   };
 *   const hair: DollPart = {
 *     frames: keyGrid(HAIR_MOHAWK),                     // one frame reused for every base frame
 *     keys: { H: '$hair.1', h: '$hair.0', L: '$hair.-1' },
 *     attach: 'head', origin: { x: 3, y: 4 }, z: 1,
 *   };
 *   const frames = composeDoll(base, [hair], {
 *     slots: { skin: 'skin3', top: 'dyePink', hair: 'dyeTeal' },
 *     outline: 'ink',
 *   });
 *
 * Use `pickSlots(rng, choices)` to roll a seeded variant. Composition is done in RGBA space,
 * so every part may use its own key alphabet. All output stays palette-pure (see pixels.blit).
 */
import type { Rng } from '../../core/rng';
import { resolveColor, type RampName, type RGBA } from '../palette';
import { renderKeys, type KeyGrid, type KeyMap, type SlotMap } from './grid';
import {
  blit,
  createBuffer,
  mirrorX,
  outline as outlineBuf,
  pad,
  recolour as recolourBuf,
  type OutlineOptions,
  type PixelBuffer,
  type Point,
} from './pixels';

export { mirrorX, mirrorAnchor, pad } from './pixels';

export interface DollBase {
  frames: readonly KeyGrid[];
  keys: KeyMap;
  /** Named attachment points per frame (array, one per frame) or constant (single point). */
  anchors?: Readonly<Record<string, Point | readonly Point[]>>;
}

export interface DollPart {
  /** One grid per base frame, or a single grid reused for every frame. */
  frames: KeyGrid | readonly KeyGrid[];
  keys: KeyMap;
  /** Base anchor name to attach to. Omitted = base pixel (0,0). */
  attach?: string;
  /** Pixel of the part that lands on the anchor (default 0,0). */
  origin?: Point;
  /** Extra per-frame offset (e.g. a sign bobbing out of phase). */
  offsets?: readonly Point[];
  /** Draw order: base is 0, negative draws behind the base. Default 1. */
  z?: number;
  /** Hide the part on specific frames. */
  hiddenOn?: readonly number[];
}

export interface DollVariant {
  /** Semantic slot → ramp for `$slot.step` keys in base and parts. */
  slots: SlotMap;
  /** Override key meanings of the base (e.g. swap a fixed colour for a slot). */
  baseKeys?: KeyMap;
}

export interface ComposeOptions {
  /** Auto exterior outline colour reference (e.g. 'ink'), a function, or omitted for none. */
  outline?: string | ((neighbour: RGBA) => RGBA);
  outlineOptions?: OutlineOptions;
  /** Transparent margin added around each frame before composing (default 0). */
  margin?: number;
}

function anchorFor(base: DollBase, name: string | undefined, frame: number): Point {
  if (!name) return { x: 0, y: 0 };
  const a = base.anchors?.[name];
  if (!a) throw new Error(`paperdoll: unknown anchor "${name}"`);
  if ('x' in a) return a;
  const p = a[frame] ?? a[a.length - 1];
  if (!p) throw new Error(`paperdoll: anchor "${name}" has no points`);
  return p;
}

function partGrid(part: DollPart, frame: number): KeyGrid {
  if (!Array.isArray(part.frames)) return part.frames as KeyGrid;
  const list = part.frames as readonly KeyGrid[];
  const g = list[frame] ?? list[list.length - 1];
  if (!g) throw new Error('paperdoll: part has no frames');
  return g;
}

/** Compose all frames of a doll for one variant. */
export function composeDoll(
  base: DollBase,
  parts: readonly DollPart[],
  variant: DollVariant,
  opts: ComposeOptions = {},
): PixelBuffer[] {
  const margin = opts.margin ?? 0;
  const baseKeys = { ...base.keys, ...variant.baseKeys };
  const sorted = [...parts].sort((a, b) => (a.z ?? 1) - (b.z ?? 1));
  const behind = sorted.filter((p) => (p.z ?? 1) < 0);
  const front = sorted.filter((p) => (p.z ?? 1) >= 0);
  const outlineColour =
    typeof opts.outline === 'string' ? resolveColor(opts.outline) : opts.outline;

  return base.frames.map((bf, f) => {
    const out = createBuffer(bf.w + margin * 2, bf.h + margin * 2);
    const drawPart = (p: DollPart): void => {
      if (p.hiddenOn?.includes(f)) return;
      const img = renderKeys(partGrid(p, f), p.keys, { slots: variant.slots }, 'doll part');
      const a = anchorFor(base, p.attach, f);
      const o = p.origin ?? { x: 0, y: 0 };
      const off = p.offsets?.[f] ?? { x: 0, y: 0 };
      blit(out, img, margin + a.x - o.x + off.x, margin + a.y - o.y + off.y);
    };
    // Painter's order: behind-parts, body, front-parts. `blit` lets opaque pixels overwrite
    // and keeps shadow (partial-alpha) pixels underneath anything opaque.
    behind.forEach(drawPart);
    const body = renderKeys(bf, baseKeys, { slots: variant.slots }, `doll frame ${f}`);
    blit(out, body, margin, margin);
    front.forEach(drawPart);
    if (outlineColour !== undefined) outlineBuf(out, outlineColour, opts.outlineOptions);
    return out;
  });
}

/** Roll a seeded variant: pick one ramp per slot from the allowed choices. */
export function pickSlots(
  rng: Rng,
  choices: Readonly<Record<string, readonly RampName[]>>,
): Record<string, RampName> {
  const out: Record<string, RampName> = {};
  for (const slot of Object.keys(choices).sort()) out[slot] = rng.pick(choices[slot]!);
  return out;
}

/** Map every key of a key map through `remap` (e.g. reuse a part with different semantics). */
export function remapKeys(keys: KeyMap, remap: Readonly<Record<string, string>>): KeyMap {
  const out: Record<string, KeyMap[string]> = {};
  for (const [k, v] of Object.entries(keys)) out[remap[k] ?? k] = v;
  return out;
}

/** Outline helper taking a colour reference (re-exported for art modules). */
export function outline(
  buf: PixelBuffer,
  colour: string | RGBA | ((neighbour: RGBA) => RGBA),
  opts?: OutlineOptions,
): PixelBuffer {
  return outlineBuf(buf, typeof colour === 'string' ? resolveColor(colour) : colour, opts);
}

/** Recolour helper taking colour references: recolourRefs(buf, { 'navy.2': 'olive.2' }). */
export function recolourRefs(buf: PixelBuffer, map: Readonly<Record<string, string>>): PixelBuffer {
  const m = new Map<RGBA, RGBA>();
  for (const [from, to] of Object.entries(map)) m.set(resolveColor(from), resolveColor(to));
  return recolourBuf(buf, m);
}

/** Mirror a list of frames (SE → SW, NE → NW). */
export function mirrorFrames(frames: readonly PixelBuffer[]): PixelBuffer[] {
  return frames.map(mirrorX);
}

/** Pad every frame equally (e.g. to make room for an outline). */
export function padFrames(frames: readonly PixelBuffer[], n: number): PixelBuffer[] {
  return frames.map((f) => pad(f, n));
}
