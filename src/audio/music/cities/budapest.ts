/**
 * BUDAPEST — music: a csárdás. The prep hold is the slow *lassú* in D "Hungarian" minor (the
 * augmented second F–G♯ over the tonic), fiddle over cimbalom; the wave march is the *friss*,
 * a running 2/4 fiddle tune over the cimbalom's offbeat "esz-tam", whose tempo range is the
 * widest of any city (120 → 166 bpm) so it accelerates with the crowd, like a real friss.
 * Layer 3 adds boot-slaps (claps) on the offbeats. Fiddle fanfare. Original melodies (E5).
 */
import {
  chord,
  choraleDrums,
  HARMONIC,
  hit,
  iv,
  MARCH_BASS,
  marchDrums,
  POMP_BASS,
  III,
  V7h,
  VII,
  VI,
  type CityMusic,
  type DrumFn,
} from '../kit';

/** Hungarian (gypsy) minor: D E F G♯ A B♭ C♯. */
const HUNGARIAN = [0, 2, 3, 6, 7, 8, 11] as const;
/** Tonic chord whose melody scale is the Hungarian minor. */
const hi = chord(0, 'm', HUNGARIAN);
/** iv with the harmonic-minor scale (natural G, so the melody can lean on it). */
const hiv = chord(5, 'm', HARMONIC);
/** ♯iv°: the leading diminished chord into the dominant. */
const dim = chord(6, 'd', HUNGARIAN);

/** Friss: the march plus boot-slaps (claps) on the offbeats from layer 3. */
const frissDrums: DrumFn = (d) => {
  const out = marchDrums(d);
  if (d.layer >= 3 && !d.vamp) {
    out.push(hit('clap', 2, 0.35), hit('clap', 6, 0.45));
    if (d.barInSection % 2 === 1) out.push(hit('clap', 7, 0.3));
  }
  return out;
};

// prettier-ignore
export const budapest: CityMusic = {
  hold: {
    beatsPerBar: 4, stepsPerBeat: 4, key: 62, tempo: [66, 70],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [hi, hiv, hi, V7h, hi, hiv, V7h, hi], B: [III, VII, III, V7h, hiv, hi, dim, V7h] },
    oneShot: false, lead: 'fiddle', harmony: 'fiddle', chordInst: 'cimbalom', chordSteps: [0, 8],
    bass: 'tuba', bassSteps: POMP_BASS,
    rhythms: [[0, 1, 4, 8, 12], [0, 6, 8, 12], [0, 1, 4, 8], [0, 4, 8, 9, 12], [0, 8, 10, 12]],
    cadences: [[0], [0, 8]], glock: false, drums: choraleDrums,
    melody: {
      // Lassú: lombardic short–long sighs, the augmented second, a long dominant.
      A: [
        [[0, 1, 7], [1, 3, 6], [4, 4, 7], [8, 2, 4], [10, 2, 5], [12, 4, 4]],
        [[0, 1, 5], [1, 3, 4], [4, 2, 3], [6, 2, 2], [8, 8, 3]],
        [[0, 1, 2], [1, 3, 3], [4, 4, 4], [8, 2, 5], [10, 2, 4], [12, 4, 3]],
        [[0, 6, 4], [6, 2, 3], [8, 8, 1]],
        [[0, 1, 7], [1, 3, 6], [4, 4, 7], [8, 2, 9], [10, 2, 8], [12, 4, 7]],
        [[0, 4, 10], [4, 4, 9], [8, 4, 8], [12, 4, 7]],
        [[0, 2, 6], [2, 2, 8], [4, 4, 7], [8, 4, 6], [12, 4, 4]],
        [[0, 2, 3], [2, 2, 4], [4, 12, 0]],
      ],
    },
  },
  march: {
    beatsPerBar: 2, stepsPerBeat: 4, key: 62, tempo: [120, 166],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [hi, hi, V7h, V7h, V7h, V7h, hi, hi], B: [III, VII, III, VII, iv, hi, V7h, hi] },
    nightSections: { A: [hi, hi, V7h, V7h, V7h, V7h, hi, hi], B: [VI, VII, VI, VII, hiv, hi, V7h, hi] },
    oneShot: false, lead: 'fiddle', harmony: 'cimbalom', chordInst: 'cimbalom', chordSteps: [2, 6],
    bass: 'tuba', bassSteps: MARCH_BASS,
    rhythms: [[0, 1, 2, 3, 4, 6], [0, 2, 4, 5, 6, 7], [0, 1, 2, 4, 6], [0, 2, 3, 4, 6], [0, 1, 2, 3, 4, 5, 6, 7]],
    cadences: [[0], [0, 4], [0, 2, 4]], glock: false, drums: frissDrums,
    melody: {
      // Friss: running sixteenths with the G♯–A turn, an arpeggio up the dominant and back.
      A: [
        [[0, 1, 4], [1, 1, 3], [2, 1, 4], [3, 1, 5], [4, 2, 4], [6, 2, 7]],
        [[0, 1, 7], [1, 1, 6], [2, 1, 5], [3, 1, 4], [4, 1, 3], [5, 1, 4], [6, 2, 2]],
        [[0, 2, 8], [2, 1, 7], [3, 1, 6], [4, 2, 4], [6, 2, 1]],
        [[0, 1, 6], [1, 1, 4], [2, 1, 3], [3, 1, 1], [4, 4, -1]],
        [[0, 2, 8], [2, 1, 7], [3, 1, 6], [4, 1, 7], [5, 1, 8], [6, 2, 10]],
        [[0, 1, 10], [1, 1, 8], [2, 1, 6], [3, 1, 4], [4, 2, 3], [6, 2, 1]],
        [[0, 1, 2], [1, 1, 3], [2, 1, 4], [3, 1, 6], [4, 2, 7], [6, 1, 6], [7, 1, 7]],
        [[0, 2, 7], [2, 1, 4], [3, 1, 2], [4, 4, 0]],
      ],
    },
  },
  fanfare: 'fiddle',
};
