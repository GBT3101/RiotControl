/**
 * Selected-unit panel (paper sheet, bottom-left above the deploy bar): portrait, name, HP bar,
 * role, kills, and for commandable units a blinking "TAP A ROAD TO MOVE" hint; the Tear Gas
 * Shooter gets its charge ring and a pulsing THROW GAS button once the grenade is charged.
 * Also floats a bouncing grenade over every charged gas shooter in the world (tap = throw).
 */
import { Container, Sprite, type Texture } from 'pixi.js';
import { buf, hline, rect, stamp } from '../../art/fx/draw';
import { abilityRing } from '../../art/uikit/cards';
import { ICONS } from '../../art/uikit/icons';
import { panel } from '../../art/uikit/panels';
import { tileToWorld } from '../../core/iso';
import { UNITS } from '../../data/units';
import type { GameController } from '../../game/controller';
import type { Unit } from '../../sim/units';
import { unitPortrait } from '../art';
import { Button, stampFaces } from '../core/button';
import { Label } from '../core/label';
import { makeInteractive } from '../core/node';
import { swapOwned, uiTex, destroyOwned } from '../core/tex';
import { UNIT_COPY, UI_TEXT } from '../strings';
import type { HudLayout } from '../layout';
import type { UiApp } from '../app';

function hpBar(frac: number, w: number): ReturnType<typeof buf> {
  const b = buf(w, 6);
  rect(b, 0, 0, w, 6, 'ink');
  rect(b, 1, 1, w - 2, 4, 'gray1');
  const f = Math.max(0, Math.min(1, frac));
  const fw = Math.round((w - 2) * f);
  const c =
    f > 0.5
      ? ['green4', 'green3', 'green2']
      : f > 0.25
        ? ['ochre4', 'ochre3', 'ochre2']
        : ['rust4', 'crim2', 'crim1'];
  if (fw > 0) {
    rect(b, 1, 1, fw, 4, c[1]!);
    hline(b, 1, 1, fw, c[0]!);
    hline(b, 1, 4, fw, c[2]!);
  }
  return b;
}

export class InfoPanel {
  readonly root = new Container({ label: 'infopanel' });
  private readonly bg = new Sprite();
  private readonly portraitWell = new Sprite();
  private readonly portrait = new Sprite();
  private readonly name = new Label('smallBold', 'ink');
  private readonly hp = new Sprite();
  private readonly hpText = new Label('small', 'gray1');
  private readonly role = new Label('small', 'gray1');
  private readonly kills = new Label('small', 'gray1');
  private readonly hint = new Label('smallBold', 'crim1');
  private readonly ring = new Sprite();
  private readonly throwBtn: Button;
  private readonly close: Button;
  /** World-space grenade cues over charged gas shooters (screen UI px). */
  private readonly cues = new Container({ label: 'ability-cues' });
  private readonly cuePool: Sprite[] = [];
  private readonly cueFrames: Texture[];
  private unitId = -1;
  private key = '';
  private hpKey = '';
  private t = 0;
  private readonly killCount = new Map<number, number>();
  private w = 140;
  private h = 58;

  constructor(
    private readonly app: UiApp,
    private readonly game: GameController,
  ) {
    makeInteractive(this.bg, { blockOnly: true });
    this.throwBtn = new Button(stampFaces('THROW GAS'), {
      onTap: () => {
        if (this.unitId >= 0) game.useAbility(this.unitId);
      },
      pad: 3,
    });
    this.close = new Button(
      {
        normal: uiTex('x:n', () => closeGlyph('gray2')),
        hover: uiTex('x:h', () => closeGlyph('crim1')),
        pressed: uiTex('x:p', () => closeGlyph('crim2')),
        disabled: uiTex('x:d', () => closeGlyph('gray4')),
      },
      { onTap: () => game.select(null), pad: 4 },
    );
    this.cueFrames = [0, 1, 2, 3].map((f) => uiTex(`cue:${f}`, () => abilityCue(f)));
    this.root.addChild(
      this.bg,
      this.portraitWell,
      this.portrait,
      this.name,
      this.hp,
      this.hpText,
      this.role,
      this.kills,
      this.hint,
      this.ring,
      this.throwBtn,
      this.close,
    );
    this.root.visible = false;
    game.bus.on('died', (e) => {
      if (e.by >= 0) this.killCount.set(e.by, (this.killCount.get(e.by) ?? 0) + 1);
    });
    game.bus.on('selectionChanged', (e) => this.show(e.unitId));
  }

  /** Container of the in-world ability cues (added to the HUD under the panels). */
  get cueLayer(): Container {
    return this.cues;
  }

  kills_(id: number): number {
    return this.killCount.get(id) ?? 0;
  }

  private show(id: number | null): void {
    this.unitId = id ?? -1;
    this.key = '';
  }

  layout(l: HudLayout): void {
    this.w = Math.max(120, Math.min(176, l.info.w));
    this.h = l.info.h;
    this.root.position.set(l.info.x, l.info.y);
    this.key = '';
  }

  private build(u: Unit): void {
    const compact = this.h < 52;
    swapOwned(this.bg, panel('paper', this.w, this.h), 'ui:info');
    const ps = compact ? 28 : 36;
    swapOwned(this.portraitWell, panel('recess', ps, ps), 'ui:info-well');
    this.portraitWell.position.set(12, Math.floor((this.h - ps) / 2) - 1);
    const p = unitPortrait(u.type);
    if (p) {
      swapOwned(this.portrait, p, 'ui:info-portrait');
      this.portrait.position.set(
        this.portraitWell.x + Math.floor((ps - 32) / 2),
        this.portraitWell.y + ps - 1 - 32 + (compact ? 2 : 0),
      );
      this.portrait.visible = !compact;
    }
    const x = 12 + ps + 5;
    this.name.set(UNITS[u.type].name.toUpperCase());
    this.name.position.set(x, 5);
    this.hp.position.set(x, 15);
    this.hpText.position.set(x + 52, 15);
    this.role.opts = { maxWidth: this.w - x - 6 };
    this.role.set('');
    this.role.set(compact ? '' : UNIT_COPY[u.type].role);
    this.role.position.set(x, 24);
    this.kills.position.set(x, compact ? 33 : 45);
    this.hint.position.set(x, compact ? 33 : 45);
    this.close.position.set(this.w - 12, 3);
    this.ring.position.set(this.w - 21, this.h - 22);
    this.hpKey = '';
  }

  update(dt: number, l: HudLayout): void {
    this.t += dt;
    this.updateCues(l);
    const u = this.unitId >= 0 ? this.game.world.units.get(this.unitId) : undefined;
    if (!u || !u.alive || this.game.attract) {
      this.root.visible = false;
      if (this.unitId >= 0 && (!u || !u.alive)) this.unitId = -1;
      return;
    }
    this.root.visible = true;
    const key = `${u.id}:${this.w}:${this.h}`;
    if (key !== this.key) {
      this.key = key;
      this.build(u);
    }
    const inv = !Number.isFinite(u.maxHp) || u.def.invulnerable;
    const frac = inv ? 1 : u.hp / Math.max(1, u.maxHp);
    const hk = `${Math.round(frac * 48)}:${u.members}`;
    if (hk !== this.hpKey) {
      this.hpKey = hk;
      swapOwned(this.hp, hpBar(frac, 48), 'ui:hp');
      this.hpText.set(
        inv
          ? 'INVULNERABLE'
          : u.def.squad > 1
            ? `${u.members}/${u.def.squad} MEN`
            : `${Math.ceil(u.hp)} HP`,
      );
    }
    const k = this.killCount.get(u.id) ?? 0;
    this.kills.set(u.def.attack ? `KILLS ${k}` : `HOLDING THE LINE`);
    const compact = this.h < 52;
    // Commandable hint / gas ability.
    const gas = !!u.def.ability;
    this.ring.visible = gas;
    this.throwBtn.visible = gas && u.abilityReady;
    if (gas) {
      const step = u.abilityReady ? 10 : Math.floor((u.charge / u.def.ability!.charge) * 10);
      this.ring.texture = uiTex(`ring:${step}`, () => abilityRing(Math.max(0, Math.min(10, step))));
      if (this.throwBtn.visible) {
        const bob = Math.floor(this.t * 3) % 2;
        this.throwBtn.position.set(
          this.w - this.throwBtn.w - 24,
          this.h - this.throwBtn.h - 2 - bob,
        );
      }
    }
    if (u.def.commandable) {
      this.hint.visible = Math.floor(this.t * 1.6) % 2 === 0 || compact;
      this.hint.set(this.app.touch ? UI_TEXT.moveHint : UI_TEXT.moveHintMouse);
      this.kills.visible = !compact;
    } else {
      this.hint.visible = false;
      this.kills.visible = true;
    }
  }

  /** Bouncing grenades over charged gas shooters (tap one to throw). */
  private updateCues(l: HudLayout): void {
    let n = 0;
    const w = this.game.world;
    const f = Math.floor(this.t * 8) % 4;
    if (!this.game.attract) {
      for (const u of w.units.active) {
        if (!u.abilityReady) continue;
        const p = tileToWorld(u.x, u.y);
        const s = this.game.view.worldToUi(p.x, p.y - 34);
        if (s.x < 0 || s.y < l.topBar.h || s.x > l.W || s.y > l.deploy.y) continue;
        let sp = this.cuePool[n];
        if (!sp) {
          sp = new Sprite();
          sp.anchor.set(0.5, 1);
          const idx = n;
          makeInteractive(sp, {
            hit: { x: -10, y: -20, w: 20, h: 22 },
            tap: () => {
              const id = (this.cuePool[idx] as Sprite & { unitId?: number }).unitId;
              if (id !== undefined) this.game.useAbility(id);
            },
          });
          this.cuePool.push(sp);
          this.cues.addChild(sp);
        }
        (sp as Sprite & { unitId?: number }).unitId = u.id;
        sp.texture = this.cueFrames[f]!;
        sp.position.set(Math.round(s.x), Math.round(s.y));
        sp.visible = true;
        n++;
      }
    }
    for (let k = n; k < this.cuePool.length; k++) this.cuePool[k]!.visible = false;
  }

  destroy(): void {
    destroyOwned(this.root);
    destroyOwned(this.cues);
  }
}

function closeGlyph(c: string): ReturnType<typeof buf> {
  const b = buf(9, 9);
  for (let i = 0; i < 7; i++) {
    rect(b, 1 + i, 1 + i, 1, 1, c);
    rect(b, 7 - i, 1 + i, 1, 1, c);
    rect(b, 2 + i, 1 + i, 1, 1, c);
    rect(b, 6 - i, 1 + i, 1, 1, c);
  }
  return b;
}

/** Pulsing grenade cue (ring glow + bouncing grenade), 4 frames, anchor bottom-centre. */
function abilityCue(f: number): ReturnType<typeof buf> {
  const g = ICONS.grenade();
  const b = buf(17, 22);
  const dy = [0, -2, -3, -1][f]!;
  // Speech-bubble style backing so it reads over any ground.
  rect(b, 2, 3 + dy, 13, 13, 'ink');
  rect(b, 3, 2 + dy, 11, 15, 'ink');
  rect(b, 3, 4 + dy, 11, 11, f % 2 ? 'hivis2' : 'hivis1');
  rect(b, 4, 3 + dy, 9, 13, f % 2 ? 'hivis2' : 'hivis1');
  // Tail.
  rect(b, 7, 17 + dy, 3, 1, 'ink');
  rect(b, 8, 18 + dy, 1, 1, 'ink');
  rect(b, 8, 17 + dy, 1, 1, f % 2 ? 'hivis2' : 'hivis1');
  stamp(b, g, 8 - Math.floor(g.w / 2), 9 + dy - Math.floor(g.h / 2));
  return b;
}
