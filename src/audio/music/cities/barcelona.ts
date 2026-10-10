/**
 * BARCELONA — music: the prep hold is a havanera, the Catalan sailors' song in a lazy 2/4 (the
 * dotted "dum, da-dum-dum" in the bass and the guitar), a minor verse and a major refrain,
 * horn singing, triplets against the beat. The wave march is a rumba catalana in E minor: the
 * guitar's ventilador strum from layer 2, palmas (claps, with the soft off-beat palmas sordas)
 * from the start, the golpe on the guitar body, a trumpet with the tune, the Ministry's snare
 * rolls into every section. Trumpet fanfare. Original melodies (E5).
 */
import {
  C8,
  hit,
  I,
  i_,
  III,
  iv,
  roll,
  V7,
  V7h,
  VI,
  VII,
  type CityMusic,
  type DrumFn,
  type NoteEvent,
} from '../kit';

/** Havanera: the bass drum on the havanera rhythm, a shaker. */
const havaneraDrums: DrumFn = () => [
  hit('kick', 0, 0.2),
  hit('kick', 3, 0.1),
  hit('kick', 4, 0.14),
  hit('kick', 6, 0.12),
  hit('hat', 2, 0.08),
  hit('hat', 6, 0.08),
];

/** Rumba catalana: palmas, golpe, bombo; the Ministry's snare cadence from layer 2. */
const rumbaDrums: DrumFn = (d) => {
  const out: NoteEvent[] = [];
  const last = d.barInSection === d.sectionBars - 1;
  if (d.night) {
    out.push({ step: 0, len: 8, inst: 'timpani', midi: 0, vel: 0.45 });
  } else {
    out.push(hit('kick', 0, 0.7), hit('kick', 6, 0.35), hit('kick', 8, 0.55));
  }
  // Palmas on two and four, palmas sordas on the off-beats.
  out.push(hit('clap', 4, 0.5), hit('clap', 12, 0.55));
  for (const s of [2, 6, 10, 14]) out.push(hit('clap', s, 0.16));
  if (d.vamp || d.layer <= 1) return out;
  // Golpe (the slap on the guitar body) and a shaker.
  out.push(hit('snare', 4, 0.18), hit('snare', 12, 0.2));
  for (let s = 1; s < 16; s += 2) out.push(hit('hat', s, 0.1));
  if (last) out.push(...roll(12, 16, 0.25, d.layer >= 4 ? 0.85 : 0.6));
  if (d.layer >= 3) {
    if (d.barInSection === 0) out.push(hit('cymbal', 0, 0.6));
    out.push(hit('snare', 10, 0.25), hit('snare', 14, 0.25));
  }
  if (d.layer >= 4) {
    if (d.barInSection !== 0) out.push(hit('cymbal', 0, 0.35));
    for (const s of [3, 7, 11]) out.push(hit('clap', s, 0.25));
  }
  return out;
};

// prettier-ignore
export const barcelona: CityMusic = {
  hold: {
    beatsPerBar: 2, stepsPerBeat: 4, key: 62, tempo: [70, 74],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [i_, iv, V7h, i_, VI, iv, V7h, i_], B: [I, I, V7, V7, V7, V7, I, V7h] },
    oneShot: false, lead: 'horn', harmony: 'horn', chordInst: 'pluck', chordSteps: [0, 3, 4, 6],
    bass: 'tuba', bassSteps: [[0, 'root', 2], [3, 'fifth', 1], [4, 'third', 1.5], [6, 'fifth', 1.5]],
    rhythms: [[0, 3, 4, 6], [0, 4, 6], [0, 3, 4], [0, 2, 4, 6]], cadences: C8, glock: false, drums: havaneraDrums,
    melody: {
      // Havanera: a sung line with triplets floating over the dotted bass.
      A: [
        [[0, 3, 4], [3, 1, 3], [4, 4 / 3, 2], [16 / 3, 4 / 3, 3], [20 / 3, 4 / 3, 4]],
        [[0, 3, 7], [3, 1, 5], [4, 4, 3]],
        [[0, 3, 6], [3, 1, 4], [4, 4 / 3, 3], [16 / 3, 4 / 3, 4], [20 / 3, 4 / 3, 6]],
        [[0, 4, 4], [4, 4, 2]],
        [[0, 3, 9], [3, 1, 8], [4, 4 / 3, 7], [16 / 3, 4 / 3, 6], [20 / 3, 4 / 3, 5]],
        [[0, 3, 5], [3, 1, 7], [4, 4, 3]],
        [[0, 3, 4], [3, 1, 6], [4, 4 / 3, 8], [16 / 3, 4 / 3, 6], [20 / 3, 4 / 3, 4]],
        [[0, 4, 2], [4, 4, 0]],
      ],
    },
  },
  march: {
    beatsPerBar: 4, stepsPerBeat: 4, key: 64, tempo: [104, 124],
    form: ['A', 'A', 'B', 'A'],
    sections: { A: [i_, i_, iv, iv, V7h, V7h, i_, i_], B: [III, III, VII, VII, iv, iv, V7h, V7h] },
    oneShot: false, lead: 'trumpet', harmony: 'horn', chordInst: 'pluck', chordSteps: [0, 3, 4, 6, 8, 11, 12, 14],
    bass: 'tuba', bassSteps: [[0, 'root', 3], [6, 'fifth', 2], [8, 'root', 3], [14, 'fifth', 2]],
    rhythms: [[0, 3, 6, 8, 12], [0, 3, 6, 10, 12], [0, 2, 4, 6, 8, 12], [0, 6, 8, 11, 12], [0, 4, 6, 8, 10, 12]],
    cadences: [[0], [0, 8]], glock: false, drums: rumbaDrums,
    melody: {
      // Rumba: three-three-two syncopations, the tune falling onto the beat.
      A: [
        [[0, 3, 4], [3, 3, 4], [6, 2, 5], [8, 2, 4], [10, 2, 2], [12, 4, 0]],
        [[0, 2, 7], [3, 3, 6], [6, 2, 4], [8, 8, 2]],
        [[0, 3, 5], [3, 3, 5], [6, 2, 7], [8, 2, 5], [10, 2, 3], [12, 4, 3]],
        [[0, 2, 7], [3, 3, 8], [6, 2, 7], [8, 8, 5]],
        [[0, 3, 8], [3, 3, 8], [6, 2, 6], [8, 2, 4], [10, 2, 3], [12, 4, 6]],
        [[0, 2, 4], [3, 3, 3], [6, 2, 1], [8, 8, -1]],
        [[0, 3, 0], [3, 3, 2], [6, 2, 4], [8, 2, 7], [10, 2, 6], [12, 4, 4]],
        [[0, 4, 7], [4, 4, 4], [8, 8, 0]],
      ],
    },
  },
  fanfare: 'trumpet',
};
