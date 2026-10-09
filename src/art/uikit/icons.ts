/**
 * HUD icons, button glyphs and cursors. Glyphs are 9×9 masks coloured at build time
 * (`glyph(name, colour, shadow)`), used inside round buttons and toggles.
 */
import { grid, type KeyMap } from '../lib/grid';
import type { SpriteRegistry } from '../lib/registry';
import type { PixelBuffer } from '../lib/pixels';
import { buf, ellipse, outlineBuf, px, rect, stamp } from '../fx/draw';
import { FONTS, drawText } from './text';
import { waxSeal } from '../fx/misc';
import {
  CAPITOL,
  CURSOR_ATTACK,
  CURSOR_DENY,
  CURSOR_DEPLOY,
  CURSOR_MOVE,
  CURSOR_POINTER,
  GLYPHS,
  GRENADE,
  HATE,
  HATE_TINY,
  MEGAPHONE,
  PADLOCK,
  PROPHET_WARN,
  STOPWATCH,
} from './icons.grid';

/** Crowd: three protesters (back two darker), the middle one waving a sign (13×13). */
function crowdIcon(): PixelBuffer {
  const b = buf(15, 14);
  // Sign on a pole behind the middle head.
  rect(b, 7, 1, 1, 6, 'earth3');
  rect(b, 4, 1, 7, 3, 'stone5');
  px(b, 5, 2, 'crim2');
  px(b, 6, 2, 'crim2');
  px(b, 8, 2, 'crim2');
  px(b, 9, 2, 'crim2');
  const people: Array<[number, number, string, string, string]> = [
    // x, y(head top), body, body shade, skin
    [2, 5, 'blue1', 'navy2', 'earth3'],
    [10, 5, 'green3', 'green2', 'earth5'],
    [6, 6, 'pink1', 'plum1', 'earth6'],
  ];
  for (const [x, y, c, cs, sk] of people) {
    rect(b, x, y, 3, 3, sk);
    px(b, x + 2, y + 2, 'earth2');
    rect(b, x - 1, y + 3, 5, 13 - (y + 3), c);
    rect(b, x + 2, y + 4, 2, 13 - (y + 4), cs);
  }
  outlineBuf(b, 'ink');
  return b;
}

const HEART_KEYS: KeyMap = { o: 'rust0', C: 'crim2', c: 'crim1', k: 'rust0', W: 'rust4' };

export const ICONS = {
  hate: (): PixelBuffer => grid(HATE, HEART_KEYS, {}, 'hate'),
  hateTiny: (): PixelBuffer => grid(HATE_TINY, HEART_KEYS, {}, 'hateTiny'),
  legit: (): PixelBuffer => waxSeal(5),
  capitol: (): PixelBuffer => grid(CAPITOL, { o: 'ink', W: 'white', S: 'stone4', s: 'stone3' }, {}, 'capitol'),
  wave: (): PixelBuffer => grid(MEGAPHONE, { o: 'ink', R: 'crim2', r: 'crim1', W: 'stone5', B: 'gray3' }, {}, 'megaphone'),
  crowd: crowdIcon,
  timer: (): PixelBuffer => grid(STOPWATCH, { o: 'ink', W: 'stone5', s: 'stone3', B: 'ochre2' }, {}, 'stopwatch'),
  padlock: (): PixelBuffer =>
    grid(PADLOCK, { o: 'ink', Z: 'zinc3', z: 'zinc2', B: 'ochre2', b: 'ochre1', Y: 'ochre3' }, {}, 'padlock'),
  grenade: (): PixelBuffer => grid(GRENADE, { o: 'ink', Z: 'zinc4', z: 'zinc2', G: 'green3', g: 'green2', L: 'lime' }, {}, 'grenade'),
  prophets: (): PixelBuffer => grid(PROPHET_WARN, { o: 'ink', Y: 'hivis2', r: 'crim2' }, {}, 'prophets'),
};

/** A 9×9 button glyph in `colour` with a 1-px drop shadow (11×11 result, glyph at 1,1). */
export function glyph(name: GlyphName, colour = 'stone5', shadow: string | null = 'ink'): PixelBuffer {
  if (name === 'speed1' || name === 'speed2' || name === 'speed3') {
    const b = buf(11, 11);
    const t = `${name.slice(5)}×`;
    drawText(b, FONTS.small, t, 1, 2, colour, shadow ? { shadow } : {});
    return b;
  }
  const g = grid(GLYPHS[name]!, { X: colour }, {}, `glyph.${name}`);
  const b = buf(11, 11);
  if (shadow) {
    const s = grid(GLYPHS[name]!, { X: shadow }, {}, `glyph.${name}`);
    stamp(b, s, 2, 2);
  }
  stamp(b, g, 1, 1);
  return b;
}

export type GlyphName = keyof typeof GLYPHS | 'speed1' | 'speed2' | 'speed3';
export const GLYPH_NAMES: GlyphName[] = [...(Object.keys(GLYPHS) as GlyphName[]), 'speed1', 'speed2', 'speed3'];

/** Ability-charged indicator: grenade bouncing with a squash and a ground shadow (4 frames). */
function abilityFrames(): PixelBuffer[] {
  const g = ICONS.grenade();
  return [0, -3, -4, -2].map((dy, f) => {
    const b = buf(13, 17);
    ellipse(b, 6.5, 15.5, f === 0 ? 4 : 3, 1.2, 'ink');
    stamp(b, g, 2, 5 + dy);
    if (f === 2) {
      // Glint at the top of the bounce.
      px(b, 11, 2, 'white');
      px(b, 12, 2, 'ochre4');
      px(b, 11, 1, 'ochre4');
    }
    return b;
  });
}

const CURSOR_KEYS: KeyMap = { o: 'ink', W: 'white', Y: 'hivis2', R: 'crim2', B: 'ochre2', b: 'ochre1', r: 'crim1' };

/** Cursor sprites and their hotspots (anchor). */
export const CURSORS: Record<string, { src: string; hot: { x: number; y: number } }> = {
  pointer: { src: CURSOR_POINTER, hot: { x: 0, y: 0 } },
  move: { src: CURSOR_MOVE, hot: { x: 6, y: 12 } },
  attack: { src: CURSOR_ATTACK, hot: { x: 6, y: 6 } },
  deny: { src: CURSOR_DENY, hot: { x: 5, y: 5 } },
  deploy: { src: CURSOR_DEPLOY, hot: { x: 8, y: 10 } },
};

export function registerIcons(reg: SpriteRegistry): void {
  const centre = (b: PixelBuffer): { x: number; y: number } => ({ x: Math.floor(b.w / 2), y: Math.floor(b.h / 2) });
  for (const [name, make] of Object.entries(ICONS)) {
    if (name === 'prophets' || name === 'grenade') continue;
    const b = make();
    reg.add(`ui.icon.${name === 'hateTiny' ? 'hate.tiny' : name}`, { group: 'ui', frames: b, anchor: centre(b) });
  }
  reg.add('ui.icon.ability', { group: 'ui', frames: abilityFrames(), fps: 8, anchor: { x: 6, y: 15 } });
  const pw = ICONS.prophets();
  reg.add('ui.icon.prophets', { group: 'portraits-ui', frames: pw, anchor: centre(pw) });
  for (const n of GLYPH_NAMES) reg.add(`ui.glyph.${n}`, { group: 'ui', frames: glyph(n), anchor: { x: 5, y: 5 } });
  for (const [n, c] of Object.entries(CURSORS)) {
    reg.add(`ui.cursor.${n}`, { group: 'ui', frames: grid(c.src, CURSOR_KEYS, {}, `cursor.${n}`), anchor: c.hot });
  }
}
