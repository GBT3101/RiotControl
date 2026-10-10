/**
 * Selected-unit panel (paper sheet, bottom-left above the deploy bar): portrait, name, HP bar,
 * role, kills, and for commandable units a blinking "TAP A ROAD TO MOVE" hint. Units with a
 * special skill (docs/specials.md: gas grenade, ram, rapid fire, frag, missile, air strike) get
 * the charge ring and, once charged, a pulsing skill button (THROW GAS, or the skill's round
 * icon button + stamp); the tank's / helicopter's button enters the aim / paint mode and turns
 * into CANCEL meanwhile, with the instructions on the hint line.
 * Also floats a bouncing ready cue (the skill's icon) over every charged unit in the world
 * (tap = use).
 */
import { Container, Sprite, type Texture } from 'pixi.js';
import { buf, hline, rect, stamp } from '../../art/fx/draw';
import { FONTS, lineWidth, type BitmapFont } from '../../art/uikit/text';
import { abilityRing } from '../../art/uikit/cards';
import { ICONS } from '../../art/uikit/icons';
import { stampButton, type ButtonState } from '../../art/uikit/buttons';
import { specialButton, specialCue, type SpecialSkill } from '../../art/uikit/specials';
import type { PixelBuffer } from '../../art/lib/pixels';
import { panel } from '../../art/uikit/panels';
import { tileToWorld } from '../../core/iso';
import { UNITS, type AbilityId } from '../../data/units';
import type { GameController } from '../../game/controller';
import type { Unit } from '../../sim/units';
import { unitPortrait } from '../art';
import { Button, facesFrom, stampFaces, type ButtonFaces } from '../core/button';
import { Label } from '../core/label';
import { capBlockH, overlaps, textBelow, type Box, type TextBox } from '../core/boxes';
import { makeInteractive } from '../core/node';
import { swapOwned, uiTex, destroyOwned } from '../core/tex';
import { UNIT_COPY, UI_TEXT } from '../strings';
import type { HudLayout } from '../layout';
import type { UiApp } from '../app';

/** The art's icon / cue name of each new skill (the gas grenade keeps its own cue). */
const SKILL_ICON: Record<Exclude<AbilityId, 'gasGrenade'>, SpecialSkill> = {
  ram: 'ram',
  rapidFire: 'rapid',
  fragGrenade: 'frag',
  missile: 'missile',
  airStrike: 'air',
};

/**
 * Skill button labels (stamp beside the round icon button). Short enough that icon + stamp
 * (≤ 87 UI px) stays clear of the charge ring on the narrowest panel (120 UI px).
 */
const SKILL_LABEL: Record<AbilityId, string> = {
  gasGrenade: 'THROW GAS',
  ram: 'RAM!',
  rapidFire: 'RAPID',
  fragGrenade: 'GRENADE',
  missile: 'MISSILE',
  airStrike: 'STRIKE',
};

/** Instructions on the hint line while aiming / painting (touch, mouse). */
export const SKILL_MODE_HINT = {
  aim: ['TAP A TARGET, THEN TAP IT AGAIN', 'CLICK A TARGET IN THE RING'],
  paint: ['DRAG A LINE TO STRIKE', 'DRAG A LINE TO STRIKE'],
} as const;

/** Round icon button + stamp label, one face per button state. */
function skillFace(icon: SpecialSkill | 'cancel', label: string, st: ButtonState): PixelBuffer {
  const round = specialButton(icon, st);
  const stampB = stampButton(label, 0, st);
  const h = Math.max(round.h, stampB.h);
  const b = buf(round.w + 1 + stampB.w, h);
  stamp(b, round, 0, Math.floor((h - round.h) / 2));
  stamp(b, stampB, round.w + 1, Math.floor((h - stampB.h) / 2));
  return b;
}

/** Size (UI px) of a skill's info-panel button (`cancel` = the CANCEL face of the aim modes). */
export function skillButtonSize(ab: AbilityId, cancel = false): { w: number; h: number } {
  const b =
    ab === 'gasGrenade' && !cancel
      ? stampButton(SKILL_LABEL.gasGrenade, 0, 'normal')
      : skillFace(
          cancel ? 'cancel' : SKILL_ICON[ab as keyof typeof SKILL_ICON],
          cancel ? 'CANCEL' : SKILL_LABEL[ab],
          'normal',
        );
  return { w: b.w, h: b.h };
}

function skillFaces(ab: AbilityId, cancel: boolean): ButtonFaces {
  if (cancel) return facesFrom('skill:cancel', (st) => skillFace('cancel', 'CANCEL', st));
  if (ab === 'gasGrenade') return stampFaces(SKILL_LABEL.gasGrenade);
  const icon = SKILL_ICON[ab];
  return facesFrom(`skill:${ab}`, (st) => skillFace(icon, SKILL_LABEL[ab], st));
}

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

export interface InfoPanelSpec {
  w: number;
  /** Minimum height (the layout's slot); the panel grows upward when the copy needs more. */
  h: number;
  name: string;
  hpText: string;
  /** Role line (hidden on the compact phone panel). */
  role: string;
  /** "KILLS n" / "HOLDING THE LINE" ('' = hidden). */
  kills: string;
  /** Commandable units: the move hint, blinking in turns with the kills ('' = none). */
  hint: string;
  /** Tear Gas Shooter: charge ring (bottom-right) and, when charged, the THROW GAS button. */
  ring: boolean;
  throwBtn: { w: number; h: number } | null;
}

export interface InfoPanelLayout {
  h: number;
  compact: boolean;
  well: Box;
  close: Box;
  /** Text blocks; each `w` is also its wrap width. */
  name: TextBox;
  hp: Box;
  hpText: TextBox;
  role: TextBox;
  kills: TextBox;
  hint: TextBox;
  ring: Box | null;
  throwBtn: Box | null;
}

/**
 * Selected-unit panel geometry (panel px): the name, HP line, role and kills / move hint flow
 * top-down beside the portrait and wrap clear of the close button, the gas charge ring and the
 * THROW GAS button; the panel grows (upward, see InfoPanel) when the copy needs more room. The
 * HP text sits beside the bar when it fits, else under it. Pure (unit-tested for every unit).
 */
export function infoPanelLayout(sp: InfoPanelSpec): InfoPanelLayout {
  const compact = sp.h < 52;
  const ps = compact ? 28 : 36;
  const x = 12 + ps + 5;
  const right = sp.w - 7;
  let h = sp.h;
  let out: InfoPanelLayout | null = null;
  let footerMode = false;
  for (let pass = 0; pass < 6; pass++) {
    const close = { x: sp.w - 12, y: 3, w: 9, h: 9 };
    const ring = sp.ring ? { x: sp.w - 21, y: h - 22, w: 18, h: 18 } : null;
    const tb = sp.throwBtn
      ? { x: Math.max(6, sp.w - sp.throwBtn.w - 24), y: h - sp.throwBtn.h - 3, ...sp.throwBtn }
      : null;
    // Footer mode: the ring / button get a row of their own under the text (no wrapping round).
    const obstacles = [
      close,
      ...(!footerMode && ring ? [ring] : []),
      ...(!footerMode && tb ? [tb] : []),
    ];
    // Text block (cap line `cap`, ink from `after` down) wrapped to the room left of every
    // obstacle in its band.
    const flow = (font: BitmapFont, str: string, cap: number, after: number): TextBox => {
      let w = right - x;
      let box = textBelow(font, str, x, cap, after, w);
      // Never narrower than the longest word (a clash left is solved by the footer below).
      const minW = Math.max(...str.split(/\s+/).map((wd) => lineWidth(font, wd)));
      for (let k = 0; k < 4 && str; k++) {
        const hit = obstacles.filter((o) => overlaps(box, o, 1));
        if (!hit.length) break;
        const nw = Math.min(w, Math.min(...hit.map((o) => o.x - 3)) - x);
        if (nw < minW || nw === w) break;
        w = nw;
        box = textBelow(font, str, x, cap, after, w);
      }
      return box;
    };
    // Designed rows (name 5, HP 15, role 24, bottom line 33 / 45), pushed down by wraps.
    const name = flow(FONTS.smallBold, sp.name, 5, 0);
    const nameH = capBlockH(FONTS.smallBold, sp.name, name.w || undefined);
    const hpY = Math.max(15, name.capY + nameH + 3, name.y + name.h + 1);
    const hp = { x, y: hpY, w: 48, h: 6 };
    const ht = textBelow(FONTS.small, sp.hpText, x + 52, hpY, 0);
    const beside = ht.x + ht.w <= right && !obstacles.some((o) => overlaps(ht, o, 1));
    const hpText = beside ? ht : flow(FONTS.small, sp.hpText, hpY + 9, hpY + 7);
    let cap = hpText.capY + 9;
    let after = Math.max(hp.y + hp.h, hpText.y + hpText.h) + 1;
    const role = compact || !sp.role ? null : flow(FONTS.small, sp.role, cap, after);
    if (role) {
      cap = role.capY + capBlockH(FONTS.small, sp.role, role.w) + 4;
      after = role.y + role.h + 1;
    }
    // Bottom line: the kills and the blinking move hint take turns in the same slot.
    const footCap = Math.max(compact ? 33 : 45, cap);
    const kills = flow(FONTS.smallBold, sp.kills, footCap, after);
    const hint = flow(FONTS.smallBold, sp.hint, footCap, after);
    const last = [kills, hint].filter((b) => b.w > 0).sort((a, b) => b.y + b.h - (a.y + a.h))[0];
    out = {
      h,
      compact,
      // The portrait stays centred on the slot's rows (a footer row may grow under it).
      well: { x: 12, y: Math.floor((sp.h - ps) / 2) - 1, w: ps, h: ps },
      close,
      name,
      hp,
      hpText,
      role: role ?? { x, y: after, w: 0, h: 0, capY: after },
      kills,
      hint,
      ring,
      throwBtn: tb,
    };
    const bottom = last ? Math.max(last.y + last.h, last.capY + 7) : 0;
    // Still clashing with the gas ring / THROW GAS button: give them a footer row of their own.
    const texts = [name, hpText, role, kills, hint].filter((b): b is TextBox => !!b && b.w > 0);
    const clash = texts.some((t) => [ring, tb].some((o) => o && overlaps(t, o, 1)));
    const footer = Math.max(ring ? 23 : 0, tb ? tb.h + 4 : 0);
    if (footerMode) {
      // Final pass: the footer row sits under the text; then place it at the new bottom.
      const fh = Math.max(sp.h, bottom + 1 + footer);
      if (fh !== h) {
        h = fh;
        continue;
      }
      break;
    }
    if (clash) {
      footerMode = true;
      continue;
    }
    if (bottom + 3 <= h) break;
    h = bottom + 3;
  }
  return out!;
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
  /** World-space ready cues over charged units (screen UI px). */
  private readonly cues = new Container({ label: 'ability-cues' });
  private readonly cuePool: Sprite[] = [];
  private readonly cueFrames: Texture[];
  /** Faces shown on the skill button (skill id, or 'cancel' in the aim / paint mode). */
  private faceKey = '';
  private unitId = -1;
  private key = '';
  private hpKey = '';
  private t = 0;
  private readonly killCount = new Map<number, number>();
  private w = 140;
  /** Slot height from the HUD layout (minimum) and the height actually shown. */
  private h = 58;
  private panelH = 0;
  private bgW = 0;
  private slot: Box = { x: 0, y: 0, w: 140, h: 58 };
  private throwAt: Box | null = null;
  private portraitKey = '';

  constructor(
    private readonly app: UiApp,
    private readonly game: GameController,
  ) {
    makeInteractive(this.bg, { blockOnly: true });
    this.throwBtn = new Button(stampFaces('THROW GAS'), {
      onTap: () => {
        if (this.unitId < 0) return;
        if (game.skillMode?.unitId === this.unitId) game.cancelSkill();
        else game.useAbility(this.unitId);
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
    this.key = this.portraitKey = '';
  }

  layout(l: HudLayout): void {
    this.w = Math.max(120, Math.min(176, l.info.w));
    this.h = l.info.h;
    this.slot = l.info;
    this.key = this.portraitKey = '';
  }

  /**
   * Bottom-left in its slot, grown upward — and lifted above the wave button (and its countdown
   * line) when they would share columns, so the panel never covers LET THEM COME / CALL EARLY.
   */
  private place(): void {
    let bottom = this.slot.y + this.slot.h;
    const wb = this.app.hud?.wave.rect();
    if (wb && wb.x < this.slot.x + this.w + 2 && wb.x + wb.w > this.slot.x - 2)
      bottom = Math.min(bottom, wb.y - 13);
    this.root.position.set(this.slot.x, bottom - this.panelH);
  }

  /** UI rect of the panel as shown (it grows upward from its slot for long copy). */
  rect(): Box {
    return { x: this.root.x, y: this.root.y, w: this.w, h: this.panelH };
  }

  /** Lay the panel out for the unit's current copy (rebuilt when any of it changes). */
  private build(u: Unit, spec: InfoPanelSpec): void {
    const g = infoPanelLayout(spec);
    if (g.h !== this.panelH || this.bgW !== this.w) {
      this.panelH = g.h;
      this.bgW = this.w;
      swapOwned(this.bg, panel('paper', this.w, g.h), 'ui:info');
    }
    const ps = g.well.w;
    const pk = `${u.id}:${ps}:${g.well.y}`;
    const p = pk !== this.portraitKey ? unitPortrait(u.type) : null;
    if (pk !== this.portraitKey) {
      this.portraitKey = pk;
      swapOwned(this.portraitWell, panel('recess', ps, ps), 'ui:info-well');
      this.portraitWell.position.set(g.well.x, g.well.y);
    }
    if (p) {
      swapOwned(this.portrait, p, 'ui:info-portrait');
      this.portrait.position.set(
        this.portraitWell.x + Math.floor((ps - 32) / 2),
        this.portraitWell.y + ps - 1 - 32 + (g.compact ? 2 : 0),
      );
      this.portrait.visible = !g.compact;
    }
    const place = (lab: Label, b: TextBox, text: string): void => {
      lab.opts = { ...lab.opts, maxWidth: Math.max(1, b.w) };
      lab.set('');
      lab.set(text);
      // Label sprites are trimmed to their ink: the top row is the highest accent.
      lab.position.set(b.x, b.y);
    };
    place(this.name, g.name, spec.name);
    this.hp.position.set(g.hp.x, g.hp.y);
    place(this.hpText, g.hpText, spec.hpText);
    place(this.role, g.role, g.compact ? '' : spec.role);
    place(this.kills, g.kills, spec.kills);
    place(this.hint, g.hint, spec.hint);
    this.close.position.set(g.close.x, g.close.y);
    if (g.ring) this.ring.position.set(g.ring.x, g.ring.y);
    this.throwAt = g.throwBtn;
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
    const inv = !Number.isFinite(u.maxHp) || u.def.invulnerable;
    const frac = inv ? 1 : u.hp / Math.max(1, u.maxHp);
    const hk = `${Math.round(frac * 48)}:${u.members}`;
    if (hk !== this.hpKey) {
      this.hpKey = hk;
      swapOwned(this.hp, hpBar(frac, 48), 'ui:hp');
    }
    const compact = this.h < 52;
    const ab = u.def.ability;
    const gas = !!ab;
    const mode = this.game.skillMode?.unitId === u.id ? this.game.skillMode.mode : null;
    // The skill button: its own faces, CANCEL while aiming / painting.
    const fk = ab ? `${ab.id}:${mode ? 'cancel' : ''}` : '';
    if (ab && fk !== this.faceKey) {
      this.faceKey = fk;
      this.throwBtn.setFaces(skillFaces(ab.id, mode !== null));
    }
    const k = this.killCount.get(u.id) ?? 0;
    const spec: InfoPanelSpec = {
      w: this.w,
      h: this.h,
      name: UNITS[u.type].name.toUpperCase(),
      hpText: inv
        ? 'INVULNERABLE'
        : u.def.squad > 1
          ? `${u.members}/${u.def.squad} MEN`
          : `${Math.ceil(u.hp)} HP`,
      role: UNIT_COPY[u.type].role,
      // Phones keep the commandable units' panel to the move hint.
      kills: u.def.commandable && compact ? '' : u.def.attack ? `KILLS ${k}` : `HOLDING THE LINE`,
      hint: mode
        ? SKILL_MODE_HINT[mode][this.app.touch ? 0 : 1]
        : u.def.commandable
          ? this.app.touch
            ? UI_TEXT.moveHint
            : UI_TEXT.moveHintMouse
          : '',
      ring: gas,
      // Room for THROW GAS is kept while it charges too (the panel doesn't jump when ready).
      throwBtn: gas ? { w: this.throwBtn.w, h: this.throwBtn.h } : null,
    };
    const key = `${u.id}:${this.w}:${this.h}:${spec.hpText}:${spec.kills}:${spec.hint}:${this.throwBtn.w}`;
    if (key !== this.key) {
      this.key = key;
      this.build(u, spec);
    }
    this.place();
    // Commandable hint / skill ring and button.
    this.ring.visible = gas;
    this.throwBtn.visible = gas && u.abilityReady;
    if (gas) {
      const step = u.abilityReady ? 10 : Math.floor((u.charge / ab.charge) * 10);
      this.ring.texture = uiTex(`ring:${step}`, () => abilityRing(Math.max(0, Math.min(10, step))));
      const at = this.throwAt;
      if (this.throwBtn.visible && at) {
        const bob = mode ? 1 : Math.floor(this.t * 3) % 2;
        this.throwBtn.position.set(at.x, at.y + 1 - bob);
      }
    }
    this.hint.visible =
      !!spec.hint && (compact || mode !== null || Math.floor(this.t * 1.6) % 2 === 0);
    this.kills.visible = !!spec.kills && !this.hint.visible;
  }

  /** Bouncing ready cues over charged units (tap one to use the skill). */
  private updateCues(l: HudLayout): void {
    let n = 0;
    const w = this.game.world;
    const f = Math.floor(this.t * 8) % 4;
    const busy = this.game.skillMode?.unitId ?? -1;
    if (!this.game.attract) {
      for (const u of w.units.active) {
        const ab = u.def.ability;
        if (!u.abilityReady || !ab || u.id === busy) continue;
        const p = tileToWorld(u.x, u.y);
        // Above the head (vehicles are taller; roof units and the helicopter are lifted).
        const lift = (this.game.view.units.entity(u.id)?.lift ?? 0) + (u.def.vehicle ? 40 : 34);
        const s = this.game.view.worldToUi(p.x, p.y - lift);
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
        sp.texture =
          ab.id === 'gasGrenade'
            ? this.cueFrames[f]!
            : uiTex(`cue:${ab.id}:${f}`, () =>
                specialCue(SKILL_ICON[ab.id as keyof typeof SKILL_ICON], f),
              );
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
