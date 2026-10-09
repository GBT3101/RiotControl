/** Shared screen pieces: dossier folders, dithered vignette bands, headings. */
import { buf, px, rect, stamp } from '../../art/fx/draw';
import type { PixelBuffer } from '../../art/lib/pixels';
import { rubberStamp } from '../../art/uikit/banners';
import { PAPERCLIP, folderTab, panel } from '../../art/uikit/panels';
import { FONTS, drawText, measureText } from '../../art/uikit/text';

/** Manila folder with a typed tab label on top (tab height 10 included in the buffer). */
export function dossier(w: number, h: number, tab: string, clip = true): PixelBuffer {
  const b = buf(w, h + 10);
  const tw = Math.min(w - 40, Math.max(46, measureText(FONTS.small, tab).w + 14));
  stamp(b, panel('manila', w, h), 0, 10);
  // Folder tab sticks up above the folder; its label sits fully on the tab.
  const tab8 = folderTab(tw);
  stamp(b, tab8, 8, 2);
  rect(b, 9, 9, tw - 2, 2, 'stone4');
  drawText(
    b,
    FONTS.small,
    tab,
    8 + Math.floor((tw - measureText(FONTS.small, tab).w) / 2),
    3,
    'earth2',
  );
  if (clip) stamp(b, PAPERCLIP, w - 22, 6);
  return b;
}

/** Display heading: large font, title ramp, ink outline, rust shadow (M5 recipe). */
export function heading(text: string, colour = 'white'): PixelBuffer {
  const m = measureText(FONTS.large, text, undefined, 1);
  const b = buf(m.w + 8, m.h + 8);
  drawText(b, FONTS.large, text, 2, 2, colour, {
    outline: 'ink',
    shadow: 'rust0',
    ramp: ['white', 'stone5', 'stone4'],
  });
  return b;
}

/** Ordered-dither vignette band (ink) fading from opaque at `from` edge to clear. */
export function ditherBand(
  w: number,
  h: number,
  from: 'top' | 'bottom',
  colour = 'ink',
): PixelBuffer {
  const b = buf(w, h);
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < h; y++) {
    const t = from === 'top' ? 1 - y / h : y / h;
    const level = Math.floor(t * 17);
    for (let x = 0; x < w; x++) {
      if (bayer[(y & 3) * 4 + (x & 3)]! < level) px(b, x, y, colour);
    }
  }
  return b;
}

/** "CLASSIFIED"-style stamp helper with a fixed seed. */
export function stampOf(text: string, ink: string, tilt = -0.08, seed = 1): PixelBuffer {
  return rubberStamp(text, ink, { tilt, seed, font: FONTS.smallBold });
}

/** Thin typed line (label: value) on a paper background, returns width used. */
export function typed(
  b: PixelBuffer,
  label: string,
  value: string,
  x: number,
  y: number,
  w: number,
  colour = 'gray1',
): void {
  drawText(b, FONTS.mono, label, x, y, colour);
  const vm = measureText(FONTS.smallBold, value);
  drawText(b, FONTS.smallBold, value, x + w - vm.w, y, 'ink');
  const lw = measureText(FONTS.mono, label).w;
  for (let dx = x + lw + 3; dx < x + w - vm.w - 3; dx += 2) px(b, dx, y + 6, 'stone2');
}

export { rect };
