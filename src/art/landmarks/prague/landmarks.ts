/**
 * Secondary landmarks of Prague — the Old Town Bridge Tower, the Old Town Hall with the
 * astronomical clock (Orloj), Týn Church and the Dancing House. Contract footprints: LANDMARKS
 * in src/maps/contract.ts. All face +v (the lit SW side).
 */
import { Scene, type Material, type ShadeCtx } from '../engine/scene';
import { R, hash, lv, mod, plain, type Ramp5 } from '../engine/materials';
import { gothicWall, lancet, paintWindow } from '../engine/kit';
import type { Build } from '../types';
import type { LandmarkId } from '../../../maps/contract';
import { paving, plate, type SecondaryArt } from '../shared';

/** Dark Gothic sandstone of the towers. */
const DARK_STONE: Ramp5 = ['ink', 'gray1', 'stone0', 'gray3', 'stone1'];
const DARK_LIT: Ramp5 = ['gray1', 'stone0', 'gray3', 'stone1', 'stone2'];
/** Slate of the steep Gothic roofs. */
const SLATE: Ramp5 = ['ink', 'gray1', 'zinc0', 'zinc1', 'zinc2'];
/** Old Town Hall's warm grey-ochre stone. */
const HALL: Ramp5 = ['stone0', 'stone1', 'stone2', 'stone3', 'stone4'];
/** Terracotta tiles. */
const TILE: Ramp5 = ['earth1', 'rust1', 'rust2', 'rust3', 'rust4'];

const slateMat: Material = (c) => {
  if (c.night) return null;
  if (c.edge) return SLATE[0];
  const course = mod(c.fz, 3) === 0;
  return lv(SLATE, c.level - (course ? 1 : 0));
};
const darkPin: Material = (c) => (c.night ? null : c.edge ? 'ink' : lv(DARK_LIT, c.level));
const gold = plain(R.gold, { rim: true });

/** Gothic gatehouse-style roof: steep slate pyramid with corner turrets + finials. */
function gothicCap(
  s: Scene,
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  z0: number,
  zTop: number,
  turretH: number,
): void {
  const cu = (u0 + u1) / 2;
  const cv = (v0 + v1) / 2;
  s.hip(
    u0 + 0.08,
    u1 - 0.08,
    v0 + 0.08,
    v1 - 0.08,
    z0,
    zTop,
    Math.min(u1 - u0, v1 - v0) / 2 - 0.1,
    slateMat,
  );
  for (const [u, v] of [
    [u0, v1],
    [u1, v1],
    [u1, v0],
    [u0, v0],
  ] as const) {
    s.prismN(u, v, 0.14, 0.14, z0 - 10, z0 + 2, 8, darkPin, { rot: Math.PI / 8 });
    s.prismN(u, v, 0.16, 0, z0 + 2, z0 + 2 + turretH, 8, slateMat, { rot: Math.PI / 8 });
    s.prismN(u, v, 0.03, 0, z0 + 2 + turretH, z0 + 6 + turretH, 4, gold);
  }
  s.line(
    [
      [cu, cv, zTop],
      [cu, cv, zTop + 6],
    ],
    'ochre2',
  );
}

// ---------------------------------------------------------------------------------------------
// Old Town Bridge Tower (2 × 2)
// ---------------------------------------------------------------------------------------------

function bridgeTower(): Build {
  const s = new Scene();
  plate(s, 2, 2, (c) => {
    if (c.night) return null;
    if (c.side !== 'top') return lv(R.granite, c.level - 1);
    // Cobbles.
    return lv(
      ['gray2', 'stone0', 'stone1', 'gray4', 'stone2'],
      c.level - (hash(c.px >> 1, c.py) < 0.3 ? 1 : 0),
    );
  });
  const T = DARK_STONE;
  const wall: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(T, c.level);
    if (c.side === 'back') return c.night ? 'ochre1' : 'ink';
    const local = c.fx - (c.side === 'left' ? 0.25 : 0.25) * 16;
    const mid = 12;
    const dx = local - mid + 0.5;
    const adx = Math.abs(dx);
    // Pointed gate arch (on the +v face; the bridge runs through along v).
    if (c.side === 'left') {
      const top = 26 - (adx * adx) / 7;
      if (adx < 7 && c.z < top + 2 && c.z > 1) {
        if (adx >= 5.5 || c.z >= top) return c.night ? null : lv(DARK_LIT, c.level + 1);
      }
    }
    // Sculpture gallery: kings and saints in niches + coats of arms.
    if (c.fz > 32 && c.fz < 46) {
      const niche = mod(local, 6) > 0 && mod(local, 6) < 5;
      if (c.night) return null;
      if (c.fz === 33 || c.fz === 45) return lv(DARK_LIT, c.level);
      if (niche) {
        const fig = mod(local, 6) > 1 && mod(local, 6) < 4 && c.fz < 43;
        return fig ? lv(DARK_LIT, c.level + (c.fz > 40 ? 1 : 0)) : lv(T, c.level - 1);
      }
      return lv(T, c.level);
    }
    if (c.fz > 28 && c.fz < 32 && mod(local, 5) > 1 && mod(local, 5) < 4)
      return c.night ? null : mod(local + c.fz, 2) ? 'crim1' : lv(R.gold, c.level);
    const win = adx < 1.5 && ((c.fz > 52 && c.fz < 60) || (c.fz > 64 && c.fz < 70));
    if (c.night) return win ? 'ochre1' : null;
    if (c.edge) return T[0];
    if (win) return lv(R.dark, c.level);
    if (local < 1 || local > 22) return lv(DARK_LIT, c.level);
    if (mod(c.fz, 12) === 0) return lv(T, c.level - 1);
    const row = Math.floor(c.fz / 4);
    if (mod(c.fz, 4) === 0 || mod(local + row * 3, 7) === 0) return lv(T, c.level - 1);
    return lv(T, c.level);
  };
  s.box(0.25, 1.75, 0.25, 1.75, 1, 76, wall, {
    cut: (u, _v, z, f) => {
      if (f !== 2 && f !== 3) return false;
      const dx = Math.abs(u * 16 - 16);
      return dx < 5.5 && z > 1 && z < 26 - (dx * dx) / 7;
    },
  });
  // Machicolated gallery + the steep slate cap with corner turrets.
  s.box(0.18, 1.82, 0.18, 1.82, 76, 80, plain(DARK_LIT, { rim: true }));
  gothicCap(s, 0.2, 1.8, 0.2, 1.8, 80, 120, 12);
  // Dormer on the roof front.
  s.box(0.9, 1.1, 1.5, 1.65, 82, 88, plain(SLATE));
  s.gable(0.88, 1.12, 1.45, 1.7, 88, 92, 'v', slateMat);
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// Old Town Hall + Orloj (5 × 3)
// ---------------------------------------------------------------------------------------------

/** The Orloj on the tower's +v face: calendar dial below, astronomical dial above. */
function orloj(c: ShadeCtx, cx: number): string | null | undefined {
  const dx = c.fx + 0.5 - cx;
  // Astronomical dial: blue day sky above, dark night below, gold ring + zodiac ring.
  const az = c.z - 40;
  const r = Math.hypot(dx, az);
  if (r < 8.5) {
    if (c.night) return r < 7 ? (az > 0 ? 'blue2' : 'ochre2') : 'ochre3';
    if (r >= 7.3)
      return lv(R.gold, c.level + (mod(Math.round(Math.atan2(az, dx) * 4), 2) ? 0 : -1));
    // Zodiac ring (off-centre).
    const zr = Math.hypot(dx, az - 1.6);
    if (zr > 3.6 && zr < 4.6) return lv(R.gold, c.level);
    // Hand + sun.
    if (Math.abs(dx - az * 0.4) < 0.6 && az > -1 && r < 6.5) return 'ochre3';
    if (az > 2.5) return 'blue1';
    if (az > -1.5) return 'navy2';
    if (az > -4) return 'earth2';
    return 'ink';
  }
  // Calendar dial below.
  const cz = c.z - 20;
  const r2 = Math.hypot(dx, cz);
  if (r2 < 6.2) {
    if (c.night) return r2 < 5 ? 'ochre2' : null;
    if (r2 >= 5.4) return lv(R.gold, c.level);
    if (r2 < 1.6) return lv(R.gold, c.level);
    const seg = mod(Math.floor((Math.atan2(cz, dx) / Math.PI) * 6), 2);
    return r2 > 3.4 ? (seg ? 'white' : 'stone4') : seg ? 'blue1' : 'crim1';
  }
  // Apostle windows and the Gothic canopy above the dial.
  if (Math.abs(dx) < 9 && c.z > 49 && c.z < 60) {
    if (c.night) return Math.abs(dx) > 1.5 && Math.abs(dx) < 5 && c.z < 54 ? 'ochre2' : null;
    if (Math.abs(dx) > 1.5 && Math.abs(dx) < 5 && c.z > 50 && c.z < 54) return lv(R.dark, c.level);
    const apex = 60 - Math.abs(dx) * 1.2;
    if (c.z > apex) return undefined;
    return mod(c.fx, 3) === 0 ? lv(R.gold, c.level - 1) : lv(DARK_LIT, c.level);
  }
  // Statues flanking the dial (skeleton, Turk, vanity, miser).
  if (Math.abs(Math.abs(dx) - 11) < 1 && c.z > 32 && c.z < 42)
    return c.night ? null : Math.abs(dx) > 11 && c.z > 39 ? 'white' : lv(R.gold, c.level - 1);
  // Dark carved frame.
  if (Math.abs(dx) < 12 && c.z > 12 && c.z < 49) return c.night ? null : lv(DARK_STONE, c.level);
  return undefined;
}

function oldTownHall(): Build {
  const s = new Scene();
  plate(s, 5, 3, paving);
  const H = HALL;
  // Tower at the high-u end; the Orloj on its +v face.
  const T = { u0: 3.2, u1: 4.6, v0: 0.4, v1: 1.8 };
  const cx = ((T.u0 + T.u1) / 2) * 16;
  const tower: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(H, c.level);
    if (c.side === 'left') {
      const o = orloj(c, cx);
      if (o !== undefined) return o;
    }
    const local = c.side === 'left' ? c.fx - T.u0 * 16 : c.fx - T.v0 * 16;
    const win = Math.abs(local - 11) < 1.6 && mod(c.fz, 18) > 6 && mod(c.fz, 18) < 14 && c.fz > 60;
    if (c.night) return win ? 'ochre1' : null;
    if (c.edge) return H[0];
    if (win) return lv(R.dark, c.level);
    if (local < 1.5 || local > 21) return lv(H, c.level + 1);
    if (mod(c.fz, 18) === 0) return lv(H, c.level - 1);
    const row = Math.floor(c.fz / 4);
    if (mod(c.fz, 4) === 0 && mod(local + row * 3, 9) < 6) return lv(H, c.level - 1);
    return lv(H, c.level);
  };
  s.box(T.u0, T.u1, T.v0, T.v1, 1, 104, tower);
  // Overhanging gallery with the corner oriels and the steep cap.
  s.box(T.u0 - 0.1, T.u1 + 0.1, T.v0 - 0.1, T.v1 + 0.1, 104, 109, (c) =>
    c.night
      ? c.side === 'left' || c.side === 'right'
        ? mod(c.fx, 3) === 0
          ? 'ochre2'
          : null
        : null
      : c.edge
        ? H[0]
        : c.side !== 'top' && mod(c.fx, 3) === 0
          ? lv(R.dark, c.level)
          : lv(H, c.level + 1),
  );
  gothicCap(s, T.u0 - 0.05, T.u1 + 0.05, T.v0 - 0.05, T.v1 + 0.05, 109, 142, 10);
  // Oriel chapel on the +u face.
  s.prismN(
    T.u1 + 0.05,
    1.1,
    0.3,
    0.3,
    30,
    60,
    8,
    (c) => {
      if (c.night) return null;
      if (c.edge) return H[0];
      const w = mod(c.fx, 4) === 1 && c.fz > 38 && c.fz < 54;
      return w ? lv(R.dark, c.level) : lv(R.honeyLit, c.level);
    },
    { rot: Math.PI / 8 },
  );
  s.prismN(T.u1 + 0.05, 1.1, 0.3, 0, 60, 74, 8, slateMat, { rot: Math.PI / 8 });
  s.prismN(T.u1 + 0.05, 1.1, 0.28, 0.1, 22, 30, 8, plain(H), { rot: Math.PI / 8 });
  // The town hall wing: a row of old houses with pastel fronts, Renaissance window.
  const houses: Array<{ u0: number; u1: number; ramp: Ramp5; sgraffito?: boolean }> = [
    { u0: 0.2, u1: 1.2, ramp: ['earth2', 'earth3', 'earth4', 'earth5', 'earth6'] },
    { u0: 1.2, u1: 2.2, ramp: H, sgraffito: true },
    { u0: 2.2, u1: 3.2, ramp: ['stone0', 'stone1', 'stone3', 'stone4', 'stone5'] },
  ];
  for (const h of houses) {
    const r = h.ramp;
    const mat: Material = (c) => {
      if (c.side === 'top') return c.night ? null : lv(r, c.level);
      const local = c.side === 'left' ? c.fx - h.u0 * 16 : c.fx;
      const win = mod(local - 2, 6) < 3 && mod(c.fz, 12) > 3 && mod(c.fz, 12) < 10 && c.fz > 12;
      const door = c.side === 'left' && c.fz < 10 && mod(local, 16) > 5 && mod(local, 16) < 11;
      if (c.night) return win ? 'ochre2' : door ? 'ochre1' : null;
      if (c.edge) return r[0];
      if (door) return c.fz > 7 ? lv(r, c.level - 1) : 'earth1';
      if (win) return mod(c.fz, 12) === 7 ? lv(r, c.level + 1) : lv(R.dark, c.level);
      if (h.sgraffito && c.fz > 12) {
        // House at the Minute: black-and-white sgraffito panels.
        return mod(c.fx + c.fz, 4) < 2 && mod(c.fz, 6) > 1 ? 'gray2' : 'stone4';
      }
      if (c.fz === 12) return lv(r, c.level - 1);
      return lv(r, c.level);
    };
    s.box(h.u0, h.u1, 0.5, 2.3, 1, 48, mat);
    s.gable(h.u0, h.u1, 0.5, 2.3, 48, 64, 'u', (c) =>
      c.night ? null : c.edge ? TILE[0] : lv(TILE, c.level - (mod(c.fz, 3) === 0 ? 1 : 0) - 1),
    );
  }
  // The Renaissance window ("Praga caput regni") on the middle house: tall, gilded frame.
  s.box(1.45, 1.95, 2.3, 2.36, 22, 40, (c) =>
    c.night
      ? 'ochre2'
      : c.edge
        ? 'earth1'
        : mod(c.fx, 3) === 0 || c.fz === 31
          ? lv(R.gold, c.level)
          : lv(R.dark, c.level),
  );
  // Market umbrellas / tourists' plinth at the Orloj: a low railing in front.
  for (let u = T.u0; u <= T.u1; u += 0.125) {
    s.line(
      [
        [u, 2.4, 1],
        [u, 2.4, 4],
      ],
      'ink',
    );
  }
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// Týn Church (4 × 3): two dark spiky towers at the high-u (west) end
// ---------------------------------------------------------------------------------------------

function tynChurch(): Build {
  const s = new Scene();
  plate(s, 4, 3, paving);
  const S = DARK_STONE;
  const wall = gothicWall({
    ramp: ['gray1', 'stone0', 'gray3', 'gray4', 'stone2'],
    pitch: 8,
    off: 2,
    rows: [{ zTop: 44, h: 26, w: 3 }],
    top: 52,
    state: 0,
    seed: 3,
    decals: [],
  });
  s.box(0.3, 2.95, 0.55, 2.45, 1, 52, wall);
  s.gable(0.3, 2.95, 0.5, 2.5, 52, 96, 'u', slateMat);
  // Buttresses on the +v side.
  for (let u = 0.45; u < 2.9; u += 0.5) s.box(u, u + 0.1, 2.45, 2.62, 1, 46, plain(S));
  // Two towers.
  const tower: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(S, c.level);
    const local = c.fx - Math.floor((c.side === 'left' ? c.prim.aabb[0] : c.prim.aabb[2]) * 16);
    const win =
      Math.abs(local - 6) < 1.6 && ((c.fz > 64 && c.fz < 80) || (c.fz > 90 && c.fz < 102));
    if (c.night) return win && c.fz < 80 ? 'ochre1' : null;
    if (c.edge) return S[0];
    if (win) return lv(R.dark, c.level);
    if (local < 1.2 || local > 10.8) return lv(DARK_LIT, c.level);
    if (mod(c.fz, 16) === 0) return lv(S, c.level - 1);
    return lv(S, c.level);
  };
  const spire: Material = (c) => {
    if (c.night) return null;
    if (c.edge) return 'ink';
    return lv(SLATE, c.level - (mod(c.fz, 4) === 0 ? 1 : 0) + (c.rim ? 1 : 0));
  };
  for (const v0 of [0.12, 2.18]) {
    const u0 = 3.0;
    const u1 = 3.75;
    const v1 = v0 + 0.75;
    const cu = (u0 + u1) / 2;
    const cv = (v0 + v1) / 2;
    s.box(u0, u1, v0, v1, 1, 110, tower);
    // Gallery.
    s.box(u0 - 0.06, u1 + 0.06, v0 - 0.06, v1 + 0.06, 110, 113, plain(DARK_LIT, { rim: true }));
    // Main spire + four corner spirelets + four mid-side spirelets (the Týn crown of spikes).
    s.prismN(cu, cv, 0.34, 0.02, 113, 176, 8, spire, { rot: Math.PI / 8 });
    s.prismN(cu, cv, 0.04, 0, 176, 182, 4, gold);
    s.ell(cu, cv, 182, 0.05, 0.05, 2, gold, { zMin: 180 });
    for (const [du, dv, h] of [
      [0, 0, 30],
      [0.75, 0, 30],
      [0, 0.75, 30],
      [0.75, 0.75, 30],
      [0.375, 0, 20],
      [0.75, 0.375, 20],
      [0.375, 0.75, 20],
      [0, 0.375, 20],
    ] as const) {
      const u = u0 + du;
      const v = v0 + dv;
      s.prismN(u, v, 0.08, 0.08, 106, 116, 8, plain(DARK_LIT), { rot: Math.PI / 8 });
      s.prismN(u, v, 0.09, 0, 116, 116 + h, 8, spire, { rot: Math.PI / 8 });
      s.prismN(u, v, 0.03, 0, 114 + h, 119 + h, 4, gold);
    }
  }
  // West gable between the towers with the gilded Madonna (on the +u face).
  s.box(2.95, 3.6, 0.85, 2.18, 1, 74, (c) => {
    if (c.night) return null;
    if (c.edge) return S[0];
    if (c.side === 'right') {
      const dx = Math.abs(c.fx + 0.5 - 1.52 * 16);
      if (dx < 2 && c.fz > 58 && c.fz < 68) return lv(R.gold, c.level + 1);
      const p = paintWindow(lancet(5, 22, DARK_LIT), c, 22, 52, 'ok');
      if (p !== undefined) return p;
    }
    return lv(S, c.level);
  });
  s.gable(2.95, 3.6, 0.85, 2.18, 74, 92, 'u', (c) =>
    c.side === 'right' ? (c.night ? null : c.edge ? S[0] : lv(S, c.level)) : spire(c),
  );
  // Týn school: a low arcaded house with a Venetian gable in front of the towers (+v side).
  const school: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(R.creamWarm, c.level);
    const arch =
      c.side === 'left' &&
      c.fz < 12 &&
      mod(c.fx, 8) > 1 &&
      c.fz < 12 - Math.abs(mod(c.fx, 8) - 4.5) * 0.8;
    const win = mod(c.fx, 6) > 1 && mod(c.fx, 6) < 4 && c.fz > 16 && c.fz < 24;
    if (c.night) return win ? 'ochre2' : arch ? 'ochre1' : null;
    if (c.edge) return R.creamWarm[0];
    if (arch) return lv(R.dark, c.level - 1);
    if (win) return lv(R.dark, c.level);
    return lv(R.creamWarm, c.level);
  };
  s.box(2.6, 3.95, 2.75, 2.98, 1, 30, school);
  s.box(2.6, 3.95, 2.65, 2.75, 1, 30, school);
  s.gable(2.6, 3.95, 2.65, 2.98, 30, 40, 'v', (c) => (c.side === 'left' ? school(c) : slateMat(c)));
  return { scene: s, overlays: [] };
}

// ---------------------------------------------------------------------------------------------
// Dancing House (3 × 2): Ginger (glass) and Fred (wavy concrete) with the Medusa on top
// ---------------------------------------------------------------------------------------------

function dancingHouse(): Build {
  const s = new Scene();
  plate(s, 3, 2, paving);
  const C: Ramp5 = ['stone1', 'stone2', 'stone3', 'stone4', 'stone5'];
  // Fred: the cylindrical-ish tower with wavy window rows.
  const fred: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(C, c.level);
    const wave = Math.round(Math.sin(c.fx * 0.22) * 2.6);
    const row = mod(c.fz - wave, 10);
    const stagger = Math.floor((c.fz - wave) / 10) % 2 ? 3 : 0;
    const win = row > 3 && row < 8 && mod(c.fx + stagger, 6) < 3 && c.fz > 8;
    if (c.night) return win ? (hash(c.fx >> 2, c.fz >> 3) < 0.6 ? 'ochre2' : null) : null;
    if (c.edge) return C[0];
    if (win) return mod(c.fx + stagger, 6) === 0 ? lv(R.glass, c.level) : lv(R.dark, c.level);
    // Undulating cornice lines.
    if (row === 1 || row === 2) return lv(C, c.level + 1);
    return lv(C, c.level);
  };
  s.box(0.25, 1.75, 0.2, 1.4, 1, 64, fred);
  s.cyl(1.55, 1.25, 0.42, 1, 64, fred);
  // The Medusa: twisted metal mesh dome.
  s.ell(
    1.1,
    0.8,
    64,
    0.42,
    0.42,
    14,
    (c) => {
      if (c.night) return null;
      if (c.edge) return 'gray1';
      const a = Math.atan2(c.v - 0.8, c.u - 1.1);
      const strand = mod(a * 5 + c.z * 0.25, 1) < 0.35;
      return strand ? lv(R.metal, c.level + 1) : lv(R.metal, c.level - 1);
    },
    {
      zMin: 64,
      cut: (u, v, z) => mod(Math.atan2(v - 0.8, u - 1.1) * 5 + z * 0.25, 1) > 0.55 && z < 74,
    },
  );
  // Ginger: the pinched glass tower on slender legs at the corner.
  const GU = 2.25;
  const GV = 1.25;
  const glass: Material = (c) => {
    if (c.side === 'top') return c.night ? null : lv(R.metal, c.level);
    const a = Math.atan2(c.v - GV, c.u - GU);
    const mull = mod(a * 6, 1) < 0.16 || mod(c.fz, 6) === 0;
    if (c.night) return mull ? null : hash(Math.floor(a * 6), c.fz >> 3) < 0.6 ? 'ochre2' : 'blue1';
    if (c.edge) return 'navy0';
    if (mull) return lv(R.metal, c.level + 1);
    return lv(R.glassSky, c.level + (c.rim ? 1 : 0));
  };
  s.cone(GU, GV, 0.56, 0.3, 10, 30, glass);
  s.cone(GU, GV, 0.3, 0.62, 30, 58, glass);
  s.cyl(GU, GV, 0.6, 58, 61, plain(R.metal, { rim: true }));
  for (const [du, dv] of [
    [-0.35, 0.3],
    [0.3, 0.35],
    [0.4, -0.3],
  ] as const) {
    s.cyl(GU + du, GV + dv, 0.06, 1, 11, plain(R.metal));
  }
  // Ground-floor shopfront under Fred.
  s.box(0.25, 1.75, 1.38, 1.42, 1, 8, (c) =>
    c.night
      ? 'ochre1'
      : c.edge
        ? 'ink'
        : mod(c.fx, 6) === 0
          ? lv(R.metal, c.level)
          : lv(R.glass, c.level - 1),
  );
  return { scene: s, overlays: [] };
}

export const LANDMARKS_PRAGUE: Readonly<Partial<Record<LandmarkId, SecondaryArt>>> = {
  bridgeTower: { top: 114, frames: 1, fps: 0, build: bridgeTower },
  oldTownHall: { top: 116, frames: 1, fps: 0, build: oldTownHall },
  tynChurch: { top: 162, frames: 1, fps: 0, build: tynChurch },
  dancingHouse: { top: 66, frames: 1, fps: 0, build: dancingHouse },
};
