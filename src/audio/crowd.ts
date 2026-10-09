/**
 * Crowd bed: the protest's voice, scaled by crowd size and anger.
 *
 * - **Roar**: looping pink noise through a 3-formant vowel filter bank whose vowel drifts
 *   (ah/oh/eh), brighter and louder with anger, plus a brown-noise rumble for big crowds.
 * - **Grains**: baked one-shot voices (glottal saw → formants: "hey!", "ho", "boo", "woo",
 *   "yeah", whistles, murmurs) sprinkled at a rate that grows with size; anger shifts the mix
 *   from murmurs/woos to hey/boo/whistles.
 * - **Chants**: every 10–30 s (crowd ≥ 25) a rhythmic chant — "clap clap clap-clap-clap" or
 *   "HO-HO! HEY-HEY!" — locked to the music's beat when music is playing.
 * All of it is a handful of nodes; grains are single buffer voices.
 */
import { bakeRecipe, variantRng } from './baker';
import { ahr, burst, type Synth } from './sfx/kit';

const VOWELS = {
  a: [800, 1150, 2800],
  e: [500, 1750, 2600],
  i: [330, 2200, 3000],
  o: [480, 850, 2600],
  u: [340, 750, 2400],
} as const;
type Vowel = keyof typeof VOWELS;

export const GRAIN_KINDS = ['hey', 'ho', 'boo', 'woo', 'yeah', 'whistle', 'murmur', 'clap'] as const;
export type GrainKind = (typeof GRAIN_KINDS)[number];

interface GrainSpec {
  dur: number;
  variants: number;
  draw: (s: Synth, v: number) => void;
}

/** A voiced syllable: saw with pitch contour → formant bank with vowel glide. */
function syllable(
  s: Synth,
  t: number,
  d: number,
  f0: readonly [number, number, number],
  v0: Vowel,
  v1: Vowel,
  peak: number,
): void {
  const o = s.osc('sawtooth', f0[0], t, d);
  o.frequency.setValueAtTime(f0[0], t);
  o.frequency.linearRampToValueAtTime(f0[1], t + d * 0.3);
  o.frequency.linearRampToValueAtTime(f0[2], t + d);
  const lfo = s.osc('sine', s.r(4.5, 6.5), t, d);
  const ld = s.gain(f0[1] * 0.02);
  lfo.connect(ld).connect(o.frequency);
  const env = s.gain();
  ahr(env.gain, t, peak, 0.035, Math.max(0.01, d - 0.2), 0.16);
  const qs = [6, 8, 10];
  const gs = [1, 0.6, 0.3];
  const fem = f0[0] > 200 ? 1.15 : 1;
  for (let k = 0; k < 3; k++) {
    const bp = s.filter('bandpass', VOWELS[v0][k]! * fem, qs[k]);
    bp.frequency.setValueAtTime(VOWELS[v0][k]! * fem, t);
    bp.frequency.linearRampToValueAtTime(VOWELS[v1][k]! * fem, t + d * 0.8);
    const g = s.gain(gs[k]! * 3.2);
    o.connect(bp).connect(g).connect(env);
  }
  env.connect(s.out);
  burst(s, { t, type: 'bandpass', f: 1500, q: 0.7, peak: peak * 0.15, attack: 0.03, decay: d });
}

const male = (s: Synth): number => s.r(115, 165);
const female = (s: Synth): number => s.r(210, 290);

export const GRAINS: Readonly<Record<GrainKind, GrainSpec>> = {
  hey: {
    dur: 0.5,
    variants: 4,
    draw: (s, v) => {
      const f = v % 2 ? female(s) : male(s);
      syllable(s, 0, 0.42, [f, f * 1.35, f * 1.1], 'e', 'i', 0.5);
    },
  },
  ho: {
    dur: 0.4,
    variants: 2,
    draw: (s) => {
      const f = male(s);
      syllable(s, 0, 0.32, [f, f * 1.2, f * 1.05], 'o', 'o', 0.5);
    },
  },
  boo: {
    dur: 1,
    variants: 2,
    draw: (s) => {
      const f = male(s) * 0.9;
      syllable(s, 0, 0.9, [f, f * 0.95, f * 0.8], 'u', 'u', 0.5);
    },
  },
  woo: {
    dur: 0.7,
    variants: 2,
    draw: (s) => {
      const f = female(s);
      syllable(s, 0, 0.6, [f, f * 1.5, f * 1.4], 'u', 'o', 0.45);
    },
  },
  yeah: {
    dur: 0.6,
    variants: 2,
    draw: (s, v) => {
      const f = v % 2 ? female(s) : male(s);
      syllable(s, 0, 0.5, [f, f * 1.3, f * 0.95], 'e', 'a', 0.5);
    },
  },
  whistle: {
    dur: 0.6,
    variants: 2,
    draw: (s) => {
      const o = s.osc('sine', 2200, 0, 0.55);
      const f = s.r(2100, 2500);
      o.frequency.setValueAtTime(f, 0);
      o.frequency.exponentialRampToValueAtTime(f * 1.35, 0.12);
      o.frequency.exponentialRampToValueAtTime(f * 1.1, 0.5);
      const g = s.gain();
      ahr(g.gain, 0, 0.18, 0.02, 0.38, 0.1);
      o.connect(g).connect(s.out);
      burst(s, { t: 0, type: 'bandpass', f: f * 1.2, q: 2, peak: 0.04, attack: 0.02, decay: 0.5 });
    },
  },
  murmur: {
    dur: 0.75,
    variants: 4,
    draw: (s, v) => {
      const vs: Vowel[] = ['a', 'e', 'o', 'u', 'i'];
      let t = 0;
      for (let k = 0; k < 3; k++) {
        const f = v % 2 ? female(s) : male(s);
        const d = s.r(0.14, 0.22);
        syllable(s, t, d, [f, f * s.r(0.95, 1.1), f * s.r(0.9, 1)], vs[(v + k * 2) % 5]!, vs[(v + k * 3) % 5]!, 0.3);
        t += d + s.r(0.0, 0.05);
      }
    },
  },
  clap: {
    dur: 0.15,
    variants: 3,
    draw: (s) => {
      for (let i = 0; i < 7; i++) {
        burst(s, { t: s.r(0, 0.03), type: 'bandpass', f: s.r(1100, 1700), q: 1.4, peak: s.r(1, 1.8), decay: s.r(0.04, 0.06) });
      }
    },
  },
};

export async function bakeGrains(sampleRate: number): Promise<Map<GrainKind, AudioBuffer[]>> {
  const out = new Map<GrainKind, AudioBuffer[]>();
  for (const kind of GRAIN_KINDS) {
    const spec = GRAINS[kind];
    const list: AudioBuffer[] = [];
    for (let v = 0; v < spec.variants; v++) {
      list.push(await bakeRecipe(sampleRate, spec.dur, (s) => spec.draw(s, v), variantRng(`grain.${kind}`, v)));
    }
    out.set(kind, list);
  }
  return out;
}

export interface CrowdClock {
  (now: number): { beatDur: number; nextBeat: number } | null;
}

/** Pure: grain rate per second for a crowd. */
export function grainRate(size: number, anger: number): number {
  if (size <= 0) return 0;
  return Math.min(10, 0.6 + size / 60) * (0.5 + Math.min(1, Math.max(0, anger)));
}

/** Pure: crowd loudness 0…1 from the head count (log scale; 3000 → 1). */
export function crowdLevel(size: number): number {
  return Math.min(1, Math.max(0, Math.log10(1 + Math.max(0, size)) / 3.48));
}

type ChantKind = 'clap' | 'hoHey' | 'boo';

export class CrowdBed {
  private size = 0;
  private anger = 0.3;
  private near = 0.5;
  private grains: Map<GrainKind, AudioBuffer[]> | null = null;
  private nodes: {
    src: AudioBufferSourceNode;
    rumble: AudioBufferSourceNode;
    filters: BiquadFilterNode[];
    tone: BiquadFilterNode;
    gain: GainNode;
    rumbleGain: GainNode;
  } | null = null;
  private silentSince = -1;
  private nextVowel = 0;
  private nextChant = 0;
  private grainDebt = 0;
  private lastTick = -1;
  private chantUntil = 0;
  readonly out: GainNode;

  constructor(
    private readonly c: BaseAudioContext,
    dest: AudioNode,
    private readonly noise: (kind: 'pink' | 'brown') => AudioBuffer,
    private readonly clock: CrowdClock,
    private readonly rnd: () => number = Math.random,
  ) {
    this.out = c.createGain();
    this.out.connect(dest);
  }

  setGrains(g: Map<GrainKind, AudioBuffer[]>): void {
    this.grains = g;
  }

  set(size: number, anger: number, near: number): void {
    this.size = Math.max(0, size);
    this.anger = Math.min(1, Math.max(0, anger));
    this.near = Math.min(1, Math.max(0, near));
  }

  private build(now: number): void {
    const c = this.c;
    const src = c.createBufferSource();
    src.buffer = this.noise('pink');
    src.loop = true;
    const rumble = c.createBufferSource();
    rumble.buffer = this.noise('brown');
    rumble.loop = true;
    const gain = c.createGain();
    gain.gain.value = 0;
    const tone = c.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 1500;
    const filters: BiquadFilterNode[] = [];
    const qs = [3, 4, 5];
    const gs = [1, 0.55, 0.25];
    for (let k = 0; k < 3; k++) {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = VOWELS.a[k]!;
      bp.Q.value = qs[k]!;
      const g = c.createGain();
      g.gain.value = gs[k]! * 2.4;
      src.connect(bp).connect(g).connect(tone);
      filters.push(bp);
    }
    tone.connect(gain).connect(this.out);
    const rl = c.createBiquadFilter();
    rl.type = 'lowpass';
    rl.frequency.value = 220;
    const rumbleGain = c.createGain();
    rumbleGain.gain.value = 0;
    rumble.connect(rl).connect(rumbleGain).connect(this.out);
    src.start(now, this.rnd() * 1.5);
    rumble.start(now, this.rnd() * 1.5);
    this.nodes = { src, rumble, filters, tone, gain, rumbleGain };
  }

  private teardown(now: number): void {
    const n = this.nodes;
    if (!n) return;
    n.src.stop(now + 0.05);
    n.rumble.stop(now + 0.05);
    setTimeout(() => {
      n.gain.disconnect();
      n.rumbleGain.disconnect();
    }, 200);
    this.nodes = null;
  }

  tick(now: number): void {
    const dt = this.lastTick < 0 ? 0.05 : Math.min(0.5, Math.max(0, now - this.lastTick));
    this.lastTick = now;
    const L = crowdLevel(this.size);
    if (this.size <= 0) {
      if (this.nodes) {
        this.nodes.gain.gain.setTargetAtTime(0, now, 0.4);
        this.nodes.rumbleGain.gain.setTargetAtTime(0, now, 0.4);
        if (this.silentSince < 0) this.silentSince = now;
        else if (now - this.silentSince > 3) this.teardown(now);
      }
      return;
    }
    this.silentSince = -1;
    if (!this.nodes) this.build(now);
    const n = this.nodes!;
    const a = this.anger;
    const roar = (0.04 + 0.42 * L * (0.6 + 0.4 * this.near)) * (0.75 + 0.5 * a);
    // Surges: a slow random walk around the target level.
    const surge = 0.8 + 0.4 * this.rnd();
    n.gain.gain.setTargetAtTime(roar * surge, now, 0.35);
    n.rumbleGain.gain.setTargetAtTime(0.25 * L * L, now, 0.5);
    n.tone.frequency.setTargetAtTime(700 + 2600 * (0.25 * L + 0.75 * a) * (0.5 + 0.5 * this.near), now, 0.4);
    if (now >= this.nextVowel) {
      const vs: Vowel[] = a > 0.6 ? ['a', 'e', 'a', 'o'] : ['a', 'o', 'u', 'e'];
      const v = VOWELS[vs[Math.floor(this.rnd() * vs.length)]!];
      const bright = 1 + 0.18 * a;
      for (let k = 0; k < 3; k++) n.filters[k]!.frequency.setTargetAtTime(v[k]! * bright, now, 0.35);
      this.nextVowel = now + 0.6 + this.rnd() * 0.9;
    }
    this.sprinkle(now, dt, L);
    this.chants(now, L);
  }

  private playGrain(kind: GrainKind, t: number, gain: number, pan: number, rate: number): void {
    const list = this.grains?.get(kind);
    if (!list || !list.length) return;
    const c = this.c;
    const src = c.createBufferSource();
    src.buffer = list[Math.floor(this.rnd() * list.length)]!;
    src.playbackRate.value = rate;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(g);
    if (typeof c.createStereoPanner === 'function') {
      const p = c.createStereoPanner();
      p.pan.value = pan;
      g.connect(p).connect(this.out);
    } else g.connect(this.out);
    src.start(t);
  }

  private sprinkle(now: number, dt: number, L: number): void {
    if (!this.grains) return;
    if (now < this.chantUntil) return;
    this.grainDebt += grainRate(this.size, this.anger) * dt;
    let guard = 0;
    while (this.grainDebt >= 1 && guard++ < 6) {
      this.grainDebt -= 1;
      const a = this.anger;
      const r = this.rnd();
      const kind: GrainKind =
        a > 0.55
          ? r < 0.35 ? 'hey' : r < 0.55 ? 'boo' : r < 0.7 ? 'whistle' : r < 0.85 ? 'ho' : 'yeah'
          : r < 0.45 ? 'murmur' : r < 0.6 ? 'woo' : r < 0.75 ? 'yeah' : r < 0.88 ? 'hey' : 'whistle';
      const g = (0.12 + 0.3 * L) * (0.5 + 0.5 * this.rnd()) * (0.6 + 0.4 * this.near);
      this.playGrain(kind, now + this.rnd() * 0.1, g, (this.rnd() * 2 - 1) * 0.8, 0.92 + this.rnd() * 0.16);
    }
  }

  private chants(now: number, L: number): void {
    if (this.size < 25 || !this.grains) return;
    if (this.nextChant === 0) this.nextChant = now + 6 + this.rnd() * 8;
    if (now < this.nextChant) return;
    const a = this.anger;
    this.nextChant = now + (a > 0.6 ? 10 : 16) + this.rnd() * 14;
    const kind: ChantKind = a > 0.75 && this.rnd() < 0.3 ? 'boo' : this.rnd() < 0.55 ? 'clap' : 'hoHey';
    const clk = this.clock(now);
    const beat = clk ? Math.min(0.75, Math.max(0.4, clk.beatDur)) : 0.5;
    const t0 = clk ? (clk.nextBeat > now + 0.05 ? clk.nextBeat : clk.nextBeat + clk.beatDur) : now + 0.1;
    const layers = Math.min(6, 2 + Math.floor(this.size / 150));
    const g = (0.25 + 0.35 * L) * (0.6 + 0.4 * this.near);
    this.chantUntil = t0 + this.schedule(kind, t0, beat, layers, g);
  }

  /** Schedules a chant; returns its length in seconds. */
  private schedule(kind: ChantKind, t0: number, beat: number, layers: number, g: number): number {
    const shout = (k: GrainKind, t: number, gain: number): void => {
      for (let i = 0; i < layers; i++) {
        this.playGrain(k, t + this.rnd() * 0.03, gain * (0.7 + 0.3 * this.rnd()), (this.rnd() * 2 - 1) * 0.7, 0.95 + this.rnd() * 0.1);
      }
    };
    if (kind === 'clap') {
      // "clap . clap . clap clap clap ." ×3, then "HEY!"
      const reps = 3;
      const pattern = [0, 1, 2, 2.5, 3];
      for (let r = 0; r < reps; r++) {
        for (const b of pattern) shout('clap', t0 + (r * 4 + b) * beat, g * 0.9);
      }
      shout('hey', t0 + reps * 4 * beat, g);
      return (reps * 4 + 2) * beat;
    }
    if (kind === 'hoHey') {
      // "HO-HO! HEY-HEY!" ×3
      for (let r = 0; r < 3; r++) {
        const tb = t0 + r * 4 * beat;
        shout('ho', tb, g);
        shout('ho', tb + beat * 0.5, g);
        shout('hey', tb + beat * 2, g);
        shout('hey', tb + beat * 2.5, g);
      }
      return 12 * beat;
    }
    shout('boo', t0, g * 0.9);
    shout('boo', t0 + 0.25, g * 0.7);
    return 1.5;
  }

  dispose(now: number): void {
    this.teardown(now);
    this.out.disconnect();
  }

  /** For the dev page / tests. */
  forceChant(now: number, kind: ChantKind = 'clap'): void {
    const clk = this.clock(now);
    const beat = clk ? Math.min(0.75, Math.max(0.4, clk.beatDur)) : 0.5;
    const L = crowdLevel(Math.max(this.size, 100));
    this.chantUntil = now + this.schedule(kind, now + 0.05, beat, 4, 0.25 + 0.35 * L);
  }
}

