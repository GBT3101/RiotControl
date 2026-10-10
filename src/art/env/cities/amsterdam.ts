/**
 * AMSTERDAM — environment style (E3 North). Narrow, deep canal houses in dark brown, red-brown
 * and black-painted brick with big white sash windows, each crowned by a white-dressed street
 * gable (step, neck, bell or spout — a seeded mix) with its hoist beam; warehouses with shutters;
 * anthracite and red pantiled roofs running back from the street. Brick klinker quays and
 * bridges, elms, bikes in heaps, houseboats, Amsterdammertjes, herring carts, the green krul and
 * the three crosses everywhere. Blue-and-white trams.
 */
import type { RGBA } from '../../palette';
import { createBuffer, setPixel } from '../../lib/pixels';
import { C, darker, lighter } from '../color';
import { GLOW, GLOW_HI, flagRes } from '../bld/kit';
import { stampModule } from '../bld/face';
import * as M from '../bld/modules.grid';
import { prism } from '../bld/ornaments';
import type { PropKit, PropSprite } from '../props';
import type { EnvCity, SlopeTex } from '../style';
import { Dice, hash } from '../util';
import * as G from './amsterdam.grid';
import {
  boatSprite,
  drawBike,
  finishSprite,
  gableTop,
  mirrorSprite,
  paintGable,
  solid,
  treeSprite,
  type GableKind,
} from './north.kit';

// ---------------------------------------------------------------------------------- roofs ---

/** Dutch pantiles: S-waves every 4 px, course shadows; anthracite glazed or red. */
function pantiles(ramp: readonly RGBA[]): (rise: number) => SlopeTex {
  return (rise) => (a, b, l) => {
    const ai = Math.floor(a);
    const bi = Math.floor(b);
    const sh = (c: RGBA): RGBA => (l > 0 ? lighter(c) : l < 0 ? darker(c) : c);
    if (bi <= 0) return darker(ramp[0]!);
    if (bi >= rise - 1) return sh(ramp[2]!);
    const w = ((ai % 4) + 4) % 4;
    let c = w === 0 ? ramp[2]! : w === 3 ? ramp[0]! : ramp[1]!;
    if (bi % 4 === 0) c = darker(c);
    if (hash(ai >> 2, bi >> 2, 17) % 23 === 0) c = ramp[2]!;
    return sh(c);
  };
}
const ANTHRACITE = pantiles([C('gray1'), C('gray2'), C('gray3')]);
const RED_PANS = pantiles([C('rust1'), C('rust2'), C('rust3')]);

const BRICK_WEIGHTS: ReadonlyArray<readonly [string, number]> = [
  ['earth1', 4], // dark brown
  ['earth2', 4], // brown
  ['rust1', 4], // red-brown
  ['rust0', 2], // deep plum-brown
  ['gray1', 2], // black-painted brick
  ['rust2', 1], // red
];

// ---------------------------------------------------------------------------------- props ---

function flagAmsterdam(x: number, y: number, W: number, H: number): RGBA {
  // Red / black / red with three white St Andrew's crosses on the black band.
  const band = Math.floor((y * 3) / H);
  if (band !== 1) return C('crim2');
  const cy = Math.floor(H / 2) - 1;
  const xs = [Math.round(W * 0.2), Math.round(W * 0.5), Math.round(W * 0.8)];
  for (const cx of xs) {
    const dx = x - cx;
    const dy = y - cy;
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && Math.abs(dx) === Math.abs(dy)) return C('white');
  }
  return C('ink');
}

/** Bikes: a single omafiets, a heap of three, two against a rack, a bakfiets. */
function bikes(v: number): PropSprite {
  const d = new Dice(hash(v, 0xb1c));
  const cols = ['ink', 'gray1', 'navy1', 'crim1', 'gray5', 'earth2', 'green1', 'blue1'];
  const col = (): RGBA => C(d.pick(cols));
  const b = createBuffer(30, 18);
  if (v === 0) {
    drawBike(b, 8, 4, col(), { upright: true, rack: true, basket: d.chance(0.5) });
  } else if (v === 1) {
    // Heap: three bikes leaning into each other.
    drawBike(b, 4, 2, col(), { upright: true });
    drawBike(b, 9, 4, col(), { upright: true, rack: true });
    drawBike(b, 13, 6, col(), { upright: true, basket: true });
  } else if (v === 2) {
    // Steel hoop rack ("nietje") with two bikes.
    for (const x0 of [5, 13]) {
      for (let k = 0; k < 6; k++) {
        setPixel(b, x0 + k, 7 + (k >> 1), C('gray5'));
      }
      for (let y = 0; y < 5; y++) {
        setPixel(b, x0, 8 + y, C('gray4'));
        setPixel(b, x0 + 5, 10 + y, C('gray3'));
      }
    }
    drawBike(b, 3, 4, col(), { upright: true, rack: true });
    drawBike(b, 11, 6, col(), { upright: true, basket: true });
  } else {
    // Bakfiets: cargo bike with its wooden box in front.
    drawBike(b, 6, 4, C(d.pick(['ink', 'navy1', 'green1'])), { upright: true });
    const wood = C('earth4');
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 7; x++) {
        const c = y === 0 ? lighter(wood) : x === 6 ? darker(wood) : wood;
        setPixel(b, 19 + x, 9 + y + (x >> 1), c);
      }
    setPixel(b, 22, 15, C('ink'));
    setPixel(b, 23, 16, C('ink'));
  }
  return finishSprite([b], { x: 15, y: 13 }, { shadow: 5 });
}

/** Houseboats and a glass-roofed canal cruiser. */
function boat(v: number): PropSprite {
  if (v === 2) {
    return boatSprite({
      len: 1.8,
      beam: 0.42,
      hull: C('navy1'),
      seed: 31,
      lit: 0.6,
      cabins: [
        { a: 0.08, b: 0.82, h: 6, col: C('white'), roof: C('zinc3'), win: 'band', inset: 0.04 },
      ],
      extras: (cv, P) => {
        // Glass roof ribs.
        for (let k = 1; k < 14; k++) cv.dot(P(0.08 + k * 0.053, 0, -4 + 6 + 1), C('zinc4'), 1);
      },
    });
  }
  const d = new Dice(hash(v, 0xb0a7));
  const hull = C(d.pick(['gray1', 'green1', 'navy1']));
  const cabin = v === 0 ? C(d.pick(['green2', 'teal1'])) : C(d.pick(['earth3', 'blue1']));
  return boatSprite({
    len: 1.55,
    beam: 0.5,
    hull,
    seed: 11 + v,
    lit: 0.55,
    cabins: [
      {
        a: 0.06,
        b: 0.9,
        h: 9,
        col: cabin,
        roof: v === 0 ? C('gray2') : C('earth2'),
        win: 'square',
        inset: 0.06,
      },
    ],
    extras: (cv, P) => {
      // Roof garden: pots and a little green on the cabin roof.
      const z = -4 + 9;
      for (let k = 0; k < 7; k++) {
        const a = 0.12 + k * 0.1;
        const g = k % 3 === 0 ? C('crim2') : k % 2 ? C('green3') : C('green2');
        cv.dot(P(a, 0.25, z + 1), g, 1);
        cv.dot(P(a + 0.03, -0.2, z + 1), C('green3'), 1);
        if (k % 2 === 0) cv.dot(P(a, 0.25, z + 2), C('green4'), 1);
      }
      // Gangplank to the quay.
      for (let k = 0; k < 6; k++) cv.dot(P(-0.2 + k * 0.01, 0.55 + k * 0.05, -4), C('earth3'), 1);
    },
  });
}

/** Herring cart (haringkar): white cart, blue canopy, glass counter, Dutch flag. */
function haringkar(k: PropKit): PropSprite {
  return k.isoProp(30, (cv) => {
    const white = C('white');
    const blue = C('blue1');
    cv.box(0.22, 0.3, 0, 0.78, 0.7, 11, {
      top: () => C('gray6'),
      left: (u, _v, z) => {
        const y = Math.floor(z);
        const x = Math.floor((u - 0.22) * 32);
        if (y < 2) return C('gray3');
        if (y >= 4 && y <= 6) return x % 3 === 1 ? white : blue; // HARING lettering
        if (y >= 8) return x % 5 === 0 ? C('gray6') : C('zinc2'); // glass counter
        return white;
      },
      right: (_u, _v, z) => (Math.floor(z) < 2 ? C('gray2') : C('gray6')),
    });
    // Fish on ice in the counter.
    for (let x = 0; x < 7; x++) cv.dot({ u: 0.28 + x * 0.07, v: 0.68, z: 10 }, C('zinc4'), 1);
    for (const [u, v] of [
      [0.24, 0.32],
      [0.76, 0.32],
      [0.24, 0.68],
      [0.76, 0.68],
    ] as const)
      cv.pole({ u, v, z: 11 }, 6, C('gray5'));
    cv.box(0.16, 0.24, 17, 0.84, 0.76, 18, {
      top: (u) => (Math.floor(u * 16) % 2 === 0 ? blue : white),
      left: (u) => (Math.floor(u * 16) % 2 === 0 ? blue : white),
      right: () => darker(blue),
    });
    // Dutch flag on a pole.
    cv.pole({ u: 0.8, v: 0.3, z: 18 }, 9, C('gray5'));
    for (let z = 23; z < 27; z++)
      for (let s = 0; s < 4; s++)
        cv.dot(
          { u: 0.8 + s * 0.035, v: 0.3 - s * 0.035, z },
          z >= 26 ? C('crim2') : z >= 25 ? C('white') : C('navy2'),
          1,
        );
  });
}

/** Flower and newspaper kiosk: green box, buckets of tulips stepped in front. */
function flowerKiosk(k: PropKit): PropSprite {
  return k.isoProp(26, (cv) => {
    const g = C('green1');
    solid(cv, [0.3, 0.2, 0], [0.8, 0.62, 14], g, C('green2'));
    cv.box(0.24, 0.14, 14, 0.86, 0.68, 16, {
      top: () => C('green2'),
      left: () => g,
      right: () => darker(g),
    });
    const tulips = [C('crim2'), C('pink2'), C('ochre3'), C('purple'), C('white'), C('rust3')];
    for (let r = 0; r < 3; r++)
      for (let k2 = 0; k2 < 9; k2++) {
        const u = 0.3 + k2 * 0.055;
        const v = 0.66 + r * 0.06;
        const z = 6 - r * 2;
        cv.dot({ u, v, z: z - 1 }, C('gray4'), 1);
        cv.dot({ u, v, z }, tulips[(k2 + r * 2) % tulips.length]!, 1);
        cv.dot({ u, v, z: z + 1 }, k2 % 2 ? C('green3') : tulips[(k2 + r) % tulips.length]!, 1);
      }
    // Sign board.
    cv.box(0.4, 0.4, 16, 0.72, 0.44, 20, {
      top: () => C('gray6'),
      left: (u, _v, z) =>
        Math.floor(z) === 18 && Math.floor(u * 32) % 2 === 0 ? C('green1') : C('white'),
      right: () => C('gray6'),
    });
  });
}

/** The krul: a green cast-iron curl of a urinal with its little roof. */
function krul(k: PropKit): PropSprite {
  return k.isoProp(26, (cv) => {
    const g = [C('green0'), C('green1'), C('green2'), C('green3')];
    prism(cv, {
      cu: 0.5,
      cv: 0.5,
      z0: 2,
      z1: 15,
      r: 0.24,
      n: 8,
      tex: (s, x, y, side) => {
        if (side === 4 || side === 5) return null; // the open end of the curl
        if (y < 0) return g[2]!;
        if (y <= 1 || y >= 11) return s > 0.5 ? g[3]! : g[2]!;
        if ((x + y) % 4 === 0) return g[0]!; // pierced ironwork
        return s > 0.55 ? g[2]! : s > 0.35 ? g[1]! : g[0]!;
      },
    });
    cv.pole({ u: 0.5, v: 0.5, z: 0 }, 19, C('green1'));
    cv.box(0.3, 0.3, 19, 0.7, 0.7, 20, {
      top: () => C('green3'),
      left: () => C('green2'),
      right: () => C('green1'),
    });
    cv.dot({ u: 0.5, v: 0.5, z: 21 }, C('green3'), 1);
    cv.dot({ u: 0.5, v: 0.5, z: 22 }, C('ochre2'), 1);
  });
}

const extra: Record<string, (k: PropKit) => PropSprite> = {
  'kiosk.0': haringkar,
  'kiosk.1': flowerKiosk,
  krul,
};
for (let v = 0; v < 3; v++) extra[`tree.round.${v}`] = () => treeSprite('elm', v * 13 + 5);
for (let v = 0; v < 4; v++) {
  extra[`bike.${v}.i`] = () => bikes(v);
  extra[`bike.${v}.j`] = () => mirrorSprite(bikes(v));
}
for (let v = 0; v < 3; v++) {
  extra[`boat.${v}.i`] = () => boat(v);
  extra[`boat.${v}.j`] = () => mirrorSprite(boat(v));
}

// ---------------------------------------------------------------------------------- style ---

export const amsterdam: EnvCity = {
  ground: {
    asphalt: C('gray3'),
    asphaltSpeck: [C('gray2'), C('zinc1')],
    paint: C('white'),
    paintWorn: C('gray6'),
    yellowLines: false,
    kerbTop: C('gray6'),
    kerbLit: C('gray5'),
    kerbShade: C('gray3'),
    // Grey concrete stoeptegels.
    side: {
      tones: [C('gray5'), C('gray5'), C('gray6'), C('gray5'), C('gray4')],
      joint: C('gray3'),
      grid: { rows: 3, cols: 3, stagger: 0 },
    },
    // Red-brown klinkers in stretcher bond on the quays and lanes.
    cobble: {
      tones: [C('rust1'), C('earth2'), C('rust1'), C('earth3'), C('rust2')],
      joint: C('earth1'),
      grid: { rows: 4, cols: 2, stagger: 0.5 },
    },
    plaza: {
      tones: [C('stone2'), C('stone3'), C('gray5')],
      border: C('rust1'),
      joint: C('stone1'),
    },
    grass: { base: 'grass', stripes: false, dry: 0 },
    gravel: { base: C('stone2'), dark: C('stone1'), light: C('stone3') },
    // Dark canal water.
    water: {
      deep: C('navy0'),
      base: C('zinc0'),
      ripple: C('navy0'),
      hi: C('zinc1'),
      spark: C('zinc3'),
    },
    quayLit: C('stone2'),
    quayShade: C('stone1'),
    quayJoint: C('stone0'),
    rail: { top: C('gray3'), lit: C('gray2'), shade: C('gray1'), dark: C('ink') },
    lot: C('stone1'),
    leaves: true,
    ironRail: true,
  },

  awnings: [
    ['green1', 'white'],
    ['crim1', 'white'],
    ['navy1', 'white'],
    ['rust1', 'ochre2'],
  ],
  look(kind, d) {
    const civic = kind === 'civic';
    if (civic) {
      const stone = d.chance(0.5);
      return {
        mat: stone ? 'ashlar' : 'brick',
        wall: C(stone ? 'stone4' : 'rust1'),
        groundMat: stone ? 'ashlar' : 'smooth',
        ground: C(stone ? 'stone3' : 'stone4'),
        trim: C(stone ? 'stone5' : 'white'),
        frame: C('white'),
        shutter: C('green1'),
        iron: C('ink'),
        ironHi: C('gray2'),
        door: C(d.pick(['green1', 'earth2'])),
        slope: 'slate',
        flat: C('gray3'),
        quoins: !stone,
      };
    }
    const warehouse = d.chance(0.16);
    const plaster = !warehouse && d.chance(0.14);
    const wall = warehouse
      ? d.pick(['earth1', 'rust0', 'earth2'])
      : plaster
        ? d.pick(['stone4', 'white', 'gray6', 'zinc4'])
        : d.weighted(BRICK_WEIGHTS);
    const plinth = d.weighted<string>([
      ['same', 5],
      ['gray1', 3],
      ['stone4', 2],
    ]);
    return {
      mat: plaster ? 'stucco' : 'brick',
      wall: C(wall),
      groundMat: plinth === 'same' ? (plaster ? 'stucco' : 'brick') : 'smooth',
      ground: plinth === 'same' ? C(wall) : C(plinth),
      trim: C(plaster ? 'stone5' : 'white'),
      frame: C(warehouse ? d.pick(['white', 'green1']) : d.pick(['white', 'white', 'white', 'gray7'])),
      shutter: C(warehouse ? d.pick(['green1', 'crim1', 'green2']) : d.pick(['green1', 'crim1'])),
      iron: C('ink'),
      ironHi: C('gray2'),
      door: C(d.pick(['green1', 'gray1', 'navy1', 'crim1', 'earth2', 'green1'])),
      slope: d.chance(0.6) ? 'slate' : 'terracotta',
      flat: C('gray3'),
      quoins: false,
      variant: warehouse ? 'warehouse' : undefined,
    };
  },

  facade: {
    floor(k, upper) {
      const fromGround = upper - k;
      if (fromGround === 1) return 'tall';
      if (k === 0 && upper >= 3) return 'small';
      return 'plain';
    },
    upperBay({ f, look, type, x0, y0, res, glow, glowHi, d }) {
      if (look.variant === 'warehouse') {
        // Pakhuis: loading doors up the middle, shuttered windows either side.
        const centre = Math.abs(x0 + 4 - f.w / 2) < 6;
        stampModule(f, centre ? G.AMS_LUIK : G.AMS_SHUTTERED, x0, y0, res, centre ? 0 : glow, glowHi);
        return;
      }
      const mod = type === 'tall' ? G.AMS_WIN_TALL : type === 'small' ? G.AMS_WIN_SMALL : G.AMS_WIN;
      stampModule(f, mod, x0, y0, res, glow, glowHi);
      const r = d.next();
      if (r < 0.04) stampModule(f, M.PEEK, x0, y0, res);
      else if (r < 0.13 && type !== 'small') stampModule(f, G.AMS_GERANIUMS, x0, y0, res);
      else if (r < 0.145 && type === 'tall') stampModule(f, M.BANNER_NO, x0, y0, res);
      // Amsterdam flag (red / black / red) hung from a window.
      else if (r < 0.165 && type !== 'small')
        stampModule(f, M.BALCONY_FLAG, x0, y0, flagRes(res, C('crim2'), C('ink')));
    },
    door: G.AMS_DOOR,
    shop: (d) => (d.chance(0.45) ? G.AMS_CAFE : G.AMS_SHOP),
    groundBay({ f, look, x0, y0, res, d }) {
      if (look.variant === 'warehouse') {
        stampModule(f, G.AMS_LUIK, x0, y0, res);
        return;
      }
      stampModule(f, G.AMS_GROUND_WIN, x0, y0, res, d.chance(0.35) ? GLOW : 0, GLOW_HI);
    },
    shopChance: 0.22,
    pipe: 'gray1',
    rusticateSmooth: false,
    doubleStringCourse: false,
    eavesTrim: true,
    dentilParapet: true,
    tagChance: 0.3,
  },

  roofs: {
    terraceTiles: ['gray3', 'gray5', 'gray4'],
    pitchedChimneys: 'random',
    dormer: false,
    mansardStacks: ['rust1', 'rust2'],
    clutter: false,
    slopeTex: (look, rise) => (look.slope === 'terracotta' ? RED_PANS : ANTHRACITE)(rise),
    // Street gables on every pitched roof.
    ornament: {
      headroom: 8,
      paint(o) {
        if (o.roof !== 'pitched' || o.street === 'back') return;
        const L = (o.street === 'right' ? o.d : o.w) * 16;
        if (L > 64 || L < 16) return;
        const d = o.dice;
        const warehouse = o.look.variant === 'warehouse';
        const kind: GableKind = warehouse
          ? d.pick<GableKind>(['spout', 'spout', 'neck'])
          : d.weighted<GableKind>([
              ['step', 3],
              ['neck', 4],
              ['bell', 3],
              ['spout', 1],
              ['point', L <= 32 ? 1 : 0],
            ]);
        const R = Math.min(22, Math.round(L * 0.34) + 7);
        if (gableTop(kind, L, R) > o.rise + 18 + 8) return;
        const tex = o.look.slope === 'terracotta' ? RED_PANS : ANTHRACITE;
        paintGable(o, {
          kind,
          ridge: R,
          roof: tex(R),
          ridgeCol: o.look.slope === 'terracotta' ? C('rust3') : C('gray3'),
          trim: o.look.mat === 'stucco' ? C('stone4') : C('white'),
          hoist: kind !== 'point' || d.chance(0.5),
          door: o.look.shutter,
          frame: C('white'),
          opening: 'door',
          lit: d.chance(0.35),
          chimney: d.chance(0.5) ? darker(o.look.wall) : null,
        });
      },
    },
  },

  props: {
    lamp: { grid: G.LAMP_AMSTERDAM, keys: { M: 'gray1', m: 'ink', A: 'green2' } },
    metal: ['gray2', 'gray1'],
    bench: { frame: 'green1', wood: 'earth4' },
    kiosk: { body: 'green1', roof: 'green2', top: { sign: 'crim1' } },
    bin: { grid: G.BIN_AMSTERDAM, keys: { B: 'gray3', b: 'gray2', A: 'crim2', d: 'ink', m: 'gray2' } },
    bollard: { grid: G.BOLLARD_AMSTERDAM, keys: { M: 'rust1', m: 'rust0', w: 'white' } },
    hydrant: { M: 'ochre3', m: 'ochre2', A: 'gray3' },
    metro: { grid: G.METRO_AMSTERDAM, shadow: 3 },
    busStop: { frame: 'gray2', roof: 'gray5', flag: 'blue1' },
    planter: 'rust1',
    cafe: {
      chair: 'earth2',
      table: 'earth4',
      umbrellas: [
        ['green1', 'white'],
        ['crim1', 'white'],
        ['ochre3', 'white'],
      ],
    },
    flag: flagAmsterdam,
    bike: { colours: ['ink', 'gray1', 'navy1', 'crim1'], basket: true, scooters: false },
    extra,
  },

  preview: {
    blds: [
      [0, 0, 2, 4, 5, 'pitched', 'residential'],
      [2, 0, 2, 4, 4, 'pitched', 'commercial'],
      [4, 0, 2, 4, 5, 'pitched', 'residential'],
      [14, 0, 2, 4, 5, 'pitched', 'residential'],
    ],
    park: ['tree.round', 'tree.plane'],
    street: 'tree.round',
    seed: 1007,
    icons: [
      ['krul', 13, 12],
      ['kiosk', 15, 5],
      ['metro', 13, 5, 0.3, 0.7],
      ['flag', 7, 14],
      ['boat', 4, 17],
      ['boat', 13, 17, 0.5, 0.4],
    ],
  },

  sampleRoof: 'pitched',
  decals: { tag: 'xxx', tagGrid: G.TAG_XXX, puddles: true },
  cars: [
    'hatch_silver',
    'hatch',
    'hatch_white',
    'sedan_black',
    'delivery_van',
    'tram_amsterdam',
    'hatch_blue',
    'scooter',
    'sedan',
    'hatch_silver',
  ],
  minimapRoof: 'gray2',
  postcardSky: ['zinc4', 'sky'],
  mapTint: [128, 66, 52],
  protest: { item: 'umbrella', wokeChance: 0 },
};
