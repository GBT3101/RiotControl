import { describe, expect, it } from 'vitest';
import { createArtRegistry } from '../src/art';
import { Ground, generateTestMap, testMapTileName } from '../src/demo/testMap';
import { WalkerSim } from '../src/demo/walkers';
import { stubBoxName } from '../src/art/buildings/stubBoxes';

describe('M1 test map', () => {
  const map = generateTestMap(7);

  it('is 72×72 with roads, plaza and buildings on grass only', () => {
    expect(map.size).toBe(72);
    const counts = [0, 0, 0, 0];
    for (const g of map.ground) counts[g]!++;
    expect(counts[Ground.Asphalt]).toBeGreaterThan(500);
    expect(counts[Ground.Plaza]).toBe(100);
    expect(map.buildings.length).toBeGreaterThan(20);
    for (const b of map.buildings) {
      for (let j = b.j; j < b.j + b.n; j++) {
        for (let i = b.i; i < b.i + b.n; i++) expect(map.at(i, j)).toBe(Ground.Grass);
      }
    }
  });

  it('every tile and building maps to a registered sprite', () => {
    const reg = createArtRegistry();
    for (let j = 0; j < map.size; j++) {
      for (let i = 0; i < map.size; i++) expect(reg.has(testMapTileName(map, i, j))).toBe(true);
    }
    for (const b of map.buildings) expect(reg.has(stubBoxName(b.style, b.n, b.storeys))).toBe(true);
  }, 60_000);

  it('walkers are deterministic and stay on walkable tiles', () => {
    const a = new WalkerSim(map, 50, 3, 6);
    const b = new WalkerSim(generateTestMap(7), 50, 3, 6);
    for (let s = 0; s < 600; s++) {
      a.step(1 / 30);
      b.step(1 / 30);
    }
    a.walkers.forEach((w, k) => {
      expect(w.u).toBeCloseTo(b.walkers[k]!.u, 9);
      expect(map.walkable(Math.floor(w.u), Math.floor(w.v))).toBe(true);
    });
  });
});
