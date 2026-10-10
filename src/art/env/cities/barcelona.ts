/**
 * BARCELONA — environment style (E3 South). Eixample blocks in cream and sandstone with a
 * wrought-iron balcony at every balconera, slatted persianes de llibret, Modernista flourishes
 * (trencadís, undulating crests, Gaudí chimneys) on a few seeded buildings; narrow dark-stone
 * Ciutat Vella houses with washing on the balconies; Panot "flor" pavements, the Rambla's wavy
 * paving, painted shop shutters, palms, the red Metro diamond, black-and-yellow taxis.
 */
import type { RGBA } from '../../palette';
import { C, darker, lighter } from '../color';
import { GLOW, GLOW_HI, flagRes, tag } from '../bld/kit';
import { K_GLASS, K_WALL, stampModule, type Face } from '../bld/face';
import { CORNICE, STOREY } from '../bld/facade';
import * as M from '../bld/modules.grid';
import { billboard, gable, type FaceSide } from '../bld/ornaments';
import type { GroundFill } from '../ground';
import type { PropKit, PropSprite } from '../props';
import * as P from '../props.grid';
import type { EnvCity, OrnamentCtx } from '../style';
import { Dice, hash } from '../util';
import * as G from './barcelona.grid';
import { basinFountain } from './rome';

// ------------------------------------------------------------------------------- paving --

/**
 * Panot "flor": square cement tiles (`n`×`n` per ground tile), each moulded with a four-petal
 * flower; petals catch the light on their upper-left rims.
 */
function panotFill(n: number, base: RGBA, petal: RGBA, joint: RGBA): GroundFill {
  const hi = lighter(petal);
  const sh = darker(base);
  const P4: ReadonlyArray<readonly [number, number]> = [
    [0.5, 0.29],
    [0.5, 0.71],
    [0.29, 0.5],
    [0.71, 0.5],
  ];
  return (_x, _y, u, v) => {
    const s = (u * n) % 1;
    const t = (v * n) % 1;
    if (s < 0.05 || t < 0.05) return joint;
    // Quarter petals in the corners join the neighbours' into the next flowers.
    const cs = Math.min(s, 1 - s);
    const ct = Math.min(t, 1 - t);
    if (cs * cs + ct * ct < 0.02) return sh;
    for (const [pu, pv] of P4) {
      const du = s - pu;
      const dv = t - pv;
      const r2 = du * du + dv * dv;
      if (r2 < 0.032) return du + dv < -0.08 ? hi : petal;
      if (r2 < 0.05 && du + dv > 0.1) return sh;
    }
    return base;
  };
}

/** The Rambla's wavy paving: bands that ripple across the promenade. */
function wavesFill(tones: readonly RGBA[], edge: RGBA): GroundFill {
  return (_x, _y, u, v) => {
    const w = v * 3 + 0.3 * Math.sin(u * Math.PI * 4);
    const band = Math.floor(w);
    const f = w - band;
    if (f < 0.12) return edge;
    return tones[((band % tones.length) + tones.length) % tones.length]!;
  };
}

/** Moll de la Fusta: a boardwalk of weathered planks along the port and the beach. */
function boardwalkFill(): GroundFill {
  const tones = [C('earth3'), C('earth3'), C('stone2'), C('earth4')];
  return (_x, _y, u, v) => {
    const row = Math.floor(v * 4);
    const fv = v * 4 - row;
    if (fv < 0.13) return C('earth1');
    const off = (row * 0.37) % 1;
    const col = Math.floor(u * 2 + off);
    const fu = u * 2 + off - col;
    if (fu < 0.04) return C('earth2');
    const t = tones[hash(row, ((col % 2) + 2) % 2, 0xb0a) % tones.length]!;
    return fv < 0.3 ? lighter(t) : fv > 0.85 ? darker(t) : t;
  };
}

// ----------------------------------------------------------------------------- trencadís --

const MOSAIC = ['sky', 'teal2', 'ochre3', 'white', 'lime', 'blue2', 'rust4', 'pink2', 'teal1'];

/** A broken-tile mosaic colour for pixel (x, y). */
function tile(x: number, y: number, s: number): RGBA {
  const h = hash(x >> 1, y, s);
  return C(MOSAIC[h % MOSAIC.length]!);
}

function mosaicBand(f: Face, x0: number, x1: number, y: number, s: number): void {
  for (let x = x0; x <= x1; x++) {
    if (!f.in(x, y) || f.kindAt(x, y) === K_GLASS) continue;
    f.set(x, y, tile(x, y, s));
  }
}

/** A street painter's piece on a shop shutter: two-colour bubble letters with an outline. */
function shutterPiece(f: Face, x0: number, y0: number, d: Dice): void {
  const pal = ['crim2', 'ochre3', 'sky', 'pink2', 'lime', 'teal2', 'purple', 'rust3', 'white'];
  const a = C(d.pick(pal));
  const b = C(d.pick(pal));
  const bg = d.chance(0.5) ? C(d.pick(['navy1', 'plum1', 'teal1', 'green1', 'gray2'])) : 0;
  const ph = d.next() * 6;
  for (let y = y0 + 1; y <= y0 + 8; y++) {
    for (let x = x0 + 1; x <= x0 + 6; x++) {
      const v = Math.sin(x * 1.3 + ph) + Math.cos(y * 0.9 + ph * 0.7) + Math.sin((x + y) * 0.7);
      if (v > 0.9) f.tint(x, y, a);
      else if (v > 0.5) f.tint(x, y, C('ink'));
      else if (v < -1.2) f.tint(x, y, b);
      else if (bg) f.tint(x, y, bg);
    }
  }
}

// ------------------------------------------------------------------------- roof ornaments --

const SEED_MOD = 0x6a0d1;

/** Modernista skyline: undulating crests over the street faces, Gaudí's mosaic chimneys. */
function bcnRoofs(o: OrnamentCtx): void {
  const { cv, look, roof, w, d, H, dice } = o;
  if (roof === 'pitched' || roof === 'mansard') return;
  const mod = look.variant?.includes('mod');
  const sides: Array<[FaceSide, number]> = [
    ['left', w * 16],
    ['right', d * 16],
  ];
  if (mod) {
    const waves = dice.int(2, 4);
    for (const [side, len] of sides) {
      const shade = side === 'right';
      const T = shade ? darker(look.trim) : look.trim;
      gable(cv, {
        side,
        w,
        d,
        s0: 0,
        s1: len,
        z0: H,
        h: 6,
        profile: (t) => 0.35 + 0.65 * (0.5 - 0.5 * Math.cos(t * Math.PI * 2 * waves)),
        tex: (x, y, edge) => {
          if (edge === 0) return lighter(T);
          if (edge === 1) {
            const c = tile(x, y, SEED_MOD);
            return shade ? darker(c) : c;
          }
          return y === 0 ? darker(T) : T;
        },
      });
    }
    // Gaudí chimneys: twisted stacks clad in trencadís, with little helmets.
    const n = dice.int(1, Math.max(1, Math.min(4, Math.floor((w * d) / 3))));
    for (let k = 0; k < n; k++) {
      const u = 0.4 + dice.next() * Math.max(0.1, w - 0.8);
      const v = 0.4 + dice.next() * Math.max(0.1, d - 0.8);
      const keys: Record<string, RGBA> = {
        k: C('ink'),
        h: C(dice.pick(['stone4', 'white', 'ochre3'])),
        H: C('stone5'),
        a: C(dice.pick(MOSAIC)),
        b: C(dice.pick(MOSAIC)),
        c: C(dice.pick(MOSAIC)),
        s: C('stone3'),
        S: C('stone2'),
      };
      billboard(cv, { u, v, z: H - 3 }, CHIMNEY, keys, 1.2);
    }
  } else if (roof === 'terrace' && dice.chance(0.25)) {
    // Plain Eixample chimney pots.
    const u = 0.4 + dice.next() * Math.max(0.1, w - 0.8);
    billboard(
      cv,
      { u, v: 0.4, z: H - 3 },
      POT,
      { s: look.wall, S: darker(look.wall), k: C('ink') },
      1.2,
    );
  }
}

const CHIMNEY = `
..hHh..
.hHHHh.
hHHhhhh
.kkkkk.
..abc..
.abcab.
.bcabc.
.cabca.
.abcab.
.bcabc.
sSSSSSs
`;

const POT = `
.kk.
sSSS
sSSS
sSSS
`;

// ---------------------------------------------------------------------------------- props --

/** Palm (Washingtonia / Phoenix): ringed trunk with a slight lean, drooping frond crown. */
function palm(k: PropKit, seed: number, tall: boolean): PropSprite {
  const d = new Dice(seed);
  const W = 31;
  const H = tall ? 60 : 46;
  const g: string[][] = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  const put = (x: number, y: number, c: string): void => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi >= 0 && yi >= 0 && xi < W && yi < H) g[yi]![xi] = c;
  };
  const cx = 15;
  const top = tall ? 10 : 9;
  const lean = (d.next() - 0.5) * 6;
  // Trunk: 2–3 px, rings every 3 rows, thicker at the foot (Phoenix-ish when short).
  for (let y = H - 1; y >= top; y--) {
    const t = (H - 1 - y) / (H - 1 - top);
    const x = cx + lean * t * t;
    const wdt = tall ? 2 : t < 0.15 ? 4 : 3;
    for (let q = 0; q < wdt; q++) {
      const ring = (y % 3 === 0 && q > 0) || q === wdt - 1;
      put(x - Math.floor(wdt / 2) + q, y, q === 0 ? 'b' : ring ? 'E' : 'e');
    }
  }
  const crownX = cx + lean;
  const crownY = top;
  // Dead frond skirt under the crown.
  for (let q = -2; q <= 2; q++) put(crownX + q, crownY + 2, q < 0 ? 'o' : 'O');
  for (let q = -1; q <= 1; q++) put(crownX + q, crownY + 3, 'O');
  // Fronds.
  const nF = 11;
  for (let f = 0; f < nF; f++) {
    const a = (f / nF) * Math.PI * 2 + d.next() * 0.3;
    const L = (tall ? 12 : 13) + d.next() * 3;
    const back = Math.sin(a) < -0.2; // fronds behind the crown are darker
    for (let s = 0; s <= 1; s += 0.04) {
      const x = crownX + Math.cos(a) * L * s;
      const y = crownY - Math.sin(a) * L * 0.45 * s - 4 * s + 10 * s * s;
      const lit = Math.cos(a) < 0.2 && !back;
      put(x, y, back ? 'h' : lit ? 'G' : 'g');
      // Leaflets hang off the spine.
      if (s > 0.25) {
        put(x, y + 1, back ? 'n' : 'h');
        if (s > 0.5 && Math.floor(s * 25) % 2 === 0) put(x, y + 2, back ? 'n' : 'h');
      }
      if (s > 0.85 && lit) put(x, y - 1, 'H');
    }
  }
  for (let q = -1; q <= 1; q++) put(crownX + q, crownY, 'G');
  put(crownX, crownY - 1, 'H');
  const src = g.map((r) => r.join('')).join('\n');
  return k.gridProp(
    src,
    {
      b: 'earth4',
      e: 'earth3',
      E: 'earth2',
      o: 'earth3',
      O: 'olive1',
      n: 'green0',
      h: 'green1',
      g: 'green2',
      G: 'green3',
      H: 'green4',
    },
    { shadow: 6 },
  );
}

function canaletes(k: PropKit): PropSprite {
  return k.gridProp(
    G.CANALETES,
    {
      M: 'gray2',
      m: 'gray1',
      A: 'ochre2',
      L: 'stone5',
      F: 'white',
      U: 'sky',
      S: 'stone3',
      s: 'stone2',
    },
    { shadow: 4 },
    ['L', 'F'],
  );
}

/** Catalonia's Senyera on the 13×8 cloth: gold with four red bars. */
const SENYERA = (_x: number, y: number, _W: number, H: number): RGBA =>
  Math.floor(((y + 0.5) * 9) / H) % 2 === 1 ? C('crim2') : C('ochre3');

// ------------------------------------------------------------------------------- the city --

export const barcelona: EnvCity = {
  ground: {
    asphalt: C('gray3'),
    asphaltSpeck: [C('gray2'), C('zinc1')],
    paint: C('white'),
    paintWorn: C('gray6'),
    yellowLines: false,
    kerbTop: C('gray6'),
    kerbLit: C('gray5'),
    kerbShade: C('gray3'),
    side: {
      tones: [C('gray5'), C('gray5'), C('gray6')],
      joint: C('gray4'),
      grid: { rows: 3, cols: 3, stagger: 0 },
    },
    cobble: {
      tones: [C('gray5'), C('gray4'), C('stone2'), C('gray5'), C('gray6')],
      joint: C('gray2'),
      grid: { rows: 4, cols: 2, stagger: 0.5 },
    },
    plaza: {
      tones: [C('stone4'), C('stone4'), C('stone5')],
      border: C('stone3'),
      joint: C('stone2'),
    },
    grass: { base: 'grass', stripes: false, dry: 0.4 },
    gravel: { base: C('stone4'), dark: C('stone3'), light: C('stone5') },
    water: {
      deep: C('navy1'),
      base: C('navy2'),
      ripple: C('navy1'),
      hi: C('blue1'),
      spark: C('sky'),
    },
    quayLit: C('stone3'),
    quayShade: C('stone2'),
    quayJoint: C('stone1'),
    rail: { top: C('gray3'), lit: C('gray2'), shade: C('gray1'), dark: C('ink') },
    lot: C('stone2'),
    leaves: false,
    ironRail: true,
    fills: {
      sidewalk: panotFill(2, C('gray5'), C('gray6'), C('gray4')),
      quay: boardwalkFill(),
      plaza: wavesFill([C('stone4'), C('stone3'), C('stone4'), C('gray6')], C('stone3')),
    },
  },

  awnings: [
    ['crim1', 'crim2'],
    ['ochre2', 'ochre3'],
    ['green1', 'green2'],
    ['navy1', 'white'],
    ['rust1', 'rust2'],
  ],
  look(kind, d, site) {
    const civic = kind === 'civic';
    const storeys = site?.storeys ?? 5;
    const gothic =
      !civic &&
      (storeys <= 4 ? d.chance(0.7) : site?.roof === 'pitched' ? d.chance(0.6) : d.chance(0.12));
    const mod = !civic && !gothic && d.chance(0.24);
    const wallName = civic
      ? d.pick(['stone4', 'stone3'])
      : gothic
        ? d.weighted<string>([
            ['stone2', 5],
            ['stone1', 2],
            ['earth3', 2],
            ['earth4', 1],
            ['stone3', 2],
          ])
        : d.weighted<string>([
            ['stone4', 6],
            ['stone3', 4],
            ['earth6', 3],
            ['stone5', 2],
            ['earth5', 2],
            ['ochre2', 1],
          ]);
    const ashlar = civic || gothic || d.chance(0.45);
    return {
      mat: ashlar ? 'ashlar' : 'stucco',
      wall: C(wallName),
      groundMat: 'ashlar',
      ground: gothic ? darker(C(wallName)) : C(d.pick(['stone3', 'stone2'])),
      trim: gothic ? lighter(C(wallName)) : C(d.pick(['stone5', 'white', 'stone4'])),
      frame: C(d.pick(['green2', 'earth2', 'green1', 'stone4'])),
      shutter: C(
        d.weighted<string>([
          ['green2', 4],
          ['earth3', 2],
          ['stone2', 2],
          ['green3', 1],
        ]),
      ),
      iron: C('ink'),
      ironHi: C('gray2'),
      door: C(d.pick(['earth1', 'earth2', 'green1', 'earth1'])),
      slope: 'terracotta',
      flat: C('stone3'),
      quoins: false,
      variant: gothic ? 'gotic' : mod ? 'eix+mod' : 'eix',
    };
  },

  facade: {
    floor(k, upper, _roof, kind, d) {
      const fromGround = upper - k;
      if (kind === 'civic') return fromGround === 1 ? 'tall' : 'plain';
      if (fromGround === 1 && upper >= 4 && d.chance(0.45)) return 'small'; // entresòl
      if (fromGround === 2 && upper >= 4 && d.chance(0.5)) return 'gallery'; // principal
      return 'balcony';
    },
    upperBay({ f, look, type, x0, y0, res, glow, glowHi, d }) {
      const gothic = look.variant === 'gotic';
      const mod = look.variant?.includes('mod') ?? false;
      if (gothic) {
        stampModule(f, G.BCN_GOTHIC, x0, y0, res, glow, glowHi);
        const o = d.next();
        if (o < 0.38) stampModule(f, M.LAUNDRY, x0, y0, res);
        else if (o < 0.5) stampModule(f, M.FLOWERS, x0, y0, res);
        else if (o < 0.54) stampModule(f, M.PEEK, x0, y0, res);
        else if (o < 0.55)
          stampModule(f, M.BALCONY_FLAG, x0, y0, flagRes(res, C('ochre3'), C('crim2')));
        if (d.chance(0.05)) stampModule(f, M.AC_UNIT, x0, y0, res);
        return;
      }
      if (type === 'small') {
        stampModule(f, G.BCN_WIN_SMALL, x0, y0, res, glow, glowHi);
        return;
      }
      stampModule(f, G.BCN_DOOR, x0, y0, res, glow, glowHi);
      const r = d.next();
      if (r < 0.4) stampModule(f, G.BCN_PERSIANA, x0, y0, res);
      else if (r < 0.62) stampModule(f, G.BCN_PERSIANA_UP, x0, y0, res);
      else if (r < 0.65) stampModule(f, M.PEEK, x0, y0, res);
      if (type === 'balcony' || type === 'tall')
        stampModule(f, mod ? G.BCN_BALCONY_MOD : G.BCN_BALCONY, x0, y0, res);
      const o = d.next();
      if (o < 0.13) stampModule(f, M.FLOWERS, x0, y0, res);
      else if (o < 0.17) stampModule(f, M.LAUNDRY, x0, y0, res);
      else if (o < 0.18) stampModule(f, M.BANNER_NO, x0, y0, res);
      else if (o < 0.19)
        stampModule(f, M.BALCONY_FLAG, x0, y0, flagRes(res, C('ochre3'), C('crim2')));
      if (mod) {
        // Trencadís over the lintel.
        mosaicBand(f, x0 + 1, x0 + 6, y0, hash(x0, y0, SEED_MOD));
      }
      if (d.chance(0.03)) stampModule(f, M.SAT_DISH, x0, y0, res);
    },
    door: G.BCN_PORTAL,
    shop: (d) => (d.chance(0.4) ? G.BCN_BAR : G.BCN_SHOP),
    groundBay({ f, look, x0, y0, res, d, commercial }) {
      if (look.variant === 'gotic' && !commercial && d.chance(0.6)) {
        stampModule(f, G.BCN_REIXA, x0, y0, res, d.chance(0.3) ? GLOW : 0, GLOW_HI);
        return;
      }
      stampModule(f, G.BCN_SHUTTER, x0, y0, res);
      // Barcelona's shutters are its open-air gallery.
      if (d.chance(0.7)) shutterPiece(f, x0, y0, d);
      if (d.chance(0.6)) tag(f, x0 + 1, y0 + 2 + d.int(0, 4), d);
    },
    shopChance: 0.55,
    pipe: 'gray3',
    rusticateSmooth: true,
    doubleStringCourse: false,
    eavesTrim: false,
    dentilParapet: false,
    tagChance: 0.6,
    finish({ f, look, plan, d }) {
      const len = f.w;
      const T = look.trim;
      if (look.variant === 'gotic') {
        // Soot and damp: dark streaks down the old stone.
        const n = d.int(1, 3);
        for (let k = 0; k < n; k++) {
          const x = d.int(0, len - 1);
          const l = d.int(6, 16);
          for (let y = CORNICE; y < CORNICE + l && y < plan.H - STOREY; y++)
            if (f.kindAt(x, y) === K_WALL && (y + x) % 5 !== 0) f.darken(x, y);
        }
        return;
      }
      // Eixample cornice: a moulded band with consoles under the parapet.
      for (let x = 0; x < len; x++) {
        if (f.kindAt(x, 3) === K_WALL) f.set(x, 3, x % 4 === 0 ? darker(T) : T);
        if (x % 4 === 0 && f.kindAt(x, 4) === K_WALL) f.set(x, 4, darker(T));
      }
      // Modernista: a trencadís frieze under the cornice, floral string courses.
      if (look.variant?.includes('mod')) {
        mosaicBand(f, 0, len - 1, 5, hash(plan.seed, 7));
        for (let k = 1; k < plan.storeys - 1; k++) {
          const y = CORNICE + k * STOREY - 1;
          for (let x = 0; x < len; x++)
            if (f.kindAt(x, y) === K_WALL)
              f.set(x, y, (x + k) % 6 === 0 ? tile(x, y, plan.seed) : lighter(T));
        }
      }
    },
  },

  roofs: {
    // Terrats: red clay rasilla tiles.
    terraceTiles: ['rust1', 'rust2', 'earth4'],
    pitchedChimneys: 'random',
    dormer: false,
    mansardStacks: ['stone3', 'stone4'],
    clutter: true,
    ornament: { headroom: 8, paint: bcnRoofs },
  },

  props: {
    lamp: { grid: G.LAMP_BCN, keys: { M: 'gray2', m: 'gray1', A: 'ochre2' } },
    metal: ['gray3', 'gray2'],
    bench: { frame: 'gray1', wood: 'earth4' },
    kiosk: { body: 'gray2', roof: 'gray1', top: { sign: 'ochre1' } },
    bin: { grid: P.BIN, keys: { B: 'gray5', b: 'gray4', A: 'gray6', d: 'ink', m: 'gray3' } },
    bollard: { grid: G.BOLLARD_BCN, keys: { M: 'gray2', m: 'gray1', A: 'gray5' } },
    hydrant: { M: 'crim2', m: 'crim1', A: 'gray5' },
    metro: { grid: G.METRO_BCN, shadow: 3 },
    busStop: { frame: 'gray3', roof: 'gray5', flag: 'crim2' },
    planter: 'stone3',
    cafe: {
      chair: 'gray6',
      table: 'gray6',
      umbrellas: [
        ['crim1', 'white'],
        ['white', 'teal2'],
        ['ochre3', 'white'],
      ],
    },
    flag: SENYERA,
    bike: { colours: ['crim2'], basket: true, scooters: true },
    extra: {
      'tree.round.0': (k) => palm(k, 11, true),
      'tree.round.1': (k) => palm(k, 23, false),
      'tree.round.2': (k) => palm(k, 37, true),
      'tree.palm.0': (k) => palm(k, 5, true),
      'tree.palm.1': (k) => palm(k, 19, false),
      'tree.palm.2': (k) => palm(k, 41, true),
      wallace: canaletes,
      fountain: (k) => basinFountain(k, 'stone3'),
    },
  },

  preview: {
    blds: [
      [0, 0, 3, 4, 6, 'terrace', 'residential'],
      [3, 0, 2, 4, 5, 'flat', 'commercial'],
      [5, 0, 2, 4, 6, 'terrace', 'commercial'],
      [14, 0, 2, 4, 4, 'pitched', 'residential'],
    ],
    park: ['tree.palm', 'tree.plane'],
    street: 'tree.plane',
    seed: 1009,
    icons: [
      ['kiosk', 13, 12],
      ['metro', 13, 5, 0.3, 0.7],
      ['flag', 7, 14],
      ['wallace', 15, 5],
    ],
  },

  sampleRoof: 'terrace',
  decals: {
    tag: 'prou',
    tagGrid: `
###.###..#..#.#
#.#.#.#.#.#.#.#
###.##..#.#.#.#
#...#.#.#.#.#.#
#...#.#..#..###
`,
    puddles: false,
  },
  cars: [
    'taxi_barcelona',
    'taxi_barcelona',
    'hatch',
    'scooter',
    'hatch_white',
    'scooter_red',
    'delivery_van',
    'hatch_silver',
    'sedan_black',
    'bus_barcelona',
  ],
  minimapRoof: 'rust2',
  postcardSky: ['sky', 'blue2'],
  mapTint: [222, 196, 150],
  protest: { item: 'pot', wokeChance: 0 },
};
