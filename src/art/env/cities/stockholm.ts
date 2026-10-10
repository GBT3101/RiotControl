/**
 * STOCKHOLM — environment style (E3 North). Gamla stan's narrow merchant houses in warm ochre,
 * rust red, saffron and salmon stucco with stepped and curved gables under black tin and copper
 * roofs; Norrmalm's and Östermalm's grand stone and stucco blocks with copper domes and turrets
 * on the corners. Granite quays with iron bollards, iron railings, white ferries moored at the
 * quays, wire-hung white street lamps, the blue T-bana T, blue-and-yellow flags and Volvos.
 */
import type { RGBA } from '../../palette';
import { C, darker, lighter } from '../color';
import { GLOW, GLOW_HI, flagRes } from '../bld/kit';
import { stampModule } from '../bld/face';
import * as M from '../bld/modules.grid';
import type { Look } from '../bld/looks';
import { dome, prism } from '../bld/ornaments';
import type { PropKit, PropSprite } from '../props';
import type { EnvCity, SlopeTex } from '../style';
import { hash } from '../util';
import * as G from './stockholm.grid';
import {
  boatSprite,
  cornerTurret,
  gableTop,
  mirrorSprite,
  paintGable,
  solid,
  treeSprite,
  type GableKind,
} from './north.kit';

// ---------------------------------------------------------------------------------- roofs ---

const shadeBy = (c: RGBA, l: number): RGBA => (l > 0 ? lighter(c) : l < 0 ? darker(c) : c);

/** Standing-seam sheet metal: black tin (Gamla stan) or verdigris copper. */
function seams(ramp: readonly RGBA[]): (rise: number) => SlopeTex {
  return (rise) => (a, b, l) => {
    const ai = ((Math.floor(a) % 4) + 4) % 4;
    const bi = Math.floor(b);
    if (bi <= 0) return darker(ramp[0]!);
    let c = ai === 0 ? ramp[2]! : ai === 1 ? ramp[0]! : ramp[1]!;
    if (bi >= rise - 1) c = ramp[2]!;
    if (hash(Math.floor(a) >> 2, bi >> 3, 5) % 9 === 0 && ai !== 0) c = ramp[2]!; // patina
    return shadeBy(c, l);
  };
}
const TIN = seams([C('ink'), C('gray1'), C('gray2')]);
const COPPER = seams([C('teal1'), C('teal1'), C('teal2')]);

/** Red clay tiles (Södermalm, the odd Gamla stan roof). */
const TILES = (rise: number): SlopeTex => (a, b, l) => {
  const ai = Math.floor(a);
  const bi = Math.floor(b);
  if (bi <= 0) return C('rust0');
  if (bi >= rise - 1) return shadeBy(C('rust3'), l);
  let c = (((ai % 3) + 3) % 3) === 0 ? C('rust3') : C('rust2');
  if (bi % 3 === 0) c = darker(c);
  return shadeBy(c, l);
};

const roofTex = (look: Look): ((rise: number) => SlopeTex) =>
  look.slope === 'zinc' ? COPPER : look.slope === 'slate' ? TIN : TILES;

// ---------------------------------------------------------------------------------- props ---

function flagSweden(x: number, y: number, W: number, H: number): RGBA {
  const cx = Math.round(W * 0.36);
  const cy = Math.floor(H / 2) - 1;
  if ((x >= cx && x <= cx + 1) || (y >= cy && y <= cy + 1)) return C('ochre3');
  return C('blue1');
}

/** Ferries and boats moored at the granite quays. */
function boat(v: number): PropSprite {
  if (v === 0)
    // White archipelago steamer: dark hull band, saloon, wheelhouse, black-and-yellow funnel.
    return boatSprite({
      len: 1.8,
      beam: 0.5,
      hull: C('white'),
      seed: 41,
      lit: 0.5,
      cabins: [
        { a: 0.12, b: 0.72, h: 6, col: C('white'), roof: C('gray6'), win: 'band', inset: 0.1 },
        { a: 0.56, b: 0.7, h: 11, col: C('white'), roof: C('gray6'), win: 'square', inset: 0.25 },
      ],
      extras: (cv, P) => {
        // Funnel.
        for (let z = 0; z < 7; z++)
          for (const t of [-0.08, 0, 0.08])
            cv.dot(P(0.4, t, 5 + z), z === 4 ? C('ochre3') : z > 4 ? C('ink') : C('gray1'), 1.5);
        // Blue-and-yellow ensign at the stern.
        cv.pole(P(-0.48, 0, -4), 9, C('gray5'));
        for (let z = 2; z < 5; z++)
          for (let s = 1; s < 4; s++)
            cv.dot(P(-0.48 - s * 0.02, 0, z), z === 3 || s === 2 ? C('ochre3') : C('blue1'), 1);
      },
    });
  // Small wooden motor launch with a canopy.
  return boatSprite({
    len: 1.2,
    beam: 0.42,
    hull: C(v === 1 ? 'earth3' : 'navy1'),
    seed: 43 + v,
    lit: 0.3,
    cabins: [{ a: 0.3, b: 0.62, h: 6, col: C('white'), roof: C('navy2'), win: 'square', inset: 0.12 }],
  });
}

/** A bronze fountain group in an octagonal granite basin (Kungsträdgården). */
function fountain(k: PropKit): PropSprite {
  return k.isoProp(30, (cv) => {
    const granite = [C('gray3'), C('gray4'), C('gray5'), C('gray6')];
    prism(cv, {
      cu: 0.5,
      cv: 0.5,
      z0: 0,
      z1: 4,
      r: 0.44,
      n: 8,
      tex: (s, _x, y) => (y <= 0 ? granite[3]! : s > 0.6 ? granite[2]! : s > 0.4 ? granite[1]! : granite[0]!),
    });
    // Water surface.
    prism(cv, {
      cu: 0.5,
      cv: 0.5,
      z0: 3,
      z1: 3.5,
      r: 0.38,
      n: 8,
      tex: (_s, x, y) => (y < 0 ? ((x * 7) % 5 === 0 ? C('sky') : C('blue1')) : C('blue1')),
      bias: 0.5,
    });
    // Bronze figures on a rock, jets of water.
    const bronze = [C('green0'), C('teal1'), C('teal2')];
    dome(cv, { cu: 0.5, cv: 0.5, z0: 3, r: 0.16, h: 6, ramp: [C('gray2'), C('gray3'), C('gray4')] });
    prism(cv, {
      cu: 0.5,
      cv: 0.5,
      z0: 8,
      z1: 18,
      r: 0.06,
      n: 4,
      tex: (s) => (s > 0.55 ? bronze[2]! : s > 0.35 ? bronze[1]! : bronze[0]!),
    });
    for (const [du, dv] of [
      [-0.12, 0.08],
      [0.12, 0.04],
    ] as const)
      prism(cv, {
        cu: 0.5 + du,
        cv: 0.5 + dv,
        z0: 6,
        z1: 12,
        r: 0.04,
        n: 4,
        tex: (s) => (s > 0.5 ? bronze[2]! : bronze[1]!),
      });
    for (let z = 18; z < 23; z++) cv.dot({ u: 0.5, v: 0.5, z }, z % 2 ? C('sky') : C('white'), 1);
    for (const a of [0, 1.6, 3.2, 4.8]) {
      for (let k2 = 0; k2 < 6; k2++) {
        const r = 0.04 + k2 * 0.05;
        cv.dot(
          { u: 0.5 + Math.cos(a) * r, v: 0.5 + Math.sin(a) * r, z: 20 - k2 * k2 * 0.5 },
          k2 % 2 ? C('sky') : C('white'),
          1,
        );
      }
    }
  });
}

/** Royal guard sentry box: grey-blue planks, copper roof, gilded crown. */
function sentrybox(k: PropKit): PropSprite {
  return k.isoProp(30, (cv) => {
    const blue = C('zinc2');
    cv.box(0.3, 0.3, 0, 0.7, 0.7, 18, {
      top: null,
      left: (u, _v, z) => {
        const x = Math.floor((u - 0.3) * 32);
        if (Math.floor(z) >= 16) return C('ochre3');
        if (x >= 3 && x <= 9 && z < 15 && z > 1) return x === 3 ? C('navy0') : C('navy1'); // opening
        return x % 3 === 0 ? darker(blue) : blue;
      },
      right: (_u, v) => (Math.floor(v * 32) % 3 === 0 ? darker(blue, 2) : darker(blue)),
    });
    // Copper hip roof and the crown.
    dome(cv, {
      cu: 0.5,
      cv: 0.5,
      z0: 18,
      r: 0.3,
      h: 6,
      ramp: [C('zinc0'), C('teal1'), C('teal2')],
    });
    cv.dot({ u: 0.5, v: 0.5, z: 25 }, C('ochre3'), 1);
    cv.dot({ u: 0.5, v: 0.5, z: 26 }, C('ochre2'), 1);
  });
}

const extra: Record<string, (k: PropKit) => PropSprite> = {
  fountain,
  sentrybox,
  'statue.equestrian': (k) => k.gridProp(G.EQUESTRIAN, {}, { shadow: 7 }),
  'kiosk.0': (k) =>
    // Falu-red kiosk with a white trim and a navy sign.
    k.isoProp(26, (cv) => {
      const red = C('rust1');
      solid(cv, [0.24, 0.24, 0], [0.76, 0.76, 14], red, C('rust2'));
      cv.box(0.24, 0.24, 6, 0.76, 0.76, 12, {
        top: null,
        left: (u, _v, z) =>
          Math.floor(z) === 6 || Math.floor(z) === 11
            ? C('white')
            : Math.floor((u - 0.24) * 32) % 5 === 0
              ? C('white')
              : C('zinc1'),
        right: () => darker(red),
      });
      cv.box(0.18, 0.18, 14, 0.82, 0.82, 16, {
        top: () => C('gray2'),
        left: () => C('white'),
        right: () => C('gray6'),
      });
      cv.box(0.36, 0.46, 16, 0.64, 0.54, 20, {
        top: () => C('white'),
        left: (u, _v, z) =>
          Math.floor(z) === 18 && Math.floor(u * 32) % 2 === 0 ? C('ochre3') : C('navy2'),
        right: () => C('navy1'),
      });
    }),
};
for (let v = 0; v < 3; v++) extra[`tree.round.${v}`] = () => treeSprite('linden', v * 11 + 3);
for (let v = 0; v < 3; v++) {
  extra[`boat.${v}.i`] = () => boat(v);
  extra[`boat.${v}.j`] = () => mirrorSprite(boat(v));
}

// ---------------------------------------------------------------------------------- style ---

const GAMLA: ReadonlyArray<readonly [string, number]> = [
  ['ochre2', 5], // warm ochre
  ['rust2', 3], // rust red
  ['ochre3', 3], // saffron yellow
  ['earth5', 3], // salmon
  ['rust3', 2], // burnt orange
  ['earth6', 2], // pale salmon
  ['stone4', 1], // cream
  ['earth4', 1], // terracotta
];

export const stockholm: EnvCity = {
  ground: {
    asphalt: C('gray3'),
    asphaltSpeck: [C('gray2'), C('zinc1')],
    paint: C('white'),
    paintWorn: C('gray6'),
    yellowLines: false,
    kerbTop: C('gray6'),
    kerbLit: C('gray5'),
    kerbShade: C('gray3'),
    // Granite slabs.
    side: {
      tones: [C('gray5'), C('gray5'), C('stone2'), C('gray5'), C('gray6')],
      joint: C('gray3'),
      grid: { rows: 2, cols: 2, stagger: 0.5 },
    },
    // Gatsten: rounded granite setts, grey and pink-grey.
    cobble: {
      tones: [C('gray4'), C('stone1'), C('gray4'), C('stone2'), C('gray3')],
      joint: C('gray2'),
      grid: { rows: 4, cols: 4, stagger: 0.5 },
    },
    plaza: {
      tones: [C('gray5'), C('stone2'), C('gray6')],
      border: C('gray4'),
      joint: C('gray3'),
    },
    grass: { base: 'grass', stripes: false, dry: 0 },
    gravel: { base: C('stone3'), dark: C('stone2'), light: C('stone4') },
    // Baltic blue.
    water: {
      deep: C('navy1'),
      base: C('navy2'),
      ripple: C('navy1'),
      hi: C('blue1'),
      spark: C('sky'),
    },
    quayLit: C('gray5'),
    quayShade: C('gray4'),
    quayJoint: C('gray2'),
    rail: { top: C('gray3'), lit: C('gray2'), shade: C('gray1'), dark: C('ink') },
    lot: C('gray4'),
    leaves: true,
    ironRail: true,
  },

  awnings: [
    ['navy1', 'white'],
    ['green1', 'white'],
    ['crim1', 'white'],
    ['ochre2', 'white'],
  ],
  look(kind, d, site) {
    const civic = kind === 'civic';
    const grand =
      civic ||
      (site !== undefined &&
        site.storeys >= 5 &&
        (site.roof !== 'pitched' || Math.min(site.w, site.d) >= 3));
    if (grand) {
      const wall = civic
        ? d.pick(['stone4', 'stone3', 'gray6'])
        : d.weighted<string>([
            ['stone4', 4],
            ['stone3', 3],
            ['gray6', 2],
            ['earth6', 2],
            ['gray7', 1],
            ['ochre2', 1],
          ]);
      const stone = civic || d.chance(0.35);
      return {
        mat: stone ? 'ashlar' : 'stucco',
        wall: C(wall),
        groundMat: 'ashlar',
        ground: darker(C(wall)),
        trim: C(d.pick(['white', 'stone5'])),
        frame: C(d.pick(['white', 'white', 'earth2'])),
        shutter: C('gray6'),
        iron: C('ink'),
        ironHi: C('gray2'),
        door: C(d.pick(['earth2', 'earth1', 'green1', 'navy1'])),
        slope: d.chance(0.65) ? 'zinc' : 'slate',
        flat: C('gray3'),
        quoins: stone ? false : d.chance(0.4),
        variant: 'grand',
      };
    }
    const wall = d.weighted(GAMLA);
    return {
      mat: 'stucco',
      wall: C(wall),
      groundMat: 'smooth',
      ground: d.chance(0.4) ? C('stone3') : darker(C(wall)),
      trim: C(d.pick(['white', 'stone5', 'stone4'])),
      frame: C(d.pick(['white', 'white', 'green1', 'earth2'])),
      shutter: C('green1'),
      iron: C('ink'),
      ironHi: C('gray2'),
      door: C(d.pick(['earth2', 'earth1', 'green1', 'navy1', 'crim1'])),
      slope: d.weighted<Look['slope']>([
        ['slate', 5],
        ['zinc', 2],
        ['terracotta', 2],
      ]),
      flat: C('gray3'),
      quoins: d.chance(0.25),
      variant: 'gamla',
    };
  },

  facade: {
    floor(k, upper, _roof, kind, d) {
      const fromGround = upper - k;
      if (k === 0 && upper >= 3) return 'small';
      if (fromGround === 1 && (kind === 'civic' || upper >= 4)) return 'tall';
      return d.chance(0.25) ? 'balcony' : 'plain';
    },
    upperBay({ f, look, type, x0, y0, res, glow, glowHi, d }) {
      const grand = look.variant === 'grand';
      if (type === 'small') stampModule(f, G.STH_WIN_SMALL, x0, y0, res, glow, glowHi);
      else if (type === 'tall') stampModule(f, G.STH_WIN_TALL, x0, y0, res, glow, glowHi);
      else stampModule(f, G.STH_WIN, x0, y0, res, glow, glowHi);
      if (type === 'balcony' && grand) stampModule(f, G.STH_BALCONY, x0, y0, res);
      const r = d.next();
      if (r < 0.04) stampModule(f, M.PEEK, x0, y0, res);
      else if (r < 0.12 && type !== 'small') stampModule(f, G.STH_FLOWERS, x0, y0, res);
      else if (r < 0.135 && type !== 'small') stampModule(f, M.BANNER_NO, x0, y0, res);
      // Blue-and-yellow flag from the window.
      else if (r < 0.155 && type !== 'small')
        stampModule(f, M.BALCONY_FLAG, x0, y0, flagRes(res, C('blue1'), C('ochre3')));
    },
    door: G.STH_PORTAL,
    shop: (d) => (d.chance(0.4) ? G.STH_KONDITORI : G.STH_SHOP),
    groundBay({ f, x0, y0, res, d }) {
      stampModule(f, G.STH_WIN, x0, y0, res, d.chance(0.35) ? GLOW : 0, GLOW_HI);
    },
    shopChance: 0.3,
    pipe: 'gray2',
    rusticateSmooth: false,
    doubleStringCourse: false,
    eavesTrim: true,
    dentilParapet: true,
    tagChance: 0.18,
  },

  roofs: {
    terraceTiles: ['gray3', 'gray5', 'gray4'],
    pitchedChimneys: 'random',
    dormer: false,
    mansardStacks: ['stone3', 'stone4'],
    clutter: false,
    slopeTex: (look, rise) => roofTex(look)(rise),
    ornament: {
      headroom: 12,
      paint(o) {
        const d = o.dice;
        const look = o.look;
        if (look.variant === 'gamla' && o.roof === 'pitched' && o.street !== 'back') {
          const L = (o.street === 'right' ? o.d : o.w) * 16;
          if (L > 48 || L < 16 || !d.chance(0.8)) return;
          const kind = d.weighted<GableKind>([
            ['step', 4],
            ['volute', 4],
            ['bell', 1],
            ['point', L <= 32 ? 1 : 0],
          ]);
          const R = Math.min(24, Math.round(L * 0.42) + 5);
          if (gableTop(kind, L, R) > o.rise + 18 + 12) return;
          paintGable(o, {
            kind,
            ridge: R,
            roof: roofTex(look)(R),
            ridgeCol: look.slope === 'zinc' ? C('teal2') : look.slope === 'slate' ? C('gray2') : C('rust3'),
            trim: look.trim,
            hoist: d.chance(0.25),
            door: look.door,
            frame: C('white'),
            opening: d.pick(['oculus', 'pair', 'oculus']),
            lit: d.chance(0.35),
            chimney: d.chance(0.6) ? look.wall : null,
          });
          return;
        }
        // Grand blocks: a copper-domed turret on the corner now and then.
        if (
          look.variant === 'grand' &&
          o.storeys >= 4 &&
          Math.min(o.w, o.d) >= 3 &&
          d.chance(o.roof === 'pitched' ? 0.35 : 0.6)
        ) {
          const copper = look.slope === 'zinc' || d.chance(0.6);
          cornerTurret(o, {
            wall: look.wall,
            trim: look.trim,
            dome: copper
              ? [C('green0'), C('zinc0'), C('teal1'), C('teal2')]
              : [C('ink'), C('gray1'), C('gray2'), C('gray3')],
            finial: C('ochre3'),
            drum: 7,
            domeH: d.chance(0.5) ? 9 : 7,
            onion: d.chance(0.3) ? 0.25 : 0,
            spire: d.chance(0.5),
            lit: d.chance(0.4),
          });
        }
      },
    },
  },

  props: {
    lamp: { grid: G.LAMP_STOCKHOLM, keys: { M: 'gray4', m: 'gray3', A: 'gray5', W: 'white' } },
    metal: ['gray3', 'gray2'],
    bench: { frame: 'gray1', wood: 'earth4' },
    kiosk: { body: 'rust1', roof: 'gray2', top: { sign: 'navy2' } },
    bin: { grid: G.BIN_STOCKHOLM, keys: { B: 'green2', b: 'green1', A: 'gray5', d: 'ink', m: 'gray2' } },
    bollard: { grid: G.BOLLARD_STOCKHOLM, keys: { M: 'gray2', m: 'gray1' } },
    hydrant: { M: 'ochre2', m: 'ochre1', A: 'gray3' },
    metro: { grid: G.METRO_STOCKHOLM, shadow: 3 },
    busStop: { frame: 'gray3', roof: 'gray5', flag: 'blue1' },
    planter: 'gray5',
    cafe: {
      chair: 'gray2',
      table: 'white',
      umbrellas: [
        ['navy1', 'white'],
        ['crim1', 'white'],
        ['ochre3', 'navy1'],
      ],
    },
    flag: flagSweden,
    bike: { colours: ['gray1', 'navy2', 'white', 'crim1'], basket: false, scooters: false },
    extra,
  },

  preview: {
    blds: [
      [0, 0, 2, 4, 5, 'pitched', 'residential'],
      [2, 0, 2, 4, 4, 'pitched', 'commercial'],
      [4, 0, 3, 4, 6, 'mansard', 'commercial'],
      [14, 0, 2, 4, 5, 'pitched', 'residential'],
    ],
    park: ['tree.round', 'tree.plane'],
    street: 'tree.plane',
    seed: 1009,
    icons: [
      ['fountain', 13, 12],
      ['metro', 13, 5, 0.3, 0.7],
      ['kiosk', 15, 5],
      ['flag', 7, 14],
      ['boat', 4, 17],
      ['bollard', 12, 16, 0.5, 0.5],
    ],
  },

  sampleRoof: 'pitched',
  decals: { tag: 'fika', tagGrid: G.TAG_FIKA, puddles: false },
  cars: [
    'volvo_navy',
    'volvo_red',
    'volvo_beige',
    'volvo_white',
    'hatch_silver',
    'sedan_black',
    'delivery_van',
    'hatch_white',
    'volvo_navy',
    'bus_stockholm',
  ],
  minimapRoof: 'gray2',
  postcardSky: ['sky', 'zinc4'],
  mapTint: [222, 160, 84],
  protest: { item: 'phone', wokeChance: 0 },
};
