import { describe, expect, it } from 'vitest';
import { createBuffer, setPixel } from '../src/art/lib/pixels';
import { depthKey, tileToWorld } from '../src/core/iso';
import {
  footprintAssignment,
  gcd,
  pieceDepthKey,
  splitFrames,
  trimToContent,
} from '../src/view/depth';

/** A solid "building" image for a w×d footprint, H px tall, anchored on the top vertex. */
function boxImage(w: number, d: number, H: number) {
  const iw = (w + d) * 16 + 4;
  const ih = (w + d) * 8 + H + 4;
  const anchor = { x: d * 16 + 2, y: H + 2 };
  const img = createBuffer(iw, ih);
  for (let y = 0; y < ih; y++) {
    for (let x = 0; x < iw; x++) {
      const q = (x + 0.5 - anchor.x) / 16;
      const sy = (y + 0.5 - anchor.y) / 8;
      // inside the extruded diamond
      const uMin = Math.max(0, q);
      const uMax = Math.min(w, d + q);
      if (uMin >= uMax) continue;
      const top = (2 * Math.max(0, q) - q) * 8 - H; // back edge raised by H
      const bot = (2 * uMax - q) * 8;
      const yy = sy * 8;
      if (yy >= top && yy < bot) setPixel(img, x, y, 0xff3366ff >>> 0);
    }
  }
  return { img, anchor };
}

describe('depth pieces', () => {
  it('gcd', () => {
    expect(gcd(6, 4)).toBe(2);
    expect(gcd(9, 7)).toBe(1);
    expect(gcd(4, 4)).toBe(4);
  });

  it('split pieces partition the image exactly', () => {
    const { img, anchor } = boxImage(6, 4, 40);
    const as = footprintAssignment(img.w, img.h, anchor, 6, 4, 1e6);
    expect(as.g).toBe(2);
    const pieces = splitFrames([img], anchor, as);
    expect(pieces.length).toBeGreaterThan(1);
    const out = createBuffer(img.w, img.h);
    let count = 0;
    for (const p of pieces) {
      const f = p.frames[0]!;
      for (let y = 0; y < f.h; y++) {
        for (let x = 0; x < f.w; x++) {
          const si = (y * f.w + x) * 4;
          if (f.data[si + 3] === 0) continue;
          const di = ((p.y + y) * img.w + p.x + x) * 4;
          expect(out.data[di + 3]).toBe(0); // no overlap
          out.data.set(f.data.subarray(si, si + 4), di);
          count++;
        }
      }
      // piece anchor = source anchor relative to its crop
      expect(p.anchor).toEqual({ x: anchor.x - p.x, y: anchor.y - p.y });
    }
    expect(Buffer.from(out.data).equals(Buffer.from(img.data))).toBe(true);
    expect(count).toBeGreaterThan(0);
  });

  it('front-strip pieces sort correctly against people in front of / behind the facade', () => {
    // 6×2 footprint at (10, 10): pieces are 2×2 squares along i.
    const i0 = 10;
    const j0 = 10;
    for (let a = 0; a < 3; a++) {
      const key = pieceDepthKey(i0 + a * 2, j0, 2);
      // A person on the sidewalk in front of the long (+j) facade, anywhere along it.
      for (let u = i0 + a * 2; u < i0 + a * 2 + 2; u += 0.25) {
        const p = tileToWorld(u, j0 + 2.2);
        expect(depthKey(p.x, p.y)).toBeGreaterThan(key);
      }
      // A person on the street behind it.
      const b = tileToWorld(i0 + a * 2 + 1, j0 - 0.3);
      expect(depthKey(b.x, b.y)).toBeLessThan(key);
    }
  });

  it('trimToContent crops to opaque pixels and moves the anchor', () => {
    const b = createBuffer(10, 10);
    setPixel(b, 3, 4, 0xffffffff >>> 0);
    setPixel(b, 6, 7, 0xffffffff >>> 0);
    const t = trimToContent([b], { x: 5, y: 9 })!;
    expect(t.frames[0]!.w).toBe(4);
    expect(t.frames[0]!.h).toBe(4);
    expect(t.anchor).toEqual({ x: 2, y: 5 });
    expect(trimToContent([createBuffer(3, 3)], { x: 0, y: 0 })).toBeNull();
  });
});
