/**
 * Music kit (E0: split out of patterns.ts): the types, chord vocabulary, drum parts, rhythm
 * vocabularies and bass patterns that the Ministry's styles (patterns.ts) and every city's
 * styles (cities/<city>.ts → CityMusic) are written with.
 */
import type { CityId } from '../../maps/contract';
import type { Rng } from '../../core/rng';
import type { InstId } from './instruments';

export type Theme = 'hold' | 'march' | 'victory' | 'defeat';
/** Music flavour: the Ministry's own (menus, fallback) or a city's. */
export type Flavour = 'ministry' | CityId;

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

export type Quality = 'M' | 'm' | '7' | 'd' | '5';
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
export const Ma = (root: number, q: Quality): Chord => chord(root, q, MAJOR);
export const mi = (root: number, q: Quality): Chord => chord(root, q, MINOR);
export const hm = (root: number, q: Quality): Chord => chord(root, q, HARMONIC);
export const I = Ma(0, 'M');
export const ii = Ma(2, 'm');
export const iii = Ma(4, 'm');
export const IV = Ma(5, 'M');
export const V = Ma(7, 'M');
export const V7 = Ma(7, '7');
export const vi = Ma(9, 'm');
export const i_ = mi(0, 'm');
export const iv = mi(5, 'm');
export const VI = mi(8, 'M');
export const VII = mi(10, 'M');
export const III = mi(3, 'M');
export const Vh = hm(7, 'M');
export const V7h = hm(7, '7');

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

export const hit = (inst: InstId, step: number, vel: number): NoteEvent => ({ step, len: 1, inst, midi: 0, vel });

export function roll(from: number, to: number, v0: number, v1: number, rate = 0.5): NoteEvent[] {
  const out: NoteEvent[] = [];
  const n = Math.round((to - from) / rate);
  for (let k = 0; k < n; k++) out.push(hit('snare', from + k * rate, v0 + ((v1 - v0) * k) / Math.max(1, n - 1)));
  return out;
}

/** 2/4 street march (8 steps). */
export const marchDrums: DrumFn = (d) => {
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
export const pompDrums: DrumFn = (d) => {
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


/** Waltz/elevator (12 steps): soft brushes; layer 2 (breather) adds a light snare. */
export const waltzDrums: DrumFn = (d) => {
  const out: NoteEvent[] = [hit('hat', 4, 0.12), hit('hat', 8, 0.12)];
  if (d.layer >= 2) out.push(hit('snare', 8, 0.12), hit('kick', 0, 0.25));
  return out;
};


/** 4/4 chorale (16 steps): nearly nothing — a timpani swell at section starts. */
export const choraleDrums: DrumFn = (d) =>
  d.barInSection === 0 ? [{ step: 0, len: 8, inst: 'timpani', midi: 0, vel: 0.3 }] : [];

export const victoryDrums: DrumFn = (d) => {
  const out: NoteEvent[] = [hit('kick', 0, 0.8), hit('kick', 8, 0.6)];
  if (d.barInSection === 0) out.push(hit('cymbal', 0, 0.8));
  out.push(hit('snare', 4, 0.5), hit('snare', 12, 0.5));
  if (d.sectionEnd) out.push(...roll(8, 16, 0.3, 0.9));
  return out;
};

export const endDrums: DrumFn = (d) =>
  d.barInSection === 0
    ? [hit('cymbal', 0, 0.9), hit('kick', 0, 0.9), { step: 0, len: 16, inst: 'timpani', midi: 0, vel: 0.8 }]
    : [];

export const dirgeDrums: DrumFn = (d) => [
  { step: 0, len: 8, inst: 'timpani', midi: 0, vel: 0.55 },
  ...(d.barInSection % 2 === 1 ? [hit('snare', 12, 0.2), hit('snare', 14, 0.2)] : []),
];

// ── Styles ───────────────────────────────────────────────────────────────────────────────

export const R8 = [
  [0, 2, 4, 6],
  [0, 3, 4, 6],
  [0, 4],
  [0, 2, 3, 4, 6],
  [0, 1, 2, 4, 6],
  [0, 4, 6],
  [0, 2, 4],
  [0, 3, 4, 7],
] as const;
export const C8 = [[0], [0, 4], [0, 2, 4]] as const;
export const R12 = [
  [0, 4, 8],
  [0, 6, 8],
  [0, 4, 6, 8],
  [0, 8],
  [0, 2, 4, 8],
  [0, 3, 4, 8],
] as const;
export const C12 = [[0], [0, 4]] as const;
export const R16 = [
  [0, 8],
  [0, 6, 8, 12],
  [0, 4, 8, 12],
  [0, 12, 14],
  [0, 8, 12],
  [0, 4, 6, 8, 12],
] as const;
export const C16 = [[0], [0, 8]] as const;

export const MARCH_BASS = [
  [0, 'root', 2],
  [4, 'fifth', 2],
] as const;
export const WALTZ_BASS = [[0, 'root', 3]] as const;
export const POMP_BASS = [
  [0, 'root', 4],
  [8, 'fifth', 4],
] as const;
export const CHORALE_BASS = [
  [0, 'root', 8],
  [8, 'fifth', 8],
] as const;

/** A city style without its id/theme/flavour (patterns.ts adds them). */
export type StyleSpec = Omit<Style, 'id' | 'theme' | 'flavour'>;

/** A city's music (src/audio/music/cities/<city>.ts): its hold and march, its fanfare lead. */
export interface CityMusic {
  /** Prep-phase "hold music". */
  hold: StyleSpec;
  /** Wave march (with night sections). */
  march: StyleSpec;
  /** Lead instrument of the victory fanfare. */
  fanfare: InstId;
}
