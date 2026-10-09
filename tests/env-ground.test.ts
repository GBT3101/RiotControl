import { describe, expect, it } from 'vitest';
import { GROUNDS, MARKINGS, type Ground, type MapData } from '../src/maps/contract';
import { PALETTE_RGB } from '../src/art/palette';
import {
  GROUND_ANCHOR,
  GROUND_IMG_H,
  GROUND_IMG_W,
  WATER_FRAMES,
  groundCtxAt,
  groundTile,
  groundTileFrames,
  groundTileKey,
  type GroundCtx,
} from '../src/art/env/ground';

function ctx(ground: Ground, nb: Partial<GroundCtx> = {}): GroundCtx {
  return {
    city: 'madrid',
    ground,
    marking: 'none',
    seed: 1,
    n: ground,
    ne: ground,
    e: ground,
    se: ground,
    s: ground,
    sw: ground,
    w: ground,
    nw: ground,
    ...nb,
  };
}

const same = (a: Uint8ClampedArray, b: Uint8ClampedArray): boolean => a.every((v, i) => v === b[i]);

describe('ground tiles', () => {
  it('every ground × city is a 32×24 palette-pure image anchored on the diamond top vertex', () => {
    for (const city of ['madrid', 'london', 'paris'] as const) {
      for (const g of GROUNDS) {
        const img = groundTile({ ...ctx(g), city });
        expect(img.w).toBe(GROUND_IMG_W);
        expect(img.h).toBe(GROUND_IMG_H);
        for (let i = 0; i < img.data.length; i += 4) {
          if (img.data[i + 3] === 0) continue;
          expect(img.data[i + 3]).toBe(255);
          const rgb = (img.data[i]! << 16) | (img.data[i + 1]! << 8) | img.data[i + 2]!;
          expect(PALETTE_RGB.has(rgb)).toBe(true);
        }
        // The diamond's top vertex pixels (row 8, columns 15/16) are filled.
        const top = (GROUND_ANCHOR.y * img.w + GROUND_ANCHOR.x) * 4 + 3;
        expect(img.data[top]).toBe(255);
      }
    }
  });

  it('is deterministic and cached by canonical key', () => {
    const a = groundTile(ctx('asphalt', { seed: 77 }));
    const b = groundTile(ctx('asphalt', { seed: 77 }));
    expect(a).toBe(b);
    // A pavement or a plaza to the NW both raise a kerb face: same canonical key.
    expect(groundTileKey(ctx('asphalt', { nw: 'sidewalk' }))).toBe(
      groundTileKey(ctx('asphalt', { nw: 'plaza' })),
    );
  });

  it('autotiles: kerbs, markings and quay walls change the tile', () => {
    const plain = groundTile(ctx('asphalt'));
    expect(same(plain.data, groundTile(ctx('asphalt', { nw: 'sidewalk' })).data)).toBe(false);
    expect(same(plain.data, groundTile(ctx('asphalt', { marking: 'zebraI' })).data)).toBe(false);
    const water = groundTile(ctx('water'));
    expect(same(water.data, groundTile(ctx('water', { ne: 'quay' })).data)).toBe(false);
    // Bridge balustrades use the headroom rows above the diamond.
    const bridge = groundTile(ctx('bridge', { nw: 'water' }));
    let head = 0;
    for (let y = 0; y < GROUND_ANCHOR.y; y++)
      for (let x = 0; x < 32; x++) head += bridge.data[(y * 32 + x) * 4 + 3]! ? 1 : 0;
    expect(head).toBeGreaterThan(10);
  });

  it('water animates over WATER_FRAMES frames', () => {
    const f = groundTileFrames(ctx('water'));
    expect(f).toHaveLength(WATER_FRAMES);
    expect(f.some((b) => !same(b.data, f[0]!.data))).toBe(true);
    expect(groundTileFrames(ctx('grass'))).toHaveLength(1);
  });

  it('groundCtxAt reads neighbours with the documented offsets', () => {
    const w = 3;
    const h = 3;
    const ground = new Uint8Array(w * h).fill(GROUNDS.indexOf('asphalt'));
    ground[0 * w + 1] = GROUNDS.indexOf('sidewalk'); // (i=1, j=0) is NE of (1,1)
    ground[1 * w + 0] = GROUNDS.indexOf('grass'); // (i=0, j=1) is NW of (1,1)
    const map = {
      city: 'paris',
      w,
      h,
      ground,
      marking: new Uint8Array(w * h),
    } as unknown as MapData;
    const c = groundCtxAt(map, 1, 1);
    expect(c.ne).toBe('sidewalk');
    expect(c.nw).toBe('grass');
    expect(c.se).toBe('asphalt');
    expect(MARKINGS).toContain(c.marking);
  });
});
