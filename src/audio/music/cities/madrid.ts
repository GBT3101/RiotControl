/**
 * MADRID — music: a castanet bolero-waltz hold in A minor and a pasodoble march (A minor
 * verse, major trio), trumpet fanfare. (E0: moved verbatim from patterns.ts.)
 */
import {
  C12,
  C8,
  hit,
  I,
  i_,
  III,
  IV,
  iv,
  MARCH_BASS,
  marchDrums,
  R12,
  R8,
  V7,
  V7h,
  Vh,
  VI,
  VII,
  WALTZ_BASS,
  waltzDrums,
  type CityMusic,
  type DrumFn,
} from '../kit';

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

/** Hold waltz with castanets. */
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

// prettier-ignore
export const madrid: CityMusic = {
  hold: {
    beatsPerBar: 3, stepsPerBeat: 4, key: 69, tempo: [100, 104],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [i_, VII, VI, Vh, i_, VII, VI, Vh], B: [III, VII, i_, Vh, III, VII, VI, Vh] },
    oneShot: false, lead: 'pluck', harmony: 'pluck', chordInst: 'pluck', chordSteps: [4, 8],
    bass: 'tuba', bassSteps: WALTZ_BASS, rhythms: R12, cadences: C12, glock: false, drums: madridHoldDrums,
  },
  march: {
    beatsPerBar: 2, stepsPerBeat: 4, key: 69, tempo: [112, 132],
    form: ['A', 'A', 'B', 'B'],
    sections: {
      A: [i_, VII, VI, Vh, i_, VII, VI, Vh],
      B: [I, I, IV, I, V7, V7, I, V7h],
    },
    nightSections: { A: [i_, VII, VI, Vh, i_, VII, VI, Vh], B: [iv, iv, i_, i_, VI, VI, Vh, Vh] },
    oneShot: false, lead: 'trumpet', harmony: 'horn', chordInst: 'horn', chordSteps: [2, 6],
    bass: 'tuba', bassSteps: MARCH_BASS, rhythms: R8, cadences: C8, glock: false, drums: pasodobleDrums,
  },
  fanfare: 'trumpet',
};
