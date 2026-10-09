import { describe, expect, it } from 'vitest';
import {
  COMPACT_CARD,
  FULL_CARD,
  clampScroll,
  computeHudLayout,
  insetsToUi,
  layoutMode,
  minimapFrameH,
  scrollToCard,
} from '../src/ui/layout';
import { uiScale } from '../src/render/zoom';

/** UI space for a CSS viewport at a DPR. */
function ui(cssW: number, cssH: number, dpr: number): { W: number; H: number; k: number } {
  const k = uiScale(Math.min(cssW, cssH), dpr);
  return { W: Math.floor((cssW * dpr) / k), H: Math.floor((cssH * dpr) / k), k };
}

const VIEWPORTS: Array<[string, number, number, number, boolean]> = [
  ['desktop', 1440, 900, 1, false],
  ['fullhd', 1920, 1080, 1, false],
  ['phone-landscape', 844, 390, 3, true],
  ['phone-portrait', 390, 844, 3, true],
  ['tablet', 768, 1024, 1, true],
];

describe('ui scale per viewport', () => {
  it('chooses integer scales with ≥ 1.5 CSS px per UI pixel', () => {
    for (const [, w, h, dpr] of VIEWPORTS) {
      const s = ui(w, h, dpr);
      expect(Number.isInteger(s.k)).toBe(true);
      expect(s.k / dpr).toBeGreaterThanOrEqual(1.5);
    }
    expect(ui(1440, 900, 1)).toMatchObject({ W: 480, H: 300 });
    expect(ui(844, 390, 3)).toMatchObject({ W: 506, H: 234 });
    expect(ui(390, 844, 3)).toMatchObject({ W: 234, H: 506 });
  });
});

describe('HUD layout', () => {
  it('picks modes and card sizes', () => {
    expect(layoutMode(480, 300)).toBe('wide');
    expect(layoutMode(506, 234)).toBe('compact');
    expect(layoutMode(234, 506)).toBe('portrait');
    expect(computeHudLayout(480, 300).card).toBe(FULL_CARD);
    expect(computeHudLayout(506, 234).card).toBe(COMPACT_CARD);
    expect(computeHudLayout(234, 506).card).toBe(COMPACT_CARD);
  });

  it('keeps every piece on screen and the HUD small on phones', () => {
    for (const [name, w, h, dpr, touch] of VIEWPORTS) {
      const s = ui(w, h, dpr);
      const l = computeHudLayout(s.W, s.H, undefined, { touch });
      expect(l.deploy.x, name).toBeGreaterThanOrEqual(0);
      expect(l.deploy.x + l.deploy.w, name).toBeLessThanOrEqual(s.W);
      expect(l.deploy.y + l.deploy.h, name).toBe(s.H);
      expect(l.topBar.h, name).toBeLessThan(l.deploy.y);
      if (l.minimap) {
        expect(l.minimap.x + l.minimap.w, name).toBeLessThanOrEqual(s.W);
        // Minimap never overlaps the deploy bar or the top bar.
        const overlapsBar =
          l.minimap.y + l.minimap.h > l.deploy.y &&
          l.minimap.x < l.deploy.x + l.deploy.w &&
          l.minimap.x + l.minimap.w > l.deploy.x;
        expect(overlapsBar, name).toBe(false);
        expect(l.minimap.y, name).toBeGreaterThanOrEqual(l.topBar.h);
      }
      if (touch && dpr > 1) {
        // Phones: the HUD bars (top + deploy) cover ≤ ~25 % of the screen.
        const bars = (s.W * l.topBar.h + l.deploy.w * l.deploy.h) / (s.W * s.H);
        expect(bars, name).toBeLessThanOrEqual(0.25);
        // Cards stay ≥ 44 CSS px tall.
        expect(((l.card.h - 4) * s.k) / dpr, name).toBeGreaterThanOrEqual(44);
      }
    }
  });

  it('scrolls the deploy sheet only when the cards do not fit', () => {
    expect(computeHudLayout(480, 300).scrollable).toBe(false);
    expect(computeHudLayout(234, 506).scrollable).toBe(true);
  });

  it('pads for safe-area insets', () => {
    const l = computeHudLayout(506, 234, { top: 0, right: 12, bottom: 6, left: 12 });
    expect(l.deploy.x).toBeGreaterThanOrEqual(12);
    expect(l.deploy.x + l.deploy.w).toBeLessThanOrEqual(506 - 12);
    expect(l.deploy.h).toBe(COMPACT_CARD.h + 10 + 6);
    expect(insetsToUi({ top: 47, right: 0, bottom: 34, left: 0 }, 3, 5)).toEqual({
      top: 29,
      right: 0,
      bottom: 21,
      left: 0,
    });
  });

  it('scroll helpers clamp and reveal cards', () => {
    expect(clampScroll(-5, 300, 200)).toBe(0);
    expect(clampScroll(500, 300, 200)).toBe(100);
    expect(clampScroll(50, 100, 200)).toBe(0);
    const content = 10 * COMPACT_CARD.pitch + COMPACT_CARD.w;
    const s = scrollToCard(0, 10, COMPACT_CARD, 200, content);
    expect(10 * COMPACT_CARD.pitch + COMPACT_CARD.w - s).toBeLessThanOrEqual(200);
    expect(scrollToCard(s, 0, COMPACT_CARD, 200, content)).toBe(0);
  });

  it('minimap frames keep a 2:1 inner area', () => {
    for (const w of [72, 108, 120]) expect((w - 12) / (minimapFrameH(w) - 12)).toBeCloseTo(2, 0);
  });
});
