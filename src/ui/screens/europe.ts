/**
 * The campaign map (E1): PLAY opens the Ministry's war-room map of Europe — a worn sheet
 * taped to a desk — with a push pin on every campaign city. Tapping a pin (or its tag) opens
 * that city's dossier card beside the map: built cities get the postcard with records and
 * DEPLOY (exactly the old city select's run start); cities still being built show "UNDER
 * CONSTRUCTION". Budapest is Level 1 (the tutorial) and is selected on a first visit.
 *
 * The map lives at its own integer zoom (device px per map px, like the world camera): drag to
 * pan, pinch / wheel / + − to zoom (fractional while the fingers move, settling on an integer).
 * Pins, tags and the card are UI-scale; tags are laid out per zoom so none covers another tag,
 * a pin or (by hiding it) a country label. The sheet, waves and labels are built once and
 * cached like the other UI art; the attract game underneath is paused and hidden.
 */
import { Container, Sprite, Texture, TilingSprite } from 'pixi.js';
import { buf, line, stamp } from '../../art/fx/draw';
import type { PixelBuffer } from '../../art/lib/pixels';
import {
  MAP_OX,
  MAP_OY,
  PIN_ANCHOR,
  SHEET_H,
  SHEET_OVER,
  SHEET_W,
  TAG_STYLES,
  WAVE_FRAMES,
  deskTile,
  europeSheet,
  europeWaves,
  mapLabels,
  pinSprite,
  project,
  pulseFrames,
  tagSize,
  tagSprite,
  type MapLabel,
} from '../../art/uikit/europe';
import { panel } from '../../art/uikit/panels';
import { FONTS, drawText, measureText } from '../../art/uikit/text';
import type { CityId } from '../../maps';
import { CAMPAIGN, FIRST_CITY, isBuilt, levelRibbon, type CampaignCity } from '../campaign';
import { Button, stampFaces } from '../core/button';
import { overlaps, type Box } from '../core/boxes';
import { makeInteractive } from '../core/node';
import { destroyOwned, ownTex, uiTex } from '../core/tex';
import type { HudLayout } from '../layout';
import { browserStorage, readJson, writeJson } from '../storage';
import type { UiApp } from '../app';
import { cityPicture, loadCityPictures, postcard } from './citySelect';
import { constructionCard, ribbonBadge } from './europeCard';
import {
  PIN_HEAD,
  layoutTags,
  nearestOn,
  screenPlan,
  zoomPlan,
  type ScreenPlan,
  type TagOut,
  type ZoomPlan,
} from './europeLayout';
import type { Screen } from './screen';

const SEEN_KEY = 'riot.europe.v1';
/** Touch target radius around a pin tip (CSS px): 44 px targets. */
const PIN_TOUCH_CSS = 22;

/** Map px (sheet coordinates, pixel centre) of every campaign city's pin tip. */
export function pinPoints(): Map<CityId, { x: number; y: number }> {
  return new Map(
    CAMPAIGN.map((c) => {
      const p = project(c.lon, c.lat);
      return [c.id, { x: MAP_OX + Math.floor(p.x), y: MAP_OY + Math.floor(p.y) }];
    }),
  );
}

/** Sheet-px box the default zoom frames: every pin plus room for tags. */
export function coreBox(): Box {
  const pts = [...pinPoints().values()];
  const x0 = Math.min(...pts.map((p) => p.x)) - 34;
  const x1 = Math.max(...pts.map((p) => p.x)) + 34;
  const y0 = Math.min(...pts.map((p) => p.y)) - 26;
  const y1 = Math.max(...pts.map((p) => p.y)) + 20;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export type TagStyleName = 'built' | 'unbuilt' | 'selected';

/** Tag size for a city (its ribbon included). */
export function cityTagSize(c: CampaignCity): { w: number; h: number } {
  return tagSize(c.name, levelRibbon(c), !isBuilt(c.id));
}

/**
 * Tag layout at zoom `z` (device px per map px) and UI scale `k`, in "sheet UI px" (the sheet's
 * top-left at 0,0). Ranks: the selected city first, Level 1 next, then built cities.
 */
export function cityTags(z: number, k: number, selected: CityId, prefer?: Box): TagOut[] {
  const pts = pinPoints();
  const s = z / k;
  return layoutTags(
    CAMPAIGN.map((c) => {
      const p = pts.get(c.id)!;
      const sz = cityTagSize(c);
      return {
        id: c.id,
        x: Math.round((p.x + 0.5) * s),
        y: Math.round((p.y + 0.5) * s),
        w: sz.w,
        h: sz.h,
        rank: c.id === selected ? 0 : c.level === 1 ? 1 : isBuilt(c.id) ? 2 : 3,
      };
    }),
    { x: 0, y: 0, w: Math.floor(SHEET_W * s), h: Math.floor(SHEET_H * s) },
    [],
    prefer,
  );
}

/** Country / sea labels left visible at a zoom: none may sit under a pin or a tag. */
export function visibleLabels(tags: readonly TagOut[], z: number, k: number): Set<string> {
  const s = z / k;
  const blockers = tags.flatMap((t) => (t.tag ? [t.pin, t.tag] : [t.pin]));
  const out = new Set<string>();
  for (const l of mapLabels()) {
    const box = {
      x: Math.floor((MAP_OX + l.x) * s),
      y: Math.floor((MAP_OY + l.y) * s),
      w: Math.ceil(l.buf.w * s) + 1,
      h: Math.ceil(l.buf.h * s) + 1,
    };
    if (!blockers.some((b) => overlaps(box, b, 1))) out.add(l.id);
  }
  return out;
}

/** Header plaque: "MINISTRY OF THE INTERIOR" over "CONTINENTAL OPERATIONS" on brass. */
export function headerPlaque(maxW: number, lines: 1 | 2): PixelBuffer {
  const big = 'CONTINENTAL OPERATIONS';
  const small = 'MINISTRY OF THE INTERIOR';
  const font = lines === 2 && measureText(FONTS.large, big).w + 20 <= maxW ? FONTS.large : FONTS.smallBold;
  const bw = measureText(font, big).w;
  const sw = measureText(FONTS.small, small).w;
  const w = Math.min(maxW, Math.max(bw, lines === 2 ? sw : 0) + 20);
  const h = lines === 2 ? font.capHeight + FONTS.small.capHeight + 17 : 26;
  const b = buf(w, h);
  stamp(b, panel('brass', w, h), 0, 0);
  if (lines === 2) {
    drawText(b, FONTS.small, small, Math.floor(w / 2), 6, 'earth1', { align: 'center' });
    drawText(b, font, big, Math.floor(w / 2), 6 + FONTS.small.capHeight + 4, 'earth0', {
      align: 'center',
      shadow: 'ochre4',
    });
  } else {
    drawText(b, font, big, Math.floor(w / 2), Math.floor((h - font.capHeight) / 2) - 1, 'earth0', {
      align: 'center',
      shadow: 'ochre4',
    });
  }
  return b;
}

/** Tag (+ leader thread) art, with the pin tip at `origin` inside the buffer. */
function tagWithThread(
  c: CampaignCity,
  style: TagStyleName,
  t: TagOut,
  tipX: number,
  tipY: number,
): { buf: PixelBuffer; origin: { x: number; y: number } } {
  const tag = tagSprite(c.name, TAG_STYLES[style], levelRibbon(c), !isBuilt(c.id));
  const r = t.tag!;
  const rx = r.x - tipX;
  const ry = r.y - tipY;
  const hx = PIN_HEAD.x;
  const hy = PIN_HEAD.y;
  const x0 = Math.min(rx, hx);
  const y0 = Math.min(ry, hy);
  const x1 = Math.max(rx + r.w, hx + 1);
  const y1 = Math.max(ry + r.h, hy + 1);
  const b = buf(x1 - x0, y1 - y0);
  if (t.leader) {
    const e = nearestOn({ x: rx, y: ry, w: r.w, h: r.h }, hx, hy);
    line(b, hx - x0, hy - y0, e.x - x0, e.y - y0, 'crim1');
  }
  stamp(b, tag, rx - x0, ry - y0);
  return { buf: b, origin: { x: -x0, y: -y0 } };
}

interface PinView {
  c: CampaignCity;
  /** Sheet px of the pin tip. */
  sx: number;
  sy: number;
  pin: Sprite;
  tag: Sprite;
  tagOrigin: { x: number; y: number };
  out: TagOut | null;
  /** Tag box relative to the pin tip (UI px), null when hidden. */
  tagRel: Box | null;
}

export class EuropeScreen implements Screen {
  readonly root = new Container({ label: 'europe' });
  readonly modal = true;
  private readonly desk: TilingSprite;
  private readonly mapC = new Container({ label: 'europe-map' });
  private readonly shadow = new Sprite(Texture.WHITE);
  private readonly sheet: Sprite;
  private readonly waves: Sprite;
  private readonly labels: Array<{ l: MapLabel; s: Sprite }> = [];
  private readonly pinsC = new Container({ label: 'europe-pins' });
  private readonly pulse = new Sprite();
  private readonly pins = new Map<CityId, PinView>();
  private readonly surface = new Sprite(Texture.EMPTY);
  private readonly header = new Sprite();
  private readonly back: Button;
  private readonly card = new Sprite();
  private readonly deploy: Button;
  private readonly waveTex: Texture[];
  private readonly pulseTex: Texture[];
  private readonly tagTex = new Map<string, { t: Texture; origin: { x: number; y: number } }>();
  private l: HudLayout | null = null;
  private plan: ScreenPlan | null = null;
  private zp: ZoomPlan = { min: 1, max: 4, def: 2 };
  /** Current zoom (fractional while easing / pinching) and its integer target. */
  private z = 2;
  private zTarget = 2;
  /** Device px the zoom eases around. */
  private zAnchor = { x: 0, y: 0 };
  /** Device px of the sheet's top-left. */
  private off = { x: 0, y: 0 };
  private laidZ = -1;
  private selected: CityId;
  private hover: CityId | null = null;
  private t = 0;
  private alive = true;
  private readonly reduced: boolean;
  private readonly touches = new Map<number, { x: number; y: number }>();
  private pinch: { d0: number; z0: number; mx: number; my: number } | null = null;
  private mouse = { x: -1, y: -1 };
  private readonly disposers: Array<() => void> = [];
  private readonly hidWorld: boolean;

  constructor(private readonly app: UiApp) {
    const store = browserStorage();
    const seen = readJson(store, SEEN_KEY) as { seen?: boolean } | null;
    const last = app.settings.lastCity;
    this.selected = !seen?.seen ? FIRST_CITY : last && CAMPAIGN.some((c) => c.id === last) ? last : FIRST_CITY;
    writeJson(store, SEEN_KEY, { seen: true });
    this.reduced =
      !app.settings.shake ||
      (typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

    this.desk = new TilingSprite({ texture: uiTex('europe:desk', deskTile), width: 1, height: 1 });
    this.desk.texture.source.addressMode = 'repeat';
    this.shadow.tint = 0x1a1424;
    this.shadow.alpha = 0.45;
    this.shadow.position.set(SHEET_OVER + 3, SHEET_OVER + 3);
    this.shadow.width = SHEET_W - SHEET_OVER * 2;
    this.shadow.height = SHEET_H - SHEET_OVER * 2;
    this.sheet = new Sprite(uiTex('europe:sheet', europeSheet));
    this.waveTex = europeWaves().map((b, i) => uiTex(`europe:waves:${i}`, () => b));
    this.waves = new Sprite(this.waveTex[0]!);
    this.mapC.addChild(this.shadow, this.sheet, this.waves);
    for (const l of mapLabels()) {
      const s = new Sprite(uiTex(`europe:label:${l.id}`, () => l.buf));
      s.position.set(MAP_OX + l.x, MAP_OY + l.y);
      this.labels.push({ l, s });
      this.mapC.addChild(s);
    }
    this.pulseTex = pulseFrames().map((b, i) => uiTex(`europe:pulse:${i}`, () => b));
    this.pulse.texture = this.pulseTex[0]!;
    this.pinsC.addChild(this.pulse);
    const pts = pinPoints();
    for (const c of CAMPAIGN) {
      const p = pts.get(c.id)!;
      const pin = new Sprite();
      const tag = new Sprite();
      this.pinsC.addChild(tag);
      this.pins.set(c.id, { c, sx: p.x + 0.5, sy: p.y + 0.5, pin, tag, tagOrigin: { x: 0, y: 0 }, out: null, tagRel: null });
    }
    // Pins above every tag (a thread never crosses a pin head).
    for (const v of this.pins.values()) this.pinsC.addChild(v.pin);

    makeInteractive(this.surface, {
      hit: () => ({ x: 0, y: 0, w: this.l?.W ?? 1, h: this.l?.H ?? 1 }),
      cursor: 'grab',
      tap: (e) => this.tapAt(e.x, e.y),
      drag: (dx, dy) => {
        if (this.pinch) return true;
        this.panBy(dx * this.app.k, dy * this.app.k);
        return true;
      },
      // Tags re-flow to the part of the map now on screen.
      dragEnd: () => (this.laidZ = -1),
      wheel: (dy) => this.zoomStep(dy < 0 ? 1 : -1, this.mouse.x, this.mouse.y),
    });
    this.back = new Button(stampFaces('BACK'), { onTap: () => this.goBack(), pad: 3 });
    this.deploy = new Button(stampFaces('DEPLOY'), { onTap: () => this.deploySelected(), pad: 3 });
    makeInteractive(this.card, { blockOnly: true });
    this.root.addChild(this.desk, this.mapC, this.pinsC, this.surface, this.header, this.back, this.card, this.deploy);

    // The live city underneath is invisible behind the desk: pause and hide it.
    const g = app.game;
    this.hidWorld = !!g && !g.destroyed;
    if (g && this.hidWorld) {
      g.view.layers.world.visible = false;
      g.setPaused(true);
    }
    this.bindPointers();
    void loadCityPictures(app).then(() => {
      if (this.alive && this.l) this.refreshCard();
    });
  }

  /* ── Input ──────────────────────────────────────────────────────────────────────── */

  private toDevice(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const cv = this.app.stage.canvas;
    const r = cv.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (r.width ? cv.width / r.width : 1),
      y: (e.clientY - r.top) * (r.height ? cv.height / r.height : 1),
    };
  }

  /** Pinch tracking (two fingers on the map) and the mouse position for wheel zoom. */
  private bindPointers(): void {
    const host = this.app.host;
    const on = (type: string, fn: (e: PointerEvent) => void): void => {
      const l = fn as unknown as EventListener;
      host.addEventListener(type, l, { capture: true });
      this.disposers.push(() => host.removeEventListener(type, l, { capture: true }));
    };
    on('pointerdown', (e) => {
      const d = this.toDevice(e);
      if (this.app.input.hit(d.x, d.y)?.node !== this.surface) return;
      this.touches.set(e.pointerId, d);
      if (this.touches.size === 2) {
        const [a, b] = [...this.touches.values()] as [{ x: number; y: number }, { x: number; y: number }];
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        this.pinch = {
          d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
          z0: this.z,
          mx: (mx - this.off.x) / this.z,
          my: (my - this.off.y) / this.z,
        };
      }
    });
    on('pointermove', (e) => {
      const d = this.toDevice(e);
      if (e.pointerType === 'mouse') {
        this.mouse = d;
        this.updateHover(d);
      }
      if (!this.touches.has(e.pointerId)) return;
      this.touches.set(e.pointerId, d);
      const p = this.pinch;
      if (!p || this.touches.size < 2) return;
      const [a, b] = [...this.touches.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const z = Math.max(this.zp.min - 0.4, Math.min(this.zp.max + 0.4, (p.z0 * dist) / p.d0));
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      this.z = this.zTarget = z;
      this.off.x = mx - p.mx * z;
      this.off.y = my - p.my * z;
      this.zAnchor = { x: mx, y: my };
      this.clampOffset();
    });
    const up = (e: PointerEvent): void => {
      if (!this.touches.delete(e.pointerId)) return;
      if (this.pinch && this.touches.size < 2) {
        this.pinch = null;
        // Settle on the nearest integer zoom around the fingers.
        this.zTarget = Math.max(this.zp.min, Math.min(this.zp.max, Math.round(this.z)));
      }
    };
    on('pointerup', up);
    on('pointercancel', up);
  }

  private cityAt(uiX: number, uiY: number): CityId | null {
    const k = this.app.k;
    const dpr = this.app.stage.size.dpr || 1;
    const r = (PIN_TOUCH_CSS * dpr) / k;
    let best: CityId | null = null;
    let bestD = Infinity;
    for (const [id, v] of this.pins) {
      const tip = this.tipUi(v);
      const hx = tip.x + PIN_HEAD.x;
      const hy = tip.y + PIN_HEAD.y + 3;
      const d = Math.hypot(uiX - hx, uiY - hy);
      if (d <= r && d < bestD) {
        bestD = d;
        best = id;
      }
    }
    if (best) return best;
    for (const [id, v] of this.pins) {
      const t = v.tagRel;
      if (!t || !v.tag.visible) continue;
      const tip = this.tipUi(v);
      const x = tip.x + t.x;
      const y = tip.y + t.y;
      if (uiX >= x - 2 && uiY >= y - 2 && uiX < x + t.w + 2 && uiY < y + t.h + 2) return id;
    }
    return null;
  }

  private updateHover(d: { x: number; y: number }): void {
    const k = this.app.k;
    const over = this.app.input.hit(d.x, d.y)?.node === this.surface;
    const id = over ? this.cityAt(d.x / k, d.y / k) : null;
    if (id !== this.hover) {
      this.hover = id;
      this.refreshPins();
    }
    if (over) this.app.host.style.cursor = id ? 'pointer' : 'grab';
  }

  private tapAt(x: number, y: number): void {
    const id = this.cityAt(x, y);
    if (id) this.select(id);
  }

  select(id: CityId): void {
    if (id === this.selected) return;
    this.selected = id;
    this.app.sfx('click');
    this.laidZ = -1;
    this.refreshCard();
    this.ensureVisible(id);
  }

  private deploySelected(): void {
    if (!isBuilt(this.selected)) return;
    void this.app.startRun(this.selected);
  }

  private goBack(): void {
    this.app.pop(this);
    this.app.backToTitleMenu();
  }

  /* ── Camera ─────────────────────────────────────────────────────────────────────── */

  private panBy(dx: number, dy: number): void {
    this.off.x += dx;
    this.off.y += dy;
    this.clampOffset();
  }

  zoomStep(dir: 1 | -1, devX: number, devY: number): void {
    const plan = this.plan;
    if (!plan) return;
    const k = this.app.k;
    const cx = devX >= 0 ? devX : (plan.free.x + plan.free.w / 2) * k;
    const cy = devY >= 0 ? devY : (plan.free.y + plan.free.h / 2) * k;
    this.zTarget = Math.max(this.zp.min, Math.min(this.zp.max, Math.round(this.zTarget) + dir));
    this.zAnchor = { x: cx, y: cy };
  }

  /** Keep the sheet over the free area (a little desk may show at its edges). */
  private clampOffset(): void {
    const plan = this.plan;
    if (!plan) return;
    const k = this.app.k;
    const fx = plan.free.x * k;
    const fy = plan.free.y * k;
    const fw = plan.free.w * k;
    const fh = plan.free.h * k;
    const sw = SHEET_W * this.z;
    const sh = SHEET_H * this.z;
    const pad = 16 * k;
    const axis = (o: number, f0: number, fl: number, s: number): number =>
      s + pad * 2 <= fl
        ? Math.max(f0, Math.min(f0 + fl - s, o))
        : Math.max(f0 + fl - s - pad, Math.min(f0 + pad, o));
    this.off.x = axis(this.off.x, fx, fw, sw);
    this.off.y = axis(this.off.y, fy, fh, sh);
  }

  /** Centre a sheet-px box in the free area. */
  private centreOn(x: number, y: number): void {
    const plan = this.plan!;
    const k = this.app.k;
    this.off.x = (plan.free.x + plan.free.w / 2) * k - x * this.z;
    this.off.y = (plan.free.y + plan.free.h / 2) * k - y * this.z;
    this.clampOffset();
  }

  /** Pan just enough that a city's pin is inside the free area. */
  private ensureVisible(id: CityId): void {
    const v = this.pins.get(id);
    const plan = this.plan;
    if (!v || !plan) return;
    const k = this.app.k;
    const m = 30 * k;
    const x = this.off.x + v.sx * this.z;
    const y = this.off.y + v.sy * this.z;
    const fx0 = plan.free.x * k + m;
    const fx1 = (plan.free.x + plan.free.w) * k - m;
    const fy0 = plan.free.y * k + m;
    const fy1 = (plan.free.y + plan.free.h) * k - m;
    if (x < fx0) this.off.x += fx0 - x;
    if (x > fx1) this.off.x -= x - fx1;
    if (y < fy0) this.off.y += fy0 - y;
    if (y > fy1) this.off.y -= y - fy1;
    this.clampOffset();
  }

  /* ── Layout ─────────────────────────────────────────────────────────────────────── */

  layout(l: HudLayout): void {
    const first = !this.l;
    const prev = this.plan;
    this.l = l;
    const k = this.app.k;
    const plan = screenPlan(l.W, l.H, l.safe);
    this.plan = plan;
    const core = coreBox();
    this.zp = zoomPlan(
      { w: l.W * k, h: l.H * k },
      { w: plan.free.w * k, h: plan.free.h * k },
      { w: SHEET_W, h: SHEET_H },
      core,
    );
    this.desk.width = l.W;
    this.desk.height = l.H;
    // Header + BACK.
    const plaque = headerPlaque(plan.header.w, plan.headerLines);
    const old = this.header.texture;
    this.header.texture = ownTex(plaque, 'ui:europe-header');
    if (old && old.label === 'ui:europe-header') old.destroy(true);
    this.header.position.set(plan.header.x + Math.floor((plan.header.w - plaque.w) / 2), plan.header.y);
    this.back.position.set(plan.back.x, plan.back.y);
    if (first || !prev) {
      this.z = this.zTarget = this.zp.def;
      this.centreOn(core.x + core.w / 2, core.y + core.h / 2);
    } else {
      // Keep the zoom and the centre of the free area across a resize / rotation.
      const cx = ((prev.free.x + prev.free.w / 2) * k - this.off.x) / this.z;
      const cy = ((prev.free.y + prev.free.h / 2) * k - this.off.y) / this.z;
      this.z = this.zTarget = Math.max(this.zp.min, Math.min(this.zp.max, Math.round(this.zTarget)));
      this.centreOn(cx, cy);
    }
    this.laidZ = -1;
    this.refreshCard();
    this.apply();
  }

  /** Dossier card for the selected city (+ DEPLOY for built cities). */
  private refreshCard(): void {
    const plan = this.plan;
    if (!plan) return;
    const c = CAMPAIGN.find((x) => x.id === this.selected)!;
    const w = plan.card.w;
    const h = plan.card.h - 10;
    let b: PixelBuffer;
    if (isBuilt(c.id)) {
      const go = this.deploy;
      const btn = plan.horizontal
        ? { x: w - go.w - 8, y: h + 6 - go.h, w: go.w, h: go.h }
        : { x: Math.floor((w - go.w) / 2), y: h + 4 - go.h, w: go.w, h: go.h };
      const card = postcard(c.id, this.app.records[c.id], w, h, cityPicture(c.id), plan.horizontal, btn);
      b = card.buf;
      const ribbon = levelRibbon(c);
      const photo = card.boxes.photo;
      if (ribbon && photo) {
        const r = ribbonBadge(ribbon);
        stamp(b, r, photo.x + Math.floor((photo.w - r.w) / 2), photo.y - 3);
      }
      this.deploy.visible = true;
      this.deploy.position.set(plan.card.x + btn.x, plan.card.y + btn.y);
    } else {
      b = constructionCard(c, w, h, plan.horizontal).buf;
      this.deploy.visible = false;
    }
    const old = this.card.texture;
    this.card.texture = ownTex(b, 'ui:europe-card');
    if (old && old.label === 'ui:europe-card') old.destroy(true);
    this.card.position.set(plan.card.x, plan.card.y);
  }

  private tipUi(v: PinView): { x: number; y: number } {
    const k = this.app.k;
    return {
      x: Math.round(Math.round(this.off.x) + v.sx * this.z) / k,
      y: Math.round(Math.round(this.off.y) + v.sy * this.z) / k,
    };
  }

  private styleOf(id: CityId): TagStyleName {
    return id === this.selected || id === this.hover ? 'selected' : isBuilt(id) ? 'built' : 'unbuilt';
  }

  /** Re-run the tag layout for the current integer zoom; hide labels under tags. */
  private relayoutTags(): void {
    const k = this.app.k;
    const zr = Math.max(this.zp.min, Math.min(this.zp.max, Math.round(this.z)));
    this.laidZ = zr;
    // Prefer spots on screen beside the card (in sheet UI px at the current pan).
    const f = this.plan!.free;
    const prefer = {
      x: f.x + 4 - Math.round(this.off.x) / k,
      y: f.y + 4 - Math.round(this.off.y) / k,
      w: f.w - 8,
      h: f.h - 8,
    };
    const tags = cityTags(zr, k, this.selected, prefer);
    const vis = visibleLabels(tags, zr, k);
    for (const { l, s } of this.labels) s.visible = vis.has(l.id);
    const s = zr / k;
    for (const t of tags) {
      const v = this.pins.get(t.id as CityId)!;
      v.out = t;
      v.tag.visible = !!t.tag;
      // The layout's pin tips are the sheet tips at this zoom: keep the tag relative to it.
      const tipX = Math.round(v.sx * s);
      const tipY = Math.round(v.sy * s);
      v.tagRel = t.tag ? { x: t.tag.x - tipX, y: t.tag.y - tipY, w: t.tag.w, h: t.tag.h } : null;
    }
    this.refreshPins();
  }

  /** Pin / tag textures for the current selection and hover. */
  private refreshPins(): void {
    const s = this.laidZ / this.app.k;
    for (const [id, v] of this.pins) {
      const kind = isBuilt(id) ? 'built' : 'unbuilt';
      const lifted = id === this.selected || id === this.hover;
      v.pin.texture = uiTex(`europe:pin:${kind}:${lifted}`, () => pinSprite(kind, lifted));
      const t = v.out;
      if (!t?.tag) continue;
      const style = this.styleOf(id);
      const tipX = Math.round(v.sx * s);
      const tipY = Math.round(v.sy * s);
      const key = `${id}:${style}:${t.tag.x - tipX},${t.tag.y - tipY}:${t.leader}`;
      let e = this.tagTex.get(key);
      if (!e) {
        const art = tagWithThread(v.c, style, t, tipX, tipY);
        e = { t: ownTex(art.buf, 'ui:europe-tag'), origin: art.origin };
        this.tagTex.set(key, e);
      }
      v.tag.texture = e.t;
      v.tagOrigin = e.origin;
    }
  }

  /** Push camera state into the display tree (device-px snapped). */
  private apply(): void {
    const k = this.app.k;
    if (Math.round(this.z) !== this.laidZ || this.laidZ < 0) this.relayoutTags();
    const ox = Math.round(this.off.x);
    const oy = Math.round(this.off.y);
    this.mapC.scale.set(this.z / k);
    this.mapC.position.set(ox / k, oy / k);
    this.desk.tileScale.set(this.z / k);
    this.desk.tilePosition.set(ox / k, oy / k);
    const bob = this.reduced ? 0 : Math.floor(this.t * 2) % 2;
    for (const [id, v] of this.pins) {
      const tip = this.tipUi(v);
      const lift = id === this.selected ? bob : 0;
      v.pin.position.set(tip.x - PIN_ANCHOR.x, tip.y - PIN_ANCHOR.y - lift);
      v.tag.position.set(tip.x - v.tagOrigin.x, tip.y - v.tagOrigin.y);
      if (id === this.selected) {
        const f = this.reduced ? 2 : Math.floor(this.t * 5) % this.pulseTex.length;
        this.pulse.texture = this.pulseTex[f]!;
        this.pulse.position.set(tip.x - 11, tip.y - Math.floor(this.pulse.texture.height / 2));
      }
    }
    this.waves.texture = this.waveTex[this.reduced ? 0 : Math.floor(this.t * 1.5) % WAVE_FRAMES]!;
  }

  update(dt: number): void {
    this.t += dt;
    if (!this.pinch && Math.abs(this.zTarget - this.z) > 0.001) {
      // Ease the zoom around its anchor (~150 ms), then settle exactly on the integer.
      const a = this.zAnchor;
      const mx = (a.x - this.off.x) / this.z;
      const my = (a.y - this.off.y) / this.z;
      const nz = Math.abs(this.zTarget - this.z) < 0.02 ? this.zTarget : this.z + (this.zTarget - this.z) * Math.min(1, dt * 16);
      this.z = nz;
      this.off.x = a.x - mx * nz;
      this.off.y = a.y - my * nz;
      this.clampOffset();
    }
    this.apply();
  }

  key(code: string): boolean {
    switch (code) {
      case 'Escape':
        this.goBack();
        return true;
      case 'Enter':
      case 'Space':
        this.deploySelected();
        return true;
      case 'Equal':
      case 'NumpadAdd':
        this.zoomStep(1, -1, -1);
        return true;
      case 'Minus':
      case 'NumpadSubtract':
        this.zoomStep(-1, -1, -1);
        return true;
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        const s = 40 * this.app.k;
        this.panBy(
          code === 'ArrowLeft' ? s : code === 'ArrowRight' ? -s : 0,
          code === 'ArrowUp' ? s : code === 'ArrowDown' ? -s : 0,
        );
        this.laidZ = -1;
        return true;
      }
      case 'Tab': {
        const i = CAMPAIGN.findIndex((c) => c.id === this.selected);
        this.select(CAMPAIGN[(i + 1) % CAMPAIGN.length]!.id);
        return true;
      }
    }
    return false;
  }

  destroy(): void {
    this.alive = false;
    for (const d of this.disposers) d();
    const g = this.app.game;
    if (g && this.hidWorld && !g.destroyed) {
      g.view.layers.world.visible = true;
      g.setPaused(false);
    }
    for (const e of this.tagTex.values()) e.t.destroy(true);
    this.tagTex.clear();
    this.app.host.style.cursor = '';
    destroyOwned(this.root);
  }
}
