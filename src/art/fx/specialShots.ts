/**
 * Special-skill projectiles and close-range FX (playtest round 2):
 *
 * - Ram (Mounted Riot Police): gallop dust trail with flung clods, hoof-strike puffs and the
 *   knock-back burst when a protester is bowled aside (KO stars: reuse `fx.ko.stars`).
 * - Rapid fire (Armed Cops): a hotter, bigger muzzle flash with a smoke curl, long tracer streaks
 *   and a 5-casing ejection arc that bounces on the asphalt.
 * - Frag grenade (Soldiers): olive pineapple grenade (8-frame spin, fixed lighting — only the fuse
 *   and spoon turn), the spoon flicking off at the throw, a flight shadow.
 * - Missile (Tank) and rockets (Helicopter): 16 screen directions with a flickering exhaust,
 *   smoke-trail puffs and the launcher's back-blast.
 *
 * Directions: 8-dir sprites use the screen DIRS of particles.ts (iso diagonals 2:1); 16-dir
 * sprites are indexed 0…15 at k·22.5° (0 = east, clockwise, screen y down) — pick with `dir16`.
 */
import type { PixelBuffer } from '../lib/pixels';
import { SHADOW_ALPHA } from '../palette';
import { buf, col, line, outlineBuf, paintLobes, prng, px, type Lobe } from './draw';
import { DIR_VEC, type Dir8 } from './particles';
import { cropFrames, type Framed } from './specialBlasts';

const DUST = ['stone1', 'stone2', 'stone3', 'stone4', 'stone5'];
const DUST_DARK = ['stone0', 'stone1', 'stone2', 'stone3', 'stone4'];

/** Index 0…15 of the 16-direction sprite closest to the screen vector (dx, dy). */
export function dir16(dx: number, dy: number): number {
  const a = Math.atan2(dy, dx);
  return (Math.round((a / (Math.PI * 2)) * 16) + 16) % 16;
}

/* ================================================================== ram */

/**
 * Gallop dust (horse heading screen-right; register the mirror for left): a low rolling cloud
 * kicked up behind the hooves, rising and tearing apart, with clods of grit flung backwards.
 * 7 frames. Anchor = ground point where the hind hooves struck.
 */
export function gallopDust(): Framed {
  const W = 30;
  const H = 18;
  const ax = 18;
  const ay = 15;
  const rnd = prng(12);
  const clods = Array.from({ length: 6 }, () => ({
    vx: -1.2 - rnd() * 2.2,
    vy: -1.6 - rnd() * 1.4,
    dark: rnd() < 0.5,
  }));
  const frames: PixelBuffer[] = [];
  const sizes = [0.5, 0.85, 1, 1, 0.9, 0.7, 0.45];
  sizes.forEach((s, f) => {
    const b = buf(W, H);
    const drift = f * 1.6; // the cloud lags behind (left) as the horse runs on
    const tear = Math.max(0, (f - 3) / 3);
    const lobes: Lobe[] = [
      { x: ax - 3 - drift, y: ay - 2.2 * s, r: 3 * s, sy: 0.8 },
      { x: ax - 8 - drift * 1.2, y: ay - 3 * s - f * 0.3, r: 3.6 * s, sy: 0.85 },
      { x: ax - 13 - drift * 1.4, y: ay - 2.4 * s - f * 0.5, r: 2.6 * s, sy: 0.8 },
      { x: ax + 1 - drift * 0.6, y: ay - 1.5 * s, r: 2 * s, sy: 0.8 },
    ].map((l, i) => ({ ...l, y: l.y - (i % 2) * tear * 2, r: Math.max(0.8, l.r * (1 - tear * (i % 2 ? 0.5 : 0.3))) }));
    paintLobes(b, lobes, {
      ramp: f < 4 ? DUST : DUST_DARK,
      outlineLit: 'stone1',
      creases: false,
      holes: tear > 0 ? [{ x: ax - 8 - drift * 1.2, y: ay - 3.5, r: 2.2 * tear }] : [],
    });
    for (const c of clods) {
      const t = f + 0.5;
      const x = ax + c.vx * t;
      const y = ay - 2 + c.vy * t + 0.55 * t * t;
      if (y > ay + 1 || f > 5) continue;
      px(b, x, y, c.dark ? 'earth1' : 'earth3');
      if (f < 3) px(b, x + 1, y, c.dark ? 'earth2' : 'stone2');
    }
    frames.push(b);
  });
  return { frames, anchor: { x: ax, y: ay } };
}

/** Hoof strike: a flat crack of dust both ways + 2 grit specks hopping (4 frames). */
export function hoofPuff(): Framed {
  const W = 15;
  const H = 9;
  const ax = 7;
  const ay = 7;
  const frames = [0, 1, 2, 3].map((f) => {
    const b = buf(W, H);
    const spread = [1.5, 3.5, 5, 5.8][f]!;
    const r = [1.4, 2, 1.8, 1.1][f]!;
    paintLobes(
      b,
      [
        { x: ax + 0.5 - spread, y: ay - 0.5 - f * 0.3, r, sy: 0.8 },
        { x: ax + 0.5 + spread, y: ay - 0.5 - f * 0.3, r: r * 0.9, sy: 0.8 },
        ...(f < 2 ? [{ x: ax + 0.5, y: ay - 1, r: r * 0.9, sy: 0.8 }] : []),
      ],
      { ramp: DUST, outlineLit: 'stone1', creases: false },
    );
    if (f > 0 && f < 3) {
      px(b, ax - 2 - f, ay - 2 - f * 1.5 + f * f * 0.5, 'earth2');
      px(b, ax + 3 + f, ay - 3 - f + f * f * 0.5, 'stone2');
    }
    return b;
  });
  return { frames, anchor: { x: ax, y: ay } };
}

/**
 * Bowled aside (protester knocked toward screen-right; mirror for left). Frame 0: a cartoon
 * impact star at chest height; 1: it pops, three bent speed arcs fling out in the knock
 * direction; 2–5: a skid of dust at the feet trailing the knock, grit flying. Anchor = the
 * protester's ground point at the moment of impact. Pair with `fx.ko.stars` over the head.
 */
// prettier-ignore
const IMPACT = [
  '.....o......',
  '..o..Yo..o..',
  '..oY.WYo.Yo.',
  '...oWWWWYo..',
  'ooYWWWWWWYoo',
  '.oYWWWWWWWo.',
  '..oYWWWWYo..',
  '.oYoYWWYoYo.',
  '.o...oYo..o.',
  '......o.....',
];
const IMPACT_KEYS: Record<string, string> = { W: 'white', Y: 'ochre4', o: 'rust3' };

export function knockBurst(): Framed {
  const W = 34;
  const H = 26;
  const ax = 12;
  const ay = 22;
  const frames: PixelBuffer[] = [];
  for (let f = 0; f < 6; f++) {
    const b = buf(W, H);
    // Skid dust trailing toward the knock direction.
    if (f >= 1) {
      const p = (f - 1) / 4;
      const lobes: Lobe[] = [
        { x: ax + 3 + p * 9, y: ay - 2 - p, r: 2.8 + p * 1 - Math.max(0, p - 0.6) * 4, sy: 0.8 },
        { x: ax - 1 + p * 5, y: ay - 1.5, r: 2.2 + p * 0.6 - Math.max(0, p - 0.5) * 3, sy: 0.8 },
        { x: ax + 7 + p * 12, y: ay - 1.5 - p * 1.5, r: 2 + p * 1.2 - Math.max(0, p - 0.7) * 5, sy: 0.85 },
      ].filter((l) => l.r >= 1);
      paintLobes(b, lobes, { ramp: DUST, outlineLit: 'stone1', creases: false });
    }
    // Speed arcs: three bent streaks flung up-and-out (frames 1–3).
    if (f >= 1 && f <= 3) {
      const len = [9, 12, 8][f - 1]!;
      const lead = ax + 4 + f * 4;
      for (const [dy, k, dim] of [
        [-15, 0.12, false],
        [-10, 0.0, false],
        [-5, -0.08, true],
      ] as const) {
        for (let i = 0; i < len; i++) {
          const x = lead + i - (f === 3 ? 3 : 0);
          const y = ay + dy - Math.round(i * i * k * 0.18) + (dy === -5 ? 0 : 0);
          const c = i > len - 3 ? (dim || f === 3 ? 'stone4' : 'white') : i > len * 0.4 ? 'stone4' : 'stone3';
          px(b, x, y, c);
        }
      }
    }
    // Impact star.
    if (f < 2) {
      const ox = ax + 1 - (IMPACT[0]!.length >> 1) + f * 2;
      const oy = ay - 15 - (f ? 1 : 0);
      IMPACT.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          let k = row[x]!;
          if (f === 1 && (k === 'W' || (k === 'Y' && x > 3 && x < 8 && y > 2 && y < 7))) k = '.'; // pops hollow
          if (k !== '.') px(b, ox + x, oy + y, IMPACT_KEYS[k]!);
        }
      });
    }
    // Grit flying.
    if (f >= 1 && f <= 4) {
      for (const [vx, vy] of [
        [2.4, -1.8],
        [3.2, -1],
        [1.4, -2.4],
      ] as const) {
        const t = f;
        px(b, ax + 2 + vx * t, ay - 3 + vy * t + 0.6 * t * t, f < 3 ? 'stone2' : 'stone1');
      }
    }
    frames.push(b);
  }
  return { frames, anchor: { x: ax, y: ay } };
}

/* ================================================================== rapid fire */

/** Banded muzzle star along angle `a` (white core → ochre → rust rim), like particles.ts. */
function muzzleStar(b: PixelBuffer, c: number, a: number, main: number, side: number, core: number, seed: number, hot: boolean): void {
  const rnd = prng(seed);
  const spikes: Array<[number, number, number]> = [
    [0, main, 0.5],
    [-(0.95 + rnd() * 0.2), side, 0.55],
    [0.95 + rnd() * 0.2, side * (0.8 + rnd() * 0.4), 0.55],
    [-0.35, main * 0.6, 0.25],
    [0.35, main * 0.55, 0.25],
  ];
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const dx = x + 0.5 - (c + 0.5);
      const dy = y + 0.5 - (c + 0.5);
      const d = Math.hypot(dx, dy);
      let phi = Math.atan2(dy, dx) - a;
      phi = Math.atan2(Math.sin(phi), Math.cos(phi));
      let r = core;
      for (const [o, len, hw] of spikes) {
        let dp = Math.abs(phi - o);
        if (dp > Math.PI) dp = Math.PI * 2 - dp;
        const k = 1 - dp / hw;
        if (k > 0) r = Math.max(r, core + (len - core) * Math.pow(k, 1.5));
      }
      if (d > r) continue;
      const q = d / r;
      px(b, x, y, hot ? (q < 0.4 ? 'white' : q < 0.65 ? 'ochre4' : q < 0.85 ? 'ochre3' : 'rust3') : q < 0.45 ? 'ochre4' : q < 0.8 ? 'ochre3' : 'rust3');
    }
  }
}

/** Rapid-fire flash: big hot star → shrinking star + smoke curl → smoke curl (3 frames). */
export function rapidFlash(dir: Dir8, seed: number): Framed {
  const S = 23;
  const c = 11;
  const [vx, vy] = DIR_VEC[dir];
  const a = Math.atan2(vy, vx);
  const frames = [0, 1, 2].map((f) => {
    const b = buf(S, S);
    if (f >= 1) {
      // Smoke curl drifting up from the muzzle.
      const lobes: Lobe[] = [
        { x: c + 0.5 + vx * 3, y: c - 0.5 + vy * 3 - f, r: 1.6 + f * 0.4 },
        { x: c + 0.5 + vx * 5 + 1, y: c - 2 + vy * 4 - f * 1.5, r: 1.2 + f * 0.3 },
      ];
      paintLobes(b, lobes, { ramp: ['gray3', 'gray5', 'gray6', 'gray7', 'white'], outlineLit: 'gray4', creases: false });
    }
    if (f < 2) muzzleStar(b, c, a, f === 0 ? 8 : 5, f === 0 ? 4 : 2.5, f === 0 ? 2.4 : 1.6, seed + f, f === 0);
    return b;
  });
  return { frames, anchor: { x: c, y: c } };
}

/** Long tracer streak (2 frames: hot streak, then a cooling, broken one). Anchor = head. */
export function rapidTracer(dir: Dir8): Framed {
  const [vx, vy] = DIR_VEC[dir];
  const L = 15;
  const ex = Math.round(vx * (L - 1));
  const ey = Math.round(vy * (L - 1));
  const W = Math.abs(ex) + 3;
  const H = Math.abs(ey) + 3;
  const hx = (ex >= 0 ? W - 2 : 1);
  const hy = (ey >= 0 ? H - 2 : 1);
  const frames = [0, 1].map((f) => {
    const b = buf(W, H);
    // Hot glow under the head (1 px wider at the front).
    if (f === 0) {
      line(b, hx, hy, hx - Math.round(vx * 4), hy - Math.round(vy * 4), 'ochre3');
      px(b, hx + (Math.abs(vy) > 0.9 ? 1 : 0), hy + (Math.abs(vy) > 0.9 ? 0 : 1), 'ochre3');
    }
    line(b, hx, hy, hx - ex, hy - ey, (t) => {
      if (f === 0) return t < 0.14 ? 'white' : t < 0.38 ? 'ochre4' : t < 0.7 ? 'ochre3' : 'rust3';
      if (t < 0.25) return null;
      return Math.floor(t * 9) % 3 === 0 ? null : t < 0.6 ? 'ochre2' : 'rust3';
    });
    return b;
  });
  return { frames, anchor: { x: hx, y: hy } };
}

/**
 * Five casings ejected to the shooter's right (screen-right; mirror for left), one every 3
 * frames @25 fps (= 0.12 s, the burst cadence): spinning brass, a tumble, a bounce on the
 * asphalt with a glint, then they lie there. 20 frames. Anchor = the shooter's ground point.
 */
export function casingBurst(): Framed {
  const W = 30;
  const H = 22;
  const ax = 9;
  const ay = 19;
  const rnd = prng(77);
  const shells = Array.from({ length: 5 }, (_, i) => ({
    t0: i * 3,
    vx: 1.05 + rnd() * 0.5,
    vy: -1.5 - rnd() * 0.5,
    groundY: ay + Math.round((rnd() - 0.5) * 4),
    spin: i,
  }));
  // Spin poses: horizontal, diagonal, vertical, other diagonal (brass, lit end ochre3).
  const POSES: Array<Array<[number, number, string]>> = [
    [[0, 0, 'ochre1'], [1, 0, 'ochre3'], [2, 0, 'ochre2']],
    [[0, 1, 'ochre1'], [1, 0, 'ochre3']],
    [[0, 0, 'ochre3'], [0, 1, 'ochre1']],
    [[0, 0, 'ochre3'], [1, 1, 'ochre1']],
  ];
  const frames: PixelBuffer[] = [];
  for (let f = 0; f < 20; f++) {
    const b = buf(W, H);
    for (const s of shells) {
      const t = f - s.t0;
      if (t < 0) continue;
      const g = 0.32;
      let x = ax + 2 + s.vx * t;
      let y = ay - 11 + s.vy * t + g * t * t;
      let pose = (s.spin + t) % 4;
      let glint = false;
      if (y >= s.groundY) {
        // Landed: small bounce then rest flat.
        const tl = (-s.vy + Math.sqrt(s.vy * s.vy + 4 * g * (s.groundY - (ay - 11)))) / (2 * g);
        const after = t - tl;
        x = ax + 2 + s.vx * tl + Math.min(after, 3) * s.vx * 0.4;
        y = s.groundY - (after < 2 ? Math.round(1.5 * Math.sin((after / 2) * Math.PI)) : 0);
        pose = after < 2 ? (s.spin + t) % 4 : 0;
        glint = after >= 0 && after < 1;
      }
      for (const [dx, dy, c] of POSES[pose]!) px(b, x + dx, y + dy, c);
      if (glint) px(b, x + 1, y - 1, 'white');
    }
    frames.push(b);
  }
  return { frames, anchor: { x: ax, y: ay } };
}

/* ================================================================== frag grenade */

/**
 * Frag grenade in flight, 8 frames (45° per frame): an olive pineapple body that keeps its
 * upper-left light and segment grooves while the zinc fuse head and spoon lever orbit around it.
 * Clearly not the gas canister (a zinc tube with a green band). Anchor = centre.
 */
export function fragGrenade(): Framed {
  const S = 13;
  const c = 6.5;
  // Fixed body: an upright oval, lit from the upper left, with a lattice of segment grooves.
  const body = buf(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x + 0.5 - c) / 3.4;
      const dy = (y + 0.5 - c - 0.3) / 3.8;
      const q = dx * dx + dy * dy;
      if (q > 1) continue;
      const lit = dx * 0.7 + dy * 0.7;
      let ref = lit < -0.55 ? 'stone3' : lit < -0.05 ? 'olive2' : lit < 0.5 ? 'olive2' : 'olive1';
      // Grooves: every other row / column inside the rim, darker one step.
      const grooveRow = (y % 3 === 0 || x % 3 === 1) && q < 0.75;
      if (grooveRow && ref === 'olive2') ref = 'olive1';
      else if (grooveRow && ref === 'olive1') ref = 'green0';
      px(body, x, y, ref);
    }
  }
  const frames: PixelBuffer[] = [];
  for (let f = 0; f < 8; f++) {
    const b = buf(S, S);
    b.data.set(body.data);
    const a = -Math.PI / 2 + (f / 8) * Math.PI * 2;
    // Fuse head: a 2-px zinc cap on the rim at the orbit angle, the spoon lever hugging the body
    // on the trailing side.
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const fx = Math.floor(c + ux * 3.9);
    const fy = Math.floor(c + 0.3 + uy * 4.2);
    px(b, fx, fy, 'zinc4');
    px(b, fx + (Math.abs(uy) > 0.7 ? 1 : 0), fy + (Math.abs(uy) > 0.7 ? 0 : 1), 'zinc3');
    for (let k = 1; k <= 3; k++) {
      const sa = a + 0.42 * k;
      px(b, Math.floor(c + Math.cos(sa) * 3.9), Math.floor(c + 0.3 + Math.sin(sa) * 4.2), k === 1 ? 'zinc3' : 'zinc2');
    }
    outlineBuf(b, 'ink');
    frames.push(b);
  }
  return cropFrames(frames, { x: 6, y: 6 });
}

/** The spoon lever flicking off at the throw: 6 frames, flips up-right then drops. */
export function fragSpoon(): Framed {
  const W = 13;
  const H = 13;
  const shapes: Array<Array<[number, number]>> = [
    [[0, 0], [1, 0], [2, 1]],
    [[0, 1], [1, 0], [1, -1]],
    [[0, 0], [0, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 0]],
    [[0, 0], [1, 1], [1, 2]],
    [[0, 0], [1, 0], [2, 0]],
  ];
  const path: Array<[number, number]> = [
    [3, 8],
    [5, 5],
    [7, 3],
    [8, 3],
    [9, 5],
    [10, 9],
  ];
  const frames = shapes.map((sh, f) => {
    const b = buf(W, H);
    const [ox, oy] = path[f]!;
    sh.forEach(([dx, dy], i) => px(b, ox + dx - 1, oy + dy, i === 0 ? 'zinc4' : 'zinc2'));
    if (f < 2) px(b, ox - 2, oy + 1, 'white');
    return b;
  });
  return { frames, anchor: { x: 2, y: 9 } };
}

/** Small flight shadow (shadow swatch) for lobbed projectiles; anchor = centre. */
export function flightShadow(rx: number): Framed {
  const W = Math.ceil(rx * 2) + 1;
  const H = Math.max(3, Math.ceil(rx)) + 1;
  const b = buf(W, H);
  const ink = col('ink');
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - W / 2) / rx;
      const dy = (y + 0.5 - H / 2) / (rx * 0.45);
      if (dx * dx + dy * dy > 1) continue;
      const i = (y * W + x) * 4;
      b.data[i] = ink >>> 24;
      b.data[i + 1] = (ink >>> 16) & 255;
      b.data[i + 2] = (ink >>> 8) & 255;
      b.data[i + 3] = SHADOW_ALPHA;
    }
  }
  return { frames: [b], anchor: { x: Math.floor(W / 2), y: Math.floor(H / 2) } };
}

/* ================================================================== missile & rockets */

interface RocketSpec {
  /** Body length (px, without the nose / flame). */
  len: number;
  /** Body half-width. */
  hw: number;
  fin: number;
  body: [dark: string, mid: string, lit: string];
  nose: string;
  band: string | null;
  flame: number;
}

const MISSILE: RocketSpec = {
  len: 9,
  hw: 1.45,
  fin: 2.6,
  body: ['olive1', 'olive2', 'stone3'],
  nose: 'stone4',
  band: 'ochre3',
  flame: 5,
};
const ROCKET: RocketSpec = {
  len: 6,
  hw: 1.05,
  fin: 1.9,
  body: ['zinc1', 'zinc3', 'zinc4'],
  nose: 'crim2',
  band: null,
  flame: 4,
};

/**
 * A rocket drawn analytically along angle `a`: capsule body lit from the upper left, pointed
 * nose, tail fins, an optional warning band, and a flickering exhaust plume behind it
 * (`f` = flicker frame). Ink outline around the body only (the flame is emissive).
 */
function rocketAt(spec: RocketSpec, a: number, f: number): Framed {
  const S = Math.ceil(spec.len + spec.flame + 8) * 2 + 1;
  const c = Math.floor(S / 2);
  const b = buf(S, S);
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  // Normal pointing toward the light (upper-left) decides which side is lit.
  const nx = -uy;
  const ny = ux;
  const litSide = nx * -0.7 + ny * -0.7 > 0 ? 1 : -1;
  const tail = -spec.len / 2;
  const head = spec.len / 2;
  // Flame first (behind), body over it.
  const fl = spec.flame + (f % 2 ? -1 : 0.5);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - (c + 0.5);
      const dy = y + 0.5 - (c + 0.5);
      const u = dx * ux + dy * uy;
      const v = dx * nx + dy * ny;
      const back = tail - u; // distance behind the tail
      if (back > 0 && back < fl) {
        const w = spec.hw * 0.95 * (1 - back / fl) + 0.35;
        if (Math.abs(v) <= w) px(b, x, y, back < fl * 0.3 ? 'white' : back < fl * 0.6 ? 'ochre4' : 'ochre3');
        else if (Math.abs(v) <= w + 0.8 && back < fl * 0.8) px(b, x, y, 'rust3');
      }
    }
  }
  const body = buf(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - (c + 0.5);
      const dy = y + 0.5 - (c + 0.5);
      const u = dx * ux + dy * uy;
      const v = dx * nx + dy * ny;
      let ref: string | null = null;
      if (u >= tail && u <= head && Math.abs(v) <= spec.hw) {
        const side = v * litSide;
        ref = side > spec.hw * 0.35 ? spec.body[2] : side < -spec.hw * 0.35 ? spec.body[0] : spec.body[1];
        if (spec.band && u > head - 3 && u <= head - 2) ref = spec.band;
      } else if (u > head && u <= head + 2.6 && Math.abs(v) <= spec.hw * (1 - (u - head) / 2.8)) {
        ref = spec.nose;
      } else if (u >= tail - 0.4 && u <= tail + 2 && Math.abs(v) <= spec.fin && Math.abs(v) > spec.hw - 0.2) {
        ref = spec.body[0];
      }
      if (ref) px(body, x, y, ref);
    }
  }
  outlineBuf(body, 'ink');
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      if (body.data[i + 3]) b.data.set(body.data.subarray(i, i + 4), i);
    }
  }
  return { frames: [b], anchor: { x: c, y: c } };
}

/** 16-direction rocket set, 2 flicker frames each, cropped; anchor = rocket centre. */
export function rocketSet(kind: 'missile' | 'rocket'): Framed[] {
  const spec = kind === 'missile' ? MISSILE : ROCKET;
  return Array.from({ length: 16 }, (_, k) => {
    const a = (k / 16) * Math.PI * 2;
    const fr = [0, 1].map((f) => rocketAt(spec, a, f));
    return cropFrames(
      fr.map((r) => r.frames[0]!),
      fr[0]!.anchor,
    );
  });
}

/**
 * Exhaust smoke puff left behind every ~3 px of flight: hot spark → white puff → swelling grey
 * → torn wisp. `big` = missile, else rocket. Anchor = centre.
 */
export function exhaustPuff(big: boolean): Framed {
  const S = big ? 13 : 9;
  const c = S / 2;
  const radii = big ? [1.2, 2.2, 3, 3.6, 3.8, 3.2] : [0.9, 1.6, 2.2, 2.6, 2.2];
  const frames = radii.map((r, f) => {
    const b = buf(S, S);
    if (f === 0) {
      px(b, c, c, 'white');
      px(b, c - 1, c, 'ochre4');
      px(b, c, c + 1, 'ochre3');
      return b;
    }
    const tear = f >= radii.length - 2;
    const lobes: Lobe[] = tear
      ? [
          { x: c - r * 0.6, y: c - f * 0.3, r: r * 0.55 },
          { x: c + r * 0.6, y: c - 0.5 - f * 0.5, r: r * 0.45 },
        ]
      : [
          { x: c - r * 0.3, y: c - f * 0.3, r },
          { x: c + r * 0.5, y: c - 0.5 - f * 0.4, r: r * 0.7 },
        ];
    paintLobes(b, lobes, {
      ramp: f === 1 ? ['gray4', 'gray6', 'gray7', 'white', 'white'] : ['gray2', 'gray4', 'gray5', 'gray6', 'gray7'],
      outlineLit: f === 1 ? 'gray5' : 'gray3',
      creases: false,
    });
    return b;
  });
  return { frames, anchor: { x: Math.floor(c), y: Math.floor(c) } };
}

/**
 * Launcher back-blast (tank missile / heli rocket pod): flash, then a ring of grey billows
 * rolling out and up from the launcher. 7 frames. Anchor = launcher mouth.
 */
export function launchBlast(): Framed {
  const W = 40;
  const H = 30;
  const cx = 20;
  const cy = 20;
  const frames: PixelBuffer[] = [];
  for (let f = 0; f < 7; f++) {
    const b = buf(W, H);
    const p = f / 6;
    if (f >= 1) {
      const spread = 3 + p * 12;
      const r = 2.2 + Math.sin(Math.min(1, p * 1.6) * Math.PI * 0.5) * 3 - Math.max(0, p - 0.7) * 6;
      const lobes: Lobe[] = [-1, -0.5, 0, 0.5, 1].map((s, i) => ({
        x: cx + 0.5 + s * spread,
        y: cy - 1 - (1 - Math.abs(s)) * (2 + p * 5) - p * 2 + (i % 2),
        r: Math.max(1, r * (1 - Math.abs(s) * 0.3)),
        sy: 0.85,
      }));
      paintLobes(b, lobes.sort((q, w) => q.y - w.y), {
        ramp: p < 0.35 ? ['gray3', 'gray5', 'gray6', 'gray7', 'white'] : ['gray2', 'gray4', 'gray5', 'gray6', 'gray7'],
        outlineLit: 'gray3',
        creases: false,
        holes: p > 0.6 ? [{ x: cx + 0.5, y: cy - 4 - p * 4, r: (p - 0.5) * 7 }] : [],
      });
    }
    if (f < 2) {
      muzzleStar(b, Math.floor(cx), -Math.PI / 2, f === 0 ? 7 : 4, 5, 2.6, 5 + f, f === 0);
    }
    frames.push(b);
  }
  return cropFrames(frames, { x: cx, y: cy });
}
