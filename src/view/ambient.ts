/**
 * Ambient life: parked cars along the kerbs (city mix, police vans with flashing lights near
 * the Capitol) that get burnt, flipped or set alight as the riot escalates; pigeon flocks in
 * plazas and parks that scatter when a crowd comes near; litter accumulating where crowds
 * march; siren light pools at night.
 */
import { Sprite } from 'pixi.js';
import { art } from '../art/lib/atlas';
import { depthKey, tileToWorld } from '../core/iso';
import { GROUNDS, type CityId, type MapData } from '../maps/contract';
import type { World } from '../sim/world';
import { totalFallen } from '../sim/stats';
import type { DecalLayer } from './decalLayer';
import type { FxSystem } from './fx';
import type { ViewLayers } from './layers';
import { setTex } from './sprites';
import type { ViewRect } from './terrainView';

function hash(a: number, b: number, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

const CITY_CARS: Readonly<Record<CityId, string[]>> = {
  madrid: ['taxi_madrid', 'taxi_madrid', 'hatch', 'hatch_white', 'sedan_beige', 'scooter', 'delivery_van', 'hatch_silver', 'sedan', 'bus_madrid'],
  london: ['cab_london', 'cab_london', 'hatch_blue', 'sedan_black', 'delivery_van', 'hatch_silver', 'sedan', 'hatch', 'bus_london'],
  paris: ['car_2cv', 'car_twingo', 'scooter', 'scooter_red', 'hatch_white', 'sedan_teal', 'delivery_van', 'hatch_yellow', 'bus_paris'],
};
/** Base id for aftermath sprites (colour variants share them). */
function baseId(id: string): string {
  return id.startsWith('hatch') ? 'hatch' : id.startsWith('sedan') ? 'sedan' : id.startsWith('scooter') ? 'scooter' : id;
}

interface Car {
  id: string;
  dir: string;
  x: number;
  y: number;
  tile: number;
  /** 0..1 escalation threshold at which it gets wrecked. */
  wreckAt: number;
  state: 'parked' | 'burning' | 'burnt' | 'flipped';
  burnUntil: number;
  sprite: Sprite;
  siren: Sprite | null;
  police: boolean;
}

interface Pigeon {
  sprite: Sprite;
  x: number;
  y: number;
  hx: number;
  hy: number;
  flying: boolean;
  t0: number;
  vx: number;
  phase: number;
}

interface Flock {
  i: number;
  j: number;
  birds: Pigeon[];
  gone: number;
}

export class AmbientView {
  private readonly cars: Car[] = [];
  private readonly flocks: Flock[] = [];
  private escalation = 0;
  private litterT = 0;
  private litterCount = 0;
  private checkT = 0;
  private carsReady = false;
  grade = 0xffffff;
  darkness = 0;

  constructor(
    private readonly world: World,
    private readonly map: MapData,
    private readonly layers: ViewLayers,
    private readonly fx: FxSystem,
    private readonly decals: DecalLayer,
  ) {
    this.placeFlocks();
  }

  // ── Placement ────────────────────────────────────────────────────────────────────────

  private ground(i: number, j: number): string {
    if (i < 0 || j < 0 || i >= this.map.w || j >= this.map.h) return 'lot';
    return GROUNDS[this.map.ground[j * this.map.w + i]!]!;
  }

  /** Parked cars need the vehicle art (deferred): call when it arrives. */
  placeCars(): void {
    if (this.carsReady || !art.has('veh.hatch.parked.se')) return;
    this.carsReady = true;
    const m = this.map;
    const nav = this.world.nav;
    const cap = m.capitol;
    const taken = new Set<number>();
    for (let j = 1; j < m.h - 1; j++) {
      for (let i = 1; i < m.w - 1; i++) {
        if (this.ground(i, j) !== 'asphalt' || m.marking[j * m.w + i] !== 0) continue;
        const h = hash(i, j, 0xca5);
        if (h % 100 >= 9) continue;
        const alongI = this.ground(i - 1, j) === 'asphalt' && this.ground(i + 1, j) === 'asphalt';
        const alongJ = this.ground(i, j - 1) === 'asphalt' && this.ground(i, j + 1) === 'asphalt';
        let kdi = 0;
        let kdj = 0;
        let dirs: [string, string];
        if (alongI && !alongJ) {
          const a = this.ground(i, j - 1);
          const b = this.ground(i, j + 1);
          if (a === 'sidewalk' && b === 'asphalt') kdj = -1;
          else if (b === 'sidewalk' && a === 'asphalt') kdj = 1;
          else continue;
          dirs = ['se', 'nw'];
        } else if (alongJ && !alongI) {
          const a = this.ground(i - 1, j);
          const b = this.ground(i + 1, j);
          if (a === 'sidewalk' && b === 'asphalt') kdi = -1;
          else if (b === 'sidewalk' && a === 'asphalt') kdi = 1;
          else continue;
          dirs = ['sw', 'ne'];
        } else continue;
        // Keep junction approaches and crowd chokepoints clear.
        let near = false;
        for (let d = -2; d <= 2 && !near; d++) {
          const ii = alongI ? i + d : i;
          const jj = alongJ ? j + d : j;
          if (m.marking[jj * m.w + ii] !== 0 || taken.has(jj * m.w + ii)) near = true;
        }
        if (near) continue;
        if (m.chokepoints.some((c) => Math.abs(c.i - i) + Math.abs(c.j - j) <= c.radius + 2)) continue;
        const nearCap = Math.abs(i - (cap.i + cap.w / 2)) < cap.w / 2 + 7 && Math.abs(j - (cap.j + cap.d / 2)) < cap.d / 2 + 7;
        const list = CITY_CARS[m.city];
        let id = list[h % list.length]!;
        const police = nearCap && h % 3 === 0;
        if (police) id = 'police_van';
        else if (nearCap && h % 7 === 1) id = 'ambulance';
        const dir = dirs[(h >>> 8) & 1]!;
        const name = `veh.${id}.parked.${dir}`;
        if (!art.has(name)) continue;
        taken.add(j * m.w + i);
        const p = tileToWorld(i + 0.5 + kdi * 0.22, j + 0.5 + kdj * 0.22);
        const s = new Sprite(art.tex(name));
        const x = Math.round(p.x);
        const y = Math.round(p.y);
        s.position.set(x, y);
        s.zIndex = depthKey(x, y);
        this.layers.entities.addChild(s);
        let siren: Sprite | null = null;
        if ((id === 'police_van' || id === 'ambulance') && art.has('fx.light.siren.blue')) {
          siren = new Sprite(art.tex('fx.light.siren.blue'));
          siren.blendMode = 'add';
          siren.position.set(x, y - 14);
          siren.visible = false;
          this.layers.lights.addChild(siren);
        }
        this.cars.push({
          id,
          dir,
          x,
          y,
          tile: j * m.w + i,
          wreckAt: police ? 0.25 + ((h >>> 12) % 50) / 100 : 0.08 + ((h >>> 12) % 92) / 100,
          state: 'parked',
          burnUntil: 0,
          sprite: s,
          siren,
          police,
        });
        void nav;
      }
    }
  }

  private placeFlocks(): void {
    const m = this.map;
    for (let j = 2; j < m.h - 2; j++) {
      for (let i = 2; i < m.w - 2; i++) {
        const g = this.ground(i, j);
        if (g !== 'plaza' && g !== 'grass' && g !== 'parkPath') continue;
        if (hash(i, j, 0xb12d) % 1000 >= (g === 'plaza' ? 22 : 9)) continue;
        if (this.flocks.some((f) => Math.abs(f.i - i) + Math.abs(f.j - j) < 6)) continue;
        const n = 3 + (hash(i, j, 7) % 4);
        const birds: Pigeon[] = [];
        for (let k = 0; k < n; k++) {
          const h = hash(i, j, k + 11);
          const p = tileToWorld(i + 0.2 + (h % 60) / 100, j + 0.2 + ((h >>> 8) % 60) / 100);
          const s = new Sprite();
          this.layers.entities.addChild(s);
          birds.push({
            sprite: s,
            x: Math.round(p.x),
            y: Math.round(p.y),
            hx: Math.round(p.x),
            hy: Math.round(p.y),
            flying: false,
            t0: 0,
            vx: 0,
            phase: (h % 100) / 37,
          });
        }
        this.flocks.push({ i, j, birds, gone: -1 });
      }
    }
  }

  // ── Per frame ────────────────────────────────────────────────────────────────────────

  update(now: number, dt: number, view: ViewRect): void {
    const w = this.world;
    // Escalation 0..1 from level and the body count.
    const fallen = totalFallen(w.stats);
    this.escalation = Math.min(1, w.level / 12 + fallen / 4000);
    this.checkT -= dt;
    if (this.checkT <= 0) {
      this.checkT = 0.5;
      this.escalateCars(now);
    }
    this.updateCars(now, view);
    this.updatePigeons(now, dt, view);
    this.updateLitter(dt);
  }

  private escalateCars(now: number): void {
    const w = this.world;
    for (const c of this.cars) {
      // Hide cars where a ground unit stands.
      const blocked = w.unitTile[c.tile]! >= 0 || w.nav.blockade[c.tile]! >= 0;
      c.sprite.visible = !blocked;
      if (c.state !== 'parked' || this.escalation < c.wreckAt) continue;
      const b = baseId(c.id);
      const h = hash(c.tile, 99);
      const want = h % 3 === 0 ? 'flipped' : 'burning';
      if (want === 'burning' && art.has(`veh.${b}.burning.${c.dir}`)) {
        c.state = 'burning';
        c.burnUntil = now + 25 + (h % 20);
        setTex(c.sprite, art.tex(`veh.${b}.burning.${c.dir}`));
      } else if (art.has(`veh.${b}.flipped.${c.dir}`)) {
        c.state = 'flipped';
        setTex(c.sprite, art.tex(`veh.${b}.flipped.${c.dir}`));
      } else if (art.has(`veh.${b}.burnt.${c.dir}`)) {
        c.state = 'burnt';
        setTex(c.sprite, art.tex(`veh.${b}.burnt.${c.dir}`));
      } else continue;
      if (c.siren) c.siren.visible = false;
      this.fx.spawn('fx.glass.shards', c.x, c.y, now, { layer: 'entity', z: 6, priority: 0 });
      this.decals.bake(`fx.glass.ground`, c.x + 6, c.y + 3);
    }
  }

  private updateCars(now: number, view: ViewRect): void {
    for (const c of this.cars) {
      const s = c.sprite;
      const vis = c.x > view.x0 - 40 && c.x < view.x1 + 40 && c.y > view.y0 - 40 && c.y < view.y1 + 60;
      s.renderable = vis;
      if (!vis) {
        if (c.siren) c.siren.visible = false;
        continue;
      }
      s.tint = c.state === 'burning' ? 0xffffff : this.grade;
      const b = baseId(c.id);
      if (c.state === 'burning') {
        if (now > c.burnUntil && art.has(`veh.${b}.burnt.${c.dir}`)) {
          c.state = 'burnt';
          setTex(s, art.tex(`veh.${b}.burnt.${c.dir}`));
        } else {
          const clip = art.anim(`veh.${b}.burning.${c.dir}`);
          setTex(s, clip.frames[clip.frameAt(now + c.tile * 0.1)]!);
          if (this.darkness > 0.05 && (Math.floor(now * 8) + c.tile) % 9 === 0) {
            this.fx.spawn('fx.light.fire', c.x, c.y, now, { layer: 'light', life: 0.4, alpha: 0.6, priority: 0 });
          }
        }
      } else if (c.state === 'parked' && (c.id === 'police_van' || c.id === 'ambulance' || c.id === 'fire_truck')) {
        const clip = art.anim(`veh.${c.id}.parked.${c.dir}`);
        setTex(s, clip.frames[clip.frameAt(now)]!);
        if (c.siren) {
          const on = this.darkness > 0.05;
          c.siren.visible = on;
          if (on) {
            const red = Math.floor(now * 4 + c.tile) % 2 === 0;
            const clipL = art.anim(red ? 'fx.light.siren.red' : 'fx.light.siren.blue');
            setTex(c.siren, clipL.frames[clipL.frameAt(now)]!);
            c.siren.alpha = this.darkness;
          }
        }
      }
    }
  }

  private updatePigeons(now: number, dt: number, view: ViewRect): void {
    const w = this.world;
    const idle = art.has('prop.pigeon.idle') ? art.anim('prop.pigeon.idle') : null;
    const peck = art.has('prop.pigeon.peck') ? art.anim('prop.pigeon.peck') : null;
    const fly = art.has('prop.pigeon.fly') ? art.anim('prop.pigeon.fly') : null;
    if (!idle || !peck || !fly) return;
    for (const f of this.flocks) {
      // Crowd near? Scatter.
      let crowd = 0;
      for (let dj = -2; dj <= 2; dj++)
        for (let di = -2; di <= 2; di++) crowd += w.hash.cellCount(f.i + di, f.j + dj);
      if (crowd > 0 && f.gone < 0) {
        f.gone = now;
        for (const b of f.birds) {
          b.flying = true;
          b.t0 = now + b.phase * 0.05;
          b.vx = (b.phase > 1.3 ? 1 : -1) * (30 + b.phase * 8);
        }
      } else if (f.gone >= 0 && crowd === 0 && now - f.gone > 25) {
        f.gone = -1;
        for (const b of f.birds) {
          b.flying = false;
          b.x = b.hx;
          b.y = b.hy;
        }
      }
      for (const b of f.birds) {
        const s = b.sprite;
        const vis = b.hx > view.x0 - 20 && b.hx < view.x1 + 20 && b.hy > view.y0 - 200 && b.hy < view.y1 + 20;
        if (!vis) {
          s.visible = false;
          continue;
        }
        if (b.flying) {
          const age = now - b.t0;
          if (age > 4) {
            s.visible = false;
            continue;
          }
          s.visible = age >= 0;
          const x = Math.round(b.hx + b.vx * Math.max(0, age));
          const lift = Math.round(Math.max(0, age) * (28 + b.phase * 6) + Math.max(0, age) ** 2 * 6);
          setTex(s, fly.frames[fly.frameAt(now + b.phase)]!);
          s.position.set(x, b.hy - lift);
          s.scale.x = b.vx < 0 ? -1 : 1;
          s.zIndex = depthKey(x, b.hy) + 1e7;
          s.tint = this.grade;
        } else {
          s.visible = true;
          const clip = Math.floor(now / 2 + b.phase) % 3 === 0 ? peck : idle;
          setTex(s, clip.frames[clip.frameAt(now + b.phase)]!);
          s.position.set(b.x, b.y);
          s.scale.x = b.phase > 1.3 ? -1 : 1;
          s.zIndex = depthKey(b.x, b.y);
          s.tint = this.grade;
        }
      }
    }
    void dt;
  }

  private updateLitter(dt: number): void {
    const w = this.world;
    this.litterT -= dt;
    if (this.litterT > 0 || this.litterCount > 900) return;
    this.litterT = 1.5;
    const c = w.crowd;
    if (c.count < 20) return;
    const n = Math.min(6, Math.floor(c.count / 150) + 1);
    for (let k = 0; k < n; k++) {
      const s = (w.tick * 7919 + k * 104729) % Math.max(1, c.hi);
      if (!c.alive[s]) continue;
      const p = tileToWorld(c.x[s]!, c.y[s]!);
      const h = hash(s, w.tick, k);
      const kind = h % 5 === 0 ? `decal.leaflets.${h % 2}` : `decal.litter.${h % 3}`;
      this.decals.bake(kind, p.x, p.y + 2);
      this.litterCount++;
    }
  }
}
