/** Type lineup (review image): each protester type × N variants, idle SE frame 0, at 1×. */
import { blit, createBuffer, type PixelBuffer } from '../lib/pixels';
import { renderFigure, GX, GY } from './figure';
import * as A from './anims';
import { PROTESTER_TYPES, rollVariant } from './variants';
import { roadBackground } from './crowd';

export function composeLineup(n = 6, opts: { anim?: 'idle' | 'walk'; frame?: number } = {}): PixelBuffer {
  const cw = 30;
  const ch = 40;
  const W = cw * n + 4;
  const H = ch * PROTESTER_TYPES.length + 4;
  const out = createBuffer(W, H);
  out.data.set(roadBackground(W, H).data);
  PROTESTER_TYPES.forEach((type, row) => {
    const count = type === 'breta' ? 1 : n;
    for (let i = 0; i < count; i++) {
      const v = rollVariant(type, i);
      const spec = opts.anim === 'walk' ? A.walk(v.kit, 'se') : A.idle(v.kit, 'se');
      const f = renderFigure(v.look, 'se', spec.poses[opts.frame ?? 0]!).buf;
      // Work canvas → cell: ground point at the cell's bottom centre.
      const cell = createBuffer(cw, ch);
      blit(cell, f, cw / 2 - GX, ch - 3 - GY);
      blitOpaque(out, cell, 2 + i * cw, 2 + row * ch);
    }
  });
  return out;
}

function blitOpaque(dst: PixelBuffer, src: PixelBuffer, dx: number, dy: number): void {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const si = (y * src.w + x) * 4;
      if (src.data[si + 3]! !== 255) continue;
      const di = ((y + dy) * dst.w + x + dx) * 4;
      for (let c = 0; c < 4; c++) dst.data[di + c] = src.data[si + c]!;
    }
  }
}
