/**
 * Figure builder (M4b): turns a variant's Look + a Pose into one outlined, shadowed frame.
 *
 * Paper-doll order: legs (+ hem) → torso (+ gear) → head → face → hair → headwear,
 * arms and held items with facing-dependent z. Builds (slim / regular / stocky, ±1 px
 * height) are derived from the single hand-drawn base by duplicating grid columns / rows.
 */
import { createBuffer, mirrorX, silhouette, type PixelBuffer, type Point } from '../lib/pixels';
import { resolveColor } from '../palette';
import {
  clipAbove,
  delRow,
  dupCol,
  dupRow,
  mirrorPart,
  parseBook,
  partOf,
  type PartDef,
} from './book';
import { BODY_BOOK } from './body.grid';
import { FACE_BOOK, GEAR_BOOK, HEADWEAR_BOOK } from './gear.grid';
import { BEARD_BOOK, HAIR_BOOK } from './hair.grid';
import { ITEM_BOOK } from './items.grid';
import {
  ARM_KEYS,
  BODY_KEYS,
  GEAR_KEYS,
  GX,
  GY,
  ITEM_KEYS,
  WORK_H,
  WORK_W,
  anchorAt,
  drawParts,
  fastOutline,
  mirrorWork,
  rotCCW,
  rotCW,
  shearRows,
  squashRows,
  type Placed,
} from './rig';
import type { Tone } from './tones';
import { FX_BOOK, FX_KEYS } from './fx.grid';
import { blit } from '../lib/pixels';
import { renderKeys } from '../lib/grid';

export type Facing = 'se' | 'ne';

export const BOOK: ReadonlyMap<string, PartDef> = new Map([
  ...parseBook(BODY_BOOK, 'body'),
  ...parseBook(HAIR_BOOK, 'hair'),
  ...parseBook(BEARD_BOOK, 'beard'),
  ...parseBook(HEADWEAR_BOOK, 'headwear'),
  ...parseBook(FACE_BOOK, 'face'),
  ...parseBook(GEAR_BOOK, 'gear'),
  ...parseBook(ITEM_BOOK, 'items'),
  ...parseBook(FX_BOOK, 'fx'),
]);

/** Headwear: how much hair still shows (head-box row from which hair is drawn; 99 = none). */
export const HAT_CLIP: Readonly<Record<string, number>> = {
  beanie: 4,
  cap: 3,
  capback: 3,
  hood: 99,
  balaclava: 99,
  foil: 2,
  cone: 3,
  bucket: 3,
  beret: 2,
  headband: 0,
  headphones: 0,
  cowl: 99,
  raincoathood: 4,
};

/** Torso styles: optional hem (long garments) — `hem` uses the top tones. */
export const TOP_HEM: Readonly<Record<string, 'mid' | 'long' | undefined>> = {
  bathrobe: 'mid',
  raincoat: 'mid',
  robe: 'long',
  plainrobe: 'long',
};

export interface Build {
  /** 0 slim, 1 regular, 2 stocky. */
  width: 0 | 1 | 2;
  /** +1 px taller torso. */
  tall: boolean;
  /** Child-size (Breta): 2 px shorter. */
  tiny?: boolean;
}

export interface SignArt {
  /** Board parts, origin = pole grip (pole signs) or bottom centre (cardboard). */
  front: PartDef;
  back: PartDef;
  /** Two-handed cardboard (true) or on a pole (false). */
  card: boolean;
  /** Resolved colour keys of the board. */
  keys: Readonly<Record<string, string>>;
}

export interface Look {
  build: Build;
  /** Slot → tone ramp: skin hair top acc sleeve fore bot shin shoe sole hat gear item. */
  tones: Readonly<Record<string, Tone>>;
  hairAlt?: Tone;
  hair: string;
  beard?: string;
  hat?: string;
  /** Face accessories (glasses, shades, septum, earring, paint, mask, scarf, goggles). */
  face: readonly string[];
  top: string;
  /** Back gear (backpack, crate, tote, board). */
  back?: string;
  /** Front torso gear (strap, scarf, leaf). */
  front: readonly string[];
  sign?: SignArt;
  /** Prophet sandwich board, front side (the back side is `gear.board.ne`). */
  board?: { part: PartDef; keys: Readonly<Record<string, string>> };
  /** Skirt over bare legs / tights (hem keyed with the `skirt` tones). */
  skirt?: boolean;
  /** Default expression for idle / walk. */
  expr: string;
}

export interface HeldItem {
  id: string;
  ori: string;
}

export interface FxMark {
  /** fx part name (fx.<id>), drawn after the outline. */
  id: string;
  /** Anchor: 'tipR' (item tip in the R hand), 'handR', 'handL', 'head', 'ground', 'back', 'mouth'. */
  at: 'tipR' | 'handR' | 'handL' | 'head' | 'ground' | 'backR' | 'mouth' | 'chest';
  dx?: number;
  dy?: number;
}

export interface Pose {
  legs: string;
  /** Second half of a gait cycle: swap lit / dark legs. */
  swap?: boolean;
  dx?: number;
  dy?: number;
  bob?: number;
  lean?: number;
  hx?: number;
  hy?: number;
  face?: string;
  armR: string;
  armL: string;
  itemR?: HeldItem | null;
  itemL?: HeldItem | null;
  /** Show the variant's sign: 'pole' (R hand), 'card' (above both hands), 'cardL' (L hand). */
  sign?: 'pole' | 'card' | 'cardL';
  signDy?: number;
  fx?: readonly FxMark[];
  /** Lying / falling transforms. */
  xf?: 'cw' | 'ccw' | 'tiltF' | 'tiltB';
  /** Override the view (face-down bodies use the back view). */
  view?: Facing;
  white?: boolean;
  /** Outline colour override (prophet glow). */
  glow?: string;
  noShadow?: boolean;
  /** Hide back gear (climbing hides nothing; lying hides the board). */
  noBack?: boolean;
}

const SKIRT_KEYS: Readonly<Record<string, string>> = {
  ...BODY_KEYS,
  d: '$skirt.0',
  t: '$skirt.1',
  T: '$skirt.2',
  U: '$skirt.3',
};

/** SE: the far (screen-right) arm draws in front of the torso for these poses. */
const R_FRONT_SE = new Set(['chest', 'face', 'reach', 'fwd', 'aim', 'pump', 'wag', 'wag2', 'hip', 'hold']);
/** NE: the far (screen-left) arm draws in front for these poses. */
const L_FRONT_NE = new Set(['up', 'reach', 'hold']);

const LEG_SWAP: Readonly<Record<string, string>> = { P: 'p', p: 'P', Q: 'p', J: 'j', j: 'J', B: 'b', b: 'B' };
const ARM_MIRROR: Readonly<Record<string, string>> = { T: 't', t: 'T', F: 'f', f: 'F' };

const derived = new Map<string, PartDef>();
function memo(key: string, make: () => PartDef): PartDef {
  let p = derived.get(key);
  if (!p) derived.set(key, (p = make()));
  return p;
}

function buildKey(b: Build): string {
  return `${b.width}${b.tall ? 't' : ''}${b.tiny ? 'x' : ''}`;
}

function legsPart(id: string, b: Build, swap: boolean): PartDef {
  return memo(`legs.${id}|${buildKey(b)}|${swap}`, () => {
    let p = partOf(BOOK, `legs.${id}`);
    if (swap) {
      // swap only below the hip row so the hips keep their lighting
      const rows = p.grid.rows.map((r, y) =>
        y <= Math.max(0, p.anchors.hip!.y + 1) ? r : [...r].map((c) => LEG_SWAP[c] ?? c).join(''),
      );
      p = { ...p, grid: { ...p.grid, rows } };
    }
    if (b.width === 2) p = dupCol(p, 4);
    if (b.tiny) p = delRow(p, p.anchors.hip!.y + 2);
    return p;
  });
}

function torsoPart(name: string, b: Build): PartDef {
  return memo(`${name}|${buildKey(b)}`, () => {
    let p = partOf(BOOK, name);
    if (b.width === 0) p = delCol(p, 2);
    if (b.width === 2) p = dupCol(p, 2);
    if (b.tall) p = dupRow(p, p.grid.h - 3);
    if (b.tiny) p = delRow(p, p.grid.h - 2);
    return p;
  });
}

function hemPart(name: string, b: Build): PartDef {
  return memo(`${name}|${buildKey(b)}`, () => {
    let p = partOf(BOOK, name);
    if (b.width === 2) p = dupCol(p, 2);
    if (b.tiny) p = delRow(p, 0);
    return p;
  });
}

function delCol(p: PartDef, x: number): PartDef {
  const rows = p.grid.rows.map((r) => r.slice(0, x) + r.slice(x + 1));
  const sh = (q: Point): Point => (q.x > x ? { x: q.x - 1, y: q.y } : q);
  return {
    name: p.name,
    grid: { w: p.grid.w - 1, h: p.grid.h, rows },
    origin: sh(p.origin),
    anchors: Object.fromEntries(Object.entries(p.anchors).map(([k, v]) => [k, sh(v)])),
  };
}

function armPart(id: string, side: 'R' | 'L'): PartDef {
  return memo(`arm.${id}.${side}`, () => {
    const p = partOf(BOOK, `arm.${id}`);
    return side === 'R' ? p : mirrorPart(p, ARM_MIRROR);
  });
}

function hairPart(name: string, clip: number): PartDef | undefined {
  if (!BOOK.has(name)) return undefined;
  if (clip <= 0) return partOf(BOOK, name);
  return memo(`${name}|clip${clip}`, () => {
    const p = partOf(BOOK, name);
    // head-box row r ↔ grid row r + (origin.y - 8)
    return clipAbove(p, clip + (p.origin.y - 8));
  });
}

function opt(name: string): PartDef | undefined {
  return BOOK.get(name);
}

function itemPart(it: HeldItem): PartDef | undefined {
  return BOOK.get(`item.${it.id}.${it.ori}`);
}

const ITEM_KEY_OVERRIDES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  baguette: { ...ITEM_KEYS, O: 'ochre2', o: 'ochre1' },
};

export interface FrameInfo {
  buf: PixelBuffer;
  /** Work-canvas points of interest (before trimming): hands, item tip, head. */
  points: Record<string, Point>;
}

/** Compose one frame on the work canvas. */
export function renderFigure(look: Look, facing: Facing, pose: Pose, mirror = false): FrameInfo {
  const view: Facing = pose.view ?? facing;
  const se = view === 'se';
  const b = look.build;
  const parts: Placed[] = [];
  const points: Record<string, Point> = {};
  const ox = GX + (pose.dx ?? 0);
  const oy = GY + (pose.dy ?? 0);

  // Legs (+ hem for long garments).
  const legs: Placed = { part: legsPart(pose.legs, b, !!pose.swap), at: { x: ox, y: oy }, z: 0 };
  parts.push(legs);
  const hip = anchorAt(legs, 'hip');
  const hemLen = TOP_HEM[look.top];
  if (hemLen) {
    const spread = legs.part.anchors.hem?.x ?? 0;
    parts.push({
      part: hemPart(`hem.${hemLen}.${spread}`, b),
      at: { x: hip.x + (pose.lean ?? 0), y: hip.y + 1 + (pose.bob ?? 0) },
      z: 0.6,
    });
  }

  if (look.skirt) {
    const spread = legs.part.anchors.hem?.x ?? 0;
    parts.push({
      part: hemPart(`hem.mid.${spread}`, b),
      at: { x: hip.x + (pose.lean ?? 0), y: hip.y + 1 + (pose.bob ?? 0) },
      z: 0.6,
      keys: SKIRT_KEYS,
    });
  }

  // Torso.
  const tName = BOOK.has(`torso.${look.top}.${view}`) ? `torso.${look.top}.${view}` : `torso.tee.${view}`;
  const torso: Placed = {
    part: torsoPart(tName, b),
    at: { x: hip.x + (pose.lean ?? 0), y: hip.y + 1 + (pose.bob ?? 0) },
    z: 1,
  };
  parts.push(torso);
  const neck = anchorAt(torso, 'neck');
  const head = { x: neck.x + (pose.hx ?? 0), y: neck.y + (pose.hy ?? 0) };
  points.head = { x: head.x + 1, y: head.y - 4 };
  points.mouth = { x: head.x + 3, y: head.y - 2 };
  points.chest = { x: neck.x, y: neck.y + 3 };

  // Back / front gear.
  if (look.back === 'board' && look.board && se && !pose.noBack) {
    parts.push({ part: look.board.part, at: neck, z: 1.45, keys: look.board.keys, text: true });
  } else if (look.back && !pose.noBack) {
    const g = opt(`gear.${look.back}.${view}`);
    if (g) parts.push({ part: g, at: neck, z: se ? -2 : 1.5, keys: GEAR_KEYS });
    if (look.back === 'backpack' || look.back === 'crate') {
      const st = se ? opt('gear.straps.se') : undefined;
      if (st) parts.push({ part: st, at: neck, z: 1.4, keys: GEAR_KEYS });
    }
  }
  for (const f of look.front) {
    const g = opt(`gear.${f}.${view}`);
    if (g) parts.push({ part: g, at: neck, z: 1.4, keys: GEAR_KEYS });
  }

  // Head, face, hair, headwear.
  parts.push({ part: partOf(BOOK, `head.${view}`), at: head, z: 2 });
  const hatClip = look.hat ? (HAT_CLIP[look.hat] ?? 0) : 0;
  const masked = look.hat === 'balaclava' || look.hat === 'cowl' || look.hat === 'hood';
  if (se) {
    const expr = pose.face ?? look.expr;
    const e = opt(`face.${expr}.se`);
    if (e) parts.push({ part: e, at: head, z: 3.7 });
    if (look.beard && look.hat !== 'balaclava') {
      const bd = opt(`beard.${look.beard}.se`);
      if (bd) parts.push({ part: bd, at: head, z: 2.3 });
    }
  }
  for (const f of look.face) {
    if (look.hat === 'balaclava' && f !== 'goggles') continue;
    const fp = opt(`face.${f}.${view}`);
    if (fp) parts.push({ part: fp, at: head, z: f === 'mask' || f === 'scarf' ? 2.4 : 3.6 });
  }
  if (hatClip < 99) {
    const hp = hairPart(`hair.${look.hair}.${view}`, hatClip);
    const split = look.hairAlt ? { tones: { ...look.tones, hair: look.hairAlt }, fromX: head.x + 1 } : undefined;
    if (hp) parts.push({ part: hp, at: head, z: 3, split });
    if (se) {
      const hb = hairPart(`hairback.${look.hair}.se`, 0);
      if (hb) parts.push({ part: hb, at: head, z: -3, split });
    }
  }
  if (look.hat) {
    const hp = opt(`hat.${look.hat}.${view}`);
    if (hp) parts.push({ part: hp, at: head, z: 3.5 });
  }
  void masked;

  // Arms.
  const shR = anchorAt(torso, 'shR');
  const shL = anchorAt(torso, 'shL');
  const zR = se ? (R_FRONT_SE.has(pose.armR) ? 4.5 : 0.8) : 4.5;
  const zL = se ? 4 : L_FRONT_NE.has(pose.armL) ? 4 : 0.8;
  const armR: Placed = { part: armPart(pose.armR, 'R'), at: shR, z: zR, keys: ARM_KEYS };
  const armL: Placed = { part: armPart(pose.armL, 'L'), at: shL, z: zL, keys: ARM_KEYS };
  parts.push(armR, armL);
  const handR = anchorAt(armR, 'hand');
  const handL = anchorAt(armL, 'hand');
  points.handR = handR;
  points.handL = handL;

  const addItem = (it: HeldItem | null | undefined, at: Point, z: number, tag: string): void => {
    if (!it) return;
    const p = itemPart(it);
    if (!p) return;
    const pl: Placed = { part: p, at, z, keys: ITEM_KEY_OVERRIDES[it.id] ?? ITEM_KEYS };
    parts.push(pl);
    if (p.anchors.tip) points[`tip${tag}`] = anchorAt(pl, 'tip');
    if (p.anchors.back) points[`back${tag}`] = anchorAt(pl, 'back');
  };
  addItem(pose.itemR, handR, zR + 0.05, 'R');
  addItem(pose.itemL, handL, zL + 0.05, 'L');

  if (pose.sign && look.sign) {
    const art = se ? look.sign.front : look.sign.back;
    const dy = pose.signDy ?? 0;
    const at =
      pose.sign === 'card'
        ? { x: Math.round((handR.x + handL.x) / 2), y: Math.min(handR.y, handL.y) + 2 + dy }
        : pose.sign === 'cardL'
          ? { x: handL.x + 3, y: handL.y + 2 + dy }
          : { x: handR.x, y: handR.y + dy };
    parts.push({ part: art, at, z: pose.sign === 'pole' ? 5 : 3.8, keys: look.sign.keys, text: true });
  }

  // Mirrored frames (SW / NW) flip every part except lettering, so slogans stay readable.
  let buf = drawParts(parts, look.tones, mirror && !pose.xf);

  // Transforms (lying / falling).
  if (pose.xf) {
    buf = transformFigure(buf, pose.xf, facing);
    if (mirror) buf = mirrorWork(buf);
  }
  if (mirror) {
    for (const k of Object.keys(points)) points[k] = { x: 2 * GX - points[k]!.x, y: points[k]!.y };
  }
  if (pose.white) buf = silhouette(buf, resolveColor('white'));
  fastOutline(buf, resolveColor(pose.glow ?? 'ink'));

  // FX (after outline).
  for (const m of pose.fx ?? []) {
    const fxp = opt(`fx.${m.id}`);
    if (!fxp) continue;
    const base =
      m.at === 'tipR'
        ? (points.tipR ?? points.handR!)
        : m.at === 'handR'
          ? points.handR!
          : m.at === 'handL'
            ? points.handL!
            : m.at === 'head'
              ? points.head!
              : m.at === 'mouth'
                ? points.mouth!
                : m.at === 'chest'
                  ? points.chest!
                  : m.at === 'backR'
                    ? (points.backR ?? points.handR!)
                    : { x: mirror ? 2 * GX - ox : ox, y: oy };
    const img = renderKeys(fxp.grid, FX_KEYS, {}, fxp.name);
    if (mirror) {
      // base is already mirrored; mirror the offset and the sprite
      const bx = base.x - (m.dx ?? 0) - (img.w - 1 - fxp.origin.x);
      blit(buf, mirrorX(img), bx, base.y + (m.dy ?? 0) - fxp.origin.y);
    } else blit(buf, img, base.x + (m.dx ?? 0) - fxp.origin.x, base.y + (m.dy ?? 0) - fxp.origin.y);
  }

  if (!pose.noShadow) groundShadow(buf, pose.xf === 'cw' || pose.xf === 'ccw');
  return { buf, points };
}

/** Rotate / shear a composed (un-outlined) figure; re-seat it on the ground. */
function transformFigure(src: PixelBuffer, xf: NonNullable<Pose['xf']>, facing: Facing): PixelBuffer {
  if (xf === 'tiltF' || xf === 'tiltB') {
    // falling: squash a third of the rows, then lean 45° toward the fall
    void facing;
    return shearRows(squashRows(src, 3, GY), xf === 'tiltF' ? 1 : -1, GY);
  }
  const r = xf === 'cw' ? rotCW(src) : rotCCW(src);
  // r is WORK_H × WORK_W (square canvas → same size). Seat bottom of the body on GY+1 and
  // centre it around GX (+ a few px toward the fall direction).
  let minX = r.w;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      if (r.data[(y * r.w + x) * 4 + 3]! === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const out = createBuffer(WORK_W, WORK_H);
  if (maxX < 0) return out;
  const cx = Math.round((minX + maxX) / 2);
  const dir = xf === 'cw' ? 2 : -2;
  blit(out, r, GX + dir - cx, GY + 1 - maxY);
  return out;
}

const SHADOW_RGBA = (() => {
  const c = resolveColor('ink');
  return { r: (c >>> 24) & 255, g: (c >>> 16) & 255, b: (c >>> 8) & 255 };
})();

/** Blob shadow under the feet (or a long one under a lying body); only on empty pixels. */
function groundShadow(buf: PixelBuffer, lying: boolean): void {
  const put = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= buf.w || y >= buf.h) return;
    const i = (y * buf.w + x) * 4;
    if (buf.data[i + 3]! !== 0) return;
    buf.data[i] = SHADOW_RGBA.r;
    buf.data[i + 1] = SHADOW_RGBA.g;
    buf.data[i + 2] = SHADOW_RGBA.b;
    buf.data[i + 3] = 115;
  };
  if (lying) {
    // Shadow follows the body's footprint one row below the lowest opaque pixel per column.
    for (let x = 0; x < buf.w; x++) {
      let low = -1;
      for (let y = buf.h - 1; y >= 0; y--) {
        if (buf.data[(y * buf.w + x) * 4 + 3]! === 255) {
          low = y;
          break;
        }
      }
      if (low >= GY - 2) put(x, low + 1);
    }
    return;
  }
  for (let x = GX - 5; x <= GX + 5; x++) put(x, GY);
  for (let x = GX - 4; x <= GX + 4; x++) put(x, GY + 1);
}

export { BODY_KEYS, WORK_W, WORK_H, GX, GY };
