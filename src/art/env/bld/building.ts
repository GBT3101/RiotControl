/**
 * City building kits (M3a): `paintBuilding(spec)` assembles a building from hand-authored facade
 * modules and 3D roof parts with the z-buffered iso rasterizer.
 *
 * Output (all pixel-index anchors on the footprint's top vertex at ground level, like tiles):
 *   image        RGBA sprite (left face lit, right face shaded, roof lightest, coloured outline)
 *   lights       same-size night layer: lit windows / shopfronts (warm), transparent elsewhere
 *   shadow       cast shadow (shadow swatch @ SHADOW_ALPHA) to the lower right, own anchor
 *   roofTopY     px above ground of the standable roof surface (flat roof / ridge flat / mansard top)
 *   roofStand    standable rectangle in footprint-local tile coords (u along i, v along j)
 *   climbPoints  drainpipes where climbers go up (absolute tile coords, just outside the wall)
 * Deterministic in `spec` (seed); cached by a key of the fields that affect the art.
 */
import type { BuildingData, CityId, RoofType } from '../../../maps/contract';
import { SHADOW, SHADOW_ALPHA, resolveColor, type RGBA } from '../../palette';
import { createBuffer, setPixel, type PixelBuffer, type Point } from '../../lib/pixels';
import { C, darker, lighter } from '../color';
import { IsoCanvas, type Tex, type V3 } from '../raster';
import { envStyle, type SlopeTex } from '../style';
import { Dice, hash, outlineDarker } from '../util';
import type { Face } from './face';
import { BAY, CORNICE, STOREY, bayLayout, floorProgramme, paintFace } from './facade';
import { makeLook, type Look } from './looks';

export interface ClimbPoint {
  /** Absolute tile coords of the foot of the drainpipe (just outside the wall). */
  i: number;
  j: number;
  /** Wall the pipe is on: sw = +j face (left, lit), se = +i face (right), ne = −j, nw = −i. */
  face: 'sw' | 'se' | 'ne' | 'nw';
}

export interface BuildingArt {
  image: PixelBuffer;
  anchor: Point;
  lights: PixelBuffer;
  shadow: PixelBuffer;
  shadowAnchor: Point;
  roofTopY: number;
  roofStand: { u0: number; v0: number; u1: number; v1: number };
  climbPoints: ClimbPoint[];
  /** Highest point of the sprite above ground (px). */
  height: number;
}

type Spec = Pick<
  BuildingData,
  'w' | 'd' | 'storeys' | 'style' | 'kind' | 'roof' | 'rooftop' | 'seed'
> &
  Partial<Pick<BuildingData, 'i' | 'j' | 'doors' | 'id'>>;

const cache = new Map<string, BuildingArt>();

export function buildingKey(s: Spec): string {
  const doors = (s.doors ?? [])
    .map((p) => `${p.i - (s.i ?? 0)}:${p.j - (s.j ?? 0)}`)
    .sort()
    .join(';');
  return `${s.style}|${s.w}x${s.d}|${s.storeys}|${s.kind}|${s.roof}|${s.seed >>> 0}|${doors}`;
}

/** Paint (or fetch) a building. Climb points are re-based to the spec's (i, j). */
export function paintBuilding(spec: Spec): BuildingArt {
  const key = buildingKey(spec);
  let art = cache.get(key);
  if (!art) {
    art = paint(spec);
    cache.set(key, art);
  }
  const i0 = spec.i ?? 0;
  const j0 = spec.j ?? 0;
  return {
    ...art,
    climbPoints: art.climbPoints.map((c) => ({ ...c, i: c.i + i0, j: c.j + j0 })),
  };
}

export function clearBuildingCache(): void {
  cache.clear();
}

// ----------------------------------------------------------------------------- roof geometry --

interface RoofPlan {
  type: RoofType;
  /** Extra height above the wall top. */
  rise: number;
  /** Standable surface height above ground. */
  standZ: number;
  stand: { u0: number; v0: number; u1: number; v1: number };
}

function planRoof(spec: Spec, H: number): RoofPlan {
  const { w, d } = spec;
  switch (spec.roof) {
    case 'pitched': {
      const r = Math.min(1, Math.min(w, d) / 2);
      const rise = Math.round(r * 9) + 1;
      const ru = Math.min(r, w / 2);
      const rv = Math.min(r, d / 2);
      return {
        type: 'pitched',
        rise,
        standZ: H + rise,
        stand: { u0: ru, v0: rv, u1: w - ru, v1: d - rv },
      };
    }
    case 'mansard':
      return {
        type: 'mansard',
        rise: 10,
        standZ: H + 10,
        stand: { u0: 0.32, v0: 0.32, u1: w - 0.32, v1: d - 0.32 },
      };
    case 'terrace':
    case 'flat':
    default:
      return {
        type: spec.roof,
        rise: 0,
        standZ: H - 3,
        stand: { u0: 0.12, v0: 0.12, u1: w - 0.12, v1: d - 0.12 },
      };
  }
}

// -------------------------------------------------------------------------------- textures ---

function slopeTex(look: Look, rise: number): SlopeTex {
  const custom = envStyle(look.city).roofs.slopeTex;
  if (custom) return custom(look, rise);
  const shadeBy = (c: RGBA, l: number): RGBA => (l > 0 ? lighter(c, l) : l < 0 ? darker(c, -l) : c);
  if (look.slope === 'terracotta') {
    const ramp = [C('rust1'), C('rust2'), C('rust3')];
    return (a, b, l) => {
      const ai = Math.floor(a);
      const bi = Math.floor(b);
      if (bi <= 0) return darker(ramp[0]!, 1); // eave lip
      if (bi >= rise - 1) return shadeBy(ramp[2]!, l); // ridge tiles
      const ch = ((ai % 3) + 3) % 3; // channel: lit / mid / dark
      let c = ch === 0 ? ramp[2]! : ch === 1 ? ramp[1]! : ramp[0]!;
      if (bi % 3 === 0) c = darker(c); // course overlap shadow
      if (hash(ai, bi, 4) % 31 === 0) c = C('earth4'); // a weathered tile
      return shadeBy(c, l);
    };
  }
  if (look.slope === 'slate') {
    return (a, b, l) => {
      const ai = Math.floor(a);
      const bi = Math.floor(b);
      if (bi <= 0) return C('gray1');
      if (bi >= rise - 1) return shadeBy(C('gray3'), l); // lead ridge
      const course = Math.floor(bi / 2);
      let c = C('zinc1');
      if (bi % 2 === 0) c = C('zinc0');
      else if ((((ai + course * 2) % 5) + 5) % 5 === 0) c = C('zinc0');
      else if (hash(ai >> 1, course, 9) % 13 === 0) c = C('zinc2');
      return shadeBy(c, l);
    };
  }
  // Zinc standing seams.
  return (a, b, l) => {
    const ai = ((Math.floor(a) % 4) + 4) % 4;
    const bi = Math.floor(b);
    if (bi <= 0) return C('zinc1');
    let c = ai === 0 ? C('zinc3') : ai === 1 ? C('zinc1') : C('zinc2');
    if (bi >= rise - 1) c = C('zinc3');
    return shadeBy(c, l);
  };
}

function flatTex(look: Look, terrace: boolean, seed: number): (u: number, v: number) => RGBA {
  if (terrace) {
    // Floor tiles (RoofStyle.terraceTiles): Madrid terracotta, London/Paris grey pavers.
    const [jt, ta, tb] = envStyle(look.city).roofs.terraceTiles;
    const [joint, a, b] = [C(jt), C(ta), C(tb)];
    return (u, v) => {
      const fu = u * 4;
      const fv = v * 4;
      const ju = fu - Math.floor(fu);
      const jv = fv - Math.floor(fv);
      if (ju > 0.86 || jv > 0.86) return joint;
      return hash(Math.floor(fu), Math.floor(fv), seed) % 5 === 0 ? b : a;
    };
  }
  const base = look.flat;
  return (u, v) => {
    const x = Math.floor(u * 16);
    const y = Math.floor(v * 16);
    const h = hash(x, y, seed) % 17;
    if (h === 0) return darker(base);
    if (h === 1) return lighter(base);
    // Felt/tar seams every half tile.
    if (Math.abs(v * 2 - Math.round(v * 2)) < 0.04) return darker(base);
    return base;
  };
}

// ---------------------------------------------------------------------------------- paint ----

function paint(spec: Spec): BuildingArt {
  const { w, d } = spec;
  const city = spec.style as CityId;
  const dice = new Dice(hash(spec.seed, w * 7 + d, spec.storeys));
  const kind = spec.kind;
  const look = makeLook(city, kind, dice);
  const roof = spec.roof;
  const wallStoreys = roof === 'mansard' ? Math.max(1, spec.storeys - 1) : spec.storeys;
  const H = wallStoreys * STOREY + CORNICE;
  const rp = planRoof(spec, H);
  const headroom = 18;
  const top = rp.rise + headroom;
  const W = (w + d) * 16 + 4;
  const ox = d * 16 + 2;
  const oy = top + H + 1;
  const Himg = oy + (w + d) * 8 + 3;
  const cv = new IsoCanvas(W, Himg, ox, oy);
  const floors = floorProgramme(city, wallStoreys, roof, kind, dice);

  // Doors → bays on the visible faces.
  const leftLay = bayLayout(w * 16);
  const rightLay = bayLayout(d * 16);
  const doorL = new Set<number>();
  const doorR = new Set<number>();
  for (const p of spec.doors ?? []) {
    const du = p.i - (spec.i ?? 0);
    const dv = p.j - (spec.j ?? 0);
    if (dv === d && du >= 0 && du < w) doorL.add(clampBay(leftLay, (du + 0.5) * 16));
    else if (du === w && dv >= 0 && dv < d) doorR.add(clampBay(rightLay, (d - dv - 0.5) * 16));
  }
  if (doorL.size === 0 && doorR.size === 0 && kind !== 'civic')
    doorL.add(Math.floor(leftLay.n / 2) + (w > 2 ? dice.int(-1, 1) : 0));

  // Drainpipes (also climb points) — between bays, one per ~2 tiles of face.
  const pipesFor = (lay: { n: number; margin: number }, len: number, salt: number): number[] => {
    const n = Math.max(1, Math.round(len / 40));
    const out: number[] = [];
    for (let k = 0; k < n; k++) {
      const b = Math.min(
        lay.n,
        Math.max(0, Math.round(((k + 0.5) * lay.n) / n + (hash(spec.seed, k, salt) % 2) - 0.5)),
      );
      out.push(Math.min(len - 2, Math.max(1, lay.margin + b * BAY - 1)));
    }
    return [...new Set(out)];
  };
  const pipesL = pipesFor(leftLay, w * 16, 1);
  const pipesR = pipesFor(rightLay, d * 16, 2);

  const faceL = paintFace(look, {
    len: w * 16,
    H,
    storeys: wallStoreys,
    roof,
    kind,
    side: 'left',
    doorBays: doorL,
    pipes: pipesL,
    seed: spec.seed,
    floors,
  });
  const faceR = paintFace(look, {
    len: d * 16,
    H,
    storeys: wallStoreys,
    roof,
    kind,
    side: 'right',
    doorBays: doorR,
    pipes: pipesR,
    seed: hash(spec.seed, 99),
    floors,
  });
  // Right face is in shade.
  for (let i = 0; i < faceR.col.length; i++) faceR.col[i] = darker(faceR.col[i]!);

  const sample = (f: Face, col: number, row: number): RGBA | null => {
    const x = Math.min(f.w - 1, Math.max(0, col));
    const y = Math.min(f.h - 1, Math.max(0, row));
    return f.col[y * f.w + x]!;
  };
  const sampleL = (f: Face, col: number, row: number): RGBA | null => {
    const x = Math.min(f.w - 1, Math.max(0, col));
    const y = Math.min(f.h - 1, Math.max(0, row));
    return f.light[y * f.w + x] || null;
  };

  // Walls.
  cv.poly(
    [
      { u: 0, v: d, z: H },
      { u: w, v: d, z: H },
      { u: w, v: d, z: 0 },
      { u: 0, v: d, z: 0 },
    ],
    (u, _v, z) => sample(faceL, Math.floor(u * 16), Math.floor(H - z)),
    (u, _v, z) => sampleL(faceL, Math.floor(u * 16), Math.floor(H - z)),
  );
  cv.poly(
    [
      { u: w, v: d, z: H },
      { u: w, v: 0, z: H },
      { u: w, v: 0, z: 0 },
      { u: w, v: d, z: 0 },
    ],
    (_u, v, z) => sample(faceR, Math.floor((d - v) * 16), Math.floor(H - z)),
    (_u, v, z) => sampleL(faceR, Math.floor((d - v) * 16), Math.floor(H - z)),
  );

  const rd = new Dice(hash(spec.seed, 0xf00f));
  if (rp.type === 'pitched') paintPitched(cv, spec, look, H, rp, rd);
  else if (rp.type === 'mansard') paintMansard(cv, spec, look, H, rd, leftLay, rightLay);
  else paintFlat(cv, spec, look, H, rp.type === 'terrace', rd);

  // Coloured outline around the silhouette (ink-dark of the touching material).
  const img = cv.img;
  outlineDark(img);

  const shadow = castShadow(w, d, H + rp.rise * 0.6);
  const climbPoints: ClimbPoint[] = [];
  for (const px of pipesL) climbPoints.push({ i: (px + 0.5) / 16, j: d + 0.1, face: 'sw' });
  for (const px of pipesR) climbPoints.push({ i: w + 0.1, j: d - (px + 0.5) / 16, face: 'se' });
  // Back faces (hidden): one pipe per face, mid-way.
  climbPoints.push({ i: w / 2, j: -0.1, face: 'ne' });
  climbPoints.push({ i: -0.1, j: d / 2, face: 'nw' });

  return {
    image: img,
    anchor: { x: ox, y: oy },
    lights: cv.light,
    shadow: shadow.img,
    shadowAnchor: shadow.anchor,
    roofTopY: rp.standZ,
    roofStand: rp.stand,
    climbPoints,
    height: H + rp.rise,
  };
}

function clampBay(lay: { n: number; margin: number }, px: number): number {
  return Math.min(lay.n - 1, Math.max(0, Math.floor((px - lay.margin) / BAY)));
}

function outlineDark(img: PixelBuffer): void {
  outlineDarker(img, 3);
}

function castShadow(w: number, d: number, h: number): { img: PixelBuffer; anchor: Point } {
  const du = (h * 0.6) / 16;
  const W = Math.ceil((w + du + d) * 16) + 2;
  const Hh = Math.ceil((w + du + d) * 8) + 2;
  const img = createBuffer(W, Hh);
  const sc = resolveColor(SHADOW, SHADOW_ALPHA);
  const ox = d * 16 + 1;
  for (let py = 0; py < Hh; py++) {
    for (let px = 0; px < W; px++) {
      const a = (px + 0.5 - ox) / 32;
      const b = (py + 0.5) / 16;
      const u = b + a;
      const v = b - a;
      // Footprint swept toward +u (sun from the upper left); skip what the building covers.
      if (v > 0 && v < d && u >= w && u < w + du) setPixel(img, px, py, sc);
    }
  }
  return { img, anchor: { x: ox, y: 0 } };
}

// ---------------------------------------------------------------------------------- roofs ----

function paintPitched(
  cv: IsoCanvas,
  spec: Spec,
  look: Look,
  H: number,
  rp: RoofPlan,
  d: Dice,
): void {
  const { w, d: dd } = spec;
  const o = 0.06; // eave overhang
  const r = Math.min(1, Math.min(w, dd) / 2);
  const ru = Math.min(r, w / 2);
  const rv = Math.min(r, dd / 2);
  const Z = H + rp.rise;
  const tex = slopeTex(look, rp.rise);
  const zOf = (_u: number, _v: number, z: number): number => z - H;
  // +v slope (front-left, lit)
  cv.poly(
    [
      { u: -o, v: dd + o, z: H },
      { u: w + o, v: dd + o, z: H },
      { u: w - ru, v: dd - rv, z: Z },
      { u: ru, v: dd - rv, z: Z },
    ],
    (u, v, z) => tex(u * 16, zOf(u, v, z), 1),
  );
  // +u slope (front-right, shade)
  cv.poly(
    [
      { u: w + o, v: dd + o, z: H },
      { u: w + o, v: -o, z: H },
      { u: w - ru, v: rv, z: Z },
      { u: w - ru, v: dd - rv, z: Z },
    ],
    (u, v, z) => tex((dd - v) * 16, zOf(u, v, z), -1),
  );
  // −v slope (back-right) and −u slope (back-left).
  cv.poly(
    [
      { u: -o, v: -o, z: H },
      { u: w + o, v: -o, z: H },
      { u: w - ru, v: rv, z: Z },
      { u: ru, v: rv, z: Z },
    ],
    (u, v, z) => tex(u * 16, zOf(u, v, z), -1),
  );
  cv.poly(
    [
      { u: -o, v: -o, z: H },
      { u: -o, v: dd + o, z: H },
      { u: ru, v: dd - rv, z: Z },
      { u: ru, v: rv, z: Z },
    ],
    (u, v, z) => tex(v * 16, zOf(u, v, z), 0),
  );
  // Flat top (if the ring leaves one): standable roof flat.
  if (w - 2 * ru > 0.01 && dd - 2 * rv > 0.01) {
    const ft = flatTex(look, false, spec.seed);
    cv.poly(
      [
        { u: ru, v: rv, z: Z },
        { u: w - ru, v: rv, z: Z },
        { u: w - ru, v: dd - rv, z: Z },
        { u: ru, v: dd - rv, z: Z },
      ],
      (u, v) => {
        const e = Math.min(u - ru, v - rv, w - ru - u, dd - rv - v);
        if (e < 0.05)
          return lighter(
            C(look.slope === 'slate' ? 'gray3' : look.slope === 'terracotta' ? 'rust3' : 'zinc3'),
          );
        return ft(u, v);
      },
    );
    rooftopClutter(
      cv,
      spec,
      look,
      Z,
      { u0: ru + 0.1, v0: rv + 0.1, u1: w - ru - 0.1, v1: dd - rv - 0.1 },
      d,
      false,
    );
  }
  // Hip / ridge lines.
  const ridge =
    look.slope === 'slate' ? C('gray3') : look.slope === 'terracotta' ? C('rust3') : C('zinc4');
  line3(cv, { u: -o, v: dd + o, z: H }, { u: ru, v: dd - rv, z: Z }, lighter(ridge));
  line3(cv, { u: w + o, v: dd + o, z: H }, { u: w - ru, v: dd - rv, z: Z }, ridge);
  line3(cv, { u: w + o, v: -o, z: H }, { u: w - ru, v: rv, z: Z }, darker(ridge));
  if (w - 2 * ru <= 0.01 || dd - 2 * rv <= 0.01)
    line3(cv, { u: ru, v: rv, z: Z }, { u: w - ru, v: dd - rv, z: Z }, lighter(ridge));
  // Chimneys.
  const rs = envStyle(look.city).roofs;
  if (rs.pitchedChimneys === 'partyWalls') {
    // Brick stacks on the party walls with a row of terracotta pots.
    for (const u of w >= 2 ? [0.15, w - 0.35] : [w / 2 - 0.11]) {
      const v0 = Math.max(0.1, dd / 2 - 0.35);
      chimney(cv, u, v0, 0.22, 0.7, H, Z + 5, C('rust2'), C('rust3'), true);
    }
  } else if (d.chance(0.35)) {
    const u = Math.max(
      ru * 0.5,
      Math.min(w - 0.3, d.int(1, Math.max(1, Math.floor(w * 4) - 2)) / 4),
    );
    const v = rv * 0.4;
    chimney(cv, u, v, 0.16, 0.16, H, Z + 3, look.wall, look.trim, false);
  }
  // Dormer-ish attic window on the front slope (Madrid buhardilla) now and then.
  if (rs.dormer && w >= 2 && d.chance(0.4)) {
    const u0 = Math.floor(w / 2) - 0.15;
    const vf = dd - rv * 0.35;
    const zf = H + rp.rise * 0.35;
    dormer(cv, look, u0, u0 + 0.3, vf, zf, zf + 6, 'v', look.slope);
  }
}

function paintMansard(
  cv: IsoCanvas,
  spec: Spec,
  look: Look,
  H: number,
  d: Dice,
  leftLay: { n: number; margin: number },
  rightLay: { n: number; margin: number },
): void {
  const { w, d: dd } = spec;
  const o = 0.04;
  const ins = 0.3;
  const Z = H + 10;
  const tex = slopeTex(look.slope === 'terracotta' ? { ...look, slope: 'slate' } : look, 10);
  // Steep lower slopes (front two, back two).
  cv.poly(
    [
      { u: -o, v: dd + o, z: H },
      { u: w + o, v: dd + o, z: H },
      { u: w - ins, v: dd - ins, z: Z },
      { u: ins, v: dd - ins, z: Z },
    ],
    (u, _v, z) => tex(u * 16, z - H, 1),
  );
  cv.poly(
    [
      { u: w + o, v: dd + o, z: H },
      { u: w + o, v: -o, z: H },
      { u: w - ins, v: ins, z: Z },
      { u: w - ins, v: dd - ins, z: Z },
    ],
    (_u, v, z) => tex((dd - v) * 16, z - H, -1),
  );
  cv.poly(
    [
      { u: -o, v: -o, z: H },
      { u: w + o, v: -o, z: H },
      { u: w - ins, v: ins, z: Z },
      { u: ins, v: ins, z: Z },
    ],
    (u, _v, z) => tex(u * 16, z - H, -1),
  );
  cv.poly(
    [
      { u: -o, v: -o, z: H },
      { u: -o, v: dd + o, z: H },
      { u: ins, v: dd - ins, z: Z },
      { u: ins, v: ins, z: Z },
    ],
    (_u, v, z) => tex(v * 16, z - H, 0),
  );
  // Upper (terrasson): shallow zinc flat with seams, lit lip.
  cv.poly(
    [
      { u: ins, v: ins, z: Z },
      { u: w - ins, v: ins, z: Z },
      { u: w - ins, v: dd - ins, z: Z },
      { u: ins, v: dd - ins, z: Z },
    ],
    (u, v) => {
      const e = Math.min(u - ins, v - ins, w - ins - u, dd - ins - v);
      if (e < 0.05) return look.slope === 'zinc' ? C('zinc4') : C('gray3');
      const a = Math.floor(u * 16);
      if (look.slope === 'zinc') return a % 4 === 0 ? C('zinc3') : C('zinc2');
      return a % 4 === 0 ? C('zinc1') : C('zinc0');
    },
  );
  // Dormers aligned with the bays below.
  for (let b = 0; b < leftLay.n; b++) {
    if (leftLay.n > 2 && b % 2 === 1 && d.chance(0.5)) continue;
    const c = (leftLay.margin + b * BAY + 5) / 16;
    if (c < 0.25 || c > w - 0.25) continue;
    dormer(
      cv,
      look,
      c - 0.16,
      c + 0.16,
      dd - 0.06,
      H,
      H + 8,
      'v',
      look.slope === 'terracotta' ? 'slate' : look.slope,
    );
  }
  for (let b = 0; b < rightLay.n; b++) {
    if (rightLay.n > 2 && b % 2 === 1 && d.chance(0.5)) continue;
    const c = dd - (rightLay.margin + b * BAY + 5) / 16;
    if (c < 0.25 || c > dd - 0.25) continue;
    dormer(
      cv,
      look,
      c - 0.16,
      c + 0.16,
      w - 0.06,
      H,
      H + 8,
      'u',
      look.slope === 'terracotta' ? 'slate' : look.slope,
    );
  }
  // Chimney stacks: rows along the back and the party walls, with clay pots.
  const [stack, stackHi] = envStyle(look.city).roofs.mansardStacks;
  const plaster = C(stack);
  const plasterHi = C(stackHi);
  const nStacks = Math.max(1, Math.round(w / 2));
  for (let k = 0; k < nStacks; k++) {
    const u = ((k + 0.5) * w) / nStacks - 0.3;
    chimney(cv, Math.max(0.1, u), 0.08, 0.6, 0.18, H, Z + 6, plaster, plasterHi, true);
  }
  if (dd >= 2) chimney(cv, 0.08, dd / 2 - 0.3, 0.18, 0.6, H, Z + 5, plaster, plasterHi, true);
  // Party-wall stacks across deep roofs (Paris roofscapes bristle with them).
  if (w >= 3 && dd >= 3) {
    for (let k = 1; k < Math.floor(w / 2) + 1; k++) {
      const u = (k * w) / (Math.floor(w / 2) + 1) - 0.09;
      if (d.chance(0.7))
        chimney(cv, u, dd / 2 - 0.4, 0.18, 0.8, Z - 2, Z + 4, plaster, plasterHi, true);
    }
  }
  rooftopClutter(
    cv,
    spec,
    look,
    Z,
    { u0: ins + 0.15, v0: ins + 0.3, u1: w - ins - 0.15, v1: dd - ins - 0.1 },
    d,
    false,
    true,
  );
}

function paintFlat(
  cv: IsoCanvas,
  spec: Spec,
  look: Look,
  H: number,
  terrace: boolean,
  d: Dice,
): void {
  const { w, d: dd } = spec;
  const zr = H - 3;
  const ft = flatTex(look, terrace, spec.seed);
  cv.poly(
    [
      { u: 0, v: 0, z: zr },
      { u: w, v: 0, z: zr },
      { u: w, v: dd, z: zr },
      { u: 0, v: dd, z: zr },
    ],
    (u, v) => {
      // Parapet shadow along the far walls.
      if (u < 0.2 || v < 0.16) return darker(ft(u, v));
      return ft(u, v);
    },
  );
  const t = 0.09;
  const coping = lighter(look.trim);
  const inner = look.wall;
  const ptex = {
    top: ((u: number, v: number) =>
      Math.floor((u + v) * 8) % 4 === 0 ? look.trim : coping) as Tex,
    left: (() => inner) as Tex,
    right: (() => darker(inner)) as Tex,
  };
  // Back parapets show their inner faces; near ones only their coping.
  cv.box(0, 0, zr, w, t, H, { top: ptex.top, left: ptex.left, right: null });
  cv.box(0, 0, zr, t, dd, H, { top: ptex.top, left: null, right: ptex.right });
  cv.box(0, dd - t, zr, w, dd, H, { top: ptex.top, left: null, right: null });
  cv.box(w - t, 0, zr, w, dd, H, { top: ptex.top, left: null, right: null });
  // Terrace railings on the parapet (Madrid azotea) / civic balustrade.
  if (terrace || spec.kind === 'civic') {
    const rail = terrace ? look.iron : look.trim;
    const railHi = terrace ? look.ironHi : lighter(look.trim);
    railing(cv, { u: 0, v: dd - t / 2, z: H }, { u: w, v: dd - t / 2, z: H }, 3, rail, railHi);
    railing(cv, { u: w - t / 2, v: 0, z: H }, { u: w - t / 2, v: dd, z: H }, 3, darker(rail), rail);
    railing(cv, { u: 0, v: t / 2, z: H }, { u: w, v: t / 2, z: H }, 3, rail, railHi);
    railing(cv, { u: t / 2, v: 0, z: H }, { u: t / 2, v: dd, z: H }, 3, rail, railHi);
  }
  rooftopClutter(cv, spec, look, zr, { u0: 0.2, v0: 0.2, u1: w - 0.15, v1: dd - 0.15 }, d, terrace);
}

// ------------------------------------------------------------------------------- roof parts ---

function line3(cv: IsoCanvas, a: V3, b: V3, c: RGBA): void {
  const len = Math.hypot((b.u - a.u) * 32, (b.v - a.v) * 32, b.z - a.z);
  const n = Math.max(1, Math.ceil(len * 1.5));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    cv.dot(
      { u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t, z: a.z + (b.z - a.z) * t },
      c,
      0.6,
    );
  }
}

function railing(cv: IsoCanvas, a: V3, b: V3, h: number, c: RGBA, hi: RGBA): void {
  const len = Math.hypot(b.u - a.u, b.v - a.v);
  const n = Math.max(1, Math.round(len * 32));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const p = { u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t, z: a.z };
    if (k % 8 === 0) cv.pole(p, h, c, 0.8);
    cv.dot({ ...p, z: a.z + h }, hi, 0.9);
    cv.dot({ ...p, z: a.z + h - 1 }, c, 0.85);
  }
}

function chimney(
  cv: IsoCanvas,
  u: number,
  v: number,
  su: number,
  sv: number,
  z0: number,
  z1: number,
  wall: RGBA,
  hi: RGBA,
  pots: boolean,
): void {
  cv.box(u, v, z0, u + su, v + sv, z1, {
    top: () => darker(wall, 2),
    left: (_u, _v, z) => (z > z1 - 1.5 ? hi : wall),
    right: (_u, _v, z) => (z > z1 - 1.5 ? wall : darker(wall)),
  });
  if (!pots) return;
  const pot = C('rust3');
  const potHi = C('rust4');
  const n = Math.max(1, Math.round(Math.max(su, sv) / 0.14));
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n;
    const p =
      su > sv ? { u: u + su * t, v: v + sv / 2, z: z1 } : { u: u + su / 2, v: v + sv * t, z: z1 };
    cv.dot(p, pot, 1);
    cv.dot({ ...p, z: z1 + 1 }, pot, 1);
    cv.dot({ ...p, z: z1 + 2 }, potHi, 1);
  }
}

function dormer(
  cv: IsoCanvas,
  look: Look,
  a0: number,
  a1: number,
  front: number,
  z0: number,
  z1: number,
  axis: 'u' | 'v',
  mat: Look['slope'],
): void {
  const depth = 0.3;
  const capC = mat === 'zinc' ? C('zinc3') : mat === 'slate' ? C('zinc1') : C('rust3');
  const T = look.trim;
  const glassTex = (s: number, z: number): RGBA => {
    // s: px across the dormer front (0..~5), z above base.
    const sx = Math.floor(s);
    const zz = Math.floor(z - z0);
    const wdt = Math.round((a1 - a0) * 16);
    if (zz >= z1 - z0 - 2) return lighter(T);
    if (sx <= 0 || sx >= wdt - 1 || zz <= 0) return T;
    if (zz === z1 - z0 - 3) return darker(T);
    return sx === 1 && zz > 2 ? C('zinc2') : C('navy1');
  };
  if (axis === 'v') {
    cv.box(
      a0,
      front - depth,
      z0,
      a1,
      front,
      z1,
      {
        top: () => capC,
        left: (u, _v, z) => glassTex((u - a0) * 16, z),
        right: () => darker(capC),
      },
      0.2,
    );
  } else {
    cv.box(
      front - depth,
      a0,
      z0,
      front,
      a1,
      z1,
      {
        top: () => capC,
        left: () => capC,
        right: (_u, v, z) => darker(glassTex((a1 - v) * 16, z)),
      },
      0.2,
    );
  }
}

/** Seeded rooftop clutter on a flat area: AC units, tanks, stair housing, antennas, laundry. */
function rooftopClutter(
  cv: IsoCanvas,
  spec: Spec,
  look: Look,
  z: number,
  area: { u0: number; v0: number; u1: number; v1: number },
  d: Dice,
  terrace: boolean,
  sparse = false,
): void {
  const aw = area.u1 - area.u0;
  const av = area.v1 - area.v0;
  if (aw < 0.3 || av < 0.3) return;
  const occupied: Array<[number, number, number, number]> = [];
  const free = (u: number, v: number, su: number, sv: number): boolean =>
    u >= area.u0 &&
    v >= area.v0 &&
    u + su <= area.u1 &&
    v + sv <= area.v1 &&
    !occupied.some(
      ([a, b, c, e]) => u < c + 0.08 && u + su > a - 0.08 && v < e + 0.08 && v + sv > b - 0.08,
    );
  const place = (su: number, sv: number): [number, number] | null => {
    for (let k = 0; k < 10; k++) {
      const u = area.u0 + d.next() * Math.max(0, aw - su);
      const v = area.v0 + d.next() * Math.max(0, av - sv);
      if (free(u, v, su, sv)) {
        occupied.push([u, v, u + su, v + sv]);
        return [u, v];
      }
    }
    return null;
  };
  const items = Math.max(
    1,
    Math.round(((aw * av) / (sparse ? 3 : 1.4)) * (spec.rooftop ? 0.7 : 1)),
  );
  const clutter = envStyle(look.city).roofs.clutter;
  // Stair housing first on bigger roofs.
  if (aw * av > 2 && !sparse) {
    const p = place(0.6, 0.5);
    if (p) {
      const wall = look.wall;
      cv.box(p[0], p[1], z, p[0] + 0.6, p[1] + 0.5, z + 9, {
        top: () => lighter(look.trim),
        left: (u, _v, zz) => {
          const x = (u - p[0]) * 16;
          if (zz > z + 8) return look.trim;
          if (x > 3 && x < 7 && zz < z + 7) return x > 6 ? darker(look.door) : look.door;
          return wall;
        },
        right: () => darker(wall),
      });
    }
  }
  for (let k = 0; k < items; k++) {
    const r = d.next();
    if (r < 0.3) {
      // AC unit: pale box with a fan grille.
      const p = place(0.25, 0.2);
      if (!p) continue;
      cv.box(p[0], p[1], z, p[0] + 0.25, p[1] + 0.2, z + 4, {
        top: () => C('gray7'),
        left: (u, _v, zz) => {
          const x = Math.floor((u - p[0]) * 16);
          const y = Math.floor(zz - z);
          return (x === 1 || x === 2) && (y === 1 || y === 2) ? C('gray3') : C('gray6');
        },
        right: () => C('gray5'),
      });
    } else if (r < 0.5 && (clutter || terrace)) {
      // Water tank on legs.
      const p = place(0.35, 0.35);
      if (!p) continue;
      const c = d.chance(0.5) ? C('stone4') : C('gray6');
      cv.box(p[0], p[1], z + 2, p[0] + 0.35, p[1] + 0.35, z + 9, {
        top: () => lighter(c),
        left: (_u, _v, zz) => (Math.floor(zz - z) === 5 ? darker(c) : c),
        right: () => darker(c),
      });
      cv.pole({ u: p[0] + 0.33, v: p[1] + 0.33, z }, 2, C('gray2'));
      cv.pole({ u: p[0] + 0.02, v: p[1] + 0.33, z }, 2, C('gray2'));
    } else if (r < 0.65) {
      // TV aerial.
      const p = place(0.1, 0.1);
      if (!p) continue;
      const base = { u: p[0], v: p[1], z };
      cv.pole(base, 11, C('gray3'));
      for (const [zz, len] of [
        [10, 0.12],
        [8, 0.18],
        [6, 0.14],
      ] as const) {
        for (let s = -len; s <= len; s += 0.03)
          cv.dot({ u: p[0] + s, v: p[1], z: z + zz }, C('gray4'), 1);
      }
    } else if (r < 0.75) {
      // Satellite dish.
      const p = place(0.15, 0.15);
      if (!p) continue;
      cv.pole({ u: p[0], v: p[1], z }, 3, C('gray3'));
      for (const [du, dz] of [
        [-0.03, 3],
        [0.03, 3],
        [0, 4],
        [-0.03, 4],
        [0.03, 2],
        [0, 2],
      ] as const)
        cv.dot({ u: p[0] + du, v: p[1] + 0.03, z: z + dz }, C('gray7'), 1);
    } else if (r < 0.88 && (clutter || terrace)) {
      // Laundry line with clothes.
      const p = place(0.8, 0.1);
      if (!p) continue;
      cv.pole({ u: p[0], v: p[1], z }, 6, C('gray3'));
      cv.pole({ u: p[0] + 0.8, v: p[1], z }, 6, C('gray3'));
      for (let s = 0; s <= 0.8; s += 0.03)
        cv.dot({ u: p[0] + s, v: p[1], z: z + 6 }, C('gray5'), 1);
      for (let s = 0.08; s < 0.75; s += 0.16) {
        const cl = d.pick(look.cloth);
        for (let q = 0; q < 3; q++) {
          cv.dot({ u: p[0] + s, v: p[1], z: z + 5 - q }, cl, 1.2);
          cv.dot({ u: p[0] + s + 0.04, v: p[1], z: z + 5 - q }, darker(cl), 1.2);
        }
      }
    } else {
      // Skylight / vent box.
      const p = place(0.4, 0.3);
      if (!p) continue;
      cv.box(p[0], p[1], z, p[0] + 0.4, p[1] + 0.3, z + 2, {
        top: (u) => (Math.floor((u - p[0]) * 16) % 3 === 0 ? C('zinc2') : C('zinc3')),
        left: () => C('gray5'),
        right: () => C('gray4'),
      });
    }
  }
}
