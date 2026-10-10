import { describe, expect, it } from 'vitest';
import {
  allStyles,
  composeSection,
  degToMidi,
  generateBar,
  layerFor,
  musicIntensity,
  pickupBar,
  sectionChords,
  snapToChord,
  stepsPerBar,
  styleFor,
  tempoFor,
  type BarRequest,
} from '../src/audio/music/patterns';
import { INST_IDS, PERCUSSION } from '../src/audio/music/instruments';

const melodic = (inst: string): boolean => !PERCUSSION.has(inst as never) && inst !== 'timpani';

describe('music pattern generation', () => {
  it('is deterministic for the same inputs', () => {
    for (const st of allStyles()) {
      for (const section of new Set(st.form)) {
        const a = composeSection(st, section, 7, false);
        const b = composeSection(st, section, 7, false);
        expect(a).toEqual(b);
        const req: BarRequest = { style: st, section, barInSection: 2, layer: 3, night: false, seed: 7 };
        expect(generateBar(req)).toEqual(generateBar({ ...req }));
      }
    }
  });

  it('different seeds give different generated tunes', () => {
    const st = styleFor('march', 'ministry');
    const a = JSON.stringify(composeSection(st, 'A', 1, false));
    const b = JSON.stringify(composeSection(st, 'A', 2, false));
    expect(a).not.toEqual(b);
  });

  it('produces valid bars for every style, section, layer and night', () => {
    for (const st of allStyles()) {
      const steps = stepsPerBar(st);
      for (const section of new Set(st.form)) {
        const chords = sectionChords(st, section, false);
        for (let bar = 0; bar < chords.length; bar++) {
          for (const layer of [1, 2, 3, 4]) {
            for (const night of [false, true]) {
              const plan = generateBar({ style: st, section, barInSection: bar, layer, night, seed: 3 });
              expect(plan.steps).toBe(steps);
              for (const n of plan.notes) {
                expect(INST_IDS).toContain(n.inst);
                expect(n.step).toBeGreaterThanOrEqual(0);
                expect(n.step).toBeLessThan(steps);
                expect(n.len).toBeGreaterThan(0);
                expect(n.vel).toBeGreaterThan(0);
                expect(n.vel).toBeLessThanOrEqual(1);
                if (melodic(n.inst)) {
                  expect(n.midi).toBeGreaterThanOrEqual(24);
                  expect(n.midi).toBeLessThanOrEqual(100);
                }
              }
            }
          }
        }
      }
    }
  }, 30_000); // ~100k notes for 12 cities × 4 themes (E5): slow under a loaded CI box

  it('melody notes belong to the bar chord-scale; strong beats are chord tones', () => {
    for (const st of allStyles()) {
      for (const section of new Set(st.form)) {
        const mel = composeSection(st, section, 11, false);
        const chords = sectionChords(st, section, false);
        mel.forEach((bar, b) => {
          const ch = chords[b]!;
          for (const n of bar) {
            const pc = (((degToMidi(n.deg, st.key, ch.scale) - st.key) % 12) + 12) % 12;
            expect(ch.scale.map((x) => x % 12)).toContain(pc);
            if (n.step % st.stepsPerBeat === 0 && !st.melody) expect(ch.tones).toContain(pc);
          }
        });
      }
    }
  });

  it('generated sections end on the tonic (or a chord tone of a turnaround chord)', () => {
    for (const st of allStyles()) {
      if (st.melody) continue;
      for (const section of new Set(st.form)) {
        const mel = composeSection(st, section, 5, false);
        const last = mel.at(-1)!.at(-1)!;
        const ch = sectionChords(st, section, false).at(-1)!;
        if (ch.tones.includes(0)) expect([0, 7]).toContain(last.deg);
        else {
          const pc = (((degToMidi(last.deg, st.key, ch.scale) - st.key) % 12) + 12) % 12;
          expect(ch.tones).toContain(pc);
        }
      }
    }
  });

  it('higher layers add instruments (escalation)', () => {
    const st = styleFor('march', 'london');
    const count = (layer: number): number =>
      generateBar({ style: st, section: 'A', barInSection: 1, layer, night: false, seed: 1 }).notes.length;
    expect(count(2)).toBeGreaterThan(count(1));
    expect(count(3)).toBeGreaterThan(count(2));
    expect(count(4)).toBeGreaterThan(count(3));
    const insts = (layer: number): Set<string> =>
      new Set(generateBar({ style: st, section: 'A', barInSection: 0, layer, night: false, seed: 1 }).notes.map((n) => n.inst));
    expect(insts(4).has('chip')).toBe(true);
    expect(insts(1).has('chip')).toBe(false);
  });

  it('vamp (breather) has no lead melody', () => {
    const st = styleFor('march', 'ministry');
    const plan = generateBar({ style: st, section: 'A', barInSection: 0, layer: 4, night: false, seed: 1, vamp: true });
    expect(plan.notes.some((n) => n.inst === st.lead)).toBe(false);
    expect(plan.notes.some((n) => n.inst === 'tuba')).toBe(true);
  });

  it('city flavours use their signature instruments', () => {
    expect(styleFor('march', 'paris').lead).toBe('accordion');
    expect(styleFor('march', 'madrid').drums).toBeDefined();
    const madrid = generateBar({ style: styleFor('march', 'madrid'), section: 'A', barInSection: 0, layer: 2, night: false, seed: 1 });
    expect(madrid.notes.some((n) => n.inst === 'castanet')).toBe(true);
    expect(styleFor('hold', 'ministry').lead).toBe('vibes');
    expect(styleFor('hold', 'ministry').beatsPerBar).toBe(3); // the elevator waltz
  });

  it('tempo, layers and intensity are monotonic and bounded', () => {
    const st = styleFor('march', 'ministry');
    expect(tempoFor(st, 1, false)).toBeGreaterThan(tempoFor(st, 0, false));
    expect(tempoFor(st, 1, true)).toBeLessThan(tempoFor(st, 1, false));
    expect(layerFor(0)).toBe(1);
    expect(layerFor(1)).toBe(4);
    expect(musicIntensity(0, 0)).toBeGreaterThanOrEqual(0);
    expect(musicIntensity(10, 5000)).toBeLessThanOrEqual(1);
    expect(musicIntensity(5, 300)).toBeGreaterThan(musicIntensity(2, 300));
    expect(musicIntensity(5, 3000)).toBeGreaterThan(musicIntensity(5, 30));
  });

  it('pickup bar is a snare roll with a bass walk-up', () => {
    const p = pickupBar(styleFor('march', 'ministry'));
    expect(p.notes.filter((n) => n.inst === 'snare').length).toBeGreaterThan(8);
    expect(p.notes.some((n) => n.inst === 'tuba')).toBe(true);
  });

  it('snapToChord finds chord tones', () => {
    const st = styleFor('march', 'ministry');
    const ch = sectionChords(st, 'A', false)[0]!;
    for (let d = -3; d < 12; d++) {
      const s = snapToChord(d, ch);
      const pc = (((degToMidi(s, st.key, ch.scale) - st.key) % 12) + 12) % 12;
      expect(ch.tones).toContain(pc);
      expect(Math.abs(s - d)).toBeLessThanOrEqual(3);
    }
  });
});
