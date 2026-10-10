/**
 * Props (M3a): trees, streetlamps per city, street furniture, city icons (Morris column, Wallace
 * fountain, phone & post boxes, metro entrances), café terraces, signs, flags, pigeons, litter.
 *
 * Every prop sprite is anchored at its ground contact point = the world position it is placed
 * at (for decor, the tile centre). Iso-built props (benches, shelters, kiosks, hedges …) are
 * modelled with the same rasterizer as buildings and anchored at the projection of their tile
 * centre. Axis-dependent props come as `.i` (long side along i) and `.j` (mirrored) variants.
 * All props carry a coloured outline and a soft blob shadow (`hasShadow`).
 */
import type { CityId } from '../../maps/contract';
import { SHADOW, SHADOW_ALPHA, resolveColor, type RGBA } from '../palette';
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
import { IsoCanvas, type Tex } from './raster';
import * as P from './props.grid';
import { ENV_CITIES, envCity, envStyle } from './style';
import { Dice, hash, outlineDarker } from './util';

export interface PropSprite {
  frames: PixelBuffer[];
  anchor: Point;
  fps?: number;
  /** Night-light layer (same size as frames[0]) for lamps etc. */
  light?: PixelBuffer;
}

// ---------------------------------------------------------------------------------- helpers --

const BASE_KEYS: Record<string, string> = {
  k: 'ink',
  '1': 'gray1',
  '2': 'gray2',
  '3': 'gray3',
  '4': 'gray4',
  '5': 'gray5',
  '6': 'gray6',
  '7': 'gray7',
  w: 'white',
  W: 'gray7',
  z: 'zinc1',
  Z: 'zinc2',
  x: 'zinc3',
  s: 'stone2',
  S: 'stone3',
  t: 'stone4',
  T: 'stone5',
  e: 'earth2',
  E: 'earth3',
  b: 'earth4',
  r: 'rust2',
  R: 'rust3',
  c: 'crim1',
  C: 'crim2',
  o: 'ochre1',
  O: 'ochre2',
  y: 'ochre3',
  Y: 'ochre4',
  g: 'green1',
  G: 'green2',
  h: 'green3',
  H: 'green4',
  l: 'lime',
  n: 'navy1',
  N: 'blue1',
  B: 'navy2',
  u: 'blue2',
  U: 'sky',
  q: 'teal1',
  Q: 'teal2',
  p: 'pink2',
  P: 'pink3',
  v: 'purple',
  d: 'gray1',
};

type Keys = Record<string, RGBA | null>;

function keys(over: Record<string, string | RGBA | null> = {}): Keys {
  const out: Keys = {};
  for (const [k, v] of Object.entries(BASE_KEYS)) out[k] = C(v);
  for (const [k, v] of Object.entries(over)) out[k] = typeof v === 'string' ? C(v) : v;
  return out;
}

/** Tolerant grid → buffer (rows padded with '.'). */
function gridBuf(src: string, k: Keys): PixelBuffer {
  const g = parseGrid(src);
  const b = createBuffer(g.w, g.h);
  for (let y = 0; y < g.h; y++) {
    const row = g.rows[y]!;
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      if (ch === '.') continue;
      const c = k[ch];
      if (c === undefined) throw new Error(`prop grid: unknown key "${ch}"`);
      if (c !== null) setPixel(b, x, y, c);
    }
  }
  return b;
}

function sheetBufs(src: string, k: Keys): PixelBuffer[] {
  return src
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((f) => f.trim())
    .filter((f) => f.length > 0)
    .map((f) => gridBuf(f, k));
}

interface FinishOpts {
  /** Blob shadow radius (px); 0 = none. */
  shadow?: number;
  /** Shadow centre offset to the right (sun upper-left). */
  shadowDx?: number;
  outline?: boolean;
}

/**
 * Pad, outline (coloured: 3 steps darker than the touching pixel), add the blob shadow under the
 * anchor and crop. Applies the same geometry to every frame so animations stay aligned.
 */
function finish(
  frames: PixelBuffer[],
  anchor: Point,
  o: FinishOpts = {},
  light?: PixelBuffer,
): PropSprite {
  const rx = o.shadow ?? 0;
  const ry = Math.max(1, Math.round(rx / 2));
  const pad = 2 + rx;
  const sc = resolveColor(SHADOW, SHADOW_ALPHA);
  const out = frames.map((f) => {
    const b = createBuffer(f.w + pad * 2, f.h + pad * 2);
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++) {
        const c = getPixel(f, x, y);
        if (c & 255) setPixel(b, x + pad, y + pad, c);
      }
    if (o.outline !== false) outlineDarker(b, 3);
    if (rx > 0) {
      const cx = anchor.x + pad + (o.shadowDx ?? 1);
      const cy = anchor.y + pad;
      for (let y = -ry; y <= ry; y++) {
        for (let x = -rx; x <= rx; x++) {
          if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 1) continue;
          const px = cx + x;
          const py = cy + y;
          if ((getPixel(b, px, py) & 255) === 0) setPixel(b, px, py, sc);
        }
      }
    }
    return b;
  });
  // Crop to the union of opaque bounds.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (const b of out) {
    for (let y = 0; y < b.h; y++)
      for (let x = 0; x < b.w; x++) {
        if ((getPixel(b, x, y) & 255) === 0) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
  }
  const ax = anchor.x + pad;
  const ay = anchor.y + pad;
  minX = Math.min(minX, ax);
  minY = Math.min(minY, ay);
  maxX = Math.max(maxX, ax);
  maxY = Math.max(maxY, ay);
  const crop = (b: PixelBuffer): PixelBuffer => {
    const c = createBuffer(maxX - minX + 1, maxY - minY + 1);
    for (let y = 0; y < c.h; y++)
      for (let x = 0; x < c.w; x++) {
        const p = getPixel(b, x + minX, y + minY);
        if (p & 255) setPixel(c, x, y, p);
      }
    return c;
  };
  let lightOut: PixelBuffer | undefined;
  if (light) {
    const lb = createBuffer(light.w + pad * 2, light.h + pad * 2);
    for (let y = 0; y < light.h; y++)
      for (let x = 0; x < light.w; x++) {
        const c = getPixel(light, x, y);
        if (c & 255) setPixel(lb, x + pad, y + pad, c);
      }
    lightOut = crop(lb);
  }
  return { frames: out.map(crop), anchor: { x: ax - minX, y: ay - minY }, light: lightOut };
}

/** Bottom-centre anchored grid prop. */
function gridProp(src: string, k: Keys, o: FinishOpts = {}, lightKeys?: string[]): PropSprite {
  const b = gridBuf(src, k);
  const anchor = { x: Math.floor(b.w / 2), y: b.h - 1 };
  let light: PixelBuffer | undefined;
  if (lightKeys) {
    const g = parseGrid(src);
    light = createBuffer(b.w, b.h);
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.rows[y]!.length; x++) {
        const ch = g.rows[y]![x]!;
        if (lightKeys.includes(ch))
          setPixel(light, x, y, ch === lightKeys[0] ? C('ochre3') : C('ochre4'));
      }
  }
  return finish([b], anchor, o, light);
}

/** Iso-built prop on a 1-tile canvas; anchor = projection of the tile centre at ground. */
function isoProp(height: number, draw: (cv: IsoCanvas) => void, o: FinishOpts = {}): PropSprite {
  const cv = new IsoCanvas(34, height + 18, 17, height + 1);
  draw(cv);
  const anchor = { x: 17, y: height + 1 + 8 };
  return finish([cv.img], anchor, o);
}

const mirrorProp = (p: PropSprite): PropSprite => ({
  frames: p.frames.map(mirrorX),
  anchor: { x: p.frames[0]!.w - 1 - p.anchor.x, y: p.anchor.y },
  fps: p.fps,
  light: p.light ? mirrorX(p.light) : undefined,
});

// ----------------------------------------------------------------------------------- trees ---

export type TreeSpecies = 'plane' | 'pine' | 'chestnut' | 'oak' | 'bush';

interface Clump {
  x: number;
  y: number;
  rx: number;
  ry: number;
  /** Tone offset: −1 = in shadow (back / under), +1 = sunlit. */
  tone: number;
}

const FOLIAGE: Record<TreeSpecies, string[]> = {
  plane: ['green0', 'green1', 'green2', 'green3', 'green3', 'green4'],
  pine: ['ink', 'green0', 'green1', 'green2', 'green3', 'green4'],
  chestnut: ['green0', 'green0', 'green1', 'green2', 'green3', 'green4'],
  oak: ['green0', 'green1', 'olive1', 'green2', 'green3', 'olive2'],
  bush: ['green0', 'green1', 'green2', 'green3', 'green4', 'lime'],
};

function canopy(b: PixelBuffer, clumps: Clump[], ramp: RGBA[], seed: number, flowers?: RGBA): void {
  // Back-to-front: upper & right clumps first.
  const order = [...clumps].sort((a, c) => a.y - c.y || c.x - a.x);
  for (const [ci, cl] of order.entries()) {
    const ph = (hash(seed, ci) % 628) / 100;
    for (let y = Math.floor(cl.y - cl.ry - 2); y <= cl.y + cl.ry + 2; y++) {
      for (let x = Math.floor(cl.x - cl.rx - 2); x <= cl.x + cl.rx + 2; x++) {
        const dx = (x + 0.5 - cl.x) / cl.rx;
        const dy = (y + 0.5 - cl.y) / cl.ry;
        const r2 = dx * dx + dy * dy;
        const ang = Math.atan2(dy, dx);
        const edge = 1 + 0.13 * Math.sin(ang * 5 + ph) + 0.07 * Math.sin(ang * 9 + ph * 2);
        if (r2 > edge * edge) continue;
        const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, r2)));
        let L = -0.55 * dx - 0.7 * dy + 0.6 * nz + cl.tone * 0.22;
        // Leaf scales: lit top-left, shaded bottom-right of each little leaf cluster.
        const row = Math.floor(y / 3);
        const lx = (x + (row & 1) * 2 + (seed & 3)) & 3;
        const ly = y - row * 3;
        if (ly === 0 && (lx === 1 || lx === 2)) L += 0.18;
        else if (ly === 2 && (lx === 2 || lx === 3)) L -= 0.22;
        let idx: number;
        if (L > 0.75) idx = 5;
        else if (L > 0.42) idx = 4;
        else if (L > 0.12) idx = 3;
        else if (L > -0.22) idx = 2;
        else idx = 1;
        setPixel(b, x, y, ramp[idx]!);
      }
    }
  }
  if (flowers) {
    // Chestnut candles: small upright white/pink clusters on the sunlit side.
    const d = new Dice(seed + 5);
    for (let k = 0; k < 7; k++) {
      const cl = d.pick(clumps);
      const x = Math.round(cl.x + (d.next() - 0.6) * cl.rx);
      const y = Math.round(cl.y + (d.next() - 0.7) * cl.ry);
      if ((getPixel(b, x, y) & 255) === 0 || (getPixel(b, x, y + 1) & 255) === 0) continue;
      setPixel(b, x, y, flowers);
      setPixel(b, x, y + 1, lighter(flowers, 0) === flowers ? C('pink3') : flowers);
    }
  }
}

function trunk(
  b: PixelBuffer,
  x0: number,
  yBase: number,
  yTop: number,
  w: number,
  bark: RGBA[],
  bend: number,
  seed: number,
  mottled: boolean,
): void {
  for (let y = yTop; y <= yBase; y++) {
    const t = (yBase - y) / Math.max(1, yBase - yTop);
    const off = Math.round(Math.sin(t * Math.PI * 0.9) * bend);
    const ww = w + (y > yBase - 2 ? 1 : 0); // root flare
    for (let k = 0; k < ww; k++) {
      const x = x0 + off + k - (y > yBase - 2 ? 1 : 0) * (k === 0 ? 0 : 0);
      let c = k === 0 ? bark[2]! : k === ww - 1 ? bark[0]! : bark[1]!;
      if (mottled && hash(x >> 1, y >> 1, seed) % 3 === 0) c = k === ww - 1 ? bark[1]! : bark[3]!;
      setPixel(b, x, y, c);
    }
  }
}

export function treeSprite(species: TreeSpecies, seed: number): PropSprite {
  const d = new Dice(hash(seed, species.length));
  const ramp = FOLIAGE[species].map((n) => C(n));
  const W = 44;
  const H = 60;
  const b = createBuffer(W, H);
  const cx = 22;
  const base = H - 2;
  let clumps: Clump[];
  const j = (n: number): number => (d.next() - 0.5) * n;
  if (species === 'plane') {
    const bark = [C('stone1'), C('stone3'), C('stone4'), C('gray6')];
    trunk(b, cx - 1, base, base - 22, 3, bark, j(2), seed, true);
    // Branch forks visible under the canopy.
    for (const s of [-1, 1])
      for (let k = 0; k < 6; k++) setPixel(b, cx + s * (1 + k), base - 18 - k, bark[1]!);
    const top = base - 42;
    clumps = [
      { x: cx + j(2), y: top + 8, rx: 9, ry: 7, tone: 0.5 },
      { x: cx - 8 + j(2), y: top + 14, rx: 8, ry: 6, tone: 0.3 },
      { x: cx + 8 + j(2), y: top + 13, rx: 8, ry: 6, tone: -0.3 },
      { x: cx - 3 + j(2), y: top + 20, rx: 10, ry: 6, tone: -0.1 },
      { x: cx + 6 + j(2), y: top + 21, rx: 7, ry: 5, tone: -0.6 },
      { x: cx - 10 + j(2), y: top + 21, rx: 5, ry: 4, tone: -0.2 },
    ];
  } else if (species === 'pine') {
    const bark = [C('rust0'), C('earth2'), C('earth3'), C('rust2')];
    const bend = j(5);
    trunk(b, cx - 1, base, base - 30, 2, bark, bend, seed, false);
    const top = base - 40;
    const ox = cx + Math.round(bend * 0.3);
    clumps = [
      { x: ox - 6 + j(2), y: top + 5, rx: 9, ry: 4, tone: 0.4 },
      { x: ox + 6 + j(2), y: top + 4, rx: 9, ry: 4, tone: 0.2 },
      { x: ox + j(2), y: top + 2, rx: 8, ry: 3, tone: 0.6 },
      { x: ox - 12 + j(2), y: top + 8, rx: 6, ry: 3, tone: -0.2 },
      { x: ox + 12 + j(2), y: top + 7, rx: 7, ry: 3, tone: -0.5 },
      { x: ox + j(3), y: top + 8, rx: 10, ry: 3, tone: -0.4 },
    ];
  } else if (species === 'chestnut') {
    const bark = [C('earth0'), C('earth1'), C('earth2'), C('earth2')];
    trunk(b, cx - 1, base, base - 14, 3, bark, j(1), seed, false);
    const top = base - 40;
    clumps = [
      { x: cx + j(2), y: top + 9, rx: 8, ry: 8, tone: 0.5 },
      { x: cx - 7 + j(2), y: top + 16, rx: 8, ry: 7, tone: 0.2 },
      { x: cx + 7 + j(2), y: top + 16, rx: 8, ry: 7, tone: -0.4 },
      { x: cx + j(2), y: top + 24, rx: 10, ry: 6, tone: -0.4 },
      { x: cx - 4 + j(2), y: top + 5, rx: 5, ry: 4, tone: 0.7 },
    ];
  } else if (species === 'oak') {
    const bark = [C('earth0'), C('gray2'), C('gray3'), C('earth1')];
    trunk(b, cx - 2, base, base - 16, 4, bark, j(1), seed, true);
    for (const s of [-1, 1])
      for (let k = 0; k < 7; k++) setPixel(b, cx + s * (2 + k), base - 13 - (k >> 1), bark[1]!);
    const top = base - 40;
    clumps = [
      { x: cx - 2 + j(3), y: top + 9, rx: 8, ry: 7, tone: 0.5 },
      { x: cx + 8 + j(3), y: top + 12, rx: 7, ry: 6, tone: -0.1 },
      { x: cx - 10 + j(3), y: top + 15, rx: 7, ry: 6, tone: 0.2 },
      { x: cx + 2 + j(3), y: top + 19, rx: 10, ry: 6, tone: -0.3 },
      { x: cx + 11 + j(3), y: top + 21, rx: 5, ry: 4, tone: -0.6 },
      { x: cx - 11 + j(3), y: top + 22, rx: 5, ry: 4, tone: -0.3 },
    ];
  } else {
    const top = base - 10;
    clumps = [
      { x: cx - 3 + j(1), y: top + 5, rx: 5, ry: 4, tone: 0.3 },
      { x: cx + 3 + j(1), y: top + 5, rx: 5, ry: 4, tone: -0.2 },
      { x: cx + j(1), y: top + 3, rx: 4, ry: 3, tone: 0.6 },
    ];
  }
  canopy(b, clumps, ramp, seed, species === 'chestnut' ? C('white') : undefined);
  const shadow = species === 'bush' ? 6 : species === 'pine' ? 7 : 8;
  return finish([b], { x: cx, y: base }, { shadow, shadowDx: species === 'bush' ? 1 : 3 });
}

// ------------------------------------------------------------------------- iso-built props ---

function hedge(): PropSprite {
  return isoProp(
    10,
    (cv) => {
      const leaf =
        (base: RGBA): Tex =>
        (u, v, z) => {
          const x = Math.floor((u - v) * 16);
          const y = Math.floor((u + v) * 8 - z);
          const row = Math.floor(y / 2);
          const lx = (x + (row & 1) * 2) & 3;
          if (lx === 0 && (y & 1) === 0) return lighter(base);
          if (lx === 2 && (y & 1) === 1) return darker(base);
          return base;
        };
      cv.box(0.06, 0.3, 0, 0.94, 0.7, 8, {
        top: leaf(C('green3')),
        left: leaf(C('green2')),
        right: leaf(C('green1')),
      });
    },
    { shadow: 0 },
  );
}

function bench(city: CityId): PropSprite {
  const st = envStyle(city).props.bench;
  const frame = C(st.frame);
  const wood = C(st.wood);
  return isoProp(
    10,
    (cv) => {
      const slats =
        (base: RGBA): Tex =>
        (_u, _v, z) => {
          const k = Math.floor(z) % 2;
          return k === 0 ? base : darker(base);
        };
      // Legs / end frames.
      for (const u of [0.2, 0.78]) {
        cv.box(u, 0.38, 0, u + 0.04, 0.62, 4, {
          top: () => frame,
          left: () => frame,
          right: () => darker(frame),
        });
        cv.box(u, 0.38, 0, u + 0.04, 0.44, 9, {
          top: () => frame,
          left: () => frame,
          right: () => darker(frame),
        });
      }
      // Seat and backrest slats.
      cv.box(0.16, 0.42, 3, 0.84, 0.62, 4, {
        top: (_u, v) => (Math.floor(v * 32) % 2 === 0 ? lighter(wood) : wood),
        left: () => darker(wood),
        right: () => darker(wood, 2),
      });
      cv.box(0.16, 0.38, 5, 0.84, 0.43, 9, {
        top: () => lighter(wood),
        left: slats(wood),
        right: () => darker(wood, 2),
      });
    },
    { shadow: 0 },
  );
}

function kiosk(city: CityId): PropSprite {
  const st = envStyle(city).props.kiosk;
  const top = st.top;
  const body = C(st.body);
  const roof = C(st.roof);
  return isoProp(
    26,
    (cv) => {
      const side =
        (shadeN: number) =>
        (s: number, z: number): RGBA => {
          const x = Math.floor(s);
          const y = Math.floor(z);
          let c: RGBA;
          if (y < 2) c = darker(body);
          else if (y >= 10 && y <= 12 && x > 1 && x < 8)
            c = y === 12 ? C('navy1') : C('navy0'); // vendor hatch
          else if (y >= 3 && y <= 8 && x > 0 && x < 9) {
            // Racks of papers and magazines: pale pages with a few bright covers.
            if (y === 5 || y === 8) c = darker(body);
            else {
              const h = hash(x >> 1, y >> 2, 7) % 9;
              c =
                h < 4
                  ? C('white')
                  : h < 6
                    ? C('gray6')
                    : [C('crim2'), C('ochre3'), C('blue2')][h - 6]!;
            }
          } else c = body;
          return shadeN ? darker(c, shadeN) : c;
        };
      const L = side(0);
      const R = side(1);
      cv.box(0.22, 0.22, 0, 0.78, 0.78, 14, {
        top: null,
        left: (u, _v, z) => L((u - 0.22) * 16, z),
        right: (_u, v, z) => R((0.78 - v) * 16, z),
      });
      // Overhanging roof.
      cv.box(0.14, 0.14, 14, 0.86, 0.86, 16, {
        top: (u, v) => (Math.floor((u + v) * 8) % 3 === 0 ? darker(roof) : roof),
        left: () => darker(roof),
        right: () => darker(roof, 2),
      });
      if (top === 'dome') {
        // Little dome and gilded finial.
        cv.box(0.3, 0.3, 16, 0.7, 0.7, 19, {
          top: () => lighter(roof),
          left: () => roof,
          right: () => darker(roof),
        });
        cv.box(0.44, 0.44, 19, 0.56, 0.56, 21, {
          top: () => C('ochre2'),
          left: () => C('ochre2'),
          right: () => C('ochre1'),
        });
        cv.pole({ u: 0.5, v: 0.5, z: 21 }, 2, C('ochre2'));
      } else {
        // Sign board on top.
        const sc = C(top.sign);
        cv.box(0.3, 0.46, 16, 0.7, 0.54, 20, {
          top: () => C('gray6'),
          left: (u, _v, z) =>
            Math.floor(z) === 18 && Math.floor(u * 32) % 2 === 0 ? sc : C('white'),
          right: () => C('gray6'),
        });
      }
    },
    { shadow: 0 },
  );
}

function phonebox(): PropSprite {
  const red = C('crim2');
  return isoProp(
    26,
    (cv) => {
      const face =
        (base: RGBA) =>
        (s: number, z: number): RGBA => {
          const x = Math.floor(s);
          const y = Math.floor(z);
          if (y >= 19) return x >= 1 && x <= 4 && y === 20 ? C('white') : base; // TELEPHONE band
          if (y <= 1) return darker(base);
          if (x === 0 || x === 5) return base;
          if (y % 4 === 0 || x === 3) return base; // glazing bars
          return y > 14 ? C('zinc2') : C('zinc1');
        };
      const L = face(red);
      const R = face(darker(red));
      cv.box(0.32, 0.32, 0, 0.68, 0.68, 22, {
        top: () => red,
        left: (u, _v, z) => L((u - 0.32) * 16, z),
        right: (_u, v, z) => darker(R((0.68 - v) * 16, z)),
      });
      cv.box(0.36, 0.36, 22, 0.64, 0.64, 24, {
        top: () => lighter(red),
        left: () => red,
        right: () => darker(red),
      });
      cv.dot({ u: 0.5, v: 0.5, z: 25 }, C('ochre2'));
    },
    { shadow: 0 },
  );
}

function busStop(city: CityId): PropSprite {
  const st = envStyle(city).props.busStop;
  const frame = C(st.frame);
  const roof = C(st.roof);
  return isoProp(
    22,
    (cv) => {
      const glass: Tex = (u, _v, z) => {
        const x = Math.floor(u * 32);
        if (Math.floor(z) <= 1 || Math.floor(z) >= 13) return frame;
        if (x % 9 === 0) return frame;
        return Math.floor(z) === 12 || (x + Math.floor(z)) % 11 === 0 ? C('zinc3') : C('zinc2');
      };
      // Back glass wall (we see its front, +v side), ad panel at the far end, roof.
      cv.box(0.08, 0.3, 0, 0.92, 0.34, 14, { top: () => frame, left: glass, right: () => frame });
      cv.box(0.8, 0.34, 1, 0.92, 0.66, 13, {
        top: () => frame,
        left: () => frame,
        right: (_u, v, z) => {
          // Lit advertising panel.
          const y = Math.floor(z);
          const x = Math.floor(v * 32);
          if (y < 3 || y > 11) return frame;
          return [C('ochre4'), C('pink2'), C('sky'), C('white')][(x + (y >> 2)) % 4]!;
        },
      });
      cv.box(0.04, 0.24, 14, 0.96, 0.7, 15, {
        top: () => lighter(roof),
        left: () => roof,
        right: () => darker(roof),
      });
      // Bench inside.
      cv.box(0.2, 0.34, 3, 0.7, 0.44, 4, {
        top: () => C('gray5'),
        left: () => C('gray4'),
        right: () => C('gray3'),
      });
      // Stop flag on a pole at the near end.
      cv.pole({ u: 0.12, v: 0.68, z: 0 }, 18, C('gray3'));
      const flagC = C(st.flag);
      for (let z = 16; z < 21; z++) {
        cv.dot({ u: 0.12, v: 0.7, z }, flagC, 1);
        cv.dot({ u: 0.15, v: 0.7, z }, z === 18 ? C('white') : flagC, 1);
        cv.dot({ u: 0.18, v: 0.7, z }, flagC, 1);
      }
    },
    { shadow: 0 },
  );
}

function planter(city: CityId, seed: number): PropSprite {
  const stone = C(envStyle(city).props.planter);
  const box = isoProp(
    8,
    (cv) => {
      cv.box(0.2, 0.25, 0, 0.8, 0.75, 5, {
        top: () => C('earth1'),
        left: (_u, _v, z) => (Math.floor(z) === 4 ? lighter(stone) : stone),
        right: (_u, _v, z) => (Math.floor(z) === 4 ? stone : darker(stone)),
      });
    },
    { outline: false },
  );
  // Shrub on top.
  const bush = treeSprite('bush', seed);
  const out = createBuffer(
    Math.max(box.frames[0]!.w, bush.frames[0]!.w) + 4,
    box.frames[0]!.h + 12,
  );
  const ax = Math.floor(out.w / 2);
  const ay = out.h - (box.frames[0]!.h - box.anchor.y) - 1;
  blitAt(out, box.frames[0]!, ax - box.anchor.x, ay - box.anchor.y);
  blitAt(out, bush.frames[0]!, ax - bush.anchor.x, ay - 6 - bush.anchor.y, true);
  return finish([out], { x: ax, y: ay }, { shadow: 0 });
}

function blitAt(
  dst: PixelBuffer,
  src: PixelBuffer,
  dx: number,
  dy: number,
  opaqueOnly = false,
): void {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const c = getPixel(src, x, y);
      const a = c & 255;
      if (a === 0 || (opaqueOnly && a !== 255)) continue;
      setPixel(dst, x + dx, y + dy, c);
    }
}

function cafe(city: CityId, seed: number): PropSprite {
  const d = new Dice(seed);
  const st = envStyle(city).props.cafe;
  const chair = C(st.chair);
  const table = C(st.table);
  const pair = st.umbrellas.length === 1 ? st.umbrellas[0]! : d.pick(st.umbrellas);
  const umb: [RGBA, RGBA] = [C(pair[0]), C(pair[1])];
  return isoProp(
    24,
    (cv) => {
      // Chairs either side of the table.
      for (const [u, v] of [
        [0.24, 0.5],
        [0.7, 0.5],
      ] as const) {
        cv.box(u, v - 0.08, 0, u + 0.08, v + 0.08, 3, {
          top: () => lighter(chair),
          left: () => chair,
          right: () => darker(chair),
        });
        const back = u < 0.5 ? u : u + 0.06;
        cv.box(back, v - 0.08, 3, back + 0.02, v + 0.08, 7, {
          top: () => chair,
          left: () => chair,
          right: () => darker(chair),
        });
      }
      // Round table: pedestal + top.
      cv.pole({ u: 0.5, v: 0.5, z: 0 }, 5, C('gray2'));
      cv.box(0.4, 0.4, 5, 0.6, 0.6, 6, {
        top: () => table,
        left: () => darker(table),
        right: () => darker(table, 2),
      });
      // Umbrella.
      cv.pole({ u: 0.5, v: 0.5, z: 6 }, 12, C('gray6'));
      const z = 18;
      const R = 0.42;
      for (let k = 0; k < 8; k++) {
        const a0 = (k / 8) * Math.PI * 2;
        const a1 = ((k + 1) / 8) * Math.PI * 2;
        const col = k % 2 === 0 ? umb[0] : umb[1];
        const lit = Math.cos((a0 + a1) / 2 - Math.PI * 0.75) > 0;
        cv.poly(
          [
            { u: 0.5, v: 0.5, z: z + 3 },
            { u: 0.5 + Math.cos(a0) * R, v: 0.5 + Math.sin(a0) * R, z },
            { u: 0.5 + Math.cos(a1) * R, v: 0.5 + Math.sin(a1) * R, z },
          ],
          () => (lit ? col : darker(col)),
        );
      }
    },
    { shadow: 0 },
  );
}

function tape(): PropSprite {
  return isoProp(
    10,
    (cv) => {
      for (const u of [0.08, 0.92]) {
        // Plastic barrier posts (red/white).
        for (let z = 0; z < 8; z++) cv.dot({ u, v: 0.5, z }, z % 3 === 0 ? C('white') : C('crim2'));
        cv.dot({ u: u + 0.02, v: 0.5, z: 0 }, C('crim1'));
      }
      for (let k = 0; k <= 60; k++) {
        const t = k / 60;
        const sag = Math.sin(t * Math.PI) * 1.5;
        const z = 7 - sag;
        const c = Math.floor(t * 14) % 2 === 0 ? C('hivis2') : C('ink');
        cv.dot({ u: 0.08 + 0.84 * t, v: 0.5, z }, c);
        cv.dot(
          { u: 0.08 + 0.84 * t, v: 0.5, z: z - 1 },
          Math.floor(t * 14) % 2 === 0 ? C('hivis1') : C('ink'),
        );
      }
    },
    { shadow: 0 },
  );
}

// --------------------------------------------------------------------------------- lamps etc --

function lamp(city: CityId): PropSprite {
  const st = envStyle(city).props.lamp;
  const k = keys({ ...st.keys, L: 'stone5', F: 'white' });
  return gridProp(st.grid, k, { shadow: 3 }, ['L', 'F']);
}

function binProp(city: CityId): PropSprite {
  const st = envStyle(city).props.bin;
  return gridProp(st.grid, keys(st.keys), { shadow: 3 });
}

function bollard(city: CityId): PropSprite {
  const st = envStyle(city).props.bollard;
  return gridProp(st.grid, keys(st.keys), { shadow: 2 });
}

function hydrant(city: CityId): PropSprite {
  return gridProp(P.HYDRANT, keys(envStyle(city).props.hydrant), { shadow: 3 });
}

function trafficLight(city: CityId): PropSprite {
  const [M, m] = envStyle(city).props.metal;
  const off = { R: 'rust0', O: 'earth2', G: 'green0' };
  const frames = (['R', 'O', 'G'] as const).map((on) => {
    const k = keys({ M, m, ...off, [on]: on === 'R' ? 'crim2' : on === 'O' ? 'ochre3' : 'lime' });
    return gridBuf(P.TRAFFIC_LIGHT, k);
  });
  const f0 = frames[0]!;
  const sp = finish(frames, { x: Math.floor(f0.w / 2), y: f0.h - 1 }, { shadow: 2 });
  return { ...sp, fps: 0.25 };
}

export type SignType = 'noentry' | 'oneway' | 'yield' | 'parking';
export const SIGN_TYPES: readonly SignType[] = ['noentry', 'oneway', 'yield', 'parking'];
function sign(t: SignType): PropSprite {
  const src = {
    noentry: P.SIGN_NOENTRY,
    oneway: P.SIGN_ONEWAY,
    yield: P.SIGN_YIELD,
    parking: P.SIGN_PARKING,
  }[t];
  return gridProp(src, keys({ M: 'gray4', m: 'gray3' }), { shadow: 2 });
}

function metro(city: CityId): PropSprite {
  const st = envStyle(city).props.metro;
  const k = keys({
    M: 'gray3',
    m: 'gray2',
    G: 'green2',
    g: 'green1',
    y: 'ochre3',
    O: 'ochre2',
    Y: 'ochre4',
  });
  return gridProp(st.grid, k, { shadow: st.shadow }, st.lightKeys ? [...st.lightKeys] : undefined);
}

function morris(seed: number): PropSprite {
  const d = new Dice(seed);
  const k = keys({ G: 'green2', g: 'green1', A: 'ochre2' });
  // Poster colours vary per column.
  const pal = ['crim2', 'ochre3', 'sky', 'pink2', 'lime', 'white', 'purple', 'blue1'];
  const remap: Record<string, string> = {
    p: d.pick(pal),
    P: d.pick(pal),
    y: d.pick(pal),
    C: d.pick(pal),
    n: d.pick(pal),
  };
  return gridProp(
    P.MORRIS,
    { ...k, ...Object.fromEntries(Object.entries(remap).map(([a, b]) => [a, C(b)])) },
    { shadow: 4 },
  );
}

function flagProp(city: CityId): PropSprite {
  const flag = envStyle(city).props.flag;
  const pole = gridBuf(P.FLAGPOLE, keys({ M: 'gray6', m: 'gray5', A: 'ochre2' }));
  const FW = 13;
  const FH = 8;
  const frames: PixelBuffer[] = [];
  for (let f = 0; f < 4; f++) {
    const b = createBuffer(FW + 2, pole.h + 3);
    blitAt(b, pole, 0, 0);
    for (let x = 0; x < FW; x++) {
      const wave = Math.sin(x * 0.55 - f * (Math.PI / 2));
      const dy = Math.round(wave * 1.1 * (x / FW) + (x / FW) * 1.5);
      const shade = Math.cos(x * 0.55 - f * (Math.PI / 2));
      for (let y = 0; y < FH; y++) {
        let c = flag(x, y, FW, FH);
        if (shade < -0.5) c = darker(c);
        else if (shade > 0.8 && x > 1) c = lighter(c);
        setPixel(b, x + 1, y + 1 + dy, c);
      }
    }
    frames.push(b);
  }
  const sp = finish(frames, { x: 0, y: pole.h - 1 }, { shadow: 2 });
  return { ...sp, fps: 6 };
}

function pigeonSheets(): Record<'idle' | 'peck' | 'fly', PropSprite> {
  const k = keys({});
  const mk = (src: string, fps: number, shadow: number): PropSprite => {
    const frames = sheetBufs(src, k);
    const f0 = frames[0]!;
    return { ...finish(frames, { x: Math.floor(f0.w / 2), y: f0.h - 1 }, { shadow }), fps };
  };
  return {
    idle: mk(P.PIGEON_IDLE, 3, 2),
    peck: mk(P.PIGEON_PECK, 6, 2),
    fly: mk(P.PIGEON_FLY, 12, 0),
  };
}

function bikeProp(kind: 'bicycle' | 'scooter', city: CityId, seed: number): PropSprite {
  const d = new Dice(seed);
  const st = envStyle(city).props.bike;
  const body = C(
    kind === 'bicycle'
      ? st.colours.length === 1
        ? st.colours[0]!
        : d.pick(st.colours)
      : d.pick(['sky', 'crim2', 'ochre3', 'white', 'green3', 'stone4']),
  );
  const b = createBuffer(15, 11);
  const ink = C('ink');
  const tyre = C('gray1');
  const ring = (cx: number, cy: number): void => {
    for (const [x, y] of [
      [-1, -2],
      [0, -2],
      [1, -2],
      [-2, -1],
      [2, -1],
      [-2, 0],
      [2, 0],
      [-2, 1],
      [2, 1],
      [-1, 2],
      [0, 2],
      [1, 2],
    ] as const)
      setPixel(b, cx + x, cy + y, tyre);
    setPixel(b, cx, cy, C('gray4'));
  };
  const line = (x0: number, y0: number, x1: number, y1: number, c: RGBA): void => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++)
      setPixel(b, Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), c);
  };
  // Along i: rear wheel upper-left, front wheel lower-right.
  ring(3, 4);
  ring(11, 7);
  if (kind === 'bicycle') {
    line(3, 4, 6, 6, body); // chain stay
    line(6, 6, 11, 7, body); // down tube to fork
    line(5, 2, 6, 6, body); // seat tube
    line(5, 2, 10, 3, body); // top tube
    line(10, 3, 11, 7, darker(body)); // fork
    setPixel(b, 4, 1, ink);
    setPixel(b, 5, 1, ink); // saddle
    setPixel(b, 10, 2, ink);
    setPixel(b, 11, 2, ink);
    setPixel(b, 9, 2, C('gray3')); // bars
    if (st.basket) {
      // Hire-bike basket.
      setPixel(b, 12, 3, C('gray4'));
      setPixel(b, 12, 4, C('gray3'));
    }
  } else {
    // Vespa: rounded rear body, footboard, leg shield, headlamp.
    for (let y = 1; y <= 5; y++)
      for (let x = 1; x <= 6; x++) {
        if ((x - 3.5) ** 2 / 9 + (y - 3.5) ** 2 / 5 > 1) continue;
        setPixel(b, x, y, y <= 2 ? lighter(body) : x > 4 ? darker(body) : body);
      }
    line(5, 5, 9, 6, darker(body, 2)); // footboard
    line(9, 2, 10, 6, body);
    line(10, 2, 10, 5, darker(body));
    setPixel(b, 2, 0, C('earth1'));
    setPixel(b, 3, 0, C('earth1'));
    setPixel(b, 4, 0, C('earth2')); // seat
    setPixel(b, 9, 1, ink);
    setPixel(b, 10, 1, C('gray3'));
    setPixel(b, 11, 1, ink);
    setPixel(b, 11, 3, C('ochre4')); // headlamp
  }
  return finish([b], { x: 7, y: 9 }, { shadow: 4 });
}

// ------------------------------------------------------------------------------ city props --

/** Prop builders handed to a city's own props (EnvCity.props.extra, src/art/env/cities/). */
export interface PropKit {
  /**
   * Bottom-centre anchored prop from a props.grid.ts-style grid. `keys` override the shared
   * BASE_KEYS (swatch names); `lightKeys` glow at night (first key ochre3, others ochre4).
   */
  gridProp(
    src: string,
    keys: Readonly<Record<string, string>>,
    opts?: { shadow?: number },
    lightKeys?: readonly string[],
  ): PropSprite;
  /** Prop built with the iso rasterizer on a one-tile canvas `height` px tall. */
  isoProp(height: number, draw: (cv: IsoCanvas) => void, opts?: { shadow?: number }): PropSprite;
}

const PROP_KIT: PropKit = {
  gridProp: (src, k, opts, lightKeys) =>
    gridProp(src, keys(k), opts, lightKeys ? [...lightKeys] : undefined),
  isoProp: (height, draw, opts) => isoProp(height, draw, opts),
};

// --------------------------------------------------------------------------------- registry --

export interface PropEntry {
  name: string;
  sprite: PropSprite;
}

/** Decor kinds M2 may place (DecorPlacement.kind), resolved by `propSprite`. */
export const PROP_KINDS = [
  'tree.plane',
  'tree.pine',
  'tree.chestnut',
  'tree.oak',
  'bush',
  'hedge',
  'lamp',
  'bench',
  'kiosk',
  'bin',
  'phonebox',
  'postbox',
  'morris',
  'wallace',
  'metro',
  'busstop',
  'hydrant',
  'bollard',
  'planter',
  'cafe',
  'trafficlight',
  'sign',
  'flag',
  'statue',
  'bike',
  'cone',
  'tape',
  'litter',
  'pigeon',
] as const;
export type PropKind = (typeof PROP_KINDS)[number];

const TREE_VARIANTS = 3;
const CAFE_VARIANTS = 2;
const PLANTER_VARIANTS = 2;
const BIKE_VARIANTS = 3;

/**
 * Fallbacks for decor kinds without their own art (the world view tries the kind first, then
 * its fallback; a city can give such a kind real art with EnvCity.props.extra).
 */
export const PROP_FALLBACK: Readonly<Record<string, string>> = {
  'tree.round': 'tree.oak',
  'tree.willow': 'tree.chestnut',
  'tree.cypress': 'tree.pine',
  'lamp.rostral': 'lamp',
  tube: 'metro',
  sentrybox: 'phonebox',
  cenotaph: 'statue',
  'column.gilded': 'statue',
  'statue.equestrian': 'statue',
  'statue.lion': 'statue',
  'statue.bear': 'statue',
  fountain: 'wallace',
};

/** Kinds whose sprite depends on the decor axis ('i' default, 'j' = mirrored). */
const AXIS_KINDS = new Set<string>(['hedge', 'bench', 'busstop', 'cafe', 'tape', 'bike']);

/**
 * Registered sprite name for a decor placement. `seed` picks among variants; `axis` picks the
 * mirrored variant for axis-aligned props. City-specific icons (phonebox, morris …) exist for
 * every city (they fall back to the canonical design). A city whose environment style is not
 * built yet uses Madrid's props.
 */
export function propSprite(kind: string, cityId: CityId, seed = 0, axis: 'i' | 'j' = 'i'): string {
  const city = envCity(cityId);
  // The city's own props (EnvCity.props.extra) win over the shared catalogue.
  if (envStyle(city).props.extra?.[kind]) return `prop.${kind}.${city}`;
  const h = hash(seed >>> 0, 0x9a1);
  const ax = AXIS_KINDS.has(kind) ? `.${axis}` : '';
  if (kind.startsWith('tree.')) return `prop.${kind}.${h % TREE_VARIANTS}`;
  switch (kind) {
    case 'bush':
      return `prop.bush.${h % TREE_VARIANTS}`;
    case 'hedge':
    case 'tape':
      return `prop.${kind}${ax}`;
    case 'phonebox':
    case 'postbox':
    case 'morris':
    case 'wallace':
    case 'statue':
    case 'cone':
      return kind === 'morris' ? `prop.morris.${h % 2}` : `prop.${kind}`;
    case 'sign':
      return `prop.sign.${SIGN_TYPES[h % SIGN_TYPES.length]}`;
    case 'cafe':
      return `prop.cafe.${city}.${h % CAFE_VARIANTS}${ax}`;
    case 'planter':
      return `prop.planter.${city}.${h % PLANTER_VARIANTS}`;
    case 'bike':
      return `prop.bike.${city}.${h % BIKE_VARIANTS}${ax}`;
    case 'litter':
      return `prop.litter.${h % 3}`;
    case 'pigeon':
      return `prop.pigeon.${['idle', 'peck', 'idle'][h % 3]}`;
    default:
      return `prop.${kind}.${city}${ax}`;
  }
}

let propCache: PropEntry[] | null = null;

/** Build every prop sprite (pure, memoised; registration happens in index.ts). */
export function buildProps(): PropEntry[] {
  if (propCache) return propCache;
  const out: PropEntry[] = [];
  propCache = out;
  const add = (name: string, sprite: PropSprite): void => {
    out.push({ name, sprite });
  };
  const addAxis = (name: string, sprite: PropSprite): void => {
    add(`${name}.i`, sprite);
    add(`${name}.j`, mirrorProp(sprite));
  };
  for (const sp of ['plane', 'pine', 'chestnut', 'oak'] as const) {
    for (let v = 0; v < TREE_VARIANTS; v++)
      add(`prop.tree.${sp}.${v}`, treeSprite(sp, v * 17 + sp.length));
  }
  for (let v = 0; v < TREE_VARIANTS; v++) add(`prop.bush.${v}`, treeSprite('bush', v * 13 + 3));
  addAxis('prop.hedge', hedge());
  addAxis('prop.tape', tape());
  for (const city of ENV_CITIES) {
    add(`prop.lamp.${city}`, lamp(city));
    addAxis(`prop.bench.${city}`, bench(city));
    add(`prop.kiosk.${city}`, kiosk(city));
    add(`prop.bin.${city}`, binProp(city));
    add(`prop.metro.${city}`, metro(city));
    addAxis(`prop.busstop.${city}`, busStop(city));
    add(`prop.hydrant.${city}`, hydrant(city));
    add(`prop.bollard.${city}`, bollard(city));
    add(`prop.trafficlight.${city}`, trafficLight(city));
    add(`prop.flag.${city}`, flagProp(city));
    for (let v = 0; v < CAFE_VARIANTS; v++)
      addAxis(`prop.cafe.${city}.${v}`, cafe(city, v * 7 + city.length));
    for (let v = 0; v < PLANTER_VARIANTS; v++)
      add(`prop.planter.${city}.${v}`, planter(city, v * 5 + 1));
    for (let v = 0; v < BIKE_VARIANTS; v++) {
      const kind = !envStyle(city).props.bike.scooters || v === 0 ? 'bicycle' : 'scooter';
      addAxis(`prop.bike.${city}.${v}`, bikeProp(kind, city, v * 3 + city.length));
    }
    for (const [kind, build] of Object.entries(envStyle(city).props.extra ?? {}))
      add(`prop.${kind}.${city}`, build(PROP_KIT));
  }
  add('prop.phonebox', phonebox());
  add('prop.postbox', gridProp(P.POSTBOX, keys({ A: 'ochre2' }), { shadow: 3 }));
  add('prop.morris.0', morris(1));
  add('prop.morris.1', morris(2));
  add(
    'prop.wallace',
    gridProp(P.WALLACE, keys({ G: 'green2', g: 'green1', A: 'ochre2' }), { shadow: 4 }),
  );
  add('prop.statue', gridProp(P.STATUE, keys({}), { shadow: 5 }));
  add('prop.cone', gridProp(P.CONE, keys({}), { shadow: 2 }));
  for (const t of SIGN_TYPES) add(`prop.sign.${t}`, sign(t));
  add('prop.litter.0', gridProp(P.LITTER_CAN, keys({}), {}));
  add('prop.litter.1', gridProp(P.LITTER_PAPER, keys({}), {}));
  add('prop.litter.2', gridProp(P.LITTER_BAG, keys({}), {}));
  const pg = pigeonSheets();
  add('prop.pigeon.idle', pg.idle);
  add('prop.pigeon.peck', pg.peck);
  add('prop.pigeon.fly', pg.fly);
  return out;
}

/** Look up a built prop by registered name. */
export function getProp(name: string): PropSprite {
  const e = buildProps().find((p) => p.name === name);
  if (!e) throw new Error(`Unknown prop "${name}"`);
  return e.sprite;
}
