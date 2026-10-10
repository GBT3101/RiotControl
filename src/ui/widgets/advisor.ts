/**
 * The advisor: the Minister of the Interior in his brass portrait box with a name plate and a
 * speech bubble that types its text out (mono font, `typeTick` per character, `typeBell` at the
 * end, lip-flap from the characters). Messages queue; a tap finishes the typing, the next tap
 * dismisses (and shows the next one). For M10:
 *
 *   ui.advisor.say("Every fallen officer makes us MORE legitimate.", 'smug');
 *   await ui.advisor.say('Press LET THEM COME.', 'idle', { sticky: true });   // resolves on dismiss
 *   ui.advisor.clear();
 */
import { Container, Sprite, type Texture } from 'pixi.js';
import { buf, rect } from '../../art/fx/draw';
import type { PixelBuffer } from '../../art/lib/pixels';
import { BUBBLE_TAIL_LEFT, panel } from '../../art/uikit/panels';
import { ministerAnims, portraitBox, type MinisterAnims } from '../../art/uikit/portraits';
import { FONTS, drawText, measureText } from '../../art/uikit/text';
import { overlaps, textBox, type Box, type TextBox } from '../core/boxes';
import { makeInteractive } from '../core/node';
import { ownTex, uiTex } from '../core/tex';
import type { UiApp } from '../app';

export type AdvisorMood = 'idle' | 'smug' | 'sweat' | 'panic';

export interface SayOptions {
  /** Stay until tapped (default: auto-dismiss after a reading pause). */
  sticky?: boolean;
  /** Seconds to keep the finished text up (default 2.2 + 0.045 s per character). */
  hold?: number;
  /** Characters per second (default 38). */
  cps?: number;
  /** Speaker plate (default THE MINISTER). */
  speaker?: string;
}

interface Line {
  text: string;
  mood: AdvisorMood;
  opts: SayOptions;
  resolve: () => void;
}

let anims: MinisterAnims | null = null;
function faces(): MinisterAnims {
  anims ??= ministerAnims();
  return anims;
}

/** Height of the brass portrait box (face + frame). */
function faceBoxH(): number {
  return (faces().idle[0]?.h ?? 54) + 10;
}

/** Name plate: brass panel with the speaker's name. */
function namePlate(name: string): PixelBuffer {
  const w = measureText(FONTS.smallBold, name).w + 12;
  const p = panel('brass', w, 15);
  drawText(p, FONTS.smallBold, name, 6, 4, 'earth1', {
    shadow: 'ochre4',
    shadowOffset: { x: 0, y: 1 },
  });
  return p;
}

/** Portrait box width (the face is 48×?, framed by 5 px of brass). */
const BOX_W = 58;

export interface AdvisorLayout {
  box: Box;
  plate: Box;
  bubble: Box;
  /** Ink box of the typed text (first cap line at `text.capY`). */
  text: TextBox;
  tail: { x: number; y: number };
  /** Blinking "more" triangle in the bubble's bottom-right corner. */
  hint: Box;
  /** Wrapped lines. */
  lines: string[];
  /** The name plate rides on the bubble (tall bubble) instead of on the portrait box. */
  plateOnBubble: boolean;
}

/**
 * Advisor geometry (UI px) for a line of text: portrait box at the bottom-left corner point,
 * its name plate on top, the bubble to the right (bottom-aligned with the box). The bubble
 * widens before it grows taller than the box; when it must still rise past the name plate,
 * the plate moves onto the bubble's top edge so it never covers a line of text. The "more"
 * triangle has its own row under the last line. Pure (unit-tested with every real line).
 */
export function advisorLayout(o: {
  x: number;
  bottom: number;
  maxW: number;
  text: string;
  plateW: number;
  boxH: number;
  boxW?: number;
}): AdvisorLayout {
  const boxW = o.boxW ?? BOX_W;
  const box = { x: o.x, y: o.bottom - o.boxH, w: boxW, h: o.boxH };
  const bx = o.x + boxW + 8;
  const avail = o.maxW - boxW - 10;
  const lowTop = o.bottom - o.boxH + 6;
  const fit = (w: number): { w: number; lines: string[]; h: number } => {
    const lines = measureText(FONTS.mono, o.text, w - 14).lines;
    const th = (lines.length - 1) * FONTS.mono.lineHeight + FONTS.mono.capHeight;
    return { w, lines, h: th + 20 };
  };
  let f = fit(Math.max(110, Math.min(190, avail)));
  // Too tall for the box's height: widen (up to the room there is) before rising.
  if (o.bottom - f.h < lowTop && avail > f.w) f = fit(Math.min(avail, 300));
  let plate = { x: o.x + 6, y: box.y - 10, w: o.plateW, h: 15 };
  let by = Math.min(o.bottom - f.h, lowTop);
  let bubble = { x: bx, y: by, w: f.w, h: f.h };
  let ty = 7;
  const plateOnBubble = overlaps(plate, bubble);
  if (plateOnBubble) {
    // Leave room under the plate for the first line (and its accents).
    ty = 11;
    bubble = { ...bubble, y: o.bottom - f.h - 4, h: f.h + 4 };
    by = bubble.y;
    plate = { x: bx + 6, y: by - 10, w: o.plateW, h: 15 };
  }
  const text = textBox(FONTS.mono, f.lines.join('\n'), bx + 7, by + ty);
  return {
    box,
    plate,
    bubble,
    text,
    tail: { x: bx - 7, y: Math.max(by + 10, box.y + 16) },
    hint: { x: bx + f.w - 12, y: by + bubble.h - 9, w: 7, h: 5 },
    lines: f.lines,
    plateOnBubble,
  };
}

export class Advisor {
  readonly root = new Container({ label: 'advisor' });
  private readonly box = new Sprite();
  private readonly plate = new Sprite();
  private readonly bubble = new Sprite();
  private readonly tail = new Sprite(uiTex('bubble:tail', () => BUBBLE_TAIL_LEFT));
  private readonly text = new Sprite();
  private readonly hint = new Sprite();
  private readonly queue: Line[] = [];
  private line: Line | null = null;
  private shown = 0;
  private typed = 0;
  private doneAt = -1;
  private t = 0;
  private enterT = 0;
  private bubbleW = 150;
  private wrapped = '';
  private textKey = '';
  private boxFrames = new Map<string, Texture>();
  private x = 4;
  private bottom = 200;
  private maxW = 220;
  private geo: AdvisorLayout | null = null;
  private geoKey = '';

  constructor(private readonly app: UiApp) {
    this.root.addChild(this.bubble, this.tail, this.text, this.hint, this.box, this.plate);
    this.root.visible = false;
    const tap = (): void => this.tap();
    makeInteractive(this.bubble, { tap });
    makeInteractive(this.box, { tap });
    this.hint.texture = uiTex('advisor:hint', () => {
      const b = buf(7, 5);
      for (let y = 0; y < 4; y++) rect(b, y, y, 7 - 2 * y, 1, 'crim1');
      return b;
    });
  }

  /** Queue a line; resolves when it is dismissed. */
  say(text: string, mood: AdvisorMood = 'idle', opts: SayOptions = {}): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push({ text, mood, opts, resolve });
      if (!this.line) this.next();
    });
  }

  /** Drop everything (screen change). */
  clear(): void {
    for (const l of this.queue) l.resolve();
    this.queue.length = 0;
    this.line?.resolve();
    this.line = null;
    this.root.visible = false;
  }

  get speaking(): boolean {
    return !!this.line;
  }

  /** UI rect covered by the portrait box, name plate and bubble (null when silent). M10. */
  extent(): { x: number; y: number; w: number; h: number } | null {
    if (!this.line || !this.root.visible) return null;
    const g = this.geometry();
    if (!g) return null;
    const top = Math.min(g.plate.y, g.box.y, g.bubble.y);
    const right = Math.max(g.bubble.x + g.bubble.w, g.plate.x + g.plate.w);
    return { x: this.x, y: top, w: right - this.x, h: this.bottom - top };
  }

  private next(): void {
    this.line?.resolve();
    this.line = this.queue.shift() ?? null;
    if (!this.line) {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;
    this.shown = 0;
    this.typed = 0;
    this.doneAt = -1;
    this.enterT = this.t;
    this.textKey = '';
    this.plate.texture = this.plateTex();
    this.layoutBubble();
  }

  private tap(): void {
    if (!this.line) return;
    if (this.shown < this.line.text.length) {
      this.shown = this.line.text.length;
      return;
    }
    this.next();
  }

  /** Place the advisor: bottom-left corner point and max width. */
  place(x: number, bottom: number, maxW: number): void {
    // The bubble's shape depends on the placement (it may widen, or carry the name plate).
    const moved = x !== this.x || bottom !== this.bottom || maxW !== this.maxW;
    this.x = x;
    this.bottom = bottom;
    this.maxW = maxW;
    if (moved && this.line) this.layoutBubble();
  }

  private plateTex(): Texture {
    const name = this.line?.opts.speaker ?? 'THE MINISTER';
    return uiTex(`plate:${name}`, () => namePlate(name));
  }

  /** Geometry for the current line at the current placement. */
  private geometry(): AdvisorLayout | null {
    if (!this.line) return null;
    const boxH = this.box.texture.height || faceBoxH();
    const plateW = this.plateTex().width;
    const key = `${this.x},${this.bottom},${this.maxW},${boxH},${plateW},${this.line.text}`;
    if (key === this.geoKey && this.geo) return this.geo;
    this.geoKey = key;
    this.geo = advisorLayout({
      x: this.x,
      bottom: this.bottom,
      maxW: this.maxW,
      text: this.line.text,
      plateW,
      boxH,
    });
    return this.geo;
  }

  private layoutBubble(): void {
    const g = this.geometry();
    if (!g) return;
    this.bubbleW = g.bubble.w;
    this.wrapped = g.lines.join('\n');
    this.textKey = '';
    this.bubble.texture = ownTexReplace(
      this.bubble.texture,
      panel('bubble', g.bubble.w, g.bubble.h),
    );
  }

  private boxTex(face: PixelBuffer, key: string): Texture {
    let t = this.boxFrames.get(key);
    if (!t) {
      t = ownTex(portraitBox(face), `minister:${key}`);
      this.boxFrames.set(key, t);
    }
    return t;
  }

  update(dt: number): void {
    this.t += dt;
    const l = this.line;
    if (!l) return;
    const cps = l.opts.cps ?? 38;
    const before = Math.floor(this.shown);
    if (this.shown < l.text.length) this.shown = Math.min(l.text.length, this.shown + cps * dt);
    const now = Math.floor(this.shown);
    // One tick per 2 visible characters (spaces silent), bell at the end.
    for (let k = before; k < now; k++) {
      const ch = l.text[k] ?? ' ';
      if (ch !== ' ' && ++this.typed % 2 === 0) this.app.sfx('typeTick');
    }
    const done = now >= l.text.length;
    if (done && this.doneAt < 0) {
      this.doneAt = this.t;
      this.app.sfx('typeBell');
    }
    // Text (re-render only when the visible prefix changes).
    const visible = this.visiblePrefix(now);
    if (visible !== this.textKey) {
      this.textKey = visible;
      const m = measureText(FONTS.mono, this.wrapped);
      // Accents above the caps and descenders below the last line stay inside the buffer.
      const f = FONTS.mono;
      const b = buf(Math.max(1, m.w + 2), Math.max(1, m.h + f.ascent + f.descent + 1));
      drawText(b, f, visible, 0, f.ascent, 'ink');
      this.text.texture = ownTexReplace(this.text.texture, b);
    }
    // Face: talking while typing (mouth from the character), else mood.
    const f = faces();
    let face: PixelBuffer;
    let key: string;
    if (!done) {
      const ch = (l.text[now] ?? ' ').toLowerCase();
      const m =
        ch === ' ' || ch === '.' || ch === ','
          ? 0
          : 'aeiou'.includes(ch)
            ? ch === 'o' || ch === 'u'
              ? 3
              : 2
            : 1;
      face = f.mouths[m]!;
      key = `mouth${m}`;
    } else {
      const arr =
        l.mood === 'smug'
          ? f.smug
          : l.mood === 'panic'
            ? f.panic
            : l.mood === 'sweat'
              ? f.sweat
              : f.idle;
      const fps = l.mood === 'panic' ? 12 : 6;
      const k = Math.floor(this.t * fps) % arr.length;
      face = arr[k]!;
      key = `${l.mood}${k}`;
    }
    this.box.texture = this.boxTex(face, key);
    // Layout (advisorLayout): box bottom-left, plate above it, bubble to its right.
    const g = this.geometry()!;
    if (g.bubble.w !== this.bubbleW || g.bubble.h !== this.bubble.texture.height)
      this.layoutBubble();
    const enter = Math.min(1, (this.t - this.enterT) / 0.18);
    const slide = Math.round((1 - enter) * -70);
    this.box.position.set(g.box.x + slide, g.box.y);
    this.plate.position.set(g.plate.x + (g.plateOnBubble ? 0 : slide), g.plate.y);
    this.plate.alpha = g.plateOnBubble ? enter : 1;
    this.bubble.position.set(g.bubble.x, g.bubble.y);
    this.bubble.alpha = enter;
    this.tail.position.set(g.tail.x, g.tail.y);
    this.text.position.set(g.text.x, g.text.capY - FONTS.mono.ascent);
    this.hint.visible = done && Math.floor(this.t * 2) % 2 === 0;
    this.hint.position.set(g.hint.x, g.hint.y);
    // Auto-dismiss.
    if (done && !l.opts.sticky) {
      const hold = l.opts.hold ?? 2.2 + l.text.length * 0.045;
      if (this.t - this.doneAt > hold) this.next();
    }
  }

  private visiblePrefix(n: number): string {
    // Map the plain-text prefix onto the wrapped text (line breaks replace spaces).
    let out = '';
    let k = 0;
    for (const ch of this.wrapped) {
      if (k >= n) break;
      out += ch;
      k++;
    }
    return out;
  }
}

function ownTexReplace(old: Texture, b: PixelBuffer): Texture {
  const t = ownTex(b, 'advisor:own');
  if (old && old.label === 'advisor:own') old.destroy(true);
  return t;
}
