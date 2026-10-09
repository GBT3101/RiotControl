/**
 * Procedural score generator (pure + deterministic → unit-tested).
 *
 * A *style* (theme × city flavour) defines meter, key, tempo range, 8-bar chord progressions
 * per section, a song form (e.g. A A B A), instruments, rhythm vocabularies and drum parts.
 * `composeSection` writes an 8-bar melody per section from a seed (motif in bars 1–2 repeated
 * in bars 5–6, half cadence in bar 4, tonic in bar 8; strong beats snap to chord tones, weak
 * beats walk the scale). `generateBar` arranges one bar: melody + harmony/glock/chip doubling
 * by layer, oom-pah bass, chord stabs, and drums (snare cadences, rolls into section ends,
 * crashes, castanets, night ticking).
 *
 * Chords carry their own 7-note scale ("chord-scale"), so borrowed chords (E major in A minor,
 * the major trio of a pasodoble) colour the melody correctly.
 */
import { hashString, Rng } from '../../core/rng';
import type { InstId } from './instruments';

export type Theme = 'hold' | 'march' | 'victory' | 'defeat';
export type Flavour = 'ministry' | 'madrid' | 'london' | 'paris';

export interface NoteEvent {
  /** Onset in 16th steps from the bar start (may be fractional for rolls). */
  step: number;
  /** Length in steps. */
  len: number;
  inst: InstId;
  /** MIDI note (percussion: 0). */
  midi: number;
  /** 0…1. */
  vel: number;
  bend?: number;
  vib?: number;
}

export interface Chord {
  /** Root, semitones above the key tonic. */
  root: number;
  /** Chord pitch classes relative to the tonic (0…11). */
  tones: readonly number[];
  /** 7-note scale (semitones above the tonic, ascending from the tonic). */
  scale: readonly number[];
}

export const MAJOR = [0, 2, 4, 5, 7, 9, 11] as const;
export const MINOR = [0, 2, 3, 5, 7, 8, 10] as const;
export const HARMONIC = [0, 2, 3, 5, 7, 8, 11] as const;

type Quality = 'M' | 'm' | '7' | 'd' | '5';
const QUALITY: Record<Quality, number[]> = {
  M: [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  d: [0, 3, 6],
  '5': [0, 7],
};

export function chord(root: number, q: Quality, scale: readonly number[]): Chord {
  return { root, tones: QUALITY[q].map((i) => (root + i) % 12), scale };
}

// Shorthands in major / minor keys.
const Ma = (root: number, q: Quality): Chord => chord(root, q, MAJOR);
const mi = (root: number, q: Quality): Chord => chord(root, q, MINOR);
const hm = (root: number, q: Quality): Chord => chord(root, q, HARMONIC);
const I = Ma(0, 'M');
const ii = Ma(2, 'm');
const iii = Ma(4, 'm');
const IV = Ma(5, 'M');
const V = Ma(7, 'M');
const V7 = Ma(7, '7');
const vi = Ma(9, 'm');
const i_ = mi(0, 'm');
const iv = mi(5, 'm');
const VI = mi(8, 'M');
const VII = mi(10, 'M');
const III = mi(3, 'M');
const Vh = hm(7, 'M');
const V7h = hm(7, '7');

export type DrumFn = (ctx: DrumCtx) => NoteEvent[];

export interface DrumCtx {
  layer: number;
  barInSection: number;
  sectionBars: number;
  night: boolean;
  vamp: boolean;
  steps: number;
  rng: Rng;
  /** Last bar of the section. */
  sectionEnd: boolean;
}

export interface Style {
  id: string;
  theme: Theme;
  flavour: Flavour;
  beatsPerBar: number;
  stepsPerBeat: number;
  /** MIDI note of the tonic in the melody octave. */
  key: number;
  /** BPM at intensity 0 and 1. */
  tempo: [number, number];
  form: readonly string[];
  sections: Readonly<Record<string, readonly Chord[]>>;
  nightSections?: Readonly<Record<string, readonly Chord[]>>;
  /** One-shot (victory/defeat): play the form once, then stop. */
  oneShot: boolean;
  lead: InstId;
  harmony: InstId;
  /** Chord stabs ("pah"/waltz 2-3) instrument and steps. */
  chordInst: InstId | null;
  chordSteps: readonly number[];
  bass: InstId;
  /** Bass pattern: [step, 'root' | 'fifth' | 'walk', len]. */
  bassSteps: readonly (readonly [number, 'root' | 'fifth' | 'third', number])[];
  rhythms: readonly (readonly number[])[];
  cadences: readonly (readonly number[])[];
  glock: boolean;
  drums: DrumFn;
  /** Hand-written melody per section (overrides generation): [step, len, degree] per bar. */
  melody?: Readonly<Record<string, readonly (readonly (readonly [number, number, number])[])[]>>;
}

// ── Drum parts ───────────────────────────────────────────────────────────────────────────

const hit = (inst: InstId, step: number, vel: number): NoteEvent => ({ step, len: 1, inst, midi: 0, vel });

function roll(from: number, to: number, v0: number, v1: number, rate = 0.5): NoteEvent[] {
  const out: NoteEvent[] = [];
  const n = Math.round((to - from) / rate);
  for (let k = 0; k < n; k++) out.push(hit('snare', from + k * rate, v0 + ((v1 - v0) * k) / Math.max(1, n - 1)));
  return out;
}

/** 2/4 street march (8 steps). */
const marchDrums: DrumFn = (d) => {
  const out: NoteEvent[] = [];
  const last = d.barInSection === d.sectionBars - 1;
  if (d.night) {
    out.push({ step: 0, len: 4, inst: 'timpani', midi: 0, vel: 0.5 });
    for (let s = 0; s < d.steps; s++) out.push(hit('hat', s, s % 2 ? 0.12 : 0.22));
  } else {
    out.push(hit('kick', 0, 0.75), hit('kick', 4, 0.5));
  }
  if (d.vamp || d.layer <= 1) {
    out.push(hit('snare', 4, 0.32), hit('snare', 6, 0.25));
    return out;
  }
  if (last && d.layer >= 2) {
    out.push(hit('snare', 0, 0.55), hit('snare', 2, 0.4));
    out.push(...roll(4, 8, 0.25, d.layer >= 4 ? 0.85 : 0.65));
  } else if (d.barInSection % 2 === 0) {
    out.push(hit('snare', 0, 0.5), hit('snare', 2, 0.35), hit('snare', 3, 0.28), hit('snare', 4, 0.6), hit('snare', 6, 0.4));
  } else {
    out.push(hit('snare', 0, 0.5), hit('snare', 2, 0.35), hit('snare', 4, 0.6), hit('snare', 5, 0.3), hit('snare', 6, 0.4), hit('snare', 7, 0.3));
  }
  if (d.layer >= 3) {
    if (d.barInSection === 0) out.push(hit('cymbal', 0, 0.6));
    out.push(hit('snare', 1, 0.15), hit('snare', 5.5, 0.18));
  }
  if (d.layer >= 4) {
    if (d.barInSection !== 0) out.push(hit('cymbal', 0, 0.35));
    if (!last) out.push(hit('snare', 7, 0.3), hit('snare', 7.5, 0.35));
  }
  return out;
};

/** 4/4 broad brass-band march (16 steps). */
const pompDrums: DrumFn = (d) => {
  const out: NoteEvent[] = [];
  const last = d.barInSection === d.sectionBars - 1;
  if (d.night) {
    out.push({ step: 0, len: 8, inst: 'timpani', midi: 0, vel: 0.55 }, { step: 8, len: 8, inst: 'timpani', midi: 0, vel: 0.4 });
    for (let s = 0; s < d.steps; s += 2) out.push(hit('hat', s, 0.18));
  } else {
    out.push(hit('kick', 0, 0.8), hit('kick', 8, 0.55));
    if (d.layer >= 3) out.push(hit('kick', 4, 0.35), hit('kick', 12, 0.35));
  }
  if (d.vamp || d.layer <= 1) {
    out.push(hit('snare', 4, 0.3), hit('snare', 12, 0.3));
    return out;
  }
  if (last) {
    out.push(hit('snare', 4, 0.5), ...roll(8, 16, 0.25, d.layer >= 4 ? 0.85 : 0.6));
  } else {
    out.push(hit('snare', 4, 0.5), hit('snare', 12, 0.5), hit('snare', 10, 0.3), hit('snare', 14, 0.3));
  }
  if (d.layer >= 3 && d.barInSection === 0) out.push(hit('cymbal', 0, 0.7));
  if (d.layer >= 4) {
    if (d.barInSection !== 0) out.push(hit('cymbal', 0, 0.4));
    if (!last) out.push(hit('snare', 6, 0.25), hit('snare', 7, 0.3));
  }
  return out;
};

/** Pasodoble: march + castanet ruffles. */
const pasodobleDrums: DrumFn = (d) => {
  const out = marchDrums(d);
  if (d.layer >= 2 && !d.vamp) {
    for (const [s, v] of [
      [0, 0.6],
      [1, 0.3],
      [2, 0.45],
      [4, 0.6],
      [6, 0.45],
      [7, 0.3],
    ] as const) {
      out.push(hit('castanet', s, v));
    }
    if (d.layer >= 4) out.push(hit('castanet', 3, 0.3), hit('castanet', 5, 0.3));
  }
  return out;
};

/** Waltz/elevator (12 steps): soft brushes; layer 2 (breather) adds a light snare. */
const waltzDrums: DrumFn = (d) => {
  const out: NoteEvent[] = [hit('hat', 4, 0.12), hit('hat', 8, 0.12)];
  if (d.layer >= 2) out.push(hit('snare', 8, 0.12), hit('kick', 0, 0.25));
  return out;
};

const madridHoldDrums: DrumFn = (d) => {
  const out = waltzDrums(d);
  for (const [s, v] of [
    [0, 0.45],
    [4, 0.3],
    [6, 0.25],
    [8, 0.35],
    [10, 0.25],
  ] as const) {
    out.push(hit('castanet', s, v));
  }
  return out;
};

/** 4/4 chorale (16 steps): nearly nothing — a timpani swell at section starts. */
const choraleDrums: DrumFn = (d) =>
  d.barInSection === 0 ? [{ step: 0, len: 8, inst: 'timpani', midi: 0, vel: 0.3 }] : [];

const victoryDrums: DrumFn = (d) => {
  const out: NoteEvent[] = [hit('kick', 0, 0.8), hit('kick', 8, 0.6)];
  if (d.barInSection === 0) out.push(hit('cymbal', 0, 0.8));
  out.push(hit('snare', 4, 0.5), hit('snare', 12, 0.5));
  if (d.sectionEnd) out.push(...roll(8, 16, 0.3, 0.9));
  return out;
};

const endDrums: DrumFn = (d) =>
  d.barInSection === 0
    ? [hit('cymbal', 0, 0.9), hit('kick', 0, 0.9), { step: 0, len: 16, inst: 'timpani', midi: 0, vel: 0.8 }]
    : [];

const dirgeDrums: DrumFn = (d) => [
  { step: 0, len: 8, inst: 'timpani', midi: 0, vel: 0.55 },
  ...(d.barInSection % 2 === 1 ? [hit('snare', 12, 0.2), hit('snare', 14, 0.2)] : []),
];

// ── Styles ───────────────────────────────────────────────────────────────────────────────

const R8 = [
  [0, 2, 4, 6],
  [0, 3, 4, 6],
  [0, 4],
  [0, 2, 3, 4, 6],
  [0, 1, 2, 4, 6],
  [0, 4, 6],
  [0, 2, 4],
  [0, 3, 4, 7],
] as const;
const C8 = [[0], [0, 4], [0, 2, 4]] as const;
const R12 = [
  [0, 4, 8],
  [0, 6, 8],
  [0, 4, 6, 8],
  [0, 8],
  [0, 2, 4, 8],
  [0, 3, 4, 8],
] as const;
const C12 = [[0], [0, 4]] as const;
const R16 = [
  [0, 8],
  [0, 6, 8, 12],
  [0, 4, 8, 12],
  [0, 12, 14],
  [0, 8, 12],
  [0, 4, 6, 8, 12],
] as const;
const C16 = [[0], [0, 8]] as const;

const MARCH_BASS = [
  [0, 'root', 2],
  [4, 'fifth', 2],
] as const;
const WALTZ_BASS = [[0, 'root', 3]] as const;
const POMP_BASS = [
  [0, 'root', 4],
  [8, 'fifth', 4],
] as const;
const CHORALE_BASS = [
  [0, 'root', 8],
  [8, 'fifth', 8],
] as const;

function style(s: Omit<Style, 'id'>): Style {
  return { ...s, id: `${s.theme}:${s.flavour}` };
}

const STYLES: Style[] = [
  // Ministry hold music: elevator waltz, F major, vibes + Rhodes.
  style({
    theme: 'hold', flavour: 'ministry', beatsPerBar: 3, stepsPerBeat: 4, key: 77, tempo: [92, 96],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [I, vi, ii, V, I, vi, ii, V7], B: [IV, IV, I, I, ii, V, I, V7] },
    oneShot: false, lead: 'vibes', harmony: 'epiano', chordInst: 'epiano', chordSteps: [4, 8],
    bass: 'tuba', bassSteps: WALTZ_BASS, rhythms: R12, cadences: C12, glock: false, drums: waltzDrums,
  }),
  style({
    theme: 'hold', flavour: 'madrid', beatsPerBar: 3, stepsPerBeat: 4, key: 69, tempo: [100, 104],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [i_, VII, VI, Vh, i_, VII, VI, Vh], B: [III, VII, i_, Vh, III, VII, VI, Vh] },
    oneShot: false, lead: 'pluck', harmony: 'pluck', chordInst: 'pluck', chordSteps: [4, 8],
    bass: 'tuba', bassSteps: WALTZ_BASS, rhythms: R12, cadences: C12, glock: false, drums: madridHoldDrums,
  }),
  style({
    theme: 'hold', flavour: 'london', beatsPerBar: 4, stepsPerBeat: 4, key: 70, tempo: [76, 80],
    form: ['A', 'B'],
    sections: { A: [I, IV, I, V, vi, IV, V, I], B: [IV, I, ii, V, I, IV, V7, I] },
    oneShot: false, lead: 'horn', harmony: 'horn', chordInst: 'epiano', chordSteps: [0, 8],
    bass: 'tuba', bassSteps: CHORALE_BASS, rhythms: R16, cadences: C16, glock: true, drums: choraleDrums,
  }),
  style({
    theme: 'hold', flavour: 'paris', beatsPerBar: 3, stepsPerBeat: 4, key: 69, tempo: [120, 126],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [i_, i_, V7h, V7h, V7h, V7h, i_, i_], B: [iv, iv, i_, i_, V7h, V7h, i_, V7h] },
    oneShot: false, lead: 'accordion', harmony: 'accordion', chordInst: 'accordion', chordSteps: [4, 8],
    bass: 'tuba', bassSteps: WALTZ_BASS, rhythms: R12, cadences: C12, glock: false, drums: waltzDrums,
  }),
  // Marches.
  style({
    theme: 'march', flavour: 'ministry', beatsPerBar: 2, stepsPerBeat: 4, key: 70, tempo: [108, 136],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [I, I, IV, V, I, IV, V, I], B: [vi, vi, IV, I, ii, V, I, V7] },
    nightSections: { A: [i_, i_, iv, Vh, i_, iv, Vh, i_], B: [VI, VI, iv, i_, iv, Vh, i_, V7h] },
    oneShot: false, lead: 'brass', harmony: 'horn', chordInst: 'horn', chordSteps: [2, 6],
    bass: 'tuba', bassSteps: MARCH_BASS, rhythms: R8, cadences: C8, glock: true, drums: marchDrums,
  }),
  style({
    theme: 'march', flavour: 'madrid', beatsPerBar: 2, stepsPerBeat: 4, key: 69, tempo: [112, 132],
    form: ['A', 'A', 'B', 'B'],
    sections: {
      A: [i_, VII, VI, Vh, i_, VII, VI, Vh],
      B: [I, I, IV, I, V7, V7, I, V7h],
    },
    nightSections: { A: [i_, VII, VI, Vh, i_, VII, VI, Vh], B: [iv, iv, i_, i_, VI, VI, Vh, Vh] },
    oneShot: false, lead: 'trumpet', harmony: 'horn', chordInst: 'horn', chordSteps: [2, 6],
    bass: 'tuba', bassSteps: MARCH_BASS, rhythms: R8, cadences: C8, glock: false, drums: pasodobleDrums,
  }),
  style({
    theme: 'march', flavour: 'london', beatsPerBar: 4, stepsPerBeat: 4, key: 65, tempo: [96, 120],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [I, IV, I, V, I, IV, V, I], B: [vi, iii, IV, I, ii, V, I, V7] },
    nightSections: { A: [i_, iv, i_, Vh, i_, iv, Vh, i_], B: [VI, III, iv, i_, iv, Vh, i_, V7h] },
    oneShot: false, lead: 'brass', harmony: 'horn', chordInst: 'horn', chordSteps: [4, 12],
    bass: 'tuba', bassSteps: POMP_BASS, rhythms: R16, cadences: C16, glock: true, drums: pompDrums,
  }),
  style({
    theme: 'march', flavour: 'paris', beatsPerBar: 2, stepsPerBeat: 4, key: 67, tempo: [116, 140],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [I, I, V7, V7, V7, V7, I, I], B: [IV, IV, I, I, V7, V7, I, V7] },
    nightSections: { A: [i_, i_, V7h, V7h, V7h, V7h, i_, i_], B: [iv, iv, i_, i_, V7h, V7h, i_, V7h] },
    oneShot: false, lead: 'accordion', harmony: 'accordion', chordInst: 'accordion', chordSteps: [2, 6],
    bass: 'tuba', bassSteps: MARCH_BASS, rhythms: R8, cadences: C8, glock: true, drums: marchDrums,
  }),
];

type Tune = (readonly (readonly [number, number, number])[])[];

/** Victory fanfare (C major): arpeggios up, a proud IV, then a V7 that never resolves. */
const VICTORY_TUNE: Tune = [
  [[0, 2, -3], [2, 1, 0], [3, 1, 2], [4, 4, 4], [8, 2, 2], [10, 2, 4], [12, 4, 7]],
  [[0, 6, 5], [6, 2, 3], [8, 4, 5], [12, 4, 7]],
  [[0, 4, 6], [4, 4, 4], [8, 4, 1], [12, 4, 4]],
  [[0, 8, 7], [8, 4, 4], [12, 4, 2]],
  [[0, 4, 3], [4, 4, 5], [8, 8, 7]],
  [[0, 4, 9], [4, 4, 7], [8, 8, 4]],
  [[0, 2, 3], [2, 2, 4], [4, 2, 5], [6, 2, 6], [8, 8, 8]],
  [[0, 4, 6], [4, 4, 4], [8, 4, 8], [12, 4, 6]],
];

/** Defeat dirge (D minor). */
const DIRGE_TUNE: Tune = [
  [[0, 6, 4], [6, 2, 2], [8, 8, 0]],
  [[0, 4, 3], [4, 4, 5], [8, 4, 4], [12, 4, 3]],
  [[0, 6, 4], [6, 2, 3], [8, 4, 1], [12, 4, -1]],
  [[0, 16, 0]],
  [[0, 4, 5], [4, 4, 4], [8, 8, 3]],
  [[0, 4, 2], [4, 4, 1], [8, 8, 0]],
  [[0, 8, 1], [8, 8, -1]],
  [[0, 16, 0]],
];

function oneShots(flavour: Flavour): Style[] {
  const lead: InstId = flavour === 'madrid' ? 'trumpet' : flavour === 'paris' ? 'accordion' : 'brass';
  return [
    style({
      theme: 'victory', flavour, beatsPerBar: 4, stepsPerBeat: 4, key: 72, tempo: [100, 100],
      form: ['V', 'E'],
      sections: { V: [I, IV, V, I, IV, I, V7, V7], E: [chord(0, '5', MAJOR), chord(0, '5', MAJOR)] },
      oneShot: true, lead, harmony: 'horn', chordInst: 'brass', chordSteps: [0, 4, 8, 12],
      bass: 'tuba', bassSteps: POMP_BASS, rhythms: [[0, 2, 3, 4, 8], [0, 8, 12], [0, 4, 8, 12]],
      cadences: [[0], [0, 8]], glock: true,
      drums: (d) => (d.sectionBars === 2 ? endDrums(d) : victoryDrums(d)),
      melody: { V: VICTORY_TUNE },
    }),
    style({
      theme: 'defeat', flavour, beatsPerBar: 4, stepsPerBeat: 4, key: 62, tempo: [72, 72],
      form: ['D', 'T'],
      sections: { D: [i_, iv, Vh, i_, iv, i_, Vh, i_], T: [Vh, i_] },
      oneShot: true, lead: 'horn', harmony: 'horn', chordInst: null, chordSteps: [],
      bass: 'tuba', bassSteps: CHORALE_BASS, rhythms: [[0, 8], [0, 4, 8], [0, 12]],
      cadences: [[0]], glock: false, drums: dirgeDrums,
      melody: { D: DIRGE_TUNE },
    }),
  ];
}

const ALL_STYLES: Style[] = [
  ...STYLES,
  ...(['ministry', 'madrid', 'london', 'paris'] as const).flatMap(oneShots),
];

export function styleFor(theme: Theme, flavour: Flavour): Style {
  return (
    ALL_STYLES.find((s) => s.theme === theme && s.flavour === flavour) ??
    ALL_STYLES.find((s) => s.theme === theme && s.flavour === 'ministry')!
  );
}

export function allStyles(): readonly Style[] {
  return ALL_STYLES;
}

export function stepsPerBar(s: Style): number {
  return s.beatsPerBar * s.stepsPerBeat;
}

export function sectionChords(s: Style, section: string, night: boolean): readonly Chord[] {
  const src = (night && s.nightSections) || s.sections;
  return src[section] ?? s.sections[section] ?? s.sections[s.form[0]!]!;
}

export function tempoFor(s: Style, intensity: number, night: boolean): number {
  const k = Math.min(1, Math.max(0, intensity));
  const t = s.tempo[0] + (s.tempo[1] - s.tempo[0]) * k;
  return Math.round(night && s.theme === 'march' ? t * 0.94 : t);
}

/** Arrangement layer 1…4 from intensity 0…1. */
export function layerFor(intensity: number): number {
  return 1 + Math.min(3, Math.max(0, Math.floor(intensity * 4)));
}

/** Music intensity from the game state (level 0…10, alive protesters). */
export function musicIntensity(level: number, crowd: number): number {
  const lv = Math.min(10, Math.max(0, level));
  const cr = Math.max(0, crowd);
  return Math.min(1, Math.max(0, 0.1 + 0.055 * lv + (0.3 * Math.log10(1 + cr)) / 3.5));
}

// ── Melody ───────────────────────────────────────────────────────────────────────────────

export interface MelNote {
  step: number;
  len: number;
  /** Scale degree (0 = tonic of the melody octave; 7 = octave above). */
  deg: number;
}

export function degToMidi(deg: number, key: number, scale: readonly number[]): number {
  const oct = Math.floor(deg / 7);
  const idx = ((deg % 7) + 7) % 7;
  return key + 12 * oct + scale[idx]!;
}

function pitchClass(deg: number, scale: readonly number[]): number {
  return (((scale[((deg % 7) + 7) % 7]! % 12) + 12) % 12);
}

/** Nearest degree (prefer smaller moves, then downward) whose pitch is a chord tone. */
export function snapToChord(deg: number, ch: Chord): number {
  for (let d = 0; d <= 3; d++) {
    for (const cand of d === 0 ? [deg] : [deg - d, deg + d]) {
      if (ch.tones.includes(pitchClass(cand, ch.scale))) return cand;
    }
  }
  return deg;
}

/** Like `snapToChord`, but prefers the direction of motion and avoids repeating `prev`. */
export function snapMelodic(deg: number, ch: Chord, dir: number, prev: number | null): number {
  const cands: number[] = [];
  for (let d = 0; d <= 4; d++) {
    const order = d === 0 ? [deg] : dir >= 0 ? [deg + d, deg - d] : [deg - d, deg + d];
    for (const c of order) if (ch.tones.includes(pitchClass(c, ch.scale))) cands.push(c);
  }
  return cands.find((c) => c !== prev) ?? cands[0] ?? deg;
}

const STEP_MOVES = [-2, -1, 1, 2, 3, -3, 0, 4, -4];
const STEP_WEIGHTS = [2, 5, 5, 2, 1, 1, 0.25, 0.4, 0.4];

/** 8-bar (or shorter) melody for one section. Deterministic in (style, section, seed, night). */
export function composeSection(st: Style, section: string, seed: number, night: boolean): MelNote[][] {
  const fixed = st.melody?.[section];
  if (fixed) return fixed.map((bar) => bar.map(([step, len, deg]) => ({ step, len, deg })));
  const rng = new Rng(hashString(`${st.id}|${section}|${seed}|${night ? 'n' : 'd'}`));
  const chords = sectionChords(st, section, night);
  const steps = stepsPerBar(st);
  const spb = st.stepsPerBeat;
  const bars: MelNote[][] = [];
  const motif = [rng.pick(st.rhythms), rng.pick(st.rhythms)];
  let deg = snapToChord(rng.pick([0, 2, 4]), chords[0]!);
  let dir = 1;
  for (let b = 0; b < chords.length; b++) {
    const ch = chords[b]!;
    const finalBar = b === chords.length - 1;
    const halfCadence = b === 3 && chords.length === 8;
    const repeat = (b === 4 || b === 5) && chords.length === 8;
    const rhythm =
      finalBar || halfCadence
        ? rng.pick(st.cadences)
        : b < 2
          ? motif[b]!
          : repeat
            ? motif[b - 4]!
            : rng.pick(st.rhythms);
    const notes: MelNote[] = [];
    // Phrase arch: rise through the first half, fall back towards the tonic in the second.
    if (b === 0) dir = 1;
    if (b === 4 && chords.length === 8) dir = -1;
    for (let k = 0; k < rhythm.length; k++) {
      const step = rhythm[k]!;
      const next = k + 1 < rhythm.length ? rhythm[k + 1]! : steps;
      const strong = step % spb === 0;
      const prev = notes.length ? notes[notes.length - 1]!.deg : bars.length ? (bars[bars.length - 1]!.at(-1)?.deg ?? null) : null;
      if (repeat && bars[b - 4]![k]) {
        deg = bars[b - 4]![k]!.deg;
      } else if (!(b === 0 && k === 0)) {
        let move = rng.weighted(STEP_MOVES, STEP_WEIGHTS);
        if (Math.abs(move) >= 3) dir = -Math.sign(move);
        else if (move !== 0 && rng.chance(0.65)) move = Math.abs(move) * dir;
        deg += move;
        if (deg > 9) {
          deg -= 2;
          dir = -1;
        } else if (deg < -2) {
          deg += 2;
          dir = 1;
        }
      }
      if (repeat && bars[b - 4]![k]) {
        if (strong) deg = snapToChord(deg, ch);
      } else if (strong) deg = snapMelodic(deg, ch, dir, prev);
      if (finalBar && k === rhythm.length - 1) {
        // Resolve home when the last chord is the tonic; otherwise land on a chord tone
        // (sections ending on V7 turn around into the next section).
        deg = ch.tones.includes(0) ? (deg > 3 ? 7 : 0) : snapToChord(deg, ch);
      }
      else if (halfCadence && k === rhythm.length - 1) deg = snapMelodic(deg, ch, dir, prev);
      // Keep the tune in a singable range (about −2 … +10 degrees around the tonic).
      if (deg > 10) deg = snapToChord(deg - 3, ch);
      else if (deg < -3) deg = snapToChord(deg + 3, ch);
      notes.push({ step, len: next - step, deg });
    }
    bars.push(notes);
  }
  return bars;
}

// ── Bars ─────────────────────────────────────────────────────────────────────────────────

export interface BarRequest {
  style: Style;
  section: string;
  barInSection: number;
  layer: number;
  night: boolean;
  seed: number;
  /** Breather "parade rest": no melody, just bass, pahs and light drums. */
  vamp?: boolean;
  /** Last bar of the form of a one-shot theme. */
  formEnd?: boolean;
}

export interface BarPlan {
  steps: number;
  notes: NoteEvent[];
  chord: Chord;
}

const melodyCache = new Map<string, MelNote[][]>();
function melodyFor(st: Style, section: string, seed: number, night: boolean): MelNote[][] {
  const key = `${st.id}|${section}|${seed}|${night ? 1 : 0}`;
  let m = melodyCache.get(key);
  if (!m) {
    m = composeSection(st, section, seed, night);
    if (melodyCache.size > 64) melodyCache.clear();
    melodyCache.set(key, m);
  }
  return m;
}

function bassMidi(st: Style, ch: Chord, which: 'root' | 'fifth' | 'third'): number {
  // Tuba range ≈ key − 30 … key − 13.
  const base = st.key - 24 + ch.root;
  const off = which === 'root' ? 0 : which === 'fifth' ? 7 : (ch.tones[1] ?? ch.root) - ch.root;
  let m = base + ((off + 12) % 12);
  if (which === 'fifth') m -= 12;
  while (m > st.key - 12) m -= 12;
  while (m < st.key - 31) m += 12;
  return m;
}

/** The chord tones as MIDI notes in the stab register (around key − 10 … key + 2). */
function voicing(st: Style, ch: Chord): number[] {
  const lo = st.key - 10;
  return ch.tones.slice(0, 3).map((pc) => {
    let m = st.key - 12 + pc;
    while (m < lo) m += 12;
    while (m >= lo + 12) m -= 12;
    return m;
  });
}

export function generateBar(req: BarRequest): BarPlan {
  const st = req.style;
  const steps = stepsPerBar(st);
  const chords = sectionChords(st, req.section, req.night);
  const ch = chords[req.barInSection % chords.length]!;
  const rng = new Rng(hashString(`${st.id}|${req.section}|${req.barInSection}|${req.seed}|${req.layer}|${req.night ? 1 : 0}`));
  const notes: NoteEvent[] = [];
  const layer = Math.max(1, Math.min(4, req.layer));
  const march = st.theme === 'march';
  const vamp = !!req.vamp;
  const lastOfForm = !!req.formEnd;

  // Melody & doublings.
  if (!vamp) {
    const mel = melodyFor(st, req.section, req.seed, req.night)[req.barInSection % chords.length] ?? [];
    const leadVel = st.theme === 'hold' ? 0.7 : 0.85;
    for (const n of mel) {
      const midi = degToMidi(n.deg, st.key, ch.scale);
      const strong = n.step % st.stepsPerBeat === 0;
      const lenSteps = n.len;
      if (st.theme === 'defeat' && req.section === 'T') continue;
      if (st.theme === 'victory' && req.section === 'E') continue;
      notes.push({
        step: n.step,
        len: Math.max(0.5, lenSteps * (march ? 0.85 : 0.95)),
        inst: st.lead,
        midi,
        vel: leadVel * (strong ? 1 : 0.85),
      });
      if (layer >= 3 && (strong || lenSteps >= st.stepsPerBeat) && st.harmony !== st.lead) {
        const hdeg = snapToChord(n.deg - 2, ch);
        notes.push({ step: n.step, len: Math.max(0.5, lenSteps * 0.9), inst: st.harmony, midi: degToMidi(hdeg, st.key, ch.scale) - (st.harmony === 'horn' ? 0 : 12), vel: 0.55 });
      } else if (layer >= 3 && strong && st.harmony === st.lead) {
        const hdeg = snapToChord(n.deg - 2, ch);
        notes.push({ step: n.step, len: Math.max(0.5, lenSteps * 0.9), inst: st.harmony, midi: degToMidi(hdeg, st.key, ch.scale), vel: 0.4 });
      }
      if (st.glock && layer >= 3 && strong && !req.night) {
        notes.push({ step: n.step, len: 1, inst: 'glock', midi: midi + 12, vel: 0.55 });
      }
      if (march && layer >= 4 && !req.night) {
        notes.push({ step: n.step, len: Math.max(0.5, lenSteps * 0.6), inst: 'chip', midi: midi + 12, vel: 0.6 });
      }
    }
    if (st.theme === 'defeat' && req.section === 'T') {
      // The sad trombone: "wah wah wah waaah" (descending semitones, last one wobbling).
      if (req.barInSection === 0) {
        const top = st.key - 5;
        notes.push(
          { step: 0, len: 3.5, inst: 'brass', midi: top, vel: 0.8 },
          { step: 4, len: 3.5, inst: 'brass', midi: top - 1, vel: 0.8 },
          { step: 8, len: 3.5, inst: 'brass', midi: top - 2, vel: 0.8 },
          { step: 12, len: 18, inst: 'brass', midi: top - 3, vel: 0.85, vib: 0.35 },
        );
      }
    }
  }

  // Bass.
  const walk = req.barInSection === chords.length - 1 && march && layer >= 2 && !lastOfForm;
  for (const [s, which, len] of st.bassSteps) {
    if (st.theme === 'victory' && req.section === 'E' && s > 0) continue;
    notes.push({ step: s, len: len * 0.9, inst: st.bass, midi: bassMidi(st, ch, which), vel: s === 0 ? 0.9 : 0.75 });
  }
  if (walk) {
    const next = chords[0]!;
    const target = bassMidi(st, next, 'root');
    notes.push({ step: steps - 2, len: 1.6, inst: st.bass, midi: target - 2, vel: 0.7 });
  }
  if (st.theme === 'victory' && req.section === 'E') {
    for (const n of notes) if (n.inst === st.bass) Object.assign(n, { len: steps * 1.8, bend: -1 });
  }

  // Chord stabs.
  if (st.chordInst && !(st.theme === 'victory' && req.section === 'E')) {
    const stab = march ? layer >= 2 || vamp : true;
    if (stab) {
      const v = voicing(st, ch);
      for (const s of st.chordSteps) {
        for (const m of v) {
          notes.push({ step: s, len: march ? 1.2 : st.stepsPerBeat * 0.8, inst: st.chordInst, midi: m, vel: march ? 0.45 : 0.5 });
        }
      }
    }
  } else if (st.theme === 'victory' && req.section === 'E' && req.barInSection === 0) {
    // Hollow ending: an open fifth (no third) held on brass, sagging flat.
    for (const m of [st.key - 12, st.key - 5, st.key]) {
      notes.push({ step: 0, len: steps * 1.8, inst: 'brass', midi: m, vel: 0.7, bend: -1, vib: 0.05 });
    }
  }

  // Drums.
  const drums = st.drums({
    layer: vamp ? 1 : layer,
    barInSection: req.barInSection,
    sectionBars: chords.length,
    night: req.night,
    vamp,
    steps,
    rng,
    sectionEnd: req.barInSection === chords.length - 1,
  });
  for (const d of drums) {
    if (d.inst === 'timpani' && d.midi === 0) d.midi = bassMidi(st, ch, 'root') + 12;
    notes.push(d);
  }

  notes.sort((a, b) => a.step - b.step || a.midi - b.midi);
  return { steps, notes, chord: ch };
}

/** A one-bar transition into a march: snare roll crescendo + tuba walk-up to the tonic. */
export function pickupBar(st: Style): BarPlan {
  const steps = stepsPerBar(st);
  const notes: NoteEvent[] = [];
  notes.push(...roll(0, steps, 0.15, 0.8, steps > 8 ? 1 : 0.5));
  const tonic = st.key - 24;
  const walk = [-5, -3, -1];
  const each = steps / 4;
  walk.forEach((o, k) => notes.push({ step: each * (k + 1), len: each * 0.8, inst: st.bass, midi: tonic + o, vel: 0.6 + 0.1 * k }));
  return { steps, notes, chord: sectionChords(st, st.form[0]!, false)[0]! };
}
