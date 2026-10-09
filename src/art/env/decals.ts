/**
 * Decals (M3a): flat ground overlays drawn in the terrain/decal layer — graffiti tags, scorch
 * marks, broken glass, litter piles, puddles, leaflets, paint splats and tyre marks. Palette-only
 * (no alpha), anchored at their centre (place on the tile centre or any world point).
 * Graffiti is drawn "on the ground" — letters wide and squashed to the 2:1 ground plane.
 */
import type { RGBA } from '../palette';
import {
  createBuffer,
  getPixel,
  mirrorX,
  setPixel,
  type PixelBuffer,
  type Point,
} from '../lib/pixels';
import { C, darker, lighter } from './color';
import { parseGrid } from './bld/face';
import { Dice } from './util';

export interface DecalSprite {
  img: PixelBuffer;
  anchor: Point;
}

// Tags: '#' = paint, '+' = paint highlight/outline second colour.
const TAG_ANARCHY = `
...####...
.##....##.
#..#..#..#
#...##...#
#..####..#
.###..###.
...####...
`;
const TAG_HEART = `
.##...##.
####.####
#########
.#######.
...###...
....#....
`;
const TAG_NO = `
#...#..###.
##..#.#...#
#.#.#.#...#
#..##.#...#
#...#..###.
`;
const TAG_MOLA = `
#...#..##..#.....#.
##.##.#..#.#....#.#
#.#.#.#..#.#....###
#...#..##..###..#.#
`;
const TAG_OI = `
.###..#.#
#...#.#.#
#...#.#.#
.###..#.#
`;
const TAG_NON = `
#..#..##..#..#
##.#.#..#.##.#
#.##.#..#.#.##
#..#..##..#..#
`;
const TAG_RIOT = `
###..#..##..###
#..#.#.#..#..#.
###..#.#..#..#.
#..#.#..##...#.
`;

const SPRAY = ['crim2', 'pink2', 'lime', 'sky', 'white', 'purple', 'ochre3', 'teal2'];

function tagSprite(src: string, colour: RGBA, outline: RGBA | null): DecalSprite {
  const g = parseGrid(src);
  const b = createBuffer(g.w + 2, g.h + 2);
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.rows[y]!.length; x++) {
      if (g.rows[y]![x] === '#') setPixel(b, x + 1, y + 1, colour);
    }
  }
  if (outline) {
    const marks: Array<[number, number]> = [];
    for (let y = 0; y < b.h; y++)
      for (let x = 0; x < b.w; x++) {
        if (getPixel(b, x, y) & 255) continue;
        // Throw-up style outline only below/right (reads as a drop shadow on the ground).
        if (getPixel(b, x - 1, y) & 255 || getPixel(b, x, y - 1) & 255) marks.push([x, y]);
      }
    for (const [x, y] of marks) setPixel(b, x, y, outline);
  }
  return { img: b, anchor: { x: b.w >> 1, y: b.h >> 1 } };
}

function blob(
  d: Dice,
  w: number,
  h: number,
  paint: (b: PixelBuffer, x: number, y: number, r: number) => void,
): PixelBuffer {
  const b = createBuffer(w, h);
  const cx = w / 2;
  const cy = h / 2;
  const ph = d.next() * 6.28;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - cx) / (w / 2);
      const dy = (y + 0.5 - cy) / (h / 2);
      const a = Math.atan2(dy, dx);
      const r =
        Math.hypot(dx, dy) / (0.82 + 0.12 * Math.sin(a * 3 + ph) + 0.08 * Math.sin(a * 7 + ph * 2));
      if (r < 1) paint(b, x, y, r);
    }
  }
  return b;
}

function scorch(seed: number): DecalSprite {
  const d = new Dice(seed);
  const w = 22 + d.int(0, 6);
  const b = blob(d, w, Math.round(w / 2), (b, x, y, r) => {
    const n = ((x * 7 + y * 13 + seed) % 5) / 5;
    if (r < 0.45) setPixel(b, x, y, C('ink'));
    else if (r < 0.75) setPixel(b, x, y, n < 0.6 ? C('gray1') : C('ink'));
    else if (n < 0.55) setPixel(b, x, y, C('gray2'));
  });
  // Soot streaks radiating out and a few dying embers.
  for (let k = 0; k < 6; k++) {
    const a = d.next() * Math.PI * 2;
    for (let t = 0.6; t < 1.25; t += 0.08) {
      setPixel(
        b,
        Math.round(w / 2 + Math.cos(a) * t * (w / 2)),
        Math.round(w / 4 + Math.sin(a) * t * (w / 4)),
        C('gray2'),
      );
    }
  }
  for (let k = 0; k < 3; k++)
    setPixel(
      b,
      Math.round(w / 2) + d.int(-3, 3),
      Math.round(w / 4) + d.int(-1, 1),
      d.chance(0.5) ? C('rust3') : C('ochre2'),
    );
  return { img: b, anchor: { x: w >> 1, y: Math.round(w / 4) } };
}

function glass(seed: number): DecalSprite {
  const d = new Dice(seed);
  const b = createBuffer(20, 10);
  for (let k = 0; k < 16; k++) {
    const x = d.int(1, 18);
    const y = d.int(1, 8);
    const c = d.pick([C('sky'), C('zinc4'), C('white'), C('zinc3')]);
    setPixel(b, x, y, c);
    if (d.chance(0.4)) setPixel(b, x + 1, y, darker(c));
    if (d.chance(0.25)) setPixel(b, x, y + 1, C('zinc2'));
  }
  // A bottle neck.
  setPixel(b, 9, 5, C('green3'));
  setPixel(b, 10, 5, C('green2'));
  setPixel(b, 11, 4, C('green4'));
  return { img: b, anchor: { x: 10, y: 5 } };
}

function litterPile(seed: number): DecalSprite {
  const d = new Dice(seed);
  const b = createBuffer(18, 10);
  const bits: Array<[string[], number, number]> = [];
  for (let k = 0; k < 9; k++) {
    const kind = d.pick([
      ['white', 'gray6'],
      ['gray6', 'gray5'],
      ['earth4', 'earth3'],
      ['crim2', 'crim1'],
      ['gray3', 'gray2'],
      ['ochre3', 'ochre2'],
    ]);
    bits.push([kind, d.int(2, 14), d.int(2, 7)]);
  }
  for (const [[a, s], x, y] of bits) {
    setPixel(b, x, y, C(a!));
    setPixel(b, x + 1, y, C(a!));
    setPixel(b, x + 1, y + 1, C(s!));
    if (d.chance(0.5)) setPixel(b, x, y + 1, C(s!));
  }
  return { img: b, anchor: { x: 9, y: 5 } };
}

function puddle(seed: number): DecalSprite {
  const d = new Dice(seed);
  const w = 16 + d.int(0, 8);
  const h = Math.round(w / 2);
  const b = blob(d, w, h, (b, x, y, r) => {
    if (r > 0.82) setPixel(b, x, y, C('zinc0'));
    else if (y < h * 0.35 && x < w * 0.6 && r > 0.4) setPixel(b, x, y, C('zinc2'));
    else setPixel(b, x, y, C('zinc1'));
  });
  // Sky reflection glints.
  setPixel(b, Math.round(w * 0.35), Math.round(h * 0.4), C('sky'));
  setPixel(b, Math.round(w * 0.35) + 1, Math.round(h * 0.4), C('zinc3'));
  setPixel(b, Math.round(w * 0.6), Math.round(h * 0.6), C('zinc3'));
  return { img: b, anchor: { x: w >> 1, y: h >> 1 } };
}

function leaflets(seed: number): DecalSprite {
  const d = new Dice(seed);
  const b = createBuffer(24, 12);
  for (let k = 0; k < 12; k++) {
    const x = d.int(1, 21);
    const y = d.int(1, 10);
    const c = C(d.pick(['white', 'white', 'ochre4', 'pink3', 'sky', 'hivis2']));
    setPixel(b, x, y, c);
    setPixel(b, x + 1, y, c);
    setPixel(b, x + (d.chance(0.5) ? 1 : 0), y + 1, darker(c));
  }
  return { img: b, anchor: { x: 12, y: 6 } };
}

function splat(seed: number): DecalSprite {
  const d = new Dice(seed);
  const col = C(d.pick(['crim2', 'pink2', 'lime', 'sky', 'ochre3', 'white', 'purple']));
  const w = 12 + d.int(0, 6);
  const b = blob(d, w + 8, Math.round(w / 2) + 4, (b, x, y, r) => {
    if (r < 0.55) setPixel(b, x, y, r < 0.25 ? lighter(col) : col);
  });
  for (let k = 0; k < 7; k++) {
    const a = d.next() * Math.PI * 2;
    const t = 0.65 + d.next() * 0.35;
    const x = Math.round((w + 8) / 2 + Math.cos(a) * t * ((w + 8) / 2));
    const y = Math.round(
      (Math.round(w / 2) + 4) / 2 + Math.sin(a) * t * ((Math.round(w / 2) + 4) / 2),
    );
    setPixel(b, x, y, d.chance(0.5) ? col : darker(col));
  }
  return { img: b, anchor: { x: (w + 8) >> 1, y: (Math.round(w / 2) + 4) >> 1 } };
}

/** Skid marks along the i axis (mirror for j). */
function tyre(seed: number): DecalSprite {
  const d = new Dice(seed);
  const b = createBuffer(34, 19);
  for (const off of [0, 5]) {
    for (let x = 0; x < 30; x++) {
      if (d.chance(0.12)) continue;
      const y = Math.floor(x / 2) + off - (off ? 3 : 0) + 2;
      setPixel(b, x + (off ? 0 : 3), y, x % 7 === 0 ? C('gray2') : C('gray1'));
    }
  }
  return { img: b, anchor: { x: 17, y: 9 } };
}

export interface DecalEntry {
  name: string;
  sprite: DecalSprite;
}

/** Build every decal (pure). Names: decal.<kind>.<variant>[.i|.j]. */
let decalCache: DecalEntry[] | null = null;
export function buildDecals(): DecalEntry[] {
  if (decalCache) return decalCache;
  const out: DecalEntry[] = [];
  decalCache = out;
  const tags: Array<[string, string]> = [
    ['anarchy', TAG_ANARCHY],
    ['heart', TAG_HEART],
    ['no', TAG_NO],
    ['mola', TAG_MOLA],
    ['oi', TAG_OI],
    ['non', TAG_NON],
    ['riot', TAG_RIOT],
  ];
  tags.forEach(([n, src], k) => {
    const col = C(SPRAY[(k * 3) % SPRAY.length]!);
    out.push({
      name: `decal.tag.${n}`,
      sprite: tagSprite(src, col, k % 2 === 0 ? C('ink') : null),
    });
  });
  for (let v = 0; v < 3; v++) out.push({ name: `decal.scorch.${v}`, sprite: scorch(v * 11 + 1) });
  for (let v = 0; v < 2; v++) out.push({ name: `decal.glass.${v}`, sprite: glass(v * 7 + 2) });
  for (let v = 0; v < 3; v++)
    out.push({ name: `decal.litter.${v}`, sprite: litterPile(v * 5 + 3) });
  for (let v = 0; v < 2; v++) out.push({ name: `decal.puddle.${v}`, sprite: puddle(v * 9 + 4) });
  for (let v = 0; v < 2; v++)
    out.push({ name: `decal.leaflets.${v}`, sprite: leaflets(v * 13 + 5) });
  for (let v = 0; v < 4; v++) out.push({ name: `decal.splat.${v}`, sprite: splat(v * 17 + 6) });
  for (let v = 0; v < 2; v++) {
    const t = tyre(v * 3 + 7);
    out.push({ name: `decal.tyre.${v}.i`, sprite: t });
    out.push({
      name: `decal.tyre.${v}.j`,
      sprite: { img: mirrorX(t.img), anchor: { x: t.img.w - 1 - t.anchor.x, y: t.anchor.y } },
    });
  }
  return out;
}

/** Decal kinds and their variant counts (for random scattering by seed). */
export const DECAL_KINDS: Readonly<Record<string, number>> = {
  tag: 7,
  scorch: 3,
  glass: 2,
  litter: 3,
  puddle: 2,
  leaflets: 2,
  splat: 4,
  tyre: 2,
};

const TAG_NAMES = ['anarchy', 'heart', 'no', 'mola', 'oi', 'non', 'riot'];

/** Registered decal name for a kind + seed (tags pick a design; tyre marks take an axis). */
export function decalSprite(kind: string, seed = 0, axis: 'i' | 'j' = 'i'): string {
  const n = DECAL_KINDS[kind] ?? 1;
  const v = (seed >>> 0) % n;
  if (kind === 'tag') return `decal.tag.${TAG_NAMES[v]}`;
  if (kind === 'tyre') return `decal.tyre.${v}.${axis}`;
  return `decal.${kind}.${v}`;
}

export function getDecal(name: string): DecalSprite {
  const e = buildDecals().find((d) => d.name === name);
  if (!e) throw new Error(`Unknown decal "${name}"`);
  return e.sprite;
}
