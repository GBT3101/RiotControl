/**
 * Special-skill blasts (playtest round 2): the Soldiers' frag grenade (lethal, ~2.2 tiles) and the
 * Tank's missile (huge, ~4.5 tiles), plus the shared modules they are composed of: ground flash
 * pancakes, shock rings sized to any radius, mid-size bursts (missile secondaries and the air
 * strike's strafe chain), flying debris chunks, lingering smoke, scorch / crater decals and a big
 * additive light. How to compose them: `specialRecipes.ts` and docs/art/specials.md.
 *
 * Fireballs follow the house explosion language (explosions.ts): white starburst flash → white-hot
 * ball → banded fireball rising under a dark smoke cap (fiery underside) → the cap greys and
 * breaks apart, while dark debris arcs out and embers spit upward. The missile adds a mushroom
 * stem and a much longer, multi-stage life. Anchor = ground zero.
 */
import type { PixelBuffer } from '../lib/pixels';
import {
  buf,
  chamfer,
  col,
  ellipseMask,
  ellipseRing,
  has,
  inEllipse,
  mask,
  mget,
  mset,
  outlineMaskInto,
  paintLobes,
  prng,
  px,
  rect,
  type Lobe,
  type Mask,
} from './draw';
import { cluster } from './explosions';

export const HOT = ['rust0', 'rust2', 'rust3', 'ochre3', 'ochre4'];
export const HOT_WHITE = ['rust1', 'ochre2', 'ochre3', 'ochre4', 'white'];
const SMOKE_DARK = ['ink', 'gray1', 'gray2', 'gray3', 'gray4'];
const SMOKE_MID = ['gray1', 'gray2', 'gray3', 'gray4', 'gray5'];
const SMOKE = ['gray1', 'gray3', 'gray4', 'gray5', 'gray6'];
const DUST = ['stone0', 'stone1', 'stone2', 'stone3', 'stone4'];
const DUST_LIGHT = ['stone1', 'stone2', 'stone3', 'stone4', 'stone5'];

/** World px per tile of radius on screen (iso circle → ellipse; see `rangeRadiusPx`). */
export const TILE_RX = 16 * Math.SQRT2;
export const TILE_RY = 8 * Math.SQRT2;

export interface Framed {
  frames: PixelBuffer[];
  anchor: { x: number; y: number };
}

/** Crop every frame to the union of their opaque bounds (+1 px margin) and move the anchor. */
export function cropFrames(frames: PixelBuffer[], anchor: { x: number; y: number }): Framed {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  const { w, h } = frames[0]!;
  for (const f of frames) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!f.data[(y * w + x) * 4 + 3]) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  x0 = Math.max(0, Math.min(x0, anchor.x) - 1);
  y0 = Math.max(0, Math.min(y0, anchor.y) - 1);
  x1 = Math.min(w - 1, Math.max(x1, anchor.x) + 1);
  y1 = Math.min(h - 1, Math.max(y1, anchor.y) + 1);
  const W = x1 - x0 + 1;
  const H = y1 - y0 + 1;
  const out = frames.map((f) => {
    const b = buf(W, H);
    for (let y = 0; y < H; y++) {
      const si = ((y + y0) * w + x0) * 4;
      b.data.set(f.data.subarray(si, si + W * 4), y * W * 4);
    }
    return b;
  });
  return { frames: out, anchor: { x: anchor.x - x0, y: anchor.y - y0 } };
}

/** Linear interpolation through evenly spaced keyframe values at t ∈ [0, 1]. */
function keys(t: number, k: readonly number[]): number {
  const p = Math.max(0, Math.min(1, t)) * (k.length - 1);
  const i = Math.min(k.length - 2, Math.floor(p));
  return k[i]! + (k[i + 1]! - k[i]!) * (p - i);
}

/* ------------------------------------------------------------------ starburst flash */

/**
 * Comic flash star (mask based, banded white → ochre → rust rim). `sy` squashes it vertically
 * (0.5 = flat on the ground, iso). Optional hollow core (`hole` fraction of the radius).
 */
function starFlash(
  b: PixelBuffer,
  cx: number,
  cy: number,
  ro: number,
  ri: number,
  spikes: number,
  seed: number,
  sy: number,
  bands: readonly string[],
  rim: string | null,
  hole = 0,
): void {
  const rnd = prng(seed);
  const radii: number[] = [];
  for (let i = 0; i < spikes * 2; i++)
    radii.push(i % 2 === 0 ? ro * (0.78 + rnd() * 0.3) : ri * (0.85 + rnd() * 0.2));
  const k = mask(b.w, b.h);
  const depth = new Float32Array(b.w * b.h);
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const dx = x + 0.5 - cx;
      const dy = (y + 0.5 - cy) / sy;
      let a = Math.atan2(dy, dx);
      if (a < 0) a += Math.PI * 2;
      const seg = (a / (Math.PI * 2)) * spikes * 2;
      const i0 = Math.floor(seg) % (spikes * 2);
      const i1 = (i0 + 1) % (spikes * 2);
      const t = seg - Math.floor(seg);
      const r = radii[i0]! * (1 - t) + radii[i1]! * t;
      const d = Math.hypot(dx, dy);
      if (d > r || d < hole * r) continue;
      mset(k, x, y);
      depth[y * b.w + x] = d / r;
    }
  }
  const n = bands.length;
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (!mget(k, x, y)) continue;
      const q = depth[y * b.w + x]!;
      // Innermost band = last colour; bands get thinner toward the rim.
      const band = q < 0.34 ? n - 1 : q < 0.6 ? n - 2 : q < 0.82 ? n - 3 : 0;
      px(b, x, y, bands[Math.max(0, band)]!);
    }
  }
  if (rim) outlineMaskInto(b, k, () => rim);
}

/* ------------------------------------------------------------------ fireballs */

const DARKER: Record<string, string> = {
  white: 'ochre4',
  ochre4: 'ochre3',
  ochre3: 'rust3',
  ochre2: 'rust3',
  rust3: 'rust2',
  rust2: 'rust1',
  rust1: 'rust0',
};

/** Darken the lower-right rim of a lobe cluster by one band (two for the outer `d/2`). */
function shadeHot(b: PixelBuffer, lobes: readonly Lobe[], d: number): void {
  const k = mask(b.w, b.h);
  for (const l of lobes) ellipseMask(k, l.x, l.y, l.r, l.r * (l.sy ?? 1));
  const marks: Array<[number, number, string]> = [];
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (!mget(k, x, y) || mget(k, x + d, y + d)) continue;
      const c = colourName(b, x, y);
      if (!c) continue;
      const one = DARKER[c];
      if (!one) continue;
      const deep = !mget(k, x + Math.ceil(d / 2), y + Math.ceil(d / 2));
      marks.push([x, y, deep && DARKER[one] && one !== 'rust0' ? DARKER[one] : one]);
    }
  }
  // Interior creases: each big lobe's lower-right edge, where it overlaps its neighbours,
  // gets a 1-px darker seam (cauliflower billows instead of one flat glowing disc).
  for (const l of lobes) {
    if (l.r < 4) continue;
    const ry = l.r * (l.sy ?? 1);
    for (let y = Math.floor(l.y - ry); y <= Math.ceil(l.y + ry); y++) {
      for (let x = Math.floor(l.x - l.r); x <= Math.ceil(l.x + l.r); x++) {
        if (!inEllipse(x, y, l.x, l.y, l.r, ry) || inEllipse(x + 1, y + 1, l.x, l.y, l.r, ry)) continue;
        if (!mget(k, x + 2, y + 2) || x + 0.5 < l.x - l.r * 0.2) continue;
        const c = colourName(b, x, y);
        if (c === 'white' || c === 'ochre4') marks.push([x, y, 'ochre3']);
      }
    }
  }
  for (const [x, y, c] of marks) px(b, x, y, c);
}

const NAME_OF = new Map<number, string>();
function colourName(b: PixelBuffer, x: number, y: number): string | undefined {
  if (!NAME_OF.size) for (const n of Object.keys(DARKER).concat('rust0')) NAME_OF.set(col(n) >>> 8, n);
  const i = (y * b.w + x) * 4;
  if (b.data[i + 3] !== 255) return undefined;
  return NAME_OF.get((b.data[i]! << 16) | (b.data[i + 1]! << 8) | b.data[i + 2]!);
}

/**
 * Tapered smoke column from (cx, bottom) up to `top`: lit left edge, shaded right edge, a few
 * turbulence nicks, coloured outline. Used for the mushroom stem.
 */
function column(
  b: PixelBuffer,
  cx: number,
  bottom: number,
  top: number,
  wBase: number,
  wTop: number,
  seed: number,
  dark: boolean,
): void {
  const rnd = prng(seed + 99);
  const nicks = new Set<number>();
  for (let k = 0; k < 4; k++) nicks.add(Math.round(top + rnd() * (bottom - top)));
  const k = mask(b.w, b.h);
  const ramp = dark ? SMOKE_DARK : SMOKE_MID;
  for (let y = top; y <= bottom; y++) {
    const q = (bottom - y) / Math.max(1, bottom - top); // 0 foot → 1 top
    const hw = wBase + (wTop - wBase) * Math.pow(q, 0.6) + (q < 0.12 ? (0.12 - q) * wBase * 3 : 0);
    const off = Math.sin(q * 4 + seed) * 0.6;
    for (let x = Math.floor(cx - hw - 1); x <= Math.ceil(cx + hw + 1); x++) {
      const u = (x + 0.5 - cx - off) / hw;
      if (Math.abs(u) > 1) continue;
      mset(k, x, y);
      const nick = nicks.has(y) && u > -0.2;
      px(b, x, y, ramp[u < -0.55 ? 3 : u > 0.4 || nick ? 1 : 2]!);
    }
  }
  outlineMaskInto(b, k, (side) => (side === 'tl' ? 'gray1' : ramp[0]!));
}

export interface FireballSpec {
  /** Fireball radius at full size (px). */
  R: number;
  frames: number;
  seed: number;
  /** Mushroom stem + rolling cap (missile). */
  mushroom?: boolean;
  /** Debris chunks / embers drawn into the sprite (more come from the recipe as particles). */
  debris: number;
  embers: number;
  /** Wide dusty base skirt. */
  skirt?: boolean;
}

interface Bit {
  vx: number;
  vy: number;
  kind: number;
}

function bits(n: number, seed: number, speed: number, spreadUp = 0.84): Bit[] {
  const rnd = prng(seed);
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI * (0.5 - spreadUp / 2 + rnd() * spreadUp);
    const s = speed * (0.55 + rnd() * 0.6);
    return { vx: Math.cos(a) * s, vy: Math.sin(a) * s * 1.1, kind: i % 3 };
  });
}

/** Dark rubble chunk that stays behind the cloud (only drawn on empty pixels). */
function chunk(b: PixelBuffer, x: number, y: number, kind: number, big: boolean): void {
  x = Math.round(x);
  y = Math.round(y);
  if (has(b, x, y) || has(b, x + 1, y) || has(b, x, y + 1)) return;
  if (kind === 0) {
    rect(b, x, y, 2, 2, 'gray1');
    px(b, x, y, 'gray3');
    if (big) {
      px(b, x + 2, y + 1, 'ink');
      px(b, x + 1, y + 2, 'ink');
    }
  } else if (kind === 1) {
    rect(b, x, y, 2, 1, 'earth1');
    px(b, x, y, 'earth3');
    if (big) rect(b, x, y + 1, 2, 1, 'ink');
  } else {
    px(b, x, y, 'ink');
    px(b, x + 1, y, 'gray2');
  }
}

/**
 * A fireball sequence. Keyframed per normalised time t (frame / (n-1)): fire radius and rise,
 * smoke cap radius and break-up. Frame 0 is always the starburst flash.
 */
export function fireball(spec: FireballSpec): Framed {
  const { R, seed } = spec;
  const W = Math.round(R * 5.2) + 8;
  const H = Math.round(R * 5.4) + 8;
  const gx = Math.floor(W / 2);
  const gy = H - Math.round(R * 0.9) - 2;
  const n = spec.frames;
  const mush = spec.mushroom ?? false;
  const chunks = bits(spec.debris, seed + 7, R * 0.62);
  const embers = bits(spec.embers, seed + 13, R * 0.5, 0.5);
  // Keyframes (×R) over t = 0 … 1.
  const FIRE = mush
    ? [0.7, 1.0, 1.12, 1.1, 1.0, 0.86, 0.7, 0.55, 0.4, 0.26, 0.14, 0]
    : [0.75, 1.0, 1.05, 0.88, 0.66, 0.44, 0.24, 0.08, 0];
  const RISE = mush
    ? [0.3, 0.45, 0.65, 0.95, 1.3, 1.65, 1.95, 2.2, 2.4, 2.55, 2.65, 2.7]
    : [0.35, 0.5, 0.75, 1.0, 1.25, 1.45, 1.62, 1.75, 1.85];
  const SMOKE_R = mush
    ? [0, 0.35, 0.7, 0.92, 1.05, 1.12, 1.18, 1.22, 1.24, 1.24, 1.2, 1.12]
    : [0, 0.45, 0.8, 0.98, 1.08, 1.14, 1.16, 1.14, 1.06];
  const frames: PixelBuffer[] = [];
  for (let f = 0; f < n; f++) {
    const b = buf(W, H);
    const t = f / (n - 1);
    if (f === 0) {
      // Ground glow + tall white starburst.
      starFlash(b, gx + 0.5, gy - R * 0.1, R * 1.25, R * 0.6, 12, seed + 1, 0.42, HOT_WHITE, 'rust2');
      starFlash(b, gx + 0.5, gy - R * 0.6, R * 1.05, R * 0.5, 9, seed, 1.05, HOT_WHITE, 'rust3');
      frames.push(b);
      continue;
    }
    const fireR = R * keys(t, FIRE);
    const rise = R * keys(t, RISE);
    const smokeR = R * keys(t, SMOKE_R);
    const cy = gy - rise;
    const fade = Math.max(0, (t - (mush ? 0.62 : 0.55)) / (mush ? 0.38 : 0.45));
    // Mushroom stem (behind the cap): tapered smoke column, lit on its left, with hot lobes
    // licking up its foot while the fireball is young.
    if (mush && t > 0.18 && t < 0.97) {
      const top = Math.round(cy + smokeR * 0.25);
      const thin = 1 - Math.max(0, (t - 0.6) / 0.4) * 0.55;
      const lift = t > 0.6 ? Math.round(((t - 0.6) / 0.4) * (gy - top) * 0.75) : 0;
      column(b, gx + 0.5, gy - 1 - lift, top, R * 0.3 * thin + 1, R * 0.17 * thin + 1, seed, t < 0.55);
      if (t < 0.5) {
        const foot = cluster(gx + 0.5, gy - R * 0.25, R * (0.55 - t * 0.6), 4, seed + 5, 0.6);
        paintLobes(b, foot, { ramp: HOT, mode: 'hot' });
      }
    }
    // Smoke cap.
    if (smokeR > 1) {
      const capY = cy - R * (mush ? 0.35 : 0.25);
      const lobes = cluster(gx + 0.5, capY, smokeR, mush ? 8 : 6, seed + 3, mush ? 0.62 : 0.72).map(
        (l, i) => ({
          ...l,
          x: l.x + (l.x - gx) * fade * 0.65,
          y: l.y + (l.y - capY) * fade * 0.3 - fade * R * 0.35,
          r: Math.max(0.9, l.r * (1 - fade * 0.3) - (i % 3 === 1 ? fade * R * 0.18 : 0)),
        }),
      );
      // Rolling cap: under-curl lobes along the bottom edge (mushroom).
      if (mush && t > 0.3) {
        for (const s of [-1, 1]) {
          lobes.push({
            x: gx + 0.5 + s * smokeR * (0.82 + fade * 0.5),
            y: capY + smokeR * 0.38 - fade * R * 0.2,
            r: smokeR * 0.34 * (1 - fade * 0.4),
          });
        }
      }
      // Break-up: ragged tears open through the cap instead of drifting grapes.
      const holes: Lobe[] = [];
      if (fade > 0.25) {
        holes.push({
          x: gx + 0.5 + smokeR * 0.3,
          y: capY - fade * R * 0.3,
          r: smokeR * 0.3 * (fade - 0.1),
          sy: 0.75,
        });
      }
      paintLobes(
        b,
        lobes.sort((p, q) => p.y - q.y),
        {
          ramp: t > 0.7 ? SMOKE : t > 0.42 ? SMOKE_MID : SMOKE_DARK,
          outlineLit: t > 0.7 ? 'gray2' : 'gray1',
          spec: 'one',
          holes,
        },
      );
    }
    // Base dust skirt (early): wide and flat, behind the fireball's foot.
    if ((spec.skirt ?? true) && t < 0.62) {
      const sk = R * (0.75 + t * 1.6);
      const shrink = 1 - t * 0.7;
      const skirt: Lobe[] = [-1, 1, -0.78, 0.78, -0.55, 0.55, -0.3, 0.3, 0].map((s, i) => ({
        x: gx + 0.5 + s * sk + ((i * 37) % 5) * 0.3,
        y: gy - 1 - (1 - Math.abs(s)) * R * 0.22 + ((i * 13) % 3) * 0.5,
        r: (R * 0.3 + (1 - Math.abs(s)) * R * 0.18 + ((i * 7) % 4) * 0.4) * shrink + 1,
        sy: 0.62,
      }));
      paintLobes(b, skirt, { ramp: DUST_LIGHT, outlineLit: 'stone2' });
    }
    // Fireball (hot banded lobes) over the cap's underside.
    if (fireR > 1) {
      const fl = cluster(gx + 0.5, cy + R * 0.1, fireR, mush ? 7 : 5, seed + 1, 0.82);
      paintLobes(b, fl, { ramp: t < 0.12 ? HOT_WHITE : HOT, mode: 'hot' });
      // Sun from the upper left: the fireball's lower-right rim burns one band darker, with a
      // second, deeper crescent once it is big (reads as a boiling, round mass).
      if (t > 0.12) shadeHot(b, fl, fireR > 9 ? 3 : 2);
    }
    // Embers spit upward early.
    for (const e of embers) {
      if (t > 0.5) continue;
      const tt = f * 1.1;
      const x = gx + e.vx * tt;
      const y = gy - R * 0.6 + e.vy * tt + 0.45 * tt * tt * (R / 10);
      if (y < 1 || y > gy) continue;
      px(b, x, y, f < 3 ? 'ochre4' : 'ochre3');
      if (f < 4) px(b, x, y + 1, 'rust3');
    }
    // Debris arcs (behind the cloud).
    for (const p of chunks) {
      const tt = f;
      const x = gx + p.vx * tt;
      const y = gy - R * 0.3 + p.vy * tt + 0.9 * tt * tt * (R / 10);
      if (y < gy + 2 && x >= 0 && x < W - 3) chunk(b, x, y, p.kind, R > 15);
    }
    frames.push(b);
  }
  return cropFrames(frames, { x: gx, y: gy });
}

/* ------------------------------------------------------------------ ground flash */

/**
 * Flat (iso) flash pancake for ground zero: frame 0 = full white star, 1 = wider and hollowing,
 * 2 = a broken ring of sparks, 3 (big only) = a few embers. Ground layer, emissive.
 */
export function groundFlash(rx: number, seed: number, frames = 3): Framed {
  const W = Math.ceil(rx * 2.6) + 4;
  const H = Math.ceil(rx * 1.3) + 4;
  const cx = W / 2;
  const cy = H / 2;
  const out: PixelBuffer[] = [];
  for (let f = 0; f < frames; f++) {
    const b = buf(W, H);
    if (f === 0) {
      starFlash(b, cx, cy, rx, rx * 0.5, 14, seed, 0.5, ['rust3', 'ochre3', 'ochre4', 'white'], 'rust1');
    } else if (f === 1) {
      starFlash(b, cx, cy, rx * 1.18, rx * 0.62, 14, seed + 1, 0.5, ['rust2', 'ochre2', 'ochre3', 'ochre4'], 'rust0', 0.42);
    } else {
      // Spark ring: short radial dashes at the rim, hot → cooling.
      const rnd = prng(seed + f * 7);
      const r = rx * (1.2 + (f - 2) * 0.12);
      const n = Math.round(rx * 1.1);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd() * 0.2;
        const len = 2 + Math.floor(rnd() * (f === 2 ? 3 : 2));
        for (let k = 0; k < len; k++) {
          const rr = r - k * 1.2;
          px(b, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.5, k === 0 ? (f === 2 ? 'ochre4' : 'ochre3') : 'rust3');
        }
      }
    }
    out.push(b);
  }
  return cropFrames(out, { x: Math.floor(cx), y: Math.floor(cy) });
}

/* ------------------------------------------------------------------ shock ring */

/**
 * Ground shock ring that reaches `tiles` (iso radius) on its last frame: a white pressure front
 * (2 px early) riding a band of dust lobes that grow, lag and thin out. The dust is heavier on the
 * front (lower) half so it reads in iso. Works for any radius; frame count 6–8.
 */
export function shockRing(tiles: number, seed: number, frames = 7): Framed {
  const RX = TILE_RX * tiles;
  const RY = TILE_RY * tiles;
  const W = Math.ceil(RX * 2) + 14;
  const H = Math.ceil(RY * 2) + 18;
  const cx = W / 2;
  const cy = H / 2 + 2;
  const rnd = prng(seed);
  const dust0 = 2.2 + tiles * 0.65;
  const perim = 2 * Math.PI * Math.sqrt((RX * RX + RY * RY) / 2);
  const nLobes = Math.max(12, Math.round(perim / (dust0 * 1.25)));
  const lobeAng = Array.from({ length: nLobes }, (_, i) => (i / nLobes) * Math.PI * 2 + rnd() * 0.25);
  const lobeJit = Array.from({ length: nLobes }, () => 0.75 + rnd() * 0.5);
  const sched = [0.22, 0.42, 0.6, 0.74, 0.85, 0.93, 0.98, 1].slice(-frames);
  const out: PixelBuffer[] = [];
  sched.forEach((s, f) => {
    const b = buf(W, H);
    const life = f / Math.max(1, frames - 1);
    const rx = RX * s;
    const ry = RY * s;
    // Dust band trailing just inside the front.
    const dustR = Math.max(1.2, dust0 * (1 - life * 0.5));
    if (f >= 1) {
      const lobes: Lobe[] = [];
      for (let i = 0; i < nLobes; i++) {
        const a = lobeAng[i]!;
        const front = Math.sin(a) > 0 ? 1 : 0.7; // lower half (front) heavier
        const lag = 0.9 - life * 0.06;
        // Thin out into separate wisps on the way to the rim.
        if (life > 0.55 && i % 3 === 1) continue;
        if (life > 0.8 && i % 3 === 2) continue;
        const r = dustR * lobeJit[i]! * front;
        if (r < 1) continue;
        lobes.push({
          x: cx + Math.cos(a) * rx * lag,
          y: cy + Math.sin(a) * ry * lag - r * 0.5,
          r,
          sy: front === 1 ? 0.85 : 0.7,
        });
      }
      paintLobes(
        b,
        lobes.sort((p, q) => p.y - q.y),
        { ramp: life < 0.5 ? DUST_LIGHT : DUST, outlineLit: life < 0.5 ? 'stone2' : 'stone1', creases: false },
      );
    }
    // Pressure front: white (thick) → stone → dashed faint.
    if (life < 0.99) {
      const front = f === 0 ? 'white' : life < 0.45 ? 'stone5' : 'stone4';
      ellipseRing(
        b,
        cx,
        cy,
        rx,
        ry,
        (_x, _y, a) => {
          if (life < 0.6) return front;
          const k = Math.floor(((a + Math.PI) / (Math.PI * 2)) * (rx + ry) * 0.9);
          return k % 4 === 0 ? null : life > 0.8 ? 'stone3' : front;
        },
        life < 0.3 ? 2 : 1,
      );
      if (life < 0.5) ellipseRing(b, cx, cy + 1, rx - 1, ry - 0.5, (x, y) => (has(b, x, y) ? null : 'stone2'));
    }
    out.push(b);
  });
  return cropFrames(out, { x: Math.floor(cx), y: Math.floor(cy) });
}

/* ------------------------------------------------------------------ debris & smoke particles */

const CHUNKS: Record<string, { rows: string[]; keys: Record<string, string> }> = {
  // Asphalt lump: dark top, lit upper-left corner.
  a: { rows: ['.oo.', 'oLGo', 'oGDo', '.oo.'], keys: { o: 'ink', L: 'gray4', G: 'gray3', D: 'gray2' } },
  // Brick shard.
  b: { rows: ['ooo.', 'oLRo', '.oRo', '..o.'], keys: { o: 'rust0', L: 'rust4', R: 'rust2' } },
  // Hot shrapnel sliver.
  c: { rows: ['o...', 'oWo.', '.oZo', '..o.'], keys: { o: 'zinc0', W: 'white', Z: 'zinc3' } },
  // Big slab (missile): kerb stone with a lit top.
  d: {
    rows: ['.ooo..', 'oLLGo.', 'oGGGDo', '.oDDo.', '..oo..'],
    keys: { o: 'ink', L: 'stone4', G: 'stone2', D: 'stone1' },
  },
};

function rotRows(rows: string[]): string[] {
  const h = rows.length;
  const w = rows[0]!.length;
  const out: string[] = [];
  for (let x = 0; x < w; x++) {
    let r = '';
    for (let y = h - 1; y >= 0; y--) r += rows[y]![x]!;
    out.push(r);
  }
  return out;
}

/** Tumbling debris chunk: 4 frames (90° steps), anchor = centre. */
export function debrisChunk(kind: keyof typeof CHUNKS): Framed {
  const { rows, keys: K } = CHUNKS[kind]!;
  const S = Math.max(rows.length, rows[0]!.length) + 1;
  let r = rows;
  const frames: PixelBuffer[] = [];
  for (let f = 0; f < 4; f++) {
    const b = buf(S, S);
    const ox = Math.floor((S - r[0]!.length) / 2);
    const oy = Math.floor((S - r.length) / 2);
    r.forEach((row, y) => [...row].forEach((k, x) => K[k] && px(b, ox + x, oy + y, K[k])));
    // Keep the light pixel upper-left whatever the rotation: swap lit/dark on odd turns.
    frames.push(b);
    r = rotRows(r);
  }
  return { frames, anchor: { x: Math.floor(S / 2), y: Math.floor(S / 2) } };
}

/** Flaming debris: ember with a licking flame tail and a smoke fleck (4 frames). */
export function flamingDebris(): Framed {
  const frames = [0, 1, 2, 3].map((f) => {
    const b = buf(9, 9);
    // Flame tail streams up (it is falling), alternating licks.
    px(b, 4, 5, 'white');
    px(b, 5, 5, 'ochre4');
    px(b, 4, 6, 'ochre3');
    px(b, 5, 6, 'rust2');
    px(b, 4, 4, 'ochre3');
    px(b, f % 2 ? 3 : 5, 3, 'rust3');
    px(b, 4, 3, f % 2 ? 'ochre3' : 'rust3');
    px(b, f % 2 ? 4 : 3, 2, 'rust1');
    if (f >= 2) px(b, f === 2 ? 5 : 3, 1, 'gray3');
    px(b, 3, 5, 'rust1');
    px(b, 6, 6, 'ink');
    px(b, 5, 7, 'ink');
    return b;
  });
  return { frames, anchor: { x: 4, y: 5 } };
}

/**
 * Lingering blast smoke: billows up from a dark core, grows, greys, then tears and drifts
 * apart (10 frames). `variant` changes the lobe layout. Anchor = base.
 */
export function blastSmoke(variant: number, R: number): Framed {
  const W = Math.ceil(R * 4) + 6;
  const H = Math.ceil(R * 4.2) + 6;
  const gx = Math.floor(W / 2);
  const gy = H - 3;
  const rnd = prng(variant * 17 + 3);
  const base = Array.from({ length: 5 }, (_, i) => ({
    ax: (i - 2) * 0.42 + (rnd() - 0.5) * 0.3,
    ay: -0.4 - rnd() * 0.5 - (i === 2 ? 0.4 : 0),
    r: 0.45 + rnd() * 0.25 + (i === 2 ? 0.15 : 0),
  }));
  const frames: PixelBuffer[] = [];
  const n = 10;
  for (let f = 0; f < n; f++) {
    const t = f / (n - 1);
    const b = buf(W, H);
    const grow = Math.min(1, 0.45 + t * 1.6);
    const tear = Math.max(0, (t - 0.55) / 0.45);
    const lift = R * (0.2 + t * 1.3);
    const lobes: Lobe[] = base.map((l, i) => ({
      x: gx + 0.5 + l.ax * R * grow * (1 + tear * 0.5) + t * R * 0.25,
      y: gy - R * 0.9 - lift + l.ay * R * grow - tear * (i % 2) * R * 0.3,
      r: Math.max(0.8, l.r * R * grow * (1 - tear * 0.6) - (i % 2) * tear * R * 0.15),
    }));
    const holes: Lobe[] =
      tear > 0
        ? [{ x: gx + 0.5 + R * 0.2, y: gy - R * 0.9 - lift, r: R * 0.32 * tear }]
        : [];
    paintLobes(
      b,
      lobes.sort((p, q) => p.y - q.y),
      {
        ramp: t < 0.25 ? SMOKE_DARK : t < 0.6 ? SMOKE_MID : SMOKE,
        outlineLit: t < 0.6 ? 'gray1' : 'gray2',
        holes,
        spec: 'one',
      },
    );
    frames.push(b);
  }
  return cropFrames(frames, { x: gx, y: gy });
}

/** Low rolling dust (base surge) puff that rides outward with the recipe's velocity. */
export function rollingDust(R: number): Framed {
  const W = Math.ceil(R * 3.4) + 4;
  const H = Math.ceil(R * 2.2) + 4;
  const gx = Math.floor(W / 2);
  const gy = H - 2;
  const frames = [0.55, 0.85, 1, 1, 0.9, 0.7, 0.45].map((s, f) => {
    const b = buf(W, H);
    const tear = Math.max(0, (f - 3) / 3);
    const lobes: Lobe[] = [
      { x: gx - R * 0.7 * s, y: gy - R * 0.55 * s, r: R * 0.5 * s, sy: 0.85 },
      { x: gx + 0.5, y: gy - R * 0.8 * s - f * 0.4, r: R * 0.62 * s, sy: 0.85 },
      { x: gx + R * 0.75 * s, y: gy - R * 0.5 * s, r: R * 0.45 * s, sy: 0.85 },
    ].map((l, i) => ({ ...l, x: l.x + (i - 1) * tear * R * 0.5 }));
    paintLobes(b, lobes, {
      ramp: f < 3 ? DUST_LIGHT : DUST,
      outlineLit: 'stone1',
      creases: false,
      holes: tear > 0 ? [{ x: gx, y: gy - R * 0.5, r: R * 0.3 * tear }] : [],
    });
    return b;
  });
  return cropFrames(frames, { x: gx, y: gy });
}

/* ------------------------------------------------------------------ decals */

/** Small integer hash (cluster dithering). */
function hash2(x: number, y: number, seed: number): number {
  let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(seed, 83492791)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

/**
 * Scorch decal (ground, tags ['decal']): a sooty iso starburst with radial streaks, pocks from
 * shrapnel, a few dying embers; `crater` adds a blasted pit (lit lower-right inner wall, shaded
 * upper-left, raised lit rim) and rubble.
 */
export function scorchDecal(rx: number, seed: number, crater: boolean): Framed {
  const ry = rx / 2;
  const W = Math.ceil(rx * 2.5) + 4;
  const H = Math.ceil(ry * 2.5) + 4;
  const cx = W / 2;
  const cy = H / 2;
  const rnd = prng(seed);
  const b = buf(W, H);
  const k = mask(W, H);
  // Ragged blob: overlapping ellipses + rays.
  ellipseMask(k, cx, cy, rx * 0.72, ry * 0.72);
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rx * (0.25 + rnd() * 0.35);
    ellipseMask(k, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.5, rx * (0.22 + rnd() * 0.16), ry * (0.22 + rnd() * 0.16));
  }
  const rays = 8 + Math.floor(rnd() * 3);
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + rnd() * 0.3;
    const len = rx * (0.82 + rnd() * 0.22);
    for (let t = 0.4; t < 1; t += 0.5 / len) {
      const w = Math.pow(1 - t, 1.4) * (2.6 + rx * 0.06);
      const x = cx + Math.cos(a) * len * t;
      const y = cy + Math.sin(a) * len * t * 0.5;
      ellipseMask(k, x, y, Math.max(0.6, w), Math.max(0.5, w * 0.5));
    }
  }
  const d = chamfer(k);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mget(k, x, y)) continue;
      const ex = (x + 0.5 - cx) / rx;
      const ey = (y + 0.5 - cy) / ry;
      const a = Math.atan2(ey, ex);
      // Ragged band edges (angular wobble) and 2×2 soot clusters (no per-pixel noise).
      const q = Math.hypot(ex, ey) / (1 + 0.13 * Math.sin(5 * a + seed) + 0.08 * Math.sin(9 * a + seed * 2));
      const n = hash2(x >> 1, y >> 1, seed) % 100;
      const depth = d[y * W + x]!;
      let c: string | null;
      if (q < 0.36) c = 'ink';
      else if (q < 0.6) c = n < 22 ? 'ink' : 'gray1';
      else if (depth > 1.2) c = n < 35 ? 'gray1' : 'gray2';
      else c = n < 55 ? 'gray2' : n < 75 ? 'stone0' : null;
      if (c) px(b, x, y, c);
    }
  }
  // Shrapnel pocks: tiny lit-edge pits scattered around.
  for (let i = 0; i < Math.round(rx * 0.5); i++) {
    const a = rnd() * Math.PI * 2;
    const r = 0.5 + rnd() * 0.6;
    const x = Math.round(cx + Math.cos(a) * rx * r);
    const y = Math.round(cy + Math.sin(a) * ry * r);
    px(b, x, y, 'ink');
    px(b, x + 1, y + 1, 'stone1');
  }
  if (crater) {
    const pr = rx * 0.34;
    const qr = pr / 2;
    // Raised rim: lit (upper-left outer) and shaded (lower-right outer) rubble lip.
    const lip = (_x: number, _y: number, a: number): string => {
      const l = Math.cos(a - Math.PI * 1.25);
      return l > 0.25 ? 'stone3' : l < -0.4 ? 'gray2' : 'stone1';
    };
    ellipseRing(b, cx, cy, pr + 3, qr + 1.8, lip, 3);
    // Pit: dark, with the lower-right inner wall catching the light.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!inEllipse(x, y, cx, cy, pr, qr)) continue;
        const lit = !inEllipse(x - 2, y - 1.5, cx, cy, pr, qr);
        const deep = inEllipse(x, y, cx - 1, cy - 0.5, pr * 0.55, qr * 0.55);
        px(b, x, y, deep ? 'ink' : lit ? 'stone0' : 'gray1');
      }
    }
    // Rubble chunks around the lip.
    for (let i = 0; i < Math.round(rx * 0.3); i++) {
      const a = rnd() * Math.PI * 2;
      const r = 1.1 + rnd() * 0.7;
      const x = Math.round(cx + Math.cos(a) * (pr + 2) * r);
      const y = Math.round(cy + Math.sin(a) * (qr + 1) * r);
      rect(b, x, y, 2, 2, 'stone1');
      px(b, x, y, 'stone3');
      px(b, x + 2, y + 1, 'ink');
      px(b, x + 1, y + 2, 'ink');
    }
  }
  // Dying embers.
  for (let i = 0; i < Math.round(rx / 6) + 2; i++) {
    const x = Math.round(cx + (rnd() - 0.5) * rx * 0.8);
    const y = Math.round(cy + (rnd() - 0.5) * ry * 0.8);
    px(b, x, y, rnd() < 0.5 ? 'rust3' : 'ochre2');
  }
  return { frames: [b], anchor: { x: Math.floor(cx), y: Math.floor(cy) } };
}

/** Helper for tests / docs: does a mask-free buffer have any opaque pixel? */
export function isEmpty(b: PixelBuffer): boolean {
  for (let i = 3; i < b.data.length; i += 4) if (b.data[i]) return false;
  return true;
}

export type { Mask };
