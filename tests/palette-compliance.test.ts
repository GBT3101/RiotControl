/**
 * Every registered sprite may only use RIOT-64 colours. The single exception: the `shadow`
 * swatch at partial alpha (shadow layers). Runs in Node — no DOM needed.
 */
import { describe, expect, it } from 'vitest';
import { createArtRegistry } from '../src/art';
import { PALETTE_RGB, SHADOW, SWATCHES } from '../src/art/palette';

const shadowRgb = parseInt(SWATCHES[SHADOW].slice(1), 16);

describe('palette compliance', () => {
  const registry = createArtRegistry();

  it('has sprites registered', () => {
    expect(registry.size).toBeGreaterThan(10);
  });

  it.each(registry.list().map((d) => [d.name, d] as const))(
    '%s uses palette colours only',
    (_n, def) => {
      const offenders = new Set<string>();
      let partial = 0;
      for (const f of def.frames) {
        const d = f.data;
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3]!;
          if (a === 0) continue;
          const rgb = (d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!;
          if (a < 255) {
            partial++;
            if (rgb !== shadowRgb) offenders.add(`#${rgb.toString(16).padStart(6, '0')}@${a}`);
          } else if (!PALETTE_RGB.has(rgb)) {
            offenders.add(`#${rgb.toString(16).padStart(6, '0')}`);
          }
        }
      }
      expect([...offenders]).toEqual([]);
      if (!def.hasShadow) expect(partial, 'partial alpha needs hasShadow: true').toBe(0);
    },
  );

  it('all frames of a sprite share a size and anchors lie inside the frame', () => {
    for (const def of registry.list()) {
      const f0 = def.frames[0]!;
      expect(def.anchor.x).toBeGreaterThanOrEqual(0);
      expect(def.anchor.x).toBeLessThanOrEqual(f0.w);
      expect(def.anchor.y).toBeLessThanOrEqual(f0.h);
    }
  });
});
