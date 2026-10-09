/**
 * In-game HUD: top bar, deploy bar, wave button, minimap, selected-unit panel, placement chrome
 * and in-world ability cues. Listens to the game bus for HUD-level reactions (selection →
 * scroll the deploy bar, etc.). Moments / advisor / toasts live on the app (they survive runs).
 */
import { Container, Sprite } from 'pixi.js';
import { rubberStamp } from '../../art/uikit/banners';
import { makeInteractive } from '../core/node';
import { uiTex, destroyOwned } from '../core/tex';
import type { UnitId } from '../../data/units';
import type { GameController, HudSnapshot } from '../../game/controller';
import { Button, roundFaces } from '../core/button';
import type { HudLayout } from '../layout';
import type { UiApp } from '../app';
import { DeployBar } from './deployBar';
import { InfoPanel } from './infoPanel';
import { Minimap } from './minimap';
import { Placement } from './placement';
import { TopBar } from './topBar';
import { WaveButton } from './waveButton';

export class Hud {
  readonly root = new Container({ label: 'hud' });
  readonly top: TopBar;
  readonly deploy: DeployBar;
  readonly wave: WaveButton;
  readonly minimap: Minimap;
  readonly info: InfoPanel;
  readonly placement: Placement;
  /** Phones: shows/hides the minimap. */
  readonly mapToggle: Button;
  private snapshot: HudSnapshot;
  /** Quick-pause stamp (Space). */
  private readonly paused = new Sprite(
    uiTex('stamp:paused', () => rubberStamp('PAUSED', 'navy2', { tilt: -0.06, seed: 2 })),
  );

  constructor(
    private readonly app: UiApp,
    private readonly game: GameController,
  ) {
    this.top = new TopBar(app, game);
    this.deploy = new DeployBar(app, game);
    this.wave = new WaveButton(app, game);
    this.minimap = new Minimap(app, game);
    this.info = new InfoPanel(app, game);
    this.placement = new Placement(app, game);
    this.mapToggle = new Button(roundFaces('codex', 'lg'), {
      onTap: () => app.toggleMinimap(),
      pad: 3,
    });
    this.root.addChild(
      this.info.cueLayer,
      this.placement.root,
      this.wave.root,
      this.minimap.root,
      this.info.root,
      this.deploy.root,
      this.top.root,
      this.mapToggle,
      this.paused,
    );
    this.paused.anchor.set(0.5);
    makeInteractive(this.paused, { tap: () => game.setPaused(false) });
    this.snapshot = game.hud();
  }

  get hud(): HudSnapshot {
    return this.snapshot;
  }

  layout(l: HudLayout): void {
    this.top.layout(l);
    this.deploy.layout(l);
    this.wave.layout(l);
    this.minimap.layout(l);
    this.info.layout(l);
    this.mapToggle.visible = l.minimapToggle;
    this.mapToggle.position.set(
      l.W - l.safe.right - this.mapToggle.w - 4,
      l.minimap ? l.minimap.y + l.minimap.h + 2 : l.topBar.h + 4,
    );
    this.updateTarget();
  }

  private updateTarget(): void {
    const t = this.top.hateTarget;
    this.game.setHateTarget(t.x, t.y);
  }

  update(dt: number): void {
    const h = (this.snapshot = this.game.hud());
    const l = this.app.layout;
    this.top.update(dt, h);
    this.deploy.update(dt);
    this.wave.update(dt, h);
    this.minimap.update(dt);
    this.info.update(dt, l);
    this.placement.update(l);
    this.paused.visible =
      h.paused && !this.app.topScreen && !this.game.attract && !this.app.params.freeze;
    this.paused.position.set(Math.floor(l.W / 2), Math.floor(l.H / 2) - 20);
  }

  /** Select a unit card (hotkeys). */
  pick(unit: UnitId): void {
    this.deploy.pick(unit);
  }

  destroy(): void {
    this.top.destroy();
    this.deploy.destroy();
    this.wave.destroy();
    this.minimap.destroy();
    this.info.destroy();
    this.placement.destroy();
    destroyOwned(this.root);
  }
}
