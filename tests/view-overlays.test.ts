import { describe, expect, it } from 'vitest';
import { getPixel } from '../src/art/lib/pixels';
import { SWATCHES, resolveColor } from '../src/art/palette';
import { roofHighlight } from '../src/view/overlays';
import { SIGN_SHARE, VariantTable } from '../src/view/protesterView';
import type { ProtesterManifest } from '../src/art/protesters';

describe('roof highlight', () => {
  it('covers the roof stand parallelogram with palette colours only', () => {
    const r = { u0: 0.5, v0: 0.5, u1: 2.5, v1: 3.5 };
    const { buf, ox, oy } = roofHighlight(r, 'valid');
    const palette = new Set(Object.keys(SWATCHES).map((k) => resolveColor(k)));
    let n = 0;
    for (let y = 0; y < buf.h; y++) {
      for (let x = 0; x < buf.w; x++) {
        const c = getPixel(buf, x, y);
        if ((c & 255) === 0) continue;
        n++;
        expect(palette.has(c)).toBe(true);
        // Inside the stand rectangle (tile space).
        const X = x + ox + 0.5;
        const Y = y + oy + 0.5;
        const u = Y / 16 + X / 32;
        const v = Y / 16 - X / 32;
        expect(u).toBeGreaterThanOrEqual(r.u0);
        expect(u).toBeLessThan(r.u1);
        expect(v).toBeGreaterThanOrEqual(r.v0);
        expect(v).toBeLessThan(r.v1);
      }
    }
    expect(n).toBeGreaterThan(40);
  });
});

describe('protester looks', () => {
  it('only about one in five protesters raises a sign', () => {
    const v = (i: number, sign: boolean) => ({
      type: 'student' as const,
      index: i,
      prefix: `prot.student.v${i}`,
      loadout: 'none',
      gait: 'stroll',
      idle: sign ? 'sign' : 'chant',
      anims: [],
    });
    const manifest = {
      variants: { student: [0, 1, 2, 3, 4, 5].map((i) => v(i, i < 4)) },
      events: {},
      frames: 0,
      pixels: 0,
    } as unknown as ProtesterManifest;
    const vt = new VariantTable(manifest);
    let signs = 0;
    const N = 20000;
    for (let k = 0; k < N; k++) {
      const seed = Math.imul(k + 1, 2654435761) >>> 0;
      const vi = vt.pick(0, seed, 0);
      if (vi < 4) signs++;
    }
    expect(Math.abs(signs / N - SIGN_SHARE)).toBeLessThan(0.03);
  });
});
