/**
 * M10 writing: every string is non-empty, uses only glyphs the bitmap fonts have, and fits its
 * UI slot (advisor bubble, alert card, tooltip, dossier, newspaper deck, closing line).
 */
import { describe, expect, it } from 'vitest';
import { FONTS, measureText } from '../src/art/uikit/text';
import { PROTESTERS } from '../src/data/protesters';
import { UNIT_ORDER } from '../src/data/units';
import { PLAYABLE_CITIES, loadMap } from '../src/maps';
import { citiesOf } from '../src/maps/cityTable';
import { TUTORIAL_CITY } from '../src/ui/campaign';
import { capitolChoke } from '../src/ui/tutorial/geometry';
import {
  CAPITOL_COPY,
  CITY_COPY,
  OWN_COPY,
  CREDITS,
  DEFEAT_CLOSERS,
  FIRST_WAVE_LINE,
  HINT_TEXT,
  IDLE_QUIPS,
  LEVEL_BLURBS,
  PROTESTER_COPY,
  TIPS,
  TUTORIAL_TEXT,
  TUTORIAL_UI,
  UI_TEXT,
  UNIT_COPY,
  VICTORY_CLOSERS,
  WAVE_LINES,
  closingLine,
  fillTutorial,
  pickVariant,
  waveLine,
} from '../src/ui/strings';

const GLYPHS = new Set([...FONTS.small.glyphs.keys(), ' ', '\n']);

function check(label: string, s: string, maxLen: number): void {
  expect(s.trim().length, `${label} empty`).toBeGreaterThan(0);
  expect(s.length, `${label} too long (${s.length} > ${maxLen}): ${s}`).toBeLessThanOrEqual(maxLen);
  for (const ch of s)
    expect(GLYPHS.has(ch), `${label}: unsupported glyph "${ch}" in ${s}`).toBe(true);
}

/** Advisor bubble text widths: desktop (190-px bubble) and portrait phone (150-px bubble). */
const BUBBLE_DESKTOP = 176;
const BUBBLE_PORTRAIT = 136;

function advisorLine(label: string, s: string): void {
  check(label, s, 86);
  expect(
    measureText(FONTS.mono, s, BUBBLE_DESKTOP).lines.length,
    `${label}: >3 lines`,
  ).toBeLessThanOrEqual(3);
  expect(
    measureText(FONTS.mono, s, BUBBLE_PORTRAIT).lines.length,
    `${label}: >5 lines`,
  ).toBeLessThanOrEqual(5);
}

/**
 * `{choke}` of every playable city: the chokepoint nearest its Capitol steps (the briefing runs
 * in Budapest, but `?tutorial=1` can force it anywhere).
 */
const CHOKES = PLAYABLE_CITIES.map((c) => capitolChoke(loadMap(c))?.name ?? '');

describe('writing: tutorial & hints (advisor bubbles)', () => {
  it('tutorial lines fit the bubble (with every chokepoint name)', () => {
    for (const [id, lines] of Object.entries(TUTORIAL_TEXT))
      for (const l of lines)
        for (const choke of l.text.includes('{choke}') || l.touch?.includes('{choke}')
          ? CHOKES
          : ['']) {
          advisorLine(`tutorial.${id} (${choke})`, fillTutorial(l.text, { choke, city: 'Madrid' }));
          if (l.touch)
            advisorLine(`tutorial.${id}.touch (${choke})`, fillTutorial(l.touch, { choke }));
        }
    advisorLine('skipped', TUTORIAL_UI.skipped);
    check('skip', TUTORIAL_UI.skip, 16);
  });

  it('the Budapest briefing points at Alkotmány utca', () => {
    expect(capitolChoke(loadMap(TUTORIAL_CITY))?.name).toBe('Alkotmány utca');
  });

  it('hint lines, quips, level blurbs and Capitol reactions fit', () => {
    for (const [id, h] of Object.entries(HINT_TEXT)) {
      advisorLine(`hint.${id}`, h.text);
      if (h.touch) advisorLine(`hint.${id}.touch`, h.touch);
    }
    for (const q of IDLE_QUIPS) advisorLine('quip', q);
    for (let l = 1; l <= 10; l++) advisorLine(`level${l}`, LEVEL_BLURBS[l]!.text);
    for (let s = 1; s <= 5; s++) {
      const c = CAPITOL_COPY[s]!;
      advisorLine(`capitol${s}`, c.minister);
      check(`capitol${s}.title`, c.title, 28);
      check(`capitol${s}.line`, c.line, 64);
    }
  });
});

describe('writing: cities', () => {
  it('every city has a voice and paper variants', () => {
    for (const c of citiesOf(OWN_COPY)) {
      const cc = CITY_COPY[c];
      check(`${c}.tagline`, cc.tagline, 40);
      advisorLine(`${c}.welcome`, cc.welcome);
      expect(cc.victoryDecks.length).toBeGreaterThanOrEqual(3);
      expect(cc.defeatDecks.length).toBeGreaterThanOrEqual(3);
      for (const d of [...cc.victoryDecks, ...cc.defeatDecks]) {
        check(`${c}.deck`, d, 96);
        // ≤ 2 lines under the headline on a 300-px page.
        expect(measureText(FONTS.small, d, 276).lines.length, d).toBeLessThanOrEqual(2);
      }
      expect(cc.flavour.length).toBeGreaterThanOrEqual(3);
      for (const f of cc.flavour) advisorLine(`${c}.flavour`, f);
    }
  });

  it('pickVariant is deterministic and in range', () => {
    const l = ['a', 'b', 'c'];
    expect(pickVariant(l, 4)).toBe('b');
    expect(pickVariant(l, -7.5)).toBe(l[1]);
  });
});

describe('writing: units, protesters, moments', () => {
  it('11 unit cards with role, quip, dossier notes and footnote', () => {
    expect(UNIT_ORDER.length).toBe(11);
    for (const u of UNIT_ORDER) {
      const c = UNIT_COPY[u];
      check(`${u}.role`, c.role, 48);
      check(`${u}.quip`, c.quip, 60);
      check(`${u}.footnote`, c.footnote, 24);
      const notes = c.notes.split('\n');
      expect(notes.length).toBeLessThanOrEqual(3);
      for (const n of notes) {
        check(`${u}.notes`, n, 19);
        expect(measureText(FONTS.mono, n).w).toBeLessThanOrEqual(114);
      }
    }
  });

  it('a codex line for all 9 protester types', () => {
    const ids = PROTESTERS.map((p) => p.id);
    expect(ids.length).toBe(9);
    for (const p of ids) {
      const line = PROTESTER_COPY[p as keyof typeof PROTESTER_COPY].line;
      check(`codex.${p}`, line, 64);
      // Alert card body: ≤ 3 lines at ~150 px.
      expect(measureText(FONTS.small, line, 150).lines.length).toBeLessThanOrEqual(3);
    }
    expect(PROTESTER_COPY.cultist.line).toContain('Order of the Final Hour');
  });

  it('wave lines, closers and UI copy', () => {
    for (const w of [...WAVE_LINES, FIRST_WAVE_LINE]) check('wave', w, 40);
    for (let n = 1; n < 40; n++) expect(WAVE_LINES.concat(FIRST_WAVE_LINE)).toContain(waveLine(n));
    expect(VICTORY_CLOSERS[0]).toBe('You kept order. But at what cost?');
    for (const c of [...VICTORY_CLOSERS, ...DEFEAT_CLOSERS]) {
      check('closer', c, 42);
      // Splits at ". " into two typewriter lines of ≤ 34 chars on phones.
      const k = c.indexOf('. ');
      expect(k).toBeGreaterThan(0);
      expect(c.slice(0, k + 1).length).toBeLessThanOrEqual(34);
      expect(c.slice(k + 2).length).toBeLessThanOrEqual(34);
    }
    const seen = new Set<string>();
    let canon = 0;
    for (let s = 0; s < 40; s++) {
      const v = closingLine(true, s);
      seen.add(v);
      if (v === VICTORY_CLOSERS[0]) canon++;
    }
    expect(canon).toBe(20);
    expect(seen.size).toBe(VICTORY_CLOSERS.length);
    for (const [k, v] of Object.entries(UI_TEXT))
      if (typeof v === 'string') check(`ui.${k}`, v, 72);
    check('ui.notEnoughHate', UI_TEXT.notEnoughHate(1000), 32);
    for (const [a, b] of CREDITS) {
      check('credits', a, 20);
      check('credits', b, 72);
    }
  });

  it('at least 30 tips, each ≤ 3 lines on the loading screen', () => {
    expect(TIPS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(TIPS).size).toBe(TIPS.length);
    for (const t of TIPS) {
      check('tip', t, 120);
      expect(measureText(FONTS.small, t, 220).lines.length, t).toBeLessThanOrEqual(3);
    }
  });
});
