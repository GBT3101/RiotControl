/**
 * BERLIN — music: the prep hold is a smoky Weimar-cabaret foxtrot in A minor (clarinet, bar-room
 * e-piano on two and four, brushes). The wave march starts as a stiff Prussian march in F
 * (brass, dotted fanfares, snare) and, as the crowd grows, the club takes over: layer 3 brings
 * the four-on-the-floor kick, the off-beat hats, a backbeat clap and an off-beat bass pedal under
 * the march; at layer 4 the snare cadence is gone, sixteenth hats and an acid riff drive it at
 * techno tempo, and only the march tune and the snare rolls into each section are left of
 * Prussia. That's the joke. Brass fanfare. Original melodies (E5).
 */
import {
  C16,
  hit,
  I,
  i_,
  III,
  IV,
  iv,
  MARCH_BASS,
  marchDrums,
  POMP_BASS,
  roll,
  V7,
  V7h,
  Vh,
  VI,
  type CityMusic,
  type DrumFn,
  type NoteEvent,
} from '../kit';

const MARCH_KEY = 65;
/** The acid riff (semitones over the tonic, one per sixteenth). */
const ACID = [0, 0, 12, 0, 7, 0, 10, 12] as const;

/** Prussian march → techno. */
const berlinDrums: DrumFn = (d) => {
  if (d.layer <= 2 || d.vamp) return marchDrums(d);
  const last = d.barInSection === d.sectionBars - 1;
  const pedal = (step: number, vel: number): NoteEvent => ({ step, len: 1.4, inst: 'tuba', midi: MARCH_KEY - 24, vel });
  if (d.layer === 3) {
    // The pulse arrives under the march.
    const out = marchDrums(d);
    out.push(hit('kick', 0, 0.85), hit('kick', 4, 0.85));
    out.push(hit('hat', 2, 0.32), hit('hat', 6, 0.32), hit('clap', 4, 0.4));
    out.push(pedal(2, 0.5), pedal(6, 0.5));
    return out;
  }
  // Layer 4: the club.
  const out: NoteEvent[] = [hit('kick', 0, 0.95), hit('kick', 4, 0.95), hit('clap', 4, 0.5)];
  for (let s = 0; s < 8; s++) out.push(hit('hat', s, s % 2 ? 0.34 : 0.14));
  if (d.barInSection % 4 === 0) out.push(hit('cymbal', 0, 0.45));
  out.push(pedal(2, 0.6), pedal(6, 0.6));
  ACID.forEach((o, s) => out.push({ step: s, len: 0.7, inst: 'chip', midi: MARCH_KEY - 12 + o, vel: s % 2 ? 0.3 : 0.45 }));
  if (last) out.push(...roll(4, 8, 0.25, 0.8));
  return out;
};

/** Cabaret brushes: soft kick on one and three, brush and hat on two and four. */
const cabaretDrums: DrumFn = () => [
  hit('kick', 0, 0.25),
  hit('kick', 8, 0.18),
  hit('snare', 4, 0.1),
  hit('snare', 12, 0.1),
  hit('hat', 4, 0.12),
  hit('hat', 12, 0.12),
  hit('hat', 14, 0.07),
];

// prettier-ignore
export const berlin: CityMusic = {
  hold: {
    beatsPerBar: 4, stepsPerBeat: 4, key: 69, tempo: [84, 88],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [i_, VI, iv, V7h, i_, VI, V7h, i_], B: [III, III, iv, i_, VI, iv, V7h, V7h] },
    oneShot: false, lead: 'clarinet', harmony: 'clarinet', chordInst: 'epiano', chordSteps: [4, 12],
    bass: 'tuba', bassSteps: POMP_BASS,
    rhythms: [[0, 6, 8, 12], [0, 3, 4, 8, 12], [0, 8, 11, 12], [0, 4, 6, 8], [0, 3, 6, 8, 12], [0, 12, 14]],
    cadences: C16, glock: false, drums: cabaretDrums,
  },
  march: {
    beatsPerBar: 2, stepsPerBeat: 4, key: MARCH_KEY, tempo: [116, 136],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [I, I, V7, V7, I, IV, V7, I], B: [IV, IV, I, I, V7, V7, I, V7] },
    nightSections: { A: [i_, i_, V7h, V7h, i_, iv, V7h, i_], B: [iv, iv, i_, i_, Vh, V7h, i_, V7h] },
    oneShot: false, lead: 'brass', harmony: 'horn', chordInst: 'horn', chordSteps: [2, 6],
    bass: 'tuba', bassSteps: MARCH_BASS,
    rhythms: [[0, 3, 4, 7], [0, 2, 4, 6], [0, 4], [0, 3, 4, 6], [0, 2, 4]],
    cadences: [[0], [0, 4]], glock: true, drums: berlinDrums,
    melody: {
      // Dotted Prussian fanfare: up to the octave, down the dominant, a stiff bow and home.
      A: [
        [[0, 3, 4], [3, 1, 4], [4, 3, 7], [7, 1, 7]],
        [[0, 2, 9], [2, 2, 7], [4, 2, 4], [6, 2, 2]],
        [[0, 3, 8], [3, 1, 8], [4, 3, 6], [7, 1, 6]],
        [[0, 2, 8], [2, 2, 10], [4, 4, 8]],
        [[0, 3, 4], [3, 1, 4], [4, 3, 7], [7, 1, 7]],
        [[0, 2, 10], [2, 2, 9], [4, 2, 7], [6, 2, 5]],
        [[0, 2, 6], [2, 1, 7], [3, 1, 8], [4, 2, 4], [6, 2, 6]],
        [[0, 2, 7], [2, 2, 4], [4, 4, 0]],
      ],
    },
  },
  fanfare: 'brass',
};
