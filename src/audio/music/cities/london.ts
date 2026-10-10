/**
 * LONDON — music: a horn chorale hold in B♭ and a broad 4/4 brass-band pomp march in F,
 * brass fanfare. (E0: moved verbatim from patterns.ts.)
 */
import {
  C16,
  CHORALE_BASS,
  choraleDrums,
  I,
  i_,
  ii,
  III,
  iii,
  IV,
  iv,
  POMP_BASS,
  pompDrums,
  R16,
  V,
  V7,
  V7h,
  Vh,
  VI,
  vi,
  type CityMusic,
} from '../kit';

// prettier-ignore
export const london: CityMusic = {
  hold: {
    beatsPerBar: 4, stepsPerBeat: 4, key: 70, tempo: [76, 80],
    form: ['A', 'B'],
    sections: { A: [I, IV, I, V, vi, IV, V, I], B: [IV, I, ii, V, I, IV, V7, I] },
    oneShot: false, lead: 'horn', harmony: 'horn', chordInst: 'epiano', chordSteps: [0, 8],
    bass: 'tuba', bassSteps: CHORALE_BASS, rhythms: R16, cadences: C16, glock: true, drums: choraleDrums,
  },
  march: {
    beatsPerBar: 4, stepsPerBeat: 4, key: 65, tempo: [96, 120],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [I, IV, I, V, I, IV, V, I], B: [vi, iii, IV, I, ii, V, I, V7] },
    nightSections: { A: [i_, iv, i_, Vh, i_, iv, Vh, i_], B: [VI, III, iv, i_, iv, Vh, i_, V7h] },
    oneShot: false, lead: 'brass', harmony: 'horn', chordInst: 'horn', chordSteps: [4, 12],
    bass: 'tuba', bassSteps: POMP_BASS, rhythms: R16, cadences: C16, glock: true, drums: pompDrums,
  },
  fanfare: 'brass',
};
