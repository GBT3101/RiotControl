/**
 * Ground tiles (M3a): per-city materials, seeded detail variants, autotiling transitions
 * (kerbs, grass edges, quay walls, bridge balustrades, steps) and road markings.
 *
 * ## Pure API for the world view (M8)
 *   groundTile(ctx)        → PixelBuffer 32×24, anchor GROUND_ANCHOR = {x:16, y:8}
 *   groundTileFrames(ctx)  → 1 frame, or WATER_FRAMES frames at WATER_FPS for animated water
 *   groundCtxAt(map, i, j) → builds the ctx from MapData (neighbours + per-tile seed)
 * Results are deterministic and cached by a canonical key (neighbours are reduced to the
 * transition relation they cause, so caches stay small: a 72×72 city needs a few hundred).
 *
 * The image is 32×24: the 32×16 diamond sits at rows 8..23 (top vertex between columns 15/16
 * on row 8) and rows 0..7 are headroom for upright edge details (bridge balustrades, quay
 * parapets) on the tile's far edges. Draw it with the anchor on the tile's top vertex.
 *
 * ## Neighbour convention (tile axes)
 * Tile (i, j): i grows toward screen SE, j toward screen SW. Neighbours are named by the screen
 * compass direction in which they lie:
 *   edge neighbours (share a diamond edge):   nw = (i-1, j)   ne = (i, j-1)
 *                                             se = (i+1, j)   sw = (i, j+1)
 *   corner neighbours (share one vertex):     n  = (i-1, j-1) e  = (i+1, j-1)
 *                                             s  = (i+1, j+1) w  = (i-1, j+1)
 * Off-map neighbours should be passed as the tile's own ground.
 *
 * ## Elevation model
 * Roads (asphalt, cobble, bridge) are level 0; pavements, plazas, lawns, paths, steps, quays and
 * building lots are kerb height (2 px); water is sunken (−7 px). A higher neighbour on the far
 * side (n / nw / ne) shows its wall face inside the lower tile (kerb faces on roads, quay walls
 * and bridge piers in water); a lower neighbour gets a coping band on the higher tile.
 *
 * Markings (contract MARKINGS) are painted on the tile's centre lines: `dashI` = dash along the
 * i axis at v = ½, `zebraI` = zebra bars of a crossing over a road running along i (bars along
 * i, repeating along j), `stopI` = stop line across an i-road at u = ½. `*J` = same, swapped axes.
 */
import { inTileDiamond } from '../../core/iso';
import {
  GROUNDS,
  MARKINGS,
  type CityId,
  type Ground,
  type MapData,
  type Marking,
} from '../../maps/contract';
import { createBuffer, getPixel, setPixel, type PixelBuffer } from '../lib/pixels';
import type { RGBA } from '../palette';
import { C, darker, lighter, shade } from './color';
import * as G from './ground.grid';
import { envStyle } from './style';
import { Dice, hash, hashF, mod } from './util';

export const GROUND_IMG_W = 32;
export const GROUND_IMG_H = 24;
export const GROUND_HEADROOM = 8;
/** Pixel-index anchor of every ground tile image: the diamond's top vertex. */
export const GROUND_ANCHOR = { x: 16, y: GROUND_HEADROOM } as const;
export const WATER_FRAMES = 4;
export const WATER_FPS = 3;

export type NeighbourDir = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
export const NEIGHBOUR_DIRS: readonly NeighbourDir[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
/** Tile offset (di, dj) of each neighbour. */
export const NEIGHBOUR_OFFSETS: Readonly<Record<NeighbourDir, readonly [number, number]>> = {
  n: [-1, -1],
  ne: [0, -1],
  e: [1, -1],
  se: [1, 0],
  s: [1, 1],
  sw: [0, 1],
  w: [-1, 1],
  nw: [-1, 0],
};

export interface GroundCtx {
  city: CityId;
  ground: Ground;
  marking?: Marking;
  n: Ground;
  ne: Ground;
  e: Ground;
  se: Ground;
  s: Ground;
  sw: Ground;
  w: Ground;
  nw: Ground;
  /** Per-tile seed (e.g. hash of i, j); picks the detail variant. */
  seed: number;
  /** Animation frame for water (0..WATER_FRAMES-1). */
  frame?: number;
}

/** Elevation in px (see module doc). */
export const GROUND_LEVEL: Readonly<Record<Ground, number>> = {
  lot: 2,
  asphalt: 0,
  sidewalk: 2,
  cobble: 0,
  plaza: 2,
  steps: 2,
  bridge: 0,
  grass: 2,
  parkPath: 2,
  water: -7,
  quay: 2,
};

const ROADLIKE: ReadonlySet<Ground> = new Set<Ground>(['asphalt', 'cobble', 'bridge']);
const MARKABLE: ReadonlySet<Ground> = ROADLIKE;

/** How a neighbour affects the tile (the painter only ever sees these). */
const enum Rel {
  None = 0,
  /** neighbour higher: kerb / edging face hangs into this tile */
  KerbUp = 1,
  /** self water, neighbour paved/stone: quay wall face */
  QuayUp = 2,
  /** self water, neighbour lawn/path: earth bank face */
  BankUp = 3,
  /** self water, neighbour bridge: bridge pier face */
  BridgeUp = 4,
  /** neighbour lower (road): kerb coping band on this tile */
  Down = 5,
  /** neighbour is water: coping + parapet/balustrade on this tile */
  DownWater = 6,
  /** self paved/path/road, neighbour lawn at same level: stone edging / tufts */
  GrassNext = 7,
  /** self lawn, neighbour paved at same level */
  PavedNext = 8,
  /** neighbour is a building lot / landmark footprint: contact shadow */
  Lot = 9,
  /** self steps, neighbour lot (stairs rise toward it) */
  StepsTop = 10,
  /** self grass, neighbour gravel path */
  PathNext = 11,
}

function relation(self: Ground, nb: Ground): Rel {
  if (nb === self) return Rel.None;
  const ls = GROUND_LEVEL[self];
  const ln = GROUND_LEVEL[nb];
  if (self === 'water') {
    if (nb === 'bridge') return Rel.BridgeUp;
    if (nb === 'grass' || nb === 'parkPath') return Rel.BankUp;
    return Rel.QuayUp;
  }
  if (nb === 'water') return Rel.DownWater;
  if (self === 'steps' && nb === 'lot') return Rel.StepsTop;
  if (nb === 'lot' && self !== 'quay') return Rel.Lot;
  if (ln > ls) return Rel.KerbUp;
  if (ln < ls) return Rel.Down;
  if (nb === 'grass' && self !== 'grass') return Rel.GrassNext;
  if (self === 'grass') return nb === 'parkPath' ? Rel.PathNext : Rel.PavedNext;
  return Rel.None;
}

type Rels = Record<NeighbourDir, Rel>;

// ---------------------------------------------------------------------------------------------
// Stamps
// ---------------------------------------------------------------------------------------------

interface Stamp {
  w: number;
  h: number;
  cells: string[];
}

const stampCache = new Map<string, Stamp>();
function parseStamp(src: string): Stamp {
  let s = stampCache.get(src);
  if (s) return s;
  const rows = src
    .replace(/\r/g, '')
    .split('\n')
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
  const w = Math.max(...rows.map((r) => r.length));
  s = { w, h: rows.length, cells: rows.map((r) => r.padEnd(w, '.')) };
  stampCache.set(src, s);
  return s;
}

/**
 * Draw a stamp onto a 32×16 work tile at (dx, dy), clipped to the diamond. Digits shade the
 * given base colour (3 = base); letters look up `abs`.
 */
function stampRel(
  dst: PixelBuffer,
  src: string,
  dx: number,
  dy: number,
  base: RGBA,
  abs: Readonly<Record<string, RGBA>> = {},
  clip: (x: number, y: number) => boolean = inTileDiamond,
): void {
  const s = parseStamp(src);
  for (let y = 0; y < s.h; y++) {
    const row = s.cells[y]!;
    for (let x = 0; x < s.w; x++) {
      const k = row[x]!;
      if (k === '.') continue;
      const tx = dx + x;
      const ty = dy + y;
      if (!clip(tx, ty)) continue;
      let c: RGBA | undefined;
      if (k >= '0' && k <= '9') c = shade(base, Number(k) - 3);
      else c = abs[k];
      if (c !== undefined) setPixel(dst, tx, ty, c);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Geometry helpers on the 32×16 work tile
// ---------------------------------------------------------------------------------------------

/** Local continuous tile coords of pixel (x, y) of the 32×16 diamond image. */
function uvOf(x: number, y: number): [number, number] {
  const a = (x + 0.5 - 16) / 32;
  const b = (y + 0.5) / 16;
  return [b + a, b - a];
}

/** Is pixel (x, y) inside the inset diamond (stamps keep away from the tile edges)? */
function insideInset(m: number): (x: number, y: number) => boolean {
  return (x, y) => {
    const [u, v] = uvOf(x, y);
    return u > m && u < 1 - m && v > m && v < 1 - m;
  };
}

// Cells (slabs, setts) — rows along v, columns along u, odd rows staggered.
interface CellGrid {
  rows: number;
  cols: number;
  stagger: number;
}

function cellOf(g: CellGrid, u: number, v: number): [number, number] {
  const r = Math.floor(v * g.rows + 1e-6);
  const c = Math.floor(u * g.cols + (mod(r, 2) === 1 ? g.stagger : 0) + 1e-6);
  return [r, c];
}

const cellId = (rc: [number, number]): number => rc[0] * 4096 + rc[1];

/** Does cell (r, c) cross the tile boundary (its tone must then be tile-periodic)? */
function cellCrosses(g: CellGrid, r: number, c: number): boolean {
  if (mod(r, 2) === 1 && g.stagger > 0) return mod(c, g.cols) === 0;
  return false;
}

interface CellShading {
  /** Tone of a cell (r, c are tile-local, wrapped). */
  tone: (r: number, c: number, crosses: boolean) => RGBA;
  joint: RGBA;
  /** Lit bevel colour fn of tone (default lighter). */
  lit?: (tone: RGBA) => RGBA;
  /** Shaded inner bevel next to the joint (default none). */
  shadeIn?: boolean;
  /** Knock out the top-left corner pixel of each cell (rounded setts). */
  round?: boolean;
}

function cellPixel(g: CellGrid, sh: CellShading, x: number, y: number): RGBA {
  const [u, v] = uvOf(x, y);
  const rc = cellOf(g, u, v);
  const id = cellId(rc);
  const idR = cellId(cellOf(g, u + 1 / 32, v - 1 / 32));
  const idD = cellId(cellOf(g, u + 1 / 16, v + 1 / 16));
  if (id !== idR || id !== idD) return sh.joint;
  const r = mod(rc[0], g.rows);
  const c = mod(rc[1], g.cols);
  const tone = sh.tone(r, c, cellCrosses(g, rc[0], rc[1]));
  const idL = cellId(cellOf(g, u - 1 / 32, v + 1 / 32));
  const idU = cellId(cellOf(g, u - 1 / 16, v - 1 / 16));
  if (sh.round && id !== idL && id !== idU) return sh.joint; // rounded corner
  if (id !== idL || id !== idU) return sh.lit ? sh.lit(tone) : lighter(tone);
  if (sh.shadeIn) {
    const idR2 = cellId(cellOf(g, u + 2 / 32, v - 2 / 32));
    if (id !== idR2) return darker(tone);
  }
  return tone;
}

// ---------------------------------------------------------------------------------------------
// City materials
// ---------------------------------------------------------------------------------------------

/** A city's ground materials (EnvCity.ground). */
export interface CityMats {
  asphalt: RGBA;
  asphaltSpeck: [RGBA, RGBA];
  paint: RGBA;
  paintWorn: RGBA;
  yellowLines: boolean;
  kerbTop: RGBA;
  kerbLit: RGBA;
  kerbShade: RGBA;
  side: { tones: RGBA[]; joint: RGBA; grid: CellGrid };
  cobble: { tones: RGBA[]; joint: RGBA; grid: CellGrid };
  plaza: { tones: RGBA[]; border: RGBA; joint: RGBA };
  grass: { base: string; stripes: boolean; dry: number };
  gravel: { base: RGBA; dark: RGBA; light: RGBA };
  water: { deep: RGBA; base: RGBA; ripple: RGBA; hi: RGBA; spark: RGBA };
  quayLit: RGBA;
  quayShade: RGBA;
  quayJoint: RGBA;
  rail: { top: RGBA; lit: RGBA; shade: RGBA; dark: RGBA };
  lot: RGBA;
  leaves: boolean;
  /** Bridge balustrades are cast-iron railings (else stone balusters). */
  ironRail: boolean;
  /**
   * Optional paving patterns (E3 South): replace the default fill of these grounds with the
   * city's own pattern (sampietrini fans, Panot flower tiles, granite slabs …). Detail stamps,
   * markings, kerbs and edges are still drawn on top. Cities without it are unchanged.
   */
  fills?: Readonly<Partial<Record<PatternGround, GroundFill>>>;
  /**
   * Optional tram tracks (E3 South): road centre lines (`dashI` / `dashJ`) get rails at these
   * across-road offsets (tile units, 0..1) instead of the painted dash.
   */
  tram?: { at: readonly number[]; rail: RGBA; railHi: RGBA; groove: RGBA };
}

/** Grounds whose fill a city may replace (CityMats.fills). */
export type PatternGround = 'sidewalk' | 'cobble' | 'plaza' | 'quay' | 'bridge' | 'parkPath';

/**
 * A city paving pattern: colour of tile-local pixel (x, y) of the 32×16 diamond, with (u, v) its
 * tile coordinates (0..1 along i / j) and `seed` the tile's detail-variant seed. The pattern must
 * be tile-periodic (neighbouring tiles are painted independently and must join seamlessly).
 */
export type GroundFill = (x: number, y: number, u: number, v: number, seed: number) => RGBA;

// Per-city values: src/art/env/cities/<city>.ts (`ground`), read through envStyle(city).

/**
 * Isolated specks need no seamless lattice (nothing continues across an edge), so grit, blades
 * and pebbles are scattered per variant from the seed: twelve variants never read as a grid.
 */
interface Speck {
  x: number;
  y: number;
  kind: number;
}
function specks(seed: number, n: number, kinds: number): Speck[] {
  const d = new Dice(seed);
  const out: Speck[] = [];
  for (let k = 0; k < n * 3 && out.length < n; k++) {
    const x = d.int(2, 29);
    const y = d.int(1, 14);
    if (!insideInset(0.04)(x, y)) continue;
    if (out.some((s) => Math.abs(s.x - x) + Math.abs(s.y - y) < 4)) continue;
    out.push({ x, y, kind: d.int(0, kinds - 1) });
  }
  return out;
}

function speckleMap(list: Speck[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const s of list) m.set(s.y * 32 + s.x, s.kind);
  return m;
}

// ---------------------------------------------------------------------------------------------
// Base materials (fill the 32×16 diamond)
// ---------------------------------------------------------------------------------------------

type Fill = (x: number, y: number) => RGBA;

function asphaltFill(m: CityMats, seed: number): Fill {
  const sp = speckleMap(specks(seed, 14, 6));
  const dark = m.asphaltSpeck[0];
  const warm = m.asphaltSpeck[1];
  const light = lighter(m.asphalt);
  return (x, y) => {
    const k = sp.get(y * 32 + x);
    const kl = sp.get(y * 32 + x - 1);
    if (k === 0 || k === 1 || kl === 1) return dark; // grit (some 2 px long)
    if (k === 2) return warm;
    if (k === 3) return light;
    return m.asphalt;
  };
}

function sidewalkFill(m: CityMats, seed: number): Fill {
  const { tones, joint, grid: g } = m.side;
  const sh: CellShading = {
    joint,
    tone: (r, c, crosses) => {
      const k = crosses ? hash(r, c, 7) : hash(r, c, seed);
      // Mostly the base tone; an occasional odd slab breaks the grid.
      return (k & 7) < 5 ? tones[0]! : tones[k % tones.length]!;
    },
  };
  return (x, y) => cellPixel(g, sh, x, y);
}

function cobbleFill(m: CityMats, seed: number): Fill {
  const { tones, joint, grid: g } = m.cobble;
  const sh: CellShading = {
    joint,
    round: true,
    shadeIn: true,
    tone: (r, c, crosses) => tones[(crosses ? hash(r, c, 3) : hash(r, c, seed)) % tones.length]!,
  };
  return (x, y) => cellPixel(g, sh, x, y);
}

/** Plaza: each tile is a framed square — border band + 2×2 slabs — so squares read designed. */
function plazaFill(m: CityMats, seed: number): Fill {
  const { tones, border, joint } = m.plaza;
  const inner: CellGrid = { rows: 2, cols: 2, stagger: 0 };
  const sh: CellShading = {
    joint,
    tone: (r, c) => tones[hash(r, c, seed) % tones.length]!,
  };
  return (x, y) => {
    const [u, v] = uvOf(x, y);
    const e = Math.min(u, v, 1 - u, 1 - v);
    if (e < 0.07) {
      // Border band: lit where it faces the light (far edges), joints every 8 px.
      if (u < 0.07 || v < 0.07) return lighter(border);
      return border;
    }
    if (e < 0.11) return joint;
    // Remap inner to 0..1 and draw slabs.
    return cellPixelUV(inner, sh, (u - 0.11) / 0.78, (v - 0.11) / 0.78, 0.78);
  };
}

function cellPixelUV(g: CellGrid, sh: CellShading, u: number, v: number, scale: number): RGBA {
  const s = 1 / scale;
  const rc = cellOf(g, u, v);
  const id = cellId(rc);
  if (
    id !== cellId(cellOf(g, u + s / 32, v - s / 32)) ||
    id !== cellId(cellOf(g, u + s / 16, v + s / 16))
  ) {
    return sh.joint;
  }
  const tone = sh.tone(mod(rc[0], g.rows), mod(rc[1], g.cols), false);
  if (
    id !== cellId(cellOf(g, u - s / 32, v + s / 32)) ||
    id !== cellId(cellOf(g, u - s / 16, v - s / 16))
  ) {
    return lighter(tone);
  }
  return tone;
}

function grassFill(m: CityMats, seed: number): Fill {
  const base = C('green3');
  const sp = speckleMap(specks(seed, 16, 4));
  return (x, y) => {
    let c = base;
    if (m.grass.stripes) {
      const [, v] = uvOf(x, y);
      if (mod(v, 1) >= 0.5) c = C('green4');
    }
    // Blades: a darker "v" with a lit tip above.
    const k = sp.get(y * 32 + x);
    const below = sp.get((y - 1) * 32 + x);
    if (k !== undefined) return k === 3 ? lighter(c) : darker(c);
    if (below !== undefined && below < 2) return darker(c);
    const left = sp.get(y * 32 + x - 1);
    if (left === 1) return darker(c);
    return c;
  };
}

function gravelFill(m: CityMats, seed: number): Fill {
  const sp = speckleMap(specks(seed, 18, 3));
  return (x, y) => {
    const k = sp.get(y * 32 + x);
    if (k !== undefined) return k === 2 ? m.gravel.dark : m.gravel.light;
    if (sp.get((y - 1) * 32 + x - 1) === 0 || sp.get(y * 32 + x - 1) === 1) return m.gravel.dark;
    return m.gravel.base;
  };
}

function lotFill(m: CityMats): Fill {
  const g: CellGrid = { rows: 2, cols: 2, stagger: 0 };
  const sh: CellShading = { joint: darker(m.lot), tone: () => m.lot };
  return (x, y) => cellPixel(g, sh, x, y);
}

function quayFill(m: CityMats): Fill {
  // Big coping stones, two per tile, along both axes.
  const g: CellGrid = { rows: 2, cols: 1, stagger: 0 };
  const sh: CellShading = {
    joint: m.quayJoint,
    tone: (r) => (r === 0 ? lighter(m.quayLit) : m.quayLit),
  };
  return (x, y) => cellPixel(g, sh, x, y);
}

function bridgeFill(m: CityMats, seed: number): Fill {
  const asp = asphaltFill(m, seed);
  return (x, y) => {
    const [u, v] = uvOf(x, y);
    // Expansion joint across the deck every tile (along both axes at the tile seam).
    if (u < 0.04 || v < 0.04) return C('gray2');
    return asp(x, y);
  };
}

// Water: a few seeded ripple strokes per tile (crest 'h' over trough 'r'), swaying a pixel per
// frame, plus twinkling sparkles. Strokes stay inside the diamond so tiles never seam.
const SWAY = [0, 1, 1, 0];
const RIPPLES = [
  ['.hhh.', '..rrr'],
  ['hh..', '.rr.'],
  ['.hhhh', '..rrr'],
  ['hh', '.r'],
];

function waterFill(m: CityMats, frame: number, seed: number): Fill {
  const w = m.water;
  const sway = SWAY[frame]!;
  const d = new Dice(seed);
  const marks = new Map<number, RGBA>();
  const ok = insideInset(0.08);
  const n = d.int(2, 3);
  for (let k = 0; k < n; k++) {
    const r = d.pick(RIPPLES);
    const x0 = d.int(4, 24) + (k % 2 === 0 ? sway : -sway);
    const y0 = d.int(2, 12);
    r.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        const ch = row[rx]!;
        if (ch === '.' || !ok(x0 + rx, y0 + ry)) continue;
        marks.set((y0 + ry) * 32 + x0 + rx, ch === 'h' ? w.hi : w.ripple);
      }
    });
  }
  const sparks = d.int(1, 2);
  for (let k = 0; k < sparks; k++) {
    const x = d.int(6, 25);
    const y = d.int(4, 11);
    const t = (frame + d.int(0, 3)) % 4;
    if (t === 0) {
      marks.set(y * 32 + x, w.spark);
      marks.set(y * 32 + x - 1, w.hi);
      marks.set(y * 32 + x + 1, w.hi);
    } else if (t === 1) marks.set(y * 32 + x, w.hi);
  }
  return (x, y) => marks.get(y * 32 + x) ?? w.base;
}

// ---------------------------------------------------------------------------------------------
// Variants (seeded detail stamps)
// ---------------------------------------------------------------------------------------------

type Detail = (t: PixelBuffer, d: Dice, m: CityMats, rels: Rels) => void;

const inset = insideInset(0.12);
const inset2 = insideInset(0.2);

function placeIn(d: Dice, src: string): [number, number] {
  const s = parseStamp(src);
  // Pick a position whose stamp centre lies well inside the diamond.
  for (let k = 0; k < 12; k++) {
    const x = d.int(4, 28 - s.w);
    const y = d.int(3, 13 - s.h);
    if (inset2(x + (s.w >> 1), y + (s.h >> 1))) return [x, y];
  }
  return [16 - (s.w >> 1), 8 - (s.h >> 1)];
}

const ASPHALT_DETAILS: ReadonlyArray<readonly [Detail | null, number]> = [
  [null, 10],
  [(t, d, m) => stampRel(t, G.GRIT, ...placeIn(d, G.GRIT), m.asphalt, {}, inset), 4],
  [
    (t, d, m) =>
      stampRel(
        t,
        d.chance(0.5) ? G.CRACK_A : G.CRACK_B,
        ...placeIn(d, G.CRACK_A),
        m.asphalt,
        {},
        inset,
      ),
    3,
  ],
  [(t, d, m) => stampRel(t, G.MANHOLE, ...placeIn(d, G.MANHOLE), m.asphalt, {}, inset), 2],
  [(t, d, m) => stampRel(t, G.PATCH, ...placeIn(d, G.PATCH), m.asphalt, {}, inset), 2],
  [(t, d, m) => stampRel(t, G.STAIN, ...placeIn(d, G.STAIN), m.asphalt, {}, inset), 2],
  [(t, d, m) => stampRel(t, G.SEAM, ...placeIn(d, G.SEAM), m.asphalt, {}, inset), 2],
  [
    (t, d, m) => {
      if (!m.leaves) return;
      stampRel(t, G.LEAVES, ...placeIn(d, G.LEAVES), m.asphalt, LEAF_KEYS, inset);
    },
    1,
  ],
];

const LEAF_KEYS: Record<string, RGBA> = { y: C('ochre2'), o: C('rust3'), b: C('earth3') };

const PAVING_DETAILS: ReadonlyArray<readonly [Detail | null, number]> = [
  [null, 12],
  [(t, d) => stampRel(t, G.SLAB_CRACK, ...placeIn(d, G.SLAB_CRACK), C('stone1'), {}, inset), 2],
  [(t, d) => stampRel(t, G.GUM, ...placeIn(d, G.GUM), C('gray4'), {}, inset), 3],
  [
    (t, d, m) => stampRel(t, G.HATCH, ...placeIn(d, G.HATCH), darker(m.side.tones[0]!), {}, inset),
    2,
  ],
  [
    (t, d, m) => stampRel(t, G.STAIN, ...placeIn(d, G.STAIN), lighter(m.side.tones[0]!), {}, inset),
    2,
  ],
  [
    (t, d, m) => {
      if (!m.leaves) return;
      stampRel(t, G.LEAVES, ...placeIn(d, G.LEAVES), 0, LEAF_KEYS, inset);
    },
    2,
  ],
];

const COBBLE_DETAILS: ReadonlyArray<readonly [Detail | null, number]> = [
  [null, 8],
  [(t, d) => stampRel(t, G.MOSS, ...placeIn(d, G.MOSS), 0, { g: C('olive1') }, inset), 3],
  [(t, d, m) => stampRel(t, G.STAIN, ...placeIn(d, G.STAIN), m.cobble.tones[0]!, {}, inset), 2],
  [(t, d, m) => stampRel(t, G.MANHOLE, ...placeIn(d, G.MANHOLE), m.cobble.tones[1]!, {}, inset), 1],
];

const GRASS_KEYS: Record<string, RGBA> = {
  g: C('green2'),
  G: C('green4'),
  d: C('green2'),
  L: C('green4'),
  w: C('white'),
  y: C('ochre3'),
  p: C('pink2'),
};
const DRY_KEYS: Record<string, RGBA> = { g: C('olive2'), G: C('hivis1') };

const GRASS_DETAILS: ReadonlyArray<readonly [Detail | null, number]> = [
  [null, 4],
  [
    (t, d) => {
      stampRel(t, G.TUFT, ...placeIn(d, G.TUFT), 0, GRASS_KEYS, inset);
      stampRel(t, G.TUFT_SMALL, ...placeIn(d, G.TUFT_SMALL), 0, GRASS_KEYS, inset);
    },
    5,
  ],
  [(t, d) => stampRel(t, G.CLUMP, ...placeIn(d, G.CLUMP), 0, GRASS_KEYS, inset), 3],
  [(t, d) => stampRel(t, G.DAISIES, ...placeIn(d, G.DAISIES), 0, GRASS_KEYS, inset), 2],
  [(t, d) => stampRel(t, G.FLOWERS, ...placeIn(d, G.FLOWERS), 0, GRASS_KEYS, inset), 1],
  [
    (t, d, m) => {
      if (d.next() < m.grass.dry)
        stampRel(t, G.TUFT_SMALL, ...placeIn(d, G.TUFT_SMALL), 0, DRY_KEYS, inset);
      stampRel(t, G.TUFT, ...placeIn(d, G.TUFT), 0, GRASS_KEYS, inset);
    },
    3,
  ],
];

const GRAVEL_DETAILS: ReadonlyArray<readonly [Detail | null, number]> = [
  [null, 4],
  [
    (t, d, m) => {
      stampRel(t, G.PEBBLES, ...placeIn(d, G.PEBBLES), m.gravel.base, {}, inset);
      stampRel(t, G.PEBBLES, ...placeIn(d, G.PEBBLES), m.gravel.base, {}, inset);
    },
    4,
  ],
  [
    (t, d, m) => {
      if (m.leaves) stampRel(t, G.LEAVES, ...placeIn(d, G.LEAVES), 0, LEAF_KEYS, inset);
    },
    2,
  ],
];

const DETAIL_SETS: Partial<Record<Ground, ReadonlyArray<readonly [Detail | null, number]>>> = {
  asphalt: ASPHALT_DETAILS,
  bridge: ASPHALT_DETAILS.slice(0, 4),
  sidewalk: PAVING_DETAILS,
  plaza: PAVING_DETAILS.slice(0, 3),
  cobble: COBBLE_DETAILS,
  grass: GRASS_DETAILS,
  parkPath: GRAVEL_DETAILS,
};

/** Number of distinct detail variants per ground (seed is reduced modulo this). */
export const GROUND_VARIANTS = 12;

// ---------------------------------------------------------------------------------------------
// Edges & transitions
// ---------------------------------------------------------------------------------------------

type EdgeName = 'nw' | 'ne' | 'se' | 'sw';
type CornerName = 'n' | 'e' | 's' | 'w';

/** Distance (in tile units) of local (u, v) from an edge / to a corner region test. */
function edgeDist(e: EdgeName, u: number, v: number): number {
  switch (e) {
    case 'nw':
      return u;
    case 'ne':
      return v;
    case 'se':
      return 1 - u;
    case 'sw':
      return 1 - v;
  }
}
const CORNER_EDGES: Record<CornerName, [EdgeName, EdgeName]> = {
  n: ['nw', 'ne'],
  e: ['ne', 'se'],
  s: ['se', 'sw'],
  w: ['sw', 'nw'],
};

/** Smallest distance to any edge/corner whose relation satisfies `pred` (Infinity if none). */
function bandDist(
  rels: Rels,
  pred: (r: Rel) => boolean,
  u: number,
  v: number,
): [number, EdgeName | null] {
  let best = Infinity;
  let which: EdgeName | null = null;
  for (const e of ['nw', 'ne', 'se', 'sw'] as const) {
    if (!pred(rels[e])) continue;
    const dd = edgeDist(e, u, v);
    if (dd < best) {
      best = dd;
      which = e;
    }
  }
  for (const c of ['n', 'e', 's', 'w'] as const) {
    if (!pred(rels[c])) continue;
    const [a, b] = CORNER_EDGES[c];
    const dd = Math.max(edgeDist(a, u, v), edgeDist(b, u, v));
    if (dd < best) {
      best = dd;
      which = edgeDist(a, u, v) < edgeDist(b, u, v) ? a : b;
    }
  }
  return [best, which];
}

const isKerbDown = (r: Rel): boolean => r === Rel.Down || r === Rel.DownWater;

/** Coping band on the higher tile next to lower neighbours (kerb top stones, quay coping). */
function drawCoping(t: PixelBuffer, rels: Rels, m: CityMats, self: Ground): void {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      if (!inTileDiamond(x, y)) continue;
      const [u, v] = uvOf(x, y);
      const [dd, e] = bandDist(rels, isKerbDown, u, v);
      if (e === null) continue;
      const water = rels[e] === Rel.DownWater || self === 'quay';
      const width = water ? 0.19 : 0.13;
      if (dd >= width) continue;
      const along = e === 'nw' || e === 'se' ? v : u;
      const joint = mod(along * 4, 1) < 0.07; // kerb stones 1/4 tile long
      let c = water ? lighter(m.quayLit) : m.kerbTop;
      if (dd < 0.065) c = lighter(c); // arris catches the sun
      if (joint) c = darker(c);
      if (dd >= width - 0.065) c = darker(water ? m.quayLit : m.kerbLit); // inner joint line
      setPixel(t, x, y, c);
    }
  }
}

/** Faces of higher neighbours hanging into this tile (kerb faces, quay walls, bridge piers). */
function drawFaces(
  t: PixelBuffer,
  rels: Rels,
  m: CityMats,
  self: Ground,
  levels: Record<NeighbourDir, number>,
): void {
  const myLevel = GROUND_LEVEL[self];
  const tops: Array<[NeighbourDir, number, number]> = [
    ['nw', -16, -8],
    ['ne', 16, -8],
    ['n', 0, -16],
    ['w', -32, 0],
    ['e', 32, 0],
  ];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      if (!inTileDiamond(x, y)) continue;
      let seen: NeighbourDir | null = null;
      for (let k = 1; k <= 9; k++) {
        const yy = y - k;
        if (yy >= 0 && inTileDiamond(x, yy)) continue; // still inside this tile
        // Which neighbour holds (x, yy)?
        let hit: [NeighbourDir, number] | null = null;
        for (const [dir, ox, oy] of tops) {
          if (inTileDiamond(x - ox, yy - oy)) {
            hit = [dir, ox];
            break;
          }
        }
        if (!hit) break;
        const [dir, ox] = hit;
        if (seen === dir) continue;
        seen = dir;
        const h = levels[dir] - myLevel;
        const rel = rels[dir];
        if (rel === Rel.None) continue;
        if (h < k) {
          // Water in the shadow of a quay wall: darker band right below the face.
          if (self === 'water' && k <= h + 3) {
            setPixel(t, x, y, k <= h + 2 ? m.water.deep : darker(getPixel(t, x, y)));
            break;
          }
          continue;
        }
        // Face pixel: row k-1 from the top of the face. Lit if under the neighbour's SW edge.
        const lit = x + 0.5 < 16 + ox;
        setPixel(t, x, y, facePixel(rel, m, lit, k - 1, h, x));
        break;
      }
    }
  }
}

function facePixel(rel: Rel, m: CityMats, lit: boolean, row: number, h: number, x: number): RGBA {
  const bottom = row === h - 1;
  switch (rel) {
    case Rel.KerbUp: {
      let c = lit ? m.kerbLit : m.kerbShade;
      if (mod(x, 8) === 0) c = darker(c);
      if (bottom) c = darker(c);
      return c;
    }
    case Rel.QuayUp:
    case Rel.BridgeUp: {
      // Ashlar courses of 3 px with staggered joints; wet dark base + algae line.
      const course = Math.floor(row / 3);
      const base =
        rel === Rel.BridgeUp
          ? lit
            ? lighter(m.quayLit)
            : m.quayLit
          : lit
            ? m.quayLit
            : m.quayShade;
      if (row === 0) return lighter(base);
      if (row >= h - 1) return m.water.deep;
      if (row >= h - 2) return C('olive1');
      if (row >= h - 3) return darker(base);
      if (row % 3 === 0) return darker(base);
      if (mod(x + course * 4, 8) === 0) return darker(base);
      return base;
    }
    case Rel.BankUp: {
      if (row === 0) return C('green2');
      if (row >= h - 1) return m.water.deep;
      const c = lit ? C('earth3') : C('earth2');
      return (x + row) % 5 === 0 ? darker(c) : c;
    }
    default:
      return lit ? m.kerbLit : m.kerbShade;
  }
}

/** Contact shadow (ambient occlusion) next to building lots. */
function drawLotShadow(t: PixelBuffer, rels: Rels): void {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      if (!inTileDiamond(x, y)) continue;
      const [u, v] = uvOf(x, y);
      const [dd] = bandDist(rels, (r) => r === Rel.Lot, u, v);
      if (dd < 0.07) setPixel(t, x, y, darker(getPixel(t, x, y)));
    }
  }
}

/** Grass ↔ paving transitions. */
function drawSoftEdges(t: PixelBuffer, rels: Rels, m: CityMats, self: Ground, seed: number): void {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      if (!inTileDiamond(x, y)) continue;
      const [u, v] = uvOf(x, y);
      if (self === 'grass') {
        // Lawn edge: a darker trimmed rim against paving, irregular tufts against gravel.
        const [dd] = bandDist(rels, (r) => r === Rel.PavedNext, u, v);
        if (dd < 0.07) setPixel(t, x, y, C('green2'));
        else if (dd < 0.13 && (x + y) % 3 === 0) setPixel(t, x, y, C('green4'));
        continue;
      }
      const [dd, e] = bandDist(rels, (r) => r === Rel.GrassNext, u, v);
      if (e === null) continue;
      if (self === 'parkPath') {
        // Grass creeping over the gravel edge: scalloped tufts.
        const along = e === 'nw' || e === 'se' ? v : u;
        const n = hashF(Math.floor(along * 10), seed & 3, e.length);
        const reach = 0.06 + n * 0.1 + (Math.sin(along * 37) + 1) * 0.02;
        if (dd < reach) setPixel(t, x, y, dd < reach - 0.05 ? C('green3') : C('green4'));
        else if (dd < reach + 0.05 && (x * 7 + y * 3) % 5 === 0) setPixel(t, x, y, C('green3'));
      } else {
        // Paving/road: stone edging strip.
        if (dd < 0.07)
          setPixel(
            t,
            x,
            y,
            mod((e === 'nw' || e === 'se' ? v : u) * 4, 1) < 0.08 ? m.kerbShade : m.kerbTop,
          );
        else if (dd < 0.1) setPixel(t, x, y, m.kerbShade);
      }
    }
  }
}

/** London double yellow lines along kerbs; road edge lines elsewhere are omitted. */
function drawKerbLines(t: PixelBuffer, rels: Rels, m: CityMats): void {
  if (!m.yellowLines) return;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      if (!inTileDiamond(x, y)) continue;
      const [u, v] = uvOf(x, y);
      for (const e of ['nw', 'ne', 'se', 'sw'] as const) {
        if (rels[e] !== Rel.KerbUp) continue;
        const dd = edgeDist(e, u, v);
        const off = e === 'nw' || e === 'ne' ? 0.13 : 0.03; // far edges: below the kerb face
        if ((dd > off + 0.04 && dd < off + 0.1) || (dd > off + 0.15 && dd < off + 0.21)) {
          setPixel(t, x, y, (x + y) % 7 === 0 ? C('ochre1') : C('ochre2'));
        }
      }
    }
  }
}

function drawMarking(t: PixelBuffer, mk: Marking, m: CityMats): void {
  if (mk === 'none') return;
  const axisI = mk.endsWith('I');
  if (m.tram && mk.startsWith('dash')) {
    drawTram(t, axisI, m.tram);
    return;
  }
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      if (!inTileDiamond(x, y)) continue;
      const [u0, v0] = uvOf(x, y);
      // a = along the road axis, b = across it.
      const a = axisI ? u0 : v0;
      const b = axisI ? v0 : u0;
      let on = false;
      if (mk.startsWith('dash')) on = Math.abs(b - 0.5) < 0.07 && a > 0.22 && a < 0.78;
      else if (mk.startsWith('zebra')) on = mod(b, 0.5) < 0.25 && a > 0.12 && a < 0.88;
      else if (mk.startsWith('stop')) on = Math.abs(a - 0.5) < 0.09;
      if (!on) continue;
      // Worn paint: a few pixels show tarmac through, deterministic.
      const wear = hash(x, y, 91) % 13 === 0;
      setPixel(t, x, y, wear ? m.paintWorn : m.paint);
    }
  }
}

/** Tram tracks along the road (CityMats.tram): steel rail with a dark groove on its far side. */
function drawTram(t: PixelBuffer, axisI: boolean, tr: NonNullable<CityMats['tram']>): void {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      if (!inTileDiamond(x, y)) continue;
      const [u0, v0] = uvOf(x, y);
      const b = axisI ? v0 : u0;
      for (const r of tr.at) {
        const db = (b - r) * 32;
        if (db >= -1 && db < 1) setPixel(t, x, y, db < 0 ? tr.railHi : tr.rail);
        else if (db >= 1 && db < 2) setPixel(t, x, y, tr.groove);
      }
    }
  }
}

/** Steps: treads & risers rising toward the lot (Capitol) side. */
function stepsFill(m: CityMats, rels: Rels): Fill {
  const towardI = rels.nw === Rel.StepsTop && rels.ne !== Rel.StepsTop;
  const tread = m.plaza.tones[1]!;
  return (x, y) => {
    const [u, v] = uvOf(x, y);
    const a = towardI ? u : v; // rising toward −a
    const p = mod(a * 3, 1); // three steps per tile
    if (p < 0.12) return lighter(tread); // nosing catches light
    if (p < 0.6) return tread;
    // Riser faces +a: lit if it faces SW (+v), shaded if it faces SE (+u).
    const riser = towardI ? darker(tread, 2) : darker(tread);
    return p > 0.92 ? darker(riser) : riser;
  };
}

// ---------------------------------------------------------------------------------------------
// Upright edge details: balustrades & parapets (drawn into the 32×24 image)
// ---------------------------------------------------------------------------------------------

/** Diamond edge row (in 32×16 coords) for column x on the given edge. */
function edgeRow(e: EdgeName, x: number): number {
  if (e === 'nw' || e === 'ne') {
    for (let y = 0; y < 16; y++) if (inTileDiamond(x, y)) return y;
  } else {
    for (let y = 15; y >= 0; y--) if (inTileDiamond(x, y)) return y;
  }
  return -1;
}

function drawRailing(
  img: PixelBuffer,
  e: EdgeName,
  m: CityMats,
  kind: 'balustrade' | 'parapet',
): void {
  const x0 = e === 'nw' || e === 'sw' ? 1 : 16;
  const x1 = e === 'nw' || e === 'sw' ? 15 : 30;
  const lit = e === 'ne' || e === 'sw';
  const H = kind === 'parapet' ? 4 : 6;
  const r =
    kind === 'parapet'
      ? { top: lighter(m.quayLit), lit: m.quayLit, shade: m.quayShade, dark: m.quayJoint }
      : m.rail;
  const iron = m.ironRail && kind === 'balustrade';
  for (let x = x0; x <= x1; x++) {
    const base = edgeRow(e, x) + GROUND_HEADROOM;
    const post = mod(x, 16) === 1 || mod(x, 16) === 0;
    for (let k = 0; k < H; k++) {
      const yy = base - k;
      let c: RGBA | null;
      if (kind === 'parapet') {
        c = k === H - 1 ? r.top : lit ? r.lit : r.shade;
        if (k === 0) c = r.dark;
        if (k < H - 1 && mod(x + (k > 1 ? 4 : 0), 8) === 0) c = r.dark;
      } else if (k === H - 1) c = r.top;
      else if (k === H - 2) c = lit ? r.lit : r.shade;
      else if (k === 0) c = r.dark;
      else if (post) c = lit ? r.lit : r.shade;
      else if (iron) c = mod(x, 2) === 0 ? r.dark : k === 2 ? r.shade : null;
      else c = mod(x, 2) === 0 ? (k === 2 ? r.lit : r.shade) : k === 1 ? r.dark : null;
      if (c !== null) setPixel(img, x, yy, c);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Main painter
// ---------------------------------------------------------------------------------------------

const tileCache = new Map<string, PixelBuffer>();

function relsOf(ctx: GroundCtx): Rels {
  const r = {} as Rels;
  for (const d of NEIGHBOUR_DIRS) r[d] = relation(ctx.ground, ctx[d]);
  return r;
}

function levelsOf(ctx: GroundCtx): Record<NeighbourDir, number> {
  const l = {} as Record<NeighbourDir, number>;
  for (const d of NEIGHBOUR_DIRS) l[d] = GROUND_LEVEL[ctx[d]];
  return l;
}

function variantOf(ctx: GroundCtx): number {
  return hash(ctx.seed, 0x77) % GROUND_VARIANTS;
}

/** Canonical cache key of a ground tile request. */
export function groundTileKey(ctx: GroundCtx): string {
  const rels = relsOf(ctx);
  const lv = levelsOf(ctx);
  let k = `${ctx.city}|${ctx.ground}|${MARKABLE.has(ctx.ground) ? (ctx.marking ?? 'none') : 'none'}|${variantOf(ctx)}|`;
  for (const d of NEIGHBOUR_DIRS) k += `${rels[d]}.${rels[d] === Rel.None ? 0 : lv[d]},`;
  if (ctx.ground === 'water') k += `f${(ctx.frame ?? 0) % WATER_FRAMES}`;
  return k;
}

/** Paint (or fetch from cache) one ground tile — 32×24, anchor GROUND_ANCHOR. */
export function groundTile(ctx: GroundCtx): PixelBuffer {
  const key = groundTileKey(ctx);
  let img = tileCache.get(key);
  if (!img) {
    img = paintGround(ctx);
    tileCache.set(key, img);
  }
  return img;
}

/** All animation frames of a tile: WATER_FRAMES for water, else 1. */
export function groundTileFrames(ctx: GroundCtx): PixelBuffer[] {
  if (ctx.ground !== 'water') return [groundTile(ctx)];
  return Array.from({ length: WATER_FRAMES }, (_, f) => groundTile({ ...ctx, frame: f }));
}

export function isAnimatedGround(g: Ground): boolean {
  return g === 'water';
}

/** Build the ctx for tile (i, j) of a map (off-map neighbours = own ground). */
export function groundCtxAt(map: MapData, i: number, j: number, frame = 0): GroundCtx {
  const at = (ii: number, jj: number, own: Ground): Ground => {
    if (ii < 0 || jj < 0 || ii >= map.w || jj >= map.h) return own;
    return GROUNDS[map.ground[jj * map.w + ii]!] ?? own;
  };
  const ground = GROUNDS[map.ground[j * map.w + i]!] ?? 'lot';
  const ctx: GroundCtx = {
    city: map.city,
    ground,
    marking: MARKINGS[map.marking[j * map.w + i]!] ?? 'none',
    seed: hash(i, j, 0x5eed),
    frame,
    n: ground,
    ne: ground,
    e: ground,
    se: ground,
    s: ground,
    sw: ground,
    w: ground,
    nw: ground,
  };
  for (const d of NEIGHBOUR_DIRS) {
    const [di, dj] = NEIGHBOUR_OFFSETS[d];
    ctx[d] = at(i + di, j + dj, ground);
  }
  return ctx;
}

function paintGround(ctx: GroundCtx): PixelBuffer {
  const m = envStyle(ctx.city).ground;
  const rels = relsOf(ctx);
  const variant = variantOf(ctx);
  const seed = hash(variant, ctx.ground.length, 0xabc);
  const g = ctx.ground;
  const t = createBuffer(32, 16);

  let fill: Fill;
  switch (g) {
    case 'asphalt':
      fill = asphaltFill(m, seed);
      break;
    case 'sidewalk':
      fill = sidewalkFill(m, seed);
      break;
    case 'cobble':
      fill = cobbleFill(m, seed);
      break;
    case 'plaza':
      fill = plazaFill(m, seed);
      break;
    case 'steps':
      fill = stepsFill(m, rels);
      break;
    case 'bridge':
      fill = bridgeFill(m, seed);
      break;
    case 'grass':
      fill = grassFill(m, seed);
      break;
    case 'parkPath':
      fill = gravelFill(m, seed);
      break;
    case 'water':
      fill = waterFill(m, (ctx.frame ?? 0) % WATER_FRAMES, seed);
      break;
    case 'quay':
      fill = quayFill(m);
      break;
    case 'lot':
    default:
      fill = lotFill(m);
      break;
  }
  // A city's own paving pattern (CityMats.fills) replaces the default fill.
  const own = m.fills?.[g as PatternGround];
  if (own) {
    fill = (x, y) => {
      const [u, v] = uvOf(x, y);
      return own(x, y, u, v, seed);
    };
  }
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 32; x++) if (inTileDiamond(x, y)) setPixel(t, x, y, fill(x, y));

  // Seeded detail.
  const set = DETAIL_SETS[g];
  if (set) {
    const d = new Dice(seed);
    const det = d.weighted(set);
    if (det) det(t, d, m, rels);
  }

  if (MARKABLE.has(g)) drawMarking(t, ctx.marking ?? 'none', m);
  if (g === 'asphalt') drawKerbLines(t, rels, m);
  drawSoftEdges(t, rels, m, g, seed);
  if (g !== 'water') drawCoping(t, rels, m, g);
  if (g !== 'lot') drawLotShadow(t, rels);
  drawFaces(t, rels, m, g, levelsOf(ctx));

  const img = createBuffer(GROUND_IMG_W, GROUND_IMG_H);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      const c = getPixel(t, x, y);
      if (c & 255) setPixel(img, x, y + GROUND_HEADROOM, c);
    }
  }
  // Upright edge details: far edges first, near edges over them.
  const railKind = g === 'bridge' ? 'balustrade' : g === 'quay' ? 'parapet' : null;
  if (railKind) {
    for (const e of ['nw', 'ne', 'sw', 'se'] as const) {
      if (rels[e] === Rel.DownWater) drawRailing(img, e, m, railKind);
    }
  }
  return img;
}
