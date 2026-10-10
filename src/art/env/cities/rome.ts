/**
 * ROME — environment style (E3 South). Centro storico palazzi in ochre, burnt sienna, terracotta
 * and Pompeian red with peeling plaster, travertine frames and cornicioni, green persiane, coppi
 * roofs and roof terraces full of plants; dark basalt sampietrini laid in diagonals and fans,
 * travertine kerbs and Tiber quays, pastorale lamps, nasoni, the red Metro "M", Vespas, Fiat 500s
 * and Smarts parked nose to tail.
 */
import type { RGBA } from '../../palette';
import { C, darker, lighter } from '../color';
import { GLOW, GLOW_HI, flagRes, tag } from '../bld/kit';
import { K_GLASS, K_WALL, stampModule, type Face } from '../bld/face';
import { CORNICE, STOREY } from '../bld/facade';
import * as M from '../bld/modules.grid';
import type { GroundFill } from '../ground';
import type { PropKit, PropSprite } from '../props';
import type { IsoCanvas } from '../raster';
import type { EnvCity, OrnamentCtx, SlopeTex } from '../style';
import { Dice, hash } from '../util';
import * as G from './rome.grid';

// ------------------------------------------------------------------------- shared helpers --
// (also used by milan.ts / barcelona.ts)

/** Tile-local (u, v) of a pixel of the 32×16 diamond (as ground.ts). */
export function uvAt(x: number, y: number): [number, number] {
  const a = (x + 0.5 - 16) / 32;
  const b = (y + 0.5) / 16;
  return [b + a, b - a];
}

const inTile = (x: number, y: number): boolean => {
  const [u, v] = uvAt(x, y);
  return u >= 0 && v >= 0 && u < 1 && v < 1;
};

/**
 * Small setts in a screen-aligned running bond (cells `cw`×2 px, rows staggered by half a cell):
 * on the iso ground this reads as setts laid diagonally to the street. Cells that cross the
 * tile edge take a tile-periodic tone so neighbours join; inner cells vary per variant seed.
 */
export function settFill(
  tones: readonly RGBA[],
  joint: RGBA,
  hi: (c: RGBA) => RGBA = lighter,
  cw = 4,
): GroundFill {
  const per = 32 / cw;
  return (x, y, _u, _v, seed) => {
    const row = y >> 1;
    const xs = x + (row & 1) * (cw >> 1);
    const cx = Math.floor(xs / cw);
    const lx = xs - cx * cw;
    const ly = y & 1;
    if (lx === cw - 1) return joint;
    const x0 = cx * cw - (row & 1) * (cw >> 1);
    const y0 = row * 2;
    const crosses = !inTile(x0, y0) || !inTile(x0 + cw - 2, y0 + 1);
    const key = crosses
      ? hash((((cx - row * (cw === 4 ? 1 : 2)) % per) + per) % per, row & 3, 0x5a)
      : hash(cx, row, seed);
    const base = tones[key % tones.length]!;
    if (ly === 0 && lx === 0) return hi(base);
    if (ly === 1 && lx === cw - 2) return darker(base);
    if (ly === 1 && lx === 0 && (key & 4) === 0) return joint;
    return base;
  };
}

/**
 * Fan ("a ventaglio") setts: 2×2 fans per tile, each a stack of arcs opening toward −v, with
 * radial joints. Tile-periodic by construction.
 */
export function fanFill(tones: readonly RGBA[], joint: RGBA, per = 1): GroundFill {
  return (_x, _y, u, v, seed) => {
    const s = (u * per) % 1;
    const t = (v * per) % 1;
    // Each fan's arcs are centred just beyond its −u/+v corner… the next fan's arcs overlap.
    const dx = s - 0.5;
    const dy = t - 1.0;
    const r = Math.hypot(dx * 1.1, dy);
    const ring = Math.floor(r * 4.2);
    const fr = r * 4.2 - ring;
    if (fr < 0.16) return joint;
    const ang = Math.atan2(dx, -dy);
    const n = 3 + ring * 3;
    const seg = Math.floor((ang + 2) * n * 0.5);
    const fa = (ang + 2) * n * 0.5 - seg;
    if (fa < 0.14) return joint;
    const tone = tones[hash(seg, ring, seed) % tones.length]!;
    if (fr > 0.8) return darker(tone);
    if (fr < 0.36 && fa < 0.55) return lighter(tone);
    return tone;
  };
}

/**
 * Piazza paving: guide strips of stone (`strip`, lit `stripHi`) along each tile's far edges —
 * thin lines that grid the square every tile — with the `inner` pattern between them.
 */
export function framedFill(
  inner: GroundFill,
  strip: RGBA,
  stripHi: RGBA,
  joint: RGBA,
  width = 0.045,
): GroundFill {
  return (x, y, u, v, seed) => {
    if (u < width) return stripHi;
    if (v < width) return strip;
    if (u < width + 0.035 || v < width + 0.035) return joint;
    return inner(x, y, u, v, seed);
  };
}

/** Exposed brick where the plaster has peeled (K_WALL pixels only, ragged edge). */
export function peel(
  f: Face,
  x0: number,
  y0: number,
  w: number,
  h: number,
  wall: RGBA,
  brick: RGBA,
  d: Dice,
): void {
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  const ph = d.next() * 6;
  for (let y = y0 - 1; y <= y0 + h; y++) {
    for (let x = x0 - 1; x <= x0 + w; x++) {
      if (f.kindAt(x, y) !== K_WALL || !f.in(x, y)) continue;
      const nx = (x - cx) / (w / 2);
      const ny = (y - cy) / (h / 2);
      const wob = 0.18 * Math.sin(x * 1.7 + ph) + 0.14 * Math.cos(y * 2.3 + ph);
      const r = nx * nx + ny * ny + wob;
      if (r > 1.25) continue;
      if (r > 0.85) {
        // Plaster lip: lit on top, shadow at the bottom of the hole.
        f.tint(x, y, y < cy ? lighter(wall) : darker(wall));
        continue;
      }
      const course = y >> 1;
      const mortar = (y & 1) === 1 || ((x + (course & 1) * 2) & 3) === 0;
      f.tint(x, y, mortar ? darker(brick) : (hash(x >> 2, course, 3) & 3) === 0 ? lighter(brick) : brick);
    }
  }
}

/** Italian tricolore cloth (13×8 flag prop): green, white, red bands. */
export const TRICOLORE = (x: number, _y: number, W: number): RGBA =>
  x < W / 3 ? C('green2') : x < (2 * W) / 3 ? C('white') : C('crim2');

/** A pot with a leafy clump (roof terraces, balconies): `top` px above `z`. */
export function pottedPlant(
  cv: IsoCanvas,
  u: number,
  v: number,
  z: number,
  pot: RGBA,
  leaves: readonly RGBA[],
  big: boolean,
  flower?: RGBA,
): void {
  const s = big ? 0.1 : 0.07;
  cv.box(u - s, v - s, z, u + s, v + s, z + (big ? 3 : 2), {
    top: () => darker(pot, 2),
    left: () => pot,
    right: () => darker(pot),
  });
  const h = big ? 7 : 4;
  const r = big ? 0.16 : 0.1;
  for (let k = 0; k < (big ? 26 : 12); k++) {
    const a = k * 2.39996;
    const rr = r * Math.sqrt((k + 0.5) / (big ? 26 : 12));
    const du = Math.cos(a) * rr;
    const dv = Math.sin(a) * rr;
    const dz = (big ? 3 : 2) + 1 + ((h - 2) * (1 - rr / r)) + (k % 3) * 0.4;
    const lit = du - dv < 0;
    const c = leaves[Math.min(leaves.length - 1, Math.max(0, (lit ? 2 : 1) + (k % 4 === 0 ? 1 : 0) - (dz < 4 ? 1 : 0)))]!;
    cv.dot({ u: u + du, v: v + dv, z: z + dz }, flower && k % 7 === 3 ? flower : c, 0.8);
    cv.dot({ u: u + du + 0.03, v: v + dv, z: z + dz }, c, 0.8);
  }
}

const LEAVES = ['green0', 'green1', 'green2', 'green3', 'green4'].map((n) => C(n));

// ---------------------------------------------------------------------------- coppi roofs --

/** Coppi: rounded clay channels running down the slope, mottled and patched, lichen here and there. */
function coppi(_look: unknown, rise: number): SlopeTex {
  const shadeBy = (c: RGBA, l: number): RGBA => (l > 0 ? lighter(c) : l < 0 ? darker(c) : c);
  return (a, b, l) => {
    const ai = Math.floor(a);
    const bi = Math.floor(b);
    if (bi <= 0) return darker(C('rust1'));
    if (bi >= rise - 1) return shadeBy(C('rust3'), l);
    const lane = Math.floor(ai / 4);
    const ch = ((ai % 4) + 4) % 4;
    // Courses wobble a pixel per lane so rows never line up like a grid.
    const off = hash(lane, 7) % 3;
    const course = Math.floor((bi + off) / 3);
    const h = hash(lane, course, 0xc0);
    const patch = h % 11;
    const base =
      patch < 5 ? C('rust2') : patch < 8 ? C('rust3') : patch < 10 ? C('earth4') : C('rust1');
    let c: RGBA;
    if (ch === 0) c = lighter(base); // crown of the cover tile
    else if (ch === 1) c = base;
    else if (ch === 2) c = darker(base);
    else c = C('earth1'); // channel between the rows
    if ((bi + off) % 3 === 0 && ch !== 3) c = darker(c); // lip of the tile above
    if (ch !== 3 && hash(ai, bi, 0x11c) % 71 === 0) c = C('olive1'); // lichen
    if (ch === 3 && hash(ai, bi, 0x11d) % 23 === 0) c = C('olive1'); // moss in the gutter
    return shadeBy(c, l);
  };
}

// --------------------------------------------------------------------------- roof gardens --

/** Roman roof terraces: pots and lemon trees along the parapets, a vine pergola, umbrellas. */
function romeRoofs(o: OrnamentCtx): void {
  const { cv, d: dd, w, roof, dice } = o;
  if (roof !== 'terrace' && roof !== 'flat') return;
  if (roof === 'flat' && !dice.chance(0.35)) return;
  const z = o.H - 3;
  const pot = C('rust3');
  // Pots along the two near parapets (the ones the camera looks over).
  const nFront = Math.max(1, Math.floor(w * 1.6));
  for (let k = 0; k < nFront; k++) {
    if (!dice.chance(0.62)) continue;
    const u = 0.25 + ((k + dice.next() * 0.4) * (w - 0.5)) / nFront;
    const fl = dice.chance(0.35) ? C(dice.pick(['crim2', 'pink2', 'white', 'rust4'])) : undefined;
    pottedPlant(cv, u, dd - 0.22, z, pot, LEAVES, dice.chance(0.3), fl);
  }
  const nSide = Math.max(1, Math.floor(dd * 1.2));
  for (let k = 0; k < nSide; k++) {
    if (!dice.chance(0.5)) continue;
    const v = 0.25 + ((k + dice.next() * 0.4) * (dd - 0.5)) / nSide;
    pottedPlant(cv, w - 0.22, v, z, pot, LEAVES, dice.chance(0.3));
  }
  // A lemon tree in a big pot (ochre fruit).
  if (dice.chance(0.5)) {
    const u = 0.3 + dice.next() * Math.max(0.1, w - 0.7);
    pottedPlant(cv, u, 0.32, z, C('stone4'), LEAVES, true, C('ochre3'));
  }
  // Vine pergola over a corner of the terrace.
  if (roof === 'terrace' && w >= 2 && dd >= 2 && dice.chance(0.55)) {
    const u0 = 0.25;
    const v0 = dd - 1.15;
    const u1 = Math.min(w - 0.3, u0 + 0.9);
    const v1 = dd - 0.3;
    const wood = C('earth2');
    for (const [pu, pv] of [
      [u0, v0],
      [u1, v0],
      [u0, v1],
      [u1, v1],
    ] as const)
      cv.pole({ u: pu, v: pv, z }, 9, wood, 0.7);
    for (let s = 0; s <= 1; s += 0.04) {
      cv.dot({ u: u0 + (u1 - u0) * s, v: v1, z: z + 9 }, wood, 0.7);
      cv.dot({ u: u0 + (u1 - u0) * s, v: v0, z: z + 9 }, darker(wood), 0.7);
    }
    // Vine canopy: dense leaves on top, a few hanging strands.
    for (let k = 0; k < 90; k++) {
      const su = dice.next();
      const sv = dice.next();
      const c = LEAVES[1 + Math.floor(dice.next() * 3) + (su - sv > 0.2 ? 0 : 1) - 1]!;
      cv.dot({ u: u0 + (u1 - u0) * su, v: v0 + (v1 - v0) * sv, z: z + 9 + (k % 3 === 0 ? 1 : 0) }, c, 0.9);
    }
    for (let k = 0; k < 4; k++) {
      const su = dice.next();
      for (let q = 1; q < 4; q++)
        cv.dot({ u: u0 + (u1 - u0) * su, v: v1, z: z + 9 - q }, LEAVES[2]!, 0.95);
    }
  } else if (roof === 'terrace' && dice.chance(0.4)) {
    // Big cream parasol over a little table.
    const u = 0.5 + dice.next() * Math.max(0.1, w - 1);
    const v = 0.5 + dice.next() * Math.max(0.1, dd - 1);
    cv.pole({ u, v, z }, 9, C('gray6'), 0.7);
    for (let k = 0; k < 60; k++) {
      const a = (k / 60) * Math.PI * 2;
      for (let r = 0.05; r <= 0.3; r += 0.06) {
        const lit = Math.cos(a - Math.PI * 0.75) > 0;
        cv.dot(
          { u: u + Math.cos(a) * r, v: v + Math.sin(a) * r, z: z + 10 - r * 6 },
          lit ? C('stone5') : C('stone4'),
          0.8,
        );
      }
    }
  }
}

// ------------------------------------------------------------------------------ props --

function nasone(k: PropKit): PropSprite {
  return k.gridProp(G.NASONE, { M: 'gray2', m: 'gray1', A: 'stone4', U: 'sky' }, { shadow: 3 });
}

/** Piazza fountain: travertine basin, a shell bowl and a jet. */
function fountain(k: PropKit): PropSprite {
  return k.isoProp(
    22,
    (cv) => {
      const st = C('stone4');
      cv.box(0.12, 0.12, 0, 0.88, 0.88, 4, {
        top: (u, v) => {
          const e = Math.min(u - 0.12, v - 0.12, 0.88 - u, 0.88 - v);
          if (e < 0.07) return lighter(st);
          const rip = Math.floor((u + v) * 12) % 5 === 0;
          return rip ? C('sky') : e < 0.12 ? C('teal1') : C('teal2');
        },
        left: (_u, _v, z) => (Math.floor(z) === 3 ? lighter(st) : st),
        right: (_u, _v, z) => (Math.floor(z) === 3 ? st : darker(st)),
      });
      cv.box(0.44, 0.44, 4, 0.56, 0.56, 11, {
        top: () => st,
        left: () => st,
        right: () => darker(st),
      });
      cv.box(0.34, 0.34, 11, 0.66, 0.66, 13, {
        top: () => C('teal2'),
        left: () => lighter(st),
        right: () => st,
      });
      for (let z = 13; z < 20; z++) cv.dot({ u: 0.5, v: 0.5, z }, z > 17 ? C('white') : C('sky'));
      for (const [du, dv] of [
        [-0.12, 0],
        [0.12, 0],
        [0, -0.12],
        [0, 0.12],
      ] as const)
        for (let q = 0; q < 6; q++)
          cv.dot({ u: 0.5 + du * (1 + q * 0.25), v: 0.5 + dv * (1 + q * 0.25), z: 12 - q * 1.4 }, C('sky'));
    },
    { shadow: 0 },
  );
}

/** Colonna di Marco Aurelio: column with a spiral relief band on a pedestal, statue on top. */
function column(k: PropKit): PropSprite {
  const rows: string[] = [];
  // Statue of St Paul on a drum, Doric capital.
  rows.push('....kk....', '...eEEe...', '....EE....', '...eEEe...', '....EE....');
  rows.push('...UTTt...', '..UUTTtt..', '.UUUUTTtt.', '.tttttttt.');
  // Shaft: a relief band spirals up it (lit left, shaded right).
  for (let y = 0; y < 40; y++) {
    let r = '..';
    for (let x = 0; x < 6; x++) {
      const band = (((x + Math.floor(y / 2)) % 5) + 5) % 5 === 0;
      const lit = x < 2 ? 'U' : x < 4 ? 'T' : 't';
      r += band ? (x < 3 ? 's' : 'S') : lit;
    }
    rows.push(r + '..');
  }
  rows.push('.UUUTTtt.', 'UUTTTTttt', 'UTsssssst', 'UTsTTTTst', 'UTsTTTTst', 'UTsssssst', 'UUTTTTttt', 'UUUUTTttt');
  return k.gridProp(
    rows.join('\n'),
    { U: 'stone5', T: 'stone4', t: 'stone3', s: 'stone2', S: 'stone1', e: 'earth3', E: 'earth4' },
    { shadow: 5 },
  );
}

// ------------------------------------------------------------------------------- the city --

const BASALT = [C('gray3'), C('gray3'), C('gray4'), C('stone1'), C('gray3')];
const BASALT_LIGHT = [C('gray4'), C('gray4'), C('gray5'), C('stone1'), C('gray4')];
const TRAVERTINE = C('stone4');

export const rome: EnvCity = {
  ground: {
    asphalt: C('gray3'),
    asphaltSpeck: [C('gray2'), C('stone1')],
    paint: C('white'),
    paintWorn: C('gray6'),
    yellowLines: false,
    kerbTop: C('stone4'),
    kerbLit: C('stone3'),
    kerbShade: C('stone1'),
    side: {
      tones: [C('gray4'), C('gray4'), C('gray5'), C('gray4'), C('stone1')],
      joint: C('gray2'),
      grid: { rows: 4, cols: 6, stagger: 0.5 },
    },
    cobble: {
      tones: [C('gray3'), C('gray3'), C('gray2'), C('gray4'), C('stone1')],
      joint: C('gray1'),
      grid: { rows: 6, cols: 6, stagger: 0.5 },
    },
    plaza: {
      tones: [C('gray4'), C('gray4'), C('gray5')],
      border: TRAVERTINE,
      joint: C('gray2'),
    },
    grass: { base: 'grass', stripes: false, dry: 0.55 },
    gravel: { base: C('earth5'), dark: C('earth4'), light: C('earth6') },
    water: {
      deep: C('green0'),
      base: C('green1'),
      ripple: C('green0'),
      hi: C('teal1'),
      spark: C('olive2'),
    },
    quayLit: C('stone4'),
    quayShade: C('stone3'),
    quayJoint: C('stone2'),
    rail: { top: C('stone5'), lit: C('stone4'), shade: C('stone3'), dark: C('stone2') },
    lot: C('stone2'),
    leaves: true,
    ironRail: false,
    fills: {
      sidewalk: settFill(BASALT_LIGHT, C('gray2')),
      cobble: fanFill(BASALT, C('gray1')),
      plaza: framedFill(settFill(BASALT_LIGHT, C('gray2')), C('stone3'), TRAVERTINE, C('gray2')),
    },
  },

  awnings: [
    ['green1', 'green2'],
    ['rust0', 'rust1'],
    ['stone4', 'stone5'],
    ['crim1', 'rust0'],
    ['navy1', 'navy2'],
    ['ochre1', 'ochre2'],
  ],
  look(kind, d, site) {
    const civic = kind === 'civic';
    // Prati / Esquilino: big late-19th-century Umbertine blocks, paler and more regular.
    const umbertino = !civic && (site?.storeys ?? 4) >= 5 && d.chance(0.7);
    const wallName = civic
      ? d.pick(['stone4', 'stone4', 'ochre2', 'earth5'])
      : umbertino
        ? d.weighted<string>([
            ['ochre2', 4],
            ['earth5', 3],
            ['stone3', 2],
            ['earth6', 2],
            ['rust3', 1],
          ])
        : d.weighted<string>([
            ['ochre1', 5],
            ['rust3', 4],
            ['earth4', 4],
            ['rust2', 3],
            ['ochre2', 3],
            ['earth5', 2],
            ['rust1', 1],
          ]);
    const travertineBase = civic || umbertino || d.chance(0.45);
    return {
      mat: civic ? 'ashlar' : 'stucco',
      wall: C(wallName),
      groundMat: travertineBase ? 'ashlar' : 'smooth',
      ground: travertineBase ? C(d.pick(['stone3', 'stone4'])) : darker(C(wallName)),
      trim: C(d.pick(['stone4', 'stone4', 'stone5', 'stone3'])),
      frame: C(d.pick(['white', 'earth2', 'stone5'])),
      shutter: C(d.weighted<string>([
        ['green2', 6],
        ['green1', 3],
        ['green3', 1],
        ['earth2', 1],
      ])),
      iron: C('ink'),
      ironHi: C('gray2'),
      door: C(d.pick(['earth1', 'earth2', 'earth1', 'green1'])),
      slope: 'terracotta',
      flat: C('stone3'),
      quoins: !civic && d.chance(umbertino ? 0.5 : 0.3),
      variant: `${umbertino ? 'umbertino' : 'palazzo'}${d.chance(0.5) ? '+strings' : ''}${d.chance(0.5) ? '+peel' : ''}`,
    };
  },

  facade: {
    floor(k, upper, _roof, kind, d) {
      const fromGround = upper - k;
      if (kind === 'civic') return fromGround === 1 ? 'tall' : 'plain';
      if (k === 0 && upper >= 3 && d.chance(0.55)) return 'small';
      if (fromGround === 1 && upper >= 2 && d.chance(0.7)) return 'tall';
      return d.chance(0.12) ? 'balcony' : 'plain';
    },
    upperBay({ f, look, type, x0, y0, res, glow, glowHi, d }) {
      if (type === 'small') {
        stampModule(f, G.ROM_WIN_SMALL, x0, y0, res, glow, glowHi);
        if (d.chance(0.3)) stampModule(f, G.ROM_SHUT_CLOSED, x0, y0 - 1, res);
        return;
      }
      const tall = type === 'tall';
      stampModule(
        f,
        tall ? (d.chance(0.6) ? G.ROM_WIN_PED : G.ROM_WIN_SEG) : G.ROM_WIN,
        x0,
        y0,
        res,
        glow,
        glowHi,
      );
      // Persiane: mostly folded open, often shut against the sun, sometimes half.
      const r = d.next();
      if (tall) {
        if (r < 0.55) stampModule(f, G.ROM_SHUT_OPEN_TALL, x0, y0, res);
        else if (r < 0.8) stampModule(f, G.ROM_SHUT_CLOSED_TALL, x0, y0, res);
      } else if (r < 0.5) stampModule(f, G.ROM_SHUT_OPEN, x0, y0, res);
      else if (r < 0.75) stampModule(f, G.ROM_SHUT_CLOSED, x0, y0, res);
      else if (r < 0.85) stampModule(f, G.ROM_SHUT_HALF, x0, y0, res);
      else if (r < 0.88) stampModule(f, M.PEEK, x0, y0, res);
      const o = d.next();
      if (tall && o < 0.3) {
        stampModule(f, d.chance(0.5) ? G.ROM_BALUSTRADE : G.ROM_RAIL, x0, y0, res);
        if (d.chance(0.35)) stampModule(f, M.FLOWERS, x0, y0, res);
      } else if (type === 'balcony') {
        stampModule(f, G.ROM_RAIL, x0, y0, res);
        if (d.chance(0.3)) stampModule(f, M.LAUNDRY, x0, y0, res);
      } else if (o < 0.12) stampModule(f, G.ROM_GERANIUMS, x0, y0 + 2, res);
      else if (o < 0.155) stampModule(f, G.ROM_WASHING, x0, y0, res);
      else if (o < 0.165) stampModule(f, M.BANNER_NO, x0, y0, res);
      else if (o < 0.18)
        stampModule(f, M.BALCONY_FLAG, x0, y0, flagRes(res, C('green2'), C('white')));
      if (!tall && d.chance(0.06)) stampModule(f, M.AC_UNIT, x0, y0, res);
      if (d.chance(0.03)) stampModule(f, M.SAT_DISH, x0, y0, res);
      void look;
    },
    door: G.ROM_PORTONE,
    shop: (d) => (d.chance(0.45) ? G.ROM_BAR : G.ROM_BOTTEGA),
    groundBay({ f, x0, y0, res, d, commercial }) {
      if (commercial || d.chance(0.3)) {
        stampModule(f, G.ROM_SERRANDA, x0, y0, res);
        // Shutters are where Rome's taggers work.
        if (d.chance(0.8)) tag(f, x0 + 1, y0 + 2 + d.int(0, 3), d);
        if (d.chance(0.4)) tag(f, x0 + 2, y0 + 5, d);
      } else stampModule(f, G.ROM_GRATA, x0, y0, res, d.chance(0.3) ? GLOW : 0, GLOW_HI);
    },
    shopChance: 0.35,
    pipe: 'earth2',
    rusticateSmooth: false,
    doubleStringCourse: false,
    eavesTrim: false,
    dentilParapet: false,
    tagChance: 0.55,
    finish({ f, look, plan, d }) {
      const len = f.w;
      const T = look.trim;
      const groundTop = plan.H - STOREY;
      // Marcapiano: a travertine string course at every floor.
      if (look.variant?.includes('strings')) {
        for (let k = 1; k < plan.storeys - 1; k++) {
          const y = CORNICE + k * STOREY - 1;
          for (let x = 0; x < len; x++)
            if (f.kindAt(x, y) === K_WALL) f.set(x, y, x % 7 === 0 ? darker(T) : T);
        }
      }
      // Cornicione: a deep travertine cornice with modillions under the roof.
      if (plan.roof === 'pitched') {
        for (let x = 0; x < len; x++) {
          f.set(x, 1, x % 3 === 0 ? darker(T, 2) : lighter(T));
          f.set(x, 2, x % 3 === 0 ? darker(T) : T);
          if (f.kindAt(x, 3) === K_WALL) f.tint(x, 3, darker(look.wall));
        }
      } else {
        for (let x = 0; x < len; x++) {
          if (f.kindAt(x, 3) === K_WALL) f.set(x, 3, x % 2 === 0 ? darker(T) : T);
        }
      }
      // Peeling plaster: brick showing through, worst near the street.
      if (look.variant?.includes('peel') && look.mat === 'stucco') {
        const n = d.int(1, 3);
        const brick = C(d.pick(['rust1', 'earth3', 'rust2']));
        for (let k = 0; k < n; k++) {
          const w = d.int(3, 7);
          const h = d.int(2, 5);
          const x = d.int(0, Math.max(0, len - w));
          const low = d.chance(0.6);
          const y = low
            ? groundTop - h - d.int(1, 4)
            : d.int(CORNICE + 2, Math.max(CORNICE + 2, groundTop - h - 2));
          peel(f, x, y, w, h, look.wall, brick, d);
        }
      }
      // Lit windows keep their glow.
      void K_GLASS;
    },
  },

  roofs: {
    // Terrace floor: cotto tiles.
    terraceTiles: ['earth2', 'earth4', 'rust2'],
    pitchedChimneys: 'random',
    dormer: false,
    mansardStacks: ['stone3', 'stone4'],
    clutter: true,
    slopeTex: coppi,
    ornament: { headroom: 0, paint: romeRoofs },
  },

  props: {
    lamp: { grid: G.LAMP_ROME, keys: { M: 'gray2', m: 'gray1', A: 'stone4' } },
    metal: ['gray2', 'gray1'],
    bench: { frame: 'green1', wood: 'earth3' },
    kiosk: { body: 'green1', roof: 'green0', top: { sign: 'crim1' } },
    bin: {
      grid: G.BIN_ROME,
      keys: { B: 'gray4', b: 'gray3', A: 'green2', d: 'ink', m: 'gray2' },
    },
    bollard: { grid: G.BOLLARD_ROME, keys: { M: 'gray2', m: 'gray1', A: 'stone4' } },
    hydrant: { M: 'gray2', m: 'gray1', A: 'stone4' },
    metro: { grid: G.METRO_ROME, shadow: 3 },
    busStop: { frame: 'gray2', roof: 'gray4', flag: 'crim1' },
    planter: 'stone4',
    cafe: {
      chair: 'earth3',
      table: 'white',
      umbrellas: [
        ['stone5', 'stone4'],
        ['white', 'crim1'],
        ['stone5', 'green2'],
      ],
    },
    flag: (x, _y, W) => TRICOLORE(x, _y, W),
    bike: { colours: ['gray6', 'earth4'], basket: true, scooters: true },
    extra: {
      'hydrant.0': nasone,
      nasone,
      fountain,
      'column.gilded': column,
    },
  },

  preview: {
    blds: [
      [0, 0, 3, 4, 4, 'terrace', 'residential'],
      [3, 0, 2, 4, 4, 'pitched', 'commercial'],
      [5, 0, 2, 4, 5, 'pitched', 'commercial'],
      [14, 0, 2, 4, 4, 'terrace', 'residential'],
    ],
    park: ['tree.pine', 'tree.plane'],
    street: 'tree.plane',
    seed: 1007,
    icons: [
      ['kiosk', 13, 12],
      ['metro', 13, 5, 0.3, 0.7],
      ['flag', 7, 14],
      ['nasone', 8, 13, 0.3, 0.3],
      ['fountain', 15, 5],
    ],
  },

  sampleRoof: 'pitched',
  decals: {
    tag: 'basta',
    tagGrid: `
###...#...##.###..#.
#..#.#.#.#....#..#.#
###..###..#...#..###
#..#.#.#...#..#..#.#
###..#.#.##...#..#.#
`,
    puddles: false,
  },
  cars: [
    'scooter',
    'scooter_red',
    'scooter',
    'hatch_white',
    'hatch_silver',
    'sedan_black',
    'delivery_van',
    'hatch_green',
  ],
  minimapRoof: 'rust3',
  postcardSky: ['sky', 'rust4'],
  mapTint: [196, 112, 66],
  protest: { item: 'umbrella', wokeChance: 0 },
};
