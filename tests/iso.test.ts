import { describe, expect, it } from 'vitest';
import {
  boxDepthKey,
  cameraOrigin,
  depthKey,
  facingFromTileDelta,
  inTileDiamond,
  mapWorldBounds,
  screenToWorld,
  tileCenterWorld,
  tileToWorld,
  worldToScreen,
  worldToTile,
  worldToTileIndex,
} from '../src/core/iso';

describe('iso maths', () => {
  it('tile ↔ world round-trips', () => {
    for (const [u, v] of [
      [0, 0],
      [3.25, 7.5],
      [-2, 5],
      [71.9, 0.1],
    ] as const) {
      const w = tileToWorld(u, v);
      const t = worldToTile(w.x, w.y);
      expect(t.u).toBeCloseTo(u, 9);
      expect(t.v).toBeCloseTo(v, 9);
    }
  });

  it('places tile vertices on the 32×16 lattice', () => {
    expect(tileToWorld(1, 0)).toEqual({ x: 16, y: 8 });
    expect(tileToWorld(0, 1)).toEqual({ x: -16, y: 8 });
    expect(tileCenterWorld(0, 0)).toEqual({ x: 0, y: 8 });
    expect(worldToTileIndex(0, 8)).toEqual({ i: 0, j: 0 });
    expect(worldToTileIndex(0, 17)).toEqual({ i: 1, j: 1 });
  });

  it('tile diamonds tessellate exactly (each pixel owned by one tile)', () => {
    // Check a 128×64 world window: each pixel centre must be in exactly one tile's diamond.
    for (let y = 0; y < 64; y++) {
      for (let x = -64; x < 64; x++) {
        let owners = 0;
        for (let i = -4; i < 10; i++) {
          for (let j = -4; j < 10; j++) {
            const top = tileToWorld(i, j); // top vertex sits between columns 15|16 of the tile image
            if (inTileDiamond(x - (top.x - 16), y - top.y)) owners++;
          }
        }
        expect(owners, `pixel ${x},${y}`).toBe(1);
      }
    }
  });

  it('diamond row widths are 2,6,…,30,30,…,2', () => {
    const widths = Array.from(
      { length: 16 },
      (_, y) => Array.from({ length: 32 }, (_, x) => inTileDiamond(x, y)).filter(Boolean).length,
    );
    expect(widths).toEqual([2, 6, 10, 14, 18, 22, 26, 30, 30, 26, 22, 18, 14, 10, 6, 2]);
  });

  it('world ↔ screen with an integer camera', () => {
    const cam = { x: 100, y: 50, zoom: 3, width: 801, height: 600 };
    const o = cameraOrigin(cam);
    expect(Number.isInteger(o.x) && Number.isInteger(o.y)).toBe(true);
    const s = worldToScreen(120, 70, cam);
    const w = screenToWorld(s.x, s.y, cam);
    expect(w).toEqual({ x: 120, y: 70 });
    expect(worldToScreen(100, 50, cam)).toEqual({ x: 400, y: 300 });
  });

  it('depth keys order by y then x', () => {
    expect(depthKey(0, 10)).toBeGreaterThan(depthKey(500, 9));
    expect(depthKey(5, 10)).toBeGreaterThan(depthKey(4, 10));
  });

  it('box depth sorts entities behind / in front of a square footprint', () => {
    const key = boxDepthKey(10, 10, 3);
    const ent = (u: number, v: number) => {
      const w = tileToWorld(u, v);
      return depthKey(Math.round(w.x), Math.round(w.y));
    };
    expect(ent(9.5, 11)).toBeLessThan(key); // behind (north-west side)
    expect(ent(11, 9.5)).toBeLessThan(key); // behind (north-east side)
    expect(ent(13.5, 11)).toBeGreaterThan(key); // in front (south-east side)
    expect(ent(11, 13.5)).toBeGreaterThan(key); // in front (south-west side)
  });

  it('map bounds and facings', () => {
    expect(mapWorldBounds(72, 72)).toEqual({ minX: -1152, maxX: 1152, minY: 0, maxY: 1152 });
    expect(facingFromTileDelta(1, 0)).toBe('se');
    expect(facingFromTileDelta(0, 1)).toBe('sw');
    expect(facingFromTileDelta(-1, 0)).toBe('nw');
    expect(facingFromTileDelta(0, -1)).toBe('ne');
  });
});
