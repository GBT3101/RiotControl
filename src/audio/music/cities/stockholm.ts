/**
 * STOCKHOLM — music: Nordic minor folk on the nyckelharpa (a buzzy bowed patch with ringing
 * sympathetic strings and a cold stone-hall echo) over an open D–A drone. The prep hold is a
 * sixteenth-note polska in 3/4 (the stamp on one and three); the wave march is a gånglåt, the
 * 2/4 walking tune that took wedding processions through the village, here taking the Ministry
 * through Gamla stan, with a fiddle answering from layer 3. Nyckelharpa fanfare. Original
 * melodies (E5).
 */
import {
  C12,
  hit,
  i_,
  III,
  iv,
  MARCH_BASS,
  marchDrums,
  V7h,
  Vh,
  VI,
  VII,
  type CityMusic,
  type DrumFn,
  type NoteEvent,
} from '../kit';

const KEY = 62;

/** The open-string drone (tonic and fifth an octave below the tune), held through the bar. */
function drone(steps: number, vel: number): NoteEvent[] {
  return [
    { step: 0, len: steps, inst: 'nyckel', midi: KEY - 12, vel, vib: 0 },
    { step: 0, len: steps, inst: 'nyckel', midi: KEY - 5, vel: vel * 0.8, vib: 0 },
  ];
}

/** Polska: a foot stamp on one and three, the drone. */
const polskaDrums: DrumFn = (d) => [
  hit('kick', 0, 0.3),
  hit('kick', 8, 0.22),
  hit('hat', 4, 0.06),
  ...drone(d.steps, 0.3),
];

/** Gånglåt: the march with the drone under it (thinner once the band is loud). */
const ganglatDrums: DrumFn = (d) => [
  ...marchDrums(d),
  ...drone(d.steps, d.layer >= 3 ? 0.2 : 0.28),
];

// prettier-ignore
export const stockholm: CityMusic = {
  hold: {
    beatsPerBar: 3, stepsPerBeat: 4, key: KEY, tempo: [104, 108],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [i_, i_, VII, VII, i_, iv, Vh, i_], B: [III, III, VII, VII, iv, i_, V7h, i_] },
    oneShot: false, lead: 'nyckel', harmony: 'nyckel', chordInst: null, chordSteps: [],
    bass: 'tuba', bassSteps: [[0, 'root', 3], [8, 'fifth', 3]],
    rhythms: [[0, 1, 2, 3, 4, 6, 8, 10], [0, 2, 4, 5, 6, 7, 8], [0, 1, 2, 3, 4, 8], [0, 2, 3, 4, 6, 8, 10]],
    cadences: C12, glock: false, drums: polskaDrums,
    melody: {
      // Sextondelspolska: sixteenth runs round the fifth, a lift to the seventh chord, home.
      A: [
        [[0, 1, 4], [1, 1, 5], [2, 1, 4], [3, 1, 3], [4, 1, 2], [5, 1, 3], [6, 1, 4], [7, 1, 2], [8, 2, 0], [10, 2, 4]],
        [[0, 2, 7], [2, 1, 6], [3, 1, 5], [4, 2, 4], [6, 2, 5], [8, 4, 4]],
        [[0, 1, 6], [1, 1, 5], [2, 1, 6], [3, 1, 7], [4, 2, 8], [6, 2, 6], [8, 2, 3], [10, 2, 1]],
        [[0, 2, 3], [2, 2, 1], [4, 8, -1]],
        [[0, 1, 4], [1, 1, 5], [2, 1, 4], [3, 1, 3], [4, 1, 2], [5, 1, 3], [6, 1, 4], [7, 1, 2], [8, 2, 0], [10, 2, 4]],
        [[0, 2, 5], [2, 2, 7], [4, 4, 10], [8, 2, 8], [10, 2, 7]],
        [[0, 1, 4], [1, 1, 6], [2, 1, 8], [3, 1, 6], [4, 2, 4], [6, 2, 3], [8, 2, 1], [10, 2, -1]],
        [[0, 4, 0], [4, 2, 2], [6, 2, 4], [8, 4, 0]],
      ],
    },
  },
  march: {
    beatsPerBar: 2, stepsPerBeat: 4, key: KEY, tempo: [100, 124],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [i_, i_, VII, III, i_, iv, Vh, i_], B: [III, VII, VI, VII, iv, i_, V7h, i_] },
    oneShot: false, lead: 'nyckel', harmony: 'fiddle', chordInst: 'nyckel', chordSteps: [2, 6],
    bass: 'tuba', bassSteps: MARCH_BASS,
    rhythms: [[0, 2, 4, 6, 7], [0, 3, 4, 6], [0, 2, 3, 4, 6], [0, 4, 6], [0, 1, 2, 4, 6]],
    cadences: [[0], [0, 4]], glock: false, drums: ganglatDrums,
    melody: {
      // Gånglåt: a striding minor arpeggio, the bright C-major turn, the leading note, home.
      A: [
        [[0, 2, 0], [2, 2, 2], [4, 2, 4], [6, 1, 3], [7, 1, 2]],
        [[0, 3, 4], [3, 1, 5], [4, 2, 4], [6, 2, 7]],
        [[0, 2, 6], [2, 1, 5], [3, 1, 6], [4, 2, 8], [6, 2, 6]],
        [[0, 4, 4], [4, 4, 2]],
        [[0, 2, 0], [2, 2, 2], [4, 2, 4], [6, 1, 3], [7, 1, 2]],
        [[0, 3, 5], [3, 1, 6], [4, 2, 7], [6, 2, 5]],
        [[0, 2, 4], [2, 2, 6], [4, 2, 4], [6, 1, 3], [7, 1, 1]],
        [[0, 8, 0]],
      ],
    },
  },
  fanfare: 'nyckel',
};
