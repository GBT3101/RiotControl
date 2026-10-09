/** M5 FX: registration, palette purity, naming and helper determinism (own registry). */
import { describe, expect, it } from 'vitest';
import {
  registerFx,
  gasCloudLayout,
  GAS_PUFF_VARIANTS,
  DIRS,
  rangeRing,
  rangeRadiusPx,
  ghostTint,
  lightPool,
} from '../src/art/fx';
import { SpriteRegistry } from '../src/art/lib/registry';
import { PALETTE_RGB, SHADOW, SWATCHES } from '../src/art/palette';
import { createBuffer, setPixel } from '../src/art/lib/pixels';
import { resolveColor } from '../src/art/palette';

const reg = new SpriteRegistry();
registerFx(reg);
const shadowRgb = parseInt(SWATCHES[SHADOW].slice(1), 16);

function offPalette(
  frames: readonly { data: Uint8ClampedArray }[],
  allowShadow: boolean,
): string[] {
  const bad = new Set<string>();
  for (const f of frames) {
    for (let i = 0; i < f.data.length; i += 4) {
      const a = f.data[i + 3]!;
      if (!a) continue;
      const rgb = (f.data[i]! << 16) | (f.data[i + 1]! << 8) | f.data[i + 2]!;
      if (a < 255 ? !(allowShadow && rgb === shadowRgb) : !PALETTE_RGB.has(rgb))
        bad.add(rgb.toString(16));
    }
  }
  return [...bad];
}

describe('M5 FX registry', () => {
  it('registers a substantial set', () => {
    expect(reg.size).toBeGreaterThan(120);
    expect(reg.groups().sort()).toEqual(['fx', 'ui']);
  });

  it.each(reg.list().map((d) => [d.name, d] as const))(
    '%s is palette-pure with a valid anchor',
    (_n, d) => {
      expect(offPalette(d.frames, d.hasShadow)).toEqual([]);
      const f0 = d.frames[0]!;
      expect(d.anchor.x).toBeGreaterThanOrEqual(0);
      expect(d.anchor.y).toBeGreaterThanOrEqual(0);
      expect(d.anchor.x).toBeLessThan(f0.w);
      expect(d.anchor.y).toBeLessThan(f0.h);
      expect(d.name.startsWith('fx.') || d.name.startsWith('ui.')).toBe(true);
      // No fully empty frames.
      for (const f of d.frames) expect(f.data.some((v, i) => i % 4 === 3 && v > 0)).toBe(true);
    },
  );

  it('has muzzle flashes and tracers for every weapon and direction', () => {
    for (const w of ['pistol', 'rifle', 'mg', 'sniper', 'cannon'])
      for (const d of DIRS) expect(reg.has(`fx.muzzle.${w}.${d}`)).toBe(true);
    for (const d of DIRS)
      expect(reg.has(`fx.tracer.${d}`) && reg.has(`fx.tracer.long.${d}`)).toBe(true);
  });

  it('has 4 gas puff variants with grow / loop / fade', () => {
    expect(GAS_PUFF_VARIANTS.length).toBe(4);
    for (const v of GAS_PUFF_VARIANTS)
      for (const a of ['grow', 'loop', 'fade']) expect(reg.has(`fx.gas.puff.${v}.${a}`)).toBe(true);
  });

  it('has the explosion, fire, blood and KO sets', () => {
    for (const n of ['small', 'medium', 'big', 'prophet'])
      expect(reg.get(`fx.explosion.${n}`).loop).toBe(false);
    for (const n of [
      'fx.fire.patch.small',
      'fx.fire.patch.medium',
      'fx.fire.burning',
      'fx.molotov.bottle',
      'fx.ko.stars',
      'fx.ko.birds',
    ]) {
      expect(reg.get(n).loop).toBe(true);
    }
    expect(reg.get('fx.fire.patch.small').frames.length).toBe(6);
    expect(reg.get('fx.molotov.bottle').frames.length).toBe(4);
    for (const s of 'abcde') expect(reg.has(`fx.blood.splat.${s}`)).toBe(true);
  });

  it('has range rings 3..14 sized like iso circles', () => {
    for (let r = 3; r <= 14; r++) {
      const d = reg.get(`ui.range.r${r}`);
      const { rx } = rangeRadiusPx(r);
      expect(Math.abs(d.frames[0]!.w - (2 * rx + 3))).toBeLessThanOrEqual(1);
    }
    expect(rangeRing(2.5).length).toBe(2);
  });

  it('gas cloud layout is deterministic and sized', () => {
    const a = gasCloudLayout(3, 10, 40);
    expect(a).toEqual(gasCloudLayout(3, 10, 40));
    expect(a.length).toBe(10);
    for (const p of a) {
      expect(Math.abs(p.dx)).toBeLessThanOrEqual(40);
      expect(GAS_PUFF_VARIANTS).toContain(p.variant);
    }
  });

  it('ghost tint and light pools stay in the palette', () => {
    const b = createBuffer(4, 4);
    setPixel(b, 1, 1, resolveColor('hivis2'));
    setPixel(b, 2, 2, resolveColor('navy1'));
    expect(
      offPalette(
        [ghostTint(b, 'valid'), ghostTint(b, 'invalid'), lightPool(9, 5, ['rust0', 'rust1'])],
        false,
      ),
    ).toEqual([]);
  });
});
