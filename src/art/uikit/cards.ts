/**
 * Deploy cards (unit bar) and HUD meters.
 *
 * deployCard({ portrait, cost, hotkey, state, level }) → 38×50 buffer (card 34×46 at (2,2);
 * 'selected' lifts it 2 px and adds a hi-vis glow). With `figure` the picture window is 30×29
 * at card (2,2) and shows the whole unit (cardFigures.ts); the legacy `portrait` slot is 28×26
 * at card (3,3) with bottom-centred busts. States: ready | unaffordable | locked | selected.
 *
 * legitMeter(progress, level, w), integrityMeter(frac, w), abilityRing(step 0..10).
 */
import type { SpriteRegistry } from '../lib/registry';
import type { PixelBuffer } from '../lib/pixels';
import { grid } from '../lib/grid';
import { buf, col, hline, line, prng, px, rect, stamp, vline } from '../fx/draw';
import { waxSeal } from '../fx/misc';
import { drawFigureWindow, type CardFigure } from './cardFigures';
import { ICONS } from './icons';
import { FONTS, drawText, measureText } from './text';

export type CardState = 'ready' | 'unaffordable' | 'locked' | 'selected';
export const CARD_W = 38;
export const CARD_H = 50;
export const PORTRAIT_SLOT = { x: 5, y: 5, w: 28, h: 26 };

/** Placeholder bust: riot officer (helmet, raised visor, hi-vis collar), 24×22. */
export const OFFICER_BUST = grid(
  `
  ........oooooooo........
  ......ooNNNNNNnnoo......
  .....oNNBBNNNNNnnno.....
  ....oNNBBNNNNNNNnnno....
  ....oNNNNNNNNNNNnnno....
  ...oNNNNNNNNNNNNNnnno...
  ...oVVVVVVVVVVVVVVvvo...
  ...ovVVVVVVVVVVVVvvvo...
  ...oNoooooooooooooono...
  ...oNoSSSSSSSSSSsoono...
  ...oNoSSeSSSSeSSsoono...
  ...oNoSSSSSSSSSssoono...
  ...ooNoSSSSmmSSsoNnoo...
  ....oNNoSSSSSSsoNNno....
  ....ooNNoooooooNNnoo....
  ..ooYYYYoNNNNNoYYYYoo...
  .oYYYYYYYoNNNoYYYYYYyo..
  oYYYYYYYYYoNoYYYYYYYyyo.
  oNNNYYYYYYYoYYYYYYYyNNo.
  oNNNNNYYYYYYYYYYYyyNNNo.
  oNNNNNNNNNNNNNNNNNNNNNNo
  oNNNNNNNNNNNNNNNNNNNNNNo
`,
  {
    o: 'ink',
    N: 'navy2',
    n: 'navy1',
    B: 'blue1',
    V: 'zinc4',
    v: 'zinc3',
    S: 'earth5',
    s: 'earth4',
    e: 'ink',
    m: 'earth3',
    Y: 'hivis1',
    y: 'olive2',
  },
);

/** Greyscale remap (unaffordable): luminance → gray ramp. */
function greyed(src: PixelBuffer): PixelBuffer {
  const ramp = ['ink', 'gray1', 'gray2', 'gray3', 'gray4', 'gray5', 'gray6'].map((r) => col(r));
  const out = buf(src.w, src.h);
  for (let i = 0; i < src.data.length; i += 4) {
    if (src.data[i + 3] !== 255) continue;
    const l = 0.3 * src.data[i]! + 0.59 * src.data[i + 1]! + 0.11 * src.data[i + 2]!;
    const c = ramp[Math.min(6, Math.floor((l / 256) * 7.5))]!;
    out.data[i] = c >>> 24;
    out.data[i + 1] = (c >>> 16) & 255;
    out.data[i + 2] = (c >>> 8) & 255;
    out.data[i + 3] = 255;
  }
  return out;
}

function silhouetteOf(src: PixelBuffer, ref: string, rim: string): PixelBuffer {
  const out = buf(src.w, src.h);
  const c = col(ref);
  for (let i = 0; i < src.data.length; i += 4) {
    if (src.data[i + 3] !== 255) continue;
    out.data[i] = c >>> 24;
    out.data[i + 1] = (c >>> 16) & 255;
    out.data[i + 2] = (c >>> 8) & 255;
    out.data[i + 3] = 255;
  }
  // Faint rim light on the top edge so the shape still reads.
  for (let y = 1; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4 + 3;
      if (out.data[i] && !out.data[((y - 1) * src.w + x) * 4 + 3]) px(out, x, y, rim);
    }
  }
  return out;
}

/** Width of the tiny Hate face on the cards' cost strips. */
export const HATE_FACE_W = 8;

/**
 * Cost strip of a card face `W` px wide starting at `x0`: the tiny Hate face at `faceInset` and
 * the cost right-aligned `rightInset` px from the edge, at least 1 px apart. Wide costs nudge
 * the face 1 px left, then drop it (the number is centred). Pure (unit-tested for every cost).
 */
export function costStrip(
  cost: number,
  x0: number,
  W: number,
  faceInset: number,
  rightInset: number,
): { text: string; textX: number; textW: number; faceX: number | null } {
  const text = String(cost);
  const tw = measureText(FONTS.smallBold, text).w;
  const textX = x0 + W - rightInset - tw;
  for (const fx of [x0 + faceInset, x0 + faceInset - 1]) {
    if (fx > x0 && textX - (fx + HATE_FACE_W) >= 1) return { text, textX, textW: tw, faceX: fx };
  }
  return { text, textX: x0 + Math.floor((W - 1 - tw) / 2), textW: tw, faceX: null };
}

/** "LVL n" badge text, shortened ("LV n", "Ln") until it fits `maxW` px. */
export function lockLabel(level: number | undefined, maxW: number): string {
  const n = level ?? '?';
  const tries = [`LVL ${n}`, `LV ${n}`, `L${n}`];
  return tries.find((t) => measureText(FONTS.smallBold, t).w <= maxW) ?? tries[2]!;
}

export interface CardSpec {
  /** Legacy bust (bottom-centred in a 28×26 slot); ignored when `figure` is given. */
  portrait?: PixelBuffer | null;
  /**
   * Whole-unit figure (src/art/uikit/cardFigures.ts) in the full-width window; `null` = empty
   * backdrop while the unit's art loads. Leave undefined for the legacy bust slot.
   */
  figure?: CardFigure | null;
  cost: number;
  hotkey?: string;
  state: CardState;
  /** Unlock level, shown on locked cards. */
  level?: number;
}

export function deployCard(spec: CardSpec): PixelBuffer {
  const b = buf(CARD_W, CARD_H);
  const st = spec.state;
  const lift = st === 'selected' ? -2 : 0;
  const x0 = 2;
  const y0 = 2 + lift;
  const W = 34;
  const H = 46;
  const dim = st === 'locked' || st === 'unaffordable';
  const face = st === 'locked' ? 'stone2' : dim ? 'stone3' : 'stone4';
  const hi = st === 'locked' ? 'stone3' : dim ? 'stone4' : 'stone5';
  const lo = st === 'locked' ? 'stone1' : dim ? 'stone2' : 'stone3';
  // Selected glow (hi-vis, 2 px) behind the card + drop under it.
  if (st === 'selected') {
    rect(b, 0, y0 - 2 + 1, CARD_W, H + 3, 'hivis1');
    rect(b, 1, y0 - 1, CARD_W - 2, H + 2, 'hivis2');
  }
  // Card thickness + face.
  rect(b, x0, y0 + 1, W, H, 'ochre1');
  rect(b, x0, y0, W - 1, H - 1, face);
  hline(b, x0, y0, W - 1, hi);
  vline(b, x0, y0, H - 1, hi);
  hline(b, x0 + 1, y0 + H - 2, W - 2, lo);
  vline(b, x0 + W - 2, y0 + 1, H - 2, lo);
  // Outline.
  hline(b, x0, y0 - 1, W, 'ink');
  hline(b, x0, y0 + H + 1 - 1, W, 'ink');
  vline(b, x0 - 1, y0, H, 'ink');
  vline(b, x0 + W, y0, H, 'ink');
  // Picture window (dark recess with an inner top/left shadow and a lit lower lip).
  let sx = x0 + 3;
  let sy = y0 + 3;
  let slotCx = sx + 14;
  if (spec.figure !== undefined) {
    // Whole-unit figure: the window grows to the face's full width so the unit fits at 1×.
    sx = x0 + 1;
    sy = y0 + 1;
    slotCx = sx + 16;
    hline(b, sx, sy, 31, 'ink');
    vline(b, sx, sy, 30, 'ink');
    hline(b, sx, sy + 30, 31, hi);
    drawFigureWindow(b, { x: sx + 1, y: sy + 1, w: 30, h: 29 }, spec.figure, st, 'card');
  } else {
    rect(b, sx, sy, 28, 26, st === 'locked' ? 'gray1' : 'navy0');
    hline(b, sx, sy, 28, 'ink');
    vline(b, sx, sy, 26, 'ink');
    hline(b, sx, sy + 26, 28, hi);
    // Faint ministry grid lines in the slot background.
    for (let x = sx + 4; x < sx + 28; x += 6)
      vline(b, x, sy + 1, 25, st === 'locked' ? 'gray2' : 'navy1');
    let portrait = spec.portrait ?? OFFICER_BUST;
    if (st === 'unaffordable') portrait = greyed(portrait);
    if (st === 'locked') portrait = silhouetteOf(portrait, 'ink', 'gray2');
    const px0 = sx + Math.floor((28 - portrait.w) / 2);
    const py0 = sy + 26 - Math.min(26, portrait.h);
    // Clip portrait to the slot.
    for (let y = 0; y < portrait.h; y++) {
      for (let x = 0; x < portrait.w; x++) {
        const tx = px0 + x;
        const ty = py0 + y;
        if (tx < sx || ty < sy + 1 || tx >= sx + 28 || ty >= sy + 26) continue;
        const i = (y * portrait.w + x) * 4;
        if (portrait.data[i + 3] !== 255) continue;
        b.data.set(portrait.data.subarray(i, i + 4), (ty * b.w + tx) * 4);
      }
    }
  }
  // Cost strip.
  const cy = y0 + 32;
  if (st === 'locked') {
    const pl = ICONS.padlock();
    stamp(b, pl, slotCx - Math.floor(pl.w / 2), sy + 7);
    // "LVL n" red rubber stamp across the strip (shortened so it stays inside the card).
    const t = lockLabel(spec.level, W - 6);
    const m = measureText(FONTS.smallBold, t);
    const bx = x0 + Math.floor((W - m.w) / 2) - 3;
    rect(b, bx, cy + 1, m.w + 6, 11, 'crim1');
    rect(b, bx + 1, cy + 2, m.w + 4, 9, face);
    drawText(b, FONTS.smallBold, t, bx + 3, cy + 3, 'crim1');
  } else {
    const cs = costStrip(spec.cost, x0, W, 3, 4);
    if (cs.faceX !== null) stamp(b, ICONS.hateTiny(), cs.faceX, cy + 2);
    drawText(
      b,
      FONTS.smallBold,
      cs.text,
      cs.textX,
      cy + 3,
      st === 'unaffordable' ? 'crim2' : 'ink',
    );
    // Dotted leader between the angry face and cost (typewriter form field).
    if (cs.faceX !== null)
      for (let x = cs.faceX + HATE_FACE_W + 1; x < cs.textX - 2; x += 2) px(b, x, cy + 9, lo);
  }
  // Hotkey tab (brass) over the top-left corner.
  if (spec.hotkey) {
    rect(b, x0 - 2, y0 - 2, 9, 10, 'ink');
    rect(b, x0 - 1, y0 - 1, 7, 8, st === 'locked' ? 'gray5' : 'ochre2');
    hline(b, x0 - 1, y0 - 1, 7, st === 'locked' ? 'gray6' : 'ochre4');
    hline(b, x0 - 1, y0 + 6, 7, st === 'locked' ? 'gray4' : 'ochre1');
    const m = measureText(FONTS.small, spec.hotkey);
    drawText(b, FONTS.small, spec.hotkey, x0 - 1 + Math.floor((7 - m.w) / 2), y0, 'earth1');
  }
  return b;
}

/* Meters ------------------------------------------------------------------- */

/** Legitimacy: gold wax seal with the level number + gold progress bar with 10% ticks. */
export function legitMeter(progress: number, level: number, w = 96): PixelBuffer {
  const b = buf(w, 18);
  const tx = 12;
  const tw = w - tx - 1;
  // Track.
  rect(b, tx, 4, tw, 10, 'ink');
  rect(b, tx + 1, 5, tw - 2, 8, 'earth0');
  hline(b, tx + 1, 5, tw - 2, 'ink');
  const fw = Math.round((tw - 2) * Math.max(0, Math.min(1, progress)));
  if (fw > 0) {
    rect(b, tx + 1, 6, fw, 7, 'ochre2');
    hline(b, tx + 1, 6, fw, 'ochre4');
    hline(b, tx + 1, 7, fw, 'ochre3');
    hline(b, tx + 1, 11, fw, 'ochre1');
    hline(b, tx + 1, 12, fw, 'earth3');
    if (fw > 2) vline(b, tx + fw, 6, 7, 'ochre4');
  }
  for (let i = 1; i < 10; i++) {
    const x = tx + 1 + Math.round(((tw - 2) * i) / 10);
    px(b, x, 12, fw >= x - tx ? 'earth3' : 'earth1');
    px(b, x, 6, fw >= x - tx ? 'ochre3' : 'earth1');
  }
  // Brass end cap.
  rect(b, w - 3, 3, 3, 12, 'ink');
  vline(b, w - 2, 4, 10, 'ochre2');
  // Seal with the level number on a recessed wax plate (M13a: 0–10 read at 1×).
  stamp(b, levelSeal(level), -1, 0);
  return b;
}

/** 3×5 seal numerals (embossed on the Legitimacy seal plate). */
const SEAL_DIGITS: Record<string, readonly string[]> = {
  '0': ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'],
  '1': ['.X', 'XX', '.X', '.X', '.X'],
  '2': ['XXX', '..X', 'XXX', 'X..', 'XXX'],
  '3': ['XXX', '..X', '.XX', '..X', 'XXX'],
  '4': ['X.X', 'X.X', 'XXX', '..X', '..X'],
  '5': ['XXX', 'X..', 'XXX', '..X', 'XXX'],
  '6': ['XXX', 'X..', 'XXX', 'X.X', 'XXX'],
  '7': ['XXX', '..X', '..X', '.X.', '.X.'],
  '8': ['XXX', 'X.X', 'XXX', 'X.X', 'XXX'],
  '9': ['XXX', 'X.X', 'XXX', '..X', 'XXX'],
};

/**
 * Gold seal (18×18, scalloped) with a dark recessed plate carrying the level number in
 * 3×5 numerals: light gold on dark wax, a lit lower-right lip and a shaded upper-left lip.
 * Two digits ("10") fit with a 1-px margin.
 */
export function levelSeal(level: number): PixelBuffer {
  const b = waxSeal(7, 1, false);
  const t = String(Math.max(0, Math.min(99, Math.round(level))));
  const glyphs = [...t].map((c) => SEAL_DIGITS[c] ?? SEAL_DIGITS['0']!);
  const tw = glyphs.reduce((w, g) => w + g[0]!.length, 0) + glyphs.length - 1;
  // Plate: rounded rectangle around the numerals (+2 px each side, +1 px top/bottom).
  const pw = Math.max(7, tw + 4);
  const ph = 7;
  const px0 = Math.floor((b.w - pw) / 2);
  const py0 = Math.floor((b.h - ph) / 2);
  const inPlate = (x: number, y: number): boolean => {
    const lx = x - px0;
    const ly = y - py0;
    if (lx < 0 || ly < 0 || lx >= pw || ly >= ph) return false;
    const corner = (lx === 0 || lx === pw - 1) && (ly === 0 || ly === ph - 1);
    return !corner;
  };
  for (let y = py0 - 1; y <= py0 + ph; y++) {
    for (let x = px0 - 1; x <= px0 + pw; x++) {
      if (inPlate(x, y)) {
        // Shaded upper-left inner wall, dark wax floor.
        px(b, x, y, !inPlate(x - 1, y) || !inPlate(x, y - 1) ? 'earth0' : 'earth1');
      } else if (inPlate(x - 1, y) || inPlate(x, y - 1) || inPlate(x - 1, y - 1)) {
        px(b, x, y, 'ochre4'); // lit lower-right lip
      } else if (inPlate(x + 1, y) || inPlate(x, y + 1)) {
        px(b, x, y, 'ochre1'); // shaded upper-left lip
      }
    }
  }
  let x = px0 + Math.floor((pw - tw) / 2);
  const y0 = py0 + 1;
  for (const g of glyphs) {
    g.forEach((row, j) =>
      [...row].forEach((k, i) => {
        if (k === 'X') px(b, x + i, y0 + j, j === 0 ? 'ochre4' : 'ochre3');
      }),
    );
    x += g[0]!.length + 1;
  }
  return b;
}

/** Capitol integrity: pediment icon + marble bar that cracks (and reddens) as it drops. */
export function integrityMeter(frac: number, w = 96): PixelBuffer {
  const f = Math.max(0, Math.min(1, frac));
  const b = buf(w, 16);
  const tx = 12;
  const tw = w - tx - 1;
  rect(b, tx, 3, tw, 10, 'ink');
  rect(b, tx + 1, 4, tw - 2, 8, 'gray1');
  const fw = Math.round((tw - 2) * f);
  const [c0, c1, c2, c3] =
    f > 0.5
      ? ['white', 'stone5', 'stone4', 'stone3']
      : f > 0.25
        ? ['stone5', 'stone4', 'ochre2', 'ochre1']
        : ['rust4', 'crim2', 'crim1', 'rust0'];
  if (fw > 0) {
    rect(b, tx + 1, 4, fw, 8, c1);
    hline(b, tx + 1, 4, fw, c0);
    hline(b, tx + 1, 10, fw, c2);
    hline(b, tx + 1, 11, fw, c3);
    // Marble veins.
    for (let x = tx + 5; x < tx + fw - 2; x += 9) {
      px(b, x, 6, c2);
      px(b, x + 1, 7, c2);
      px(b, x + 3, 7, c2);
    }
  }
  // Cracks: more as integrity drops (seeded positions, zig-zag through the frame).
  const cracks = Math.floor((1 - f) * 5.5);
  const rnd = prng(99);
  for (let i = 0; i < cracks; i++) {
    const x = tx + 6 + Math.floor(rnd() * (tw - 12));
    let cx = x;
    const len = 5 + Math.floor(rnd() * 6);
    for (let y = 3; y < 3 + len; y++) {
      const filled = cx < tx + 1 + fw;
      px(b, cx, y, filled ? 'ink' : 'gray4');
      if (y === 6 && filled) px(b, cx + 1, y + 1, 'stone2');
      if (y % 2 === 1) cx += rnd() < 0.5 ? -1 : 1;
    }
    // Chip out of the top edge.
    px(b, x + 1, 2, 'ink');
  }
  const icon = ICONS.capitol();
  stamp(b, icon, -1, 2);
  return b;
}

/** Ability charge ring, 10 segments (13×13). step = 0..10; 10 = full (glows). */
export function abilityRing(step: number): PixelBuffer {
  const b = buf(15, 15);
  const c = 7.5;
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const d = Math.hypot(dx, dy);
      if (d > 7 || d < 4) continue;
      if (d > 6.2 || d < 4.8) {
        px(b, x, y, 'ink');
        continue;
      }
      let a = Math.atan2(dx, -dy); // 0 = up, clockwise
      if (a < 0) a += Math.PI * 2;
      const seg = Math.floor((a / (Math.PI * 2)) * 10);
      const filled = seg < step;
      px(
        b,
        x,
        y,
        filled ? (step >= 10 ? 'hivis2' : seg === step - 1 ? 'hivis2' : 'hivis1') : 'gray2',
      );
    }
  }
  // Segment gaps.
  for (let s = 0; s < 10; s++) {
    const a = (s / 10) * Math.PI * 2;
    px(b, Math.floor(c + Math.sin(a) * 5.5), Math.floor(c - Math.cos(a) * 5.5), 'ink');
  }
  if (step >= 10) {
    rect(b, 6, 6, 3, 3, 'hivis2');
    px(b, 7, 7, 'white');
  }
  void line;
  return b;
}

export function registerCards(reg: SpriteRegistry): void {
  const states: CardState[] = ['ready', 'unaffordable', 'locked', 'selected'];
  reg.add('ui.card.deploy', {
    group: 'ui',
    frames: states.map((s) => deployCard({ cost: 5, hotkey: '1', state: s, level: 4 })),
    anchor: { x: 0, y: 0 },
    tags: ['states'],
  });
  reg.add('ui.card.portrait.placeholder', {
    group: 'portraits-ui',
    frames: OFFICER_BUST,
    anchor: { x: 12, y: 21 },
  });
  reg.add('ui.meter.legit', {
    group: 'ui',
    frames: [0, 0.25, 0.5, 0.75, 1].map((p) => legitMeter(p, 3)),
    anchor: { x: 0, y: 0 },
  });
  reg.add('ui.meter.integrity', {
    group: 'ui',
    frames: [1, 0.75, 0.5, 0.3, 0.1].map((p) => integrityMeter(p)),
    anchor: { x: 0, y: 0 },
  });
  reg.add('ui.meter.ability', {
    group: 'ui',
    frames: Array.from({ length: 11 }, (_, i) => abilityRing(i)),
    anchor: { x: 7, y: 7 },
  });
}
