/**
 * M3b composed previews. Always composes (smoke test of the compositor); writes the PNGs to
 * docs/progress/ only when M3B_EXPORT=1:
 *   M3B_EXPORT=1 npx vitest run tests/landmarks-preview.test.ts
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SpriteRegistry } from '../src/art/lib/registry';
import { registerLandmarks } from '../src/art/landmarks';
import {
  composeDamageStrip,
  composePreview,
  type PreviewActor,
  type PreviewSpec,
} from '../src/art/landmarks/preview';
import type { PixelBuffer } from '../src/art/lib/pixels';
import type { CityId } from '../src/maps/contract';
// @ts-expect-error — plain JS helper without types
import { encodePng } from '../tools/lib/png.mjs';

const EXPORT = process.env.M3B_EXPORT === '1';

async function registry(): Promise<SpriteRegistry> {
  const reg = new SpriteRegistry();
  registerLandmarks(reg);
  if (EXPORT) {
    // Units / protesters for scale (optional: other milestones may be mid-edit).
    try {
      const { registerUnits } = await import('../src/art/units');
      registerUnits(reg);
    } catch {
      /* no units */
    }
    try {
      const { registerProtesters } = await import('../src/art/protesters');
      registerProtesters(reg);
    } catch {
      /* no protesters */
    }
  }
  return reg;
}

function save(buf: PixelBuffer, name: string, scale = 1): void {
  if (!EXPORT) return;
  const W = buf.w * scale;
  const H = buf.h * scale;
  const px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const si = (Math.floor(y / scale) * buf.w + Math.floor(x / scale)) * 4;
      const di = (y * W + x) * 4;
      for (let c = 0; c < 4; c++) px[di + c] = buf.data[si + c]!;
    }
  }
  writeFileSync(resolve(__dirname, '../docs/progress', name), encodePng(W, H, px));
}

function guards(w: number, d: number): PreviewActor[] {
  const a: PreviewActor[] = [];
  for (let i = 1; i < w - 1; i += 2)
    a.push({ sprite: 'unit.riot.idle.sw', i: i + 0.5, j: d + 0.3, frame: i });
  return a;
}

function crowd(w: number, d: number, n: number): PreviewActor[] {
  const kinds = ['student', 'woke', 'mob', 'violent', 'crazy'];
  const a: PreviewActor[] = [];
  for (let k = 0; k < n; k++) {
    const kind = kinds[k % kinds.length]!;
    a.push({
      sprite: `prot.${kind}.v0.walk.ne`,
      i: 0.8 + ((k * 1.7) % (w - 1)),
      j: d + 2.2 + ((k * 0.73) % 1.6),
      frame: k,
    });
  }
  return a;
}

/** Review previews (E4: add your city's Capitol + two of its landmarks). */
const SPECS: Partial<
  Record<CityId, Omit<PreviewSpec, 'actors' | 'state'> & { w: number; d: number }>
> = {
  madrid: {
    city: 'madrid',
    w: 9,
    d: 7,
    landmarks: [
      { id: 'cervantes', i: 1, j: 8 },
      { id: 'neptuno', i: 10, j: 6 },
    ],
  },
  london: {
    city: 'london',
    w: 14,
    d: 6,
    landmarks: [
      { id: 'churchill', i: 2, j: 7 },
      { id: 'nelson', i: 15, j: 6 },
    ],
  },
  paris: {
    city: 'paris',
    w: 11,
    d: 7,
    landmarks: [
      { id: 'obelisk', i: 1, j: 8 },
      { id: 'concordeFountain', i: 12, j: 6 },
    ],
  },
  budapest: {
    city: 'budapest',
    w: 16,
    d: 6,
    landmarks: [
      { id: 'kossuth', i: 2, j: 7 },
      { id: 'fishermansBastion', i: 17, j: 4 },
    ],
  },
  vienna: {
    city: 'vienna',
    w: 12,
    d: 7,
    landmarks: [{ id: 'stephansdom', i: 13, j: 4 }],
  },
  prague: {
    city: 'prague',
    w: 14,
    d: 6,
    landmarks: [
      { id: 'bridgeTower', i: 1, j: 8 },
      { id: 'dancingHouse', i: 15, j: 5 },
    ],
  },
  berlin: {
    city: 'berlin',
    w: 10,
    d: 8,
    landmarks: [{ id: 'victoryColumn', i: 11, j: 6 }],
  },
  stockholm: {
    city: 'stockholm',
    w: 10,
    d: 6,
    landmarks: [{ id: 'riddarholmen', i: 11, j: 3 }],
  },
  amsterdam: {
    city: 'amsterdam',
    w: 9,
    d: 6,
    landmarks: [{ id: 'nationalMonument', i: 10, j: 4 }],
  },
};

describe('M3b previews', () => {
  it('composes a preview and damage strip for every city', async () => {
    const reg = await registry();
    for (const city of Object.keys(SPECS) as CityId[]) {
      const s = SPECS[city]!;
      const prev = composePreview(reg, {
        ...s,
        state: 0,
        t: 0.3,
        actors: [...guards(s.w, s.d), ...crowd(s.w, s.d, 7)],
      });
      expect(prev.w).toBeGreaterThan(200);
      save(prev, `m3b-${city}.png`, 2);
      const strip = composeDamageStrip(reg, city, 0.4);
      expect(strip.w).toBeGreaterThan(prev.w);
      save(strip, `m3b-damage-${city}.png`, 1);
    }
  }, 120_000);
});
