/**
 * Weapon & debris FX: muzzle flashes (5 weapons × 8 screen directions), tracers (8 dirs,
 * short/long), rubber pellets, shell casings, impacts, sparks, glass shards, dust puffs and
 * looping smoke columns.
 *
 * Directions are *screen* directions: e, se, s, sw, w, nw, n, ne, where se/sw/ne/nw follow
 * the 2:1 iso diagonals (the directions units face).
 */
import type { SpriteRegistry } from '../lib/registry';
import type { PixelBuffer } from '../lib/pixels';
import { buf, disc, line, paintLobes, prng, px, type Lobe } from './draw';

export const DIRS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as const;
export type Dir8 = (typeof DIRS)[number];
/** Unit vectors per direction (iso diagonals are 2:1). */
export const DIR_VEC: Record<Dir8, [number, number]> = {
  e: [1, 0],
  se: [2 / Math.sqrt(5), 1 / Math.sqrt(5)],
  s: [0, 1],
  sw: [-2 / Math.sqrt(5), 1 / Math.sqrt(5)],
  w: [-1, 0],
  nw: [-2 / Math.sqrt(5), -1 / Math.sqrt(5)],
  n: [0, -1],
  ne: [2 / Math.sqrt(5), -1 / Math.sqrt(5)],
};

/* ------------------------------------------------------------- muzzle */

interface MuzzleSpec {
  core: number;
  main: number;
  side: number;
  thick: number;
  back?: number;
  smoke?: boolean;
}

const MUZZLE: Record<string, MuzzleSpec> = {
  pistol: { core: 1.4, main: 4, side: 2, thick: 1 },
  rifle: { core: 1.8, main: 6, side: 3, thick: 1 },
  mg: { core: 2.2, main: 7, side: 4, thick: 2 },
  sniper: { core: 1.8, main: 10, side: 3, thick: 1, back: 2 },
  cannon: { core: 3.6, main: 12, side: 7, thick: 3, smoke: true },
};

/**
 * Muzzle flash as a filled star in the barrel's frame: a long forward spike, two side petals
 * at ±~50° and (for big guns) two inner spikes; banded white → yellow → orange → red rim.
 */
function flashShape(b: PixelBuffer, c: number, a: number, spec: MuzzleSpec, s: number, seed: number): void {
  const rnd = prng(seed);
  const spikes: Array<[number, number, number]> = [
    // [angle offset, length, half-width (radians)]
    [0, spec.main * s, 0.62],
    [-(0.95 + rnd() * 0.2), spec.side * s, 0.55],
    [0.95 + rnd() * 0.2, spec.side * s * (0.8 + rnd() * 0.4), 0.55],
  ];
  if (spec.thick >= 2) {
    spikes.push([-0.38, spec.main * 0.62 * s, 0.3], [0.38, spec.main * 0.62 * s, 0.3]);
  }
  if (spec.back) spikes.push([Math.PI, spec.back, 0.35]);
  const core = spec.core * s * 0.7 + 0.6;
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const dx = x + 0.5 - (c + 0.5);
      const dy = y + 0.5 - (c + 0.5);
      const d = Math.hypot(dx, dy);
      let phi = Math.atan2(dy, dx) - a;
      phi = Math.atan2(Math.sin(phi), Math.cos(phi));
      let r = core;
      for (const [o, len, hw] of spikes) {
        let dphi = Math.abs(phi - o);
        if (dphi > Math.PI) dphi = Math.PI * 2 - dphi;
        const k = 1 - dphi / hw;
        if (k > 0) r = Math.max(r, core + (len - core) * Math.pow(k, 1.6));
      }
      if (d > r) continue;
      const q = d / r;
      const ref = s < 1 ? (q < 0.4 ? 'ochre4' : q < 0.75 ? 'ochre3' : 'rust3') : q < 0.4 ? 'white' : q < 0.65 ? 'ochre4' : q < 0.85 ? 'ochre3' : 'rust3';
      px(b, x, y, ref);
    }
  }
}

function muzzleFrames(spec: MuzzleSpec, dir: Dir8, seed: number): PixelBuffer[] {
  const R = spec.main + 3;
  const S = R * 2 + 1;
  const c = R;
  const [vx, vy] = DIR_VEC[dir];
  const a = Math.atan2(vy, vx);
  const out: PixelBuffer[] = [];
  for (let f = 0; f < 2; f++) {
    const b = buf(S, S);
    if (spec.smoke && f === 1) {
      // Cannon: a ring of smoke billows around the muzzle on the second frame.
      const lobes: Lobe[] = [-0.9, -0.3, 0.3, 0.9].map((o, i) => ({
        x: c + 0.5 + vx * spec.main * 0.4 + Math.cos(a + Math.PI / 2) * o * 4.5,
        y: c + 0.5 + vy * spec.main * 0.4 + Math.sin(a + Math.PI / 2) * o * 3.5,
        r: 2.8 + (i % 2) * 0.8,
      }));
      paintLobes(b, lobes.sort((p, q) => p.y - q.y), { ramp: ['gray2', 'gray4', 'gray5', 'gray6', 'gray7'] });
    }
    flashShape(b, c, a, spec, f === 0 ? 1 : 0.55, seed + f);
    out.push(b);
  }
  return out;
}

/* ------------------------------------------------------------- tracers */

function tracer(dir: Dir8, len: number): { b: PixelBuffer; anchor: { x: number; y: number } } {
  const [vx, vy] = DIR_VEC[dir];
  const ex = Math.round(vx * (len - 1));
  const ey = Math.round(vy * (len - 1));
  const w = Math.abs(ex) + 1;
  const h = Math.abs(ey) + 1;
  const b = buf(w, h);
  const hx = ex >= 0 ? w - 1 : 0;
  const hy = ey >= 0 ? h - 1 : 0;
  line(b, hx, hy, hx - ex, hy - ey, (t) => (t < 0.12 ? 'white' : t < 0.4 ? 'ochre4' : t < 0.75 ? 'ochre3' : 'ochre2'));
  return { b, anchor: { x: hx, y: hy } };
}

/* ------------------------------------------------------------- small bits */

function pellet(): PixelBuffer[] {
  return [0, 1].map((f) => {
    const b = buf(5, 5);
    disc(b, 2.5, 2.5, 2.3, 'ink');
    disc(b, 2.5, 2.5, 1.5, 'gray5');
    px(b, f ? 2 : 1, 1, 'white');
    px(b, f ? 1 : 3, 3, 'gray3');
    return b;
  });
}

function casing(): PixelBuffer[] {
  const shapes: Array<Array<[number, number, string]>> = [
    [[1, 2, 'ochre1'], [2, 2, 'ochre2'], [3, 2, 'ochre3']],
    [[1, 3, 'ochre1'], [2, 2, 'ochre2'], [3, 1, 'ochre4']],
    [[2, 1, 'ochre3'], [2, 2, 'ochre2'], [2, 3, 'ochre1']],
    [[1, 1, 'ochre3'], [2, 2, 'ochre2'], [3, 3, 'ochre1']],
  ];
  return shapes.map((s) => {
    const b = buf(5, 5);
    for (const [x, y, r] of s) px(b, x, y, r);
    return b;
  });
}

function impactDirt(): PixelBuffer[] {
  const rnd = prng(4);
  const bits = Array.from({ length: 5 }, () => ({ vx: (rnd() - 0.5) * 4, vy: -1.5 - rnd() * 1.5 }));
  return [0, 1, 2, 3].map((f) => {
    const b = buf(13, 11);
    const lobes: Lobe[] = [
      { x: 5, y: 7 - f * 0.5, r: [1.5, 2.4, 2.6, 2][f]! },
      { x: 8, y: 7.5 - f * 0.4, r: [1.2, 2, 2.2, 1.6][f]! },
    ];
    paintLobes(b, lobes, { ramp: ['stone0', 'stone1', 'stone2', 'stone3', 'stone4'], outlineLit: 'stone1' });
    for (const p of bits) {
      const x = 6 + p.vx * (f + 1);
      const y = 7 + p.vy * (f + 1) + 0.7 * (f + 1) * (f + 1);
      if (y < 10) px(b, x, y, f < 2 ? 'stone2' : 'stone1');
    }
    return b;
  });
}

function sparkBurst(n: number, seed: number, frames: number, S: number, gravity: number): PixelBuffer[] {
  const rnd = prng(seed);
  const sp = Array.from({ length: n }, () => {
    const a = -Math.PI * rnd();
    const v = 1.6 + rnd() * 1.6;
    return { vx: Math.cos(a) * v * (rnd() < 0.3 ? -1 : 1), vy: Math.sin(a) * v };
  });
  const c = Math.floor(S / 2);
  return Array.from({ length: frames }, (_, f) => {
    const b = buf(S, S);
    if (f === 0) {
      disc(b, c + 0.5, c + 0.5, 1.6, 'ochre4');
      px(b, c, c, 'white');
    }
    for (const p of sp) {
      const t = f + 1;
      const x = c + p.vx * t;
      const y = c + p.vy * t + gravity * t * t;
      const x0 = c + p.vx * (t - 0.8);
      const y0 = c + p.vy * (t - 0.8) + gravity * (t - 0.8) * (t - 0.8);
      const life = f / (frames - 1);
      if (life > 0.9 && p.vx > 0) continue;
      line(b, x0, y0, x, y, (q) => (q > 0.6 ? (life < 0.5 ? 'white' : 'ochre4') : life < 0.5 ? 'ochre3' : 'rust3'));
    }
    return b;
  });
}

function glassShards(): PixelBuffer[] {
  const rnd = prng(31);
  const sh = Array.from({ length: 10 }, (_, i) => ({ vx: (rnd() - 0.5) * 3.2, vy: -1 - rnd() * 2.2, k: i % 3, rot: i % 2 }));
  return [0, 1, 2, 3, 4, 5].map((f) => {
    const b = buf(23, 18);
    for (const s of sh) {
      const t = f + 0.6;
      const x = Math.round(11 + s.vx * t);
      const y = Math.min(15, Math.round(8 + s.vy * t + 0.45 * t * t));
      const c = ['sky', 'white', 'zinc3'][s.k]!;
      if ((f + s.rot) % 2 === 0) {
        px(b, x, y, c);
        px(b, x + 1, y + 1, 'zinc2');
      } else {
        px(b, x, y, c);
        px(b, x, y + 1, 'zinc3');
      }
    }
    return b;
  });
}

function glassGround(): PixelBuffer {
  const b = buf(15, 7);
  const pts: Array<[number, number, string]> = [
    [2, 3, 'sky'], [3, 3, 'zinc2'], [5, 1, 'white'], [6, 5, 'sky'], [7, 5, 'zinc3'], [9, 2, 'zinc3'],
    [10, 2, 'white'], [12, 4, 'sky'], [11, 5, 'zinc2'], [4, 5, 'zinc3'], [8, 3, 'sky'],
  ];
  for (const [x, y, r] of pts) px(b, x, y, r);
  return b;
}

const DUST = ['stone1', 'stone2', 'stone3', 'stone4', 'stone5'];

function dust(kind: 'step' | 'trample' | 'land'): PixelBuffer[] {
  if (kind === 'step') {
    return [0, 1, 2].map((f) => {
      const b = buf(11, 6);
      const r = [1.3, 1.8, 1.2][f]!;
      paintLobes(b, [
        { x: 3.5 - f * 0.6, y: 3.5 - f * 0.4, r },
        { x: 7.5 + f * 0.6, y: 3.5 - f * 0.4, r: r * 0.85 },
      ], { ramp: DUST, outlineLit: 'stone2' });
      return b;
    });
  }
  if (kind === 'trample') {
    return [0, 1, 2, 3].map((f) => {
      const b = buf(17, 9);
      const r = [1.6, 2.4, 2.4, 1.6][f]!;
      paintLobes(b, [
        { x: 5 - f, y: 5.5 - f * 0.5, r },
        { x: 8.5, y: 4.5 - f * 0.6, r: r + 0.4 },
        { x: 12 + f, y: 5.5 - f * 0.5, r },
      ], { ramp: DUST, outlineLit: 'stone2' });
      return b;
    });
  }
  return [0, 1, 2, 3, 4].map((f) => {
    const b = buf(31, 11);
    const spread = [3, 7, 10, 12, 13][f]!;
    const r = [2, 3, 3, 2.4, 1.5][f]!;
    const lobes: Lobe[] = [
      { x: 15.5 - spread, y: 7 - f * 0.4, r: r * 0.8 },
      { x: 15.5 + spread, y: 7 - f * 0.4, r: r * 0.8 },
      { x: 15.5 - spread * 0.55, y: 7 - f * 0.6, r },
      { x: 15.5 + spread * 0.55, y: 7 - f * 0.6, r },
    ];
    if (f < 2) lobes.push({ x: 15.5, y: 7.5, r: r * 0.9 });
    paintLobes(b, lobes, { ramp: DUST, outlineLit: 'stone2' });
    return b;
  });
}

/** Looping smoke column: puffs rise, grow, drift with the wind and thin out at the top. */
function smokeColumn(W: number, H: number, n: number, rMin: number, rMax: number, ramp: string[], seed: number): PixelBuffer[] {
  const rnd = prng(seed);
  const jitter = Array.from({ length: n }, () => rnd() - 0.5);
  const frames: PixelBuffer[] = [];
  const F = 8;
  for (let f = 0; f < F; f++) {
    const b = buf(W, H);
    const lobes: Lobe[] = [];
    for (let i = 0; i < n; i++) {
      const p = ((i + f / F) / n) % 1; // 0 base → 1 top
      const r = rMin + (rMax - rMin) * Math.sin(Math.min(1, p * 1.25) * Math.PI * 0.5) - (p > 0.82 ? (p - 0.82) * 14 : 0);
      if (r < 0.9) continue;
      const wob = Math.sin(i * 2.4) * (1 + p * 2.5);
      lobes.push({
        x: W * 0.32 + p * p * W * 0.32 + wob + jitter[i]! * 2 * p,
        y: H - rMin - 2 - Math.pow(p, 0.85) * (H - rMax * 1.5 - rMin),
        r: r * (0.8 + (i % 3) * 0.15),
      });
    }
    // Paint top (oldest) first so younger puffs overlap from below.
    paintLobes(b, lobes.sort((a, c) => a.y - c.y), { ramp, outlineLit: ramp[1] });
    frames.push(b);
  }
  return frames;
}

export function registerParticles(reg: SpriteRegistry): void {
  let seed = 1;
  for (const [weapon, spec] of Object.entries(MUZZLE)) {
    for (const d of DIRS) {
      const frames = muzzleFrames(spec, d, seed++);
      const c = Math.floor(frames[0]!.w / 2);
      reg.add(`fx.muzzle.${weapon}.${d}`, { group: 'fx', frames, fps: 20, loop: false, anchor: { x: c, y: c } });
    }
  }
  for (const d of DIRS) {
    const s = tracer(d, 6);
    reg.add(`fx.tracer.${d}`, { group: 'fx', frames: s.b, anchor: s.anchor });
    const l = tracer(d, 11);
    reg.add(`fx.tracer.long.${d}`, { group: 'fx', frames: l.b, anchor: l.anchor });
  }
  reg.add('fx.pellet', { group: 'fx', frames: pellet(), fps: 12, anchor: { x: 2, y: 2 } });
  reg.add('fx.casing', { group: 'fx', frames: casing(), fps: 16, anchor: { x: 2, y: 2 } });
  const ground = buf(5, 5);
  px(ground, 1, 3, 'ochre1');
  px(ground, 2, 3, 'ochre2');
  px(ground, 3, 3, 'ochre3');
  reg.add('fx.casing.ground', { group: 'fx', frames: ground, anchor: { x: 2, y: 3 } });
  reg.add('fx.impact.dirt', { group: 'fx', frames: impactDirt(), fps: 14, loop: false, anchor: { x: 6, y: 8 } });
  reg.add('fx.impact.spark', { group: 'fx', frames: sparkBurst(5, 3, 3, 11, 0.1), fps: 18, loop: false, anchor: { x: 5, y: 5 } });
  reg.add('fx.sparks', { group: 'fx', frames: sparkBurst(9, 8, 6, 23, 0.32), fps: 14, loop: false, anchor: { x: 11, y: 11 } });
  reg.add('fx.glass.shards', { group: 'fx', frames: glassShards(), fps: 14, loop: false, anchor: { x: 11, y: 15 } });
  reg.add('fx.glass.ground', { group: 'fx', frames: glassGround(), anchor: { x: 7, y: 3 } });
  reg.add('fx.dust.step', { group: 'fx', frames: dust('step'), fps: 12, loop: false, anchor: { x: 5, y: 5 } });
  reg.add('fx.dust.trample', { group: 'fx', frames: dust('trample'), fps: 10, loop: false, anchor: { x: 8, y: 8 } });
  reg.add('fx.dust.land', { group: 'fx', frames: dust('land'), fps: 14, loop: false, anchor: { x: 15, y: 10 } });
  reg.add('fx.smoke.column.grey', {
    group: 'fx',
    frames: smokeColumn(26, 50, 6, 2.5, 6.5, ['gray2', 'gray4', 'gray5', 'gray6', 'gray7'], 5),
    fps: 6,
    anchor: { x: 8, y: 45 },
  });
  reg.add('fx.smoke.column.black', {
    group: 'fx',
    frames: smokeColumn(38, 76, 7, 3.5, 9.5, ['ink', 'gray1', 'gray2', 'gray3', 'gray4'], 9),
    fps: 6,
    anchor: { x: 12, y: 68 },
  });
  // Single small smoke puff (gun smoke, exhaust, generic): 5 frames.
  const puff = [1.2, 2, 2.6, 2.4, 1.6].map((r, f) => {
    const b = buf(11, 12);
    paintLobes(b, [
      { x: 5, y: 7 - f, r },
      { x: 6.5, y: 6.5 - f * 1.2, r: r * 0.7 },
    ], { ramp: ['gray3', 'gray5', 'gray6', 'gray7', 'white'], outlineLit: 'gray4' });
    return b;
  });
  reg.add('fx.smoke.puff', { group: 'fx', frames: puff, fps: 10, loop: false, anchor: { x: 5, y: 9 } });
}
