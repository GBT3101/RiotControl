/**
 * Title screen over a living city: the attract-mode game (a bot defends against a real wave)
 * runs underneath while the camera drifts slowly between the crowds; dithered vignette bands,
 * the RIOT CONTROL logo with its glint, PLAY / SETTINGS / CREDITS stamp buttons and the parody
 * disclaimer.
 */
import { Container, Sprite, type Texture } from 'pixi.js';
import { logoFrames } from '../../art/uikit/logo';
import { tileToWorld } from '../../core/iso';
import { densestCrowd } from '../../game/boot';
import { Button, stampFaces } from '../core/button';
import { Label } from '../core/label';
import { swapOwned, uiTex, destroyOwned } from '../core/tex';
import { UI_TEXT } from '../strings';
import type { HudLayout } from '../layout';
import type { UiApp } from '../app';
import { ditherBand } from './common';
import { backdrop, fitBackdrop, type Screen } from './screen';
import { makeInteractive } from '../core/node';

let logoTex: Texture[] | null = null;

export class TitleScreen implements Screen {
  readonly root = new Container({ label: 'title' });
  readonly modal = false;
  private readonly shade = backdrop(0.28);
  private readonly top = new Sprite();
  private readonly bottom = new Sprite();
  private readonly logo: Sprite;
  private readonly play: Button;
  private readonly settings: Button;
  private readonly credits: Button;
  private readonly disclaimer: Label;
  private readonly version: Label;
  private t = 0;
  private target: { x: number; y: number } | null = null;
  private retarget = 0;
  private cam = { x: 0, y: 0 };
  private drift = 0;

  constructor(private readonly app: UiApp) {
    logoTex ??= logoFrames().map((b, k) => uiTex(`logo:${k}`, () => b));
    this.logo = new Sprite(logoTex[0]!);
    this.play = new Button(stampFaces('PLAY', 128, true), {
      onTap: () => app.showCitySelect(true),
    });
    this.settings = new Button(stampFaces('SETTINGS', 128, true), {
      onTap: () => app.openSettings(false),
    });
    this.credits = new Button(stampFaces('CREDITS', 128, true), { onTap: () => app.showCredits() });
    this.disclaimer = new Label('small', 'stone4', { shadow: 'ink', align: 'center' });
    this.version = new Label('small', 'gray5', { shadow: 'ink' }, 'MINISTRY BUILD 0.9');
    this.shade.alpha = 0.28;
    makeInteractive(this.shade, { blockOnly: true });
    this.root.addChild(
      this.shade,
      this.top,
      this.bottom,
      this.logo,
      this.play,
      this.settings,
      this.credits,
      this.disclaimer,
      this.version,
    );
    const g = app.game;
    if (g) {
      const v = g.camera.view();
      this.cam = { x: v.x, y: v.y };
    }
  }

  layout(l: HudLayout): void {
    fitBackdrop(this.shade, l);
    swapOwned(this.top, ditherBand(l.W, Math.floor(l.H * 0.16), 'top'), 'ui:title-top');
    const bh = Math.floor(l.H * 0.14);
    swapOwned(this.bottom, ditherBand(l.W, bh, 'bottom'), 'ui:title-bottom');
    this.bottom.position.set(0, l.H - bh);
    const btns = [this.play, this.settings, this.credits];
    const side = l.H < 250 && l.W >= 420;
    const lw = this.logo.texture.width;
    const lh = this.logo.texture.height;
    if (side) {
      // Phone landscape: logo left, menu right.
      const colW = Math.floor(l.W / 2);
      this.logo.position.set(
        Math.floor(colW / 2 - lw / 2) + l.safe.left,
        Math.max(l.safe.top + 6, Math.floor(l.H / 2 - lh / 2) - 14),
      );
      let y = Math.floor(l.H / 2 - (btns.length * 34) / 2) - 8;
      for (const b of btns) {
        b.position.set(colW + Math.floor(colW / 2 - b.w / 2) - l.safe.right, y);
        y += 34;
      }
    } else {
      const y0 = l.safe.top + Math.max(6, Math.floor(l.H * 0.06));
      this.logo.position.set(Math.floor((l.W - lw) / 2), y0);
      let y = Math.max(y0 + lh + 14, Math.floor(l.H * 0.5));
      const room = l.H - l.safe.bottom - 30 - y;
      const step = Math.min(36, Math.floor(room / btns.length));
      for (const b of btns) {
        b.position.set(Math.floor((l.W - b.w) / 2), y);
        y += Math.max(32, step);
      }
    }
    this.disclaimer.opts = { ...this.disclaimer.opts, maxWidth: l.W - 24 };
    this.disclaimer.set('');
    this.disclaimer.set(UI_TEXT.disclaimer);
    this.disclaimer.position.set(
      Math.floor((l.W - this.disclaimer.textWidth) / 2),
      l.H - l.safe.bottom - this.disclaimer.texture.height - 5,
    );
    this.version.position.set(l.safe.left + 5, l.safe.top + 4);
  }

  update(dt: number): void {
    this.t += dt;
    // Logo glint every ~3 s.
    const frames = logoTex!;
    const g = Math.floor(((this.t % 3) / 3) * 36);
    this.logo.texture = frames[g < frames.length ? g : 0]!;
    // Camera drift toward the densest crowd, with a slow sideways sway.
    const game = this.app.game;
    if (!game || game.destroyed) return;
    this.retarget -= dt;
    if (this.retarget <= 0 || !this.target) {
      this.retarget = 7;
      const c = densestCrowd(game);
      const p = tileToWorld(c.i + 0.5, c.j + 0.5);
      this.target = { x: p.x, y: p.y };
    }
    this.drift += dt;
    const k = Math.min(1, dt * 0.25);
    // Keep the crowd beside the menu (not under it): it sits a third of the view to the left.
    const v = game.camera.view();
    const off = (v.width / v.zoom) * 0.28;
    this.cam.x += (this.target.x + off + Math.sin(this.drift * 0.15) * 60 - this.cam.x) * k;
    this.cam.y += (this.target.y - (v.height / v.zoom) * 0.08 - this.cam.y) * k;
    game.camera.centerOn(this.cam.x, this.cam.y);
  }

  key(code: string): boolean {
    if (code === 'Enter' || code === 'Space') {
      this.app.showCitySelect(true);
      return true;
    }
    return code === 'Escape';
  }

  destroy(): void {
    destroyOwned(this.root);
  }
}
