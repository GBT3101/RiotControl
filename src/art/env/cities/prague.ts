/**
 * PRAGUE — environment style (E3 Central). A Baroque and Gothic old town: pastel facades
 * (salmon, ochre, butter yellow, pink, pale green-blue, white) with eared windows, geranium
 * boxes and curved Baroque gables; Renaissance houses dressed in black-and-white sgraffito;
 * dark Gothic stone with spiky spires; arcades on the squares and painted house signs over the
 * doors. Steep red clay-tile roofs with dormers (the sea of red roofs), copper domes on the
 * palaces. Cobbled mosaic pavements, dark lamps, red trams, the arrow-M Metro sign, Czech flags,
 * souvenir and trdelník stands.
 */
import type { RGBA } from '../../palette';
import { C, darker, lighter } from '../color';
import { GLOW, GLOW_HI } from '../bld/kit';
import { K_WALL, stampModule, type KeyResolver } from '../bld/face';
import * as M from '../bld/modules.grid';
import {
  PROFILES,
  billboard,
  cone,
  dome,
  facePoint,
  gable,
  prism,
  slopeDormer,
} from '../bld/ornaments';
import type { Look } from '../bld/looks';
import type { EnvCity, FacadeFinishCtx, OrnamentCtx, SlopeTex } from '../style';
import { hash } from '../util';
import { boat, fountain, stand, type BoatColours } from './central';
import * as P from '../props.grid';
import * as G from './prague.grid';

const shadeBy = (c: RGBA, l: number): RGBA => (l > 0 ? lighter(c, l) : l < 0 ? darker(c, -l) : c);
const mod = (a: number, m: number): number => ((a % m) + m) % m;

function flagRes(res: KeyResolver): KeyResolver {
  const K: Record<string, RGBA> = { '1': C('white'), '2': C('crim2'), '3': C('navy2') };
  return (k, x, y) => K[k] ?? res(k, x, y);
}

// ------------------------------------------------------------------------------------ roofs --

/** Red beaver-tail clay tiles, dark Gothic slate, copper. */
function slopeTex(look: Look, rise: number): SlopeTex {
  if (look.slope === 'terracotta') {
    return (a, b, l) => {
      const ai = Math.floor(a);
      const bi = Math.floor(b);
      if (bi <= 0) return C('rust0');
      if (bi >= rise - 1) return shadeBy(C('rust3'), l);
      const course = bi >> 1;
      let c = C('rust2');
      if (bi % 2 === 0)
        c = C('rust1'); // course shadow under the tile tails
      else if (mod(ai + (course % 2) * 2, 4) === 0) c = C('rust1');
      const h = hash(ai >> 1, course, 31) % 37;
      if (h === 0) c = C('rust3');
      else if (h === 1) c = C('earth3');
      return shadeBy(c, l);
    };
  }
  if (look.slope === 'zinc') {
    return (a, b, l) => {
      const ai = mod(Math.floor(a), 4);
      const bi = Math.floor(b);
      if (bi <= 0) return C('zinc0');
      const c = ai === 0 || bi >= rise - 1 ? C('teal2') : C('teal1');
      return shadeBy(c, l);
    };
  }
  return (a, b, l) => {
    const bi = Math.floor(b);
    if (bi <= 0) return C('ink');
    const c =
      bi % 2 === 0 ? C('gray1') : mod(Math.floor(a) + bi, 4) === 0 ? C('gray1') : C('gray2');
    return shadeBy(c, l);
  };
}

const SLATE = [C('ink'), C('gray1'), C('gray1'), C('gray2'), C('gray3')];
const COPPER = [C('zinc0'), C('teal1'), C('teal1'), C('teal2'), C('teal2')];
const GILT = { y: C('ochre2'), Y: C('ochre3') };
const FINIAL = `
.y.
yYy
.y.
yyy
`;
const URN = `
.U.
UUu
.u.
UUu
`;
const STATUE = `
.TT.
.Tt.
TTTt
TTTt
.Tt.
.TTt
TT.t
`;

/** Gothic tower with a spiky slate spire, its four corner pinnacles and a gilt ball. */
function gothicTower(
  o: OrnamentCtx,
  cu: number,
  cvv: number,
  size: number,
  z0: number,
  h: number,
): void {
  const { cv } = o;
  const stone = C('stone1');
  prism(cv, {
    cu,
    cv: cvv,
    z0,
    z1: z0 + h,
    r: size * Math.SQRT1_2,
    n: 4,
    rot: Math.PI / 4,
    tex: (s, x, y) => {
      if (y < 0) return C('gray1');
      if (y <= 1) return lighter(stone);
      if (y > 3 && y < 10 && (x === 3 || x === 4)) return C('ink');
      if (y % 5 === 4) return darker(stone);
      return s > 0.5 ? stone : darker(stone, s > 0.25 ? 1 : 2);
    },
  });
  const top = z0 + h;
  cone(cv, {
    cu,
    cv: cvv,
    z0: top,
    r: size * 0.62,
    h: Math.round(h * 1.5),
    n: 8,
    ramp: SLATE,
  });
  for (const [du, dv] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const pu = cu + du * size * 0.45;
    const pv = cvv + dv * size * 0.45;
    cone(cv, { cu: pu, cv: pv, z0: top, r: 0.07, h: 9, n: 4, ramp: SLATE, bias: 1 });
    billboard(cv, { u: pu, v: pv, z: top + 9 }, '.y.\ny.y', GILT, 1.5);
  }
  billboard(cv, { u: cu, v: cvv, z: top + Math.round(h * 1.5) }, FINIAL, GILT, 1);
}

function ornament(o: OrnamentCtx): void {
  const { cv, look, kind, w, d, H, rise, dice } = o;
  const side = o.street === 'right' ? 'right' : 'left';
  const len = (side === 'left' ? w : d) * 16;
  if (look.variant === 'gothic' && (kind === 'civic' || dice.chance(0.4))) {
    // A dark stone tower at the back corner (Týn / town-hall silhouette).
    const size = Math.min(0.9, Math.min(w, d) * 0.4);
    gothicTower(o, size * 0.6 + 0.05, size * 0.6 + 0.05, size, H - 6, 16);
    return;
  }
  if (kind === 'civic') {
    const flat = o.roof === 'flat' || o.roof === 'terrace';
    if (flat) {
      for (let k = 1; k < w * 2; k += 2)
        billboard(cv, { u: k / 2, v: d - 0.05, z: H + 3 }, STATUE, {
          T: C('gray3'),
          t: C('gray2'),
        });
    }
    if (len >= 32) {
      const span = Math.min(36, len - 8);
      const s0 = Math.round((len - span) / 2);
      const T = side === 'left' ? look.trim : darker(look.trim);
      const wall = side === 'left' ? look.wall : darker(look.wall);
      gable(cv, {
        side,
        w,
        d,
        s0,
        s1: s0 + span,
        z0: H - 1,
        h: 9,
        profile: PROFILES.segment,
        tex: (x, y, edge) => {
          if (edge <= 0) return lighter(T);
          if (edge === 1 || y === 0) return darker(T);
          // Coat of arms in the tympanum.
          const cx = Math.abs(x - (span - 1) / 2);
          if (cx < 2 && y >= 2 && y <= 5) return y === 2 ? C('ochre2') : C('crim2');
          return wall;
        },
      });
    }
    if (w >= 3 && d >= 3) {
      // St Nicholas-like copper dome on a drum.
      const zTop = flat ? H : H + rise;
      prism(cv, {
        cu: w / 2,
        cv: d / 2,
        z0: zTop - 2,
        z1: zTop + 8,
        r: 0.4,
        n: 12,
        tex: (s, x, y) => {
          if (y < 0) return look.trim;
          if (y <= 0) return lighter(look.trim);
          if (x % 4 === 2 && y > 2 && y < 8) return C('navy1');
          return s > 0.55 ? look.wall : darker(look.wall, s > 0.3 ? 1 : 2);
        },
      });
      dome(cv, {
        cu: w / 2,
        cv: d / 2,
        z0: zTop + 8,
        r: 0.42,
        h: 12,
        ramp: COPPER,
        ribs: 12,
        rib: C('teal2'),
      });
      billboard(cv, { u: w / 2, v: d / 2, z: zTop + 20 }, FINIAL, GILT, 1);
    }
    return;
  }
  if (o.roof !== 'pitched') return;
  // Curved Baroque gable on the street face.
  if (look.variant === 'baroque' && len >= 24 && dice.chance(0.55)) {
    const span = Math.min(30, len - 8);
    const s0 = Math.round((len - span) / 2);
    const T = side === 'left' ? look.trim : darker(look.trim);
    const wall = side === 'left' ? look.wall : darker(look.wall);
    const h = 15;
    gable(cv, {
      side,
      w,
      d,
      s0,
      s1: s0 + span,
      z0: H - 1,
      h,
      profile: PROFILES.baroque,
      tex: (x, y, edge, top) => {
        if (edge <= 0) return lighter(T);
        if (edge === 1) return T;
        if (y === 0) return darker(T);
        const cx = Math.abs(x - (span - 1) / 2);
        // Oculus window, volute scrolls at the shoulders, pilaster strips.
        if (Math.hypot(cx, y - 7.5) < 2.2) return Math.hypot(cx, y - 7.5) < 1.3 ? C('navy1') : T;
        if (top < h * 0.5 && edge === 2 && cx > span * 0.3) return darker(T);
        if (Math.round(cx) === Math.round(span * 0.25) && y < 10) return lighter(wall);
        return wall;
      },
    });
    const apex = facePoint(side, w, d, s0 + span / 2, H + h, 0.03);
    billboard(cv, apex, URN, { U: look.trim, u: darker(look.trim) }, 2);
  }
  // Extra dormers on the front slope (the Malá Strana roofscape).
  if (rise >= 8 && w >= 2 && dice.chance(0.6)) {
    const n = Math.max(1, Math.floor(w / 2));
    for (let k = 0; k < n; k++) {
      const s = ((k + 0.5) * w * 16) / n;
      slopeDormer(cv, {
        side: 'left',
        w,
        d,
        s,
        inset: 0.42,
        z0: H + 3,
        wpx: 5,
        hpx: 4,
        wall: look.wall,
        trim: look.trim,
        glass: C('navy1'),
        cap: [C('rust1'), C('rust2'), C('rust3')],
      });
    }
  }
}

/** Renaissance sgraffito: black-and-white diamond-point rustication over the upper wall. */
function finish({ f, look, plan }: FacadeFinishCtx): void {
  if (look.variant !== 'sgraffito') return;
  const groundTop = f.h - 10;
  const lit = plan.side === 'left';
  const hi = lit ? C('white') : C('gray6');
  const mid = lit ? C('gray6') : C('gray5');
  const line = lit ? C('gray3') : C('gray2');
  for (let y = 3; y < groundTop - 1; y++) {
    for (let x = 0; x < f.w; x++) {
      if (f.kindAt(x, y) !== K_WALL) continue;
      const bx = Math.floor(x / 6);
      const cy = mod(y - 3 + (bx % 2) * 2, 4);
      const cx = mod(x, 6);
      let c: RGBA;
      if (cx === 0 || cy === 0) c = line;
      else c = cx / 6 + cy / 4 < 1 ? hi : mid;
      f.tint(x, y, c);
    }
  }
}

// ----------------------------------------------------------------------------------- props --

const BOAT: BoatColours = {
  hull: 'white',
  band: 'navy2',
  cabin: 'stone5',
  roof: 'gray6',
  flag: ['white', 'crim2', 'crim2'],
};

/** Cobbled mosaic pavement (small white / grey / red setts in a seamless 8×8 lattice). */
function mosaic(x: number, y: number, _u: number, _v: number, seed: number): RGBA {
  const sx = Math.floor((x + 2 * y) / 4);
  const sy = Math.floor((x - 2 * y + 64) / 4);
  const gx = mod(x + 2 * y, 4);
  const gy = mod(x - 2 * y + 64, 4);
  if (gx === 0 || gy === 0) return C('gray3');
  // White limestone and grey granite setts; a red-and-dark rosette every 8 setts.
  const h = hash(mod(sx, 8), mod(sy, 8), 0x9a) % 7;
  let c = h < 4 ? C('gray7') : h < 6 ? C('gray6') : C('gray5');
  const mx = mod(sx, 8);
  const my = mod(sy, 8);
  if (mx === 4 && my === 4) c = C('rust2');
  else if (Math.abs(mx - 4) + Math.abs(my - 4) === 1) c = C('gray4');
  void seed;
  return gx === 1 || gy === 1 ? lighter(c) : c;
}

export const prague: EnvCity = {
  ground: {
    asphalt: C('gray3'),
    asphaltSpeck: [C('gray2'), C('stone1')],
    paint: C('white'),
    paintWorn: C('gray6'),
    yellowLines: false,
    kerbTop: C('gray6'),
    kerbLit: C('gray5'),
    kerbShade: C('gray3'),
    side: {
      tones: [C('gray6'), C('gray5'), C('gray7'), C('gray5'), C('rust2')],
      joint: C('gray3'),
      grid: { rows: 4, cols: 4, stagger: 0.5 },
    },
    cobble: {
      tones: [C('gray4'), C('stone2'), C('gray3'), C('gray4'), C('stone1')],
      joint: C('gray2'),
      grid: { rows: 4, cols: 4, stagger: 0.5 },
    },
    plaza: {
      tones: [C('gray5'), C('stone3'), C('gray6'), C('gray5')],
      border: C('gray4'),
      joint: C('gray3'),
    },
    grass: { base: 'grass', stripes: false, dry: 0.15 },
    gravel: { base: C('stone3'), dark: C('stone2'), light: C('stone4') },
    water: {
      deep: C('green0'),
      base: C('zinc1'),
      ripple: C('green1'),
      hi: C('zinc2'),
      spark: C('zinc4'),
    },
    quayLit: C('stone2'),
    quayShade: C('stone1'),
    quayJoint: C('stone0'),
    rail: { top: C('stone3'), lit: C('stone2'), shade: C('stone1'), dark: C('stone0') },
    lot: C('gray4'),
    leaves: true,
    ironRail: false,
    tram: { at: [0.3, 0.7], rail: C('gray5'), railHi: C('gray7'), groove: C('gray1') },
    fills: { sidewalk: mosaic },
  },

  awnings: [
    ['crim1', 'white'],
    ['green1', 'ochre2'],
    ['earth1', 'ochre3'],
    ['crim1', 'crim2'],
  ],
  look(kind, d) {
    const civic = kind === 'civic';
    const variant = civic
      ? d.chance(0.3)
        ? 'gothic'
        : 'palace'
      : d.weighted<string>([
          ['baroque', 8],
          ['sgraffito', 1.2],
          ['gothic', 0.6],
        ]);
    const wallName = {
      palace: d.pick(['stone5', 'ochre3', 'pink3', 'white', 'earth6']),
      gothic: d.pick(['stone2', 'stone1', 'gray4']),
      sgraffito: 'white',
      baroque: d.weighted<string>([
        ['earth5', 3],
        ['earth6', 3],
        ['ochre2', 2],
        ['ochre3', 3],
        ['ochre4', 2],
        ['pink3', 1],
        ['zinc4', 1.5],
        ['white', 2],
        ['stone5', 2],
        ['green4', 0.3],
        ['rust3', 0.6],
      ]),
    }[variant]!;
    const gothic = variant === 'gothic';
    return {
      mat: gothic ? 'ashlar' : 'stucco',
      wall: C(wallName),
      groundMat: gothic || civic ? 'ashlar' : 'smooth',
      ground: gothic ? darker(C(wallName)) : civic ? C('stone3') : darker(C(wallName)),
      trim: gothic ? C('stone3') : C(d.pick(['white', 'stone5', 'white'])),
      frame: C(d.pick(['white', 'earth2', 'white', 'earth3'])),
      shutter: C(d.pick(['green2', 'earth3'])),
      iron: C('gray1'),
      ironHi: C('gray3'),
      door: C(d.pick(['earth1', 'earth2', 'green1', 'rust0'])),
      slope: gothic
        ? 'slate'
        : civic
          ? d.weighted<Look['slope']>([
              ['terracotta', 3],
              ['zinc', 2],
            ])
          : 'terracotta',
      flat: C('gray4'),
      quoins: !gothic && variant !== 'sgraffito' && d.chance(0.3),
      variant,
    };
  },

  facade: {
    floor(k, upper, _roof, kind, d) {
      const fromGround = upper - k;
      if (k === 0 && upper >= 3 && d.chance(0.3)) return 'small';
      if (fromGround === 1) return kind === 'civic' || d.chance(0.5) ? 'tall' : 'plain';
      return 'plain';
    },
    upperBay({ f, look, type, x0, y0, res, glow, glowHi, d }) {
      if (look.variant === 'gothic' || type === 'small') {
        stampModule(f, G.PRG_WIN_SMALL, x0, y0, res, glow, glowHi);
        return;
      }
      stampModule(f, type === 'tall' ? G.PRG_WIN_TALL : G.PRG_WIN, x0, y0, res, glow, glowHi);
      const r = d.next();
      if (r < 0.2) stampModule(f, G.PRG_FLOWERBOX, x0, y0, res);
      else if (r < 0.24) stampModule(f, M.PEEK, x0, y0, res);
      else if (r < 0.255) stampModule(f, M.BANNER_NO, x0, y0, res);
      else if (r < 0.27) stampModule(f, G.PRG_FLAG, x0, y0, flagRes(res));
    },
    door: G.PRG_DOOR,
    shop: (d) => (d.chance(0.4) ? G.PRG_PUB : G.PRG_SHOP),
    groundBay({ f, look, x0, y0, res, d, civic }) {
      if (civic || look.variant === 'gothic' || d.chance(0.3)) {
        stampModule(f, G.PRG_ARCADE, x0, y0, res, GLOW, GLOW_HI);
        return;
      }
      stampModule(f, G.PRG_GWIN, x0, y0, res, d.chance(0.3) ? GLOW : 0, GLOW_HI);
    },
    shopChance: 0.4,
    pipe: 'gray3',
    rusticateSmooth: false,
    doubleStringCourse: false,
    eavesTrim: true,
    dentilParapet: false,
    tagChance: 0.3,
    finish,
  },

  roofs: {
    terraceTiles: ['rust1', 'earth4', 'rust2'],
    pitchedChimneys: 'random',
    dormer: true,
    mansardStacks: ['stone4', 'stone5'],
    clutter: false,
    slopeTex,
    ornament: { headroom: 30, paint: ornament },
  },

  props: {
    lamp: { grid: G.LAMP_PRAGUE, keys: { M: 'gray2', m: 'gray1', A: 'gray4' } },
    metal: ['gray2', 'gray1'],
    bench: { frame: 'gray1', wood: 'earth3' },
    kiosk: { body: 'green1', roof: 'gray2', top: { sign: 'crim1' } },
    bin: { grid: P.BIN, keys: { B: 'gray2', b: 'gray1', A: 'gray4', d: 'ink', m: 'gray1' } },
    bollard: { grid: G.BOLLARD_PRAGUE, keys: { M: 'gray2', m: 'gray1' } },
    hydrant: { M: 'crim2', m: 'crim1', A: 'gray4' },
    metro: { grid: G.METRO_PRAGUE, shadow: 3 },
    busStop: { frame: 'gray2', roof: 'gray5', flag: 'crim2' },
    planter: 'stone3',
    cafe: {
      chair: 'earth2',
      table: 'white',
      umbrellas: [
        ['crim1', 'white'],
        ['green1', 'white'],
        ['ochre2', 'earth2'],
      ],
    },
    // Czech Republic: white over red, a blue wedge at the hoist.
    flag: (x, y, W, H) => {
      const wedge = (1 - Math.abs(y + 0.5 - H / 2) / (H / 2)) * (W / 2);
      if (x + 0.5 < wedge) return C('navy2');
      return y < H / 2 ? C('white') : C('crim2');
    },
    bike: { colours: ['pink2'], basket: true, scooters: false },
    extra: {
      'boat.i': (k) => boat(k, 'i', BOAT),
      'boat.j': (k) => boat(k, 'j', BOAT),
      // Souvenir stall (crystal, puppets, magnets) and a trdelník stand.
      'kiosk.0': (k) =>
        stand(k, {
          body: 'earth2',
          trim: 'ochre2',
          awning: ['crim1', 'white'],
          goods: ['sky', 'crim2', 'ochre3', 'purple', 'white'],
          sign: 'navy1',
          signText: 'white',
        }),
      'kiosk.1': (k) =>
        stand(k, {
          body: 'earth3',
          trim: 'earth1',
          awning: ['ochre2', 'earth2'],
          goods: ['ochre2', 'earth4', 'ochre1'],
          sign: 'earth1',
          signText: 'ochre3',
        }),
      fountain: (k) => fountain(k, { stone: 'stone3', water: 'zinc2', jet: 'sky' }),
      'statue.0': (k) =>
        k.gridProp(
          G.STATUE_PRAGUE,
          {
            q: 'gray1',
            Q: 'gray3',
            T: 'stone3',
            t: 'stone2',
            S: 'stone2',
            s: 'stone1',
            W: 'stone4',
          },
          { shadow: 5 },
        ),
      'statue.1': (k) =>
        k.gridProp(
          G.STATUE_PRAGUE,
          { q: 'teal1', Q: 'teal2', T: 'gray6', t: 'gray5', S: 'gray4', s: 'gray3', W: 'gray7' },
          { shadow: 5 },
        ),
      'statue.equestrian': (k) =>
        k.gridProp(
          G.EQUESTRIAN_PRAGUE,
          {
            q: 'green1',
            Q: 'teal1',
            T: 'stone4',
            t: 'stone3',
            S: 'stone2',
            s: 'stone1',
            W: 'stone5',
          },
          { shadow: 8 },
        ),
    },
  },

  preview: {
    blds: [
      [0, 0, 3, 4, 4, 'pitched', 'residential'],
      [3, 0, 2, 4, 4, 'pitched', 'commercial'],
      [5, 0, 2, 4, 5, 'pitched', 'residential'],
      [14, 0, 2, 4, 4, 'pitched', 'residential'],
    ],
    park: ['tree.chestnut', 'tree.oak'],
    street: 'tree.plane',
    seed: 1300,
    icons: [
      ['kiosk', 13, 12],
      ['metro', 13, 5, 0.3, 0.7],
      ['flag', 7, 14],
    ],
  },

  sampleRoof: 'pitched',
  decals: {
    tag: 'ne',
    tagGrid: `
#..#.####
##.#.#...
#.##.###.
#..#.#...
#..#.####
`,
    puddles: false,
  },
  cars: [
    'taxi_prague',
    'hatch_silver',
    'hatch_green',
    'hatch_white',
    'sedan',
    'delivery_van',
    'hatch',
    'tram_prague',
    'sedan_black',
  ],
  minimapRoof: 'rust2',
  postcardSky: ['sky', 'pink3'],
  mapTint: [222, 140, 110],
  protest: { item: 'bottle', wokeChance: 0.2 },
};
