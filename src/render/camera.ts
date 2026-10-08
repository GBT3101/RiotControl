/**
 * Camera state: world-space centre, integer zoom (eased), inertia and bounds clamping.
 * Pure maths (no DOM / Pixi) — driven by CameraController, applied by `applyToContainer`.
 */
import type { CameraView } from '../core/iso';
import type { ZoomRange } from './zoom';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CameraOptions {
  /** Inertia half-life of pan velocity, seconds (default 0.12). */
  inertiaHalfLife?: number;
  /** Zoom easing rate (1/s, default 18). */
  zoomEase?: number;
}

export class Camera {
  /** World point at the screen centre (float; snapped by `view()`). */
  x = 0;
  y = 0;
  /** Current zoom (fractional only while easing / pinching). */
  zoom = 2;
  /** Target integer zoom. */
  targetZoom = 2;
  /** Pan velocity, world px / s (inertia). */
  vx = 0;
  vy = 0;
  width = 1;
  height = 1;
  range: ZoomRange = { min: 1, max: 5, def: 2 };
  bounds: Bounds = { minX: -1e6, minY: -1e6, maxX: 1e6, maxY: 1e6 };

  private focus: { sx: number; sy: number } | null = null;
  private readonly decayPerSec: number;
  private readonly zoomEase: number;

  constructor(opts: CameraOptions = {}) {
    this.decayPerSec = Math.log(2) / (opts.inertiaHalfLife ?? 0.12);
    this.zoomEase = opts.zoomEase ?? 18;
  }

  setViewport(width: number, height: number, range: ZoomRange): void {
    const first = this.width <= 1;
    this.width = width;
    this.height = height;
    this.range = range;
    if (first) {
      this.zoom = this.targetZoom = range.def;
    } else {
      this.targetZoom = clampInt(this.targetZoom, range.min, range.max);
      this.zoom = Math.min(Math.max(this.zoom, range.min), range.max);
    }
    this.clamp();
  }

  setBounds(b: Bounds): void {
    this.bounds = b;
    this.clamp();
  }

  centerOn(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = this.vy = 0;
    this.clamp();
  }

  /** Screen point (device px) → world. Uses the unsnapped camera. */
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: this.x + (sx - Math.floor(this.width / 2)) / this.zoom,
      y: this.y + (sy - Math.floor(this.height / 2)) / this.zoom,
    };
  }

  /** Drag the world by a screen delta (device px). */
  panByScreen(dsx: number, dsy: number): void {
    this.x -= dsx / this.zoom;
    this.y -= dsy / this.zoom;
    this.clamp();
  }

  /** Request an (eased) integer zoom level keeping the world point under (sx, sy) fixed. */
  zoomTo(level: number, sx = this.width / 2, sy = this.height / 2): void {
    this.targetZoom = clampInt(Math.round(level), this.range.min, this.range.max);
    this.focus = { sx, sy };
  }

  zoomBy(steps: number, sx?: number, sy?: number): void {
    this.zoomTo(this.targetZoom + steps, sx, sy);
  }

  /** Set a fractional zoom immediately (pinch), keeping (sx, sy) fixed. */
  setZoomAround(z: number, sx: number, sy: number): void {
    const lo = this.range.min - 0.35;
    const hi = this.range.max + 0.35;
    this.applyZoomAround(Math.min(Math.max(z, lo), hi), sx, sy);
    this.targetZoom = clampInt(Math.round(this.zoom), this.range.min, this.range.max);
    this.focus = { sx, sy };
  }

  setVelocity(vx: number, vy: number): void {
    this.vx = vx;
    this.vy = vy;
  }

  stop(): void {
    this.vx = this.vy = 0;
  }

  /** Advance easing & inertia by `dt` seconds (real time, unaffected by game speed). */
  update(dt: number): void {
    if (this.zoom !== this.targetZoom) {
      const k = 1 - Math.exp(-this.zoomEase * dt);
      let z = this.zoom + (this.targetZoom - this.zoom) * k;
      if (Math.abs(z - this.targetZoom) < 0.02) z = this.targetZoom;
      const f = this.focus ?? { sx: this.width / 2, sy: this.height / 2 };
      this.applyZoomAround(z, f.sx, f.sy);
      if (z === this.targetZoom) this.focus = null;
    }
    if (this.vx !== 0 || this.vy !== 0) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const decay = Math.exp(-this.decayPerSec * dt);
      this.vx *= decay;
      this.vy *= decay;
      if (Math.hypot(this.vx, this.vy) < 4) this.vx = this.vy = 0;
    }
    this.clamp();
  }

  /** True when at rest on an integer zoom. */
  get settled(): boolean {
    return this.zoom === this.targetZoom && this.vx === 0 && this.vy === 0;
  }

  /** Snapped view used for rendering: centre on whole world pixels. */
  view(): CameraView {
    return {
      x: Math.round(this.x),
      y: Math.round(this.y),
      zoom: this.zoom,
      width: this.width,
      height: this.height,
    };
  }

  private applyZoomAround(z: number, sx: number, sy: number): void {
    const before = this.screenToWorld(sx, sy);
    this.zoom = z;
    const after = this.screenToWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
  }

  /** Keep the view inside bounds; centre on an axis where the view is larger than bounds. */
  clamp(): void {
    const hw = this.width / 2 / this.zoom;
    const hh = this.height / 2 / this.zoom;
    const b = this.bounds;
    const clampAxis = (v: number, lo: number, hi: number, half: number): number =>
      hi - lo <= half * 2 ? (lo + hi) / 2 : Math.min(Math.max(v, lo + half), hi - half);
    const nx = clampAxis(this.x, b.minX, b.maxX, hw);
    const ny = clampAxis(this.y, b.minY, b.maxY, hh);
    if (nx !== this.x) this.vx = 0;
    if (ny !== this.y) this.vy = 0;
    this.x = nx;
    this.y = ny;
  }
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(Math.round(v), lo), hi);
}

/** Position/scale a world container for a snapped camera view. */
export function applyToContainer(
  container: { position: { set(x: number, y: number): void }; scale: { set(v: number): void } },
  view: CameraView,
): void {
  container.scale.set(view.zoom);
  container.position.set(
    Math.floor(view.width / 2) - view.x * view.zoom,
    Math.floor(view.height / 2) - view.y * view.zoom,
  );
}
