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
    this.layoutBubble();
    this.plate.texture = uiTex(`plate:${this.line.opts.speaker ?? 'THE MINISTER'}`, () =>
      namePlate(this.line?.opts.speaker ?? 'THE MINISTER'),
    );
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
    this.x = x;
    this.bottom = bottom;
    if (maxW !== this.maxW) {
      this.maxW = maxW;
      if (this.line) this.layoutBubble();
    }
  }

  private layoutBubble(): void {
    if (!this.line) return;
    const boxW = 58;
    this.bubbleW = Math.max(110, Math.min(190, this.maxW - boxW - 10));
    const lines = measureText(FONTS.mono, this.line.text, this.bubbleW - 14).lines;
    this.wrapped = lines.join('\n');
    const h = measureText(FONTS.mono, this.wrapped).h + 16;
    this.bubble.texture = ownTexReplace(this.bubble.texture, panel('bubble', this.bubbleW, h));
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
      const b = buf(Math.max(1, m.w + 2), Math.max(1, m.h + 4));
      drawText(b, FONTS.mono, visible, 0, 0, 'ink');
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
    // Layout: box bottom-left, plate above it, bubble to its right.
    const boxH = this.box.texture.height;
    const enter = Math.min(1, (this.t - this.enterT) / 0.18);
    const slide = Math.round((1 - enter) * -70);
    this.box.position.set(this.x + slide, this.bottom - boxH);
    this.plate.position.set(this.x + 6 + slide, this.bottom - boxH - 10);
    const bx = this.x + this.box.texture.width + 8;
    const bh = this.bubble.texture.height;
    const by = Math.min(this.bottom - bh, this.bottom - boxH + 6);
    this.bubble.position.set(bx, by);
    this.bubble.alpha = enter;
    this.tail.position.set(bx - 7, by + 10);
    this.text.position.set(bx + 7, by + 7);
    this.hint.visible = done && Math.floor(this.t * 2) % 2 === 0;
    this.hint.position.set(bx + this.bubbleW - 12, by + bh - 9);
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
