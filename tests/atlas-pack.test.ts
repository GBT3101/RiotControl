import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { packShelves } from '../src/art/lib/packer';
import { SpriteRegistry } from '../src/art/lib/registry';
import { createBuffer, getPixel, setPixel } from '../src/art/lib/pixels';
import { resolveColor } from '../src/art/palette';

describe('shelf packer', () => {
  it('packs without overlaps inside the page (with padding)', () => {
    const rng = new Rng(1);
    const items = Array.from({ length: 400 }, () => ({ w: rng.int(4, 90), h: rng.int(4, 70) }));
    const { placements, pages } = packShelves(items, 512, 1);
    placements.forEach((p, i) => {
      const it = items[i]!;
      expect(p.x).toBeGreaterThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(1);
      expect(p.x + it.w).toBeLessThanOrEqual(512);
      expect(p.y + it.h).toBeLessThanOrEqual(512);
      expect(pages[p.page]).toBeDefined();
    });
    for (let a = 0; a < items.length; a++) {
      for (let b = a + 1; b < items.length; b++) {
        const pa = placements[a]!;
        const pb = placements[b]!;
        if (pa.page !== pb.page) continue;
        const A = items[a]!;
        const B = items[b]!;
        const overlap =
          pa.x < pb.x + B.w + 1 &&
          pb.x < pa.x + A.w + 1 &&
          pa.y < pb.y + B.h + 1 &&
          pb.y < pa.y + A.h + 1;
        expect(overlap).toBe(false);
      }
    }
    expect(pages.length).toBeGreaterThan(1);
  });

  it('rejects items larger than a page', () => {
    expect(() => packShelves([{ w: 600, h: 4 }], 512)).toThrow();
  });
});

describe('sprite registry', () => {
  it('registers, defaults anchors and auto-mirrors', () => {
    const reg = new SpriteRegistry();
    const f = createBuffer(5, 4);
    setPixel(f, 0, 0, resolveColor('ink'));
    reg.add('unit.x.walk.se', {
      group: 'units',
      frames: [f, f],
      fps: 10,
      mirrorAs: 'unit.x.walk.sw',
    });
    const se = reg.get('unit.x.walk.se');
    expect(se.anchor).toEqual({ x: 2, y: 3 });
    const sw = reg.get('unit.x.walk.sw');
    expect(sw.anchor).toEqual({ x: 2, y: 3 });
    expect(getPixel(sw.frames[0]!, 4, 0)).toBe(resolveColor('ink'));
    expect(reg.groups()).toEqual(['units']);
    expect(() => reg.add('unit.x.walk.se', { group: 'units', frames: f })).toThrow(/twice/);
    expect(() => reg.get('nope')).toThrow();
  });
});
