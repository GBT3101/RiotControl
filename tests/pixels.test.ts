import { describe, expect, it } from 'vitest';
import { resolveColor } from '../src/art/palette';
import {
  blit,
  createBuffer,
  getPixel,
  mirrorAnchor,
  mirrorX,
  opaqueBounds,
  outline,
  pad,
  recolour,
  setPixel,
  silhouette,
} from '../src/art/lib/pixels';

const RED = resolveColor('crim2');
const INK = resolveColor('ink');
const SH = resolveColor('ink', 115);

describe('pixel ops', () => {
  it('set/get round-trip and bounds', () => {
    const b = createBuffer(3, 2);
    setPixel(b, 2, 1, RED);
    expect(getPixel(b, 2, 1)).toBe(RED);
    expect(getPixel(b, 5, 5)).toBe(0);
    expect(opaqueBounds(b)).toEqual({ x: 2, y: 1, w: 1, h: 1 });
    expect(opaqueBounds(createBuffer(2, 2))).toBeNull();
  });

  it('outline adds a 4-neighbour ring, overwriting shadow but not caused by it', () => {
    const b = createBuffer(5, 5);
    setPixel(b, 2, 2, RED);
    setPixel(b, 0, 0, SH);
    outline(b, INK);
    expect(getPixel(b, 2, 1)).toBe(INK);
    expect(getPixel(b, 1, 2)).toBe(INK);
    expect(getPixel(b, 1, 1)).toBe(0); // no corners by default
    expect(getPixel(b, 0, 1)).toBe(0); // shadow pixel doesn't spawn outline
    outline(b, INK, { corners: true });
    expect(getPixel(b, 0, 0)).toBe(SH);
  });

  it('mirror flips pixels and anchors consistently', () => {
    const b = createBuffer(4, 1);
    setPixel(b, 0, 0, RED);
    const m = mirrorX(b);
    expect(getPixel(m, 3, 0)).toBe(RED);
    expect(mirrorAnchor({ x: 1, y: 0 }, 4)).toEqual({ x: 2, y: 0 });
  });

  it('blit never blends: shadow only lands on empty pixels', () => {
    const dst = createBuffer(2, 1);
    setPixel(dst, 0, 0, RED);
    const src = createBuffer(2, 1);
    setPixel(src, 0, 0, SH);
    setPixel(src, 1, 0, SH);
    blit(dst, src, 0, 0);
    expect(getPixel(dst, 0, 0)).toBe(RED);
    expect(getPixel(dst, 1, 0)).toBe(SH);
  });

  it('pad, recolour, silhouette', () => {
    const b = createBuffer(1, 1);
    setPixel(b, 0, 0, RED);
    const p = pad(b, 2);
    expect([p.w, p.h]).toEqual([5, 5]);
    expect(getPixel(p, 2, 2)).toBe(RED);
    recolour(p, new Map([[RED, INK]]));
    expect(getPixel(p, 2, 2)).toBe(INK);
    expect(getPixel(silhouette(p, RED), 2, 2)).toBe(RED);
  });
});
