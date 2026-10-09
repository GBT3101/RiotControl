/**
 * Music instruments: cheap subtractive/FM voices created per note (2–6 nodes each).
 *
 * Brass = two detuned saws through a low-pass whose cutoff "blooms" on the attack (the
 * classic synth-brass "bwah"), with a pitch scoop and delayed vibrato. Tuba = saw + sine
 * body under a darker filter. Glockenspiel = sine partials at 1 : 2.76 : 5.4. E-piano = 1:1 FM
 * with a decaying index (the elevator Rhodes). Accordion = three saws detuned ±14 cents
 * (musette beating) through a nasal band-pass. Drums are filtered noise + pitched thumps.
 */
import { burst, perc, pulseWave, Synth, tone } from '../sfx/kit';

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
] as const;
export type InstId = (typeof INST_IDS)[number];

export const PERCUSSION: ReadonlySet<InstId> = new Set<InstId>([
  'snare',
  'kick',
  'cymbal',
  'castanet',
  'hat',
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
};
