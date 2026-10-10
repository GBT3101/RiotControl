/**
 * The Ministry's war-room map of Europe (E1): a worn map sheet painted in code from the
 * authored geography (`europeGeo*.ts`). Countries in graph-coloured RIOT-64 families with
 * coloured coastlines and a sunlit bevel, banded sea with wave marks and a dotted graticule,
 * lakes, major rivers, relief marks along the ranges, a compass rose and scale bar, printed
 * margins, tape and a coffee ring. Country / sea labels are separate pieces (the screen hides
 * any that a pin tag would cover). Pins and tags for the cities are drawn at UI scale.
 *
 * Everything is DOM-free and cached; `registerEurope` adds the pieces to the gallery and the
 * palette-compliance test.
 */
import { buf, col, hline, line, prng, px, rect, stamp, vline } from '../fx/draw';
import type { SpriteRegistry } from '../lib/registry';
import { createBuffer, setPixel, type PixelBuffer } from '../lib/pixels';
import { SHADOW_ALPHA, resolveColor } from '../palette';
import {
  LAKE,
  MAP_H,
  MAP_W,
  SEA,
  countryColours,
  europeGrid,
  parsePts,
  project,
  type EuropeGrid,
  type LandFamily,
} from './europeGeo';
import { RANGES, RIVERS, SEAS } from './europeGeo.grid';
import { FONTS, drawText, measureText, textSprite } from './text';

export { MAP_W, MAP_H, project } from './europeGeo';

/* ── Sheet geometry ─────────────────────────────────────────────────────────────────── */

/** Paper margin around the map (map px) and transparent overhang for the tape. */
export const SHEET_PAD = { top: 13, left: 7, right: 7, bottom: 12 } as const;
export const SHEET_OVER = 4;
/** Map origin inside the sheet buffer. */
export const MAP_OX = SHEET_OVER + SHEET_PAD.left;
export const MAP_OY = SHEET_OVER + SHEET_PAD.top;
export const SHEET_W = MAP_W + SHEET_PAD.left + SHEET_PAD.right + SHEET_OVER * 2;
export const SHEET_H = MAP_H + SHEET_PAD.top + SHEET_PAD.bottom + SHEET_OVER * 2;

/** Sea bands by distance from land: surf, shallows, deep. */
const SEA_SURF = 'zinc3';
const SEA_SHALLOW = 'zinc2';
const SEA_DEEP = 'zinc1';
const LAKE_COL = 'zinc3';
const BORDER_COL = 'stone0';

const idx = (g: EuropeGrid, x: number, y: number): number =>
  x < 0 || y < 0 || x >= g.w || y >= g.h ? SEA : g.ids[y * g.w + x]!;
const isLand = (v: number): boolean => v !== SEA && v !== LAKE;

/** Distance (4-steps, capped) from every sea pixel to the nearest land pixel. */
function seaDistance(g: EuropeGrid, cap = 14): Uint8Array {
  const d = new Uint8Array(g.w * g.h).fill(255);
  let frontier: number[] = [];
  for (let i = 0; i < g.ids.length; i++)
    if (isLand(g.ids[i]!)) {
      d[i] = 0;
      frontier.push(i);
    }
  for (let step = 1; step <= cap && frontier.length; step++) {
    const next: number[] = [];
    for (const i of frontier) {
      const x = i % g.w;
      const y = (i / g.w) | 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue;
        const j = yy * g.w + xx;
        if (d[j] !== 255 || isLand(g.ids[j]!)) continue;
        d[j] = step;
        next.push(j);
      }
    }
    frontier = next;
  }
  return d;
}

/* ── Labels ─────────────────────────────────────────────────────────────────────────── */

export interface MapLabel {
  /** Country id, or `sea:<name>`. */
  id: string;
  text: string;
  buf: PixelBuffer;
  /** Top-left in map px. */
  x: number;
  y: number;
}

/**
 * A label in the small font with a 1 px halo: straight (multi-line centred) or slanted, one
 * letter per `slant` step (halos first, so no letter's halo bites its neighbour).
 */
function labelSprite(
  text: string,
  ink: string,
  halo: string,
  tracking: number,
  slant?: readonly [number, number],
): PixelBuffer {
  if (!slant) {
    const lines = text.split('\n');
    return textSprite(FONTS.small, text, ink, {
      outline: halo,
      outlineThin: true,
      tracking,
      lineGap: -1,
      align: lines.length > 1 ? 'center' : undefined,
    });
  }
  const letters = [...text.replace(/\n/g, ' ')];
  const [sx, sy] = slant;
  const W = sx * (letters.length - 1) + 12;
  const H = Math.abs(sy) * (letters.length - 1) + FONTS.small.capHeight + 6;
  const b = buf(W, H);
  const y0 = sy < 0 ? H - FONTS.small.capHeight - 3 : 3;
  for (const pass of [0, 1])
    letters.forEach((ch, i) => {
      if (ch === ' ') return;
      const x = 2 + i * sx;
      const y = y0 + i * sy;
      if (pass === 0)
        drawText(b, FONTS.small, ch, x, y, halo, { outline: halo, outlineThin: true });
      else drawText(b, FONTS.small, ch, x, y, ink);
    });
  return trimBuf(b);
}

function trimBuf(b: PixelBuffer): PixelBuffer {
  let x0 = b.w;
  let y0 = b.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++)
      if (b.data[(y * b.w + x) * 4 + 3]) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  const out = buf(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = y0; y <= y1; y++)
    out.data.set(b.data.subarray((y * b.w + x0) * 4, (y * b.w + x1 + 1) * 4), (y - y0) * out.w * 4);
  return out;
}

/** Every opaque pixel of `l` (plus `m` around it) satisfies `ok`? */
function fits(
  g: EuropeGrid,
  l: PixelBuffer,
  x: number,
  y: number,
  m: number,
  ok: (v: number, x: number, y: number) => boolean,
): boolean {
  if (x - m < 0 || y - m < 0 || x + l.w + m > g.w || y + l.h + m > g.h) return false;
  for (let yy = 0; yy < l.h; yy++)
    for (let xx = 0; xx < l.w; xx++) {
      if (!l.data[(yy * l.w + xx) * 4 + 3]) continue;
      for (let dy = -m; dy <= m; dy++)
        for (let dx = -m; dx <= m; dx++) {
          const X = x + xx + dx;
          const Y = y + yy + dy;
          if (!ok(g.ids[Y * g.w + X]!, X, Y)) return false;
        }
    }
  return true;
}

/** Distance (4-steps) from every pixel to the nearest pixel of another region. */
function regionDistance(g: EuropeGrid): Uint8Array {
  const d = new Uint8Array(g.w * g.h).fill(255);
  let frontier: number[] = [];
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) {
      const v = g.ids[y * g.w + x]!;
      const edge =
        x === 0 ||
        y === 0 ||
        x === g.w - 1 ||
        y === g.h - 1 ||
        g.ids[y * g.w + x - 1] !== v ||
        g.ids[y * g.w + x + 1] !== v ||
        g.ids[(y - 1) * g.w + x] !== v ||
        g.ids[(y + 1) * g.w + x] !== v;
      if (edge) {
        d[y * g.w + x] = 0;
        frontier.push(y * g.w + x);
      }
    }
  for (let step = 1; frontier.length && step < 255; step++) {
    const next: number[] = [];
    for (const i of frontier) {
      const v = g.ids[i]!;
      for (const j of [i - 1, i + 1, i - g.w, i + g.w]) {
        if (j < 0 || j >= d.length || d[j] !== 255 || g.ids[j] !== v) continue;
        d[j] = step;
        next.push(j);
      }
    }
    frontier = next;
  }
  return d;
}

let labelCache: MapLabel[] | null = null;

/**
 * Country and sea labels that fit. Each tries its names (straight with letter-spacing, then
 * tight, then slanted) at its label point and then at the roomiest spots of its land (or
 * sea), and is left unlabelled when nothing fits.
 */
export function mapLabels(): MapLabel[] {
  if (labelCache) return labelCache;
  const g = europeGrid();
  const fams = countryColours(g);
  const room = regionDistance(g);
  const dist = seaDistance(g);
  const out: MapLabel[] = [];
  const taken: { x: number; y: number; w: number; h: number }[] = [];
  const free = (x: number, y: number, w: number, h: number): boolean =>
    !taken.some(
      (t) => x < t.x + t.w + 2 && t.x < x + w + 2 && y < t.y + t.h + 2 && t.y < y + h + 2,
    );
  // Roomiest pixels of each region, best first (≥ 3 px apart).
  const spots = new Map<number, { x: number; y: number }[]>();
  // Bucket the pixels by room (largest first) instead of sorting 200k indices.
  const buckets: number[][] = [];
  for (let i = 0; i < room.length; i++) {
    const r = room[i]!;
    if (r >= 3 && r < 255) (buckets[r] ??= []).push(i);
  }
  const order = buckets.reverse().flatMap((b) => b ?? []);
  for (const i of order) {
    const v = g.ids[i]!;
    const list = spots.get(v) ?? [];
    if (list.length >= 24) continue;
    const x = i % g.w;
    const y = (i / g.w) | 0;
    if (list.some((p) => Math.abs(p.x - x) + Math.abs(p.y - y) < 3)) continue;
    list.push({ x, y });
    spots.set(v, list);
  }
  const place = (
    id: string,
    names: readonly string[],
    centres: { x: number; y: number }[],
    variants: (name: string) => PixelBuffer[],
    ok: (v: number, x: number, y: number) => boolean,
  ): void => {
    for (const name of names) {
      if (!name) return;
      for (const b of variants(name))
        for (const c of centres)
          for (let r = 0; r <= 2; r++)
            for (let dy = -r; dy <= r; dy++)
              for (let dx = -r; dx <= r; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                const x = Math.round(c.x - b.w / 2) + dx;
                const y = Math.round(c.y - b.h / 2) + dy;
                if (!free(x, y, b.w, b.h) || !fits(g, b, x, y, 0, ok)) continue;
                out.push({ id, text: name, buf: b, x, y });
                taken.push({ x, y, w: b.w, h: b.h });
                return;
              }
    }
  };
  // Big countries first: small neighbours take what room is left.
  const area = new Map<number, number>();
  for (const v of g.ids) area.set(v, (area.get(v) ?? 0) + 1);
  const byArea = g.countries
    .map((c, k) => ({ c, k }))
    .sort((a, b) => (area.get(b.k + 1) ?? 0) - (area.get(a.k + 1) ?? 0));
  byArea.forEach(({ c, k }) => {
    if (!c.label || !c.names[0]) return;
    const fam = fams.get(c.id)!;
    const p = project(c.label[0], c.label[1]);
    const centres = [p, ...(spots.get(k + 1) ?? [])];
    // An authored slant reads best along long countries (Italy's boot): it goes first.
    const variants = (name: string): PixelBuffer[] => {
      const v: PixelBuffer[] = [];
      const slanted =
        c.slant && name.length > 2 ? [labelSprite(name, fam.dark, fam.fill, 0, c.slant)] : [];
      if (name === c.names[0]) v.push(...slanted);
      if (name.length <= 8 && !name.includes('.')) v.push(labelSprite(name, fam.dark, fam.fill, 1));
      v.push(labelSprite(name, fam.dark, fam.fill, 0));
      if (name !== c.names[0]) v.push(...slanted);
      return v;
    };
    place(c.id, c.names, centres, variants, (v) => v === k + 1 || v === LAKE);
  });
  for (const s of SEAS) {
    const p = project(s.at[0], s.at[1]);
    const variants = (name: string): PixelBuffer[] =>
      s.slant
        ? [labelSprite(name, SEA_SURF, SEA_DEEP, 0, s.slant)]
        : [labelSprite(name, SEA_SURF, SEA_DEEP, 1), labelSprite(name, SEA_SURF, SEA_DEEP, 0)];
    const ring: { x: number; y: number }[] = [p];
    for (let r = 2; r <= 10; r += 2)
      for (let a = 0; a < 8; a++)
        ring.push({
          x: p.x + Math.cos((a * Math.PI) / 4) * r,
          y: p.y + Math.sin((a * Math.PI) / 4) * r,
        });
    place(
      `sea:${s.name}`,
      [s.name],
      ring,
      variants,
      (v, x, y) => v === SEA && dist[y * g.w + x]! >= 2,
    );
  }
  labelCache = out;
  return out;
}

/* ── Relief marks ───────────────────────────────────────────────────────────────────── */

// Small ridge (5×3) and big snow-capped peak (7×4): L sunlit, S shade, W snow, D dark base.
const PEAK_S = ['..L..', '.LLS.', 'LLSSS'];
const PEAK_B = ['...W...', '..WWS..', '.LLLSS.', 'LLLSSSS'];
const BIG_RANGES = new Set([0, 1, 15]);

/* ── The map body ───────────────────────────────────────────────────────────────────── */

/** Projected polyline in map px. */
const projected = (src: string): { x: number; y: number }[] =>
  parsePts(src).map(([lon, lat]) => project(lon, lat));

/** Walk a polyline in ~unit steps, calling `at` with integer pixels (deduplicated). */
function walk(
  pts: { x: number; y: number }[],
  step: number,
  at: (x: number, y: number, i: number) => void,
): void {
  let carry = 0;
  let i = 0;
  let last = '';
  for (let k = 0; k + 1 < pts.length; k++) {
    const a = pts[k]!;
    const b = pts[k + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    for (let t = carry; t <= len; t += step) {
      const x = Math.floor(a.x + ((b.x - a.x) * t) / (len || 1));
      const y = Math.floor(a.y + ((b.y - a.y) * t) / (len || 1));
      const key = `${x},${y}`;
      if (key !== last) at(x, y, i++);
      last = key;
      carry = t + step - len;
    }
  }
}

interface MapLayers {
  body: PixelBuffer;
  /** Per-pixel role: 0 sea, 1 land interior, 2 coast, 3 border, 4 river, 5 relief, 6 lake. */
  role: Uint8Array;
  dist: Uint8Array;
}

let layersCache: MapLayers | null = null;

function paintBody(): MapLayers {
  if (layersCache) return layersCache;
  const g = europeGrid();
  const fams = countryColours(g);
  const famOf = (v: number): LandFamily => fams.get(g.countries[v - 1]!.id)!;
  const W = g.w;
  const H = g.h;
  const b = createBuffer(W, H);
  const role = new Uint8Array(W * H);
  const dist = seaDistance(g);
  const C = (ref: string): number => col(ref);
  // Sea bands.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const v = g.ids[i]!;
      if (v === SEA) {
        const d = dist[i]!;
        setPixel(b, x, y, C(d <= 1 ? SEA_SURF : d <= 4 ? SEA_SHALLOW : SEA_DEEP));
      } else if (v === LAKE) {
        setPixel(b, x, y, C(LAKE_COL));
        role[i] = 6;
      }
    }
  // Graticule: dotted meridians / parallels every 10° over open sea.
  const grat = (pts: { x: number; y: number }[]): void =>
    walk(pts, 0.5, (x, y) => {
      if (x < 0 || y < 0 || x >= W || y >= H || (x + y) % 2) return;
      const i = y * W + x;
      if (g.ids[i] !== SEA || dist[i]! < 3) return;
      setPixel(b, x, y, C(dist[i]! <= 4 ? SEA_DEEP : SEA_SHALLOW));
    });
  for (let lon = -40; lon <= 80; lon += 10) {
    const pts = [];
    for (let lat = 25; lat <= 80; lat += 0.5) pts.push(project(lon, lat));
    grat(pts);
  }
  for (let lat = 30; lat <= 80; lat += 10) {
    const pts = [];
    for (let lon = -40; lon <= 80; lon += 0.5) pts.push(project(lon, lat));
    grat(pts);
  }
  // Land: fill, coast, borders, sunlit bevel.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const v = g.ids[i]!;
      if (!isLand(v)) continue;
      const f = famOf(v);
      const n4 = [idx(g, x - 1, y), idx(g, x + 1, y), idx(g, x, y - 1), idx(g, x, y + 1)];
      // Off-sheet edges count as land (the map is cut, not coastline).
      if (x === 0) n4[0] = v;
      if (x === W - 1) n4[1] = v;
      if (y === 0) n4[2] = v;
      if (y === H - 1) n4[3] = v;
      if (n4.some((q) => !isLand(q))) {
        setPixel(b, x, y, C(f.dark));
        role[i] = 2;
      } else if ((isLand(n4[1]!) && n4[1] !== v) || (isLand(n4[3]!) && n4[3] !== v)) {
        setPixel(b, x, y, C(BORDER_COL));
        role[i] = 3;
      } else {
        setPixel(b, x, y, C(f.fill));
        role[i] = 1;
      }
    }
  // Bevel: the land just inside a coast is lit on its upper-left side, shaded lower-right.
  const roleAt = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= W || y >= H ? 1 : role[y * W + x]!;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (role[i] !== 1) continue;
      const f = famOf(g.ids[i]!);
      const up = roleAt(x, y - 1) === 2 || roleAt(x - 1, y) === 2;
      const down = roleAt(x, y + 1) === 2 || roleAt(x + 1, y) === 2;
      if (up && !down) setPixel(b, x, y, C(f.light));
      else if (down && !up) setPixel(b, x, y, C(f.shade));
    }
  // Label boxes stay clear of rivers and relief.
  const labels = mapLabels();
  const inLabel = (x: number, y: number): boolean =>
    labels.some(
      (l) => x >= l.x - 1 && y >= l.y - 1 && x < l.x + l.buf.w + 1 && y < l.y + l.buf.h + 1,
    );
  // Rivers.
  for (const r of RIVERS)
    walk(projected(r), 0.4, (x, y) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = y * W + x;
      if (role[i] !== 1 || inLabel(x, y)) return;
      setPixel(b, x, y, C(LAKE_COL));
      role[i] = 4;
    });
  // Relief marks along the ranges.
  RANGES.forEach((r, ri) => {
    const big = BIG_RANGES.has(ri);
    const glyph = big ? PEAK_B : PEAK_S;
    const gw = glyph[0]!.length;
    const gh = glyph.length;
    walk(projected(r), big ? 6 : 5, (cx, cy, n) => {
      const ox = cx - (gw >> 1) + (n % 2 ? 1 : 0);
      const oy = cy - gh + 1 + (n % 3 === 1 ? 1 : n % 3 === 2 ? -1 : 0);
      // Whole glyph (+1 px margin) on plain land of one country.
      let v0 = -1;
      for (let yy = oy - 1; yy <= oy + gh; yy++)
        for (let xx = ox - 1; xx <= ox + gw; xx++) {
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) return;
          const i = yy * W + xx;
          if (role[i] !== 1 && role[i] !== 5) return;
          if (v0 < 0) v0 = g.ids[i]!;
          else if (g.ids[i] !== v0) return;
          if (inLabel(xx, yy)) return;
        }
      const f = famOf(v0);
      for (let yy = 0; yy < gh; yy++)
        for (let xx = 0; xx < gw; xx++) {
          const ch = glyph[yy]![xx]!;
          if (ch === '.') continue;
          const ref = ch === 'L' ? f.light : ch === 'S' ? f.dark : ch === 'W' ? 'white' : f.shade;
          setPixel(b, ox + xx, oy + yy, C(ref));
          role[(oy + yy) * W + ox + xx] = 5;
        }
    });
  });
  layersCache = { body: b, role, dist };
  return layersCache;
}

/* ── Sheet dressing ─────────────────────────────────────────────────────────────────── */

/** Swatch → its coffee-stained neighbour (palette-safe "translucent" brown). */
const STAIN: Record<string, string> = {
  zinc1: 'stone0',
  zinc2: 'stone1',
  zinc3: 'stone2',
  stone0: 'earth1',
  stone1: 'earth2',
  stone2: 'earth3',
  stone3: 'earth4',
  stone4: 'stone3',
  stone5: 'stone4',
  earth5: 'earth4',
  earth6: 'earth5',
  earth7: 'earth6',
  green4: 'olive2',
  green3: 'olive1',
  lime: 'hivis1',
  lilac: 'stone2',
  pink3: 'earth6',
  ochre3: 'ochre2',
  ochre4: 'stone4',
  gray7: 'stone3',
  gray6: 'stone2',
  white: 'stone4',
};
const SWATCH_BY_RGBA = new Map<number, string>(
  [...Object.keys(STAIN), ...Object.values(STAIN)].map((n) => [resolveColor(n) >>> 0, n]),
);

function stainPx(b: PixelBuffer, x: number, y: number): void {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
  const i = (y * b.w + x) * 4;
  if (b.data[i + 3] !== 255) return;
  const c = ((b.data[i]! << 24) | (b.data[i + 1]! << 16) | (b.data[i + 2]! << 8) | 255) >>> 0;
  const name = SWATCH_BY_RGBA.get(c);
  px(b, x, y, name && STAIN[name] ? STAIN[name] : 'earth3');
}

/** A coffee-cup ring: a broken 1-px stain circle with a heavier lower-right lip. */
function coffeeRing(b: PixelBuffer, cx: number, cy: number, r: number, seed: number): void {
  const rnd = prng(seed);
  const gapA = rnd() * Math.PI * 2;
  for (let a = 0; a < Math.PI * 2; a += 0.5 / r) {
    const d = Math.abs(((a - gapA + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (d < 0.35) continue;
    const x = Math.round(cx + Math.cos(a) * r);
    const y = Math.round(cy + Math.sin(a) * r);
    stainPx(b, x, y);
    // The lip: thicker on the lower right.
    if (Math.cos(a - Math.PI / 4) > 0.55)
      stainPx(b, Math.round(cx + Math.cos(a) * (r - 1)), Math.round(cy + Math.sin(a) * (r - 1)));
  }
  // A drip.
  const da = gapA + Math.PI * 0.8;
  for (let k = 1; k <= 3; k++)
    stainPx(b, Math.round(cx + Math.cos(da) * (r + k)), Math.round(cy + Math.sin(da) * (r + k)));
}

/** 31×31 compass rose (north point crimson), lit from the upper left, on a thin ring. */
export function compassRose(): PixelBuffer {
  const S = 31;
  const c = (S - 1) / 2;
  const b = buf(S, S);
  // Ring with tick marks every 30°.
  for (let a = 0; a < Math.PI * 2; a += 0.01) {
    px(b, Math.round(c + Math.cos(a) * 11), Math.round(c + Math.sin(a) * 11), 'zinc3');
  }
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6;
    px(b, Math.round(c + Math.cos(a) * 12), Math.round(c + Math.sin(a) * 12), 'zinc3');
  }
  // Star points: long cardinals, short diagonals; each split into a lit and a shaded half.
  const star = buf(S, S);
  const point = (
    dx: number,
    dy: number,
    len: number,
    wid: number,
    litCol: string,
    shadeCol: string,
  ): void => {
    const nx = -dy;
    const ny = dx;
    for (let t = 0; t <= len; t += 0.2)
      for (let s = -wid; s <= wid; s += 0.2) {
        if (Math.abs(s) > wid * (1 - t / len) + 0.1) continue;
        const x = Math.round(c + dx * t + nx * s);
        const y = Math.round(c + dy * t + ny * s);
        // The half whose face looks up / left catches the sun.
        const lit = -(nx + ny) * Math.sign(s) > 0;
        px(star, x, y, lit || s === 0 ? litCol : shadeCol);
      }
  };
  const d = Math.SQRT1_2;
  for (const [dx, dy] of [
    [d, d],
    [-d, d],
    [d, -d],
    [-d, -d],
  ] as const)
    point(dx, dy, 9, 2, 'stone4', 'stone2');
  point(1, 0, 14, 3, 'stone5', 'stone3');
  point(-1, 0, 14, 3, 'stone5', 'stone3');
  point(0, 1, 14, 3, 'stone5', 'stone3');
  point(0, -1, 14, 3, 'crim2', 'crim1');
  // Ink outline around the star only, then the brass hub.
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (star.data[(y * S + x) * 4 + 3]) continue;
      const touch = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => {
        const xx = x + dx!;
        const yy = y + dy!;
        return xx >= 0 && yy >= 0 && xx < S && yy < S && star.data[(yy * S + xx) * 4 + 3] === 255;
      });
      if (touch) px(b, x, y, 'ink');
    }
  stamp(b, star, 0, 0);
  px(b, c, c, 'ochre3');
  px(b, c - 1, c, 'ochre2');
  px(b, c, c - 1, 'ochre3');
  px(b, c + 1, c, 'ochre1');
  px(b, c, c + 1, 'ochre1');
  return b;
}

/** Scale bar: 0–500 km in alternating 100 km blocks (10 map px each). */
function scaleBar(b: PixelBuffer, x: number, y: number): void {
  for (let k = 0; k < 5; k++) rect(b, x + k * 10, y, 10, 2, k % 2 ? 'stone5' : 'ink');
  rect(b, x - 1, y - 1, 52, 1, 'ink');
  rect(b, x - 1, y + 2, 52, 1, 'ink');
  vline(b, x - 1, y - 1, 4, 'ink');
  vline(b, x + 50, y - 1, 4, 'ink');
  drawText(b, FONTS.small, '0', x - 2, y + 5, 'zinc4');
  drawText(
    b,
    FONTS.small,
    '500 KM',
    x + 50 - measureText(FONTS.small, '500 KM').w + 3,
    y + 5,
    'zinc4',
  );
}

/** A strip of masking tape across a corner (diagonal band, serrated ends). */
function tape(b: PixelBuffer, x0: number, y0: number, dir: 1 | -1, len = 17, wid = 6): void {
  for (let t = 0; t < len; t++)
    for (let s = 0; s < wid; s++) {
      // Serrated ends: every other row is one pixel shorter.
      if ((t === 0 || t === len - 1) && s % 2) continue;
      const x = x0 + dir * (t + s);
      const y = y0 + t - s;
      const edge = s === 0 || s === wid - 1;
      px(b, x, y, edge ? 'stone3' : t % 5 === 2 && s === 2 ? 'stone4' : 'stone5');
      // Fill the diagonal gaps.
      px(b, x + dir, y, edge && s === wid - 1 ? 'stone3' : 'stone5');
    }
}

let sheetCache: PixelBuffer | null = null;

/** The whole map sheet (paper, printed margins, map, dressing). Cached. */
export function europeSheet(): PixelBuffer {
  if (sheetCache) return sheetCache;
  const { body } = paintBody();
  const b = buf(SHEET_W, SHEET_H);
  const o = SHEET_OVER;
  const pw = SHEET_W - o * 2;
  const ph = SHEET_H - o * 2;
  // Paper with a darker deckle edge.
  rect(b, o, o, pw, ph, 'stone4');
  hline(b, o, o, pw, 'stone3');
  vline(b, o, o, ph, 'stone3');
  hline(b, o, o + ph - 1, pw, 'stone2');
  vline(b, o + pw - 1, o, ph, 'stone2');
  // Foxing: a few aged spots on the margin (deterministic).
  const rnd = prng(41);
  for (let k = 0; k < 26; k++) {
    const x = o + 1 + Math.floor(rnd() * (pw - 2));
    const y = o + 1 + Math.floor(rnd() * (ph - 2));
    if (x > MAP_OX - 2 && x < MAP_OX + MAP_W + 1 && y > MAP_OY - 2 && y < MAP_OY + MAP_H + 1)
      continue;
    px(b, x, y, 'stone3');
  }
  // Neat lines: a thin outer rule and the map frame.
  const fx = MAP_OX - 3;
  const fy = MAP_OY - 3;
  const fw = MAP_W + 6;
  const fh = MAP_H + 6;
  hline(b, fx, fy, fw, 'stone1');
  hline(b, fx, fy + fh - 1, fw, 'stone1');
  vline(b, fx, fy, fh, 'stone1');
  vline(b, fx + fw - 1, fy, fh, 'stone1');
  rect(b, MAP_OX - 1, MAP_OY - 1, MAP_W + 2, MAP_H + 2, 'ink');
  stamp(b, body, MAP_OX, MAP_OY);
  // Printed margins.
  const title = 'MINISTRY OF THE INTERIOR · CONTINENTAL OPERATIONS · SHEET E-1';
  drawText(b, FONTS.small, title, MAP_OX + 18, o + 3, 'stone1');
  const cls = 'CLASSIFIED';
  drawText(
    b,
    FONTS.smallBold,
    cls,
    MAP_OX + MAP_W - 18 - measureText(FONTS.smallBold, cls).w,
    o + 3,
    'crim1',
  );
  const foot = 'NOT FOR PUBLIC DISTRIBUTION · BORDERS SUBJECT TO MINISTERIAL MOOD';
  drawText(b, FONTS.small, foot, MAP_OX, MAP_OY + MAP_H + 4, 'stone2');
  const scale = 'SCALE 1:10,000,000';
  drawText(
    b,
    FONTS.small,
    scale,
    MAP_OX + MAP_W - measureText(FONTS.small, scale).w,
    MAP_OY + MAP_H + 4,
    'stone2',
  );
  // Compass rose and scale bar in the open Atlantic.
  const rose = compassRose();
  const rp = { x: 20, y: 140 };
  stamp(b, rose, MAP_OX + rp.x, MAP_OY + rp.y);
  drawText(b, FONTS.smallBold, 'N', MAP_OX + rp.x + 13, MAP_OY + rp.y - 9, 'stone5', {
    outline: 'ink',
    outlineThin: true,
  });
  scaleBar(b, MAP_OX + 11, MAP_OY + 184);
  // Fold creases: a lit line with a shaded line beside it.
  const crease = (x0: number, y0: number, horiz: boolean, len: number): void => {
    for (let t = 0; t < len; t++) {
      const x = horiz ? x0 + t : x0;
      const y = horiz ? y0 : y0 + t;
      if ((t * 7) % 11 === 3) continue;
      lighten(b, x, y);
      stainPx(b, horiz ? x : x + 1, horiz ? y + 1 : y);
    }
  };
  crease(MAP_OX + Math.floor(MAP_W / 2), o + 1, false, ph - 2);
  crease(o + 1, MAP_OY + Math.floor(MAP_H / 2) + 6, true, pw - 2);
  // Coffee ring over the steppe; tape on the top corners.
  coffeeRing(b, MAP_OX + 432, MAP_OY + 92, 15, 7);
  tape(b, 1, 6, 1);
  tape(b, SHEET_W - 2, 6, -1);
  sheetCache = b;
  return b;
}

/** Swatch → a lighter neighbour (crease highlight). */
const LIGHTER: Record<string, string> = {
  zinc1: 'zinc2',
  zinc2: 'zinc3',
  zinc3: 'zinc4',
  stone0: 'stone1',
  stone1: 'stone2',
  stone2: 'stone3',
  stone3: 'stone4',
  stone4: 'stone5',
  earth2: 'earth3',
  earth3: 'earth4',
  earth5: 'earth6',
  earth6: 'earth7',
  green1: 'green2',
  green3: 'green4',
  green4: 'lime',
  lilac: 'pink3',
  plum1: 'purple',
  ochre1: 'ochre2',
  ochre2: 'ochre3',
  ochre3: 'ochre4',
  pink1: 'pink2',
  pink3: 'white',
  gray3: 'gray4',
  gray6: 'gray7',
  gray7: 'white',
  ink: 'gray1',
};
const LIGHT_BY_RGBA = new Map<number, string>(
  Object.keys(LIGHTER).map((n) => [resolveColor(n) >>> 0, n]),
);

function lighten(b: PixelBuffer, x: number, y: number): void {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
  const i = (y * b.w + x) * 4;
  if (b.data[i + 3] !== 255) return;
  const c = ((b.data[i]! << 24) | (b.data[i + 1]! << 16) | (b.data[i + 2]! << 8) | 255) >>> 0;
  const name = LIGHT_BY_RGBA.get(c);
  if (name) px(b, x, y, LIGHTER[name]!);
}

/* ── Waves (animated overlay) ───────────────────────────────────────────────────────── */

export const WAVE_FRAMES = 4;
let waveCache: PixelBuffer[] | null = null;

/**
 * Wave marks over the open sea, as transparent overlays the size of the sheet: each mark
 * rocks between two shapes on its own phase (a slow shimmer; frame 0 is the still sea).
 */
export function europeWaves(): PixelBuffer[] {
  if (waveCache) return waveCache;
  const g = europeGrid();
  const { dist } = paintBody();
  const frames = Array.from({ length: WAVE_FRAMES }, () => buf(SHEET_W, SHEET_H));
  const labels = mapLabels();
  const rnd = prng(1234);
  const A = [
    [0, 1],
    [1, 0],
    [2, 0],
    [3, 1],
  ];
  const B = [
    [0, 1],
    [1, 1],
    [2, 0],
    [3, 0],
  ];
  const deep = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < g.w && y < g.h && g.ids[y * g.w + x] === SEA && dist[y * g.w + x]! >= 4;
  for (let cy = 4; cy < g.h - 4; cy += 9)
    for (let cx = 3; cx < g.w - 6; cx += 13) {
      const x = cx + Math.floor(rnd() * 8) + ((cy / 9) % 2 ? 6 : 0);
      const y = cy + Math.floor(rnd() * 4);
      const phase = Math.floor(rnd() * WAVE_FRAMES);
      let ok = true;
      for (let yy = y - 1; yy <= y + 2 && ok; yy++)
        for (let xx = x - 1; xx <= x + 4 && ok; xx++) ok = deep(xx, yy);
      if (!ok) continue;
      if (
        labels.some(
          (l) => x + 4 >= l.x - 1 && x <= l.x + l.buf.w && y + 2 >= l.y - 1 && y <= l.y + l.buf.h,
        )
      )
        continue;
      const near = dist[y * g.w + x]! <= 4;
      frames.forEach((f, k) => {
        const shape = (k + phase) % WAVE_FRAMES < 2 || k === 0 ? A : B;
        for (const [dx, dy] of shape)
          px(f, MAP_OX + x + dx!, MAP_OY + y + dy!, near ? SEA_SURF : SEA_SHALLOW);
      });
    }
  waveCache = frames;
  return frames;
}

/* ── Desk ───────────────────────────────────────────────────────────────────────────── */

/** 128×64 seamless desk tile: long dark oak planks with grain, seams and a knot. */
export function deskTile(): PixelBuffer {
  const W = 128;
  const H = 64;
  const b = buf(W, H);
  rect(b, 0, 0, W, H, 'earth1');
  const rnd = prng(77);
  for (let p = 0; p < 4; p++) {
    const y0 = p * 16;
    hline(b, 0, y0, W, 'earth0');
    hline(b, 0, y0 + 1, W, 'earth2');
    // Grain: long, gently drifting lines (planks run the whole tile: no butt joints).
    for (let k = 0; k < 4; k++) {
      let gy = y0 + 3 + k * 3 + Math.floor(rnd() * 2);
      const start = Math.floor(rnd() * W);
      const len = 50 + Math.floor(rnd() * 60);
      for (let t = 0; t < len; t++) {
        const x = (start + t) % W;
        if (t % 29 === 28) gy += rnd() < 0.5 ? 1 : -1;
        gy = Math.max(y0 + 3, Math.min(y0 + 14, gy));
        if (t % 13 !== 12) px(b, x, gy, k % 2 ? 'earth2' : 'earth0');
      }
    }
  }
  // A knot.
  for (const [x, y, c] of [
    [84, 41, 'earth0'],
    [85, 41, 'earth0'],
    [83, 42, 'rust0'],
    [86, 42, 'rust0'],
    [84, 43, 'earth0'],
    [85, 43, 'earth0'],
    [84, 42, 'earth2'],
  ] as const)
    px(b, x, y, c);
  return b;
}

/* ── Pins, tags, markers (UI px) ────────────────────────────────────────────────────── */

export type PinKind = 'built' | 'unbuilt';

const PIN_ROWS = [
  '..ooo..',
  '.oHlmo.',
  'oHlmmdo',
  'olmmmdo',
  'ommmddo',
  '.odddo.',
  '..ooo..',
  '...n...',
  '...n...',
  '...n...',
  '...N...',
];
/** Pin size and anchor (needle tip) in UI px. */
export const PIN_W = 7;
export const PIN_H = 12;
export const PIN_ANCHOR = { x: 3, y: 10 };

const PIN_COLS: Record<PinKind, Record<string, string>> = {
  built: { o: 'rust0', H: 'white', l: 'rust4', m: 'crim2', d: 'crim1', n: 'gray5', N: 'gray3' },
  unbuilt: { o: 'gray2', H: 'white', l: 'gray7', m: 'gray6', d: 'gray4', n: 'gray5', N: 'gray3' },
};

/** A push pin (needle tip at PIN_ANCHOR) with its shadow: red when built, grey when not. */
export function pinSprite(kind: PinKind, lifted = false): PixelBuffer {
  const b = createBuffer(PIN_W + 3, PIN_H);
  const lift = lifted ? 1 : 0;
  // Shadow falls to the lower right of the needle.
  const sh = (resolveColor('ink') & 0xffffff00) | SHADOW_ALPHA;
  setPixel(b, PIN_ANCHOR.x + 1, PIN_ANCHOR.y + 1, sh);
  setPixel(b, PIN_ANCHOR.x + 2, PIN_ANCHOR.y + 1, sh);
  if (lifted) setPixel(b, PIN_ANCHOR.x + 3, PIN_ANCHOR.y, sh);
  PIN_ROWS.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const ref = PIN_COLS[kind][ch];
      if (!ref) return;
      const yy = ch === 'n' || ch === 'N' ? y : y - lift;
      px(b, x, yy, ref);
    });
  });
  return b;
}

export interface TagStyle {
  paper: string;
  edge: string;
  ink: string;
}

export const TAG_STYLES: Record<'built' | 'unbuilt' | 'selected', TagStyle> = {
  built: { paper: 'stone5', edge: 'stone1', ink: 'ink' },
  unbuilt: { paper: 'gray7', edge: 'gray4', ink: 'gray2' },
  selected: { paper: 'ink', edge: 'ochre2', ink: 'ochre3' },
};

/** Tag box size for a label (UI px): 1 px edge, 2 px padding, small caps. */
export function tagSize(text: string, ribbon?: string, hazard = false): { w: number; h: number } {
  const m = measureText(FONTS.small, text.toUpperCase());
  const w = m.w + 6 + (hazard ? 5 : 0);
  const h = FONTS.small.capHeight + 6;
  if (!ribbon) return { w, h };
  const r = measureText(FONTS.smallBold, ribbon);
  return { w: Math.max(w, r.w + 6), h: h + FONTS.smallBold.capHeight + 5 };
}

/**
 * A paper tag with a city name, an optional red ribbon line above it and, for cities still
 * being built, a strip of hazard tape down its left edge.
 */
export function tagSprite(
  text: string,
  style: TagStyle,
  ribbon?: string,
  hazard = false,
): PixelBuffer {
  const { w, h } = tagSize(text, ribbon, hazard);
  const b = buf(w, h);
  let y0 = 0;
  if (ribbon) {
    const rh = FONTS.smallBold.capHeight + 5;
    rect(b, 0, 0, w, rh, 'rust0');
    rect(b, 1, 1, w - 2, rh - 2, 'crim2');
    hline(b, 1, 1, w - 2, 'rust4');
    const rw = measureText(FONTS.smallBold, ribbon).w;
    drawText(b, FONTS.smallBold, ribbon, Math.floor((w - rw) / 2), 2, 'white');
    y0 = rh;
  }
  const th = h - y0;
  rect(b, 0, y0, w, th, style.edge);
  rect(b, 1, y0 + 1, w - 2, th - 2, style.paper);
  let tx = 0;
  if (hazard) {
    // Construction tape: diagonal yellow / ink stripes, 4 px wide.
    for (let y = y0 + 1; y < h - 1; y++)
      for (let x = 1; x < 5; x++) px(b, x, y, Math.floor((x + y) / 2) % 2 ? 'ink' : 'hivis2');
    vline(b, 5, y0 + 1, th - 2, style.edge);
    tx = 5;
  }
  const tw = measureText(FONTS.small, text.toUpperCase()).w;
  drawText(
    b,
    FONTS.small,
    text.toUpperCase(),
    tx + Math.floor((w - tx - tw) / 2),
    y0 + 3,
    style.ink,
  );
  return b;
}

/** Pulsing ring frames around a selected / first-visit pin (UI px, centred). */
export function pulseFrames(colour = 'ochre3'): PixelBuffer[] {
  const out: PixelBuffer[] = [];
  for (const r of [4, 6, 8, 10]) {
    const S = 23;
    const b = buf(S, Math.ceil(S / 2) + 2);
    const c = (S - 1) / 2;
    const cy = Math.floor(b.h / 2);
    for (let a = 0; a < Math.PI * 2; a += 0.03) {
      const x = Math.round(c + Math.cos(a) * r);
      const y = Math.round(cy + Math.sin(a) * r * 0.5);
      px(b, x, y, r >= 10 ? 'ochre1' : colour);
    }
    out.push(b);
  }
  return out;
}

/** A leader thread (1 px, crimson) from (0,0) to (x,y) drawn into `b` at offset (ox, oy). */
export function thread(b: PixelBuffer, ox: number, oy: number, x: number, y: number): void {
  line(b, ox, oy, ox + x, oy + y, 'crim1');
}

/* ── Registration ───────────────────────────────────────────────────────────────────── */

export function registerEurope(reg: SpriteRegistry): void {
  const g = 'europe';
  reg.add('ui.europe.pin.built', {
    group: g,
    frames: pinSprite('built'),
    anchor: PIN_ANCHOR,
    hasShadow: true,
  });
  reg.add('ui.europe.pin.unbuilt', {
    group: g,
    frames: pinSprite('unbuilt'),
    anchor: PIN_ANCHOR,
    hasShadow: true,
  });
  reg.add('ui.europe.compass', { group: g, frames: compassRose() });
  reg.add('ui.europe.desk', { group: g, frames: deskTile(), anchor: { x: 0, y: 0 } });
  reg.add('ui.europe.tag.built', { group: g, frames: tagSprite('Madrid', TAG_STYLES.built) });
  reg.add('ui.europe.tag.unbuilt', {
    group: g,
    frames: tagSprite('Budapest', TAG_STYLES.unbuilt, 'LEVEL 1 · TUTORIAL', true),
  });
  reg.add('ui.europe.pulse', { group: g, frames: pulseFrames(), fps: 6 });
}
