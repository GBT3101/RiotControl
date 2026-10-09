/**
 * UI one-shots: clicks, stamps, typewriter, fanfares and stingers.
 * Fanfares reuse the music instruments so they sit in the same "Ministry band" timbre.
 */
import { INSTRUMENTS } from '../music/instruments';
import { ahr, burst, partials, perc, tone, type Synth } from './kit';

export function click(s: Synth): void {
  tone(s, { t: s.t, f0: 1500, f1: 950, drop: 0.02, peak: 0.35, decay: 0.045 });
  burst(s, { t: s.t, type: 'highpass', f: 4000, peak: 0.15, decay: 0.006 });
}

export function hover(s: Synth): void {
  tone(s, { t: s.t, f0: 2700, peak: 0.1, decay: 0.018 });
}

/** Deploy: a satisfying low "thunk" with a small metallic edge. */
export function deploy(s: Synth): void {
  const t = s.t;
  tone(s, { t, f0: 170, f1: 78, drop: 0.08, peak: 0.8, decay: 0.14 });
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 900, peak: 0.5, attack: 0.002, decay: 0.07 });
  partials(s, t, 820, [1, 1.62], [0.12, 0.08], [0.12, 0.1]);
  burst(s, { t, type: 'highpass', f: 3000, peak: 0.15, decay: 0.01 });
}

/** Two short beating square buzzes: "bzzt-bzzt". */
export function error(s: Synth): void {
  for (let k = 0; k < 2; k++) {
    const tk = s.t + k * 0.15;
    const lp = s.filter('lowpass', 1400, 0.8);
    const g = s.gain();
    ahr(g.gain, tk, 0.22, 0.005, 0.09, 0.02);
    for (const f of [110, 117]) s.osc('square', f, tk, 0.13).connect(lp);
    lp.connect(g).connect(s.out);
  }
}

function stampAt(s: Synth, t: number): void {
  burst(s, { t, type: 'bandpass', f: 3500, q: 2, peak: 0.35, decay: 0.012 });
  tone(s, { t, f0: 1250, peak: 0.12, decay: 0.015, type: 'triangle' });
  const tc = t + 0.075;
  burst(s, { t: tc, kind: 'brown', type: 'lowpass', f: 420, peak: 0.9, attack: 0.002, decay: 0.12 });
  tone(s, { t: tc, f0: 135, f1: 70, drop: 0.07, peak: 0.7, decay: 0.12 });
  burst(s, { t: tc, type: 'bandpass', f: 1800, q: 0.9, peak: 0.3, decay: 0.04 });
}

/** Rubber stamp "ka-chunk". */
export function stamp(s: Synth): void {
  stampAt(s, s.t);
}

/** Legitimacy stamp: ka-chunk + a small bell of approval. */
export function legitStamp(s: Synth): void {
  stampAt(s, s.t);
  partials(s, s.t + 0.1, 1568, [1, 2.76], [0.08, 0.03], [0.6, 0.2]);
}

export function typeTick(s: Synth): void {
  burst(s, { t: s.t, type: 'bandpass', f: 3000 * s.v(0.1), q: 2.5, peak: 0.45, decay: 0.01 });
  tone(s, { t: s.t, f0: 750 * s.v(0.08), peak: 0.15, decay: 0.015 });
}

export function typeBell(s: Synth): void {
  partials(s, s.t, 2093, [1, 2.76, 5.4], [0.18, 0.06, 0.03], [0.9, 0.35, 0.15]);
}

/** Coin-ish "ching" for Hate gained. */
export function hateChing(s: Synth): void {
  const t = s.t;
  const notes: [number, number, number][] = [
    [988, 0, 0.07],
    [1319, 0.07, 0.3],
  ];
  for (const [f, dt, d] of notes) {
    const o = s.osc('square', f, t + dt, d);
    const lp = s.filter('lowpass', 5000, 0.7);
    const g = s.gain();
    perc(g.gain, t + dt, 0.1, 0.002, d);
    o.connect(lp).connect(g).connect(s.out);
    tone(s, { t: t + dt, f0: f * 2, peak: 0.04, decay: d * 0.8 });
  }
}

export function abilityReady(s: Synth): void {
  tone(s, { t: s.t, f0: 1319, peak: 0.15, decay: 0.2, type: 'triangle' });
  tone(s, { t: s.t + 0.09, f0: 1760, peak: 0.15, decay: 0.35, type: 'triangle' });
}

function crash(s: Synth, t: number, v: number): void {
  INSTRUMENTS.cymbal(s.c, s.out, t, 1, 0, v);
}

/** Level-up fanfare: G–C–E–G brass arpeggio over a snare roll, crash + C-major chord. */
export function levelUp(s: Synth): void {
  const t = s.t;
  const c = s.c;
  const o = s.out;
  for (let i = 0; i < 12; i++) INSTRUMENTS.snare(c, o, t + i * 0.03, 0.03, 0, 0.2 + i * 0.04);
  const arp: [number, number][] = [
    [67, 0],
    [72, 0.12],
    [76, 0.24],
  ];
  for (const [m, dt] of arp) INSTRUMENTS.trumpet(c, o, t + dt, 0.1, m, 0.85);
  const tc = t + 0.36;
  INSTRUMENTS.trumpet(c, o, tc, 0.85, 79, 1, { vib: 0.15 });
  INSTRUMENTS.brass(c, o, tc, 0.85, 76, 0.75);
  INSTRUMENTS.brass(c, o, tc, 0.85, 72, 0.75);
  INSTRUMENTS.tuba(c, o, tc, 0.85, 48, 0.9);
  INSTRUMENTS.timpani(c, o, tc, 0.8, 43, 0.9);
  crash(s, tc, 0.9);
}

/** Wave incoming: two distorted "AWOO-GA" klaxon blasts through a megaphone band. */
export function waveAlarm(s: Synth): void {
  for (let k = 0; k < 2; k++) {
    const tk = s.t + k * 0.55;
    const a = s.osc('sawtooth', 200, tk, 0.5);
    const b = s.osc('square', 202, tk, 0.5);
    for (const o of [a, b]) {
      o.frequency.setValueAtTime(s.hz(200), tk);
      o.frequency.exponentialRampToValueAtTime(s.hz(430), tk + 0.28);
    }
    const bp = s.filter('bandpass', 1000, 1.8);
    const sat = s.shaper(3);
    const lp = s.filter('lowpass', 3000, 0.7);
    const g = s.gain();
    ahr(g.gain, tk, 0.3, 0.02, 0.38, 0.06);
    const bg = s.gain(0.6);
    a.connect(bp);
    b.connect(bg).connect(bp);
    bp.connect(sat).connect(lp).connect(g).connect(s.out);
  }
}

/** Victory: two brass stabs and a big, bright C-major chord with a crash. */
export function victoryStinger(s: Synth): void {
  const t = s.t;
  const c = s.c;
  const o = s.out;
  const stab = [60, 64, 67, 72];
  for (const dt of [0, 0.22]) for (const m of stab) INSTRUMENTS.brass(c, o, t + dt, 0.14, m, 0.8);
  const tc = t + 0.44;
  for (const m of [60, 64, 67, 72]) INSTRUMENTS.brass(c, o, tc, 1.6, m, 0.85, { vib: 0.08 });
  INSTRUMENTS.trumpet(c, o, tc, 1.6, 76, 0.9, { vib: 0.12 });
  INSTRUMENTS.tuba(c, o, tc, 1.6, 36, 1);
  INSTRUMENTS.timpani(c, o, t, 0.4, 43, 0.8);
  INSTRUMENTS.timpani(c, o, tc, 1.2, 36, 1);
  INSTRUMENTS.glock(c, o, tc, 1, 84, 0.8);
  crash(s, tc, 1);
}

/** Defeat: "dun-dun-DUNNN" — low brass in octaves, timpani roll, crash; the last note sags. */
export function defeatStinger(s: Synth): void {
  const t = s.t;
  const c = s.c;
  const o = s.out;
  for (const dt of [0, 0.3]) {
    for (const m of [50, 62]) INSTRUMENTS.brass(c, o, t + dt, 0.2, m, 0.85);
    INSTRUMENTS.tuba(c, o, t + dt, 0.2, 38, 0.9);
  }
  const tl = t + 0.62;
  for (const m of [46, 58, 61]) INSTRUMENTS.brass(c, o, tl, 1.8, m, 0.9, { bend: -0.6, vib: 0.1 });
  INSTRUMENTS.tuba(c, o, tl, 1.8, 34, 1, { bend: -0.6 });
  for (let i = 0; i < 10; i++) INSTRUMENTS.timpani(c, o, t + 0.62 - 0.3 + i * 0.03, 0.2, 38, 0.3 + i * 0.05);
  INSTRUMENTS.timpani(c, o, tl, 1.5, 34, 1);
  crash(s, tl, 0.9);
}
