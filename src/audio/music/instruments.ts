/**
 * Music instruments: cheap subtractive/FM voices created per note (2–6 nodes each).
 *
 * Brass = two detuned saws through a low-pass whose cutoff "blooms" on the attack (the
 * classic synth-brass "bwah"), with a pitch scoop and delayed vibrato. Tuba = saw + sine
 * body under a darker filter. Glockenspiel = sine partials at 1 : 2.76 : 5.4. E-piano = 1:1 FM
 * with a decaying index (the elevator Rhodes). Accordion = three saws detuned ±14 cents
 * (musette beating) through a nasal band-pass. Drums are filtered noise + pitched thumps.
 * E5 added the folk/street patches of the Europe city themes: fiddle, nyckelharpa (sympathetic
 * ring + cold echo), cimbalom and mandolin (tremolo on held notes), clarinet, street organ
 * (celeste + tremulant) and hand claps.
 */
import { ahr, burst, perc, pulseWave, Synth, tone } from '../sfx/kit';

export const INST_IDS = [
  'tuba',
  'brass',
  'trumpet',
  'horn',
  'chip',
  'glock',
  'vibes',
  'epiano',
  'accordion',
  'pluck',
  'snare',
  'kick',
  'cymbal',
  'castanet',
  'hat',
  'timpani',
  // E5 (Europe city themes): folk / street patches.
  'fiddle',
  'nyckel',
  'cimbalom',
  'clarinet',
  'organ',
  'mandolin',
  'clap',
] as const;
export type InstId = (typeof INST_IDS)[number];

export const PERCUSSION: ReadonlySet<InstId> = new Set<InstId>([
  'snare',
  'kick',
  'cymbal',
  'castanet',
  'hat',
  'clap',
]);

export interface NoteOpts {
  /** Pitch bend in semitones reached at the end of the note. */
  bend?: number;
  /** Vibrato depth in semitones (default: a little on long brass notes). */
  vib?: number;
}

export type InstFn = (
  c: BaseAudioContext,
  out: AudioNode,
  t: number,
  dur: number,
  midi: number,
  vel: number,
  o?: NoteOpts,
) => void;

export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

const rnd = Math.random;

function vibrato(s: Synth, targets: AudioParam[], f: number, t: number, dur: number, semis: number): void {
  if (semis <= 0 || dur < 0.25) return;
  const lfo = s.osc('sine', 5.5, t, dur + 0.1);
  const depth = s.gain();
  const dHz = f * (Math.pow(2, semis / 12) - 1);
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(0, t + Math.min(0.18, dur * 0.4));
  depth.gain.linearRampToValueAtTime(dHz, t + Math.min(0.45, dur * 0.8));
  lfo.connect(depth);
  for (const p of targets) depth.connect(p);
}

function pitchShape(p: AudioParam, f: number, t: number, dur: number, scoop: number, bend?: number): void {
  p.setValueAtTime(f * scoop, t);
  p.exponentialRampToValueAtTime(f, t + 0.045);
  if (bend) {
    p.setValueAtTime(f, t + dur * 0.35);
    p.exponentialRampToValueAtTime(f * Math.pow(2, bend / 12), t + dur);
  }
}

function brassLike(
  c: BaseAudioContext,
  out: AudioNode,
  t: number,
  dur: number,
  midi: number,
  vel: number,
  o: NoteOpts | undefined,
  level: number,
  bright: number,
  types: [OscillatorType, OscillatorType],
): void {
  const s = new Synth(c, out, t, rnd);
  const f = mtof(midi);
  const rel = 0.09;
  const o1 = s.osc(types[0], f, t, dur + rel);
  const o2 = s.osc(types[1], f, t, dur + rel);
  o1.detune.value = -7;
  o2.detune.value = 7;
  pitchShape(o1.frequency, f, t, dur, 0.97, o?.bend);
  pitchShape(o2.frequency, f, t, dur, 0.97, o?.bend);
  vibrato(s, [o1.frequency, o2.frequency], f, t, dur, o?.vib ?? 0.12);
  const nyq = c.sampleRate * 0.45;
  const lp = s.filter('lowpass', Math.min(nyq, f * 1.5), 1.8);
  const open = Math.min(nyq, f * (4 + 4 * bright) * (0.6 + 0.4 * vel));
  lp.frequency.setValueAtTime(Math.min(nyq, f * 1.5), t);
  lp.frequency.linearRampToValueAtTime(open, t + 0.04);
  lp.frequency.setTargetAtTime(Math.min(nyq, f * (2.5 + 1.5 * bright)), t + 0.06, 0.15);
  if (o?.bend) lp.frequency.setTargetAtTime(f * 1.6, t + dur * 0.5, dur * 0.3);
  const g = s.gain();
  const peak = level * vel;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.025);
  g.gain.setTargetAtTime(peak * 0.75, t + 0.03, 0.08);
  g.gain.setValueAtTime(peak * 0.75, t + dur);
  g.gain.exponentialRampToValueAtTime(1e-4, t + dur + rel);
  o1.connect(lp);
  o2.connect(lp);
  lp.connect(g).connect(out);
}

const brass: InstFn = (c, out, t, dur, m, vel, o) =>
  brassLike(c, out, t, dur, m, vel, o, 0.15, 0.5, ['sawtooth', 'sawtooth']);
const trumpet: InstFn = (c, out, t, dur, m, vel, o) =>
  brassLike(c, out, t, dur, m, vel, o, 0.14, 1, ['sawtooth', 'square']);
const horn: InstFn = (c, out, t, dur, m, vel, o) =>
  brassLike(c, out, t, dur, m, vel, { vib: 0.06, ...o }, 0.11, 0, ['sawtooth', 'triangle']);

const tuba: InstFn = (c, out, t, dur, m, vel, o) => {
  const s = new Synth(c, out, t, rnd);
  const f = mtof(m);
  const rel = 0.07;
  const saw = s.osc('sawtooth', f, t, dur + rel);
  const body = s.osc('sine', f, t, dur + rel);
  pitchShape(saw.frequency, f, t, dur, 0.96, o?.bend);
  pitchShape(body.frequency, f, t, dur, 0.96, o?.bend);
  const lp = s.filter('lowpass', f * 2, 1.4);
  lp.frequency.setValueAtTime(f * 2, t);
  lp.frequency.linearRampToValueAtTime(f * 5.5, t + 0.035);
  lp.frequency.setTargetAtTime(f * 3, t + 0.05, 0.1);
  const g = s.gain();
  const peak = 0.26 * vel;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.02);
  g.gain.setTargetAtTime(peak * 0.7, t + 0.03, 0.1);
  g.gain.setValueAtTime(peak * 0.7, t + dur);
  g.gain.exponentialRampToValueAtTime(1e-4, t + dur + rel);
  const bg = s.gain(0.6);
  saw.connect(lp).connect(g);
  body.connect(bg).connect(g);
  g.connect(out);
};

const chip: InstFn = (c, out, t, dur, m, vel, o) => {
  const s = new Synth(c, out, t, rnd);
  const f = mtof(m);
  const osc = s.osc(pulseWave(c, 0.25), f, t, dur + 0.04);
  pitchShape(osc.frequency, f, t, dur, 1, o?.bend);
  vibrato(s, [osc.frequency], f, t, dur, o?.vib ?? 0.1);
  const lp = s.filter('lowpass', Math.min(c.sampleRate * 0.45, 7000), 0.7);
  const g = s.gain();
  const peak = 0.05 * vel;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.004);
  g.gain.linearRampToValueAtTime(peak * 0.7, t + Math.max(0.01, dur));
  g.gain.exponentialRampToValueAtTime(1e-4, t + dur + 0.035);
  osc.connect(lp).connect(g).connect(out);
};

const glock: InstFn = (c, out, t, dur, m, vel) => {
  const s = new Synth(c, out, t, rnd);
  const f = mtof(m);
  const d = Math.max(0.6, dur);
  tone(s, { t, f0: f, peak: 0.09 * vel, attack: 0.001, decay: d });
  tone(s, { t, f0: f * 2.76, peak: 0.025 * vel, attack: 0.001, decay: d * 0.4 });
  tone(s, { t, f0: f * 5.4, peak: 0.01 * vel, attack: 0.001, decay: d * 0.15 });
};

const vibes: InstFn = (c, out, t, dur, m, vel) => {
  const s = new Synth(c, out, t, rnd);
  const f = mtof(m);
  const d = Math.max(0.9, dur + 0.5);
  const o1 = s.osc('sine', f, t, d);
  const o2 = s.osc('sine', f * 4, t, d * 0.3);
  const g2 = s.gain(0.06);
  const trem = s.gain();
  trem.gain.value = 1;
  const lfo = s.osc('sine', 5.2, t, d);
  const ld = s.gain(0.3);
  lfo.connect(ld).connect(trem.gain);
  const g = s.gain();
  perc(g.gain, t, 0.12 * vel, 0.004, d);
  o1.connect(g);
  o2.connect(g2).connect(g);
  g.connect(trem).connect(out);
};

const epiano: InstFn = (c, out, t, dur, m, vel) => {
  const s = new Synth(c, out, t, rnd);
  const f = mtof(m);
  const d = Math.max(0.7, dur + 0.35);
  const car = s.osc('sine', f, t, d);
  const mod = s.osc('sine', f, t, d);
  const idx = s.gain();
  idx.gain.setValueAtTime(f * 2.2 * (0.5 + 0.5 * vel), t);
  idx.gain.exponentialRampToValueAtTime(f * 0.25, t + 0.45);
  mod.connect(idx).connect(car.frequency);
  const tine = s.osc('sine', f * 14, t, 0.08);
  const tIdx = s.gain();
  tIdx.gain.setValueAtTime(f * 0.5, t);
  tIdx.gain.exponentialRampToValueAtTime(1, t + 0.06);
  tine.connect(tIdx).connect(car.frequency);
  const g = s.gain();
  perc(g.gain, t, 0.11 * vel, 0.003, d);
  car.connect(g).connect(out);
};

const accordion: InstFn = (c, out, t, dur, m, vel, o) => {
  const s = new Synth(c, out, t, rnd);
  const f = mtof(m);
  const rel = 0.06;
  const bp = s.filter('bandpass', 1400, 0.55);
  const lp = s.filter('lowpass', 3800, 0.7);
  for (const cents of [-14, 0, 14]) {
    const osc = s.osc('sawtooth', f, t, dur + rel);
    osc.detune.value = cents;
    if (o?.bend) pitchShape(osc.frequency, f, t, dur, 1, o.bend);
    osc.connect(bp);
  }
  const g = s.gain();
  const peak = 0.11 * vel;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.03);
  g.gain.setValueAtTime(peak * 0.9, t + dur);
  g.gain.exponentialRampToValueAtTime(1e-4, t + dur + rel);
  bp.connect(lp).connect(g).connect(out);
};

const pluck: InstFn = (c, out, t, dur, m, vel) => {
  const s = new Synth(c, out, t, rnd);
  const f = mtof(m);
  const d = Math.max(0.5, dur + 0.2);
  const o1 = s.osc('sawtooth', f, t, d);
  const o2 = s.osc('triangle', f * 1.003, t, d);
  const nyq = c.sampleRate * 0.45;
  const lp = s.filter('lowpass', Math.min(nyq, f * 10), 1.2);
  lp.frequency.setValueAtTime(Math.min(nyq, f * 10), t);
  lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.25);
  const g = s.gain();
  perc(g.gain, t, 0.14 * vel, 0.002, d);
  o1.connect(lp);
  o2.connect(lp);
  lp.connect(g).connect(out);
};

// ── E5: folk and street patches for the Europe city themes ──────────────────────────────

/** Bowed string: saw through a wooden body (low cut, 2.8 kHz bite), bow attack, late vibrato. */
function bowed(
  c: BaseAudioContext,
  out: AudioNode,
  t: number,
  dur: number,
  m: number,
  vel: number,
  o: NoteOpts | undefined,
  level: number,
  buzz: number,
): Synth {
  const s = new Synth(c, out, t, rnd);
  const f = mtof(m);
  const rel = 0.1;
  const nyq = c.sampleRate * 0.45;
  const hp = s.filter('highpass', 190, 0.7);
  const body = s.filter('peaking', 2800, 1.1);
  body.gain.value = 7;
  const lp = s.filter('lowpass', Math.min(nyq, Math.max(2200, f * 7)), 0.8);
  const oscs = [s.osc('sawtooth', f, t, dur + rel)];
  if (buzz > 0) {
    const sq = s.osc('square', f * 1.004, t, dur + rel);
    const sg = s.gain(buzz);
    sq.connect(sg).connect(hp);
    oscs.push(sq);
  }
  oscs[0]!.connect(hp);
  for (const osc of oscs) pitchShape(osc.frequency, f, t, dur, 0.985, o?.bend);
  vibrato(s, oscs.map((x) => x.frequency), f, t, dur, o?.vib ?? 0.16);
  const g = s.gain();
  const peak = level * vel;
  const a = Math.min(0.06, dur * 0.3);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setTargetAtTime(peak * 0.8, t + a, 0.12);
  g.gain.setValueAtTime(peak * 0.8, t + dur);
  g.gain.exponentialRampToValueAtTime(1e-4, t + dur + rel);
  hp.connect(body).connect(lp).connect(g).connect(out);
  // Rosin: a short scratch of noise at the bow change.
  burst(s, { t, type: 'bandpass', f: Math.min(nyq, f * 4), q: 1.5, peak: 0.02 * vel, decay: 0.05 });
  return s;
}

/** Violin (csárdás lead). */
const fiddle: InstFn = (c, out, t, dur, m, vel, o) => {
  bowed(c, out, t, dur, m, vel, o, 0.12, 0);
};

/**
 * Nyckelharpa: a buzzier bowed tone, sympathetic strings ringing an octave and a twelfth up
 * after the bow stops, and a cold slap-back echo (the hall's stone).
 */
const nyckel: InstFn = (c, out, t, dur, m, vel, o) => {
  const s = bowed(c, out, t, dur, m, vel, { vib: 0.07, ...o }, 0.085, 0.35);
  const f = mtof(m);
  const ring = Math.max(1.2, dur + 0.9);
  tone(s, { t: t + 0.02, f0: f * 2, peak: 0.016 * vel, attack: 0.08, decay: ring });
  tone(s, { t: t + 0.02, f0: f * 3, peak: 0.008 * vel, attack: 0.1, decay: ring * 0.7 });
  // Echo: a darker, quieter repeat of the note 230 ms later.
  const e = s.osc('sawtooth', f, t + 0.23, dur);
  const elp = s.filter('lowpass', Math.min(c.sampleRate * 0.45, f * 2.5), 0.7);
  const eg = s.gain();
  ahr(eg.gain, t + 0.23, 0.022 * vel, 0.06, Math.max(0, dur - 0.1), 0.5);
  e.connect(elp).connect(eg).connect(out);
};

/**
 * Cimbalom (hammered dulcimer): a course of detuned strings struck by felt hammers, bright
 * then mellowing; held notes become the player's tremolo (alternating hammers, ~13 Hz).
 */
const cimbalom: InstFn = (c, out, t, dur, m, vel) => {
  const s = new Synth(c, out, t, rnd);
  const f = mtof(m);
  const nyq = c.sampleRate * 0.45;
  const strike = (ts: number, v: number, d: number): void => {
    const lp = s.filter('lowpass', Math.min(nyq, f * 12), 0.9);
    lp.frequency.setValueAtTime(Math.min(nyq, f * 12), ts);
    lp.frequency.exponentialRampToValueAtTime(Math.min(nyq, f * 2.5), ts + 0.3);
    const g = s.gain();
    perc(g.gain, ts, 0.12 * v, 0.002, d);
    for (const cents of [-6, 5]) {
      const osc = s.osc('sawtooth', f, ts, d);
      osc.detune.value = cents;
      osc.connect(lp);
    }
    lp.connect(g).connect(out);
  };
  const trem = dur >= 0.6;
  const n = trem ? Math.min(12, Math.floor(dur * 13)) : 1;
  for (let k = 0; k < n; k++) {
    const last = k === n - 1;
    strike(t + k / 13, vel * (k === 0 ? 1 : 0.55 + 0.15 * ((k * 7) % 3) / 2), last ? Math.max(0.9, dur * 0.8) : 0.25);
  }
  // Metallic hammer tick and the ringing octave partial.
  burst(s, { t, type: 'bandpass', f: Math.min(nyq, 4200), q: 2, peak: 0.05 * vel, decay: 0.012 });
  tone(s, { t, f0: f * 2.005, peak: 0.02 * vel, attack: 0.002, decay: Math.max(0.8, dur) });
};

/** Clarinet: odd harmonics (square) through a woody low-pass, breath on the attack. */
const clarinet: InstFn = (c, out, t, dur, m, vel, o) => {
  const s = new Synth(c, out, t, rnd);
  const f = mtof(m);
  const rel = 0.06;
  const nyq = c.sampleRate * 0.45;
  const osc = s.osc('square', f, t, dur + rel);
  pitchShape(osc.frequency, f, t, dur, 0.99, o?.bend);
  vibrato(s, [osc.frequency], f, t, dur, o?.vib ?? 0.05);
  const lp = s.filter('lowpass', Math.min(nyq, f * 3.2), 1.1);
  lp.frequency.setValueAtTime(Math.min(nyq, f * 2), t);
  lp.frequency.linearRampToValueAtTime(Math.min(nyq, f * 4.5 * (0.7 + 0.3 * vel)), t + 0.05);
  lp.frequency.setTargetAtTime(Math.min(nyq, f * 3.2), t + 0.06, 0.12);
  const g = s.gain();
  const peak = 0.075 * vel;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.025);
  g.gain.setValueAtTime(peak * 0.9, t + dur);
  g.gain.exponentialRampToValueAtTime(1e-4, t + dur + rel);
  osc.connect(lp).connect(g).connect(out);
  burst(s, { t, type: 'bandpass', f: Math.min(nyq, f * 3), q: 1, peak: 0.012 * vel, decay: 0.06 });
};

/**
 * Street organ (draaiorgel) pipe: a flue + reed pair detuned as a celeste, a wheezy tremulant
 * on the bellows and a little wind noise.
 */
const organ: InstFn = (c, out, t, dur, m, vel) => {
  const s = new Synth(c, out, t, rnd);
  const f = mtof(m);
  const rel = 0.05;
  const nyq = c.sampleRate * 0.45;
  const mix = s.filter('lowpass', Math.min(nyq, Math.max(1800, f * 6)), 0.9);
  const flue = s.osc('triangle', f, t, dur + rel);
  const reed = s.osc('sawtooth', f, t, dur + rel);
  reed.detune.value = 11;
  const rg = s.gain(0.45);
  flue.connect(mix);
  reed.connect(rg).connect(mix);
  const oct = s.osc('square', f * 2, t, dur + rel);
  oct.detune.value = -6;
  const og = s.gain(0.12);
  oct.connect(og).connect(mix);
  const trem = s.gain();
  trem.gain.value = 1;
  const lfo = s.osc('sine', 6.3, t, dur + rel);
  const ld = s.gain(0.22);
  lfo.connect(ld).connect(trem.gain);
  const g = s.gain();
  const peak = 0.095 * vel;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.012);
  g.gain.setValueAtTime(peak, t + dur);
  g.gain.exponentialRampToValueAtTime(1e-4, t + dur + rel);
  mix.connect(trem).connect(g).connect(out);
  burst(s, { t, kind: 'pink', type: 'bandpass', f: Math.min(nyq, f * 2), q: 3, peak: 0.01 * vel, attack: 0.02, decay: dur + rel });
};

/** Mandolin: a doubled steel course; notes longer than a beat-fraction are tremolo-picked. */
const mandolin: InstFn = (c, out, t, dur, m, vel) => {
  const s = new Synth(c, out, t, rnd);
  const f = mtof(m);
  const nyq = c.sampleRate * 0.45;
  const pick = (ts: number, v: number, d: number): void => {
    const lp = s.filter('lowpass', Math.min(nyq, f * 9), 1.4);
    lp.frequency.setValueAtTime(Math.min(nyq, f * 9), ts);
    lp.frequency.exponentialRampToValueAtTime(Math.min(nyq, f * 1.8), ts + 0.15);
    const g = s.gain();
    perc(g.gain, ts, 0.12 * v, 0.002, d);
    for (const cents of [-5, 6]) {
      const osc = s.osc('sawtooth', f, ts, d);
      osc.detune.value = cents;
      osc.connect(lp);
    }
    lp.connect(g).connect(out);
  };
  const trem = dur >= 0.22;
  const n = trem ? Math.min(16, Math.max(2, Math.floor(dur * 14))) : 1;
  for (let k = 0; k < n; k++) pick(t + k / 14, vel * (k % 2 ? 0.7 : k === 0 ? 1 : 0.85), k === n - 1 ? 0.35 : 0.12);
};

/** Hand clap (palmas, the clap-along): three smeared slaps and a short room tail. */
const clap: InstFn = (c, out, t, _dur, _m, vel) => {
  const s = new Synth(c, out, t, rnd);
  for (const [dt, v] of [[0, 0.8], [0.009, 0.6], [0.019, 1]] as const) {
    burst(s, { t: t + dt, type: 'bandpass', f: 1250 * s.v(0.08), q: 1.3, peak: 1.1 * vel * v, decay: 0.014 });
  }
  burst(s, { t: t + 0.022, type: 'bandpass', f: 1500, q: 0.9, peak: 0.45 * vel, decay: 0.09 });
};

const snare: InstFn = (c, out, t, _dur, _m, vel) => {
  const s = new Synth(c, out, t, rnd);
  const d = 0.06 + 0.1 * vel;
  burst(s, { t, type: 'bandpass', f: 2000, q: 0.6, peak: 0.5 * vel, decay: d });
  burst(s, { t, type: 'highpass', f: 5000, q: 0.7, peak: 0.18 * vel, decay: d * 0.6 });
  tone(s, { t, f0: 185, f1: 150, drop: 0.03, peak: 0.3 * vel, decay: 0.07, type: 'triangle' });
};

const kick: InstFn = (c, out, t, _dur, _m, vel) => {
  const s = new Synth(c, out, t, rnd);
  tone(s, { t, f0: 100, f1: 48, drop: 0.1, peak: 0.7 * vel, decay: 0.35 });
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 300, peak: 0.35 * vel, decay: 0.12 });
};

const cymbal: InstFn = (c, out, t, _dur, _m, vel) => {
  const s = new Synth(c, out, t, rnd);
  burst(s, { t, type: 'highpass', f: 6500, q: 0.7, peak: 0.2 * vel, decay: 1.3 });
  burst(s, { t, type: 'bandpass', f: 9500, q: 0.8, peak: 0.12 * vel, decay: 0.9 });
  burst(s, { t, type: 'bandpass', f: 3400, q: 1.2, peak: 0.08 * vel, decay: 0.5 });
};

const castanet: InstFn = (c, out, t, _dur, _m, vel) => {
  const s = new Synth(c, out, t, rnd);
  for (const dt of [0, 0.012]) {
    burst(s, { t: t + dt, type: 'bandpass', f: 3200 * s.v(0.05), q: 2.5, peak: 0.6 * vel, decay: 0.012 });
    tone(s, { t: t + dt, f0: 2400 * s.v(0.05), peak: 0.12 * vel, decay: 0.012 });
  }
};

const hat: InstFn = (c, out, t, _dur, _m, vel) => {
  const s = new Synth(c, out, t, rnd);
  burst(s, { t, type: 'highpass', f: 7500, q: 0.7, peak: 0.2 * vel, decay: 0.035 });
};

const timpani: InstFn = (c, out, t, dur, m, vel) => {
  const s = new Synth(c, out, t, rnd);
  const f = mtof(m);
  const d = Math.max(0.8, dur);
  tone(s, { t, f0: f, f1: f * 0.98, drop: 0.3, peak: 0.35 * vel, decay: d });
  tone(s, { t, f0: f * 1.5, peak: 0.1 * vel, decay: d * 0.5 });
  burst(s, { t, kind: 'brown', type: 'lowpass', f: 400, peak: 0.2 * vel, decay: 0.08 });
};

export const INSTRUMENTS: Readonly<Record<InstId, InstFn>> = {
  tuba,
  brass,
  trumpet,
  horn,
  chip,
  glock,
  vibes,
  epiano,
  accordion,
  pluck,
  snare,
  kick,
  cymbal,
  castanet,
  hat,
  timpani,
  fiddle,
  nyckel,
  cimbalom,
  clarinet,
  organ,
  mandolin,
  clap,
};
