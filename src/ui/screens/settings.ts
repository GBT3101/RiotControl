/**
 * Settings dossier: music / sound / UI volume sliders and mute (M11 engine, persisted by it),
 * default game speed, quality tier (next run), screen shake (reduced motion), replay tutorial
 * (M10 reads `settings.replayTutorial`), language (EN). Game settings persist in
 * `riot.settings.v1`.
 */
import { Container, Sprite } from 'pixi.js';
import { buf, hline, px, rect, vline } from '../../art/fx/draw';
import type { PixelBuffer } from '../../art/lib/pixels';
import { FONTS, drawText, measureText } from '../../art/uikit/text';
import type { VolumeChannel } from '../../audio/types';
import { Button, facesFrom, stampFaces, type ButtonFaces } from '../core/button';
import { Label } from '../core/label';
import { makeInteractive } from '../core/node';
import { swapOwned } from '../core/tex';
import type { HudLayout } from '../layout';
import type { UiApp } from '../app';
import { dossier } from './common';
import { backdrop, fitBackdrop, type Screen } from './screen';

const STEPS = 10;

/** Small toggle chip (13 px tall): paper when off, red ink stamp when on. */
export function chip(label: string, on: boolean, state: string): PixelBuffer {
  const m = measureText(FONTS.smallBold, label);
  const w = Math.max(22, m.w + 10);
  const b = buf(w, 14);
  const dy = state === 'pressed' ? 1 : 0;
  if (!dy) hline(b, 1, 13, w - 2, 'ochre1');
  rect(b, 0, dy, w, 13, 'ink');
  const face = on ? 'crim1' : state === 'hover' ? 'white' : 'stone5';
  rect(b, 1, 1 + dy, w - 2, 11, face);
  hline(b, 1, 1 + dy, w - 2, on ? 'crim2' : 'white');
  hline(b, 1, 11 + dy, w - 2, on ? 'rust0' : 'stone3');
  drawText(b, FONTS.smallBold, label, Math.floor((w - m.w) / 2), 3 + dy, on ? 'stone5' : 'ink');
  return b;
}

function chipFaces(label: string, on: boolean): ButtonFaces {
  return facesFrom(`chip:${label}:${on}`, (st) => chip(label, on, st));
}

/** Slider track: recessed well with 10 brass segments. */
export function sliderTrack(value: number, w: number, muted = false): PixelBuffer {
  const b = buf(w, 9);
  rect(b, 0, 0, w, 9, 'ink');
  rect(b, 1, 1, w - 2, 7, 'earth0');
  hline(b, 1, 1, w - 2, 'ink');
  const seg = (w - 2) / STEPS;
  const n = Math.round(value * STEPS);
  for (let k = 0; k < STEPS; k++) {
    const x0 = 1 + Math.round(k * seg) + 1;
    const x1 = 1 + Math.round((k + 1) * seg) - 1;
    const on = k < n;
    const face = on ? (muted ? 'gray4' : 'ochre3') : 'earth1';
    rect(b, x0, 2, x1 - x0, 6, face);
    if (on) hline(b, x0, 2, x1 - x0, muted ? 'gray5' : 'ochre4');
    if (on) hline(b, x0, 7, x1 - x0, muted ? 'gray3' : 'ochre1');
  }
  vline(b, w - 1, 0, 9, 'ink');
  return b;
}

/** Value of a tap at local x on a track of width w (0..1 in tenths). */
export function sliderValueAt(x: number, w: number): number {
  return Math.max(0, Math.min(STEPS, Math.ceil(((x - 1) / (w - 2)) * STEPS))) / STEPS;
}

class Slider extends Container {
  private readonly track = new Sprite();
  private readonly pct = new Label('smallBold', 'ink');
  private v = 0;

  constructor(
    private readonly w: number,
    private readonly get: () => number,
    private readonly set: (v: number) => void,
    private readonly muted: () => boolean,
  ) {
    super();
    this.addChild(this.track, this.pct);
    this.pct.position.set(w + 5, 1);
    const apply = (x: number): void => {
      const v = sliderValueAt(x, this.w);
      if (v !== this.v) {
        this.set(v);
        this.refresh();
      }
    };
    makeInteractive(this.track, {
      hit: { x: -2, y: -4, w: w + 4, h: 17 },
      tap: (e) => apply(e.x),
      drag: (_dx, _dy, e) => {
        void e;
        return true;
      },
    });
    // Drag: track the absolute pointer by integrating dx.
    let dragX = -1;
    const h = (
      this.track as unknown as {
        __ui: {
          drag: (dx: number) => boolean;
          dragEnd: () => void;
          tap: (e: { x: number }) => void;
        };
      }
    ).__ui;
    h.drag = (dx: number) => {
      if (dragX < 0) dragX = this.v * this.w;
      dragX = Math.max(0, Math.min(this.w, dragX + dx));
      apply(dragX);
      return true;
    };
    h.dragEnd = () => (dragX = -1);
    this.refresh();
  }

  refresh(): void {
    this.v = this.get();
    swapOwned(this.track, sliderTrack(this.v, this.w, this.muted()), 'ui:slider');
    this.pct.set(`${Math.round(this.v * 100)}%`);
  }
}

interface Choice<T> {
  label: string;
  value: T;
}

class Options<T> extends Container {
  private readonly buttons: Array<{ b: Button; v: T; faces: ButtonFaces; on: ButtonFaces }> = [];

  constructor(
    choices: Choice<T>[],
    private readonly get: () => T,
    set: (v: T) => void,
  ) {
    super();
    let x = 0;
    for (const c of choices) {
      const faces = chipFaces(c.label, false);
      const on = chipFaces(c.label, true);
      const b = new Button(faces, {
        onTap: () => {
          set(c.value);
          this.refresh();
        },
        pad: 3,
      });
      b.position.set(x, 0);
      x += b.w + 2;
      this.addChild(b);
      this.buttons.push({ b, v: c.value, faces, on });
    }
    this.refresh();
  }

  refresh(): void {
    const cur = this.get();
    for (const x of this.buttons) x.b.setFaces(x.v === cur ? x.on : x.faces);
  }
}

export class SettingsScreen implements Screen {
  readonly root = new Container({ label: 'settings' });
  readonly modal = true;
  private readonly dim = backdrop(0.55);
  private readonly panel = new Sprite();
  private readonly rows: Array<{ label: string; widget: Container | null; note?: string }> = [];
  private readonly back: Button;
  private readonly sliders: Slider[] = [];
  private readonly labels = new Container();

  constructor(private readonly app: UiApp) {
    makeInteractive(this.panel, { blockOnly: true });
    this.root.addChild(this.dim, this.panel, this.labels);
    const audio = app.audio;
    const vol = (ch: VolumeChannel) => () => audio?.getSettings()[ch] ?? 0;
    const setVol = (ch: VolumeChannel, also?: VolumeChannel) => (v: number) => {
      audio?.setVolume(ch, v);
      if (also) audio?.setVolume(also, v);
      app.sfx('click');
    };
    const muted = () => app.muted;
    const sw = 70;
    const music = new Slider(sw, vol('music'), setVol('music'), muted);
    const sfx = new Slider(sw, vol('sfx'), setVol('sfx', 'ambience'), muted);
    const ui = new Slider(sw, vol('ui'), setVol('ui'), muted);
    this.sliders.push(music, sfx, ui);
    const s = app.settings;
    const save = () => app.saveSettings();
    const onOff = (get: () => boolean, set: (v: boolean) => void) =>
      new Options<boolean>(
        [
          { label: 'ON', value: true },
          { label: 'OFF', value: false },
        ],
        get,
        (v) => {
          set(v);
          save();
        },
      );
    this.rows.push(
      { label: 'MUSIC', widget: music },
      { label: 'SOUND FX', widget: sfx },
      { label: 'INTERFACE', widget: ui },
      {
        label: 'MUTE ALL',
        widget: onOff(
          () => app.muted,
          (v) => {
            if (v !== app.muted) app.toggleMute();
            for (const sl of this.sliders) sl.refresh();
          },
        ),
      },
      {
        label: 'START SPEED',
        widget: new Options<1 | 2 | 3>(
          [
            { label: '1×', value: 1 },
            { label: '2×', value: 2 },
            { label: '3×', value: 3 },
          ],
          () => s.speed,
          (v) => {
            s.speed = v;
            save();
          },
        ),
      },
      {
        label: 'QUALITY',
        widget: new Options(
          [
            { label: 'AUTO', value: 'auto' as const },
            { label: 'HIGH', value: 'high' as const },
            { label: 'LOW', value: 'low' as const },
          ],
          () => s.quality,
          (v) => {
            s.quality = v;
            save();
            app.toast.info('QUALITY APPLIES FROM THE NEXT RUN');
          },
        ),
      },
      {
        label: 'SCREEN SHAKE',
        widget: onOff(
          () => s.shake,
          (v) => (s.shake = v),
        ),
      },
      {
        label: 'TUTORIAL',
        widget: new Options<boolean>(
          [
            { label: 'REPLAY', value: true },
            { label: 'DONE', value: false },
          ],
          () => s.replayTutorial,
          (v) => {
            s.replayTutorial = v;
            save();
          },
        ),
      },
      { label: 'LANGUAGE', widget: null, note: 'ENGLISH' },
    );
    for (const r of this.rows) if (r.widget) this.root.addChild(r.widget);
    this.back = new Button(stampFaces('DONE', 80), { onTap: () => app.pop(this), pad: 3 });
    this.root.addChild(this.back);
  }

  layout(l: HudLayout): void {
    fitBackdrop(this.dim, l);
    const rowH = l.H < 260 ? 16 : 19;
    const w = Math.min(244, l.W - 8);
    const h = 18 + this.rows.length * rowH + this.back.h + 10;
    const b = dossier(w, h, 'FILE: PREFERENCES');
    const labelW = Math.max(...this.rows.map((r) => measureText(FONTS.smallBold, r.label).w)) + 8;
    let y = 10 + 14;
    for (const r of this.rows) {
      drawText(b, FONTS.smallBold, r.label, 10, y + Math.floor((rowH - 7) / 2) - 1, 'ink');
      if (r.note && r.widget) {
        const m = measureText(FONTS.small, r.note);
        drawText(b, FONTS.small, r.note, w - 10 - m.w, y + Math.floor((rowH - 7) / 2), 'stone1');
      } else if (r.note) {
        drawText(b, FONTS.mono, r.note, labelW + 10, y + Math.floor((rowH - 7) / 2) - 1, 'gray1');
      }
      for (let x = 10; x < w - 10; x += 2) px(b, x, y + rowH - 2, 'stone2');
      y += rowH;
    }
    swapOwned(this.panel, b, 'ui:settings');
    const x0 = Math.floor((l.W - w) / 2);
    const y0 = Math.max(l.safe.top + 1, Math.floor((l.H - h - 10) / 2));
    this.panel.position.set(x0, y0);
    let ry = y0 + 10 + 14;
    for (const r of this.rows) {
      if (r.widget) {
        const wh = r.widget instanceof Slider ? 9 : 13;
        r.widget.position.set(x0 + labelW + 10, ry + Math.floor((rowH - wh) / 2) - 1);
      }
      ry += rowH;
    }
    this.back.position.set(x0 + Math.floor((w - this.back.w) / 2), ry + 3);
  }

  update(): void {}

  key(code: string): boolean {
    if (code === 'Escape') {
      this.app.pop(this);
      return true;
    }
    return false;
  }

  destroy(): void {
    this.app.saveSettings();
    this.root.destroy({ children: true });
  }
}
