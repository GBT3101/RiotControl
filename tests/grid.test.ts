import { describe, expect, it } from 'vitest';
import { resolveColor, SHADOW_ALPHA } from '../src/art/palette';
import { getPixel } from '../src/art/lib/pixels';
import { blankFrames, grid, keyFrames, keyGrid, renderKeys, sheet } from '../src/art/lib/grid';

describe('grid parser', () => {
  it('parses dedented rows, transparency and shadow', () => {
    const b = grid(
      `
        .a.
        a%a
      `,
      { a: 'navy.2' },
    );
    expect([b.w, b.h]).toEqual([3, 2]);
    expect(getPixel(b, 0, 0)).toBe(0);
    expect(getPixel(b, 1, 0)).toBe(resolveColor('navy.2'));
    expect(getPixel(b, 1, 1) & 255).toBe(SHADOW_ALPHA);
  });

  it('rejects ragged rows and unknown keys', () => {
    expect(() => keyGrid('aa\na')).toThrow(/width/);
    expect(() => grid('ab', { a: 'ink' })).toThrow(/unknown key "b"/);
    expect(() => grid('a', { a: 'notacolour' })).toThrow();
  });

  it('splits sheets on blank lines and checks frame sizes', () => {
    const frames = sheet('ab\nba\n\nbb\naa\n\n\nab\nab', { a: 'ink', b: 'white' });
    expect(frames).toHaveLength(3);
    expect(() => sheet('ab\n\nabc', { a: 'ink', b: 'white' })).toThrow(/frame 1/);
    expect(keyFrames('a\n\nb')).toHaveLength(2);
  });

  it('resolves semantic $slots per variant', () => {
    const g = keyGrid('H');
    const pink = renderKeys(g, { H: '$hair.1' }, { slots: { hair: 'dyePink' } });
    const teal = renderKeys(g, { H: '$hair.1' }, { slots: { hair: 'dyeTeal' } });
    expect(getPixel(pink, 0, 0)).toBe(resolveColor('dyePink.1'));
    expect(getPixel(teal, 0, 0)).toBe(resolveColor('dyeTeal.1'));
    expect(() => renderKeys(g, { H: '$hair.1' })).toThrow(/slot/);
  });

  it('blank frames', () => {
    const f = blankFrames(4, 3, 2);
    expect(f).toHaveLength(2);
    expect(f[0]).toMatchObject({ w: 4, h: 3 });
  });
});
