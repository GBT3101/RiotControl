/**
 * Shared pieces of the E4 South landmark art (Rome, Barcelona, Milan): Mediterranean stone and
 * roof ramps, terracotta coppi roofs, sampietrini / plaza paving, a window-slot painter with
 * damage bookkeeping (fires, soot), wall holes for state 4 and the interior seen through them.
 * Barcelona and Milan import this file; it imports only the engine (never registry/index).
 */
import type { Material, PrimOpts, Prim, Scene, ShadeCtx } from '../engine/scene';
import { R, hash, lv, mod, mod_, type Module, type Ramp5 } from '../engine/materials';
import { paintWindow, soot, windowStatus, type DamageState, type WinStatus } from '../engine/kit';
import type { Overlay } from '../types';

// --- Ramps (RIOT-64 swatches only; cool shadows → warm lights) ----------------------------------
export const S = {
  /** Roman travertine: warm cream, pitted. */
  travertine: ['stone1', 'stone2', 'stone3', 'stone4', 'stone5'],
  /** Roman wall render: sienna / burnt ochre. */
  sienna: ['earth1', 'earth3', 'earth4', 'earth5', 'earth6'],
  /** Terracotta coppi roof tiles. */
  terracotta: ['rust0', 'rust1', 'rust2', 'rust3', 'rust4'],
  /** Weathered terracotta (lower contrast). */
  tileOld: ['earth1', 'rust1', 'earth3', 'rust2', 'rust3'],
  /** Basalt sampietrini. */
  basalt: ['ink', 'gray1', 'gray2', 'gray3', 'gray4'],
  /** Milanese grey stone (Palazzo Marino, Castello stone trims). */
  milanStone: ['gray2', 'gray4', 'gray5', 'gray6', 'gray7'],
  /** Barcelona pale ochre stucco. */
  stucco: ['earth2', 'earth3', 'earth4', 'ochre2', 'ochre3'],
  /** Lombard / Catalan red brick (warmer than London brick). */
  redBrick: ['earth1', 'rust1', 'rust2', 'rust3', 'rust4'],
  /** Candoglia marble (pinkish white). */
  candoglia: ['stone2', 'gray6', 'stone4', 'gray7', 'white'],
  /** Montjuïc sandstone (Sagrada Família, Columbus base). */
  sandstone: ['stone0', 'stone1', 'stone2', 'stone3', 'stone4'],
  /** Dark weathered sandstone (Nativity façade). */
  sandOld: ['earth0', 'stone0', 'stone1', 'stone2', 'stone3'],
  /** Cast iron painted dark green-grey. */
  ironGreen: ['ink', 'green0', 'gray2', 'gray3', 'gray4'],
} as const satisfies Record<string, Ramp5>;

/** Positive-modulo helper re-export for builders. */
export { mod, hash, lv };

// --- Ground ---------------------------------------------------------------------------------

/** Roman sampietrini: small basalt setts laid in diagonal courses. */
export const sampietrini: Material = (c) => {
  if (c.night) return null;
  if (c.side !== 'top') return lv(S.basalt, c.level - 1);
  if (c.edge) return S.basalt[0];
  const a = Math.floor((c.u + c.v) * 9);
  const b = Math.floor((c.u - c.v) * 9 + (mod(a, 2) ? 0.5 : 0));
  const joint = mod((c.u + c.v) * 9, 1) < 0.18 || mod((c.u - c.v) * 9 + (mod(a, 2) ? 0.5 : 0), 1) < 0.12;
  if (joint) return lv(S.basalt, c.level - 1);
  return lv(S.basalt, c.level - (hash(a, b) < 0.25 ? 1 : 0));
};

/** Pale stone plaza slabs (Milan / Barcelona): big square flags with joints. */
export function slabs(r: Ramp5 = R.paving, n = 3): Material {
  return (c) => {
    if (c.night) return null;
    if (c.side !== 'top') return lv(R.granite, c.level - 1);
    const ju = mod(c.u * n, 1) < 0.07;
    const jv = mod(c.v * n, 1) < 0.14;
    return lv(r, c.level - (ju || jv ? 1 : 0));
  };
}

/** Park gravel (sauló, Ciutadella) with a few darker grains. */
export const saulo: Material = (c) => {
  if (c.night) return null;
  if (c.side !== 'top') return lv(R.gravel, c.level - 1);
  return lv(['stone1', 'stone2', 'stone3', 'stone4', 'stone4'], c.level - (hash(c.px, c.py >> 1) < 0.1 ? 1 : 0));
};

export const lawn: Material = (c) => {
  if (c.night) return null;
  if (c.side !== 'top') return lv(R.grass, c.level - 2);
  return lv(R.grass, c.level - 1 - (mod(c.px * 3 + c.py * 5, 11) === 0 ? 1 : 0));
};

// --- Roofs ----------------------------------------------------------------------------------

/**
 * Terracotta coppi roof: channels of curved tiles running down the slope (darker joints every
 * 3 px across the slope), faint courses; scorch zones char it (states 3–4).
 */
export function coppi(r: Ramp5 = S.terracotta, scorch?: (u: number, v: number) => 0 | 1 | 2): Material {
  return (c) => {
    if (c.side === 'back') return c.night ? 'ochre2' : hash(c.px, c.py) < 0.5 ? 'ochre3' : 'rust3';
    if (c.night) return null;
    if (c.edge) return r[0];
    const sc = scorch?.(c.u, c.v) ?? 0;
    if (sc === 2) return lv(R.char, c.level - 1);
    if (sc === 1) return hash(c.px, c.py) < 0.3 ? 'rust1' : lv(R.char, c.level);
    if (c.side === 'top') return lv(r, c.level - 1);
    const across = c.side === 'slopeL' ? c.u * 16 : c.v * 16;
    const ch = mod(Math.floor(across), 3);
    if (ch === 0) return lv(r, c.level - 1);
    if (ch === 1 && c.level >= 3 && mod(c.fz, 4) !== 0) return lv(r, c.level + 1);
    return lv(r, c.level - (mod(c.fz, 4) === 0 ? 1 : 0));
  };
}

// --- Window slots ---------------------------------------------------------------------------

export interface WinSlot {
  side: 'left' | 'right';
  /** Face column of the module's left edge, z of its top row. */
  fx: number;
  zTop: number;
  m: Module;
  /** Plane coordinate of the face (v for left faces, u for right faces) — fire placement. */
  plane: number;
}

export interface Windows {
  /** Paint the window under this pixel (undefined = none). */
  paint(c: ShadeCtx, side: 'left' | 'right'): string | null | undefined;
  /** Soot plume above a burnt window (undefined = none). */
  soot(c: ShadeCtx, side: 'left' | 'right'): string | undefined;
  status: WinStatus[];
}

/**
 * Damage-aware window painter for a list of slots: statuses roll per slot; burning windows
 * push fire overlays (every `fireEvery`-th, to keep the count sane) into `ov`.
 */
export function windows(
  slots: readonly WinSlot[],
  state: DamageState,
  seed: number,
  ov: Overlay[],
  fireEvery = 2,
): Windows {
  const status = slots.map((_, k) => windowStatus(state, k * 7 + 3, seed));
  let n = 0;
  slots.forEach((s, k) => {
    if (status[k] !== 'burning') return;
    if (n++ % fireEvery !== 0) return;
    const fx = s.fx + s.m.g.w / 2;
    const z = s.zTop - s.m.g.h + 2;
    const big = s.m.g.h >= 12;
    const sprite = big ? 'lm.fx.fire.m' : 'lm.fx.fire.s';
    ov.push(
      s.side === 'left'
        ? { sprite, u: fx / 16, v: s.plane + 0.02, z }
        : { sprite, u: s.plane + 0.02, v: fx / 16, z },
    );
  });
  const bySide = {
    left: slots.map((s, k) => [s, k] as const).filter(([s]) => s.side === 'left'),
    right: slots.map((s, k) => [s, k] as const).filter(([s]) => s.side === 'right'),
  };
  return {
    status,
    paint(c, side) {
      for (const [s, k] of bySide[side]) {
        if (c.fx < s.fx || c.fx >= s.fx + s.m.g.w) continue;
        if (c.fz > s.zTop || c.fz <= s.zTop - s.m.g.h) continue;
        if (Math.abs((side === 'left' ? c.v : c.u) - s.plane) > 0.08) continue;
        const p = paintWindow(s.m, c, s.fx, s.zTop, status[k]!);
        if (p !== undefined) return p;
      }
      return undefined;
    },
    soot(c, side) {
      for (const [s, k] of bySide[side]) {
        const st = status[k];
        if (st !== 'burning' && st !== 'gutted') continue;
        if (Math.abs((side === 'left' ? c.v : c.u) - s.plane) > 0.08) continue;
        const sd = soot(c, s.fx + s.m.g.w / 2, s.zTop, s.m.g.w / 2, 14);
        if (sd) return sd;
      }
      return undefined;
    },
  };
}

// --- Holes (state 4) ------------------------------------------------------------------------

export interface Hole {
  side: 'left' | 'right';
  fx: number;
  z: number;
  r: number;
}

/** Is face point (fx, z) inside a ragged hole (grown by `grow` px for the brick rim)? */
export function inHole(holes: readonly Hole[], side: 'left' | 'right', fx: number, z: number, grow = 0): boolean {
  return holes.some((h) => {
    if (h.side !== side) return false;
    const dx = fx - h.fx;
    const dz = (z - h.z) * 1.2;
    const a = Math.atan2(dz, dx);
    const rr = h.r + Math.sin(a * 5 + h.fx) * 1.6 + Math.cos(a * 3) * 1.2 + grow;
    return dx * dx + dz * dz < rr * rr;
  });
}

/** Ragged brick rim around a hole (undefined outside). */
export function holeRim(holes: readonly Hole[], c: ShadeCtx, side: 'left' | 'right', brick: Ramp5 = R.brick): string | null | undefined {
  if (!holes.length || !inHole(holes, side, c.fx, c.fz, 2)) return undefined;
  if (c.night) return null;
  return lv(brick, c.level - (hash(c.fx, c.fz) < 0.4 ? 1 : 0));
}

/** Cut for a box whose front (+v, plane 3) and side (+u, plane 1) faces carry holes. */
export function holeCut(holes: readonly Hole[]): ((u: number, v: number, z: number, f: number) => boolean) | undefined {
  if (!holes.length) return undefined;
  return (u, v, z, f) => {
    if (f === 3) return inHole(holes, 'left', Math.floor(u * 16), Math.floor(z));
    if (f === 1) return inHole(holes, 'right', Math.floor(v * 16), Math.floor(z));
    return false;
  };
}

/** What shows through holes and roof gaps: dark rooms, embers low down once burning. */
export function interior(state: DamageState): Material {
  return (c) => {
    if (c.night) return c.z < 12 && hash(c.px, c.py) < 0.5 ? 'rust3' : null;
    if (state >= 3 && c.z < 10) return hash(c.px, c.py) < 0.5 ? 'rust2' : 'rust1';
    return c.z < 18 ? 'gray1' : 'ink';
  };
}

/** A face-space disc test (clock dials, rose windows): distance from (cx, cz) in face px. */
export function faceDist(c: ShadeCtx, cx: number, cz: number): number {
  return Math.hypot(c.fx + 0.5 - cx, c.z - cz);
}

// --- Elliptic solids ------------------------------------------------------------------------

/** Vertical elliptic cylinder (an ellipsoid with a huge z radius, clipped to z0..z1). */
export function ellCyl(
  s: Scene,
  uc: number,
  vc: number,
  ru: number,
  rv: number,
  z0: number,
  z1: number,
  mat: Material,
  o: PrimOpts = {},
): Prim {
  return s.ell(uc, vc, (z0 + z1) / 2, ru, rv, 1e5, mat, { ...o, zMin: z0, zMax: z1 });
}

/** Normalised elliptic radius of (u, v) about (uc, vc). */
export function ellR(u: number, v: number, uc: number, vc: number, ru: number, rv: number): number {
  return Math.hypot((u - uc) / ru, (v - vc) / rv);
}

/** Oval pond: stone rim (top `zRim`) with a water surface inside (rippled per frame). */
export function ovalBasin(
  s: Scene,
  uc: number,
  vc: number,
  ru: number,
  rv: number,
  zRim: number,
  frame: number,
  n: number,
  ramp: Ramp5 = R.granite,
  rimW = 0.12,
): void {
  const rim: Material = (c) => {
    if (c.night) return null;
    if (c.side === 'back') return lv(ramp, c.level - 1);
    if (c.edge) return ramp[0];
    if (c.side === 'top') return lv(ramp, 4);
    return c.fz >= zRim - 1 ? lv(ramp, c.level + 1) : lv(ramp, c.level);
  };
  const k = 1 - rimW / Math.min(ru, rv);
  ellCyl(s, uc, vc, ru, rv, 0, zRim, rim, {
    cut: (u, v, _z, f) => f === 1 && ellR(u, v, uc, vc, ru, rv) < k,
  });
  const water: Material = (c) => {
    const d = ellR(c.u, c.v, uc, vc, ru, rv);
    const ring = mod(Math.floor(d * 7 - (frame / n) * 3), 3);
    const spark = hash(c.px, c.py, Math.floor(frame / 2)) < 0.025;
    if (c.night) return spark || ring === 0 ? 'teal1' : null;
    if (c.side !== 'top') return lv(R.water, c.level - 1);
    if (spark) return 'white';
    if (c.edge) return lv(R.water, 1);
    return ring === 0 ? lv(R.water, 3) : lv(R.water, 2);
  };
  ellCyl(s, uc, vc, ru * k + 0.02, rv * k + 0.02, 0, zRim - 2, water, { cast: false });
}

// --- Window module factories (frame in the building's trim stone) ---------------------------

const WIN_CACHE = new Map<string, Module>();
function cached(key: string, make: () => Module): Module {
  let m = WIN_CACHE.get(key);
  if (!m) {
    m = make();
    WIN_CACHE.set(key, m);
  }
  return m;
}
const GLASS_NIGHT = { g: 'ochre2', G: 'ochre3', m: 'ochre1' } as const;

/** Tall window (9 wide) under a triangular ('tri'), segmental ('seg') or flat cornice. */
export function winPediment(kind: 'tri' | 'seg' | 'flat', r: Ramp5, h = 10): Module {
  return cached(`ped:${kind}:${r.join()}:${h}`, () => {
    const head =
      kind === 'tri'
        ? ['....P....', '..PPpPP..', 'PPpppppPP']
        : kind === 'seg'
          ? ['..PPPPP..', '.PpppppP.', 'PPPPPPPPP']
          : ['PPPPPPPPP', '.ppppppp.'];
    const body = ['.FFFFFFF.'];
    for (let y = 0; y < h; y++)
      body.push(y === 3 ? '.FmmmmmF.' : y % 4 === 0 ? '.FgGgmgF.' : '.FgggmgF.');
    body.push('.sssssss.');
    return mod_(
      [...head, ...body].join('\n'),
      {
        P: { r, d: 1 },
        p: { r, d: -1 },
        F: { r, d: 1 },
        g: R.dark,
        G: { r: R.glass, d: 0 },
        m: { r, d: -1 },
        s: { r, d: 0 },
      },
      GLASS_NIGHT,
    );
  });
}

/** Round-headed window (7 wide) with a keystone. */
export function winArch(r: Ramp5, h = 7, bars = false): Module {
  return cached(`arch:${r.join()}:${h}:${bars}`, () => {
    const rows = ['...K...', '..FKF..', '.FgggF.', 'FggGggF'];
    for (let y = 0; y < h; y++) rows.push(bars ? (y === 2 ? 'FkkkkkF' : 'FgkgkgF') : y === 2 ? 'FmmmmmF' : 'FgggmgF');
    rows.push('sssssss');
    return mod_(
      rows.join('\n'),
      {
        K: { r, d: 1 },
        F: { r, d: 0 },
        g: R.dark,
        G: { r: R.glass, d: 0 },
        m: { r, d: -1 },
        k: 'ink',
        s: { r, d: 1 },
      },
      { g: 'ochre1', G: 'ochre2', m: 'ochre1' },
    );
  });
}

/** Small square attic / mezzanine window. */
export function winSquare(r: Ramp5, w = 5, h = 4): Module {
  return cached(`sq:${r.join()}:${w}:${h}`, () => {
    const rows: string[] = [];
    for (let y = 0; y < h; y++) {
      let row = '';
      for (let x = 0; x < w; x++)
        row += y === 0 || y === h - 1 || x === 0 || x === w - 1 ? 'F' : x === 1 && y === 1 ? 'G' : 'g';
      rows.push(row);
    }
    return mod_(rows.join('\n'), { F: { r, d: 1 }, g: R.dark, G: { r: R.glass, d: 0 } }, {
      g: 'ochre1',
      G: 'ochre2',
    });
  });
}
