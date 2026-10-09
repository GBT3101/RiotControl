/**
 * Deploy bar: one card per Ministry unit (all 11, in unlock order) with portrait, cost, hotkey
 * and state (ready / unaffordable / locked "LVL n" silhouette / selected). Tap a card to enter
 * deploy mode (tap again or Esc to leave). Hover (desktop) or long-press (touch) shows the
 * index-card tooltip. On narrow screens the strip scrolls horizontally (drag or wheel) like a
 * bottom sheet. Full kit cards (38×50) on large screens, compact cards (30×38) on phones.
 */
import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { deployCard, type CardState } from '../../art/uikit/cards';
import { panel } from '../../art/uikit/panels';
import { UNITS, UNIT_ORDER, type UnitId } from '../../data/units';
import type { DeployOption, GameController } from '../../game/controller';
import { formatNumber } from '../records';
import { compactCard, unitPortrait } from '../art';
import { makeInteractive } from '../core/node';
import { swapOwned, uiTex } from '../core/tex';
import { clampScroll, scrollToCard, type HudLayout } from '../layout';
import { cardState } from '../model';
import { UNIT_COPY } from '../strings';
import type { UiApp } from '../app';

interface CardView {
  unit: UnitId;
  sprite: Sprite;
  key: string;
  shake: number;
  baseX: number;
}

export class DeployBar {
  readonly root = new Container({ label: 'deploybar' });
  private readonly bg = new Sprite();
  private readonly strip = new Container({ label: 'cards' });
  private readonly mask = new Graphics();
  private readonly cards: CardView[] = [];
  private scroll = 0;
  private velocity = 0;
  private dragging = false;
  private lastOptions: DeployOption[] = [];
  private layoutKey = '';

  constructor(
    private readonly app: UiApp,
    private readonly game: GameController,
  ) {
    makeInteractive(this.bg, {
      blockOnly: false,
      drag: (dx) => this.onDrag(dx),
      dragEnd: () => (this.dragging = false),
      wheel: (dy) => this.onWheel(dy),
    });
    this.root.addChild(this.bg, this.strip, this.mask);
    this.strip.mask = this.mask;
    for (const unit of UNIT_ORDER) {
      const sprite = new Sprite();
      const cv: CardView = { unit, sprite, key: '', shake: 0, baseX: 0 };
      makeInteractive(sprite, {
        hit: () => {
          const c = this.app.layout.card;
          return { x: 1, y: 1, w: c.w - 2, h: c.h - 2 };
        },
        tap: () => this.pick(unit),
        hover: (over) =>
          app.tooltip.showFor(over ? sprite : null, () => this.tip(unit), undefined, 'above'),
        longPress: () => {
          app.tooltip.showFor(sprite, () => this.tip(unit), 3, 'above');
          return true;
        },
        drag: (dx) => this.onDrag(dx),
        dragEnd: () => (this.dragging = false),
        wheel: (dy) => this.onWheel(dy),
      });
      this.cards.push(cv);
      this.strip.addChild(sprite);
    }
  }

  private tip(unit: UnitId): string {
    const d = UNITS[unit];
    const c = UNIT_COPY[unit];
    const lvl = d.level > this.game.world.level ? `\nLOCKED until Level ${d.level}.` : '';
    const legit = d.invulnerable ? 'never dies' : `+${d.legit} Legit if it falls`;
    return `${d.name.toUpperCase()}  [${this.game.deployOptions().find((o) => o.unit === unit)?.hotkey ?? ''}]\n${c.role}\nCost ${formatNumber(d.cost)} Hate · ${legit}${lvl}\n"${c.quip}"`;
  }

  /** Select a unit card (tap / hotkey). */
  pick(unit: UnitId): void {
    const o = this.game.deployOptions().find((x) => x.unit === unit);
    if (!o) return;
    const cv = this.cards.find((c) => c.unit === unit)!;
    if (!o.unlocked) {
      cv.shake = 0.35;
      this.app.sfx('error');
      this.app.toast.info(`${UNITS[unit].name.toUpperCase()}: APPROVED AT LEVEL ${o.level}`);
      return;
    }
    if (!o.affordable && this.game.deployUnit !== unit) {
      cv.shake = 0.35;
      this.app.sfx('error');
      this.app.toast.info(`NOT ENOUGH HATE (${o.cost} NEEDED)`);
      return;
    }
    this.game.beginDeploy(unit);
    this.ensureVisible(UNIT_ORDER.indexOf(unit));
  }

  private ensureVisible(index: number): void {
    const l = this.app.layout;
    if (!l.scrollable) return;
    this.scroll = scrollToCard(this.scroll, index, l.card, l.cardsView.w, l.cardsW);
  }

  private onDrag(dx: number): boolean {
    const l = this.app.layout;
    if (!l.scrollable) return false;
    this.dragging = true;
    this.scroll = clampScroll(this.scroll - dx, l.cardsW, l.cardsView.w);
    this.velocity = -dx * 30;
    return true;
  }

  private onWheel(dy: number): void {
    const l = this.app.layout;
    if (!l.scrollable) return;
    this.scroll = clampScroll(this.scroll + dy * 0.5, l.cardsW, l.cardsView.w);
  }

  layout(l: HudLayout): void {
    const key = `${l.deploy.x},${l.deploy.y},${l.deploy.w},${l.deploy.h}:${l.card.compact}`;
    if (key !== this.layoutKey) {
      this.layoutKey = key;
      swapOwned(this.bg, panel('leather', l.deploy.w, l.deploy.h + 3), 'ui:deploybar');
      for (const c of this.cards) c.key = '';
    }
    this.bg.position.set(l.deploy.x, l.deploy.y);
    this.mask.clear().rect(l.cardsView.x - 2, l.cardsView.y - 4, l.cardsView.w + 4, l.card.h + 6);
    this.mask.fill(0xffffff);
    this.scroll = clampScroll(this.scroll, l.cardsW, l.cardsView.w);
  }

  private cardTexture(o: DeployOption, st: CardState, compact: boolean): Texture {
    const portrait = unitPortrait(o.unit);
    const key = `card:${o.unit}:${st}:${compact}:${portrait ? 1 : 0}:${o.cost}`;
    return uiTex(key, () =>
      compact
        ? compactCard({ portrait, cost: o.cost, state: st, level: o.level })
        : deployCard({ portrait, cost: o.cost, hotkey: o.hotkey, state: st, level: o.level }),
    );
  }

  update(dt: number): void {
    const l = this.app.layout;
    const opts = this.game.deployOptions();
    this.lastOptions = opts;
    if (!this.dragging && Math.abs(this.velocity) > 1) {
      this.scroll = clampScroll(this.scroll + this.velocity * dt, l.cardsW, l.cardsView.w);
      this.velocity *= Math.pow(0.02, dt);
    } else if (!this.dragging) this.velocity = 0;
    const x0 = l.cardsView.x - Math.round(this.scroll);
    const centre = l.scrollable ? 0 : Math.floor((l.cardsView.w - l.cardsW) / 2);
    const sel = this.game.deployUnit;
    for (let k = 0; k < this.cards.length; k++) {
      const c = this.cards[k]!;
      const o = opts[k]!;
      const st = cardState(o, sel === o.unit);
      const tex = this.cardTexture(o, st, l.card.compact);
      if (c.sprite.texture !== tex) c.sprite.texture = tex;
      c.baseX = x0 + centre + k * l.card.pitch;
      let dx = 0;
      if (c.shake > 0) {
        c.shake = Math.max(0, c.shake - dt);
        dx = Math.floor(c.shake * 40) % 2 ? 1 : -1;
      }
      c.sprite.position.set(c.baseX + dx, l.cardsView.y - 2);
    }
  }

  /** UI rect of a unit's card (tutorial pointers). */
  cardRect(unit: UnitId): { x: number; y: number; w: number; h: number } | null {
    const c = this.cards.find((x) => x.unit === unit);
    if (!c) return null;
    const l = this.app.layout;
    return { x: c.sprite.x + 2, y: c.sprite.y + 2, w: l.card.w - 4, h: l.card.h - 4 };
  }

  get options(): readonly DeployOption[] {
    return this.lastOptions;
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
