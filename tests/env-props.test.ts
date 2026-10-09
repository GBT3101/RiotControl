import { describe, expect, it } from 'vitest';
import { createArtRegistry } from '../src/art';
import { DECAL_KINDS, decalSprite } from '../src/art/env/decals';
import { PROP_KINDS, propSprite } from '../src/art/env/props';
import { CITIES } from '../src/maps/contract';

describe('props & decals', () => {
  const reg = createArtRegistry();

  it('every decor kind resolves to a registered sprite for every city, seed and axis', () => {
    for (const kind of PROP_KINDS) {
      for (const city of CITIES) {
        for (let seed = 0; seed < 6; seed++) {
          for (const axis of ['i', 'j'] as const) {
            const name = propSprite(kind, city, seed, axis);
            expect(reg.has(name), `${kind} → ${name}`).toBe(true);
          }
        }
      }
    }
  });

  it('every decal kind resolves to a registered decal', () => {
    for (const kind of Object.keys(DECAL_KINDS)) {
      for (let seed = 0; seed < 8; seed++)
        expect(reg.has(decalSprite(kind, seed, seed % 2 ? 'j' : 'i'))).toBe(true);
    }
  });

  it('animated props have consistent frames and the anchor inside the frame', () => {
    for (const name of ['prop.flag.paris', 'prop.pigeon.fly', 'prop.trafficlight.london']) {
      const d = reg.get(name);
      expect(d.frames.length).toBeGreaterThan(1);
      expect(d.fps).toBeGreaterThan(0);
      expect(d.anchor.y).toBeLessThan(d.frames[0]!.h);
    }
  });

  it('registers the composed previews and building samples in review contexts', () => {
    for (const c of CITIES) {
      expect(reg.has(`env.preview.${c}`)).toBe(true);
      expect(reg.has(`bld.${c}.11`)).toBe(true);
      expect(reg.has(`tile.${c}.water.quay`)).toBe(true);
    }
  });
});
