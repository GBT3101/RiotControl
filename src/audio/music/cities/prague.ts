/**
 * PRAGUE — music: Bohemian brass band (dechovka). The prep hold is a slow village waltz
 * (valčík) in F, clarinet over flugelhorn-ish horns; the wave march is a polka in B♭: oom-pah
 * tuba and brass "pahs", the clarinet running the tune, a trumpet answering a third below
 * from layer 3. Clarinet fanfare. Original melodies (E5).
 */
import {
  C12,
  C8,
  I,
  i_,
  ii,
  IV,
  iv,
  MARCH_BASS,
  marchDrums,
  R12,
  V7,
  V7h,
  vi,
  WALTZ_BASS,
  waltzDrums,
  type CityMusic,
} from '../kit';

// prettier-ignore
export const prague: CityMusic = {
  hold: {
    beatsPerBar: 3, stepsPerBeat: 4, key: 65, tempo: [118, 124],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [I, IV, V7, I, I, IV, V7, I], B: [vi, ii, V7, I, IV, I, V7, I] },
    oneShot: false, lead: 'clarinet', harmony: 'clarinet', chordInst: 'horn', chordSteps: [4, 8],
    bass: 'tuba', bassSteps: WALTZ_BASS, rhythms: R12, cadences: C12, glock: false, drums: waltzDrums,
  },
  march: {
    beatsPerBar: 2, stepsPerBeat: 4, key: 70, tempo: [120, 146],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [I, I, V7, V7, V7, V7, I, I], B: [IV, IV, I, I, V7, V7, I, V7] },
    nightSections: { A: [i_, i_, V7h, V7h, V7h, V7h, i_, i_], B: [iv, iv, i_, i_, V7h, V7h, i_, V7h] },
    oneShot: false, lead: 'clarinet', harmony: 'trumpet', chordInst: 'brass', chordSteps: [2, 6],
    bass: 'tuba', bassSteps: MARCH_BASS,
    rhythms: [[0, 1, 2, 3, 4, 6], [0, 2, 4, 6], [0, 2, 3, 4, 6], [0, 1, 2, 4, 6], [0, 4, 6]],
    cadences: C8, glock: false, drums: marchDrums,
    melody: {
      // Polka: a turn round the fifth, an arpeggio down, a chattering dominant, a scale home.
      A: [
        [[0, 1, 4], [1, 1, 5], [2, 1, 4], [3, 1, 3], [4, 2, 2], [6, 2, 4]],
        [[0, 2, 7], [2, 2, 4], [4, 2, 2], [6, 2, 0]],
        [[0, 1, 1], [1, 1, 3], [2, 1, 4], [3, 1, 6], [4, 2, 8], [6, 2, 6]],
        [[0, 2, 8], [2, 2, 6], [4, 4, 4]],
        [[0, 1, 6], [1, 1, 7], [2, 1, 6], [3, 1, 5], [4, 2, 4], [6, 2, 6]],
        [[0, 2, 8], [2, 2, 6], [4, 2, 4], [6, 2, 3]],
        [[0, 1, 0], [1, 1, 1], [2, 1, 2], [3, 1, 3], [4, 2, 4], [6, 2, 7]],
        [[0, 2, 7], [2, 2, 4], [4, 4, 0]],
      ],
    },
  },
  fanfare: 'clarinet',
};
