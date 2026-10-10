/**
 * Minimap: the city in true 2:1 iso projection (so the camera view is a plain rectangle) inside
 * the brass M5 bezel. Base layer (ground, buildings, Capitol) is painted once; an overlay with
 * the crowd-density heat, Ministry units and the camera rectangle refreshes ~6×/s. Tap or drag
 * on it to move the camera. While the next wave is forecast (view/forecastView.ts), each
 * district that will release protesters gets a blinking flag and a faint route to the Capitol
 * (a bright dot runs along it; a hi-vis diamond rings districts joining for the first time).
 */
import { BufferImageSource, Container, Sprite, Texture } from 'pixi.js';
import { col } from '../../art/fx/draw';
import { createBuffer, type PixelBuffer } from '../../art/lib/pixels';
import { MINIMAP_FLAG } from '../../art/fx/waveMarkers';
import { minimapFrame } from '../../art/uikit/panels';
import { GROUNDS, type MapData } from '../../maps/contract';
import type { GameController } from '../../game/controller';
import { makeInteractive } from '../core/node';
import { markOwned, swapOwned, destroyOwned } from '../core/tex';
import { minimapFrameH, type HudLayout } from '../layout';
import type { UiApp } from '../app';

/** Tile index under each minimap pixel (-1 = outside the map). Pure. */
export function minimapTiles(mapW: number, mapH: number, iw: number, ih: number): Int32Array {
  const out = new Int32Array(iw * ih).fill(-1);
  const span = mapW + mapH;
  const s = iw / span;
  for (let py = 0; py < ih; py++) {
    for (let px = 0; px < iw; px++) {
      // Iso: X = i - j ∈ [-mapH, mapW], Y = i + j ∈ [0, span]; screen y = Y / 2.
      const X = (px + 0.5) / s - mapH;
      const Y = ((py + 0.5) / s) * 2;
      const i = Math.floor((X + Y) / 2);
      const j = Math.floor((Y - X) / 2);
      if (i < 0 || j < 0 || i >= mapW || j >= mapH) continue;
      out[py * iw + px] = j * mapW + i;
    }
  }
  return out;
}

/** Minimap pixel (inner coords, fractional) of a tile position. Pure. */
export function tileToMinimap(
  u: number,
  v: number,
  mapW: number,
  mapH: number,
  iw: number,
): { x: number; y: number } {
  const s = iw / (mapW + mapH);
  return { x: (u - v + mapH) * s, y: ((u + v) / 2) * s };
}

/** Tile position (continuous) of a minimap pixel. Pure. */
export function minimapToTile(
  x: number,
  y: number,
  mapW: number,
  mapH: number,
  iw: number,
): { u: number; v: number } {
  const s = iw / (mapW + mapH);
  const X = x / s - mapH;
  const Y = (y / s) * 2;
  return { u: (X + Y) / 2, v: (Y - X) / 2 };
}

const GROUND_COLOUR: Record<string, string> = {
  lot: 'stone1',
  asphalt: 'gray3',
  sidewalk: 'gray4',
  cobble: 'stone2',
  plaza: 'stone3',
  steps: 'stone4',
  bridge: 'stone2',
  grass: 'green2',
  parkPath: 'earth3',
  water: 'blue1',
  quay: 'gray2',
};

const ROOF: Record<string, string> = { madrid: 'rust2', london: 'zinc2', paris: 'navy2' };

/** Base minimap image (ground + buildings + Capitol). Pure. */
export function minimapBase(map: MapData, tiles: Int32Array, iw: number, ih: number): PixelBuffer {
  const b = createBuffer(iw, ih);
  const cap = map.capitol;
  const set = (o: number, ref: string): void => {
    const c = col(ref);
    b.data[o] = c >>> 24;
    b.data[o + 1] = (c >>> 16) & 255;
    b.data[o + 2] = (c >>> 8) & 255;
    b.data[o + 3] = 255;
  };
  const roof = ROOF[map.city] ?? 'zinc2';
  for (let p = 0; p < tiles.length; p++) {
    const t = tiles[p]!;
    const o = p * 4;
    if (t < 0) {
      set(o, 'navy0');
      continue;
    }
    const i = t % map.w;
    const j = (t - i) / map.w;
    if (i >= cap.i && j >= cap.j && i < cap.i + cap.w && j < cap.j + cap.d) {
      set(o, 'ochre4');
      continue;
    }
    if (map.building[t]! >= 0) {
      set(o, roof);
      continue;
    }
    set(o, GROUND_COLOUR[GROUNDS[map.ground[t]!] ?? 'lot'] ?? 'stone1');
  }
  // Building edges: darken pixels whose upper neighbour is ground (fake relief).
  const dark = col('ink');
  for (let y = ih - 1; y > 0; y--) {
    for (let x = 0; x < iw; x++) {
      const t = tiles[y * iw + x]!;
      const up = tiles[(y - 1) * iw + x]!;
      if (t < 0 || up < 0) continue;
      const isB = map.building[t]! >= 0;
      const upB = map.building[up]! >= 0;
      if (!isB && upB) {
        const o = (y * iw + x) * 4;
        b.data[o] = (dark >>> 24) & 255;
        b.data[o + 1] = (dark >>> 16) & 255;
        b.data[o + 2] = (dark >>> 8) & 255;
      }
    }
  }
  return b;
}

export class Minimap {
  readonly root = new Container({ label: 'minimap' });
  private readonly frame = new Sprite();
  private readonly base = new Sprite();
  private readonly over = new Sprite();
  private iw = 0;
  private ih = 0;
  private tiles: Int32Array = new Int32Array(0);
  private overData = new Uint8Array(0);
  private overSource: BufferImageSource | null = null;
  private acc = 1;
  private key = '';
  private blink = 0;

  constructor(
    private readonly app: UiApp,
    private readonly game: GameController,
  ) {
    this.root.addChild(this.frame, this.base, this.over);
    const jump = (x: number, y: number): void => {
      const m = this.game.world.map;
      const t = minimapToTile(x - 6, y - 10, m.w, m.h, this.iw);
      this.game.focusTile(
        Math.max(0, Math.min(m.w - 1, Math.floor(t.u))),
        Math.max(0, Math.min(m.h - 1, Math.floor(t.v))),
      );
      this.acc = 1;
    };
    makeInteractive(this.frame, {
      tap: (e) => jump(e.x, e.y),
      drag: (dx, dy) => {
        const v = this.game.camera.view();
        const m = this.game.world.map;
        // Convert minimap px to world px: one minimap px = (span·32 / iw) / 2 … use tiles.
        const s = this.iw / (m.w + m.h);
        this.game.camera.centerOn(v.x + (dx / s) * 16, v.y + (dy / s) * 16);
        this.acc = 1;
        return true;
      },
    });
  }

  layout(l: HudLayout): void {
    const r = l.minimap;
    this.root.visible = !!r && !this.game.attract;
    if (!r) return;
    const key = `${r.w}`;
    this.root.position.set(r.x, r.y);
    if (key === this.key) return;
    this.key = key;
    const fh = minimapFrameH(r.w);
    swapOwned(this.frame, minimapFrame(r.w, fh), 'ui:minimap');
    this.iw = r.w - 12;
    this.ih = fh - 12;
    const m = this.game.world.map;
    this.tiles = minimapTiles(m.w, m.h, this.iw, this.ih);
    swapOwned(this.base, minimapBase(m, this.tiles, this.iw, this.ih), 'ui:minimap-base');
    this.base.position.set(6, 10);
    this.over.position.set(6, 10);
    this.overData = new Uint8Array(this.iw * this.ih * 4);
    const old = this.over.texture;
    this.overSource = new BufferImageSource({
      resource: this.overData,
      width: this.iw,
      height: this.ih,
      format: 'rgba8unorm',
      scaleMode: 'nearest',
      autoGenerateMipmaps: false,
      label: 'minimap-overlay',
    });
    this.over.texture = markOwned(new Texture({ source: this.overSource }));
    if (old && old !== Texture.EMPTY) old.destroy(true);
    this.acc = 1;
  }

  update(dt: number): void {
    if (!this.root.visible || !this.overSource) return;
    this.acc += dt;
    this.blink += dt;
    if (this.acc < 0.16) return;
    this.acc = 0;
    const w = this.game.world;
    const m = w.map;
    const d = this.overData;
    d.fill(0);
    const iw = this.iw;
    const ih = this.ih;
    const put = (x: number, y: number, c: number): void => {
      if (x < 0 || y < 0 || x >= iw || y >= ih) return;
      const o = (y * iw + x) * 4;
      d[o] = c >>> 24;
      d[o + 1] = (c >>> 16) & 255;
      d[o + 2] = (c >>> 8) & 255;
      d[o + 3] = 255;
    };
    // Forecast routes (under the crowd heat).
    const fv = this.game.view.forecast;
    const fc = fv.alpha > 0 ? fv.current : null;
    const reduced = !this.app.settings.shake;
    if (fc) {
      const faint = col('rust1');
      const runner = col('rust4');
      for (const ds of fc.districts) {
        const r = fv.route(ds.district);
        const run = reduced ? -1 : Math.floor(this.blink * 24) % Math.max(1, r.length);
        for (let k = 0; k < r.length; k++) {
          const t = r[k]!;
          const i = t % m.w;
          const q = tileToMinimap(i + 0.5, (t - i) / m.w + 0.5, m.w, m.h, iw);
          put(Math.floor(q.x), Math.floor(q.y), Math.abs(k - run) <= 1 ? runner : faint);
        }
      }
    }
    // Crowd heat: protesters per minimap pixel (via the tiles under it).
    const heat = [col('rust2'), col('crim1'), col('crim2'), col('pink2')];
    const hash = w.hash;
    for (let p = 0; p < this.tiles.length; p++) {
      const t = this.tiles[p]!;
      if (t < 0) continue;
      const i = t % m.w;
      const n = hash.cellCount(i, (t - i) / m.w);
      if (n <= 0) continue;
      const c = n >= 8 ? heat[3]! : n >= 4 ? heat[2]! : n >= 2 ? heat[1]! : heat[0]!;
      put(p % iw, Math.floor(p / iw), c);
    }
    // Ministry units (2×1 hi-vis blips, selected one blinks white).
    const unit = col('hivis2');
    const sel = col('white');
    const selected = this.game.selectedUnit;
    for (const u of w.units.active) {
      const q = tileToMinimap(u.x, u.y, m.w, m.h, iw);
      const x = Math.floor(q.x);
      const y = Math.floor(q.y);
      const c = u.id === selected && Math.floor(this.blink * 4) % 2 ? sel : unit;
      put(x, y, c);
      put(x + 1, y, c);
    }
    // Forecast flags (blinking; NEW districts ringed with a hi-vis diamond).
    if (fc) {
      const on = reduced || Math.floor(this.blink * 3) % 2 === 0;
      const pole = col('stone5');
      const cloth = col(on ? 'crim2' : 'rust4');
      const ring = col('hivis2');
      for (const ds of fc.districts) {
        const q = tileToMinimap(ds.rally.i + 0.5, ds.rally.j + 0.5, m.w, m.h, iw);
        const fx = Math.floor(q.x);
        const fy = Math.floor(q.y);
        if (ds.isNew && on) {
          for (let k = -3; k <= 3; k++) {
            const a = 3 - Math.abs(k);
            put(fx + k, fy - a, ring);
            put(fx + k, fy + a, ring);
          }
        }
        MINIMAP_FLAG.forEach((row, y) => {
          for (let x = 0; x < row.length; x++) {
            const ch = row[x];
            if (ch === 'o') put(fx + x, fy - 5 + y, pole);
            else if (ch === 'R') put(fx + x, fy - 5 + y, cloth);
          }
        });
      }
    }
    // Camera rectangle.
    const v = this.game.camera.view();
    const cam = col('white');
    const tl = this.worldToMini(v.x - v.width / 2 / v.zoom, v.y - v.height / 2 / v.zoom);
    const br = this.worldToMini(v.x + v.width / 2 / v.zoom, v.y + v.height / 2 / v.zoom);
    const x0 = Math.round(tl.x);
    const y0 = Math.round(tl.y);
    const x1 = Math.round(br.x);
    const y1 = Math.round(br.y);
    for (let x = x0; x <= x1; x++) {
      put(x, y0, cam);
      put(x, y1, cam);
    }
    for (let y = y0; y <= y1; y++) {
      put(x0, y, cam);
      put(x1, y, cam);
    }
    this.overSource.update();
  }

  /** World px → minimap inner px. */
  private worldToMini(x: number, y: number): { x: number; y: number } {
    const m = this.game.world.map;
    // world x = (u - v)·16, y = (u + v)·8  →  u - v = x/16, u + v = y/8.
    const s = this.iw / (m.w + m.h);
    return { x: (x / 16 + m.h) * s, y: (y / 16) * s };
  }

  destroy(): void {
    destroyOwned(this.root);
  }
}
