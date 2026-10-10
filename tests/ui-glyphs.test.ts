/**
 * Every character the UI prints must exist in the bitmap fonts: a missing glyph renders as '?'
 * (owner report: the deploy tooltip showed "?5?" for a "[5]" hotkey).
 */
import { describe, expect, it } from 'vitest';
import { FONTS } from '../src/art/uikit/text';
import * as STRINGS from '../src/ui/strings';
import { UNITS, UNIT_IDS } from '../src/data/units';
import { PROTESTERS } from '../src/data/protesters';

function collect(v: unknown, out: string[]): void {
  if (typeof v === 'string') out.push(v);
  else if (typeof v === 'function') {
    try {
      collect((v as (...a: unknown[]) => unknown)('Sample', '12', true, 'Student'), out);
    } catch {
      // Builders that need real arguments are covered by their own tests.
    }
  } else if (Array.isArray(v)) for (const x of v) collect(x, out);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) collect(x, out);
}

describe('UI glyph coverage', () => {
  const strings: string[] = [];
  collect(STRINGS, strings);
  for (const id of UNIT_IDS) strings.push(UNITS[id].name);
  for (const p of Object.values(PROTESTERS)) strings.push(p.name);
  // `{choke}`-style placeholders are substituted before drawing.
  const text = strings.map((s) => s.replace(/\{\w+\}/g, ''));

  it.each(['small', 'smallBold', 'mono'] as const)('%s font draws every UI character', (f) => {
    const font = FONTS[f];
    const missing = new Set<string>();
    for (const s of text)
      for (const ch of s)
        if (ch !== '\n' && ch !== ' ' && !font.glyphs.has(ch) && !font.glyphs.has(ch.toUpperCase()))
          missing.add(ch);
    expect([...missing]).toEqual([]);
  });
});
