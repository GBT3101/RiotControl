/** Font specimen sprites for the gallery ('font' group). */
import type { SpriteRegistry } from '../lib/registry';
import { buf, rect } from '../fx/draw';
import { FONTS, drawText, measureText, trackingOf, type BitmapFont } from './text';

const SMALL_LINES = [
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  'abcdefghijklmnopqrstuvwxyz',
  '0123456789 !?¡¿.,:;-+=×\'"/()%#&£€*<>',
  'ÁÉÍÓÚ ÀÈÌÒÙ ÂÊÎÔÛ ÄËÏÖÜ ÑÇ',
  'áéíóú àèìòù âêîôû äëïöü ñç',
  '¡No a todo! Merde alors. Oi! No!',
  'Hate 1,250  Legitimacy 4/10  Wave 12',
];
const LARGE_LINES = [
  'ABCDEFGHIJKLM',
  'NOPQRSTUVWXYZ',
  '0123456789 £€%#&',
  '!?¡¿.,:;-+×\'"/()',
  'ÁÉÍÓÚ ÀÈÒÙ ÂÊÔ ÄÖÜ ÑÇ',
  'ORDER RESTORED!',
];

function specimen(
  font: BitmapFont,
  lines: string[],
  opts: Parameters<typeof drawText>[6],
  colour: string,
): ReturnType<typeof buf> {
  const pad = 6;
  const lh = font.lineHeight + font.ascent + 2;
  const w =
    Math.max(...lines.map((l) => measureText(font, l, undefined, trackingOf(opts ?? {})).w)) +
    pad * 2 +
    2;
  const h = lines.length * lh + pad * 2;
  const b = buf(w, h);
  rect(b, 0, 0, w, h, 'stone4');
  lines.forEach((l, i) => drawText(b, font, l, pad, pad + font.ascent + i * lh, colour, opts));
  return b;
}

export function accentTest(): ReturnType<typeof buf> {
  const b = buf(150, 52);
  rect(b, 0, 0, 150, 52, 'stone4');
  drawText(b, FONTS.small, 'ÁÉÍÓÚ ÑÇ áéíóú ñç ü', 3, 5, 'ink');
  drawText(b, FONTS.large, 'ÁÉÍ ÑÇ Ü', 3, 24, 'ink');
  return b;
}

export function registerFontSpecimens(reg: SpriteRegistry): void {
  reg.add('ui.font.small.specimen', {
    group: 'font',
    frames: specimen(FONTS.small, SMALL_LINES, {}, 'ink'),
    anchor: { x: 0, y: 0 },
  });
  reg.add('ui.font.smallbold.specimen', {
    group: 'font',
    frames: specimen(FONTS.smallBold, SMALL_LINES.slice(0, 3), {}, 'rust0'),
    anchor: { x: 0, y: 0 },
  });
  reg.add('ui.font.mono.specimen', {
    group: 'font',
    frames: specimen(FONTS.mono, SMALL_LINES.slice(0, 6), {}, 'gray1'),
    anchor: { x: 0, y: 0 },
  });
  reg.add('ui.font.large.specimen', {
    group: 'font',
    frames: specimen(
      FONTS.large,
      LARGE_LINES,
      { outline: 'ink', shadow: 'rust0', ramp: ['white', 'stone5', 'stone4', 'stone3'] },
      'stone5',
    ),
    anchor: { x: 0, y: 0 },
  });
}
