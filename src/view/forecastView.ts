/**
 * Incoming-wave forecast in the world (Kingdom Rush style): during the prep phase, every
 * breather and the first seconds of a wave, each spawn district that will release protesters
 * gets a trail of iso chevrons painted on the street from its rally point toward the Capitol
 * (`fx.forecast.chevron.*`, in the `marks` layer: on the ground, under every standing thing).
 * A bright pulse runs down each trail toward the Capitol (static with reduced motion).
 *
 * It also owns the forecast itself (`sim/forecast.ts Forecaster`, refreshed ~3×/s) and the
 * shared visibility fade, so the HUD markers, edge pointers and minimap flags read the same
 * state: `current`, `alpha`, `route(d)`.
 */
import { Container, Sprite, type Texture } from 'pixi.js';
import { art } from '../art/lib/atlas';
import { tileDirName, type ForecastDir } from '../art/fx/waveMarkers';
import { tileToWorld } from '../core/iso';
import { Forecaster, type WaveForecast } from '../sim/forecast';
import type { World } from '../sim/world';
import type { ViewLayers } from './layers';
import { setTex } from './sprites';

/** Seconds of a wave during which its districts stay marked. */
export const FORECAST_WAVE_SECONDS = 10;
/** Trail: first chevron, spacing and length along the route (tiles). */
const TRAIL = { start: 1.4, step: 1.7, length: 22 };
/** Pulse: speed (tiles/s) and period (tiles) of the bright band running down a trail. */
const PULSE = { speed: 7, period: 9, bright: 1.8, lit: 4.2 };
const REFRESH = 0.3;

interface Chevron {
  x: number;
  y: number;
  dir: ForecastDir;
  /** Distance along the route (tiles). */
  s: number;
  /** Fade toward the trail's end. */
  alpha: number;
}

export class ForecastView {
  readonly forecaster = new Forecaster();
  /** Set by the HUD: markers only in a played run with the HUD shown (not on the title). */
  enabled = false;
  /** Reduced motion: no travelling pulse. */
  reducedMotion = false;
  /** Latest forecast while the markers are up (null otherwise). */
  current: WaveForecast | null = null;
  /** Shared visibility 0..1 (fades in/out). */
  alpha = 0;
  private readonly root = new Container({ label: 'forecast' });
  private readonly pool: Sprite[] = [];
  private chevrons: Chevron[] = [];
  private refreshT = 0;
  private wave = -1;
  private waveStart = 0;
  private texCache = new Map<ForecastDir, Texture[]>();

  constructor(
    private readonly world: World,
    layers: ViewLayers,
  ) {
    layers.marks.addChild(this.root);
  }

  /** Markers wanted right now (prep, breather, first seconds of a wave)? */
  get wanted(): boolean {
    const w = this.world;
    const d = w.director;
    if (!this.enabled || w.phase !== 'playing') return false;
    if (d.phase !== 'wave') return true;
    return w.time - this.waveStart < FORECAST_WAVE_SECONDS;
  }

  /** Seconds of the marked wave already played (0 before it starts). */
  get waveElapsed(): number {
    return this.world.director.phase === 'wave' ? this.world.time - this.waveStart : 0;
  }

  /** Cached route (tile indices) of district d toward the Capitol. */
  route(d: number): readonly number[] {
    return this.forecaster.route(this.world, d);
  }

  update(now: number, realDt: number): void {
    const w = this.world;
    const d = w.director;
    this.forecaster.observe(w);
    if (d.phase === 'wave' && d.wave !== this.wave) {
      // A wave already under way when first seen (time skip) counts as long started.
      const late = this.wave < 0 && d.pending < d.waveSize;
      this.wave = d.wave;
      this.waveStart = late ? -Infinity : w.time;
    }
    if (d.phase !== 'wave' && this.wave < 0) this.wave = 0;
    const on = this.wanted;
    this.alpha = Math.max(0, Math.min(1, this.alpha + (on ? 4 : -2.5) * Math.min(realDt, 0.1)));
    if (on) {
      this.refreshT -= realDt;
      if (this.refreshT <= 0 || !this.current) {
        this.refreshT = REFRESH;
        this.current = this.forecaster.forecast(w);
        this.layout();
      }
    } else if (this.alpha <= 0) {
      this.current = null;
      this.refreshT = 0;
    }
    this.root.visible = this.alpha > 0 && this.current !== null;
    if (!this.root.visible) return;
    this.root.alpha = this.alpha;
    this.draw(now);
  }

  /** Chevron placements along every marked district's route. */
  private layout(): void {
    const f = this.current;
    const out: Chevron[] = [];
    if (f) {
      const W = this.world.map.w;
      const p = { x: 0, y: 0 };
      for (const dist of f.districts) {
        const r = this.route(dist.district);
        if (r.length < 3) continue;
        // Cumulative length along the tile-centre polyline.
        const cum = [0];
        for (let k = 1; k < r.length; k++) {
          const a = r[k - 1]!;
          const b = r[k]!;
          cum.push(cum[k - 1]! + Math.hypot((b % W) - (a % W), Math.floor(b / W) - Math.floor(a / W)));
        }
        const total = cum[cum.length - 1]!;
        const end = Math.min(TRAIL.length, total - 1);
        const at = (s: number): { u: number; v: number } => {
          let k = 1;
          while (k < cum.length - 1 && cum[k]! < s) k++;
          const a = r[k - 1]!;
          const b = r[k]!;
          const t = Math.max(0, Math.min(1, (s - cum[k - 1]!) / Math.max(1e-6, cum[k]! - cum[k - 1]!)));
          return {
            u: (a % W) + ((b % W) - (a % W)) * t + 0.5,
            v: Math.floor(a / W) + (Math.floor(b / W) - Math.floor(a / W)) * t + 0.5,
          };
        };
        for (let s = TRAIL.start; s <= end; s += TRAIL.step) {
          const q = at(s);
          const ahead = at(Math.min(total, s + 1.5));
          const back = at(Math.max(0, s - 1));
          tileToWorld(q.u, q.v, p);
          out.push({
            x: Math.round(p.x),
            y: Math.round(p.y),
            dir: tileDirName(ahead.u - back.u, ahead.v - back.v),
            s,
            alpha: Math.min(1, (end - s) / 5 + 0.25),
          });
        }
      }
    }
    this.chevrons = out;
  }

  private textures(dir: ForecastDir): Texture[] | null {
    let t = this.texCache.get(dir);
    if (!t) {
      const name = `fx.forecast.chevron.${dir}`;
      if (!art.has(name)) return null;
      t = [0, 1, 2].map((k) => art.tex(name, k));
      this.texCache.set(dir, t);
    }
    return t;
  }

  private draw(now: number): void {
    let n = 0;
    const head = now * PULSE.speed;
    for (const c of this.chevrons) {
      const tex = this.textures(c.dir);
      if (!tex) continue;
      let sp = this.pool[n];
      if (!sp) {
        sp = new Sprite();
        this.pool.push(sp);
        this.root.addChild(sp);
      }
      let shade = 1;
      if (!this.reducedMotion) {
        const d = (((head - c.s) % PULSE.period) + PULSE.period) % PULSE.period;
        shade = d < PULSE.bright ? 2 : d < PULSE.lit ? 1 : 0;
      }
      setTex(sp, tex[shade]!);
      sp.position.set(c.x, c.y);
      sp.alpha = c.alpha;
      sp.visible = true;
      n++;
    }
    for (let k = n; k < this.pool.length; k++) this.pool[k]!.visible = false;
  }
}
