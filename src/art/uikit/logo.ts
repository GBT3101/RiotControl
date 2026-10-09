/**
 * Title logo "RIOT CONTROL": stencil "RIOT" (display font ×3, hi-vis paint, navy extrusion,
 * stencil bridges, smoke behind), "CONTROL" (×2) printed on a strip of hazard tape, an
 * "OFFICIAL" rubber stamp. Static + 6-frame glint sweep.
 */
import type { SpriteRegistry } from '../lib/registry';
import type { PixelBuffer } from '../lib/pixels';
import { buf, hline, mask, mget, paintLobes, px, stamp, type Mask } from '../fx/draw';
import { rubberStamp } from './banners';
import { FONTS, measureText, type BitmapFont } from './text';

/** Text → 1-bit mask, integer-scaled. Returns mask + per-glyph x ranges (scaled px). */
export function textMask(font: BitmapFont, str: string, scale: number, spacing = 0): { m: Mask; glyphs: Array<[number, number]> } {
  const chars = [...(font.upperOnly ? str.toUpperCase() : str)];
  let w = 0;
  const xs: Array<[number, number]> = [];
  for (const ch of chars) {
    const g = font.glyphs.get(ch);
    const adv = g ? g.adv + spacing : font.spaceAdv;
    xs.push([w * scale, (w + (g ? g.w : 0)) * scale]);
    w += adv;
  }
  const H = font.capHeight + font.descent;
  const m = mask(w * scale, H * scale);
  let x = 0;
  for (const ch of chars) {
    const g = font.glyphs.get(ch);
    if (g) {
      for (let gy = 0; gy < g.h; gy++) {
        for (let gx = 0; gx < g.w; gx++) {
          if (!g.mask[gy * g.w + gx]) continue;
          const yy = g.y0 + gy;
          if (yy < 0) continue;
          for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) m.m[(yy * scale + sy) * m.w + (x + gx) * scale + sx] = 1;
        }
      }
    }
    x += g ? g.adv + spacing : font.spaceAdv;
  }
  return { m, glyphs: xs };
}

/** Cut a vertical stencil bridge (gap) through a mask: columns [x, x+w), rows [y0, y1). */
function cut(m: Mask, x: number, w: number, y0: number, y1: number): void {
  for (let y = y0; y < y1; y++) for (let i = x; i < x + w; i++) if (i >= 0 && i < m.w && y >= 0 && y < m.h) m.m[y * m.w + i] = 0;
}

interface PaintedWord {
  buf: PixelBuffer;
  face: Mask;
  ox: number;
  oy: number;
}

/** Paint a mask as chunky 3D letters: extrusion, ink outline, banded face, top highlights. */
function paintWord(m: Mask, depth: number, faceRamp: readonly string[], extrude: readonly string[]): PaintedWord {
  const pad = depth + 3;
  const W = m.w + pad * 2;
  const H = m.h + pad * 2;
  const b = buf(W, H);
  const ox = pad - 1;
  const oy = pad - 1;
  // Extrusion (down-right).
  for (let d = depth; d >= 1; d--) {
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) if (m.m[y * m.w + x]) px(b, ox + x + d, oy + y + d, d === depth ? extrude[0]! : extrude[1]!);
    }
  }
  // Ink outline (8-neighbour) around face + extrusion.
  const occ = mask(W, H);
  for (let i = 0; i < W * H; i++) if (b.data[i * 4 + 3]) occ.m[i] = 1;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.m[y * m.w + x]) occ.m[(oy + y) * W + ox + x] = 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (mget(occ, x, y)) continue;
      let n = false;
      for (let dy = -1; dy <= 1 && !n; dy++) for (let dx = -1; dx <= 1 && !n; dx++) if (mget(occ, x + dx, y + dy)) n = true;
      if (n) px(b, x, y, 'ink');
    }
  }
  // Face with vertical bands + 1-px highlight on top edges + 1-px shade on bottom edges.
  const face = mask(W, H);
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      if (!m.m[y * m.w + x]) continue;
      const t = y / m.h;
      let ref = faceRamp[Math.min(faceRamp.length - 1, Math.floor(t * faceRamp.length))]!;
      if (!mget(m, x, y - 1)) ref = 'white';
      else if (!mget(m, x, y + 1)) ref = extrude[1] === 'navy1' ? faceRamp[faceRamp.length - 1]! : ref;
      px(b, ox + x, oy + y, ref);
      face.m[(oy + y) * W + ox + x] = 1;
    }
  }
  return { buf: b, face, ox, oy };
}

/** Hazard / police tape strip with frayed ends. */
function tape(w: number, h: number): PixelBuffer {
  const b = buf(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Frayed zig-zag ends.
      const fray = (y % 4 < 2 ? y % 4 : 3 - (y % 4)) + 1;
      if (x < fray || x >= w - fray) continue;
      let ref = y === 1 ? 'hivis2' : y >= h - 3 ? 'hivis1' : 'hivis2';
      if (y === 2 || y === h - 4) ref = 'ink';
      // Diagonal stripe blocks near both ends.
      const end = x < 22 || x >= w - 22;
      if (end && y > 2 && y < h - 4 && Math.floor((x + y) / 4) % 2 === 0) ref = 'ink';
      if (y === h - 2) ref = 'olive2';
      px(b, x, y, ref);
    }
  }
  // Outline top/bottom.
  for (let x = 0; x < w; x++) {
    const fray0 = 1;
    if (x >= fray0 && x < w - fray0) {
      px(b, x, 0, 'ink');
      px(b, x, h - 1, 'ink');
    }
  }
  return b;
}

export interface LogoParts {
  frame: PixelBuffer;
  /** Face mask of "RIOT" in logo coordinates (for the glint). */
  riotFace: Mask;
  riotAt: { x: number; y: number };
}

function buildLogo(): LogoParts {
  const f = FONTS.large;
  // RIOT ×3 with stencil bridges.
  const riot = textMask(f, 'RIOT', 3, 0);
  const [rX, oX] = [riot.glyphs[0]!, riot.glyphs[2]!];
  cut(riot.m, rX[0] + 6, 2, 0, 6); // R: stem / bowl top
  cut(riot.m, rX[0] + 6, 2, 15, 21); // R: stem / bowl joint
  const oMid = Math.floor((oX[0] + oX[1]) / 2) - 1;
  cut(riot.m, oMid, 2, 0, 7);
  cut(riot.m, oMid, 2, riot.m.h - 16, riot.m.h - 9);
  const tX = riot.glyphs[3]!;
  cut(riot.m, tX[0], tX[1] - tX[0], 6, 7); // T: bar / stem bridge
  const word = paintWord(riot.m, 4, ['hivis2', 'hivis2', 'hivis1', 'hivis1', 'olive2'], ['navy0', 'navy1']);
  // CONTROL ×2 on tape.
  const ctl = textMask(f, 'CONTROL', 2, 0);
  const W = 232;
  const tapeH = ctl.m.h - f.descent * 2 + 12;
  const H = 96;
  const out = buf(W, H);
  // Smoke behind (three clusters).
  const SM = ['gray2', 'gray3', 'gray4', 'gray5', 'gray6'];
  paintLobes(out, [
    { x: 40, y: 22, r: 9 }, { x: 28, y: 30, r: 8 }, { x: 52, y: 14, r: 6 }, { x: 20, y: 20, r: 5 },
  ], { ramp: SM, outlineLit: 'gray2' });
  paintLobes(out, [
    { x: 182, y: 20, r: 10 }, { x: 198, y: 28, r: 8 }, { x: 170, y: 10, r: 6 }, { x: 206, y: 14, r: 5 },
  ], { ramp: SM, outlineLit: 'gray2' });
  paintLobes(out, [{ x: 112, y: 9, r: 6 }, { x: 122, y: 6, r: 4 }, { x: 102, y: 7, r: 4 }], { ramp: SM, outlineLit: 'gray2' });
  const rx = Math.floor((W - word.buf.w) / 2) + 2;
  const ry = 4;
  stamp(out, word.buf, rx, ry);
  // Tape strip, overlapping the bottom of RIOT.
  const ty = ry + word.buf.h - 10;
  const tp = tape(W - 4, tapeH);
  stamp(out, tp, 2, ty);
  // CONTROL in ink on the tape, with a 1-px hivis1 cut-out shadow.
  const cx = Math.floor((W - ctl.m.w) / 2);
  const cy = ty + 6;
  for (let y = 0; y < ctl.m.h; y++) {
    for (let x = 0; x < ctl.m.w; x++) {
      if (!ctl.m.m[y * ctl.m.w + x]) continue;
      px(out, cx + x + 1, cy + y + 1, 'olive2');
    }
  }
  for (let y = 0; y < ctl.m.h; y++) {
    for (let x = 0; x < ctl.m.w; x++) if (ctl.m.m[y * ctl.m.w + x]) px(out, cx + x, cy + y, 'ink');
  }
  // OFFICIAL stamp, slapped over the top-right of RIOT.
  const st = rubberStamp('OFFICIAL', 'crim2', { font: FONTS.smallBold, tilt: -0.12, wear: 0.4, seed: 5 });
  stamp(out, st, rx + word.buf.w - 22, ry + 2);
  // Hi-vis reflective strip highlight along the tape top.
  hline(out, 6, ty + 1, W - 12, 'hivis2');
  const riotFace = mask(W, H);
  for (let y = 0; y < word.face.h; y++) for (let x = 0; x < word.face.w; x++) if (word.face.m[y * word.face.w + x]) riotFace.m[(y + ry) * W + x + rx] = 1;
  return { frame: out, riotFace, riotAt: { x: rx, y: ry } };
}

/** Glint frames: a diagonal white sheen sweeping across RIOT (6 frames, first = none). */
function glintFrames(parts: LogoParts): PixelBuffer[] {
  const { frame, riotFace } = parts;
  const x0 = parts.riotAt.x;
  return [-99, 0, 30, 60, 90, 120].map((p) => {
    const b = { w: frame.w, h: frame.h, data: new Uint8ClampedArray(frame.data) };
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        if (!riotFace.m[y * b.w + x]) continue;
        const d = x - x0 - p + y * 0.6;
        if (d >= 0 && d < 3) px(b, x, y, 'white');
        else if (d >= 3 && d < 5) px(b, x, y, 'ochre4');
      }
    }
    return b;
  });
}

export function logoFrames(): PixelBuffer[] {
  return glintFrames(buildLogo());
}

export function registerLogo(reg: SpriteRegistry): void {
  const frames = logoFrames();
  reg.add('ui.logo', { group: 'ui', frames: frames[0]!, anchor: { x: Math.floor(frames[0]!.w / 2), y: 0 } });
  reg.add('ui.logo.glint', { group: 'ui', frames, fps: 12, anchor: { x: Math.floor(frames[0]!.w / 2), y: 0 } });
  void measureText;
}
