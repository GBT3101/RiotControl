/**
 * PARIS — music: an accordion musette waltz hold in A minor and an accordion march in G,
 * accordion fanfare. (E0: moved verbatim from patterns.ts.)
 */
import {
  C12,
  C8,
  I,
  i_,
  IV,
  iv,
  MARCH_BASS,
  marchDrums,
  R12,
  R8,
  V7,
  V7h,
  WALTZ_BASS,
  waltzDrums,
  type CityMusic,
} from '../kit';

// prettier-ignore
export const paris: CityMusic = {
  hold: {
    beatsPerBar: 3, stepsPerBeat: 4, key: 69, tempo: [120, 126],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [i_, i_, V7h, V7h, V7h, V7h, i_, i_], B: [iv, iv, i_, i_, V7h, V7h, i_, V7h] },
    oneShot: false, lead: 'accordion', harmony: 'accordion', chordInst: 'accordion', chordSteps: [4, 8],
    bass: 'tuba', bassSteps: WALTZ_BASS, rhythms: R12, cadences: C12, glock: false, drums: waltzDrums,
  },
  march: {
    beatsPerBar: 2, stepsPerBeat: 4, key: 67, tempo: [116, 140],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [I, I, V7, V7, V7, V7, I, I], B: [IV, IV, I, I, V7, V7, I, V7] },
    nightSections: { A: [i_, i_, V7h, V7h, V7h, V7h, i_, i_], B: [iv, iv, i_, i_, V7h, V7h, i_, V7h] },
    oneShot: false, lead: 'accordion', harmony: 'accordion', chordInst: 'accordion', chordSteps: [2, 6],
    bass: 'tuba', bassSteps: MARCH_BASS, rhythms: R8, cadences: C8, glock: true, drums: marchDrums,
  },
  fanfare: 'accordion',
};
