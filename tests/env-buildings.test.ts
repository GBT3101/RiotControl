import { describe, expect, it } from 'vitest';
import { paintBuilding } from '../src/art/env/bld/building';
import type { BuildingData, RoofType } from '../src/maps/contract';

const spec = (o: Partial<BuildingData> = {}): BuildingData => ({
  id: 1,
  i: 10,
  j: 20,
  w: 3,
  d: 2,
  storeys: 4,
  style: 'madrid',
  kind: 'residential',
  roof: 'flat',
  rooftop: true,
  doors: [{ i: 11, j: 22 }],
  seed: 99,
  ...o,
});

describe('building kits', () => {
  it('sizes the sprite to the footprint and anchors on the footprint top vertex', () => {
    const a = paintBuilding(spec());
    expect(a.image.w).toBe((3 + 2) * 16 + 4);
    expect(a.anchor.x).toBe(2 * 16 + 2);
    expect(a.lights.w).toBe(a.image.w);
    expect(a.lights.h).toBe(a.image.h);
    // The footprint's bottom vertex row is opaque (wall base).
    const by = a.anchor.y + (3 + 2) * 8 - 1;
    const bx = a.anchor.x + (3 - 2) * 16;
    expect(a.image.data[(by * a.image.w + bx) * 4 + 3]).toBe(255);
  });

  it('reports the standable roof height per roof type', () => {
    const h: Record<RoofType, number> = { flat: 0, terrace: 0, pitched: 0, mansard: 0 };
    for (const roof of Object.keys(h) as RoofType[])
      h[roof] = paintBuilding(spec({ roof, storeys: 4 })).roofTopY;
    expect(h.flat).toBe(4 * 10);
    expect(h.terrace).toBe(4 * 10);
    expect(h.pitched).toBeGreaterThan(4 * 10);
    expect(h.mansard).toBeGreaterThan(3 * 10);
  });

  it('is deterministic per seed, varied across seeds, for all cities', () => {
    for (const style of ['madrid', 'london', 'paris'] as const) {
      const a = paintBuilding(spec({ style }));
      const b = paintBuilding(spec({ style }));
      expect(a.image).toBe(b.image);
      const c = paintBuilding(spec({ style, seed: 12345 }));
      expect(c.image.data.every((v, i) => v === a.image.data[i])).toBe(false);
    }
  });

  it('places climb points on the perimeter in absolute tile coords', () => {
    const a = paintBuilding(spec());
    expect(a.climbPoints.length).toBeGreaterThanOrEqual(4);
    for (const p of a.climbPoints) {
      const onI = p.i <= 10 || p.i >= 13;
      const onJ = p.j <= 20 || p.j >= 22;
      expect(onI || onJ).toBe(true);
    }
  });

  it('has lit windows in the night layer', () => {
    const a = paintBuilding(spec({ w: 4, d: 4, storeys: 6, kind: 'commercial' }));
    let lit = 0;
    for (let i = 3; i < a.lights.data.length; i += 4) lit += a.lights.data[i] ? 1 : 0;
    expect(lit).toBeGreaterThan(20);
  });

  it('generates 400 buildings quickly (map load budget)', () => {
    const t0 = performance.now();
    for (let k = 0; k < 400; k++) {
      paintBuilding(
        spec({
          w: 1 + (k % 5),
          d: 1 + ((k * 7) % 4),
          storeys: 2 + (k % 5),
          roof: (['flat', 'pitched', 'mansard', 'terrace'] as const)[k % 4],
          style: (['madrid', 'london', 'paris'] as const)[k % 3],
          seed: 50000 + k,
        }),
      );
    }
    // Generous in CI (Node + coverage of cold JIT); the browser target is < 1.5 s.
    expect(performance.now() - t0).toBeLessThan(4000);
  });
});
