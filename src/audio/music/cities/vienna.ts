/**
 * VIENNA — music: the prep hold is a Viennese waltz in D (fiddles, horns on the "pah-pah" with
 * the second beat played a hair early, the way Viennese orchestras lean into it); when the
 * waves come it turns into a pompous 2/4 Austrian march in E♭, trumpets and glockenspiel, and
 * from layer 3 the audience claps along on every beat, New Year's concert style. Trumpet
 * fanfare. Original melodies (E5).
 */
import {
  C12,
  hit,
  I,
  i_,
  ii,
  IV,
  iv,
  marchDrums,
  MARCH_BASS,
  R12,
  V7,
  V7h,
  vi,
  VI,
  WALTZ_BASS,
  type CityMusic,
  type DrumFn,
} from '../kit';

/** Waltz brushes on the anticipated second beat; a soft kick on one. */
const wienerDrums: DrumFn = () => [hit('kick', 0, 0.22), hit('hat', 3.5, 0.14), hit('hat', 8, 0.1)];

/** The march, plus the clap-along on every beat from layer 3 (on the off-beats at layer 4). */
const klatschDrums: DrumFn = (d) => {
  const out = marchDrums(d);
  if (d.layer >= 3 && !d.vamp && !d.night) {
    out.push(hit('clap', 0, 0.55), hit('clap', 4, 0.6));
    if (d.layer >= 4) out.push(hit('clap', 2, 0.3), hit('clap', 6, 0.35));
  }
  return out;
};

// prettier-ignore
export const vienna: CityMusic = {
  hold: {
    beatsPerBar: 3, stepsPerBeat: 4, key: 62, tempo: [168, 174],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [I, I, V7, V7, V7, V7, I, I], B: [IV, IV, I, I, ii, V7, I, I] },
    oneShot: false, lead: 'fiddle', harmony: 'fiddle', chordInst: 'horn', chordSteps: [3.5, 8],
    bass: 'tuba', bassSteps: WALTZ_BASS, rhythms: R12, cadences: C12, glock: false, drums: wienerDrums,
    melody: {
      // A sweeping waltz line: a sixth up to the long note, the leap to the seventh, falling back.
      A: [
        [[0, 8, 2], [8, 4, 4]],
        [[0, 12, 9]],
        [[0, 8, 6], [8, 4, 8]],
        [[0, 12, 10]],
        [[0, 8, 9], [8, 4, 8]],
        [[0, 4, 6], [4, 4, 8], [8, 4, 10]],
        [[0, 8, 9], [8, 4, 7]],
        [[0, 12, 7]],
      ],
    },
  },
  march: {
    beatsPerBar: 2, stepsPerBeat: 4, key: 63, tempo: [112, 134],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [I, vi, ii, V7, I, IV, V7, I], B: [IV, IV, I, I, V7, V7, I, V7] },
    nightSections: { A: [i_, VI, iv, V7h, i_, iv, V7h, i_], B: [iv, iv, i_, i_, V7h, V7h, i_, V7h] },
    oneShot: false, lead: 'trumpet', harmony: 'horn', chordInst: 'horn', chordSteps: [2, 6],
    bass: 'tuba', bassSteps: MARCH_BASS,
    rhythms: [[0, 3, 4, 6], [0, 2, 4, 6], [0, 4, 6], [0, 3, 4, 7], [0, 2, 3, 4]],
    cadences: [[0], [0, 4]], glock: true, drums: klatschDrums,
    melody: {
      // Dotted fanfare up the tonic, a bow to the relative minor, a proud climb back.
      A: [
        [[0, 3, 4], [3, 1, 2], [4, 2, 4], [6, 2, 7]],
        [[0, 3, 9], [3, 1, 8], [4, 4, 7]],
        [[0, 3, 8], [3, 1, 7], [4, 2, 5], [6, 2, 3]],
        [[0, 4, 4], [4, 4, 6]],
        [[0, 3, 4], [3, 1, 2], [4, 2, 4], [6, 2, 7]],
        [[0, 2, 10], [2, 2, 8], [4, 2, 7], [6, 2, 5]],
        [[0, 2, 6], [2, 2, 8], [4, 2, 4], [6, 2, 6]],
        [[0, 2, 7], [2, 2, 4], [4, 4, 0]],
      ],
    },
  },
  fanfare: 'trumpet',
};
