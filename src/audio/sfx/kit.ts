/**
 * Tiny synthesis kit shared by the SFX recipes, loops, crowd and music instruments.
 *
 * Everything works on any `BaseAudioContext`, so the same recipe renders live (AudioContext)
 * or offline (OfflineAudioContext, used to bake frequently-played sounds into buffers).
 * Every source created here is given an explicit stop time, so voices clean themselves up.
 */

export type NoiseKind = 'white' | 'pink' | 'brown';

const NOISE_SECONDS = 2;
const noiseData = new Map<string, Float32Array<ArrayBuffer>>();
const noiseCache = new WeakMap<BaseAudioContext, Partial<Record<NoiseKind, AudioBuffer>>>();

/** Deterministic noise samples (seeded LCG), normalised to ±0.9, cached per sample rate. */
export function noiseSamples(kind: NoiseKind, sampleRate: number): Float32Array<ArrayBuffer> {
  const key = `${kind}@${sampleRate}`;
  const hit = noiseData.get(key);
  if (hit) return hit;
  const len = Math.floor(sampleRate * NOISE_SECONDS);
  const d = new Float32Array(len);
  let s = kind === 'white' ? 0x1234567 : kind === 'pink' ? 0x2345678 : 0x3456789;
  const rnd = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2147483648 - 1;
  };
  if (kind === 'white') {
    for (let i = 0; i < len; i++) d[i] = rnd();
  } else if (kind === 'pink') {
    // Paul Kellet's economy pink filter.
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = rnd();
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = b0 + b1 + b2 + w * 0.1848;
    }
  } else {
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * rnd()) / 1.02;
      d[i] = last;
    }
  }
  // Remove DC, normalise to ±0.9 so every kind has a comparable peak level.
  let mean = 0;
  for (let i = 0; i < len; i++) mean += d[i]!;
  mean /= len;
  let peak = 1e-9;
  for (let i = 0; i < len; i++) {
    d[i]! -= mean;
    peak = Math.max(peak, Math.abs(d[i]!));
  }
  const k = 0.9 / peak;
  for (let i = 0; i < len; i++) d[i]! *= k;
  noiseData.set(key, d);
  return d;
}

/** Noise buffer for a context (2 s, mono, loopable). */
export function noiseBuffer(c: BaseAudioContext, kind: NoiseKind): AudioBuffer {
  let set = noiseCache.get(c);
  if (!set) {
    set = {};
    noiseCache.set(c, set);
  }
  const hit = set[kind];
  if (hit) return hit;
  const data = noiseSamples(kind, c.sampleRate);
  const buf = c.createBuffer(1, data.length, c.sampleRate);
  buf.copyToChannel(data, 0);
  set[kind] = buf;
  return buf;
}

const curveCache = new Map<number, Float32Array<ArrayBuffer>>();
/** Normalised tanh soft-clip curve (drive ≥ 1). Shared across contexts. */
export function driveCurve(drive: number): Float32Array<ArrayBuffer> {
  const k = Math.round(drive * 10) / 10;
  const hit = curveCache.get(k);
  if (hit) return hit;
  const n = 1024;
  const curve = new Float32Array(n);
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / norm;
  }
  curveCache.set(k, curve);
  return curve;
}

const waveCache = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();
/** Pulse wave with the given duty cycle (chiptune leads). */
export function pulseWave(c: BaseAudioContext, duty: number): PeriodicWave {
  let m = waveCache.get(c);
  if (!m) {
    m = new Map();
    waveCache.set(c, m);
  }
  const key = `p${duty}`;
  const hit = m.get(key);
  if (hit) return hit;
  const n = 32;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) {
    real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty) * Math.cos(k * Math.PI * duty);
    imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty) * Math.sin(k * Math.PI * duty);
  }
  const w = c.createPeriodicWave(real, imag);
  m.set(key, w);
  return w;
}

export type OscType = OscillatorType | PeriodicWave;
type FilterType = BiquadFilterType;

/**
 * A synthesis voice context: `t` = start time, `out` = where the recipe writes,
 * `p` = pitch multiplier applied by the helpers, `rnd` = 0…1 random source.
 */
export class Synth {
  constructor(
    readonly c: BaseAudioContext,
    readonly out: AudioNode,
    readonly t: number,
    readonly rnd: () => number,
    readonly p = 1,
  ) {}

  /** Random in [a, b). */
  r(a: number, b: number): number {
    return a + (b - a) * this.rnd();
  }

  /** Random variation factor 1 ± amount. */
  v(amount: number): number {
    return 1 + (this.rnd() * 2 - 1) * amount;
  }

  hz(f: number): number {
    return f * this.p;
  }

  gain(value = 0): GainNode {
    const g = this.c.createGain();
    g.gain.value = value;
    return g;
  }

  filter(type: FilterType, f: number, q = 0.707): BiquadFilterNode {
    const b = this.c.createBiquadFilter();
    b.type = type;
    b.frequency.value = Math.min(this.c.sampleRate * 0.45, f * this.p);
    b.Q.value = q;
    return b;
  }

  shaper(drive: number): WaveShaperNode {
    const w = this.c.createWaveShaper();
    w.curve = driveCurve(drive);
    w.oversample = 'none';
    return w;
  }

  osc(type: OscType, f: number, start: number, dur: number): OscillatorNode {
    const o = this.c.createOscillator();
    if (typeof type === 'string') o.type = type as OscillatorType;
    else o.setPeriodicWave(type);
    o.frequency.setValueAtTime(f * this.p, start);
    o.start(start);
    o.stop(start + dur + 0.02);
    return o;
  }

  noise(kind: NoiseKind, start: number, dur: number, rate = 1): AudioBufferSourceNode {
    const s = this.c.createBufferSource();
    s.buffer = noiseBuffer(this.c, kind);
    s.loop = true;
    s.playbackRate.value = rate;
    s.start(start, this.rnd() * (NOISE_SECONDS - 0.1));
    s.stop(start + dur + 0.02);
    return s;
  }

  /** Connect nodes in series; returns the last. */
  chain(...nodes: AudioNode[]): AudioNode {
    for (let i = 0; i < nodes.length - 1; i++) nodes[i]!.connect(nodes[i + 1]!);
    return nodes[nodes.length - 1]!;
  }
}

/** Linear attack to `peak`, exponential decay to silence (≈ −80 dB at `start+attack+decay`). */
export function perc(
  param: AudioParam,
  start: number,
  peak: number,
  attack: number,
  decay: number,
): void {
  param.setValueAtTime(0, start);
  param.linearRampToValueAtTime(peak, start + Math.max(0.0005, attack));
  param.exponentialRampToValueAtTime(peak * 1e-4 + 1e-6, start + attack + decay);
}

/** Attack / hold / exponential release envelope. */
export function ahr(
  param: AudioParam,
  start: number,
  peak: number,
  attack: number,
  hold: number,
  release: number,
): void {
  param.setValueAtTime(0, start);
  param.linearRampToValueAtTime(peak, start + Math.max(0.0005, attack));
  param.setValueAtTime(peak, start + attack + hold);
  param.exponentialRampToValueAtTime(peak * 1e-4 + 1e-6, start + attack + hold + release);
}

/** Exponential glide of a frequency param. */
export function glide(param: AudioParam, start: number, from: number, to: number, time: number): void {
  param.setValueAtTime(from, start);
  param.exponentialRampToValueAtTime(Math.max(1, to), start + Math.max(0.001, time));
}

// ── Building blocks ────────────────────────────────────────────────────────────────────

export interface ToneOpts {
  t: number;
  f0: number;
  f1?: number;
  drop?: number;
  peak: number;
  attack?: number;
  decay: number;
  type?: OscType;
  dest?: AudioNode;
}

/** Pitched percussive tone with an optional exponential pitch drop (thumps, booms, pings). */
export function tone(s: Synth, o: ToneOpts): OscillatorNode {
  const a = o.attack ?? 0.002;
  const dur = a + o.decay;
  const osc = s.osc(o.type ?? 'sine', o.f0, o.t, dur);
  if (o.f1 !== undefined) glide(osc.frequency, o.t, s.hz(o.f0), s.hz(o.f1), o.drop ?? dur * 0.5);
  const g = s.gain();
  perc(g.gain, o.t, o.peak, a, o.decay);
  osc.connect(g).connect(o.dest ?? s.out);
  return osc;
}

export interface BurstOpts {
  t: number;
  kind?: NoiseKind;
  type?: FilterType;
  f: number;
  q?: number;
  /** Optional filter sweep target (Hz) over `sweep` seconds. */
  f1?: number;
  sweep?: number;
  peak: number;
  attack?: number;
  decay: number;
  rate?: number;
  dest?: AudioNode;
}

/** Filtered noise burst (cracks, thuds, hisses, whooshes). */
export function burst(s: Synth, o: BurstOpts): BiquadFilterNode {
  const a = o.attack ?? 0.001;
  const n = s.noise(o.kind ?? 'white', o.t, a + o.decay, o.rate ?? 1);
  const f = s.filter(o.type ?? 'bandpass', o.f, o.q ?? 1);
  if (o.f1 !== undefined) glide(f.frequency, o.t, s.hz(o.f), s.hz(o.f1), o.sweep ?? o.decay);
  const g = s.gain();
  perc(g.gain, o.t, o.peak, a, o.decay);
  n.connect(f).connect(g).connect(o.dest ?? s.out);
  return f;
}

/** Inharmonic struck-metal partials (clangs, bells). */
export function partials(
  s: Synth,
  t: number,
  f: number,
  ratios: readonly number[],
  gains: readonly number[],
  decays: readonly number[],
  dest: AudioNode = s.out,
  type: OscType = 'sine',
): void {
  for (let i = 0; i < ratios.length; i++) {
    tone(s, {
      t,
      f0: f * ratios[i]!,
      peak: gains[i] ?? 0.1,
      decay: decays[i] ?? 0.3,
      attack: 0.001,
      type,
      dest,
    });
  }
}

/** A gain node pre-connected to `dest` through an optional soft-clipper. */
export function bus(s: Synth, level: number, drive = 0, dest: AudioNode = s.out): GainNode {
  const g = s.gain(level);
  if (drive > 0) g.connect(s.shaper(drive)).connect(dest);
  else g.connect(dest);
  return g;
}

/** Many tiny clicks scattered over a window (debris, crackle, glass shards). */
export function scatter(
  s: Synth,
  t: number,
  window: number,
  n: number,
  each: (t: number, i: number) => void,
): void {
  for (let i = 0; i < n; i++) {
    // Front-loaded distribution (more events early, thinning out).
    const u = s.rnd();
    each(t + window * u * u, i);
  }
}
