/**
 * BERLIN — environment style (E3 North). Gründerzeit Altbau in grey, ochre and pastel stucco with
 * hooded windows, iron balconies, dormered roofs and the odd domed corner turret; Plattenbau
 * slabs of pale prefab panels with coloured loggia stacks; sandstone for the state. Granite
 * setts, tall gas lanterns, Ampelmännchen, U- and S-Bahn signs, Litfaßsäulen, Döner and Späti,
 * orange BSR bins, linden trees, Spree boats, yellow double-deckers, ivory taxis — and graffiti
 * on every reachable surface.
 */
import type { RGBA } from '../../palette';
import { C, darker, lighter } from '../color';
import { GLOW, GLOW_HI, tag } from '../bld/kit';
import { K_GLASS, K_RELIEF, stampModule, type Face } from '../bld/face';
import * as M from '../bld/modules.grid';
import * as P from '../props.grid';
import type { PropKit, PropSprite } from '../props';
import type { EnvCity } from '../style';
import { Dice, hash } from '../util';
import * as G from './berlin.grid';
import { boatSprite, cornerTurret, mirrorSprite, solid, treeSprite } from './north.kit';

// ------------------------------------------------------------------------------- graffiti ---

/** 3×5 letters for the spray pieces on the ground floors. */
const FONT: Record<string, string[]> = {
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  I: ['#', '#', '#', '#', '#'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  N: ['#.#', '###', '###', '#.#', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  '1': ['.#', '##', '.#', '.#', '.#'],
};
const WORDS = ['KIEZ', 'BERLIN', 'ZOSE', 'RIOT', 'SATO', 'NO', 'KREIZ', 'ANTI', 'BRAT', 'TEKK'];
const SPRAY = ['crim2', 'pink2', 'lime', 'sky', 'white', 'ochre3', 'purple', 'teal2', 'rust3'];

/** A spray piece: filled letters with a drop-shadow outline, skipping glass. */
function piece(f: Face, x0: number, y0: number, d: Dice): void {
  const word = d.pick(WORDS);
  const fill = C(d.pick(SPRAY));
  const line = d.chance(0.6) ? C('ink') : C(d.pick(SPRAY));
  let x = x0;
  const marks = new Set<number>();
  for (const ch of word) {
    const g = FONT[ch];
    if (!g) continue;
    const lift = d.int(0, 1);
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < g[r]!.length; c++)
        if (g[r]![c] === '#') marks.add((y0 + r - lift) * 4096 + x + c);
    x += g[0]!.length + 1;
  }
  for (const k of marks) {
    const px = k % 4096;
    const py = Math.floor(k / 4096);
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [1, 1],
    ] as const) {
      const n = (py + dy) * 4096 + px + dx;
      if (!marks.has(n) && f.kindAt(px + dx, py + dy) !== K_GLASS) f.tint(px + dx, py + dy, line);
    }
  }
  for (const k of marks) {
    const px = k % 4096;
    const py = Math.floor(k / 4096);
    if (f.kindAt(px, py) !== K_GLASS) f.tint(px, py, fill);
  }
}

/** Wheat-pasted posters: pale sheets with a bold headline. */
function poster(f: Face, x0: number, y0: number, d: Dice): void {
  const paper = C(d.pick(['white', 'stone5', 'ochre4', 'pink3', 'sky']));
  const ink = C(d.pick(['ink', 'crim1', 'navy1']));
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 4; x++) {
      if (f.kindAt(x0 + x, y0 + y) === K_GLASS) continue;
      const head = y === 1 && x > 0 && x < 3;
      f.set(x0 + x, y0 + y, head ? ink : y === 3 && x & 1 ? darker(paper) : paper, K_RELIEF);
    }
}

// ------------------------------------------------------------------------------ Plattenbau ---

/** One prefab panel bay: joints, a wide window — or a loggia stack with a coloured parapet. */
function platteBay(
  f: Face,
  wall: RGBA,
  accent: RGBA,
  x0: number,
  y0: number,
  glow: RGBA,
  glowHi: RGBA,
): void {
  const joint = darker(wall);
  const loggia = Math.floor((x0 + 9) / 10) % 3 === 1;
  for (let y = y0; y < y0 + 10; y++)
    for (let x = x0 - 1; x < x0 + 9; x++) {
      if (x === x0 - 1 || y === y0 + 9) f.set(x, y, joint, K_RELIEF);
    }
  if (loggia) {
    // Recess with a balcony door, coloured parapet panel in front.
    for (let y = y0; y < y0 + 6; y++)
      for (let x = x0; x < x0 + 8; x++) f.set(x, y, darker(wall, 2), K_RELIEF);
    for (let y = y0 + 1; y < y0 + 6; y++)
      for (let x = x0 + 2; x < x0 + 6; x++) {
        const edge = x === x0 + 2 || x === x0 + 5 || y === y0 + 1;
        f.set(x, y, edge ? C('gray6') : C('navy1'), edge ? K_RELIEF : K_GLASS, edge ? 0 : glow);
      }
    for (let y = y0 + 6; y < y0 + 9; y++)
      for (let x = x0; x < x0 + 8; x++)
        f.set(
          x,
          y,
          y === y0 + 6 ? lighter(accent) : (x + y) % 5 === 0 ? darker(accent) : accent,
          K_RELIEF,
        );
    return;
  }
  for (let y = y0 + 2; y < y0 + 7; y++)
    for (let x = x0 + 1; x < x0 + 7; x++) {
      const edge = x === x0 + 1 || x === x0 + 6 || y === y0 + 2 || y === y0 + 6 || x === x0 + 4;
      const hi = x === x0 + 2 && y === y0 + 3;
      if (edge) f.set(x, y, C('gray7'), K_RELIEF);
      else f.set(x, y, hi ? C('zinc2') : C('navy1'), K_GLASS, glow ? (hi ? glowHi : glow) : 0);
    }
  // Sill.
  for (let x = x0 + 1; x < x0 + 7; x++) f.set(x, y0 + 7, darker(wall), K_RELIEF);
}

/** Curtain-wall bay: a full-width glass band with mullions over a stone spandrel. */
function glassBay(
  f: Face,
  wall: RGBA,
  glass: RGBA,
  x0: number,
  y0: number,
  glow: RGBA,
  glowHi: RGBA,
): void {
  for (let y = y0; y < y0 + 10; y++)
    for (let x = x0 - 1; x < x0 + 9; x++) {
      if (y >= y0 + 8) {
        f.set(x, y, y === y0 + 8 ? lighter(wall) : wall, K_RELIEF);
        continue;
      }
      if (x === x0 - 1 || x === x0 + 4) {
        f.set(x, y, C('gray4'), K_RELIEF);
        continue;
      }
      const sheen = (x - x0 + (y - y0)) % 9 === 0 || (x - x0 + (y - y0)) % 9 === 1;
      f.set(
        x,
        y,
        sheen ? C('zinc3') : y === y0 ? darker(glass) : glass,
        K_GLASS,
        glow ? (sheen ? glowHi : glow) : 0,
      );
    }
}

// ---------------------------------------------------------------------------------- props ---

function flagGermany(_x: number, y: number, _W: number, H: number): RGBA {
  const band = Math.floor((y * 3) / H);
  return band === 0 ? C('ink') : band === 1 ? C('crim2') : C('ochre3');
}

/** Ampel: car lamps cycle R / O / G, the Ampelmann goes green while the cars wait. */
function ampel(k: PropKit): PropSprite {
  const off = { R: 'rust0', O: 'earth2', G: 'green0', X: 'rust0', Y: 'green0' };
  const frames = (['R', 'O', 'G'] as const).map((on) => {
    const keys: Record<string, string> = { M: 'gray3', m: 'gray2', ...off };
    keys[on] = on === 'R' ? 'crim2' : on === 'O' ? 'ochre3' : 'lime';
    if (on === 'R') keys.Y = 'lime';
    else keys.X = 'crim2';
    return k.gridProp(G.AMPEL, keys, { shadow: 2 });
  });
  return { frames: frames.map((f) => f.frames[0]!), anchor: frames[0]!.anchor, fps: 0.25 };
}

/** Litfaßsäule with its posters recoloured per variant. */
function litfass(k: PropKit, v: number): PropSprite {
  const d = new Dice(hash(v, 0x11f));
  const pal = ['crim2', 'ochre3', 'sky', 'pink2', 'lime', 'white', 'purple', 'blue1', 'rust3'];
  return k.gridProp(
    G.LITFASS,
    {
      G: 'green1',
      g: 'green0',
      A: 'ochre2',
      p: d.pick(pal),
      P: d.pick(pal),
      y: d.pick(pal),
      C: d.pick(pal),
      n: d.pick(pal),
    },
    { shadow: 4 },
  );
}

/** Döner Imbiss kiosk: red-and-yellow sign band, the spit glowing behind the hatch. */
function doener(k: PropKit): PropSprite {
  return k.isoProp(28, (cv) => {
    const body = C('white');
    cv.box(0.22, 0.24, 0, 0.78, 0.76, 15, {
      top: null,
      left: (u, _v, z) => {
        const x = Math.floor((u - 0.22) * 32);
        const y = Math.floor(z);
        if (y < 2) return C('gray3');
        if (y >= 7 && y <= 12 && x >= 2 && x <= 15) {
          if (x >= 4 && x <= 6 && y >= 8) return y % 2 ? C('earth3') : C('earth4'); // the spit
          return x === 2 || y === 12 ? C('gray5') : C('navy1');
        }
        if (y === 5) return C('gray5'); // counter
        return body;
      },
      right: (_u, _v, z) => (Math.floor(z) < 2 ? C('gray2') : C('gray6')),
    });
    // Sign band.
    cv.box(0.18, 0.2, 15, 0.82, 0.8, 19, {
      top: () => C('gray5'),
      left: (u, _v, z) =>
        Math.floor(z) === 17 && Math.floor(u * 32) % 3 !== 0 ? C('ochre3') : C('crim1'),
      right: () => C('rust0'),
    });
    // Awning over the hatch.
    cv.box(0.2, 0.76, 12, 0.8, 0.86, 13, {
      top: (u) => (Math.floor(u * 32) % 4 < 2 ? C('crim2') : C('ochre3')),
      left: (u) => (Math.floor(u * 32) % 4 < 2 ? C('crim1') : C('ochre2')),
      right: () => C('crim1'),
    });
  });
}

/** Späti kiosk: drinks fridge glowing, crates of Mate stacked outside. */
function spaeti(k: PropKit): PropSprite {
  return k.isoProp(26, (cv) => {
    solid(cv, [0.26, 0.26, 0], [0.74, 0.74, 14], C('gray2'), C('gray3'));
    cv.box(0.26, 0.26, 2, 0.74, 0.74, 12, {
      top: null,
      left: (u, _v, z) => {
        const x = Math.floor((u - 0.26) * 32);
        const y = Math.floor(z);
        if (x % 5 === 0 || y === 2 || y === 11) return C('gray4');
        return [C('ochre3'), C('rust3'), C('lime'), C('sky')][(x + (y >> 1)) % 4]!;
      },
      right: () => C('gray1'),
    });
    cv.box(0.2, 0.2, 14, 0.8, 0.8, 17, {
      top: () => C('gray4'),
      left: (u) => (Math.floor(u * 32) % 2 ? C('pink2') : C('white')),
      right: () => C('pink1'),
    });
    // Crates.
    for (const [u, z] of [
      [0.3, 0],
      [0.42, 0],
      [0.36, 3],
    ] as const)
      solid(cv, [u, 0.78, z], [u + 0.1, 0.9, z + 3], C('ochre2'), C('ochre3'));
  });
}

/** Spree excursion boat: long white hull, glazed saloon, sun deck with railings. */
function spreeBoat(v: number): PropSprite {
  return boatSprite({
    len: v === 0 ? 1.9 : 1.6,
    beam: 0.5,
    hull: C(v === 0 ? 'white' : 'navy1'),
    seed: 51 + v,
    lit: 0.6,
    cabins: [
      {
        a: 0.08,
        b: 0.8,
        h: 6,
        col: C(v === 0 ? 'white' : 'stone5'),
        roof: C('gray6'),
        win: 'band',
        inset: 0.06,
      },
    ],
    extras: (cv, P) => {
      // Sun-deck railing and a German ensign.
      for (let k = 0; k <= 20; k++) {
        const a = 0.08 + k * 0.036;
        cv.dot(P(a, 0.42, 4), C('gray5'), 1);
        cv.dot(P(a, -0.42, 4), C('gray4'), 1);
      }
      cv.pole(P(-0.46, 0, -4), 9, C('gray5'));
      for (let z = 2; z < 5; z++)
        for (let s = 1; s < 4; s++)
          cv.dot(
            P(-0.46 - s * 0.02, 0, z),
            z === 4 ? C('ink') : z === 3 ? C('crim2') : C('ochre3'),
            1,
          );
    },
  });
}

const extra: Record<string, (k: PropKit) => PropSprite> = {
  'trafficlight.0': ampel,
  'morris.0': (k) => litfass(k, 0),
  'morris.1': (k) => litfass(k, 1),
  'kiosk.0': doener,
  'kiosk.1': spaeti,
  'metro.0': (k) =>
    k.gridProp(G.METRO_BERLIN, { M: 'gray3', m: 'gray2', B: 'navy2' }, { shadow: 3 }),
  'metro.1': (k) =>
    k.gridProp(G.SBAHN_BERLIN, { M: 'gray3', m: 'gray2', G: 'green3' }, { shadow: 3 }),
  'metro.2': (k) =>
    k.gridProp(G.US_BERLIN, { M: 'gray3', m: 'gray2', B: 'navy2', G: 'green3' }, { shadow: 3 }),
};
for (let v = 0; v < 3; v++) extra[`tree.round.${v}`] = () => treeSprite('linden', v * 7 + 2);
for (let v = 0; v < 2; v++) {
  extra[`boat.${v}.i`] = () => spreeBoat(v);
  extra[`boat.${v}.j`] = () => mirrorSprite(spreeBoat(v));
}

// ---------------------------------------------------------------------------------- style ---

const ALTBAU: ReadonlyArray<readonly [string, number]> = [
  ['gray6', 4], // grey stucco
  ['gray5', 2], // sooty grey
  ['ochre2', 3], // ochre
  ['stone4', 3], // cream
  ['earth6', 2], // salmon pastel
  ['zinc4', 2], // pale blue-grey pastel
  ['earth7', 1], // pale peach
  ['stone3', 2], // sand
];

export const berlin: EnvCity = {
  ground: {
    asphalt: C('gray3'),
    asphaltSpeck: [C('gray2'), C('zinc1')],
    paint: C('white'),
    paintWorn: C('gray6'),
    yellowLines: false,
    kerbTop: C('gray6'),
    kerbLit: C('gray5'),
    kerbShade: C('gray3'),
    // Granite slabs down the middle with small mosaic setts either side.
    side: {
      tones: [C('gray5'), C('gray5'), C('gray6'), C('gray5'), C('stone2')],
      joint: C('gray3'),
      grid: { rows: 2, cols: 1, stagger: 0 },
    },
    // Kopfsteinpflaster.
    cobble: {
      tones: [C('gray4'), C('gray3'), C('stone1'), C('gray4'), C('gray5')],
      joint: C('gray2'),
      grid: { rows: 4, cols: 4, stagger: 0.5 },
    },
    plaza: {
      tones: [C('gray5'), C('gray6'), C('stone2')],
      border: C('gray4'),
      joint: C('gray3'),
    },
    grass: { base: 'grass', stripes: false, dry: 0.08 },
    gravel: { base: C('stone2'), dark: C('stone1'), light: C('stone3') },
    // The Spree: murky green-grey.
    water: {
      deep: C('green0'),
      base: C('zinc1'),
      ripple: C('green0'),
      hi: C('zinc2'),
      spark: C('zinc3'),
    },
    quayLit: C('stone2'),
    quayShade: C('stone1'),
    quayJoint: C('stone0'),
    rail: { top: C('gray3'), lit: C('gray2'), shade: C('gray1'), dark: C('ink') },
    lot: C('gray4'),
    leaves: true,
    ironRail: true,
    // Berlin pavement: a band of small mosaic setts beside the granite slabs.
    fills: {
      sidewalk: (x, y, u, _v, seed) => {
        if (u < 0.32) {
          const cx = Math.floor((x + (y & 1)) / 2);
          const h = hash(cx, y, 7 + (seed & 1)) % 9;
          if (((x + y * 2) & 3) === 0) return C('gray3');
          return h < 3 ? C('gray4') : h < 5 ? C('stone2') : h < 7 ? C('gray5') : C('stone1');
        }
        if (u < 0.36) return C('gray3');
        const r = Math.floor((_v * 2 + 1e-6) % 2);
        const edge = Math.abs(_v * 2 - Math.round(_v * 2)) < 0.05;
        if (edge) return C('gray4');
        return r === 0
          ? C('gray5')
          : hash(Math.floor(_v * 2), 1, seed) % 5 === 0
            ? C('gray6')
            : C('gray5');
      },
    },
  },

  awnings: [
    ['crim1', 'white'],
    ['green1', 'white'],
    ['navy1', 'white'],
    ['gray1', 'ochre2'],
  ],
  look(kind, d, site) {
    if (kind === 'civic') {
      return {
        mat: 'ashlar',
        wall: C(d.pick(['stone3', 'stone4', 'stone2'])),
        groundMat: 'ashlar',
        ground: C('stone2'),
        trim: C('stone5'),
        frame: C('gray2'),
        shutter: C('gray6'),
        iron: C('ink'),
        ironHi: C('gray2'),
        door: C(d.pick(['earth1', 'gray1'])),
        slope: 'zinc',
        flat: C('gray3'),
        quoins: false,
        variant: 'stone',
      };
    }
    const flat = site !== undefined && site.roof === 'flat';
    const platte =
      flat &&
      kind === 'residential' &&
      site !== undefined &&
      (site.storeys >= 6 ? d.chance(0.85) : site.storeys >= 5 ? d.chance(0.3) : false);
    if (platte) {
      return {
        mat: 'smooth',
        wall: C(d.pick(['gray7', 'stone4', 'gray6', 'stone4'])),
        groundMat: 'smooth',
        ground: C('gray5'),
        trim: C('gray6'),
        frame: C('gray7'),
        // Loggia panels: GDR orange, green, blue, ochre.
        shutter: C(d.pick(['rust3', 'green3', 'blue1', 'ochre3', 'rust2', 'teal1'])),
        iron: C('gray2'),
        ironHi: C('gray4'),
        door: C('gray3'),
        slope: 'slate',
        flat: C('gray3'),
        quoins: false,
        variant: 'platte',
      };
    }
    if (kind === 'commercial' && d.chance(0.18)) {
      // Post-Wende glass office (Potsdamer Platz, the new ministries).
      return {
        mat: 'smooth',
        wall: C(d.pick(['gray6', 'gray7', 'stone4'])),
        groundMat: 'smooth',
        ground: C('gray5'),
        trim: C('gray7'),
        frame: C('gray5'),
        shutter: C(d.pick(['zinc1', 'navy2', 'teal1'])),
        iron: C('gray2'),
        ironHi: C('gray4'),
        door: C('gray2'),
        slope: 'zinc',
        flat: C('gray4'),
        quoins: false,
        variant: 'glass',
      };
    }
    if (kind === 'commercial' && d.chance(0.25)) {
      // Sandstone office block (Friedrichstraße, the ministries).
      const wall = d.pick(['stone3', 'stone4', 'stone2', 'gray6']);
      return {
        mat: 'ashlar',
        wall: C(wall),
        groundMat: 'ashlar',
        ground: darker(C(wall)),
        trim: lighter(C(wall)),
        frame: C('stone5'),
        shutter: C('gray6'),
        iron: C('ink'),
        ironHi: C('gray2'),
        door: C('gray1'),
        slope: 'zinc',
        flat: C('gray3'),
        quoins: false,
        variant: 'stone',
      };
    }
    const wall = d.weighted(ALTBAU);
    return {
      mat: 'stucco',
      wall: C(wall),
      groundMat: 'smooth',
      ground: d.chance(0.5) ? darker(C(wall)) : C(d.pick(['gray4', 'stone2', 'gray5'])),
      trim: C(d.pick(['white', 'stone5', 'gray7'])),
      frame: C(d.pick(['white', 'white', 'gray7', 'earth2'])),
      shutter: C('gray6'),
      iron: C('ink'),
      ironHi: C('gray2'),
      door: C(d.pick(['earth2', 'earth1', 'green1', 'navy1', 'gray1'])),
      slope: d.chance(0.6) ? 'slate' : 'terracotta',
      flat: C('gray3'),
      quoins: d.chance(0.2),
      variant: 'altbau',
    };
  },

  facade: {
    floor(k, upper, _roof, kind, d) {
      const fromGround = upper - k;
      if (k === 0 && upper >= 4 && d.chance(0.5)) return 'small';
      if (fromGround === 1 && kind !== 'civic') return 'tall';
      if (kind === 'civic') return 'tall';
      return d.chance(0.4) ? 'balcony' : 'plain';
    },
    upperBay({ f, look, type, x0, y0, res, glow, glowHi, d }) {
      if (look.variant === 'platte') {
        platteBay(f, look.wall, look.shutter, x0, y0, glow, glowHi);
        if (d.chance(0.04)) stampModule(f, M.SAT_DISH, x0, y0, res);
        return;
      }
      if (look.variant === 'glass') {
        glassBay(f, look.wall, look.shutter, x0, y0, glow, glowHi);
        return;
      }
      const mod = type === 'small' ? G.BLN_WIN_SMALL : type === 'tall' ? G.BLN_WIN_TALL : G.BLN_WIN;
      stampModule(f, mod, x0, y0, res, glow, glowHi);
      if (look.variant === 'stone') return;
      if (type === 'balcony') stampModule(f, G.BLN_BALCONY, x0, y0, res);
      const r = d.next();
      if (r < 0.04) stampModule(f, M.PEEK, x0, y0, res);
      else if (r < 0.1 && type === 'balcony') stampModule(f, M.FLOWERS, x0, y0, res);
      else if (r < 0.13 && type === 'balcony') stampModule(f, M.LAUNDRY, x0, y0, res);
      // Rent-strike and protest bedsheets hang everywhere.
      else if (r < 0.15 && type !== 'small') stampModule(f, M.BANNER_NO, x0, y0, res);
      if (d.chance(0.05)) stampModule(f, M.SAT_DISH, x0, y0, res);
    },
    door: G.BLN_DOOR,
    shop: (d) =>
      d.weighted<string>([
        [G.BLN_SPAETI, 3],
        [G.BLN_DOENER, 2],
        [G.BLN_KNEIPE, 2],
      ]),
    groundBay({ f, look, x0, y0, res, d, commercial }) {
      if (look.variant === 'platte') {
        platteBay(f, look.wall, look.shutter, x0, y0, d.chance(0.3) ? GLOW : 0, GLOW_HI);
      } else if (look.variant === 'glass') {
        glassBay(f, look.wall, look.shutter, x0, y0, d.chance(0.6) ? GLOW : 0, GLOW_HI);
        return;
      } else if (commercial || d.chance(0.3)) {
        stampModule(f, G.BLN_ROLLER, x0, y0, res);
      } else stampModule(f, G.BLN_GROUND_WIN, x0, y0, res, d.chance(0.3) ? GLOW : 0, GLOW_HI);
      if (d.chance(0.85)) tag(f, x0 + d.int(0, 3), y0 + d.int(3, 7), d);
    },
    shopChance: 0.35,
    pipe: 'gray3',
    rusticateSmooth: false,
    doubleStringCourse: true,
    eavesTrim: false,
    dentilParapet: false,
    tagChance: 0.95,
    // Heavy graffiti: pieces and pasted posters along the ground floor (not on the state's stone).
    finish({ f, look, plan, d }) {
      if (look.variant === 'stone' || look.variant === 'glass' || plan.kind === 'civic') return;
      const top = plan.H - 10;
      let x = d.int(0, 6);
      while (x < plan.len - 8) {
        const r = d.next();
        if (r < 0.45) {
          piece(f, x, top + d.int(3, 4), d);
          x += d.int(14, 24);
        } else if (r < 0.7) {
          poster(f, x, top + d.int(1, 3), d);
          if (d.chance(0.5)) poster(f, x + 4, top + d.int(1, 3), d);
          x += d.int(9, 14);
        } else x += d.int(5, 10);
      }
      // Tags creeping up to the first floor too.
      if (d.chance(0.5)) tag(f, d.int(0, Math.max(0, plan.len - 6)), top - d.int(3, 6), d);
    },
  },

  roofs: {
    terraceTiles: ['gray3', 'gray5', 'gray4'],
    pitchedChimneys: 'random',
    dormer: true,
    mansardStacks: ['rust2', 'rust3'],
    clutter: false,
    ornament: {
      headroom: 10,
      paint(o) {
        const d = o.dice;
        if (
          o.look.variant === 'altbau' &&
          o.roof !== 'pitched' &&
          Math.min(o.w, o.d) >= 3 &&
          o.storeys >= 4 &&
          d.chance(0.3)
        ) {
          const copper = d.chance(0.35);
          cornerTurret(o, {
            wall: o.look.wall,
            trim: o.look.trim,
            dome: copper
              ? [C('green0'), C('zinc0'), C('teal1'), C('teal2')]
              : [C('ink'), C('zinc0'), C('zinc1'), C('zinc2')],
            finial: C('gray3'),
            drum: 6,
            domeH: 8,
            onion: d.chance(0.4) ? 0.2 : 0,
            spire: d.chance(0.3),
            lit: d.chance(0.4),
          });
        }
      },
    },
  },

  props: {
    lamp: { grid: G.LAMP_BERLIN, keys: { M: 'gray2', m: 'gray1', A: 'green2' } },
    metal: ['gray3', 'gray2'],
    bench: { frame: 'gray1', wood: 'earth4' },
    kiosk: { body: 'gray2', roof: 'gray1', top: { sign: 'ochre3' } },
    // BSR orange.
    bin: { grid: P.BIN, keys: { B: 'rust3', b: 'rust2', A: 'gray6', d: 'ink', m: 'gray2' } },
    bollard: { grid: P.BOLLARD, keys: { M: 'gray2', m: 'gray1', A: 'white' } },
    hydrant: { M: 'crim2', m: 'crim1', A: 'gray5' },
    metro: { grid: G.METRO_BERLIN, shadow: 3 },
    busStop: { frame: 'gray3', roof: 'gray5', flag: 'ochre3' },
    planter: 'gray5',
    cafe: {
      chair: 'gray3',
      table: 'gray6',
      umbrellas: [
        ['crim1', 'white'],
        ['green2', 'white'],
        ['ochre3', 'crim1'],
      ],
    },
    flag: flagGermany,
    bike: {
      colours: ['gray1', 'navy1', 'crim1', 'green1', 'white'],
      basket: false,
      scooters: false,
    },
    extra,
  },

  preview: {
    blds: [
      [0, 0, 3, 4, 5, 'flat', 'residential'],
      [3, 0, 2, 4, 5, 'mansard', 'commercial'],
      [5, 0, 2, 4, 6, 'flat', 'residential'],
      [14, 0, 2, 4, 5, 'pitched', 'residential'],
    ],
    park: ['tree.round', 'tree.oak'],
    street: 'tree.round',
    seed: 1011,
    icons: [
      ['morris', 13, 12],
      ['metro', 13, 5, 0.3, 0.7],
      ['kiosk', 15, 5],
      ['flag', 7, 14],
      ['boat', 4, 17],
    ],
  },

  sampleRoof: 'flat',
  decals: { tag: 'bln', tagGrid: G.TAG_BLN, puddles: false },
  cars: [
    'taxi_berlin',
    'hatch_silver',
    'sedan_black',
    'hatch',
    'trabi_mint',
    'hatch_white',
    'delivery_van',
    'taxi_berlin',
    'sedan',
    'trabi_beige',
    'bus_berlin',
    'hatch_blue',
  ],
  minimapRoof: 'gray3',
  postcardSky: ['sky', 'gray6'],
  mapTint: [168, 160, 150],
  protest: { item: 'bottle', wokeChance: 0 },
};
