/**
 * End of run. Victory (5000 Legitimacy) or defeat (Capitol integrity 0):
 *
 *  1. the city's newspaper front page spins in ("ORDER RESTORED" / "THE REGIME HAS FALLEN"),
 *     its picture box filled with a live snapshot of the Capitol rendered from the world and
 *     reprinted as a dithered newsprint photo; a rubber stamp lands with a thump;
 *  2. the stats ledger dossier slides in and its rows are typed out: protesters fallen by type
 *     (mini portraits), officers lost by type, Breta, Hate earned / spent, peak crowd, time,
 *     Capitol damage;
 *  3. the closing line types itself out, slowly, in big typewriter letters:
 *     "You kept order. But at what cost?";
 *  4. PLAY AGAIN · OTHER CITY · TITLE.
 *
 * Any tap fast-forwards the current beat.
 */
import { Container, Matrix, RenderTexture, Sprite } from 'pixi.js';
import { buf, col, hline, px, rect, stamp } from '../../art/fx/draw';
import { crop, opaqueBounds, type PixelBuffer } from '../../art/lib/pixels';
import { rubberStamp } from '../../art/uikit/banners';
import { textMask } from '../../art/uikit/logo';
import { frontPage, frontPageLayout } from '../../art/uikit/newspaper';
import { FONTS, drawText, measureText } from '../../art/uikit/text';
import { tileToWorld } from '../../core/iso';
import { PROTESTER_IDS, protesterDef, type ProtesterId } from '../../data/protesters';
import { BALANCE } from '../../data/balance';
import { UNITS, UNIT_ORDER, type UnitId } from '../../data/units';
import type { GameController } from '../../game/controller';
import type { Renderer } from 'pixi.js';
import { totalFallen, totalOfficersLost, type StatsLedger } from '../../sim/stats';
import { protesterFigure, unitPortrait } from '../art';
import { ease, prog, stampDrop } from '../core/anim';
import { Button, stampFaces } from '../core/button';
import { makeInteractive } from '../core/node';
import { ownTex, destroyOwned } from '../core/tex';
import { formatDuration, formatNumber } from '../records';
import { CITY_COPY, UI_TEXT, closingLine, pickVariant } from '../strings';
import type { HudLayout } from '../layout';
import type { UiApp } from '../app';
import { dossier } from './common';
import { backdrop, fitBackdrop, type Screen } from './screen';

/* ── Newspaper ───────────────────────────────────────────────────────────────────── */

/**
 * Picture-box rect (inside the frame) of `frontPage(city, headline, deck, w, h, _, reserve)`:
 * the picture stops above the stamp's corner when the stamp would land on it.
 */
export function frontPageBox(
  city: 'madrid' | 'london' | 'paris',
  headline: string,
  deck: string,
  w: number,
  h: number,
  reserve?: { w: number; h: number },
): { x: number; y: number; w: number; h: number } {
  const p = frontPageLayout(city, headline, deck, w, h, reserve).photo;
  return { x: p.x + 1, y: p.y + 1, w: p.w - 2, h: p.h - 2 };
}

/**
 * Front-page height for a page `w` wide: the usual 4:3-ish sheet, taller when the headline and
 * deck wrap (narrow phones) so the picture keeps ≥ 40 px above the stamp's corner; ≤ `maxH`.
 */
export function paperHeight(
  city: 'madrid' | 'london' | 'paris',
  headline: string,
  deck: string,
  w: number,
  maxH: number,
  st: { w: number; h: number },
): number {
  const top = frontPageLayout(city, headline, deck, w, 400, st).photo.y;
  const need = top + 40 + 3 + st.h + 12;
  return Math.min(maxH, Math.max(Math.round(w * 0.76), need));
}

const NEWS_TONES = ['ink', 'gray2', 'gray4', 'stone3', 'stone4', 'stone5'];

/**
 * Reprint RGBA pixels (2× the box) as a newsprint photo: 2×2 box-filter luminance, contrast
 * stretch, 4×4 ordered dither onto paper greys. Palette-pure. Pure.
 */
export function newsprintPhoto(
  rgba: Uint8Array | Uint8ClampedArray,
  sw: number,
  sh: number,
  w: number,
  h: number,
): PixelBuffer {
  const b = buf(w, h);
  const lum = new Float32Array(w * h);
  let lo = 255;
  let hi = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          const sx = x * 2 + dx;
          const sy = y * 2 + dy;
          if (sx >= sw || sy >= sh) continue;
          const o = (sy * sw + sx) * 4;
          // Nothing drawn there (off the map): blank paper.
          if (rgba[o + 3]! < 128) continue;
          s += 0.3 * rgba[o]! + 0.59 * rgba[o + 1]! + 0.11 * rgba[o + 2]!;
          n++;
        }
      const l = n ? s / n : -1;
      lum[y * w + x] = l;
      if (l < 0) continue;
      lo = Math.min(lo, l);
      hi = Math.max(hi, l);
    }
  }
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const tones = NEWS_TONES.map((t) => col(t));
  const span = Math.max(1, hi - lo);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const raw = lum[y * w + x]!;
      const t = raw < 0 ? 1 : (raw - lo) / span;
      const v = t * (tones.length - 1) + (bayer[(y & 3) * 4 + (x & 3)]! / 16 - 0.5) * 0.9;
      const k = Math.max(0, Math.min(tones.length - 1, Math.round(v)));
      const c = tones[k]!;
      const o = (y * w + x) * 4;
      b.data[o] = c >>> 24;
      b.data[o + 1] = (c >>> 16) & 255;
      b.data[o + 2] = (c >>> 8) & 255;
      b.data[o + 3] = 255;
    }
  }
  return b;
}

/** Render the world around (cx, cy) (world px) at 1× into RGBA (w×h). */
function worldSnapshot(
  game: GameController,
  renderer: Renderer,
  cx: number,
  cy: number,
  w: number,
  h: number,
): { pixels: Uint8Array | Uint8ClampedArray; width: number; height: number } | null {
  try {
    const rt = RenderTexture.create({ width: w, height: h });
    const world = game.view.layers.world;
    const m = new Matrix().translate(Math.round(w / 2 - cx), Math.round(h / 2 - cy));
    const saved = world.localTransform.clone();
    const sx = world.scale.x;
    const px0 = world.position.x;
    const py0 = world.position.y;
    world.scale.set(1);
    world.position.set(0, 0);
    renderer.render({
      container: world,
      target: rt,
      clear: true,
      clearColor: [0, 0, 0, 0],
      transform: m,
    });
    world.scale.set(sx);
    world.position.set(px0, py0);
    void saved;
    const out = renderer.extract.pixels(rt);
    rt.destroy(true);
    return { pixels: out.pixels, width: out.width, height: out.height };
  } catch (err) {
    console.warn('[riot] snapshot failed', err);
    return null;
  }
}

/* ── Ledger ──────────────────────────────────────────────────────────────────────── */

/** Small head crop (top of the opaque bounds) of a portrait / figure, ≤ size². */
export function miniHead(src: PixelBuffer | null, size = 10, skip = 0): PixelBuffer | null {
  if (!src) return null;
  const ob = opaqueBounds(src);
  if (!ob) return null;
  const w = Math.min(size, ob.w);
  const x = ob.x + Math.floor((ob.w - w) / 2);
  const y = Math.min(ob.y + skip, ob.y + Math.max(0, ob.h - size));
  return crop(src, x, y, w, Math.min(size, ob.h));
}

export interface LedgerRow {
  icon: PixelBuffer | null;
  label: string;
  value: string;
  strong?: boolean;
}

export interface LedgerSection {
  title: string;
  rows: LedgerRow[];
}

/** Ledger sections from the run statistics. Pure (icons optional). */
export function ledgerSections(
  s: StatsLedger,
  icons: {
    protester?: (p: ProtesterId) => PixelBuffer | null;
    unit?: (u: UnitId) => PixelBuffer | null;
  } = {},
): LedgerSection[] {
  const prot: LedgerRow[] = [];
  for (const p of PROTESTER_IDS) {
    if (p === 'breta') continue;
    const n = s.protestersFallen[p];
    if (n > 0)
      prot.push({
        icon: icons.protester?.(p) ?? null,
        label: protesterDef(p).name,
        value: formatNumber(n),
      });
  }
  if (!prot.length) prot.push({ icon: null, label: 'Nobody. Suspicious.', value: '0' });
  prot.push({ icon: null, label: 'TOTAL', value: formatNumber(totalFallen(s)), strong: true });
  const units: LedgerRow[] = [];
  for (const u of UNIT_ORDER) {
    const n = s.officersLost[u];
    if (n > 0)
      units.push({ icon: icons.unit?.(u) ?? null, label: UNITS[u].name, value: formatNumber(n) });
  }
  if (!units.length) units.push({ icon: null, label: 'None. Remarkable.', value: '0' });
  units.push({
    icon: null,
    label: 'TOTAL',
    value: formatNumber(totalOfficersLost(s)),
    strong: true,
  });
  const breta = s.bretaDowned > 0 ? 'DOWNED' : s.bretaSpawned > 0 ? 'ESCAPED' : 'NOT SIGHTED';
  const summary: LedgerRow[] = [
    { icon: null, label: 'Breta', value: breta },
    { icon: null, label: 'Hate earned', value: formatNumber(s.hateEarned) },
    { icon: null, label: 'Hate spent', value: formatNumber(s.hateSpent) },
    // Start grant + earned − spent: makes the two lines above add up (M13b).
    {
      icon: null,
      label: 'Hate unspent',
      value: formatNumber(Math.max(0, BALANCE.startHate + s.hateEarned - s.hateSpent)),
    },
    { icon: null, label: 'Peak crowd', value: formatNumber(s.peakCrowd) },
    { icon: null, label: 'Waves', value: String(s.wave) },
    { icon: null, label: 'Time', value: formatDuration(s.time) },
    {
      icon: null,
      label: 'Capitol damage',
      value: `${Math.round((1 - s.capitolIntegrity) * 100)}%`,
      strong: true,
    },
  ];
  return [
    { title: 'PROTESTERS FALLEN', rows: prot },
    { title: 'OFFICERS LOST', rows: units },
    { title: 'THE BOTTOM LINE', rows: summary },
  ];
}

const ROW_H = 11;

function sectionHeight(sec: LedgerSection): number {
  return 12 + sec.rows.length * ROW_H;
}

/** Draw one section at (x, y) of width w, rows up to `upto` (typing reveal). */
function drawSection(
  b: PixelBuffer,
  sec: LedgerSection,
  x: number,
  y: number,
  w: number,
  upto: number,
): void {
  let title = sec.title;
  if (measureText(FONTS.smallBold, title).w > w) title = title.split(' ').slice(-1)[0] ?? title;
  drawText(b, FONTS.smallBold, title, x, y, 'crim1');
  hline(b, x, y + 9, w, 'crim1');
  let ry = y + 12;
  for (let k = 0; k < sec.rows.length && k < upto; k++) {
    const r = sec.rows[k]!;
    let tx = x;
    if (r.icon) {
      stamp(b, r.icon, x + Math.floor((10 - r.icon.w) / 2), ry + 9 - r.icon.h);
      tx = x + 12;
    }
    const font = r.strong ? FONTS.smallBold : FONTS.small;
    const vm = measureText(FONTS.smallBold, r.value);
    const maxLabel = w - (tx - x) - vm.w - 4;
    let label = r.label;
    while (label.length > 3 && measureText(font, label).w > maxLabel)
      label = `${label.slice(0, -2)}…`.replace('……', '…');
    if (measureText(font, label).w > maxLabel) label = label.slice(0, 3);
    drawText(b, font, label.replace('…', '.'), tx, ry + 2, r.strong ? 'ink' : 'gray1');
    drawText(b, FONTS.smallBold, r.value, x + w - vm.w, ry + 2, 'ink');
    const lw = measureText(font, label).w;
    for (let dx = tx + lw + 2; dx < x + w - vm.w - 2; dx += 2) px(b, dx, ry + 8, 'stone2');
    ry += ROW_H;
  }
}

/** Big typewriter text (mono ×scale) with an ink drop shadow. */
export function bigTypewriter(text: string, scale: number, colour = 'stone5'): PixelBuffer {
  const t = textMask(FONTS.mono, text, scale, 0);
  const b = buf(t.m.w + scale, t.m.h + scale);
  for (let y = 0; y < t.m.h; y++)
    for (let x = 0; x < t.m.w; x++)
      if (t.m.m[y * t.m.w + x]) rect(b, x + scale, y + scale, 1, 1, 'ink');
  for (let y = 0; y < t.m.h; y++)
    for (let x = 0; x < t.m.w; x++) if (t.m.m[y * t.m.w + x]) px(b, x, y, colour);
  return b;
}

/* ── Screen ──────────────────────────────────────────────────────────────────────── */

type Phase = 'paper' | 'hold' | 'ledger' | 'line' | 'done';

export class EndScreen implements Screen {
  readonly root = new Container({ label: 'end' });
  readonly modal = true;
  private readonly dim = backdrop(0.0);
  private readonly paper = new Sprite();
  private readonly ledger = new Sprite();
  private readonly line = new Sprite();
  private readonly buttons: Button[];
  private readonly sections: LedgerSection[];
  private paperBuf: PixelBuffer | null = null;
  private t = 0;
  private phase: Phase = 'paper';
  private phaseT = 0;
  private rowsShown = 0;
  private totalRows = 0;
  private lineChars = 0;
  private lineText: string;
  private readonly deck: string;
  private lineKey = '';
  private sideBySide = false;
  private l: HudLayout | null = null;
  private ledgerW = 210;
  private ledgerKey = '';
  private landed = false;
  private stamp: PixelBuffer;
  private stampAt = { x: 0, y: 0 };
  private scrollY = 0;
  private ledgerH = 0;

  constructor(
    private readonly app: UiApp,
    private readonly game: GameController,
    private readonly victory: boolean,
    private readonly newBest: boolean,
  ) {
    const s = game.world.stats;
    this.sections = ledgerSections(s, {
      protester: (p) => miniHead(protesterFigure(p), 10),
      unit: (u) => miniHead(unitPortrait(u), 10, 7),
    });
    this.totalRows = this.sections.reduce((n, x) => n + x.rows.length, 0);
    // Copy variants (M10): seeded by the run so a relayout keeps the same picks.
    const seed = Math.floor(game.world.tick + game.world.stats.time * 7);
    this.lineText = closingLine(victory, seed);
    const copy = CITY_COPY[game.world.map.city];
    this.deck = pickVariant(victory ? copy.victoryDecks : copy.defeatDecks, seed >> 1);
    this.stamp = victory
      ? rubberStamp('APPROVED', 'green2', { tilt: -0.1 })
      : rubberStamp('DENIED', 'crim1', { tilt: -0.1 });
    const mk = (label: string, fn: () => void): Button =>
      new Button(stampFaces(label, 70), { onTap: fn, pad: 2 });
    this.buttons = [
      mk('PLAY AGAIN', () => void app.restart()),
      mk('OTHER CITY', () => void app.otherCity()),
      mk('TITLE', () => void app.quitToTitle()),
    ];
    makeInteractive(this.dim, { tap: () => this.skip(), drag: (_dx, dy) => this.scroll(dy) });
    makeInteractive(this.paper, { tap: () => this.skip() });
    makeInteractive(this.ledger, {
      tap: () => this.skip(),
      drag: (_dx, dy) => this.scroll(dy),
      wheel: (dy) => this.scroll(-dy / 4),
    });
    this.root.addChild(this.dim, this.paper, this.ledger, this.line, ...this.buttons);
    for (const b of this.buttons) b.visible = false;
    this.ledger.visible = false;
    app.sfx('stamp');
  }

  private scroll(dy: number): boolean {
    const l = this.l;
    if (!l) return false;
    const view = l.H - l.safe.bottom - 34;
    const over = this.ledger.y + this.ledgerH - view;
    if (over <= 0 && this.scrollY === 0) return false;
    this.scrollY = Math.max(-Math.max(0, over - this.scrollY), Math.min(0, this.scrollY + dy));
    return true;
  }

  private skip(): void {
    switch (this.phase) {
      case 'paper':
      case 'hold':
        this.go('ledger');
        break;
      case 'ledger':
        this.rowsShown = this.totalRows;
        this.go('line');
        break;
      case 'line':
        this.lineChars = this.lineText.length;
        break;
      default:
    }
  }

  private go(p: Phase): void {
    this.phase = p;
    this.phaseT = 0;
    if (p === 'ledger') this.ledger.visible = true;
  }

  private buildPaper(l: HudLayout): void {
    const city = this.game.world.map.city;
    const w = this.sideBySide ? Math.min(280, l.W - this.ledgerW - 36) : Math.min(300, l.W - 12);
    const headline = this.victory ? UI_TEXT.victoryHeadline : UI_TEXT.defeatHeadline;
    const deck = this.deck;
    const st = this.stamp;
    const h = paperHeight(city, headline, deck, w, l.H - l.safe.top - l.safe.bottom - 16, st);
    // The stamp's corner is kept clear (frontPageLayout): it lands on blank newsprint.
    const page = frontPage(city, headline, deck, w, h, undefined, st);
    const lay = frontPageLayout(city, headline, deck, w, h, st);
    const box = frontPageBox(city, headline, deck, w, h, st);
    // Live photo of the Capitol.
    const cap = this.game.world.map.capitol;
    const c = tileToWorld(cap.i + cap.w / 2, cap.j + cap.d / 2);
    const snap =
      box.w > 4 && box.h > 4
        ? worldSnapshot(
            this.game,
            this.app.stage.app.renderer as Renderer,
            c.x,
            c.y - 24,
            box.w * 2,
            box.h * 2,
          )
        : null;
    if (snap) {
      const photo = newsprintPhoto(snap.pixels, snap.width, snap.height, box.w, box.h);
      stamp(page, photo, box.x, box.y);
      // Caption strip (wrapped to the photo; dropped when the photo is too small for it).
      const cap1 = this.victory ? 'Order, restored. Photo: Ministry.' : 'The scene this morning.';
      const cm = measureText(FONTS.small, cap1, box.w - 6);
      const ch = cm.h + 4;
      if (ch + 6 <= box.h) {
        const cy = box.y + box.h - ch;
        rect(page, box.x, cy, Math.min(box.w, cm.w + 6), ch, 'stone4');
        hline(page, box.x, cy - 1, Math.min(box.w, cm.w + 6), 'gray3');
        drawText(page, FONTS.small, cap1, box.x + 3, cy + 2, 'ink', { maxWidth: box.w - 6 });
      }
    }
    this.paperBuf = page;
    this.stampAt = { x: lay.stamp!.x, y: lay.stamp!.y };
    const old = this.paper.texture;
    this.paper.texture = ownTex(page, 'ui:paper');
    if (old && old.label === 'ui:paper') old.destroy(true);
    this.paper.anchor.set(0.5);
  }

  private buildLedger(l: HudLayout): void {
    const cols = this.ledgerCols(l);
    const colW = this.colW(l, cols);
    const gap = 10;
    let h: number;
    if (cols === 3) h = Math.max(...this.sections.map(sectionHeight));
    else if (cols === 2)
      h =
        Math.max(sectionHeight(this.sections[0]!), sectionHeight(this.sections[1]!)) +
        8 +
        sectionHeight(this.sections[2]!);
    else h = this.sections.reduce((n, s) => n + sectionHeight(s) + 8, -8);
    const w = cols * colW + (cols - 1) * gap + 24;
    this.ledgerW = w;
    const cityName = CITY_COPY[this.game.world.map.city].name.toUpperCase();
    const title = `LEDGER · ${cityName}`;
    const res = this.victory ? 'ORDER RESTORED' : 'REGIME FALLEN';
    const tm = measureText(FONTS.smallBold, title);
    const rm = measureText(FONTS.smallBold, res);
    // Result right of the title, or on its own line when both don't fit side by side.
    const oneLine = tm.w + 8 + rm.w <= w - 24;
    const head = oneLine ? 18 : 29;
    // NEW RECORD stamp: its own strip under the last row (never over a ledger line).
    const rec = this.newBest
      ? rubberStamp('NEW RECORD', 'navy2', { font: FONTS.smallBold, tilt: 0.08, seed: 4 })
      : null;
    const foot = rec ? rec.h + 4 : 0;
    const b = dossier(w, h + head + 14 + foot, `FILE: AT WHAT COST`);
    drawText(b, FONTS.smallBold, title, 12, 10 + 8, 'ink');
    drawText(
      b,
      FONTS.smallBold,
      res,
      oneLine ? w - 12 - rm.w : 12,
      oneLine ? 10 + 8 : 10 + 19,
      this.victory ? 'green2' : 'crim1',
    );
    let left = this.rowsShown;
    const take = (n: number): number => {
      const r = Math.max(0, Math.min(n, left));
      left -= n;
      return r;
    };
    const y0 = 10 + head + 6;
    if (cols === 3) {
      this.sections.forEach((s, k) =>
        drawSection(b, s, 12 + k * (colW + gap), y0, colW, take(s.rows.length)),
      );
    } else if (cols === 2) {
      const s0 = this.sections[0]!;
      const s1 = this.sections[1]!;
      const s2 = this.sections[2]!;
      drawSection(b, s0, 12, y0, colW, take(s0.rows.length));
      drawSection(b, s1, 12 + colW + gap, y0, colW, take(s1.rows.length));
      const y1 = y0 + Math.max(sectionHeight(s0), sectionHeight(s1)) + 8;
      drawSection(b, s2, 12, y1, colW * 2 + gap, take(s2.rows.length));
    } else {
      let y = y0;
      for (const s of this.sections) {
        drawSection(b, s, 12, y, colW, take(s.rows.length));
        y += sectionHeight(s) + 8;
      }
    }
    if (rec && this.rowsShown >= this.totalRows) stamp(b, rec, w - rec.w - 14, y0 + h + 2);
    this.ledgerH = b.h;
    const old = this.ledger.texture;
    this.ledger.texture = ownTex(b, 'ui:ledger');
    if (old && old.label === 'ui:ledger') old.destroy(true);
  }

  private colW(l: HudLayout, cols: number): number {
    if (cols === 3) return l.W >= 430 ? 120 : 104;
    if (cols === 2) return l.W >= 300 ? 120 : 104;
    return Math.min(200, l.W - 32);
  }

  private ledgerCols(l: HudLayout): number {
    if (l.W >= 360 && l.H < 300) return 3;
    if (l.W >= 250) return 2;
    return 1;
  }

  layout(l: HudLayout): void {
    this.l = l;
    fitBackdrop(this.dim, l);
    const cols = this.ledgerCols(l);
    const cw = this.colW(l, cols);
    const lw = cols * cw + (cols - 1) * 10 + 24;
    this.sideBySide = l.W >= 250 + lw + 30 && l.H >= 280;
    this.ledgerW = lw;
    this.buildPaper(l);
    this.ledgerKey = '';
  }

  private placeButtons(l: HudLayout, alpha: number): void {
    const total = this.buttons.reduce((n, b) => n + b.w, 0) + (this.buttons.length - 1) * 6;
    let x = Math.floor((l.W - total) / 2);
    const y = l.H - l.safe.bottom - this.buttons[0]!.h - 4;
    for (const b of this.buttons) {
      b.visible = alpha > 0;
      b.alpha = alpha;
      b.position.set(x, y);
      x += b.w + 6;
    }
  }

  update(dt: number): void {
    const l = this.l;
    if (!l) return;
    this.t += dt;
    this.phaseT += dt;
    this.dim.alpha = Math.min(0.72, this.t * 1.2);
    // Paper: spin in, land with a stamp, hold.
    const pw = this.paper.texture.width;
    const ph = this.paper.texture.height;
    const paperHomeX = this.sideBySide
      ? l.safe.left + 10 + Math.floor(pw / 2)
      : Math.floor(l.W / 2);
    const paperHomeY = Math.floor(l.H / 2) - (this.sideBySide ? 10 : 0);
    if (this.phase === 'paper') {
      const p = prog(this.phaseT, 0, 0.9);
      const e = ease.outCubic(p);
      this.paper.rotation = (1 - e) * Math.PI * 4;
      this.paper.scale.set(0.08 + 0.92 * e);
      this.paper.position.set(paperHomeX, paperHomeY);
      if (p >= 1) {
        this.paper.rotation = 0;
        this.paper.scale.set(1);
        this.go('hold');
      }
    } else if (this.phase === 'hold') {
      if (!this.landed) {
        this.landed = true;
        this.app.sfx('stamp');
        if (this.paperBuf) {
          stamp(this.paperBuf, this.stamp, this.stampAt.x, this.stampAt.y);
          const old = this.paper.texture;
          this.paper.texture = ownTex(this.paperBuf, 'ui:paper');
          if (old.label === 'ui:paper') old.destroy(true);
        }
      }
      this.paper.position.set(
        paperHomeX,
        paperHomeY + Math.round(stampDrop(this.phaseT / 0.25) / 3),
      );
      if (this.phaseT > (this.sideBySide ? 1.6 : 3.2)) this.go('ledger');
    }
    // Ledger.
    if (this.phase === 'ledger') {
      const want = Math.min(this.totalRows, Math.floor((this.phaseT - 0.35) / 0.11));
      if (want > this.rowsShown) {
        this.rowsShown = want;
        this.app.sfx('typeTick');
      }
      if (this.rowsShown >= this.totalRows && this.phaseT > 0.5) {
        this.app.sfx('typeBell');
        this.go('line');
      }
    }
    const lk = `${this.rowsShown}:${l.W}x${l.H}`;
    if (this.ledger.visible && lk !== this.ledgerKey) {
      this.ledgerKey = lk;
      this.buildLedger(l);
    }
    // Positions once the ledger is in.
    const lineH = this.lineH(l);
    if (this.ledger.visible) {
      const lp = ease.outCubic(prog(this.phase === 'ledger' ? this.phaseT : 9, 0, 0.45));
      const lwid = this.ledger.texture.width;
      const lhei = this.ledger.texture.height;
      let lx: number;
      let ly: number;
      if (this.sideBySide) {
        lx = l.W - l.safe.right - lwid - 10;
        ly = Math.max(l.safe.top + 4 + lineH, Math.floor((l.H - lhei) / 2) - 6);
        this.paper.position.set(paperHomeX, paperHomeY);
      } else {
        lx = Math.floor((l.W - lwid) / 2);
        ly = l.safe.top + 4 + lineH;
        // Paper leaves upward.
        this.paper.position.set(paperHomeX, Math.round(paperHomeY - (ph + l.H) * lp));
        this.paper.visible = lp < 1;
      }
      const from = l.H + 10;
      this.ledger.position.set(lx, Math.round(from + (ly - from) * lp) + this.scrollY);
    }
    // Closing line.
    if (this.phase === 'line' || this.phase === 'done') {
      if (this.phase === 'line') {
        const before = this.lineChars;
        if (this.phaseT > 0.7)
          this.lineChars = Math.min(this.lineText.length, this.lineChars + dt * 13);
        if (
          Math.floor(this.lineChars) > Math.floor(before) &&
          this.lineText[Math.floor(before)] !== ' '
        )
          this.app.sfx('typeTick');
        if (this.lineChars >= this.lineText.length) {
          this.app.sfx('typeBell');
          this.go('done');
        }
      }
      const shown = this.lineText.slice(0, Math.floor(this.lineChars));
      const key = `${shown}|${l.W}`;
      if (key !== this.lineKey) {
        this.lineKey = key;
        const scale = this.lineScale(l);
        const lines = this.wrapLine(l, scale);
        let acc = 0;
        const parts = lines.map((ln) => {
          const s = shown.slice(acc, acc + ln.length);
          acc += ln.length + 1;
          return s;
        });
        const bufs = parts.map((p) => bigTypewriter(p || ' ', scale));
        const W = Math.max(...bufs.map((b) => b.w), 1);
        const lh = FONTS.mono.lineHeight * scale;
        const out = buf(W, lh * bufs.length + scale);
        bufs.forEach((b, k) => stamp(out, b, 0, k * lh));
        const old = this.line.texture;
        this.line.texture = ownTex(out, 'ui:line');
        if (old && old.label === 'ui:line') old.destroy(true);
        // Centre on the full line width (so typing doesn't jitter).
        const fullW = Math.max(...lines.map((ln) => measureText(FONTS.mono, ln).w * scale));
        this.line.position.set(
          Math.floor((l.W - fullW) / 2),
          this.sideBySide ? l.safe.top + 8 : l.safe.top + 6,
        );
      }
    }
    if (this.phase === 'done') this.placeButtons(l, Math.min(1, this.phaseT * 2));
    else this.placeButtons(l, 0);
  }

  private lineScale(l: HudLayout): number {
    const w1 = measureText(FONTS.mono, this.lineText).w;
    return w1 * 2 <= l.W - 16 ? 2 : 1;
  }

  private wrapLine(l: HudLayout, scale: number): string[] {
    const full = this.lineText;
    if (measureText(FONTS.mono, full).w * scale <= l.W - 16) return [full];
    const k = full.indexOf('. ');
    return k > 0 ? [full.slice(0, k + 1), full.slice(k + 2)] : [full];
  }

  private lineH(l: HudLayout): number {
    const s = this.lineScale(l);
    return this.wrapLine(l, s).length * FONTS.mono.lineHeight * s + 6;
  }

  key(code: string): boolean {
    if (code === 'Escape' || code === 'Enter' || code === 'Space') {
      if (this.phase !== 'done') this.skip();
      else if (code === 'Enter') void this.app.restart();
      return true;
    }
    return false;
  }

  destroy(): void {
    for (const s of [this.paper, this.ledger, this.line])
      if (s.texture.label?.startsWith('ui:')) s.texture.destroy(true);
    destroyOwned(this.root);
  }
}
