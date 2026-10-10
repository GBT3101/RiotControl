/**
 * Big Ben clock hands (12 minute positions): overlay sprites `lm.capitol.london.hands.l|r`
 * placed on Elizabeth Tower's dials by westminster.ts (E0: moved from fx.ts).
 */
import { resolveColor } from '../../palette';
import { createBuffer, setPixel, type PixelBuffer } from '../../lib/pixels';
import type { SpriteRegistry } from '../../lib/registry';

/** Clock hands on a sheared dial face. side: 'l' (+v face) or 'r' (+u face). Anchor: (8, 8). */
export function clockHands(side: 'l' | 'r', n = 12): PixelBuffer[] {
  const frames: PixelBuffer[] = [];
  const ink = resolveColor('ink');
  const gold = resolveColor('earth1');
  const toScreen = (sxFace: number, dz: number): [number, number] => {
    const dx = side === 'l' ? sxFace : sxFace;
    const y = (side === 'l' ? dx : -dx) / 2 - dz;
    return [8 + dx, 8 + y];
  };
  for (let f = 0; f < n; f++) {
    const buf = createBuffer(17, 17);
    const hand = (ang: number, len: number, col: number): void => {
      for (let t = 0; t <= len; t += 0.25) {
        const [x, y] = toScreen(Math.sin(ang) * t, Math.cos(ang) * t);
        setPixel(buf, Math.round(x - 0.5), Math.round(y - 0.5), col);
      }
    };
    const m = (f / n) * Math.PI * 2;
    hand(m, 5.5, ink);
    hand(Math.PI * 2 * (10 / 12) + m / 12, 3.5, gold);
    setPixel(buf, 8, 8, ink);
    frames.push(buf);
  }
  return frames;
}

export function registerClockHands(reg: SpriteRegistry): void {
  const g = 'landmarks';
  reg.add('lm.capitol.london.hands.l', {
    group: g,
    frames: clockHands('l'),
    fps: 1,
    anchor: { x: 8, y: 8 },
  });
  reg.add('lm.capitol.london.hands.r', {
    group: g,
    frames: clockHands('r'),
    fps: 1,
    anchor: { x: 8, y: 8 },
  });
}
