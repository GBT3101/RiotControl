/**
 * World one-shots: horses, vehicles, sirens, paparazzi, doors, whistles, bells, crowd swells.
 */
import { ahr, burst, partials, tone, type Synth } from './kit';

function clop(s: Synth, t: number, g: number): void {
  burst(s, { t, type: 'bandpass', f: 1100 * s.v(0.12), q: 3.5, peak: 0.9 * g, decay: 0.03 });
  tone(s, { t, f0: 320 * s.v(0.08), f1: 210, drop: 0.03, peak: 0.35 * g, decay: 0.035 });
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 400, peak: 0.3 * g, attack: 0.002, decay: 0.04 });
}

/** Four gallop strides on cobbles ("ta-ta-dum"). */
export function hooves(s: Synth): void {
  for (let k = 0; k < 4; k++) {
    const base = s.t + k * 0.36 + s.r(-0.01, 0.01);
    clop(s, base, 0.75);
    clop(s, base + 0.075 + s.r(-0.006, 0.006), 0.7);
    clop(s, base + 0.15 + s.r(-0.006, 0.006), 1);
  }
}

/** Horse whinny: formant-filtered saw with a rise, a wobbling fall and a snort. */
export function horseWhinny(s: Synth): void {
  const t = s.t;
  const d = 1.1;
  const o = s.osc('sawtooth', 650, t, d);
  o.frequency.setValueAtTime(s.hz(650), t);
  o.frequency.exponentialRampToValueAtTime(s.hz(1150), t + 0.12);
  o.frequency.exponentialRampToValueAtTime(s.hz(950), t + 0.35);
  o.frequency.exponentialRampToValueAtTime(s.hz(480), t + 1);
  const lfo = s.osc('sine', 11, t, d);
  const depth = s.gain();
  depth.gain.setValueAtTime(10, t);
  depth.gain.linearRampToValueAtTime(70, t + 0.9);
  lfo.connect(depth).connect(o.frequency);
  const env = s.gain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(0.5, t + 0.06);
  env.gain.linearRampToValueAtTime(0.42, t + 0.6);
  env.gain.exponentialRampToValueAtTime(1e-4, t + d);
  for (const [f, q, g] of [
    [1100, 5, 1],
    [2500, 6, 0.5],
    [600, 3, 0.5],
  ] as const) {
    const bp = s.filter('bandpass', f, q);
    const gg = s.gain(g * 2.2);
    o.connect(bp).connect(gg).connect(env);
  }
  env.connect(s.out);
  burst(s, { t, type: 'bandpass', f: 2000, q: 1, peak: 0.08, attack: 0.05, decay: 1 });
  burst(s, { t: t + 1.15, kind: 'pink', type: 'lowpass', f: 900, peak: 0.45, attack: 0.01, decay: 0.18 });
}

function engine(
  s: Synth,
  t: number,
  d: number,
  f: [number, number, number],
  cut: [number, number, number],
  peak: number,
): void {
  const saw = s.osc('sawtooth', f[0], t, d);
  const sq = s.osc('square', f[0] / 2, t, d);
  for (const [o, k] of [
    [saw, 1],
    [sq, 0.5],
  ] as const) {
    o.frequency.setValueAtTime(s.hz(f[0] * k), t);
    o.frequency.exponentialRampToValueAtTime(s.hz(f[1] * k), t + d * 0.32);
    o.frequency.exponentialRampToValueAtTime(s.hz(f[2] * k), t + d * 0.92);
  }
  const lp = s.filter('lowpass', cut[0], 2);
  lp.frequency.setValueAtTime(cut[0], t);
  lp.frequency.exponentialRampToValueAtTime(cut[1], t + d * 0.32);
  lp.frequency.exponentialRampToValueAtTime(cut[2], t + d * 0.92);
  const g = s.gain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.08);
  g.gain.linearRampToValueAtTime(peak * 0.9, t + d * 0.7);
  g.gain.exponentialRampToValueAtTime(1e-4, t + d);
  const sat = s.shaper(2);
  saw.connect(lp);
  sq.connect(lp);
  lp.connect(sat).connect(g).connect(s.out);
}

export function humveeRev(s: Synth): void {
  engine(s, s.t, 1.4, [42, 95, 70], [300, 900, 500], 0.5);
  burst(s, { t: s.t, kind: 'brown', type: 'lowpass', f: 250, peak: 0.4, attack: 0.1, decay: 1.2 });
}

export function tankTracks(s: Synth): void {
  const t = s.t;
  engine(s, t, 1.6, [32, 62, 48], [250, 600, 400], 0.5);
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 160, peak: 0.45, attack: 0.1, decay: 1.4 });
  for (let i = 0; i < 12; i++) {
    const ti = t + 0.12 + i * 0.11 * s.v(0.08);
    tone(s, { t: ti, f0: 900 * s.v(0.15), peak: 0.12, decay: 0.03, type: 'triangle' });
    burst(s, { t: ti, type: 'bandpass', f: 2400, q: 1.5, peak: 0.25, decay: 0.015 });
  }
  tone(s, { t: t + 0.5, f0: 1300, f1: 1150, drop: 0.2, peak: 0.04, attack: 0.02, decay: 0.25 });
}

/** Helicopter passing overhead: rotor chops swelling and fading, Doppler-falling whine. */
export function heliPass(s: Synth): void {
  const t = s.t;
  const n = 15;
  for (let i = 0; i < n; i++) {
    const ti = t + i * 0.1;
    const x = i / (n - 1);
    const g = Math.sin(Math.PI * Math.min(1, x * 1.15)) * 0.9 + 0.1;
    burst(s, { t: ti, kind: 'pink', type: 'lowpass', f: 500 + 400 * (1 - x), q: 1.2, peak: 0.9 * g, attack: 0.006, decay: 0.07 });
    tone(s, { t: ti, f0: 78 - 10 * x, peak: 0.35 * g, attack: 0.005, decay: 0.06 });
  }
  tone(s, { t, f0: 2300, f1: 1900, drop: 1.5, peak: 0.035, attack: 0.4, decay: 1.2 });
}

/** Heavy steel barrier dropped on the asphalt. */
export function blockadeSlam(s: Synth): void {
  const t = s.t;
  tone(s, { t, f0: 95, f1: 55, drop: 0.2, peak: 0.9, decay: 0.25 });
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 500, peak: 0.9, attack: 0.002, decay: 0.2 });
  partials(s, t, 210, [1, 2.4, 3.9, 5.6], [0.18, 0.13, 0.09, 0.05], [0.6, 0.4, 0.3, 0.2]);
  burst(s, { t, type: 'highpass', f: 3000, peak: 0.3, decay: 0.03 });
  const t2 = t + 0.12;
  partials(s, t2, 260, [1, 2.5, 4.1], [0.08, 0.05, 0.03], [0.3, 0.2, 0.15]);
  burst(s, { t: t2, kind: 'brown', type: 'lowpass', f: 400, peak: 0.35, attack: 0.002, decay: 0.08 });
}

/** Slide whistle down — an officer is thrown off a roof. */
export function fallWhistle(s: Synth): void {
  const t = s.t;
  const o = s.osc('sine', 1700, t, 0.9);
  o.frequency.setValueAtTime(s.hz(1700), t);
  o.frequency.exponentialRampToValueAtTime(s.hz(380), t + 0.78);
  const lfo = s.osc('sine', 6, t, 0.9);
  const ld = s.gain(18);
  lfo.connect(ld).connect(o.frequency);
  const g = s.gain();
  ahr(g.gain, t, 0.22, 0.03, 0.65, 0.12);
  o.connect(g).connect(s.out);
  burst(s, { t, type: 'bandpass', f: 1500, f1: 400, sweep: 0.75, q: 2, peak: 0.05, attack: 0.03, decay: 0.75 });
}

/** European two-tone siren (≈ A4 / D5, 0.55 s each). */
export function siren(s: Synth): void {
  const t = s.t;
  const d = 3.3;
  const a = s.osc('sawtooth', 440, t, d);
  const b = s.osc('square', 440, t, d);
  for (let k = 0; k < 6; k++) {
    const f = s.hz(k % 2 === 0 ? 440 : 587);
    a.frequency.setTargetAtTime(f, t + k * 0.55, 0.012);
    b.frequency.setTargetAtTime(f, t + k * 0.55, 0.012);
  }
  const bg = s.gain(0.5);
  const bp = s.filter('bandpass', 1300, 0.8);
  const sat = s.shaper(2);
  const lp = s.filter('lowpass', 3500, 0.7);
  const g = s.gain();
  ahr(g.gain, t, 0.3, 0.1, 2.85, 0.3);
  a.connect(bp);
  b.connect(bg).connect(bp);
  bp.connect(sat).connect(lp).connect(g).connect(s.out);
}

export function shutterAt(s: Synth, t: number): void {
  burst(s, { t, type: 'bandpass', f: 3200, q: 2, peak: 0.6, decay: 0.012 });
  tone(s, { t, f0: 1700, peak: 0.2, decay: 0.012, type: 'triangle' });
  const t2 = t + 0.05;
  burst(s, { t: t2, type: 'bandpass', f: 2100, q: 2, peak: 0.5, decay: 0.018 });
  tone(s, { t: t2, f0: 900, peak: 0.15, decay: 0.02 });
  const m = s.osc('sawtooth', 160, t + 0.07, 0.14);
  const bp = s.filter('bandpass', 1200, 2);
  const g = s.gain();
  ahr(g.gain, t + 0.07, 0.07, 0.01, 0.08, 0.04);
  m.connect(bp).connect(g).connect(s.out);
}

export function shutter(s: Synth): void {
  shutterAt(s, s.t);
}

export function flashWhineAt(s: Synth, t: number, peak = 0.06): void {
  burst(s, { t, type: 'highpass', f: 4500, peak: 0.35, decay: 0.03 });
  const o = s.osc('sine', 2400, t, 0.8);
  o.frequency.setValueAtTime(s.hz(2400), t);
  o.frequency.exponentialRampToValueAtTime(s.hz(8500), t + 0.7);
  const g = s.gain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.05);
  g.gain.linearRampToValueAtTime(peak * 0.8, t + 0.6);
  g.gain.exponentialRampToValueAtTime(1e-5, t + 0.8);
  o.connect(g).connect(s.out);
}

export function flashWhine(s: Synth): void {
  flashWhineAt(s, s.t);
}

/** Breta's entourage arrives: a volley of shutters and flash whines. */
export function paparazzi(s: Synth): void {
  for (let i = 0; i < 5; i++) shutterAt(s, s.t + s.r(0, 0.7));
  flashWhineAt(s, s.t + 0.05, 0.04);
  flashWhineAt(s, s.t + 0.4, 0.035);
}

/** Door latch + creaky hinge. */
export function doorOpen(s: Synth): void {
  const t = s.t;
  burst(s, { t, type: 'bandpass', f: 2600, q: 2.5, peak: 0.45, decay: 0.012 });
  tone(s, { t, f0: 220, f1: 180, drop: 0.04, peak: 0.3, decay: 0.05 });
  const tc = t + 0.05;
  const o = s.osc('sawtooth', 55, tc, 0.45);
  let f = 55 * s.v(0.1);
  o.frequency.setValueAtTime(s.hz(f), tc);
  for (let i = 1; i < 9; i++) {
    f = Math.max(35, Math.min(95, f + s.r(-14, 16)));
    o.frequency.linearRampToValueAtTime(s.hz(f), tc + i * 0.045);
  }
  const g = s.gain();
  ahr(g.gain, tc, 0.5, 0.04, 0.25, 0.1);
  for (const [fq, q, k] of [
    [1100, 8, 1],
    [2300, 10, 0.6],
  ] as const) {
    const bp = s.filter('bandpass', fq * s.v(0.08), q);
    const gg = s.gain(k * 2.5);
    o.connect(bp).connect(gg).connect(g);
  }
  g.connect(s.out);
}

function whistleBlast(s: Synth, t: number, d: number): void {
  const o = s.osc('sine', 2900, t, d);
  const lfo = s.osc('sine', 28, t, d);
  const ld = s.gain(140 * s.p);
  lfo.connect(ld).connect(o.frequency);
  const g = s.gain();
  ahr(g.gain, t, 0.22, 0.015, d - 0.05, 0.04);
  o.connect(g).connect(s.out);
  burst(s, { t, type: 'bandpass', f: 2900, q: 2, peak: 0.06, attack: 0.015, decay: d });
}

/** Police pea whistle: short-long. */
export function whistle(s: Synth): void {
  whistleBlast(s, s.t, 0.22);
  whistleBlast(s, s.t + 0.32, 0.5);
}

/** Electric alarm bell (Capitol damage state worsens). */
export function alarmBell(s: Synth): void {
  const t = s.t;
  const d = 1.5;
  const am = s.osc('square', 22, t, d);
  const amd = s.gain(0.5);
  const trem = s.gain();
  trem.gain.value = 0.5;
  am.connect(amd).connect(trem.gain);
  const g = s.gain();
  ahr(g.gain, t, 0.12, 0.005, 1.1, 0.3);
  for (const [r, k] of [
    [1, 1],
    [2.7, 0.5],
    [5.1, 0.25],
  ] as const) {
    const o = s.osc('sine', 1150 * r, t, d);
    const og = s.gain(k);
    o.connect(og).connect(trem);
  }
  trem.connect(g).connect(s.out);
}

const VOWELS = {
  a: [800, 1150, 2800],
  e: [500, 1750, 2600],
  o: [480, 850, 2600],
  u: [340, 750, 2400],
} as const;

/** One-shot crowd swell (cheer/roar). */
export function crowdRoar(s: Synth): void {
  crowdSwell(s, 'a', 2, 0.9);
}

export function crowdBoo(s: Synth): void {
  crowdSwell(s, 'u', 2, 0.9);
  // Voiced component: a handful of low voices sliding down.
  const t = s.t;
  const bank = formantBank(s, VOWELS.u, 1.3);
  for (let i = 0; i < 6; i++) {
    const f0 = s.r(105, 170);
    const o = s.osc('sawtooth', f0, t, 2);
    o.frequency.setValueAtTime(s.hz(f0), t + 0.2);
    o.frequency.exponentialRampToValueAtTime(s.hz(f0 * 0.85), t + 1.8);
    const g = s.gain();
    ahr(g.gain, t + s.r(0, 0.15), 0.07, 0.25, 0.9, 0.6);
    o.connect(g).connect(bank);
  }
}

function formantBank(s: Synth, f: readonly number[], level: number): GainNode {
  const input = s.gain(1);
  const out = s.gain(level);
  const qs = [5, 7, 8];
  const gs = [1, 0.55, 0.25];
  for (let i = 0; i < 3; i++) {
    const bp = s.filter('bandpass', f[i]!, qs[i]);
    const g = s.gain(gs[i]! * 3);
    input.connect(bp).connect(g).connect(out);
  }
  out.connect(s.out);
  return input;
}

function crowdSwell(s: Synth, vowel: keyof typeof VOWELS, d: number, peak: number): void {
  const t = s.t;
  const n = s.noise('pink', t, d);
  const env = s.gain();
  ahr(env.gain, t, peak, 0.3, d * 0.3, d * 0.5);
  const bank = formantBank(s, VOWELS[vowel], 1);
  n.connect(env).connect(bank);
  burst(s, { t, kind: 'pink', type: 'lowpass', f: 500, peak: peak * 0.4, attack: 0.3, decay: d * 0.7 });
}

export function crowdClap(s: Synth, t: number, layers: number, peak: number): void {
  for (let i = 0; i < layers; i++) {
    burst(s, {
      t: t + s.r(0, 0.03),
      type: 'bandpass',
      f: s.r(1100, 1700),
      q: 1.4,
      peak: s.r(peak * 0.6, peak),
      decay: s.r(0.04, 0.06),
    });
  }
}

/** Audition of the crowd's chant rhythm: "clap clap clap-clap-clap". */
export function clapChant(s: Synth): void {
  for (const b of [0, 0.5, 1, 1.25, 1.5]) crowdClap(s, s.t + b, 8, 0.35);
}

