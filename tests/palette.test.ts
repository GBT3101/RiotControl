import { describe, expect, it } from 'vitest';
import {
  PALETTE_HEX,
  RAMPS,
  SWATCHES,
  SWATCH_NAMES,
  hexToRgba,
  rampSwatch,
  resolveColor,
  rgbaToHex,
  type RampName,
} from '../src/art/palette';

/** Relative luminance-ish lightness (perceptual weights), 0..255. */
function lightness(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
}

describe('RIOT-64 palette', () => {
  it('has at most 64 unique colours', () => {
    expect(SWATCH_NAMES.length).toBeLessThanOrEqual(64);
    expect(new Set(PALETTE_HEX.map((h) => h.toLowerCase())).size).toBe(PALETTE_HEX.length);
  });

  it('every ramp runs darkest → lightest', () => {
    for (const r of Object.keys(RAMPS) as RampName[]) {
      const ls = RAMPS[r].map((n) => lightness(SWATCHES[n]));
      for (let i = 1; i < ls.length; i++) {
        expect(ls[i], `${r}[${i}] should be lighter than [${i - 1}]`).toBeGreaterThan(ls[i - 1]!);
      }
    }
  });

  it('contains the ramps required by the art bible', () => {
    const required = [
      'asphalt',
      'kerb',
      'sidewalk',
      'cobble',
      'madridOchre',
      'madridTerracotta',
      'londonBrick',
      'portlandStone',
      'slate',
      'parisLimestone',
      'zinc',
      'foliage',
      'grass',
      'water',
      'metal',
      'glass',
      'skin1',
      'skin2',
      'skin3',
      'skin4',
      'skin5',
      'skin6',
      'hairBlack',
      'hairBrown',
      'hairAuburn',
      'hairBlonde',
      'dyePink',
      'dyeBlue',
      'dyePurple',
      'dyeGreen',
      'dyeTeal',
      'navy',
      'hivis',
      'olive',
      'sackcloth',
      'cultRed',
      'whiteRobe',
      'fire',
      'gas',
      'blood',
      'parchment',
      'manila',
      'brass',
      'ministryRed',
      'night',
    ];
    for (const r of required) expect(Object.keys(RAMPS)).toContain(r);
  });

  it('never uses pure black', () => {
    expect(PALETTE_HEX.map((h) => h.toLowerCase())).not.toContain('#000000');
  });

  it('resolves references', () => {
    expect(rgbaToHex(resolveColor('ink'))).toBe(SWATCHES.ink);
    expect(resolveColor('navy.0')).toBe(hexToRgba(SWATCHES.ink));
    expect(rampSwatch('navy', -1)).toBe('blue1');
    expect(rampSwatch('navy', 99)).toBe('blue1');
    expect(resolveColor('ink', 115) & 255).toBe(115);
    expect(() => resolveColor('nope')).toThrow();
    expect(() => resolveColor('navy.x')).toThrow();
  });
});
