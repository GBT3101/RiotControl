/**
 * ROME — music: tarantella meets opera. The prep hold is a slow serenade in F, the mandolin
 * tremolo-picking long notes over a strummed guitar. The wave march is a tarantella in A minor
 * in 6/8 (two dotted beats of three quavers): the mandolin races through the tune over the
 * tambourine; from layer 3 the brass doubles it a third below like an opera chorus joining in,
 * and every section ends on a grand brass swell with a timpani roll. Brass fanfare. Original
 * melodies (E5).
 */
import {
  C16,
  choraleDrums,
  hit,
  i_,
  III,
  iv,
  POMP_BASS,
  R16,
  roll,
  V7h,
  Vh,
  VII,
  I,
  IV,
  V7,
  vi,
  ii,
  type CityMusic,
  type DrumFn,
  type NoteEvent,
} from '../kit';

const KEY = 69;

/** Tarantella (6 steps = two dotted beats): tambourine jingles, kick on the beats, the swell. */
const tarantellaDrums: DrumFn = (d) => {
  const out: NoteEvent[] = [];
  const last = d.barInSection === d.sectionBars - 1;
  if (d.night) {
    out.push({ step: 0, len: 3, inst: 'timpani', midi: 0, vel: 0.45 });
    for (let s = 0; s < 6; s++) out.push(hit('hat', s, s % 3 ? 0.12 : 0.2));
  } else {
    out.push(hit('kick', 0, 0.75), hit('kick', 3, 0.5));
    for (let s = 0; s < 6; s++) out.push(hit('hat', s, s % 3 ? 0.16 : 0.26));
  }
  if (d.vamp || d.layer <= 1) {
    out.push(hit('snare', 3, 0.3));
    return out;
  }
  if (last) {
    out.push(hit('snare', 0, 0.5), ...roll(3, 6, 0.25, d.layer >= 4 ? 0.85 : 0.65));
  } else {
    out.push(hit('snare', 0, 0.45), hit('snare', 2, 0.3), hit('snare', 3, 0.55), hit('snare', 5, 0.35));
  }
  if (d.layer >= 3) {
    if (d.barInSection === 0) out.push(hit('cymbal', 0, 0.6));
    if (last) {
      // The grand swell: brass on the tonic chord (every section ends on A minor), timpani roll.
      for (const [m, v] of [[KEY - 12, 0.5], [KEY - 9, 0.45], [KEY - 5, 0.45], [KEY, 0.5]] as const) {
        out.push({ step: 0, len: 6, inst: 'brass', midi: m, vel: v * (d.layer >= 4 ? 1.1 : 0.9), vib: 0.15 });
      }
      for (let s = 0; s < 6; s++) out.push({ step: s, len: 1, inst: 'timpani', midi: 0, vel: 0.25 + 0.08 * s });
    }
  }
  if (d.layer >= 4 && d.barInSection !== 0) out.push(hit('cymbal', 0, 0.35));
  return out;
};

// prettier-ignore
export const rome: CityMusic = {
  hold: {
    beatsPerBar: 4, stepsPerBeat: 4, key: 65, tempo: [72, 76],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [I, vi, ii, V7, I, IV, V7, I], B: [IV, IV, I, vi, ii, V7, I, V7] },
    oneShot: false, lead: 'mandolin', harmony: 'mandolin', chordInst: 'pluck', chordSteps: [0, 4, 8, 12],
    bass: 'tuba', bassSteps: POMP_BASS, rhythms: R16, cadences: C16, glock: false, drums: choraleDrums,
  },
  march: {
    beatsPerBar: 2, stepsPerBeat: 3, key: KEY, tempo: [112, 140],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [i_, iv, Vh, i_, i_, iv, V7h, i_], B: [III, VII, III, VII, iv, i_, V7h, i_] },
    oneShot: false, lead: 'mandolin', harmony: 'brass', chordInst: 'pluck', chordSteps: [1, 2, 4, 5],
    bass: 'tuba', bassSteps: [[0, 'root', 2], [3, 'fifth', 2]],
    rhythms: [[0, 1, 2, 3, 4, 5], [0, 2, 3, 5], [0, 1, 2, 3], [0, 2, 3, 4, 5], [0, 3, 4, 5]],
    cadences: [[0], [0, 3]], glock: false, drums: tarantellaDrums,
    melody: {
      // Tarantella: whirling quavers round the fifth, the dominant arpeggio, a stamp home.
      A: [
        [[0, 1, 4], [1, 1, 3], [2, 1, 4], [3, 1, 7], [4, 1, 6], [5, 1, 4]],
        [[0, 1, 5], [1, 1, 4], [2, 1, 5], [3, 2, 7], [5, 1, 5]],
        [[0, 1, 4], [1, 1, 6], [2, 1, 8], [3, 1, 6], [4, 1, 4], [5, 1, 6]],
        [[0, 1, 2], [1, 1, 3], [2, 1, 4], [3, 3, 7]],
        [[0, 1, 4], [1, 1, 3], [2, 1, 4], [3, 1, 7], [4, 1, 6], [5, 1, 4]],
        [[0, 1, 7], [1, 1, 8], [2, 1, 7], [3, 1, 5], [4, 1, 3], [5, 1, 5]],
        [[0, 1, 8], [1, 1, 6], [2, 1, 4], [3, 1, 3], [4, 1, 1], [5, 1, -1]],
        [[0, 2, 0], [3, 3, -3]],
      ],
    },
  },
  fanfare: 'brass',
};
