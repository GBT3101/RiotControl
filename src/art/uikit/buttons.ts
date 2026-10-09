/**
 * Buttons: brass round icon buttons (lg 22 px / sm 18 px — HUD toggles), rectangular
 * "stamp" buttons (any label/width), and the big red "LET THEM COME" button.
 * Every button has 4 states, registered as frames in this order: normal, hover, pressed,
 * disabled (`BUTTON_STATES`). Pressed art sits 1–2 px lower; keep the sprite position fixed.
 */
import type { SpriteRegistry } from '../lib/registry';
import type { PixelBuffer } from '../lib/pixels';
import { buf, disc, ellipse, hline, inEllipse, px, rect, stamp, vline } from '../fx/draw';
import { glyph, GLYPH_NAMES, type GlyphName } from './icons';
import { FONTS, drawText, measureText, type BitmapFont } from './text';

export const BUTTON_STATES = ['normal', 'hover', 'pressed', 'disabled'] as const;
export type ButtonState = (typeof BUTTON_STATES)[number];

interface Skin {
  outline: string;
  hi: string;
  face: string;
  lo: string;
  deep: string;
  well: string;
  wellLo: string;
  glyph: string;
}

const BRASS: Record<ButtonState, Skin> = {
  normal: { outline: 'earth1', hi: 'ochre4', face: 'ochre2', lo: 'ochre1', deep: 'earth3', well: 'navy1', wellLo: 'navy0', glyph: 'stone5' },
  hover: { outline: 'earth1', hi: 'ochre4', face: 'ochre3', lo: 'ochre2', deep: 'ochre1', well: 'navy2', wellLo: 'navy1', glyph: 'white' },
  pressed: { outline: 'earth1', hi: 'ochre1', face: 'ochre2', lo: 'ochre3', deep: 'ochre3', well: 'navy0', wellLo: 'ink', glyph: 'stone4' },
  disabled: { outline: 'gray2', hi: 'gray6', face: 'gray5', lo: 'gray4', deep: 'gray3', well: 'gray3', wellLo: 'gray2', glyph: 'gray5' },
};

/** Round brass button with a glyph in a dark well. size = 'lg' (22×24) or 'sm' (18×20). */
export function roundButton(g: GlyphName | null, state: ButtonState, size: 'lg' | 'sm' = 'lg'): PixelBuffer {
  const D = size === 'lg' ? 22 : 18;
  const b = buf(D, D + 2);
  const s = BRASS[state];
  const dy = state === 'pressed' ? 1 : 0;
  const c = D / 2;
  const R = D / 2 - 0.5;
  // Ground shadow / thickness under the button.
  if (state !== 'pressed') ellipse(b, c, c + 1.5, R, R, s.deep);
  disc(b, c, c + dy, R, s.outline);
  // Ring with upper-left light.
  for (let y = 0; y < D; y++) {
    for (let x = 0; x < D; x++) {
      if (!inEllipse(x, y - dy, c, c, R - 1, R - 1)) continue;
      const lit = !inEllipse(x + 1, y - dy + 1, c, c, R - 1, R - 1) ? s.lo : !inEllipse(x - 1, y - dy - 1, c, c, R - 1, R - 1) ? s.hi : s.face;
      px(b, x, y, lit);
    }
  }
  // Rivet-like studs on the ring (N, E, S, W).
  const r2 = R - 2.5;
  for (const [ux, uy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
    px(b, Math.floor(c + ux * r2), Math.floor(c + uy * r2 + dy), ux + uy < 0 ? s.hi : s.lo);
  }
  // Well.
  const wr = R - (size === 'lg' ? 4 : 3.5);
  disc(b, c, c + dy, wr, s.well);
  for (let y = 0; y < D; y++) {
    for (let x = 0; x < D; x++) {
      if (inEllipse(x, y - dy, c, c, wr, wr) && !inEllipse(x - 1, y - dy - 1, c, c, wr, wr)) px(b, x, y, s.wellLo);
    }
  }
  if (g) {
    const gl = glyph(g, s.glyph, state === 'disabled' ? null : 'ink');
    stamp(b, gl, Math.floor(c - 5.5) + (size === 'sm' ? 0 : 0), Math.floor(c - 5.5) + dy);
  }
  return b;
}

const STAMP: Record<ButtonState, { face: string; hi: string; lo: string; ink: string; base: string }> = {
  normal: { face: 'stone4', hi: 'stone5', lo: 'stone3', ink: 'crim1', base: 'ochre1' },
  hover: { face: 'stone5', hi: 'white', lo: 'stone3', ink: 'crim2', base: 'ochre1' },
  pressed: { face: 'stone3', hi: 'stone2', lo: 'stone4', ink: 'crim1', base: 'ochre1' },
  disabled: { face: 'gray5', hi: 'gray6', lo: 'gray4', ink: 'gray3', base: 'gray3' },
};

/** Rectangular manila "stamp" button: double ink-red border, label in small bold caps. */
export function stampButton(label: string, minW: number, state: ButtonState, font: BitmapFont = FONTS.smallBold): PixelBuffer {
  const w = Math.max(minW, measureText(font, label.toUpperCase()).w + 16);
  const h = font.capHeight + 17;
  const b = buf(w, h + 2);
  const s = STAMP[state];
  const dy = state === 'pressed' ? 2 : 0;
  // Thickness (card stock) under the face.
  rect(b, 1, 2, w - 2, h - 1, s.base);
  rect(b, 1, 1 + dy, w - 2, h - 3, s.face);
  hline(b, 1, 1 + dy, w - 2, s.hi);
  vline(b, 1, 1 + dy, h - 3, s.hi);
  hline(b, 2, h - 3 + dy, w - 3, s.lo);
  vline(b, w - 2, 2 + dy, h - 4, s.lo);
  // Ink outline.
  const top = 0 + dy;
  hline(b, 1, top, w - 2, 'ink');
  hline(b, 1, h, w - 2, 'ink');
  vline(b, 0, top + 1, h - top - 1, 'ink');
  vline(b, w - 1, top + 1, h - top - 1, 'ink');
  // Double rubber-stamp border.
  const bx = 3;
  const by = 3 + dy;
  const bw = w - 6;
  const bh = h - 8;
  for (const [o, ref] of [[0, s.ink], [2, s.ink]] as const) {
    hline(b, bx + o, by + o, bw - o * 2, ref);
    hline(b, bx + o, by + bh - 1 - o, bw - o * 2, ref);
    vline(b, bx + o, by + o, bh - o * 2, ref);
    vline(b, bx + bw - 1 - o, by + o, bh - o * 2, ref);
  }
  const m = measureText(font, label.toUpperCase());
  drawText(b, font, label.toUpperCase(), Math.floor((w - m.w) / 2), by + Math.ceil((bh - font.capHeight) / 2), s.ink);
  return b;
}

const RED: Record<ButtonState, { face: string; hi: string; lo: string; side: string; text: string; shadow: string; trim: string }> = {
  normal: { face: 'crim1', hi: 'crim2', lo: 'rust1', side: 'rust0', text: 'stone5', shadow: 'rust0', trim: 'ochre2' },
  hover: { face: 'crim2', hi: 'rust4', lo: 'crim1', side: 'rust0', text: 'white', shadow: 'rust0', trim: 'ochre3' },
  pressed: { face: 'crim1', hi: 'rust1', lo: 'crim2', side: 'rust0', text: 'stone4', shadow: 'rust0', trim: 'ochre1' },
  disabled: { face: 'gray4', hi: 'gray5', lo: 'gray3', side: 'gray2', text: 'gray6', shadow: 'gray2', trim: 'gray5' },
};

/** Big red physical push-button with a brass trim and display-font label. */
export function bigRedButton(label: string, state: ButtonState, minW = 0): PixelBuffer {
  const f = FONTS.large;
  const m = measureText(f, label);
  const w = Math.max(minW, m.w + 26);
  const faceH = f.capHeight + 12;
  const side = 4;
  const h = faceH + side + 1;
  const b = buf(w, h + 1);
  const s = RED[state];
  const dy = state === 'pressed' ? 3 : 0;
  // Side (depth) of the button.
  rect(b, 1, 3, w - 2, h - 3, s.side);
  // Face.
  rect(b, 1, 1 + dy, w - 2, faceH, s.trim);
  rect(b, 3, 3 + dy, w - 6, faceH - 4, s.face);
  hline(b, 3, 3 + dy, w - 6, s.hi);
  hline(b, 3, 4 + dy, w - 6, s.hi);
  vline(b, 3, 3 + dy, faceH - 4, s.hi);
  hline(b, 4, faceH - 2 + dy, w - 7, s.lo);
  vline(b, w - 4, 4 + dy, faceH - 5, s.lo);
  // Trim highlights.
  hline(b, 2, 1 + dy, w - 4, state === 'disabled' ? 'gray6' : 'ochre4');
  // Outline.
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const i = (y * b.w + x) * 4 + 3;
      if (b.data[i]) continue;
      const n = (xx: number, yy: number): boolean => xx >= 0 && yy >= 0 && xx < b.w && yy < b.h && b.data[(yy * b.w + xx) * 4 + 3]! > 0;
      if (n(x + 1, y) || n(x - 1, y) || n(x, y + 1) || n(x, y - 1)) px(b, x, y, 'ink');
    }
  }
  // Rounded corners.
  for (const [x, y] of [[0, dy], [w - 1, dy], [0, h], [w - 1, h]] as const) b.data.fill(0, (y * b.w + x) * 4, (y * b.w + x) * 4 + 4);
  drawText(b, f, label, Math.floor((w - m.w) / 2), 1 + dy + 6, s.text, { shadow: s.shadow, outline: state === 'disabled' ? undefined : s.shadow, outlineThin: true });
  return b;
}

export function registerButtons(reg: SpriteRegistry): void {
  const frames = (fn: (s: ButtonState) => PixelBuffer): PixelBuffer[] => BUTTON_STATES.map(fn);
  for (const g of ['pause', 'play', 'settings', 'codex', 'close', 'next'] as GlyphName[]) {
    reg.add(`ui.btn.round.${g}`, { group: 'ui', frames: frames((s) => roundButton(g, s, 'lg')), anchor: { x: 0, y: 0 }, tags: ['states'] });
  }
  for (const g of ['pause', 'play', 'speed1', 'speed2', 'speed3', 'sound', 'mute', 'settings', 'codex'] as GlyphName[]) {
    reg.add(`ui.btn.toggle.${g}`, { group: 'ui', frames: frames((s) => roundButton(g, s, 'sm')), anchor: { x: 0, y: 0 }, tags: ['states'] });
  }
  reg.add('ui.btn.stamp.deploy', { group: 'ui', frames: frames((s) => stampButton('Deploy', 56, s)), anchor: { x: 0, y: 0 }, tags: ['states'] });
  reg.add('ui.btn.stamp.callearly', { group: 'ui', frames: frames((s) => stampButton('Call early', 72, s)), anchor: { x: 0, y: 0 }, tags: ['states'] });
  reg.add('ui.btn.stamp.ok', { group: 'ui', frames: frames((s) => stampButton('OK', 36, s)), anchor: { x: 0, y: 0 }, tags: ['states'] });
  reg.add('ui.btn.letthemcome', { group: 'ui', frames: frames((s) => bigRedButton('LET THEM COME', s)), anchor: { x: 0, y: 0 }, tags: ['states'] });
  void GLYPH_NAMES;
}
