/**
 * World-space aim / paint guides for the special skills (gallery group 'ui'):
 *
 * - `ramLane`    — the Mounted Riot Police's lane: dashed hi-vis edges ~1 tile wide, a sweep of
 *                  chevrons running from the rider to a stop bar at the end (flashes before the ram).
 * - `strikeLine` — the Helicopter's painted air-strike line along any drag path: hi-vis red/yellow
 *                  chevron stripe, start puck, arrowhead, the 2×1.2-tile width ghost (dashed edges +
 *                  iso hatching) and an invalid / too-long state.
 * - `guideRing`  — iso rings of any radius: the Tank's dashed range ring and the blast preview.
 * - `reticle`    — the Tank's aim reticle: idle (brackets turning), locked, out of range.
 *
 * The painters work in tile space (distances in tiles, iso-correct widths and caps) and output
 * palette-pure frames. Inputs are world px; the returned anchor is the pixel of the first point,
 * so `new Sprite(tex)` placed at that world point lines up. Hatching is aligned to *world* pixels,
 * so overlapping guides never shimmer. Repeatable segments for straight 8-direction lines are
 * registered as sprites (see `registerGuides`).
 */
import type { PixelBuffer } from '../lib/pixels';
import type { SpriteRegistry } from '../lib/registry';
import { buf, col, ellipseRing, inEllipse, mask, mset, outlineMaskInto, px } from './draw';
import { DIR_VEC, DIRS, type Dir8 } from './particles';
import { cropFrames, TILE_RX, TILE_RY, type Framed } from './specialBlasts';
import { FRAG_RADIUS, MISSILE_RADIUS } from './specialRecipes';

export interface WorldPoint {
  x: number;
  y: number;
}

/** World px offset → tile-space offset (i, j). */
function toTile(dx: number, dy: number): [number, number] {
  return [(dx / 16 + dy / 8) / 2, (dy / 8 - dx / 16) / 2];
}

/** Bounding box (world px) of a polyline grown by `pad` px. */
function bbox(pts: readonly WorldPoint[], padX: number, padY: number): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x0: Math.floor(x0 - padX), y0: Math.floor(y0 - padY), x1: Math.ceil(x1 + padX), y1: Math.ceil(y1 + padY) };
}

/** Iso hatch: sparse 2:1 diagonal lines on world pixels (reads as painted-on-the-ground). */
function isoHatch(wx: number, wy: number, period = 8): boolean {
  return ((((wx - 2 * wy) % period) + period) % period) === 0;
}

/* ------------------------------------------------------------------ strike line */

export type GuideState = 'valid' | 'invalid';

export interface StrikeLineOptions {
  /** 'invalid' = the whole line greys out with a red X cap (e.g. no heli / blocked). */
  state?: GuideState;
  /** Max painted length (tiles); the part beyond it renders as "too long" (red/grey). */
  maxLen?: number;
  /** Half-width of the strike corridor (tiles), drawn as the ghost. Default 1.2. */
  width?: number;
  /** Draw the width ghost (default true). */
  ghost?: boolean;
  /** Animation frames (chevrons march toward the end). Default 4. */
  frames?: number;
  /** Draw the start puck / end arrow (default true). Off for repeatable segments. */
  caps?: boolean;
  /** Chevron period (tiles), default 0.5. Must divide a segment's length to repeat seamlessly. */
  chevron?: number;
  /** Only output pixels whose arc length lies in [from, to) (tiles) — segment cutting. */
  clip?: [number, number];
}

const STRIPE_HW = 0.3;
const CHEVRON = 0.5;

/**
 * The painted air-strike line along `points` (world px, ≥ 2). Returns frames + anchor (= pixel of
 * points[0]). Cheap enough to repaint while dragging (~2–6 ms for a 14-tile path; throttle to
 * pointer moves of ≥ 4 px).
 */
export function strikeLine(points: readonly WorldPoint[], o: StrikeLineOptions = {}): Framed {
  const W = o.width ?? 1.2;
  const ghost = o.ghost ?? true;
  const caps = o.caps ?? true;
  const nF = o.frames ?? 4;
  const invalid = o.state === 'invalid';
  const chev = o.chevron ?? CHEVRON;
  const pts = points.length >= 2 ? points : [points[0]!, points[0]!];
  const origin = { x: Math.round(pts[0]!.x), y: Math.round(pts[0]!.y) };
  const path = pts.map((p) => toTile(p.x - origin.x, p.y - origin.y));
  const cum = [0];
  for (let k = 1; k < path.length; k++)
    cum.push(cum[k - 1]! + Math.hypot(path[k]![0] - path[k - 1]![0], path[k]![1] - path[k - 1]![1]));
  const total = cum[cum.length - 1]!;
  const maxLen = o.maxLen ?? Infinity;
  const reach = (ghost ? W : 0.9) + 0.2;
  const bb = bbox(pts, reach * TILE_RX + 3, reach * TILE_RY + 4);
  const BW = bb.x1 - bb.x0 + 1;
  const BH = bb.y1 - bb.y0 + 1;
  const N = BW * BH;
  // End frame (tile space) for the arrow / X cap.
  const e = path[path.length - 1]!;
  const ePrev = path[Math.max(0, path.length - 2)]!;
  const eL = Math.hypot(e[0] - ePrev[0], e[1] - ePrev[1]) || 1;
  const tx = (e[0] - ePrev[0]) / eL;
  const ty = (e[1] - ePrev[1]) / eL;
  // Static classification (frame-independent); only chevrons, dashes and the puck blink animate.
  const NONE = 0;
  const FIXED = 1; // colour in `fixed`
  const STRIPE = 2;
  const EDGE = 3;
  const PUCK = 4;
  const kind = new Uint8Array(N);
  const fixed: Array<string | null> = new Array(N).fill(null);
  const sArr = new Float32Array(N);
  const dArr = new Float32Array(N);
  const sideArr = new Int8Array(N);
  const over = new Uint8Array(N);
  const solid = mask(BW, BH);
  // Flat segment arrays for the hot loop (no allocation per pixel).
  const nSeg = Math.max(1, path.length - 1);
  const ax0 = new Float64Array(nSeg);
  const ay0 = new Float64Array(nSeg);
  const sx = new Float64Array(nSeg);
  const sy = new Float64Array(nSeg);
  const sl = new Float64Array(nSeg);
  for (let k = 0; k < nSeg; k++) {
    const a = path[k]!;
    const c = path[Math.min(path.length - 1, k + 1)]!;
    ax0[k] = a[0];
    ay0[k] = a[1];
    sx[k] = c[0] - a[0];
    sy[k] = c[1] - a[1];
    sl[k] = Math.hypot(sx[k]!, sy[k]!);
  }
  for (let y = 0; y < BH; y++) {
    for (let x = 0; x < BW; x++) {
      const i = y * BW + x;
      const wdx = (bb.x0 + x + 0.5 - origin.x) / 16;
      const wdy = (bb.y0 + y + 0.5 - origin.y) / 8;
      const pi = (wdx + wdy) / 2;
      const pj = (wdy - wdx) / 2;
      let bd = Infinity;
      let bs = 0;
      let bside = 1;
      for (let k = 0; k < nSeg; k++) {
        const ex = sx[k]!;
        const ey = sy[k]!;
        const L = sl[k]!;
        const rx = pi - ax0[k]!;
        const ry = pj - ay0[k]!;
        const tr = L > 0 ? (rx * ex + ry * ey) / (L * L) : 0;
        const t = tr < 0 ? 0 : tr > 1 ? 1 : tr;
        const dx = rx - ex * t;
        const dy = ry - ey * t;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < bd) {
          bd = d;
          // Only the ends of the whole path extend past their segment.
          const tc = k === 0 && tr < 0 ? tr : k === nSeg - 1 && tr > 1 ? tr : t;
          bs = cum[k]! + tc * L;
          bside = ex * ry - ey * rx >= 0 ? 1 : -1;
        }
      }
      const fl = { d: bd, s: bs };
      sArr[i] = bs;
      dArr[i] = bd;
      sideArr[i] = bside;
      over[i] = invalid || fl.s > maxLen ? 1 : 0;
      const ux = pi - e[0];
      const uy = pj - e[1];
      const u = ux * tx + uy * ty;
      const v = -ux * ty + uy * tx;
      const ds = Math.hypot(pi, pj);
      if (caps && u > -0.2 && u < 0.85 && total > 0.3) {
        if (!invalid) {
          const half = (0.62 * (0.85 - u)) / 1.05;
          if (Math.abs(v) <= half && u > -0.12) {
            kind[i] = FIXED;
            mset(solid, x, y);
            fixed[i] = fl.s > maxLen ? 'gray5' : Math.abs(v) < half - 0.16 && u < 0.6 ? 'crim2' : 'hivis2';
            continue;
          }
        } else if (
          Math.abs(u - 0.3) < 0.42 &&
          Math.abs(v) < 0.42 &&
          (Math.abs(u - 0.3 - v) < 0.12 || Math.abs(u - 0.3 + v) < 0.12)
        ) {
          kind[i] = FIXED;
          mset(solid, x, y);
          fixed[i] = 'crim2';
          continue;
        }
      }
      if (caps && ds < 0.42) {
        mset(solid, x, y);
        if (ds < 0.14) kind[i] = PUCK;
        else {
          kind[i] = FIXED;
          fixed[i] = ds < 0.28 ? (invalid ? 'gray5' : 'hivis2') : invalid ? 'gray3' : 'crim2';
        }
        continue;
      }
      if (fl.s < 0 || fl.s > total) continue;
      if (fl.d <= STRIPE_HW) {
        kind[i] = STRIPE;
        mset(solid, x, y);
        continue;
      }
      if (ghost && fl.d <= W && isoHatch(bb.x0 + x, bb.y0 + y)) {
        kind[i] = FIXED;
        fixed[i] = over[i] ? 'gray3' : 'crim1';
      }
    }
  }
  // Ghost edges: corridor pixels with a 4-neighbour outside the corridor.
  if (ghost) {
    const outside = (xx: number, yy: number): boolean =>
      xx < 0 || yy < 0 || xx >= BW || yy >= BH || dArr[yy * BW + xx]! > W;
    for (let y = 0; y < BH; y++) {
      for (let x = 0; x < BW; x++) {
        const i = y * BW + x;
        if (kind[i] === STRIPE || dArr[i]! > W || sArr[i]! < -W || sArr[i]! > total + W) continue;
        if (outside(x + 1, y) || outside(x - 1, y) || outside(x, y + 1) || outside(x, y - 1)) kind[i] = EDGE;
      }
    }
  }
  // Outline of the solid parts is static: paint it once into a base layer.
  const base = buf(BW, BH);
  outlineMaskInto(base, solid, () => 'ink');
  const C = {
    hivis2: col('hivis2'),
    crim2: col('crim2'),
    crim1: col('crim1'),
    gray5: col('gray5'),
    white: col('white'),
    ink: col('ink'),
  };
  const frames: PixelBuffer[] = [];
  for (let f = 0; f < nF; f++) {
    const b = buf(BW, BH);
    b.data.set(base.data);
    const d32 = new Uint32Array(N);
    const phase = f / nF;
    for (let i = 0; i < N; i++) {
      const k = kind[i]!;
      if (k === NONE) continue;
      let c: number;
      if (k === FIXED) c = col(fixed[i]!);
      else if (k === PUCK) c = f % 2 ? C.white : C.crim2;
      else if (k === STRIPE) {
        const q = sArr[i]! + dArr[i]! * 1.1 - phase * chev;
        const band = Math.floor(q / (chev / 2)) & 1;
        c = over[i] ? (band ? C.gray5 : C.crim1) : band ? C.crim2 : C.hivis2;
      } else {
        // Edge dashes march with the chevrons.
        const sv = sArr[i]!;
        const along = sv + (sv < 0 || sv > total ? Math.atan2(sideArr[i]!, 1) : 0);
        if ((Math.floor((along + sideArr[i]! * chev * 0.25 - phase * chev) / (chev / 2)) & 1) === 0) continue;
        c = over[i] ? C.crim1 : C.hivis2;
        // Ink drop under the dash so it reads on light pavement.
        if (i + BW < N && !kind[i + BW] && !d32[i + BW]) d32[i + BW] = C.ink;
      }
      d32[i] = c;
    }
    for (let i = 0; i < N; i++) {
      const c = d32[i]!;
      if (!c) continue;
      const j = i * 4;
      b.data[j] = c >>> 24;
      b.data[j + 1] = (c >>> 16) & 255;
      b.data[j + 2] = (c >>> 8) & 255;
      b.data[j + 3] = 255;
    }
    // Segment cutting happens last, so cut ends get no outline (segments chain seamlessly).
    if (o.clip) {
      for (let i = 0; i < N; i++) {
        const sv = sArr[i]!;
        if (sv < o.clip[0] || sv >= o.clip[1]) b.data.fill(0, i * 4, i * 4 + 4);
      }
    }
    frames.push(b);
  }
  return { frames, anchor: { x: origin.x - bb.x0, y: origin.y - bb.y0 } };
}

/* ------------------------------------------------------------------ ram lane */

/**
 * The ram lane from the rider (0, 0) to (dx, dy) world px (≈ 6 tiles): dashed hi-vis edges at
 * ±`half` tiles, a stop bar at the end, and a sweep of navy/hi-vis chevrons running from the rider
 * to the end over `frames` frames (loop it while the ram winds up, ~0.5 s). Anchor = the rider.
 */
export function ramLane(dx: number, dy: number, half = 0.5, nF = 6): Framed {
  const [ti, tj] = toTile(dx, dy);
  const L = Math.hypot(ti, tj) || 1;
  const ux = ti / L;
  const uy = tj / L;
  const pts = [
    { x: 0, y: 0 },
    { x: dx, y: dy },
  ];
  const bb = bbox(pts, (half + 0.25) * TILE_RX + 3, (half + 0.25) * TILE_RY + 4);
  const BW = bb.x1 - bb.x0 + 1;
  const BH = bb.y1 - bb.y0 + 1;
  const frames: PixelBuffer[] = [];
  for (let f = 0; f < nF; f++) {
    const b = buf(BW, BH);
    const solid = mask(BW, BH);
    const colour: Array<string | null> = new Array(BW * BH).fill(null);
    const sweep = (f / (nF - 1)) * (L + 1.6) - 0.8;
    const inLane = (x: number, y: number): [number, number] | null => {
      const [pi, pj] = toTile(bb.x0 + x + 0.5, bb.y0 + y + 0.5);
      const s = pi * ux + pj * uy;
      const v = -pi * uy + pj * ux;
      return s >= 0 && s <= L && Math.abs(v) <= half ? [s, v] : null;
    };
    for (let y = 0; y < BH; y++) {
      for (let x = 0; x < BW; x++) {
        const sv = inLane(x, y);
        if (!sv) continue;
        const [s, v] = sv;
        const i = y * BW + x;
        // Stop bar.
        if (s > L - 0.16) {
          mset(solid, x, y);
          colour[i] = Math.floor((v + half) / 0.25) & 1 ? 'hivis2' : 'navy2';
          continue;
        }
        // Chevrons inside the sweep window (bright head, dimmer tail).
        const w = sweep - s;
        if (w > -0.1 && w < 1.6 && Math.abs(v) < half - 0.12) {
          const q = s + Math.abs(v) * 0.9;
          if ((Math.floor(q / 0.25) & 1) === 0) {
            mset(solid, x, y);
            colour[i] = w < 0.7 ? 'hivis2' : 'hivis1';
          }
        }
      }
    }
    // Dashed edges (hi-vis with ink drop), marching outward from the rider.
    for (let y = 0; y < BH; y++) {
      for (let x = 0; x < BW; x++) {
        const sv = inLane(x, y);
        if (!sv || colour[y * BW + x]) continue;
        if (inLane(x + 1, y) && inLane(x - 1, y) && inLane(x, y + 1) && inLane(x, y - 1)) continue;
        const [s] = sv;
        if (s > L - 0.2) continue;
        if (((Math.floor((s - f * 0.08) / 0.3) & 1) === 1)) continue;
        colour[y * BW + x] = 'hivis2';
        if (y + 1 < BH && !colour[(y + 1) * BW + x]) colour[(y + 1) * BW + x] = 'ink';
      }
    }
    for (let i = 0; i < colour.length; i++) if (colour[i]) px(b, i % BW, (i / BW) | 0, colour[i]!);
    outlineMaskInto(b, solid, () => 'ink');
    frames.push(b);
  }
  return { frames, anchor: { x: -bb.x0, y: -bb.y0 } };
}

/* ------------------------------------------------------------------ rings */

export type RingStyle = 'range' | 'blast' | 'frag';

/**
 * Iso ring of `tiles` radius. 'range' = the tank's reach: bold marching hi-vis dashes over an
 * ink drop line, with a tick every 45°; 'blast' (missile preview) / 'frag' = crimson double ring
 * with iso hazard hatching inside, pulsing in 1 px. Anchor = centre. 2 (range) or 4 frames.
 */
export function guideRing(tiles: number, style: RingStyle): Framed {
  const RX = TILE_RX * tiles;
  const RY = TILE_RY * tiles;
  const W = Math.ceil(RX * 2) + 7;
  const H = Math.ceil(RY * 2) + 8;
  const cx = W / 2;
  const cy = H / 2;
  const nF = style === 'range' ? 2 : 4;
  const per = (RX + RY) * 2.2;
  const frames: PixelBuffer[] = [];
  for (let f = 0; f < nF; f++) {
    const b = buf(W, H);
    const step = (a: number): number => Math.round(((a + Math.PI) / (Math.PI * 2)) * per);
    if (style === 'range') {
      const dash = (_x: number, _y: number, a: number): string | null =>
        (step(a) + f * 4) % 10 < 6 ? 'hivis2' : null;
      ellipseRing(b, cx, cy + 1, RX, RY, (x, y, a) => (dash(x, y, a) ? 'ink' : null), 2);
      ellipseRing(b, cx, cy, RX, RY, dash, 2);
      // Ticks at every 45° (short radial dashes inward).
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        for (let r = 0.94; r < 0.99; r += 0.012) {
          px(b, cx + Math.cos(a) * RX * r - 0.5, cy + Math.sin(a) * RY * r - 0.5, 'stone5');
        }
      }
    } else {
      const pulse = [0, 0.6, 1, 0.6][f]!;
      const rx = RX - 1 + pulse;
      const ry = RY - 0.5 + pulse * 0.5;
      // Hazard hatch inside (world-aligned once placed at an integer centre).
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!inEllipse(x, y, cx, cy, rx - 2, ry - 1.5)) continue;
          if (isoHatch(x, y, style === 'frag' ? 7 : 9)) px(b, x, y, 'crim1');
        }
      }
      ellipseRing(b, cx, cy + 1, rx, ry, 'rust0', 2);
      ellipseRing(b, cx, cy, rx, ry, (_x, _y, a) => ((step(a) + f * 3) % 8 < 5 ? 'crim2' : 'rust4'), 2);
      ellipseRing(b, cx, cy, rx * 0.86, ry * 0.86, (_x, _y, a) => (step(a) % 4 === 0 ? 'crim2' : null));
    }
    frames.push(b);
  }
  return { frames, anchor: { x: Math.floor(cx), y: Math.floor(cy) } };
}

/* ------------------------------------------------------------------ reticle */

export type ReticleState = 'idle' | 'locked' | 'invalid';

/**
 * Ground reticle for the tank's missile (anchor = the aimed ground point). Idle: four hi-vis
 * bracket arcs slowly turning around an iso ellipse, a white crosshair; locked: brackets snap in,
 * crimson, the centre diamond blinks white/red with inward ticks; invalid: grey brackets + red X.
 */
export function reticle(state: ReticleState): Framed {
  const W = 41;
  const H = 25;
  const cx = 20.5;
  const cy = 12.5;
  const nF = state === 'idle' ? 6 : state === 'locked' ? 4 : 2;
  const frames: PixelBuffer[] = [];
  for (let f = 0; f < nF; f++) {
    const b = buf(W, H);
    const solid = mask(W, H);
    const rx = state === 'locked' ? [12, 10, 10, 10][f]! : state === 'idle' ? 15 + (f % 3 === 1 ? 1 : 0) : 14;
    const ry = rx / 2;
    const turn = state === 'idle' ? (f / nF) * (Math.PI / 2) : 0;
    const main = state === 'locked' ? 'crim2' : state === 'idle' ? 'hivis2' : 'gray5';
    // Bracket arcs (2 px thick) at the four diagonals.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!inEllipse(x, y, cx, cy, rx, ry) || inEllipse(x, y, cx, cy, rx - 2, ry - 1.2)) continue;
        const a = Math.atan2((y + 0.5 - cy) / ry, (x + 0.5 - cx) / rx) - turn;
        if (Math.abs(Math.sin(2 * a)) < 0.62) continue;
        mset(solid, x, y);
        px(b, x, y, main);
      }
    }
    // Crosshair / centre.
    const cxi = Math.floor(cx);
    const cyi = Math.floor(cy);
    if (state === 'invalid') {
      for (let k = -3; k <= 3; k++) {
        for (const [x, y] of [
          [cxi + k * 2, cyi + k],
          [cxi + k * 2 + 1, cyi + k],
          [cxi - k * 2, cyi + k],
          [cxi - k * 2 + 1, cyi + k],
        ] as const) {
          mset(solid, x, y);
          px(b, x, y, 'crim2');
        }
      }
    } else {
      // Crosshair: solid iso arms (2:1) with a gap around the centre.
      const arm = state === 'locked' ? 5 : 8;
      const cross = state === 'locked' ? 'white' : 'stone5';
      for (let k = 3; k <= arm + 2; k++) {
        for (const [x, y] of [
          [cxi + k, cyi],
          [cxi - k, cyi],
        ] as const) {
          mset(solid, x, y);
          px(b, x, y, cross);
        }
      }
      for (let k = 2; k <= Math.ceil(arm / 2) + 1; k++) {
        for (const [x, y] of [
          [cxi, cyi + k],
          [cxi, cyi - k],
        ] as const) {
          mset(solid, x, y);
          px(b, x, y, cross);
        }
      }
      // Centre diamond.
      const dc = state === 'locked' ? (f % 2 ? 'white' : 'crim2') : 'hivis2';
      for (const [x, y] of [
        [cxi, cyi],
        [cxi - 1, cyi],
        [cxi + 1, cyi],
        [cxi, cyi - 1],
        [cxi, cyi + 1],
      ] as const) {
        if (state === 'idle' && (x !== cxi || y !== cyi) && f % 3 !== 0) continue;
        mset(solid, x, y);
        px(b, x, y, dc);
      }
    }
    outlineMaskInto(b, solid, () => (state === 'locked' ? 'rust0' : 'ink'));
    frames.push(b);
  }
  return { frames, anchor: { x: Math.floor(cx), y: Math.floor(cy) } };
}

/* ------------------------------------------------------------------ registration */

/** Tile-space unit step for a screen direction (DIRS) — axis dirs = 1 tile, diagonals = √2. */
export function segmentStep(d: Dir8): WorldPoint {
  const [vx, vy] = DIR_VEC[d];
  // Screen diagonals (2:1) are tile axes: 1 tile = (±16, ±8). E/W/N/S are tile diagonals:
  // one step = (±32, 0) or (0, ±16).
  if (Math.abs(vx) > 0.99) return { x: 32 * Math.sign(vx), y: 0 };
  if (Math.abs(vy) > 0.99) return { x: 0, y: 16 * Math.sign(vy) };
  return { x: 16 * Math.sign(vx), y: 8 * Math.sign(vy) };
}

function addGuide(reg: SpriteRegistry, name: string, f: Framed, fps: number, loop = true): void {
  reg.add(name, { group: 'ui', frames: f.frames, fps, loop, anchor: f.anchor });
}

/** Cut a straight repeatable strike segment for direction `d` (one step long). */
function strikeSegment(d: Dir8, state: GuideState): Framed {
  const st = segmentStep(d);
  // Paint 3 steps and keep the middle one so edges / hatch continue seamlessly.
  const pts = [
    { x: -st.x, y: -st.y },
    { x: st.x * 2, y: st.y * 2 },
  ];
  const [li, lj] = toTile(st.x, st.y);
  const L = Math.hypot(li, lj);
  // Chevron period must divide the step: snap to whole chevrons per step.
  const chevron = L / Math.max(1, Math.round(L / CHEVRON));
  const f = strikeLine(pts, { state, caps: false, clip: [L, 2 * L], chevron });
  // Re-anchor on the middle step's start (= the world point the segment begins at).
  return cropFrames(f.frames, { x: f.anchor.x + st.x, y: f.anchor.y + st.y });
}

export function registerGuides(reg: SpriteRegistry): void {
  for (const d of DIRS) {
    const st = segmentStep(d);
    addGuide(reg, `ui.special.ram.lane.${d}`, ramLane(st.x * (Math.abs(st.y) === 8 ? 6 : 4), st.y * (Math.abs(st.y) === 8 ? 6 : 4)), 12);
    addGuide(reg, `ui.special.strike.seg.${d}`, strikeSegment(d, 'valid'), 8);
    addGuide(reg, `ui.special.strike.seg.${d}.invalid`, strikeSegment(d, 'invalid'), 8);
  }
  addGuide(reg, 'ui.special.strike.sample', strikeLine(
    [
      { x: 0, y: 0 },
      { x: 80, y: 40 },
      { x: 150, y: 44 },
      { x: 220, y: 20 },
    ],
    { maxLen: 9 },
  ), 8);
  addGuide(reg, 'ui.special.missile.blast', guideRing(MISSILE_RADIUS, 'blast'), 8);
  addGuide(reg, 'ui.special.frag.blast', guideRing(FRAG_RADIUS, 'frag'), 8);
  addGuide(reg, 'ui.special.missile.reticle.idle', reticle('idle'), 8);
  addGuide(reg, 'ui.special.missile.reticle.locked', reticle('locked'), 12);
  addGuide(reg, 'ui.special.missile.reticle.invalid', reticle('invalid'), 4);
}

