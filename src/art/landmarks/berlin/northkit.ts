/**
 * Small helpers shared by the E4 North cities (Berlin, Stockholm, Amsterdam): a fuller 3×5
 * face-space alphabet (the engine kit's font lacks K, V, F …), window placement lists with
 * damage, the extra stone/brick/copper ramps of the northern capitals and a few material
 * builders. Lives in the Berlin folder; Stockholm and Amsterdam import it.
 */
import type { SwatchName } from '../../palette';
import { keyGrid, type KeyGrid } from '../../lib/grid';
import { R, hash, lv, mod, type Module, type Ramp5 } from '../engine/materials';
import { paintWindow, soot, windowStatus, type DamageState, type WinStatus } from '../engine/kit';
import type { Material, ShadeCtx } from '../engine/scene';

// --- Ramps ------------------------------------------------------------------------------------
export const RN = {
  /** Reichstag: heavy, slightly grey Silesian sandstone. */
  sandstone: ['stone0', 'stone1', 'stone2', 'stone3', 'stone4'],
  sandDark: ['earth0', 'stone0', 'stone1', 'stone2', 'stone3'],
  /** Pale Bentheim sandstone (Amsterdam palace) / Brandenburg Gate. */
  sandPale: ['stone1', 'stone2', 'stone3', 'stone4', 'stone5'],
  /** Northern copper roofs, weathered to pale green. */
  copper: ['green0', 'green1', 'teal1', 'teal2', 'teal2'],
  copperDark: ['green0', 'green1', 'green1', 'teal1', 'teal1'],
  /** Stockholm grey granite / render. */
  greyStone: ['gray3', 'gray4', 'gray5', 'gray6', 'gray7'],
  pale: ['stone1', 'gray5', 'gray6', 'gray7', 'white'],
  /** Royal Palace pale ochre-beige. */
  palaceOchre: ['earth2', 'earth3', 'earth4', 'earth5', 'earth6'],
  /** Stadshuset / Riddarholmen dark red-brown brick. */
  darkBrick: ['earth0', 'earth1', 'rust0', 'rust1', 'earth3'],
  /** Amsterdam / Cuypers red brick. */
  redBrick: ['earth0', 'rust0', 'rust1', 'rust2', 'rust3'],
  /** Concrete (TV tower). */
  concrete: ['gray2', 'gray4', 'gray5', 'gray6', 'gray7'],
  /** Red granite (Victory Column base). */
  redGranite: ['earth0', 'rust0', 'earth2', 'earth3', 'earth4'],
  /** Lead / grey flat roofs. */
  lead: ['gray1', 'gray2', 'gray3', 'gray4', 'gray5'],
  /** Mirrors / stainless steel. */
  steel: ['zinc0', 'zinc1', 'zinc2', 'zinc3', 'zinc4'],
  /** Imperial-crown blue enamel (Westerkerk). */
  royalBlue: ['navy0', 'navy1', 'navy2', 'blue1', 'blue2'],
} as const satisfies Record<string, Ramp5>;

// --- Lettering ------------------------------------------------------------------------------------
const FONT: Record<string, string> = {
  A: '.#.#.#####.##.#',
  B: '##.#.###.#.###.',
  C: '####..#..#..###',
  D: '##.#.##.##.###.',
  E: '####..##.#..###',
  F: '####..##.#..#..',
  G: '####..#.##.####',
  H: '#.##.#####.##.#',
  I: '###.#..#..#.###',
  J: '..#..#..##.####',
  K: '#.##.###.#.##.#',
  L: '#..#..#..#..###',
  M: '#.########.##.#',
  N: '##.#.##.##.##.#',
  O: '####.##.##.####',
  P: '####.#####..#..',
  R: '##.#.###.#.##.#',
  S: '####..###..####',
  T: '###.#..#..#..#.',
  U: '#.##.##.##.####',
  V: '#.##.##.##.#.#.',
  W: '#.##.##.#####.#',
  Y: '#.##.#.#..#..#.',
  Z: '###..#.#.#..###',
  '!': '.#..#..#.....#.',
};

/** Letters as a key grid ('t' = letter pixel), 3×5 glyphs, 1 px kerning, 2 px word space. */
export function letters(str: string): KeyGrid {
  const rows = ['', '', '', '', ''];
  for (const ch of str.toUpperCase()) {
    if (ch === ' ') {
      for (let y = 0; y < 5; y++) rows[y] += '.';
      continue;
    }
    const g = FONT[ch] ?? '...............';
    for (let y = 0; y < 5; y++) rows[y] += g.slice(y * 3, y * 3 + 3).replace(/#/g, 't') + '.';
  }
  return keyGrid(rows.map((r) => r.slice(0, -1)).join('\n'));
}

/** Is face pixel (fx, fz) a letter pixel of `g` placed with top-left (c0, zTop)? */
export function letterAt(g: KeyGrid, c: ShadeCtx, c0: number, zTop: number): boolean {
  const mx = c.fx - c0;
  const my = zTop - c.fz;
  return mx >= 0 && my >= 0 && mx < g.w && my < g.h && g.rows[my]![mx] === 't';
}

// --- Windows ---------------------------------------------------------------------------------------
export interface WinPlace {
  side: 'left' | 'right';
  /** Prim tag the window belongs to ('' = any). */
  tag: string;
  c0: number;
  zTop: number;
  m: Module;
  id: number;
  /** Face plane (v for 'left' faces, u for 'right' faces) — for fire overlays. */
  plane?: number;
}

/** Fire overlays for the burning windows of `list` (needs `plane`). */
export function fireOverlays(
  list: readonly WinPlace[],
  state: DamageState,
  seed: number,
  sprite = 'lm.fx.fire.s',
): Array<{ sprite: string; u: number; v: number; z: number }> {
  const out: Array<{ sprite: string; u: number; v: number; z: number }> = [];
  for (const w of list) {
    if (w.plane === undefined || windowStatus(state, w.id, seed) !== 'burning') continue;
    const a = (w.c0 + w.m.g.w / 2) / 16;
    const z = w.zTop - w.m.g.h + 2;
    out.push(w.side === 'left' ? { sprite, u: a, v: w.plane, z } : { sprite, u: w.plane, v: a, z });
  }
  return out;
}

/** Paint the first window of `list` covering this pixel (undefined = none). */
export function windowsAt(
  c: ShadeCtx,
  list: readonly WinPlace[],
  state: DamageState,
  seed: number,
): string | null | undefined {
  const side =
    c.side === 'right' ? 'right' : c.side === 'left' || c.side === 'curve' ? 'left' : null;
  if (!side) return undefined;
  for (const w of list) {
    if (w.side !== side || (w.tag && w.tag !== c.prim.tag)) continue;
    if (c.fx < w.c0 || c.fx >= w.c0 + w.m.g.w) continue;
    const p = paintWindow(w.m, c, w.c0, w.zTop, windowStatus(state, w.id, seed));
    if (p !== undefined) return p;
  }
  return undefined;
}

/** Status of a placed window. */
export function statusOf(w: WinPlace, state: DamageState, seed: number): WinStatus {
  return windowStatus(state, w.id, seed);
}

/** Soot plumes above the burnt windows of `list` on this face. */
export function sootAt(
  c: ShadeCtx,
  list: readonly WinPlace[],
  state: DamageState,
  seed: number,
  hgt = 14,
): string | undefined {
  if (state < 3) return undefined;
  const side = c.side === 'right' ? 'right' : 'left';
  for (const w of list) {
    if (w.side !== side || (w.tag && w.tag !== c.prim.tag)) continue;
    const st = windowStatus(state, w.id, seed);
    if (st !== 'burning' && st !== 'gutted') continue;
    const sd = soot(c, w.c0 + w.m.g.w / 2, w.zTop, w.m.g.w / 2, hgt);
    if (sd) return sd;
  }
  return undefined;
}

// --- Materials ---------------------------------------------------------------------------------------

/** Plain flat-ish material with contact edges and optional rim light. */
export function flat(r: Ramp5, rim = false): Material {
  return (c) => {
    if (c.night) return null;
    if (c.side === 'back') return r[0];
    if (c.edge) return r[0];
    return lv(r, c.level + (rim && c.rim && c.level >= 3 ? 1 : 0));
  };
}

/** Brick: running-bond mortar every 3 px with half-brick offsets. */
export function brickAt(c: ShadeCtx, r: Ramp5): SwatchName {
  const row = Math.floor(c.fz / 2);
  if (mod(c.fz, 2) === 0) return lv(r, c.level - 1);
  if (mod(c.fx + (row % 2) * 2, 4) === 0 && hash(c.fx, c.fz) < 0.6) return lv(r, c.level - 1);
  return lv(r, c.level);
}

/** Copper / lead roof with standing seams along the slope. */
export function seamRoof(r: Ramp5, scorch?: (u: number, v: number) => 0 | 1 | 2): Material {
  return (c) => {
    if (c.side === 'back') return c.night ? 'ochre2' : hash(c.px, c.py) < 0.5 ? 'ochre3' : 'rust3';
    if (c.night) return null;
    if (c.edge) return r[0];
    const sc = scorch?.(c.u, c.v) ?? 0;
    if (sc === 2) return lv(R.char, c.level - 1);
    if (sc === 1) return hash(c.px, c.py) < 0.3 ? 'rust1' : lv(R.char, c.level);
    const seam = mod(c.side === 'slopeR' || c.side === 'right' ? c.v * 16 : c.u * 16, 4) < 1;
    if (seam) return lv(r, c.level - (c.level >= 4 ? 2 : 1));
    return lv(r, c.level);
  };
}

/** Front-facing test for a point on an ellipsoid (view ray direction (0.5, 0.5, 8)). */
export function facesViewer(
  u: number,
  v: number,
  z: number,
  e: { uc: number; vc: number; zc: number; ru: number; rv: number; rz: number },
): boolean {
  return (
    ((u - e.uc) / (e.ru * e.ru)) * 0.5 +
      ((v - e.vc) / (e.rv * e.rv)) * 0.5 +
      ((z - e.zc) / (e.rz * e.rz)) * 8 >
    0
  );
}
