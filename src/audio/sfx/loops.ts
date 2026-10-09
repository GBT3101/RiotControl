/**
 * Loop recipes. Each renders `length + xfade` seconds offline; the baker crossfades the tail
 * into the head so the buffer loops seamlessly. Periodic parts use integer cycles per loop
 * (e.g. 10 MG rounds in 1 s, a 2350 Hz turbine whine in 1 s) so the seam is phase-continuous.
 */
import type { BusName, LoopId } from '../types';
import { mgRound } from './combat';
import { burst, type Synth } from './kit';

export interface LoopDef {
  bus: BusName;
  length: number;
  xfade: number;
  gain: number;
  /** Maximum simultaneously audible emitters (nearest/loudest win). */
  max: number;
  /** Apply Doppler-ish pitch from emitter motion. */
  doppler: boolean;
  fadeIn: number;
  fadeOut: number;
  /** Renders `total` = length + xfade seconds starting at t = 0. */
  recipe: (s: Synth, total: number, length: number) => void;
}

function rounds(s: Synth, perSecond: number, total: number, length: number, light: boolean): void {
  const n = Math.floor(total * perSecond + 1e-6);
  const seam = Math.round(length * perSecond);
  for (let i = 0; i <= n; i++) {
    const t = i / perSecond;
    // Rounds at the loop seam (0 and length) must coincide exactly; jitter the others.
    const j = i === 0 || i === seam ? 0 : s.r(-0.004, 0.004);
    mgRound(s, t + j, light);
  }
}

/** Constant-level layer for the whole render. */
function steady(s: Synth, node: AudioNode, total: number, level: number): void {
  const g = s.gain(level);
  node.connect(g).connect(s.out);
  void total;
}

function fireBed(s: Synth, total: number): void {
  const n = s.noise('pink', 0, total);
  const lp = s.filter('lowpass', 900, 0.7);
  const g = s.gain();
  g.gain.setValueAtTime(0.25, 0);
  for (let t = 0.25; t < total; t += 0.25) g.gain.linearRampToValueAtTime(s.r(0.15, 0.35), t);
  n.connect(lp).connect(g).connect(s.out);
  const r = s.noise('brown', 0, total);
  const rl = s.filter('lowpass', 180, 0.7);
  steady(s, r.connect(rl), total, 0.35);
  const crackles = Math.round(total * 22);
  for (let i = 0; i < crackles; i++) {
    burst(s, {
      t: s.r(0, total),
      type: 'bandpass',
      f: s.r(1500, 5000),
      q: 2,
      peak: s.r(0.08, 0.35),
      decay: s.r(0.004, 0.012),
    });
  }
  for (let i = 0; i < Math.round(total * 3); i++) {
    burst(s, { t: s.r(0, total), type: 'bandpass', f: s.r(400, 900), q: 1.5, peak: s.r(0.2, 0.45), decay: 0.02 });
  }
}

function gasBed(s: Synth, total: number): void {
  const n = s.noise('white', 0, total);
  const hp = s.filter('highpass', 2500, 0.7);
  const lp = s.filter('lowpass', 9000, 0.7);
  const g = s.gain();
  g.gain.setValueAtTime(0.3, 0);
  for (let t = 0.15; t < total; t += 0.15) g.gain.linearRampToValueAtTime(s.r(0.18, 0.32), t);
  n.connect(hp).connect(lp).connect(g).connect(s.out);
  const n2 = s.noise('pink', 0, total);
  const bp = s.filter('bandpass', 1200, 0.8);
  steady(s, n2.connect(bp), total, 0.18);
}

function heli(s: Synth, total: number): void {
  const n = Math.floor(total * 10 + 1e-6);
  for (let i = 0; i <= n; i++) {
    const t = i / 10;
    burst(s, { t, kind: 'pink', type: 'lowpass', f: 700, q: 1.2, peak: 0.9, attack: 0.006, decay: 0.07 });
    const o = s.osc('sine', 72, t, 0.065);
    const g = s.gain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.005);
    g.gain.exponentialRampToValueAtTime(1e-4, t + 0.065);
    o.connect(g).connect(s.out);
  }
  const bed = s.noise('pink', 0, total);
  const lp = s.filter('lowpass', 1500, 0.7);
  steady(s, bed.connect(lp), total, 0.12);
  steady(s, s.osc('sine', 2350, 0, total), total, 0.025);
  steady(s, s.osc('sine', 4700, 0, total), total, 0.01);
}

function diesel(s: Synth, total: number, f: number, cut: number, level: number): void {
  const saw = s.osc('sawtooth', f, 0, total);
  const sq = s.osc('square', f / 2, 0, total);
  const lp = s.filter('lowpass', cut, 1.5);
  const sat = s.shaper(2);
  const am = s.gain();
  am.gain.value = 0.75;
  const lfo = s.osc('sine', 7, 0, total);
  const ld = s.gain(0.25);
  lfo.connect(ld).connect(am.gain);
  const g = s.gain(level);
  saw.connect(lp);
  sq.connect(lp);
  lp.connect(sat).connect(am).connect(g).connect(s.out);
  const r = s.noise('brown', 0, total);
  const rl = s.filter('lowpass', 200, 0.7);
  steady(s, r.connect(rl), total, 0.25);
}

function tank(s: Synth, total: number, length: number): void {
  diesel(s, total, 33, 300, 0.5);
  const n = Math.floor(total * 8 + 1e-6);
  const seam = Math.round(length * 8);
  for (let i = 0; i <= n; i++) {
    const t = i === 0 || i === seam ? i / 8 : i / 8 + s.r(-0.01, 0.01);
    const o = s.osc('triangle', 850 * s.v(0.15), t, 0.04);
    const g = s.gain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.001);
    g.gain.exponentialRampToValueAtTime(1e-4, t + 0.035);
    o.connect(g).connect(s.out);
    burst(s, { t, type: 'bandpass', f: 2300, q: 1.3, peak: 0.2, decay: 0.015 });
  }
}

export const LOOPS: Readonly<Record<LoopId, LoopDef>> = {
  mgLoop: {
    bus: 'sfx',
    length: 1,
    xfade: 0.05,
    gain: 0.55,
    max: 3,
    doppler: false,
    fadeIn: 0.005,
    fadeOut: 0.08,
    recipe: (s, total, length) => rounds(s, 10, total, length, false),
  },
  doorGunLoop: {
    bus: 'sfx',
    length: 1,
    xfade: 0.04,
    gain: 0.45,
    max: 2,
    doppler: false,
    fadeIn: 0.005,
    fadeOut: 0.08,
    recipe: (s, total, length) => rounds(s, 12, total, length, true),
  },
  fireLoop: {
    bus: 'sfx',
    length: 3,
    xfade: 0.3,
    gain: 0.4,
    max: 4,
    doppler: false,
    fadeIn: 0.3,
    fadeOut: 0.8,
    recipe: fireBed,
  },
  gasLoop: {
    bus: 'sfx',
    length: 2,
    xfade: 0.3,
    gain: 0.22,
    max: 3,
    doppler: false,
    fadeIn: 0.4,
    fadeOut: 1,
    recipe: gasBed,
  },
  heliLoop: {
    bus: 'sfx',
    length: 1,
    xfade: 0.05,
    gain: 0.5,
    max: 2,
    doppler: true,
    fadeIn: 0.4,
    fadeOut: 0.6,
    recipe: heli,
  },
  humveeLoop: {
    bus: 'sfx',
    length: 1,
    xfade: 0.08,
    gain: 0.3,
    max: 3,
    doppler: true,
    fadeIn: 0.3,
    fadeOut: 0.5,
    recipe: (s, total) => diesel(s, total, 42, 420, 0.45),
  },
  tankLoop: {
    bus: 'sfx',
    length: 2,
    xfade: 0.1,
    gain: 0.38,
    max: 3,
    doppler: true,
    fadeIn: 0.3,
    fadeOut: 0.6,
    recipe: tank,
  },
};
