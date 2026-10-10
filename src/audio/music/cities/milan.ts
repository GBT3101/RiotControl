/**
 * MILAN — music: grand opera at Milanese efficiency. The prep hold is an aria in F in 3/4, the
 * clarinet singing over a harp-like guitar. The wave march is a bombastic opera march in the
 * Verdi manner (an original tune): B♭ major, the fastest march of all the cities, trumpet lead,
 * clarinets on the "pahs" like an Italian banda, glockenspiel, and the bass drum and cymbals
 * (piatti) crashing together on every downbeat from layer 2. Its B section turns to B♭ minor
 * for the act-two drama. Trumpet fanfare. Original melodies (E5).
 */
import {
  C12,
  hit,
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
  Vh,
  vi,
  VI,
  WALTZ_BASS,
  waltzDrums,
  type CityMusic,
  type DrumFn,
} from '../kit';

/** Banda march: piatti with the bass drum on every downbeat from layer 2, timpani at layer 3. */
const bandaDrums: DrumFn = (d) => {
  const out = marchDrums(d);
  if (d.layer >= 2 && !d.vamp && !d.night) out.push(hit('cymbal', 0, d.layer >= 4 ? 0.4 : 0.28));
  if (d.layer >= 3 && d.barInSection % 2 === 0)
    out.push({ step: 0, len: 4, inst: 'timpani', midi: 0, vel: 0.45 });
  return out;
};

// prettier-ignore
export const milan: CityMusic = {
  hold: {
    beatsPerBar: 3, stepsPerBeat: 4, key: 65, tempo: [84, 88],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [I, IV, V7, I, vi, ii, V7, I], B: [vi, vi, ii, V7, I, IV, V7, V7] },
    oneShot: false, lead: 'clarinet', harmony: 'clarinet', chordInst: 'pluck', chordSteps: [4, 8],
    bass: 'tuba', bassSteps: WALTZ_BASS, rhythms: R12, cadences: C12, glock: false, drums: waltzDrums,
  },
  march: {
    beatsPerBar: 2, stepsPerBeat: 4, key: 70, tempo: [128, 152],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [I, I, IV, V7, I, vi, V7, I], B: [i_, i_, iv, Vh, VI, iv, V7h, V7h] },
    nightSections: { A: [i_, i_, iv, V7h, i_, VI, V7h, i_], B: [i_, i_, iv, Vh, VI, iv, V7h, V7h] },
    oneShot: false, lead: 'trumpet', harmony: 'clarinet', chordInst: 'clarinet', chordSteps: [2, 6],
    bass: 'tuba', bassSteps: MARCH_BASS,
    rhythms: [[0, 3, 4, 6], [0, 2, 4, 6], [0, 4], [0, 2, 3, 4, 6], [0, 3, 4, 7]],
    cadences: [[0], [0, 4]], glock: true, drums: bandaDrums,
    melody: {
      // Up the tonic chord to the octave, a soaring IV, a held dominant, the chorus answers.
      A: [
        [[0, 2, 0], [2, 2, 2], [4, 2, 4], [6, 2, 7]],
        [[0, 3, 9], [3, 1, 8], [4, 2, 7], [6, 2, 4]],
        [[0, 2, 5], [2, 2, 7], [4, 3, 10], [7, 1, 9]],
        [[0, 4, 8], [4, 4, 4]],
        [[0, 2, 0], [2, 2, 2], [4, 2, 4], [6, 2, 7]],
        [[0, 3, 9], [3, 1, 8], [4, 2, 7], [6, 2, 5]],
        [[0, 2, 4], [2, 1, 6], [3, 1, 8], [4, 2, 10], [6, 2, 8]],
        [[0, 2, 7], [2, 2, 4], [4, 4, 0]],
      ],
    },
  },
  fanfare: 'trumpet',
};
