/**
 * Per-city monumental step tiles for the contract's 'steps' ground tiles in front of each
 * Capitol (32×16 diamond, anchor {16, 0} like every ground tile). The nosings run parallel to
 * the facade (along i), four shallow steps per tile, in the Capitol's own stone.
 */
import { inTileDiamond } from '../../core/iso';
import { resolveColor } from '../palette';
import { createBuffer, setPixel, type PixelBuffer } from '../lib/pixels';
import type { CityId } from '../../maps/contract';
import { R, type Ramp5 } from './engine/materials';

const STONE: Record<CityId, Ramp5> = {
  madrid: R.granite,
  london: R.granite,
  paris: R.limePale,
};

export function stepTile(city: CityId): PixelBuffer {
  const r = STONE[city];
  const out = createBuffer(32, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      if (!inTileDiamond(x, y)) continue;
      const sx = x + 0.5 - 16;
      const sy = y + 0.5;
      const u = (sy / 8 + sx / 16) / 2;
      const v = (sy / 8 - sx / 16) / 2;
      const f = (v * 4) % 1; // position within a step (0 back → 1 front edge)
      let tone: number;
      if (f > 0.78) tone = 1; // riser in shade below the nosing
      else if (f > 0.62) tone = 4; // lit nosing
      else tone = 3; // tread
      // Slab joints across the treads.
      if (tone === 3 && (u * 2) % 1 < 0.06) tone = 2;
      setPixel(out, x, y, resolveColor(r[tone]!));
    }
  }
  return out;
}
