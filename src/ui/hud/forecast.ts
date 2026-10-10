/**
 * Incoming-wave markers on the HUD (Kingdom Rush style): during prep, every breather and the
 * first seconds of a wave, each district that will release protesters gets
 *
 * - on screen: a waving crimson rally banner planted on its rally point (1–3 "!" = crowd size),
 *   a pulse ring at its foot, a plate with the expected head count, a hi-vis NEW tag when the
 *   district joins for the first time, and a round badge with the head of the type leading the
 *   wave (a type joining the mix, else the newest dangerous one; Breta once she is out);
 * - off screen: an edge pointer (rally disc + arrowhead toward the district, same plate / tag /
 *   badge) clear of the minimap, wave button and the other pointers.
 *
 * Tap either one to pan there (hover / long-press: tooltip). The forecast and the shared fade
 * live in the world view (`view/forecastView.ts`, which also paints the route chevrons); the
 * placement math is pure (`forecastEdge.ts`). Reduced motion (Settings → shake off) freezes the
 * waving, pulsing and nudging. UI px throughout.
 */
import { Container, Sprite, type Texture } from 'pixi.js';
import {
  EDGE_ANCHOR,
  FLAG_ANCHOR,
  edgePointerFrames,
  forecastBadge,
  forecastCountTag,
  forecastPlate,
  newTagFrames,
  rallyFlagFrames,
  rallyRingFrames,
  screenDirName,
} from '../../art/fx/waveMarkers';
import { tileToWorld } from '../../core/iso';
import { protesterUnlockLevel } from '../../data/levels';
import { protesterDef, type ProtesterId } from '../../data/protesters';
import type { GameController } from '../../game/controller';
import type { DistrictForecast, WaveForecast } from '../../sim/forecast';
import { protesterFigure } from '../art';
import { makeInteractive, type Rect } from '../core/node';
import { destroyOwned, uiTex } from '../core/tex';
import type { HudLayout } from '../layout';
import { miniHead } from '../screens/end';
import { UI_TEXT } from '../strings';
import type { UiApp } from '../app';
import { boxAt, edgePoint, formatCount, onScreen, type Extent } from './forecastEdge';

/** Edge pointer box around its centre: disc + arrow (±17), NEW tag / count tag above or below. */
const EDGE_EXT: Extent = { left: 18, right: 18, top: 26, bottom: 26 };
/** Leading types worth a badge even when not new (cultists, prophets). */
const BADGE_FROM_LEVEL = 8;
const PAN_SECONDS = 0.45;

interface Marker {
  node: Container;
  ring: Sprite;
  flag: Sprite;
  edge: Sprite;
  plate: Sprite;
  tag: Sprite;
  badge: Sprite;
  /** Current mode and data (for taps / tooltips). */
  mode: 'world' | 'edge';
  /** Edge pointer: points down (tags go above) / up (tags go below) / left (badge right). */
  down: boolean;
  up: boolean;
  left: boolean;
  info: DistrictForecast | null;
  plateText: string;
}

export class ForecastMarkers {
  readonly root = new Container({ label: 'forecast-markers' });
  private readonly markers: Marker[] = [];
  private t = 0;
  private pan: { x0: number; y0: number; x1: number; y1: number; t: number } | null = null;
  private lead: ProtesterId | null = null;
  /** Rects the edge pointers keep clear of (minimap, toggles …), set by the HUD. */
  avoid: () => Rect[] = () => [];
  /** The wave button's rect (pointers stay above it), set by the HUD. */
  waveRect: () => Rect | null = () => null;

  constructor(
    private readonly app: UiApp,
    private readonly game: GameController,
  ) {}

  private get reduced(): boolean {
    return !this.app.settings.shake;
  }

  update(dt: number, l: HudLayout, shown: boolean): void {
    const fv = this.game.view.forecast;
    fv.enabled = shown && !this.game.attract;
    this.t += dt;
    this.updatePan(dt);
    const f = fv.current;
    if (!f || fv.alpha <= 0 || !fv.enabled) {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;
    this.root.alpha = fv.alpha;
    this.lead = this.badgeType(f);
    const area: Rect = {
      x: l.safe.left + 2,
      y: l.topBar.h + 2,
      w: l.W - l.safe.left - l.safe.right - 4,
      h: l.deploy.y - l.topBar.h - 4,
    };
    const avoid = this.avoid();
    // The wave button row (CALL EARLY + its wider countdown line above it).
    const wb = this.waveRect();
    if (wb) avoid.push({ x: wb.x - 24, y: wb.y - 16, w: wb.w + 48, h: wb.h + 16 });
    const p = { x: 0, y: 0 };
    let n = 0;
    for (const d of f.districts) {
      const m = this.markers[n] ?? this.makeMarker(n);
      n++;
      m.info = d;
      tileToWorld(d.rally.i + 0.5, d.rally.j + 0.5, p);
      const s = this.game.view.worldToUi(p.x, p.y);
      // The banner stands ~28 px above its foot (+ the NEW tag): keep it all inside the area.
      const top = d.isNew ? 44 : 32;
      const inView = onScreen(s.x, s.y, { ...area, y: area.y + top, h: area.h - top - 16 }, 4);
      if (inView) {
        m.mode = 'world';
        m.node.position.set(Math.round(s.x), Math.round(s.y));
      } else {
        m.mode = 'edge';
        const e = edgePoint(s.x, s.y, area, EDGE_EXT, avoid);
        m.node.position.set(e.x, e.y);
        avoid.push(boxAt(e.x, e.y, EDGE_EXT));
        const dir = screenDirName(s.x - e.x, s.y - e.y);
        m.down = dir === 's' || dir === 'se' || dir === 'sw';
        m.up = dir === 'n' || dir === 'ne' || dir === 'nw';
        m.left = dir === 'w' || dir === 'nw' || dir === 'sw';
        const fr = this.reduced ? 0 : Math.floor(this.t * 3) % 2;
        m.edge.texture = uiTex(
          `fc-edge:${dir}:${d.threat}:${fr}`,
          () => edgePointerFrames(dir, d.threat)[fr]!,
        );
      }
      this.dress(m, d, f);
      m.node.visible = true;
    }
    for (let k = n; k < this.markers.length; k++) this.markers[k]!.node.visible = false;
  }

  /** Badge type: Breta (per district, set in `dress`), a type joining the mix, a dangerous lead. */
  private badgeType(f: WaveForecast): ProtesterId | null {
    const fresh = f.newTypes[f.newTypes.length - 1];
    if (fresh) return fresh;
    const lead = f.lead;
    return lead && protesterUnlockLevel(lead) >= BADGE_FROM_LEVEL ? lead : null;
  }

  private makeMarker(k: number): Marker {
    const node = new Container({ label: `forecast-${k}` });
    const m: Marker = {
      node,
      ring: new Sprite(),
      flag: new Sprite(),
      edge: new Sprite(),
      plate: new Sprite(),
      tag: new Sprite(),
      badge: new Sprite(),
      mode: 'world',
      down: false,
      up: false,
      left: false,
      info: null,
      plateText: '',
    };
    m.ring.anchor.set(0.5);
    m.flag.anchor.set(0, 0);
    m.edge.anchor.set(0, 0);
    node.addChild(m.ring, m.flag, m.edge, m.plate, m.badge, m.tag);
    makeInteractive(node, {
      hit: () => this.hitRect(m),
      tap: () => this.goTo(m),
      hover: (o) => this.app.tooltip.showFor(o ? node : null, () => this.tip(m)),
      longPress: () => {
        this.app.tooltip.showFor(node, () => this.tip(m), 2.5);
        return true;
      },
    });
    this.markers.push(m);
    this.root.addChild(node);
    return m;
  }

  /** Lay out a marker's pieces for its mode (origin = rally foot / pointer centre). */
  private dress(m: Marker, d: DistrictForecast, f: WaveForecast): void {
    const reduced = this.reduced;
    const world = m.mode === 'world';
    m.ring.visible = m.flag.visible = world;
    m.edge.visible = !world;
    if (world) {
      const rf = reduced ? 1 : Math.floor(this.t * 6) % 4;
      m.ring.texture = uiTex(`fc-ring:${rf}`, () => rallyRingFrames()[rf]!);
      m.ring.position.set(0, 0);
      const ff = reduced ? 0 : Math.floor(this.t * 6) % 4;
      m.flag.texture = uiTex(`fc-flag:${d.threat}:${ff}`, () => rallyFlagFrames(d.threat)[ff]!);
      m.flag.position.set(-FLAG_ANCHOR.x, -FLAG_ANCHOR.y);
    } else {
      m.edge.position.set(-EDGE_ANCHOR.x, -EDGE_ANCHOR.y);
    }
    // Count plate.
    const text = formatCount(d.expected);
    const key = `${world ? 'p' : 'c'}${text}`;
    if (key !== m.plateText) {
      m.plateText = key;
      m.plate.texture = world
        ? uiTex(`fc-plate:${text}`, () => forecastPlate(text))
        : uiTex(`fc-count:${text}`, () => forecastCountTag(text));
    }
    const pw = m.plate.texture.width;
    const ph = m.plate.texture.height;
    // World: under the foot, clear of the pulse ring. Edge: opposite the arrow.
    const plateY = world ? 9 : m.down ? -11 - ph : 11;
    m.plate.position.set(-Math.floor(pw / 2) + (world ? 2 : 0), plateY);
    // NEW tag.
    m.tag.visible = d.isNew;
    if (d.isNew) {
      const tf = reduced ? 0 : Math.floor(this.t * 3) % 2;
      m.tag.texture = uiTex(`fc-new:${tf}`, () => newTagFrames()[tf]!);
      const tw = m.tag.texture.width;
      const th = m.tag.texture.height;
      m.tag.position.set(
        world ? 10 - Math.floor(tw / 2) : -Math.floor(tw / 2),
        world
          ? -FLAG_ANCHOR.y - th - 1
          : m.down
            ? plateY - th - 1
            : m.up
              ? plateY + ph + 1
              : -11 - th,
      );
    }
    // Badge: Breta from this district, else the wave's leading / joining type (edge pointers:
    // only Breta and types joining the mix — the rest is in the tooltip).
    const lead = world || (this.lead && f.newTypes.includes(this.lead)) ? this.lead : null;
    const type: ProtesterId | null = d.breta ? 'breta' : lead;
    m.badge.visible = type !== null;
    if (type) {
      const fresh = d.breta || f.newTypes.includes(type);
      m.badge.texture = this.badgeTex(type, fresh);
      if (world) m.badge.position.set(15, -20);
      else m.badge.position.set(m.left ? 7 : -26, m.down ? 1 : -17);
    }
  }

  private badgeTex(type: ProtesterId, fresh: boolean): Texture {
    const key = `fc-badge:${type}:${fresh ? 1 : 0}`;
    const head = miniHead(protesterFigure(type), 13);
    // Only cache once the head art is loaded (protester looks can arrive deferred).
    return head
      ? uiTex(key, () => forecastBadge(head, fresh ? 'hivis2' : 'crim2'))
      : uiTex('fc-badge:none', () => forecastBadge(null));
  }

  private hitRect(m: Marker): Rect {
    // Deploying: let taps through to the placement under the marker.
    if (this.game.deployUnit) return { x: 0, y: 0, w: 0, h: 0 };
    return m.mode === 'world'
      ? { x: -10, y: -FLAG_ANCHOR.y - 4, w: 34, h: FLAG_ANCHOR.y + 24 }
      : {
          x: -EDGE_EXT.left,
          y: -EDGE_EXT.top,
          w: EDGE_EXT.left + EDGE_EXT.right,
          h: EDGE_EXT.top + EDGE_EXT.bottom,
        };
  }

  private tip(m: Marker): string {
    const d = m.info;
    if (!d) return '';
    const lead = d.breta ? 'Breta' : this.lead ? protesterDef(this.lead).name : null;
    return UI_TEXT.forecastTip(d.name, formatCount(d.expected), d.isNew, lead);
  }

  /** Pan the camera to a district (eased; instant with reduced motion). */
  private goTo(m: Marker): void {
    const d = m.info;
    if (!d) return;
    this.app.sfx('click');
    const p = tileToWorld(d.rally.i + 0.5, d.rally.j + 0.5);
    // Frame the banner (it stands above its foot) a little above centre.
    const y = p.y - 12;
    const v = this.game.camera.view();
    if (this.reduced) {
      this.game.camera.centerOn(p.x, y);
      return;
    }
    this.pan = { x0: v.x, y0: v.y, x1: p.x, y1: y, t: 0 };
  }

  private updatePan(dt: number): void {
    const p = this.pan;
    if (!p) return;
    p.t = Math.min(1, p.t + dt / PAN_SECONDS);
    const e = 1 - Math.pow(1 - p.t, 3);
    this.game.camera.centerOn(p.x0 + (p.x1 - p.x0) * e, p.y0 + (p.y1 - p.y0) * e);
    if (p.t >= 1) this.pan = null;
  }

  destroy(): void {
    destroyOwned(this.root);
  }
}
