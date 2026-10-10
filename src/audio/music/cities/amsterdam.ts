/**
 * AMSTERDAM — music: the draaiorgel, the street organ wheezing on the bridge. Every voice is the
 * organ patch (flue + reed celeste, bellows tremulant, wind noise), bass pipes included. The prep
 * hold is the organ's waltz in G; the wave march is its jolly 2/4 march with the organ's own
 * drum, woodblock ticks from layer 2 and the glockenspiel register from layer 3. Organ fanfare.
 * Original melodies (E5).
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
  vi,
  VI,
  WALTZ_BASS,
  waltzDrums,
  type CityMusic,
  type DrumFn,
} from '../kit';

/** The organ's waltz drum: bass drum on one, the brushes. */
const orgelWaltz: DrumFn = (d) => [hit('kick', 0, 0.35), ...waltzDrums(d)];

/** The organ's march drum, plus woodblock ticks on the off-beats from layer 2. */
const orgelMarch: DrumFn = (d) => {
  const out = marchDrums(d);
  if (d.layer >= 2 && !d.vamp) out.push(hit('castanet', 2, 0.3), hit('castanet', 6, 0.3));
  if (d.layer >= 4 && !d.vamp) out.push(hit('castanet', 3, 0.2), hit('castanet', 7, 0.2));
  return out;
};

// prettier-ignore
export const amsterdam: CityMusic = {
  hold: {
    beatsPerBar: 3, stepsPerBeat: 4, key: 67, tempo: [132, 138],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [I, I, IV, I, V7, V7, I, I], B: [vi, vi, ii, ii, V7, V7, I, V7] },
    oneShot: false, lead: 'organ', harmony: 'organ', chordInst: 'organ', chordSteps: [4, 8],
    bass: 'organ', bassSteps: WALTZ_BASS, rhythms: R12, cadences: C12, glock: false, drums: orgelWaltz,
    melody: {
      // A barrel-organ waltz: a little turn, the jump to the octave, a lilt down the dominant.
      A: [
        [[0, 4, 4], [4, 2, 2], [6, 2, 3], [8, 4, 4]],
        [[0, 8, 7], [8, 4, 4]],
        [[0, 4, 5], [4, 2, 3], [6, 2, 5], [8, 4, 7]],
        [[0, 8, 4], [8, 4, 2]],
        [[0, 4, 6], [4, 2, 8], [6, 2, 7], [8, 4, 6]],
        [[0, 4, 8], [4, 4, 6], [8, 4, 3]],
        [[0, 4, 2], [4, 4, 4], [8, 4, 7]],
        [[0, 12, 7]],
      ],
    },
  },
  march: {
    beatsPerBar: 2, stepsPerBeat: 4, key: 67, tempo: [112, 136],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [I, I, IV, I, V7, V7, I, I], B: [vi, vi, ii, ii, V7, V7, I, V7] },
    nightSections: { A: [i_, i_, iv, i_, V7h, V7h, i_, i_], B: [VI, VI, iv, iv, V7h, V7h, i_, V7h] },
    oneShot: false, lead: 'organ', harmony: 'organ', chordInst: 'organ', chordSteps: [2, 6],
    bass: 'organ', bassSteps: MARCH_BASS,
    rhythms: [[0, 1, 2, 4, 5, 6], [0, 2, 4, 6], [0, 2, 3, 4, 6], [0, 4, 6], [0, 1, 2, 4]],
    cadences: [[0], [0, 4]], glock: true, drums: orgelMarch,
    melody: {
      // Street-organ march: neighbour-note chatter, a bright fanfare up, a skip back home.
      A: [
        [[0, 1, 4], [1, 1, 5], [2, 2, 4], [4, 1, 2], [5, 1, 3], [6, 2, 4]],
        [[0, 2, 7], [2, 2, 4], [4, 4, 2]],
        [[0, 1, 5], [1, 1, 6], [2, 2, 5], [4, 1, 3], [5, 1, 4], [6, 2, 5]],
        [[0, 2, 9], [2, 2, 7], [4, 4, 4]],
        [[0, 1, 6], [1, 1, 7], [2, 2, 8], [4, 1, 6], [5, 1, 7], [6, 2, 8]],
        [[0, 2, 10], [2, 2, 8], [4, 4, 6]],
        [[0, 1, 4], [1, 1, 5], [2, 1, 4], [3, 1, 3], [4, 2, 2], [6, 2, 4]],
        [[0, 2, 7], [2, 2, 4], [4, 4, 0]],
      ],
    },
  },
  fanfare: 'organ',
};
