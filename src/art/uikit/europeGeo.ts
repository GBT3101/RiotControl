/**
 * Europe geometry for the campaign map (E1): projection, ring assembly from the shared-border
 * arcs in `europeGeo.grid.ts`, scanline rasterisation to a country-id grid, neighbour graph
 * and the graph colouring that gives every country its own colour (no two neighbours alike).
 * Pure and DOM-free (Node tests use it directly).
 */
import { ARCS, COUNTRIES, LAKES, type CountrySrc } from './europeGeo.grid';

/* ── Projection ─────────────────────────────────────────────────────────────────────── */

/**
 * Lambert azimuthal equal-area centred on 10°E 52°N (the EU's ETRS-LAEA view), 10 km per
 * map pixel. The sheet spans Iceland/Portugal to the Urals and North Cape to the African coast.
 */
export const PROJ = { lon0: 10, lat0: 52, kmPerPx: 10, x0: -2000, y0: -2280 } as const;
export const MAP_W = 490;
export const MAP_H = 423;

const R = 6371;
const D = Math.PI / 180;

/** lon/lat (degrees) → map pixel coordinates (float; pixel (x, y) covers [x, x+1)). */
export function project(lon: number, lat: number): { x: number; y: number } {
  const l = (lon - PROJ.lon0) * D;
  const p = lat * D;
  const p0 = PROJ.lat0 * D;
  const k = Math.sqrt(
    2 / (1 + Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l)),
  );
  const x = R * k * Math.cos(p) * Math.sin(l);
  const y = -R * k * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l));
  return { x: (x - PROJ.x0) / PROJ.kmPerPx, y: (y - PROJ.y0) / PROJ.kmPerPx };
}

/* ── Polylines & rings ──────────────────────────────────────────────────────────────── */

export type LonLat = readonly [number, number];

/** "lon lat, lon lat, …" → points. */
export function parsePts(src: string): LonLat[] {
  return src
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [a, b] = s.split(/\s+/).map(Number);
      if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error(`europe: bad point "${s}"`);
      return [a!, b!] as const;
    });
}

const arcCache = new Map<string, LonLat[]>();
function piece(token: string): LonLat[] {
  let p = arcCache.get(token);
  if (!p) {
    const isArc = /^[a-z]/.test(token);
    if (isArc && !(token in ARCS)) throw new Error(`europe: unknown arc "${token}"`);
    p = parsePts(isArc ? ARCS[token]! : token);
    arcCache.set(token, p);
  }
  return p;
}

const near = (a: LonLat, b: LonLat, tol: number): boolean =>
  Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol;

export interface RingResult {
  pts: LonLat[];
  /** Largest gap (degrees) found where two pieces were chained (0 = exact). */
  gap: number;
  /** Gap between the ring's last and first point. */
  closeGap: number;
}

/**
 * Chain a ring's pieces end to end, reversing any piece whose far end meets the chain. The
 * first piece is oriented towards the second.
 */
export function assembleRing(tokens: readonly string[]): RingResult {
  const ps = tokens.map(piece);
  const out: LonLat[] = [];
  let gap = 0;
  const end = (p: LonLat[]): [LonLat, LonLat] => [p[0]!, p[p.length - 1]!];
  ps.forEach((p, i) => {
    if (i === 0) {
      let first = p;
      const next = ps[1];
      if (next) {
        const [a, b] = end(p);
        const [c, d] = end(next);
        const dist = (u: LonLat, v: LonLat): number => Math.hypot(u[0] - v[0], u[1] - v[1]);
        if (Math.min(dist(a, c), dist(a, d)) < Math.min(dist(b, c), dist(b, d)))
          first = [...p].reverse();
      }
      out.push(...first);
      return;
    }
    const last = out[out.length - 1]!;
    const [a, b] = end(p);
    const da = Math.hypot(a[0] - last[0], a[1] - last[1]);
    const db = Math.hypot(b[0] - last[0], b[1] - last[1]);
    const q = db < da ? [...p].reverse() : p;
    gap = Math.max(gap, Math.min(da, db));
    out.push(...(near(q[0]!, last, 1e-9) ? q.slice(1) : q));
  });
  const f = out[0]!;
  const l = out[out.length - 1]!;
  return { pts: out, gap, closeGap: Math.hypot(f[0] - l[0], f[1] - l[1]) };
}

/* ── Rasterisation ──────────────────────────────────────────────────────────────────── */

export const SEA = 0;
export const LAKE = 254;

export interface EuropeGrid {
  w: number;
  h: number;
  /** 0 = sea, LAKE = lake, k + 1 = COUNTRIES[k]. */
  ids: Uint8Array;
  countries: readonly CountrySrc[];
}

type Poly = { x: number; y: number }[];

/** Scanline fill (pixel-centre rule) of one closed polygon; calls `set` for every pixel. */
export function fillPoly(
  poly: Poly,
  w: number,
  h: number,
  set: (x: number, y: number) => void,
): number {
  let n = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(h - 1, Math.ceil(maxY));
  const xs: number[] = [];
  for (let y = y0; y <= y1; y++) {
    const cy = y + 0.5;
    xs.length = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i]!;
      const b = poly[j]!;
      if (a.y > cy === b.y > cy) continue;
      xs.push(a.x + ((cy - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k]! - 0.5));
      const xb = Math.min(w - 1, Math.ceil(xs[k + 1]! - 0.5) - 1);
      for (let x = xa; x <= xb; x++) {
        set(x, y);
        n++;
      }
    }
  }
  return n;
}

const projRing = (pts: readonly LonLat[]): Poly => pts.map(([lon, lat]) => project(lon, lat));

let gridCache: EuropeGrid | null = null;

/** The country-id grid of the sheet (cached). */
export function europeGrid(): EuropeGrid {
  if (gridCache) return gridCache;
  const w = MAP_W;
  const h = MAP_H;
  const ids = new Uint8Array(w * h);
  const order = [
    ...COUNTRIES.map((c, k) => ({ c, k })).filter((e) => e.c.underlay),
    ...COUNTRIES.map((c, k) => ({ c, k })).filter((e) => !e.c.underlay),
  ];
  for (const { c, k } of order) {
    for (const ring of c.rings) {
      const poly = projRing(assembleRing(ring).pts);
      const n = fillPoly(poly, w, h, (x, y) => (ids[y * w + x] = k + 1));
      if (n === 0) {
        // Islands smaller than a pixel still show as one.
        const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
        const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
        const x = Math.floor(cx);
        const y = Math.floor(cy);
        if (x >= 0 && y >= 0 && x < w && y < h && ids[y * w + x] === SEA) ids[y * w + x] = k + 1;
      }
    }
  }
  for (const lake of LAKES) {
    const poly = projRing(parsePts(lake));
    const n = fillPoly(poly, w, h, (x, y) => {
      if (ids[y * w + x] !== SEA) ids[y * w + x] = LAKE;
    });
    if (n === 0) {
      const p = poly[0]!;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      if (ids[y * w + x] !== SEA) ids[y * w + x] = LAKE;
    }
  }
  cleanGrid(ids, w, h);
  gridCache = { w, h, ids, countries: COUNTRIES };
  return gridCache;
}

/**
 * Pixel tidy-up: a land pixel whose 4 neighbours are all one other country joins it (no
 * single-pixel specks of a neighbour on a border); a sea pixel walled in by one country on
 * ≥ 3 sides becomes land (no pin-holes on coasts).
 */
function cleanGrid(ids: Uint8Array, w: number, h: number): void {
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const v = ids[i]!;
        if (v === LAKE) continue;
        const n0 = ids[i - 1]!;
        const n1 = ids[i + 1]!;
        const n2 = ids[i - w]!;
        const n3 = ids[i + w]!;
        // Most frequent neighbour value other than v (and lakes), without allocating.
        let best = v;
        let bestN = 0;
        for (const q of [n0, n1, n2, n3]) {
          if (q === v || q === LAKE) continue;
          const c =
            (q === n0 ? 1 : 0) + (q === n1 ? 1 : 0) + (q === n2 ? 1 : 0) + (q === n3 ? 1 : 0);
          if (c > bestN) [best, bestN] = [q, c];
        }
        if (v === SEA ? bestN >= 3 && best !== SEA : bestN === 4) ids[i] = best;
      }
    }
  }
}

/* ── Neighbours & colouring ─────────────────────────────────────────────────────────── */

/** Unordered country pairs (k+1 ids) that touch on land (4-neighbourhood). */
export function landNeighbours(g: EuropeGrid): Set<string> {
  const out = new Set<string>();
  const add = (a: number, b: number): void => {
    if (a === b || a === SEA || b === SEA || a === LAKE || b === LAKE) return;
    out.add(a < b ? `${a}:${b}` : `${b}:${a}`);
  };
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) {
      const v = g.ids[y * g.w + x]!;
      if (x + 1 < g.w) add(v, g.ids[y * g.w + x + 1]!);
      if (y + 1 < g.h) add(v, g.ids[(y + 1) * g.w + x]!);
    }
  return out;
}

/** Pairs within `r` px of each other across water (soft colouring constraint). */
export function nearNeighbours(g: EuropeGrid, r = 4): Set<string> {
  const out = new Set<string>();
  for (let y = 0; y < g.h; y += 1)
    for (let x = 0; x < g.w; x += 1) {
      const a = g.ids[y * g.w + x]!;
      if (a === SEA || a === LAKE) continue;
      for (let dy = -r; dy <= r; dy += 2)
        for (let dx = -r; dx <= r; dx += 2) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue;
          const b = g.ids[yy * g.w + xx]!;
          if (b === SEA || b === LAKE || b === a) continue;
          out.add(a < b ? `${a}:${b}` : `${b}:${a}`);
        }
    }
  return out;
}

/**
 * Colour families for the land (RIOT-64 only): muted, varied, map-like. Each family gives a
 * fill, a sunlit tone, a shade and a dark outline / label ink.
 */
export interface LandFamily {
  name: string;
  fill: string;
  light: string;
  shade: string;
  dark: string;
  /** A loud colour: kept for small countries. */
  accent?: boolean;
}

export const LAND_FAMILIES: readonly LandFamily[] = [
  { name: 'cream', fill: 'stone4', light: 'stone5', shade: 'stone3', dark: 'stone1' },
  { name: 'sage', fill: 'green4', light: 'lime', shade: 'green3', dark: 'green1' },
  { name: 'peach', fill: 'earth6', light: 'earth7', shade: 'earth5', dark: 'earth3' },
  { name: 'mauve', fill: 'gray6', light: 'gray7', shade: 'gray5', dark: 'gray2' },
  { name: 'butter', fill: 'ochre4', light: 'white', shade: 'ochre3', dark: 'ochre1' },
  { name: 'lilac', fill: 'lilac', light: 'pink3', shade: 'purple', dark: 'plum1', accent: true },
  { name: 'steel', fill: 'zinc4', light: 'white', shade: 'zinc3', dark: 'zinc1' },
  { name: 'tan', fill: 'stone3', light: 'stone4', shade: 'stone2', dark: 'stone0' },
  { name: 'salmon', fill: 'earth5', light: 'earth6', shade: 'earth4', dark: 'earth2' },
];

/** Families that read alike side by side (avoided between neighbours when possible). */
const SIMILAR: Record<number, number[]> = {
  0: [2, 4, 7],
  2: [0, 8],
  3: [6],
  4: [0],
  6: [3],
  7: [0, 8],
  8: [2, 7],
};

let colourCache: Map<string, LandFamily> | null = null;

/**
 * Country id → colour family. DSatur graph colouring over the land-neighbour graph (hard:
 * neighbours never share a family) with near-across-water pairs as a soft constraint; among
 * the allowed families the least used wins, so the map stays varied rather than 4-coloured.
 */
export function countryColours(g: EuropeGrid = europeGrid()): Map<string, LandFamily> {
  if (colourCache) return colourCache;
  const n = g.countries.length;
  const hard = Array.from({ length: n + 1 }, () => new Set<number>());
  const soft = Array.from({ length: n + 1 }, () => new Set<number>());
  for (const k of landNeighbours(g)) {
    const [a, b] = k.split(':').map(Number) as [number, number];
    hard[a]!.add(b);
    hard[b]!.add(a);
  }
  for (const k of nearNeighbours(g)) {
    const [a, b] = k.split(':').map(Number) as [number, number];
    soft[a]!.add(b);
    soft[b]!.add(a);
  }
  const area = new Array<number>(n + 1).fill(0);
  for (const v of g.ids) area[v]!++;
  const fam = new Array<number>(n + 1).fill(-1);
  const used = new Array<number>(LAND_FAMILIES.length).fill(0);
  const usedArea = new Array<number>(LAND_FAMILIES.length).fill(0);
  for (let step = 0; step < n; step++) {
    // DSatur: most distinct neighbour colours first, then most neighbours, then largest.
    let pick = -1;
    let key = [-1, -1, -1];
    for (let v = 1; v <= n; v++) {
      if (fam[v]! >= 0) continue;
      const sat = new Set([...hard[v]!].map((u) => fam[u]!).filter((f) => f >= 0)).size;
      const k = [sat, hard[v]!.size, area[v]!];
      if (
        k[0]! > key[0]! ||
        (k[0] === key[0] && (k[1]! > key[1]! || (k[1] === key[1] && k[2]! > key[2]!)))
      ) {
        key = k;
        pick = v;
      }
    }
    const banned = new Set([...hard[pick]!].map((u) => fam[u]!));
    const alike = new Set([...hard[pick]!].flatMap((u) => SIMILAR[fam[u]!] ?? []));
    const avoid = new Set([...soft[pick]!].map((u) => fam[u]!));
    let best = -1;
    let bestScore = Infinity;
    LAND_FAMILIES.forEach((_, f) => {
      if (banned.has(f)) return;
      // Spread both the count and the ink: big countries push their colour down the list.
      const score =
        used[f]! * 2 +
        Math.min(usedArea[f]!, 16000) / 1000 +
        (avoid.has(f) ? 25 : 0) +
        (alike.has(f) ? 12 : 0) +
        (LAND_FAMILIES[f]!.accent ? 8 + area[pick]! / 400 : 0) +
        f * 0.1;
      if (score < bestScore) {
        bestScore = score;
        best = f;
      }
    });
    fam[pick] = best >= 0 ? best : 0;
    used[fam[pick]!]!++;
    usedArea[fam[pick]!]! += area[pick]!;
  }
  colourCache = new Map(g.countries.map((c, k) => [c.id, LAND_FAMILIES[fam[k + 1]!]!]));
  return colourCache;
}
