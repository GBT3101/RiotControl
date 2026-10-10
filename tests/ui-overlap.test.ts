/**
 * No stamp, title, badge or label may cover text (playtest round 2): every layout that places a
 * decoration near text exposes its boxes, and these tests assert no overlaps for the longest
 * real strings at phone portrait / landscape and desktop sizes.
 */
import { describe, expect, it } from 'vitest';
import { rubberStamp } from '../src/art/uikit/banners';
import { stampButton } from '../src/art/uikit/buttons';
import { FONTS, measureText } from '../src/art/uikit/text';
import { ministerAnims } from '../src/art/uikit/portraits';
import { advisorLayout } from '../src/ui/widgets/advisor';
import {
  CITY_COPY,
  HINT_TEXT,
  IDLE_QUIPS,
  LEVEL_BLURBS,
  TUTORIAL_TEXT,
  TUTORIAL_UI,
  UI_TEXT,
  UNIT_COPY,
  fillTutorial,
} from '../src/ui/strings';
import { firstOverlap, inside, overlaps, type Box } from '../src/ui/core/boxes';
import { frontPageLayout } from '../src/art/uikit/newspaper';
import { paperHeight } from '../src/ui/screens/end';
import { formatDuration, formatNumber } from '../src/ui/records';
import { pauseLayout } from '../src/ui/screens/pause';
import { infoPanelLayout } from '../src/ui/hud/infoPanel';
import { UNITS, UNIT_IDS } from '../src/data/units';
import { fitCount, topBarButtonSize, topBarLayout } from '../src/ui/hud/topBar';
import { NO_INSETS, computeHudLayout } from '../src/ui/layout';

/** Phone portrait (390, 360 and 320 CSS px wide), landscape, desktop, full HD, tiny (UI px). */
export const SCREENS: Array<[number, number]> = [
  [234, 506],
  [216, 468],
  [213, 461],
  [506, 234],
  [480, 300],
  [640, 360],
  [195, 422],
];

describe('pause dossier', () => {
  it('the PAUSED stamp never covers the run summary or the buttons', () => {
    const st = rubberStamp('PAUSED', 'navy2', { tilt: -0.05, seed: 2 });
    const btn = stampButton('QUIT TO TITLE', 120, 'normal');
    for (const [wave, level, legit, time] of [
      [0, 0, 0, 0],
      [16, 4, 100, 61],
      [99, 10, 4999, 3600 * 9 + 59 * 60 + 59],
    ] as const) {
      const lines = [
        `WAVE ${wave} · LEVEL ${level}`,
        `${formatNumber(legit)} LEGIT · ${formatDuration(time)}`,
      ];
      const l = pauseLayout(lines, st, btn.w, btn.h, 4);
      const boxes: Record<string, { x: number; y: number; w: number; h: number }> = {
        stamp: l.stamp,
      };
      l.lines.forEach((b, k) => (boxes[`line${k}`] = b));
      l.buttons.forEach((b, k) => (boxes[`button${k}`] = b));
      expect(firstOverlap(boxes), lines.join(' / ')).toBe(null);
      const paper = { x: 0, y: 10, w: l.w, h: l.h - 10 };
      for (const [k, b] of Object.entries(boxes)) expect(inside(b, paper, 2), k).toBe(true);
      expect(overlaps(l.stamp, { x: 0, y: 0, w: l.w, h: 12 }), 'tab').toBe(false);
    }
  });
});

/** Every line the Minister can say (tutorial, hints, idle quips, city flavour, blurbs). */
export function advisorLines(): string[] {
  const out: string[] = [];
  const vars = { choke: 'Carrera de San Jerónimo y Alcalá', city: 'Madrid' };
  for (const step of Object.values(TUTORIAL_TEXT))
    for (const l of step) for (const t of [l.text, l.touch]) if (t) out.push(fillTutorial(t, vars));
  for (const l of Object.values(HINT_TEXT)) out.push(l.text, ...(l.touch ? [l.touch] : []));
  out.push(...IDLE_QUIPS, TUTORIAL_UI.skipped);
  for (const c of Object.values(CITY_COPY)) out.push(c.welcome, ...c.flavour);
  for (const b of Object.values(LEVEL_BLURBS)) out.push(b.text);
  out.push("Every fallen officer makes us MORE legitimate. Isn't democracy beautiful?");
  return out;
}

describe('advisor bubble', () => {
  it('the name plate, portrait and "more" triangle never cover a line of text', () => {
    const plate = measureText(FONTS.smallBold, 'THE MINISTER').w + 12;
    const boxH = ministerAnims().idle[0]!.h + 10;
    for (const maxW of [186, 200, 226, 300, 472, 498, 632])
      for (const text of advisorLines()) {
        const g = advisorLayout({ x: 4, bottom: 180, maxW, text, plateW: plate, boxH });
        const msg = `${maxW}: ${text}`;
        expect(overlaps(g.plate, g.text), msg).toBe(false);
        expect(overlaps(g.box, g.text), msg).toBe(false);
        expect(overlaps(g.hint, g.text), msg).toBe(false);
        expect(overlaps(g.plate, g.box) && g.plateOnBubble, msg).toBe(false);
        expect(inside(g.text, g.bubble, 2), msg).toBe(true);
        expect(inside(g.hint, g.bubble, 1), msg).toBe(true);
        expect(g.bubble.x + g.bubble.w, msg).toBeLessThanOrEqual(4 + Math.max(maxW, 178));
      }
  });
});

describe('newspaper front page', () => {
  it('the APPROVED / DENIED stamp lands on blank newsprint, never on a line of text', () => {
    for (const city of ['madrid', 'london', 'paris'] as const)
      for (const victory of [true, false]) {
        const st = rubberStamp(victory ? 'APPROVED' : 'DENIED', 'green2', { tilt: -0.1 });
        const headline = victory ? UI_TEXT.victoryHeadline : UI_TEXT.defeatHeadline;
        const decks = victory ? CITY_COPY[city].victoryDecks : CITY_COPY[city].defeatDecks;
        for (const deck of decks)
          for (const [w, maxH] of [
            [222, 474],
            [288, 202],
            [300, 268],
            [280, 330],
          ] as const) {
            const h = paperHeight(city, headline, deck, w, maxH, st);
            const l = frontPageLayout(city, headline, deck, w, h, st);
            const msg = `${city} ${w}x${h} ${deck}`;
            const boxes: Record<string, Box> = {
              masthead: l.masthead,
              deck: l.deck,
              photo: l.photo,
            };
            l.headline.forEach((b, k) => (boxes[`headline${k}`] = b));
            l.columns.forEach((b, k) => (boxes[`column${k}`] = b));
            for (const [k, b] of Object.entries(boxes)) {
              expect(overlaps(l.stamp!, b), `${msg}: stamp × ${k}`).toBe(false);
              expect(b.x >= 0 && b.x + b.w <= w, `${msg}: ${k} in page`).toBe(true);
            }
            expect(inside(l.stamp!, { x: 0, y: 0, w, h }, 2), msg).toBe(true);
            expect(l.photo.y + l.photo.h, msg).toBeLessThanOrEqual(h - 8);
            if (maxH >= 260) expect(l.photo.h, msg).toBeGreaterThanOrEqual(40);
          }
      }
  });
});

describe('top bar', () => {
  it('every counter has room for its longest text and no piece touches the next', () => {
    const widest = (...s: string[]) => Math.max(...s.map((t) => measureText(FONTS.smallBold, t).w));
    for (const [W, H] of SCREENS)
      for (const touch of [false, true]) {
        const l = computeHudLayout(W, H, NO_INSETS, { touch });
        const big = topBarButtonSize(l, touch) === 'lg';
        const [bw, bh] = big ? [22, 24] : [18, 20];
        const s = topBarLayout(l, bw, bh);
        const msg = `${W}x${H} button ${bw}`;
        expect(s.hate.maxW, msg).toBeGreaterThanOrEqual(widest('9999', '12.3k', '999k'));
        expect(s.wave.maxW, msg).toBeGreaterThanOrEqual(widest('24s', 'W100', 'PREP'));
        if (W >= 234)
          expect(s.wave.maxW, msg).toBeGreaterThanOrEqual(widest('NEXT 24s', 'WAVE 100'));
        expect(s.crowd.maxW, msg).toBeGreaterThanOrEqual(widest('9999', '12.3k'));
        if (l.topRows === 1) expect(s.crowd.maxW, msg).toBeGreaterThanOrEqual(widest('2,450'));
        const lab = (x: { x: number; y: number; maxW: number }) => ({
          x: x.x,
          y: x.y,
          w: x.maxW,
          h: 7,
        });
        const boxes: Record<string, Box> = {
          hateIcon: { ...s.hateIcon, w: 13, h: 13 },
          hate: lab(s.hate),
          legit: { ...s.legit, h: 18 },
          integ: { ...s.integ, h: 16 },
          waveIcon: { ...s.waveIcon, w: 13, h: 11 },
          wave: lab(s.wave),
          crowdIcon: { ...s.crowdIcon, w: 15, h: 14 },
          crowd: lab(s.crowd),
        };
        s.buttons.forEach((b, k) => (boxes[`button${k}`] = { ...b, w: bw, h: bh }));
        expect(firstOverlap(boxes), msg).toBe(null);
        for (const [k, b] of Object.entries(boxes))
          expect(inside(b, { x: 0, y: 0, w: W, h: l.topBar.h }), `${msg} ${k}`).toBe(true);
      }
  });

  it('counts shrink to the compact form only when the full one does not fit', () => {
    expect(fitCount(2450, 40)).toBe('2,450');
    expect(fitCount(123456, 32)).toBe('123k');
    expect(fitCount(9999, 40, true)).toBe('9999');
  });
});

describe('selected-unit panel', () => {
  it('name, HP, role, kills and move hint never touch each other, the close button or the gas controls', () => {
    const tb = stampButton('THROW GAS', 0, 'normal');
    for (const [w, h] of [
      [145, 46],
      [134, 46],
      [176, 46],
      [176, 58],
    ] as const)
      for (const id of UNIT_IDS)
        for (const ready of [false, true])
          for (const touch of [false, true]) {
            const d = UNITS[id];
            const gas = !!d.ability;
            const g = infoPanelLayout({
              w,
              h,
              name: d.name.toUpperCase(),
              hpText: d.invulnerable
                ? 'INVULNERABLE'
                : d.squad > 1
                  ? `${d.squad}/${d.squad} MEN`
                  : '9999 HP',
              role: UNIT_COPY[id].role,
              kills: d.commandable && h < 52 ? '' : d.attack ? 'KILLS 999' : 'HOLDING THE LINE',
              hint: d.commandable ? (touch ? UI_TEXT.moveHint : UI_TEXT.moveHintMouse) : '',
              ring: gas,
              throwBtn: gas && ready ? { w: tb.w, h: tb.h } : null,
            });
            const msg = `${w}x${h} ${id} ready=${ready} touch=${touch}`;
            const boxes: Record<string, Box> = {
              well: g.well,
              close: g.close,
              name: g.name,
              hp: g.hp,
              hpText: g.hpText,
              role: g.role,
              kills: g.kills,
              hint: g.hint,
            };
            if (g.ring) boxes.ring = g.ring;
            if (g.throwBtn) boxes.throwBtn = g.throwBtn;
            expect(firstOverlap(boxes), msg).toBe(null);
            for (const [k, b] of Object.entries(boxes))
              if (b.w > 0)
                expect(inside(b, { x: 0, y: 0, w, h: g.h }, 2), `${msg} ${k}`).toBe(true);
            expect(g.h, msg).toBeLessThanOrEqual(h + 24);
          }
  });
});
