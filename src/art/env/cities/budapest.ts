/**
 * BUDAPEST — environment style (E3 Central). Pest's eclectic and neo-Renaissance courtyard
 * blocks in ochre, cream, grey and soot-darkened stone: hooded double box windows, pediments on
 * the piano nobile, wrought-iron balconies, arched carriage gates into the gangház courtyards;
 * a few Secession (Art Nouveau) fronts with Zsolnay ceramic bands. Dark slate and tin roofs,
 * corner cupolas, patterned glazed-tile (Zsolnay) roofs on civic buildings. Granite quays with
 * stone balustrades, tram tracks, three-lantern cast-iron candelabras, BKV blue M signs, lime
 * MOL Bubi bikes, red-white-green flags, ruin-bar posters and tags.
 */
import type { RGBA } from '../../palette';
import { C, darker, lighter } from '../color';
import { GLOW, GLOW_HI, tag } from '../bld/kit';
import { stampModule, type KeyResolver } from '../bld/face';
import * as M from '../bld/modules.grid';
import { PROFILES, billboard, dome, facePoint, gable, prism } from '../bld/ornaments';
import type { Look } from '../bld/looks';
import type { EnvCity, OrnamentCtx, SlopeTex } from '../style';
import { hash } from '../util';
import * as P from '../props.grid';
import * as G from './budapest.grid';

const shadeBy = (c: RGBA, l: number): RGBA => (l > 0 ? lighter(c, l) : l < 0 ? darker(c, -l) : c);
const mod = (a: number, m: number): number => ((a % m) + m) % m;

/** City keys: 1–4 Zsolnay ceramic, and the tricolour for hung flags. */
function budaRes(res: KeyResolver): KeyResolver {
  const K: Record<string, RGBA> = {
    '1': C('teal1'),
    '2': C('ochre2'),
    '3': C('rust1'),
    '4': C('teal2'),
  };
  return (k, x, y) => K[k] ?? res(k, x, y);
}

function flagRes(res: KeyResolver): KeyResolver {
  const K: Record<string, RGBA> = { '1': C('crim2'), '2': C('white'), '3': C('green2') };
  return (k, x, y) => K[k] ?? res(k, x, y);
}

// ------------------------------------------------------------------------------------ roofs --

/** Slate (dark courses), tin (standing seams) and Zsolnay glazed tiles (diamond pattern). */
function slopeTex(look: Look, rise: number): SlopeTex {
  if (look.slope === 'terracotta') {
    // Zsolnay: a checker of glazed lozenges (green / brown) on an ochre lattice.
    return (a, b, l) => {
      const ai = Math.floor(a);
      const bi = Math.floor(b);
      if (bi <= 0) return C('earth2');
      if (bi >= rise - 1) return shadeBy(C('ochre2'), l);
      // Glazed courses in bands along the eaves (green / ochre / brown), scale-tile joints.
      const BANDS = ['green2', 'ochre3', 'green2', 'green3', 'earth3', 'green3'];
      const band = mod(bi, 6);
      let c = C(BANDS[band]!);
      // Lozenges between the ochre and brown courses.
      const m = Math.abs(mod(ai, 12) - 6);
      if ((band === 2 && m <= 1) || (band === 3 && m <= 2)) c = C('ochre2');
      else if (mod(ai + (bi % 2) * 2, 4) === 0) c = darker(c);
      return shadeBy(c, l);
    };
  }
  if (look.slope === 'zinc') {
    // Tin roof: standing seams, a lighter seam cap, rust-free grey.
    return (a, b, l) => {
      const ai = mod(Math.floor(a), 4);
      const bi = Math.floor(b);
      if (bi <= 0) return C('gray2');
      let c = ai === 0 ? C('gray5') : ai === 1 ? C('gray3') : C('gray4');
      if (bi >= rise - 1) c = C('gray5');
      return shadeBy(c, l);
    };
  }
  // Dark natural slate in staggered courses.
  return (a, b, l) => {
    const ai = Math.floor(a);
    const bi = Math.floor(b);
    if (bi <= 0) return C('ink');
    if (bi >= rise - 1) return shadeBy(C('gray3'), l);
    const course = Math.floor(bi / 2);
    let c = C('gray2');
    if (bi % 2 === 0) c = C('gray1');
    else if (mod(ai + course * 2, 4) === 0) c = C('gray1');
    else if (hash(ai >> 1, course, 17) % 11 === 0) c = C('zinc1');
    return shadeBy(c, l);
  };
}

const SLATE = [C('ink'), C('gray1'), C('gray2'), C('gray3'), C('gray4')];
const COPPER = [C('zinc0'), C('teal1'), C('teal1'), C('teal2'), C('sky')];
const ZSOLNAY = [C('green1'), C('green2'), C('green3'), C('ochre2'), C('ochre3')];

const FINIAL = `
.y.
yYy
.y.
.y.
yyy
`;
const STATUE = `
.qQ.
qQQq
qQqq
.Qq.
.Qq.
.qq.
qq.q
`;

function ornament(o: OrnamentCtx): void {
  const { cv, look, kind, w, d, H, rise, dice } = o;
  const gilt = { y: C('ochre2'), Y: C('ochre3') };
  if (kind === 'civic') {
    if (o.roof === 'flat' || o.roof === 'terrace') {
      // Central pediment on the street front, statues along the attic balustrade.
      const side = o.street === 'right' ? 'right' : 'left';
      const len = (side === 'left' ? w : d) * 16;
      if (len >= 32) {
        const span = Math.min(40, len - 8);
        const s0 = Math.round((len - span) / 2);
        const T = side === 'left' ? look.trim : darker(look.trim);
        gable(cv, {
          side,
          w,
          d,
          s0,
          s1: s0 + span,
          z0: H - 1,
          h: Math.round(span / 4),
          profile: PROFILES.pediment,
          tex: (x, y, edge) => {
            if (edge <= 0) return lighter(T);
            if (y === 0) return darker(T);
            if (edge === 1) return darker(T);
            // Tympanum with a little relief.
            return Math.abs(x - span / 2) < 3 && y > 1 && y < 4 ? lighter(look.wall) : look.wall;
          },
        });
      }
      for (let k = 1; k < w * 2; k++)
        if (k % 2 === 1)
          billboard(cv, { u: k / 2, v: d - 0.05, z: H + 3 }, STATUE, {
            q: darker(look.trim),
            Q: look.trim,
          });
      return;
    }
    if (o.roof === 'pitched' && rise > 4) {
      // Iron cresting and gilded finials along the ridge of the Zsolnay roof.
      const r = Math.min(1, Math.min(w, d) / 2);
      const z = H + rise;
      for (let u = r; u <= w - r + 0.001; u += 0.25)
        cv.pole({ u, v: d / 2, z }, 2, C('gray1'), 1);
      billboard(cv, { u: r, v: d / 2, z: z + 1 }, FINIAL, gilt, 1);
      billboard(cv, { u: w - r, v: d / 2, z: z + 1 }, FINIAL, gilt, 1);
      // Small lantern dome over the centre on bigger civic roofs.
      if (w >= 3 && d >= 2) {
        const cu = w / 2;
        const cvv = d / 2;
        prism(cv, {
          cu,
          cv: cvv,
          z0: z - 1,
          z1: z + 6,
          r: 0.26,
          n: 8,
          tex: (s, x, y) => {
            if (y < 0) return look.trim;
            if (y === 0) return lighter(look.trim);
            if (x % 3 === 1 && y > 1 && y < 6) return C('navy1');
            return s > 0.5 ? look.trim : darker(look.trim, s > 0.25 ? 1 : 2);
          },
        });
        dome(cv, { cu, cv: cvv, z0: z + 6, r: 0.28, h: 9, ramp: ZSOLNAY, ribs: 8, rib: C('ochre2') });
        billboard(cv, { u: cu, v: cvv, z: z + 15 }, FINIAL, gilt, 1);
      }
    }
    return;
  }
  // Corner cupola on the street corner of taller eclectic blocks.
  if (o.storeys >= 4 && w >= 2 && d >= 2 && o.roof !== 'mansard' && dice.chance(0.32)) {
    const cu = w - 0.3;
    const cvv = d - 0.3;
    const zr = o.roof === 'pitched' ? H + Math.round(rise * 0.35) : H;
    const drumTop = zr + 7;
    prism(cv, {
      cu,
      cv: cvv,
      z0: H - 3,
      z1: drumTop,
      r: 0.3,
      n: 8,
      tex: (s, x, y) => {
        const wall = s > 0.5 ? look.wall : darker(look.wall, s > 0.25 ? 1 : 2);
        if (y < 0) return look.trim;
        if (y === 0) return lighter(look.trim);
        if (y === 1) return darker(look.trim);
        if (x % 4 === 1 && y > 2 && y < 7) return y === 3 ? look.trim : C('navy1');
        return wall;
      },
    });
    const copper = look.variant === 'secession' || dice.chance(0.3);
    dome(cv, {
      cu,
      cv: cvv,
      z0: drumTop,
      r: 0.33,
      h: 10,
      ramp: look.variant === 'secession' ? ZSOLNAY : copper ? COPPER : SLATE,
      ribs: 8,
      rib: look.variant === 'secession' ? C('ochre2') : copper ? C('teal2') : C('gray3'),
      onion: look.variant === 'secession' ? 0.25 : 0,
    });
    billboard(cv, { u: cu, v: cvv, z: drumTop + 10 }, FINIAL, gilt, 1);
  }
  // Secession: curvy attic gable with a ceramic inlay on the street face.
  if (look.variant === 'secession' && o.roof !== 'mansard') {
    const side = o.street === 'right' ? 'right' : 'left';
    const len = (side === 'left' ? w : d) * 16;
    if (len >= 24) {
      const span = Math.min(26, len - 10);
      const s0 = Math.round((len - span) / 2);
      const wall = side === 'left' ? look.wall : darker(look.wall);
      const T = side === 'left' ? look.trim : darker(look.trim);
      const ceramic = [C('teal1'), C('ochre2'), C('teal2'), C('rust1')];
      gable(cv, {
        side,
        w,
        d,
        s0,
        s1: s0 + span,
        z0: H - 1,
        h: 11,
        profile: PROFILES.segment,
        tex: (x, y, edge) => {
          if (edge <= 0) return lighter(T);
          if (edge === 1) return T;
          if (y === 0) return darker(T);
          const cx = Math.abs(x - (span - 1) / 2);
          if (y >= 3 && y <= 6 && cx <= 3) return cx <= 1 && y >= 4 ? C('navy1') : T;
          if (y === 2) return ceramic[x % 4]!;
          return wall;
        },
      });
      const top = facePoint(side, w, d, s0 + span / 2, H + 10, 0.03);
      billboard(cv, top, FINIAL, gilt, 2);
    }
  }
}

// ----------------------------------------------------------------------------------- props --

const LION_KEYS = { T: 'gray6', t: 'gray5', S: 'gray4', s: 'gray3', W: 'gray7', k: 'ink' };

export const budapest: EnvCity = {
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
      tones: [C('gray5'), C('gray5'), C('gray4'), C('gray5'), C('stone2')],
      joint: C('gray3'),
      grid: { rows: 2, cols: 2, stagger: 0.5 },
    },
    cobble: {
      tones: [C('gray4'), C('gray4'), C('zinc2'), C('gray3'), C('gray5')],
      joint: C('gray2'),
      grid: { rows: 4, cols: 4, stagger: 0.5 },
    },
    plaza: {
      tones: [C('gray6'), C('stone3'), C('gray6')],
      border: C('stone2'),
      joint: C('gray4'),
    },
    grass: { base: 'grass', stripes: false, dry: 0.2 },
    gravel: { base: C('stone3'), dark: C('stone2'), light: C('stone4') },
    water: {
      deep: C('zinc0'),
      base: C('zinc1'),
      ripple: C('teal1'),
      hi: C('zinc2'),
      spark: C('zinc4'),
    },
    quayLit: C('gray5'),
    quayShade: C('gray4'),
    quayJoint: C('gray2'),
    rail: { top: C('gray6'), lit: C('gray5'), shade: C('gray4'), dark: C('gray2') },
    lot: C('gray4'),
    leaves: true,
    ironRail: false,
    tram: { at: [0.3, 0.7], rail: C('gray5'), railHi: C('gray7'), groove: C('gray1') },
  },

  awnings: [
    ['crim1', 'white'],
    ['green1', 'white'],
    ['navy1', 'stone4'],
    ['rust1', 'ochre2'],
    ['green2', 'green3'],
  ],
  look(kind, d) {
    const civic = kind === 'civic';
    const variant = civic
      ? 'civic'
      : d.weighted<string>([
          ['eclectic', 7],
          ['soot', 2],
          ['secession', 2],
        ]);
    const wallName = {
      civic: d.pick(['stone3', 'stone4', 'gray6', 'stone4']),
      eclectic: d.weighted<string>([
        ['ochre2', 5],
        ['ochre3', 2],
        ['stone4', 3],
        ['stone3', 3],
        ['earth5', 2],
        ['earth6', 2],
        ['gray6', 2],
        ['earth4', 1],
      ]),
      soot: d.pick(['gray5', 'stone2', 'gray4', 'stone2']),
      secession: d.pick(['stone5', 'white', 'stone4', 'ochre3']),
    }[variant]!;
    const pale = ['stone4', 'stone5', 'white', 'earth6', 'ochre3', 'gray6'].includes(wallName);
    const slope = civic
      ? d.weighted<Look['slope']>([
          ['terracotta', 6],
          ['slate', 2],
          ['zinc', 1],
        ])
      : d.weighted<Look['slope']>([
          ['slate', 6],
          ['zinc', 4],
          ['terracotta', variant === 'secession' ? 3 : 0.4],
        ]);
    const ground = civic
      ? C('stone2')
      : variant === 'soot'
        ? darker(C(wallName))
        : d.chance(0.6)
          ? darker(C(wallName))
          : C(d.pick(['stone2', 'gray5', 'stone3']));
    return {
      mat: civic ? 'ashlar' : 'stucco',
      wall: C(wallName),
      groundMat: civic ? 'ashlar' : 'smooth',
      ground,
      trim:
        variant === 'soot'
          ? C(d.pick(['gray6', 'stone3']))
          : pale
            ? C(d.pick(['white', 'stone5', 'gray7']))
            : C(d.pick(['stone5', 'stone4', 'white'])),
      frame: C(d.pick(['earth2', 'white', 'earth2', 'gray5', 'earth3', 'white'])),
      shutter: C(d.pick(['gray5', 'earth3', 'gray4'])),
      iron: C('gray1'),
      ironHi: C('gray3'),
      door: C(d.pick(['earth1', 'earth2', 'green1', 'gray1', 'earth2'])),
      slope,
      flat: C('gray4'),
      quoins: variant === 'eclectic' && d.chance(0.25),
      variant,
    };
  },

  facade: {
    floor(k, upper, _roof, kind, d) {
      const fromGround = upper - k; // 1 = first floor
      if (k === 0 && upper >= 4 && d.chance(0.35)) return 'small';
      if (kind === 'civic') return fromGround === 1 ? 'tall' : 'plain';
      if (fromGround === 1) return d.chance(0.55) ? 'balcony' : 'tall';
      return d.chance(kind === 'commercial' ? 0.12 : 0.28) ? 'balcony' : 'plain';
    },
    upperBay({ f, look, type, x0, y0, res, glow, glowHi, d }) {
      const sec = look.variant === 'secession';
      const r0 = sec ? budaRes(res) : res;
      if (type === 'small') {
        stampModule(f, G.BUD_WIN_SMALL, x0, y0, r0, glow, glowHi);
        return;
      }
      if (type === 'balcony') {
        stampModule(f, G.BUD_BALDOOR, x0, y0, r0, glow, glowHi);
        const r = d.next();
        if (r < 0.06) stampModule(f, M.PEEK, x0, y0, res);
        stampModule(f, G.BUD_BALCONY, x0, y0, res);
        const o = d.next();
        if (o < 0.1) stampModule(f, M.FLOWERS, x0, y0, res);
        else if (o < 0.13) stampModule(f, M.LAUNDRY, x0, y0, res);
        else if (o < 0.15) stampModule(f, M.BANNER_NO, x0, y0, res);
        else if (o < 0.17) stampModule(f, G.BUD_FLAG, x0, y0, flagRes(res));
        return;
      }
      if (sec) {
        stampModule(f, G.BUD_SEC_WIN, x0, y0, r0, glow, glowHi);
        if (type === 'tall' || d.chance(0.25)) stampModule(f, G.BUD_SEC_TILES, x0, y0 - 1, r0);
      } else if (type === 'tall') {
        stampModule(f, (x0 >> 1) % 2 === 0 ? G.BUD_WIN_PED : G.BUD_WIN_SEG, x0, y0, res, glow, glowHi);
      } else stampModule(f, G.BUD_WIN, x0, y0, res, glow, glowHi);
      const r = d.next();
      if (r < 0.05) stampModule(f, M.PEEK, x0, y0, res);
      else if (r < 0.1) stampModule(f, M.FLOWERS, x0, y0 + 3, res);
      if (d.chance(0.03)) stampModule(f, M.SAT_DISH, x0, y0, res);
    },
    door: G.BUD_GATE,
    shop: (d) => d.weighted<string>([
      [G.BUD_SHOP, 4],
      [G.BUD_SHOP_AWN, 3],
      [G.BUD_BAR, 2],
    ]),
    groundBay({ f, look, x0, y0, res, d, commercial, civic }) {
      if (civic) {
        stampModule(f, G.BUD_GRILLE, x0, y0, res, d.chance(0.3) ? GLOW : 0, GLOW_HI);
        return;
      }
      if (commercial && d.chance(0.5)) {
        stampModule(f, G.BUD_ROLLER, x0, y0, res);
        if (d.chance(0.5)) stampModule(f, G.BUD_POSTERS, x0, y0, res);
        if (d.chance(0.5)) tag(f, x0 + 1, y0 + 3, d);
        return;
      }
      stampModule(f, G.BUD_GRILLE, x0, y0, res, d.chance(0.3) ? GLOW : 0, GLOW_HI);
      if (look.variant !== 'secession' && d.chance(0.18)) stampModule(f, G.BUD_POSTERS, x0, y0, res);
    },
    shopChance: 0.35,
    pipe: 'gray3',
    rusticateSmooth: true,
    doubleStringCourse: true,
    eavesTrim: true,
    dentilParapet: true,
    tagChance: 0.4,
  },

  roofs: {
    terraceTiles: ['gray3', 'gray5', 'gray4'],
    pitchedChimneys: 'random',
    dormer: true,
    mansardStacks: ['gray5', 'gray6'],
    clutter: false,
    slopeTex,
    ornament: { headroom: 10, paint: ornament },
  },

  props: {
    lamp: { grid: G.LAMP_BUDAPEST, keys: { M: 'gray2', m: 'gray1', A: 'ochre1' } },
    metal: ['gray2', 'gray1'],
    bench: { frame: 'gray1', wood: 'earth3' },
    kiosk: { body: 'green1', roof: 'gray2', top: { sign: 'crim1' } },
    bin: { grid: P.BIN, keys: { B: 'gray3', b: 'gray2', A: 'ochre2', d: 'ink', m: 'gray1' } },
    bollard: { grid: G.BOLLARD_BUDAPEST, keys: { M: 'gray2', m: 'gray1', A: 'gray4' } },
    hydrant: { M: 'crim2', m: 'crim1', A: 'gray4' },
    metro: { grid: G.METRO_BUDAPEST, shadow: 3 },
    busStop: { frame: 'gray2', roof: 'zinc3', flag: 'blue1' },
    planter: 'gray5',
    cafe: {
      chair: 'earth3',
      table: 'white',
      umbrellas: [
        ['crim1', 'white'],
        ['green2', 'white'],
        ['ochre2', 'white'],
      ],
    },
    // Hungary: red / white / green.
    flag: (_x, y, _W, H) => (y < H / 3 ? C('crim2') : y < (2 * H) / 3 ? C('white') : C('green2')),
    bike: { colours: ['lime'], basket: true, scooters: false },
    extra: {
      'statue.lion': (k) => k.gridProp(G.LION_BUDAPEST, LION_KEYS, { shadow: 6 }),
      'statue.0': (k) => k.gridProp(G.STATUE_BUDAPEST, { q: 'teal1', Q: 'teal2' }, { shadow: 5 }),
      'statue.1': (k) =>
        k.gridProp(G.STATUE_BUDAPEST, { q: 'gray3', Q: 'gray5', T: 'gray6', t: 'gray5' }, { shadow: 5 }),
      'statue.equestrian': (k) =>
        k.gridProp(G.EQUESTRIAN_BUDAPEST, { q: 'teal1', Q: 'teal2', T: 'gray6', t: 'gray5', S: 'gray4', s: 'gray3', W: 'gray7' }, { shadow: 8 }),
    },
  },

  preview: {
    blds: [
      [0, 0, 3, 4, 5, 'pitched', 'residential'],
      [3, 0, 2, 4, 4, 'flat', 'commercial'],
      [5, 0, 2, 4, 5, 'pitched', 'commercial'],
      [14, 0, 2, 4, 5, 'pitched', 'civic'],
    ],
    park: ['tree.chestnut', 'tree.plane'],
    street: 'tree.plane',
    seed: 1100,
    icons: [
      ['kiosk', 13, 12],
      ['metro', 13, 5, 0.3, 0.7],
      ['flag', 7, 14],
      ['statue.lion', 1, 16, 0.5, 0.2],
    ],
  },

  sampleRoof: 'pitched',
  decals: {
    tag: 'nem',
    tagGrid: `
#..#.####.#...#
##.#.#....##.##
#.##.###..#.#.#
#..#.#....#...#
#..#.####.#...#
`,
    puddles: false,
  },
  cars: [
    'hatch_white',
    'hatch_white',
    'hatch_silver',
    'hatch',
    'sedan',
    'hatch_blue',
    'delivery_van',
    'sedan_black',
  ],
  minimapRoof: 'gray3',
  postcardSky: ['sky', 'ochre4'],
  mapTint: [196, 160, 112],
  protest: { item: 'phone', wokeChance: 0 },
};
