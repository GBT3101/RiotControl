/**
 * Pixel-art loading screen: the RIOT CONTROL logo (with its glint), a hazard-tape progress bar
 * in a recessed well, the city being prepared and a satirical tip. Drawn with Pixi in screen
 * space at the UI scale; the main thread stays free while the art workers run.
 *
 * M13b: the bar eases toward the reported progress and creeps through the current job (jobs
 * report coarsely, so a long one used to freeze the bar), tips rotate every 6 s, and every
 * texture is freed on destroy.
 */
import { Container, Sprite, Texture } from 'pixi.js';
import { createBuffer, setPixel, type PixelBuffer } from '../art/lib/pixels';
import { resolveColor } from '../art/palette';
import { logoFrames } from '../art/uikit/logo';
import { panel } from '../art/uikit/panels';
import { bufferTexture } from '../art/uikit/pixi';
import { FONTS, textSprite } from '../art/uikit/text';
import type { PixelStage } from '../render/stage';
import { uiScale } from '../render/zoom';
import { TIPS } from './tips';

const BAR_W = 180;
const BAR_H = 12;

export class LoadingScreen {
  readonly root = new Container({ label: 'loading' });
  private readonly logo: Sprite;
  private readonly logoFrames: Texture[];
  private readonly bar: Sprite;
  private readonly label: Sprite;
  private readonly tip: Sprite;
  private readonly well: Sprite;
  private shownPct = -1;
  /** Reported progress (0..1) and the size of the last reported step. */
  private progress = 0;
  private step = 0.1;
  /** Displayed progress (eased + creeping, never past the next expected step). */
  private shown = 0;
  private tipW = 220;
  private tipIndex = 0;
  private tipT = 0;
  private t = 0;
  private raf = 0;
  private last = -1;
  private unsub: () => void;

  constructor(
    private readonly stage: PixelStage,
    cityName: string,
    seed: number,
  ) {
    this.logoFrames = logoFrames().map((b) => bufferTexture(b, 'logo'));
    this.logo = new Sprite(this.logoFrames[0]!);
    this.logo.anchor.set(0.5, 0);
    this.well = new Sprite(bufferTexture(panel('recess', BAR_W + 4, BAR_H + 4), 'well'));
    this.bar = new Sprite();
    this.label = new Sprite(
      bufferTexture(
        textSprite(FONTS.smallBold, `PREPARING ${cityName.toUpperCase()}...`, 'stone5', {
          outline: 'ink',
        }),
      ),
    );
    this.label.anchor.set(0.5, 0);
    this.tipIndex = Math.abs(seed * 7 + Math.floor(Date.now() / 1000)) % TIPS.length;
    this.tipW = this.tipWidth();
    this.tip = new Sprite(tipTexture(TIPS[this.tipIndex]!, this.tipW));
    this.tip.anchor.set(0.5, 0);
    this.root.addChild(this.logo, this.well, this.bar, this.label, this.tip);
    this.unsub = stage.onResize(() => this.layout());
    this.drawBar(0);
    // Render at the glint's 12 fps only: the art workers need the CPU more than we do.
    const frame = (now: number): void => {
      this.raf = requestAnimationFrame(frame);
      if (this.last >= 0 && now - this.last < 80) return;
      const dt = this.last < 0 ? 0 : (now - this.last) / 1000;
      this.last = now;
      this.t += dt;
      // Glint sweeps every ~2.5 s.
      const g = Math.floor(((this.t % 2.5) / 2.5) * 30);
      this.logo.texture = this.logoFrames[g < this.logoFrames.length ? g : 0]!;
      this.animate(dt);
      this.stage.app.render();
    };
    this.raf = requestAnimationFrame(frame);
  }

  /** Tip wrap width (UI px): 220, or the screen less a margin on narrow phones (360 CSS px). */
  private tipWidth(): number {
    const s = this.stage.size;
    const k = uiScale(Math.min(s.cssWidth, s.cssHeight), s.dpr);
    return Math.max(60, Math.min(220, Math.floor(s.width / k) - 12));
  }

  private layout(): void {
    const tw = this.tipWidth();
    if (tw !== this.tipW) {
      this.tipW = tw;
      const old = this.tip.texture;
      this.tip.texture = tipTexture(TIPS[this.tipIndex]!, tw);
      old.destroy(true);
    }
    const s = this.stage.size;
    const k = uiScale(Math.min(s.cssWidth, s.cssHeight), s.dpr);
    this.root.scale.set(k);
    const w = Math.floor(s.width / k);
    const h = Math.floor(s.height / k);
    const top = Math.max(4, Math.floor(h / 2) - 90);
    this.logo.position.set(Math.floor(w / 2), top);
    this.well.position.set(Math.floor(w / 2 - (BAR_W + 4) / 2), top + 108);
    this.bar.position.set(this.well.x + 2, this.well.y + 2);
    this.label.position.set(Math.floor(w / 2), top + 128);
    this.tip.position.set(Math.floor(w / 2), top + 146);
  }

  setProgress(p: number): void {
    const v = Math.max(this.progress, Math.min(1, p));
    if (v > this.progress) this.step = Math.max(0.02, v - this.progress);
    this.progress = v;
  }

  private animate(dt: number): void {
    // Ease toward the reported value, then creep (slowly, asymptotically) into the current
    // job's share so a long job still shows life — never beyond 85 % of the next step.
    const target = this.progress;
    if (this.shown < target) this.shown += (target - this.shown) * Math.min(1, dt * 8);
    else {
      const cap = Math.min(0.99, target + this.step * 0.85);
      this.shown += (cap - this.shown) * Math.min(1, dt * 0.35);
    }
    this.drawBar(this.shown);
    this.tipT += dt;
    if (this.tipT > 6 && TIPS.length > 1) {
      this.tipT = 0;
      this.tipIndex = (this.tipIndex + 1) % TIPS.length;
      const old = this.tip.texture;
      this.tip.texture = tipTexture(TIPS[this.tipIndex]!, this.tipW);
      old.destroy(true);
    }
  }

  private drawBar(p: number): void {
    const pct = Math.round(Math.max(0, Math.min(1, p)) * 100);
    if (pct === this.shownPct) return;
    this.shownPct = pct;
    const old = this.bar.texture;
    this.bar.texture = bufferTexture(hazardBar(Math.round((BAR_W * pct) / 100)), 'bar');
    if (old && old !== this.bar.texture && old.label === 'bar') old.destroy(true);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.unsub();
    for (const t of this.logoFrames) t.destroy(true);
    for (const sp of [this.well, this.bar, this.label, this.tip])
      if (sp.texture && sp.texture !== Texture.EMPTY) sp.texture.destroy(true);
    this.root.destroy({ children: true });
  }
}

function tipTexture(tip: string, maxWidth: number): Texture {
  return bufferTexture(
    textSprite(FONTS.small, tip, 'stone4', { maxWidth, align: 'center', lineGap: 1 }),
    'tip',
  );
}

/** Hazard-tape fill: hi-vis / ink diagonal stripes with a lit top row and shaded bottom row. */
function hazardBar(fill: number): PixelBuffer {
  const b = createBuffer(BAR_W, BAR_H);
  const y1 = resolveColor('ochre4');
  const y2 = resolveColor('ochre3');
  const k1 = resolveColor('ink');
  const k2 = resolveColor('gray1');
  for (let y = 0; y < BAR_H; y++) {
    for (let x = 0; x < fill; x++) {
      const stripe = Math.floor((x + y) / 5) % 2 === 0;
      let c = stripe ? y2 : k1;
      if (y === 0) c = stripe ? y1 : k2;
      if (y === BAR_H - 1) c = stripe ? resolveColor('ochre2') : k1;
      setPixel(b, x, y, c);
    }
  }
  return b;
}
