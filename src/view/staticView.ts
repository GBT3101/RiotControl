/**
 * Static world: buildings (split into square depth pieces + lit-window pieces + cast shadows),
 * the Capitol (current damage state, overlays: flags, fire, smoke, Big Ben's running clock),
 * landmarks (animated fountains / the Eye) and decor props (trees, lamps, benches, flags …).
 *
 * Sprites are bucketed by 16×16-tile chunk and hidden when their bucket is off-screen. Graded
 * sprites are re-tinted when the day/night grade changes; window/lamp light sprites are drawn
 * untinted with alpha = darkness, sorted right above their piece so people in front of a facade
 * still cover its windows.
 */
import { Sprite } from 'pixi.js';
import { art, type AnimClip } from '../art/lib/atlas';
import { propSprite } from '../art/env/props';
import { depthKey, tileToWorld } from '../core/iso';
import type { BuildingInfo, LandmarkInfo, PieceInfo } from '../game/assets/jobs';
import type { CityArt } from '../game/assets';
import type { MapData } from '../maps/contract';
import { pieceDepthKey } from './depth';
import type { ViewLayers } from './layers';
import { setTex } from './sprites';
import type { ViewRect } from './terrainView';

const BUCKET = 16;

interface Bucket {
  sprites: Sprite[];
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  shown: boolean;
}

interface Animated {
  sprite: Sprite;
  clip: AnimClip;
  phase: number;
}

interface LightSprite {
  sprite: Sprite;
  /** Additive pool (light layer) vs lit pixels (entity layer). */
  additive: boolean;
}

/** Fallbacks for decor kinds without their own art. */
const PROP_FALLBACK: Readonly<Record<string, string>> = {
  'tree.round': 'tree.oak',
  'tree.willow': 'tree.chestnut',
  'tree.cypress': 'tree.pine',
  'lamp.rostral': 'lamp',
  tube: 'metro',
  sentrybox: 'phonebox',
  cenotaph: 'statue',
  'column.gilded': 'statue',
  'statue.equestrian': 'statue',
  'statue.lion': 'statue',
  'statue.bear': 'statue',
  fountain: 'wallace',
};

export interface RoofInfo {
  /** World px of the roof stand centre (ground projection). */
  x: number;
  y: number;
  /** Roof height above ground (px). */
  top: number;
  /** Sort key just in front of the whole building. */
  frontKey: number;
}

export class StaticView {
  private readonly buckets = new Map<number, Bucket>();
  private readonly graded: Sprite[] = [];
  private readonly lights: LightSprite[] = [];
  private readonly animated: Animated[] = [];
  private readonly roofs = new Map<number, RoofInfo>();
  /** Capitol */
  private capState = -1;
  private capWanted = 0;
  private capSprites: Sprite[] = [];
  private capOverlays: Array<{
    sprite: Sprite;
    clip: AnimClip;
    hands: boolean;
    x: number;
    y: number;
  }> = [];
  private capLights: Sprite[] = [];
  private capFires: Array<{ x: number; y: number; size: number }> = [];
  capitolFront = 0;
  private gradeTint = 0xffffff;
  private darkness = 0;
  /** World px of decor lamps (for ambient light pools / pigeons etc.). */
  readonly lamps: Array<{ x: number; y: number }> = [];

  constructor(
    private readonly map: MapData,
    private readonly cityArt: CityArt,
    private readonly layers: ViewLayers,
  ) {
    this.buildBuildings();
    this.buildLandmarks();
    this.buildProps();
    this.setCapitolState(0);
  }

  // ── Construction ───────────────────────────────────────────────────────────────────

  private bucketFor(i: number, j: number): Bucket {
    const key = Math.floor(j / BUCKET) * 1024 + Math.floor(i / BUCKET);
    let b = this.buckets.get(key);
    if (!b) {
      b = { sprites: [], x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, shown: true };
      this.buckets.set(key, b);
    }
    return b;
  }

  private track(b: Bucket, s: Sprite): void {
    b.sprites.push(s);
    const bounds = s.getLocalBounds();
    const x0 = s.x + bounds.minX * Math.sign(s.scale.x || 1);
    const x1 = s.x + bounds.maxX * Math.sign(s.scale.x || 1);
    b.x0 = Math.min(b.x0, x0, x1);
    b.x1 = Math.max(b.x1, x0, x1);
    b.y0 = Math.min(b.y0, s.y + bounds.minY);
    b.y1 = Math.max(b.y1, s.y + bounds.maxY);
  }

  /** Create piece (+ light) sprites for a footprint at (i0, j0). */
  private makePieces(
    pieces: readonly PieceInfo[],
    i0: number,
    j0: number,
    fps: number,
  ): { sprites: Sprite[]; lights: Sprite[]; maxKey: number } {
    const p0 = tileToWorld(i0, j0);
    const out = { sprites: [] as Sprite[], lights: [] as Sprite[], maxKey: 0 };
    for (const p of pieces) {
      if (!art.has(p.name)) continue;
      const clip = art.anim(p.name);
      const s = new Sprite(clip.frames[0]!);
      s.position.set(p0.x, p0.y);
      const key = pieceDepthKey(i0 + p.di, j0 + p.dj, p.g);
      s.zIndex = key;
      s.tint = this.gradeTint;
      out.maxKey = Math.max(out.maxKey, key);
      this.layers.entities.addChild(s);
      out.sprites.push(s);
      if (fps > 0 && clip.frames.length > 1) this.animated.push({ sprite: s, clip, phase: 0 });
      if (p.light && art.has(p.light)) {
        const l = new Sprite(art.tex(p.light));
        l.position.set(p0.x, p0.y);
        l.zIndex = key + 1;
        l.visible = this.darkness > 0.02;
        l.alpha = Math.min(1, this.darkness * 1.4);
        this.layers.entities.addChild(l);
        out.lights.push(l);
      }
    }
    return out;
  }

  private addPieces(
    pieces: readonly PieceInfo[],
    i0: number,
    j0: number,
    bucket: Bucket,
    fps: number,
  ): number {
    const r = this.makePieces(pieces, i0, j0, fps);
    for (const s of r.sprites) {
      this.track(bucket, s);
      this.graded.push(s);
    }
    for (const l of r.lights) {
      bucket.sprites.push(l);
      this.lights.push({ sprite: l, additive: false });
    }
    return r.maxKey;
  }

  private addShadow(name: string | undefined, i0: number, j0: number): void {
    if (!name || !art.has(name)) return;
    const s = new Sprite(art.tex(name));
    const p = tileToWorld(i0, j0);
    s.position.set(p.x, p.y);
    this.layers.decals.addChild(s);
  }

  private buildBuildings(): void {
    for (const b of this.map.buildings) {
      const info = this.cityArt.buildings.get(b.id);
      if (!info) continue;
      const bucket = this.bucketFor(b.i + (b.w >> 1), b.j + (b.d >> 1));
      const maxKey = this.addPieces(info.pieces, b.i, b.j, bucket, 0);
      this.addShadow(info.shadow, b.i, b.j);
      this.roofs.set(b.id, roofOf(b.i, b.j, info, maxKey));
    }
  }

  private landmarkInfo(id: string, state = 0): LandmarkInfo | undefined {
    return this.cityArt.landmarks.find((l) => l.id === id && l.state === state);
  }

  private buildLandmarks(): void {
    for (const lm of this.map.landmarks) {
      const info = this.landmarkInfo(lm.id);
      if (!info) continue;
      const bucket = this.bucketFor(lm.i + (info.w >> 1), lm.j + (info.d >> 1));
      const maxKey = this.addPieces(info.pieces, lm.i, lm.j, bucket, info.fps);
      this.addShadow(info.shadow, lm.i, lm.j);
      const p0 = tileToWorld(lm.i, lm.j);
      for (const o of info.overlays) {
        if (!art.has(o.sprite)) continue;
        const clip = art.anim(o.sprite);
        const s = new Sprite(clip.frames[0]!);
        s.position.set(p0.x + o.x, p0.y + o.y);
        s.zIndex = maxKey + 2;
        this.layers.entities.addChild(s);
        this.track(bucket, s);
        this.graded.push(s);
        this.animated.push({ sprite: s, clip, phase: (lm.i * 7 + lm.j) % 5 });
      }
    }
    const cap = this.map.capitol;
    const cinfo = this.landmarkInfo('capitol', 0);
    this.addShadow(cinfo?.shadow, cap.i, cap.j);
  }

  private buildProps(): void {
    const city = this.map.city;
    for (const d of this.map.decor) {
      if (d.kind === 'boat' || d.kind === 'pigeon' || d.kind === 'litter') continue;
      let kind = d.kind;
      let name = propSprite(kind, city, d.seed ?? 0, d.axis ?? 'i');
      if (!art.has(name) && PROP_FALLBACK[kind]) {
        kind = PROP_FALLBACK[kind]!;
        name = propSprite(kind, city, d.seed ?? 0, d.axis ?? 'i');
      }
      if (!art.has(name)) continue;
      const clip = art.anim(name);
      const w = tileToWorld(d.i + 0.5, d.j + 0.5);
      const x = Math.round(w.x);
      const y = Math.round(w.y);
      const s = new Sprite(clip.frames[0]!);
      s.position.set(x, y);
      s.zIndex = depthKey(x, y);
      this.layers.entities.addChild(s);
      const bucket = this.bucketFor(d.i, d.j);
      this.track(bucket, s);
      this.graded.push(s);
      if (clip.frames.length > 1 && clip.fps > 0) {
        this.animated.push({ sprite: s, clip, phase: ((d.seed ?? 0) % 97) / 13 });
      }
      if (art.has(`${name}.light`)) {
        const l = new Sprite(art.tex(`${name}.light`));
        l.position.set(x, y);
        l.zIndex = s.zIndex + 1;
        l.visible = false;
        this.layers.entities.addChild(l);
        bucket.sprites.push(l);
        this.lights.push({ sprite: l, additive: false });
      }
      if (kind === 'lamp' || kind === 'lamp.rostral') {
        this.lamps.push({ x, y });
        if (art.has('fx.light.lamp')) {
          const pool = new Sprite(art.tex('fx.light.lamp'));
          pool.position.set(x, y);
          pool.blendMode = 'add';
          pool.visible = false;
          this.layers.lights.addChild(pool);
          this.lights.push({ sprite: pool, additive: true });
          bucket.sprites.push(pool);
        }
        if (art.has('fx.light.halo')) {
          const halo = new Sprite(art.tex('fx.light.halo'));
          halo.position.set(x, y - (s.texture.defaultAnchor?.y ?? 0) * s.texture.height + 3);
          halo.blendMode = 'add';
          halo.visible = false;
          this.layers.lights.addChild(halo);
          this.lights.push({ sprite: halo, additive: true });
          bucket.sprites.push(halo);
        }
      }
    }
  }

  // ── Capitol ────────────────────────────────────────────────────────────────────────

  /** Switch the Capitol art to a sim damage state (0 pristine … 5 collapsing). */
  setCapitolState(simState: number): void {
    this.capWanted = Math.min(4, Math.max(0, simState));
    // Damage states stream in after the first frame: use the closest state already built.
    let st = this.capWanted;
    while (st > 0 && !this.landmarkInfo('capitol', st)) st--;
    if (st === this.capState) return;
    this.capState = st;
    for (const sp of this.capSprites) sp.destroy();
    for (const l of this.capLights) l.destroy();
    for (const o of this.capOverlays) o.sprite.destroy();
    this.capSprites = [];
    this.capOverlays = [];
    this.capLights = [];
    this.capFires = [];
    const info = this.landmarkInfo('capitol', st);
    if (!info) return;
    const cap = this.map.capitol;
    const r = this.makePieces(info.pieces, cap.i, cap.j, 0);
    this.capSprites = r.sprites;
    this.capLights = r.lights;
    this.capitolFront = r.maxKey;
    const p0 = tileToWorld(cap.i, cap.j);
    for (const o of info.overlays) {
      if (!art.has(o.sprite)) continue;
      const clip = art.anim(o.sprite);
      const sp = new Sprite(clip.frames[0]!);
      const x = p0.x + o.x;
      const y = p0.y + o.y;
      sp.position.set(x, y);
      sp.zIndex = r.maxKey + 2;
      const emissive = o.sprite.includes('.fire.');
      sp.tint = emissive ? 0xffffff : this.gradeTint;
      this.layers.entities.addChild(sp);
      this.capOverlays.push({ sprite: sp, clip, hands: o.sprite.includes('.hands.'), x, y });
      if (emissive) this.capFires.push({ x, y, size: clip.width });
    }
  }

  /** New art arrived: show the wanted damage state if it was missing. */
  refreshCapitol(): void {
    this.setCapitolState(this.capWanted);
  }

  /** Fire spots on the Capitol (for light/smoke FX). */
  get capitolFires(): ReadonlyArray<{ x: number; y: number; size: number }> {
    return this.capFires;
  }

  // ── Queries ────────────────────────────────────────────────────────────────────────

  roof(buildingId: number): RoofInfo | undefined {
    return this.roofs.get(buildingId);
  }

  // ── Per frame ──────────────────────────────────────────────────────────────────────

  update(now: number, view: ViewRect, hour: number): void {
    for (const b of this.buckets.values()) {
      const vis = b.x1 > view.x0 && b.x0 < view.x1 && b.y1 > view.y0 && b.y0 < view.y1;
      if (vis !== b.shown) {
        b.shown = vis;
        for (const s of b.sprites) s.renderable = vis;
      }
    }
    for (const a of this.animated) {
      if (!a.sprite.renderable) continue;
      setTex(a.sprite, a.clip.frames[a.clip.frameAt(now + a.phase)]!);
    }
    // Big Ben: minute hand position from the in-game clock (+ one minute per second of play).
    const minutes = Math.floor(hour * 60 + now) % 60;
    for (const o of this.capOverlays) {
      const f = o.hands
        ? Math.floor(minutes / 5) % o.clip.frames.length
        : o.clip.frameAt(now + (o.x % 7) * 0.13);
      setTex(o.sprite, o.clip.frames[f]!);
    }
  }

  setGrade(tint: number, darkness: number): void {
    if (tint !== this.gradeTint) {
      this.gradeTint = tint;
      for (const s of this.graded) s.tint = tint;
      for (const s of this.capSprites) s.tint = tint;
      for (const o of this.capOverlays) if (!o.sprite.texture.label?.includes('.fire.')) o.sprite.tint = tint;
    }
    if (Math.abs(darkness - this.darkness) > 0.01 || (darkness === 0) !== (this.darkness === 0)) {
      this.darkness = darkness;
      this.applyLights();
    }
  }

  private applyLights(): void {
    const d = this.darkness;
    const on = d > 0.02;
    for (const l of this.lights) {
      l.sprite.visible = on;
      l.sprite.alpha = l.additive ? d * 0.5 : Math.min(1, d * 1.4);
    }
    for (const l of this.capLights) {
      l.visible = on;
      l.alpha = Math.min(1, d * 1.4);
    }
  }
}

function roofOf(i0: number, j0: number, info: BuildingInfo, frontKey: number): RoofInfo {
  const rs = info.roofStand;
  const p = tileToWorld(i0 + (rs.u0 + rs.u1) / 2, j0 + (rs.v0 + rs.v1) / 2);
  return { x: Math.round(p.x), y: Math.round(p.y), top: info.roofTopY, frontKey };
}

