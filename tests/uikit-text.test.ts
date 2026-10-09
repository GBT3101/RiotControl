/** M5 bitmap fonts & text API. */
import { describe, expect, it } from 'vitest';
import {
  FONTS,
  drawText,
  measureText,
  textSprite,
  wrapText,
  supportedChars,
  lineWidth,
} from '../src/art/uikit/text';
import { createBuffer } from '../src/art/lib/pixels';
import { resolveColor } from '../src/art/palette';

const REQUIRED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789áéíóúñçàèêôüï¡¿£€\'"!?:;,.-+%/()#&';

describe('bitmap fonts', () => {
  it.each(['small', 'smallBold', 'mono', 'large'] as const)(
    '%s covers the required Latin-1 set',
    (name) => {
      const f = FONTS[name];
      for (const ch of REQUIRED) {
        const c = f.upperOnly ? ch.toUpperCase() : ch;
        expect(f.glyphs.has(c), `${name} missing ${ch}`).toBe(true);
      }
    },
  );

  it('small font has lowercase and metrics', () => {
    const f = FONTS.small;
    expect(f.capHeight).toBe(7);
    expect(f.glyphs.has('a') && f.glyphs.has('z')).toBe(true);
    expect(f.lineHeight).toBeGreaterThanOrEqual(10);
    expect(FONTS.large.capHeight).toBe(12);
  });

  it('accents sit above the cap line, cedilla below the baseline', () => {
    expect(FONTS.small.glyphs.get('É')!.y0).toBeLessThan(0);
    const c = FONTS.large.glyphs.get('Ç')!;
    expect(c.y0 + c.h).toBeGreaterThan(FONTS.large.capHeight);
  });

  it('measures, kerns and wraps', () => {
    expect(measureText(FONTS.small, 'A').w).toBe(5);
    expect(measureText(FONTS.small, 'AA').w).toBe(11);
    expect(lineWidth(FONTS.small, 'Ta')).toBeLessThan(
      lineWidth(FONTS.small, 'T') + 1 + lineWidth(FONTS.small, 'a'),
    );
    expect(measureText(FONTS.mono, 'il').w).toBe(
      6 + FONTS.mono.glyphs.get('l')!.x0 + FONTS.mono.glyphs.get('l')!.w,
    );
    const lines = wrapText(FONTS.small, 'Every fallen officer makes us more legitimate', 60);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(lineWidth(FONTS.small, l)).toBeLessThanOrEqual(60);
    expect(measureText(FONTS.small, 'a\nb').h).toBe(FONTS.small.lineHeight + FONTS.small.capHeight);
  });

  it('draws only the requested colours', () => {
    const b = createBuffer(80, 30);
    drawText(b, FONTS.large, 'ÑÇ!', 4, 6, 'stone5', { outline: 'ink', shadow: 'rust0' });
    const allowed = new Set(['stone5', 'ink', 'rust0'].map((r) => resolveColor(r) >>> 8));
    let n = 0;
    for (let i = 0; i < b.data.length; i += 4) {
      if (!b.data[i + 3]) continue;
      n++;
      expect(allowed.has((b.data[i]! << 16) | (b.data[i + 1]! << 8) | b.data[i + 2]!)).toBe(true);
    }
    expect(n).toBeGreaterThan(50);
  });

  it('textSprite trims tightly and is deterministic', () => {
    const a = textSprite(FONTS.small, 'Hate 120', 'ink');
    expect(a.h).toBe(7);
    expect(a.w).toBe(measureText(FONTS.small, 'Hate 120').w);
    expect(textSprite(FONTS.small, 'Hate 120', 'ink').data).toEqual(a.data);
    expect(supportedChars(FONTS.small).length).toBeGreaterThan(100);
  });
});
