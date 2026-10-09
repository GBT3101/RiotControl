/**
 * Fallen bodies, driven by the sim's body ring (so a time-skip restores them too):
 * fresh deaths play their death animation first (protesters: `die` → `body` when lethal,
 * `ko` → `kobody` + KO stars otherwise; units: `death` → `body`; the mounted officer's horse
 * bolts off the map; snipers thrown off a roof are grabbed, flail along a parabola, hit the
 * street and splat). Bodies stay while the sim keeps them (20–40 s, shortened by trampling —
 * dust puffs), then fade. Above the live cap the oldest are baked into the decal texture.
 * Destroyed Humvees/tanks leave burning wrecks.
 */
import { Sprite, type Container } from 'pixi.js';
import type { AnimClip } from '../art/lib/atlas';
import { tileToWorld, depthKey } from '../core/iso';
import { UNIT_IDS } from '../data/units';
import { BODY_KIND } from '../sim/bodies';
import type { World } from '../sim/world';
import type { DecalLayer } from './decalLayer';
import type { FxSystem } from './fx';
import type { ViewLayers } from './layers';
import { PA, type VariantTable } from './protesterView';
import { setTex } from './sprites';
import type { ViewRect } from './terrainView';
import { clipOf, FACING4, UNIT_ART } from './unitView';

export interface ThrowInfo {
  /** Roof point (world px) and height above ground. */
  fromX: number;
  fromY: number;
  top: number;
  member: number;
  art: string;
}

interface Note {
  fresh: boolean;
  vi: number;
  thrown?: ThrowInfo;
  lethal: boolean;
}

class BodyEnt {
  sprite!: Sprite;
  id = 0;
  slot = 0;
  x = 0;
  y = 0;
  born = 0;
  death: AnimClip | null = null;
  rest: AnimClip | null = null;
  restFrame = 0;
  flip = false;
  fading = -1;
  wreck = false;
  thrown: ThrowInfo | null = null;
  trample = 0;
  baked = false;
}

const THROW_GRAB = 0.45;
const THROW_FLY = 0.75;

export class BodyView {
  private readonly ents: BodyEnt[] = [];
  private readonly known: Uint32Array;
  private readonly notes = new Map<number, Note>();
  private readonly free: Sprite[] = [];
  cap: number;
  grade = 0xffffff;

  constructor(
    private readonly world: World,
    private readonly layers: ViewLayers,
    private readonly variants: VariantTable,
    private readonly fx: FxSystem,
    private readonly decals: DecalLayer,
    cap = 500,
  ) {
    this.known = new Uint32Array(world.bodies.capacity);
    this.cap = cap;
  }

  get count(): number {
    return this.ents.length;
  }

  /** A death happened this frame (from the event stream). */
  note(bodyId: number, n: Note): void {
    this.notes.set(bodyId, n);
  }

  private take(layer: Container): Sprite {
    const s = this.free.pop() ?? new Sprite();
    layer.addChild(s);
    s.visible = true;
    s.alpha = 1;
    s.tint = 0xffffff;
    return s;
  }

  private create(k: number, now: number): void {
    const b = this.world.bodies;
    const id = b.id[k]!;
    const note = this.notes.get(id);
    this.notes.delete(id);
    const e = new BodyEnt();
    e.id = id;
    e.slot = k;
    const p = tileToWorld(b.x[k]!, b.y[k]!);
    e.x = Math.round(p.x);
    e.y = Math.round(p.y);
    e.born = note?.fresh ? now : now - 100;
    e.trample = b.trample[k]!;
    const facing = b.facing[k]! & 3;
    if (b.kind[k] === BODY_KIND.PROTESTER) {
      const vi = note && note.vi >= 0 ? note.vi : this.variants.pick(b.type[k]!, b.variant[k]!, 0);
      if (vi < 0) return;
      const lethal = b.lethal[k] === 1;
      const d = this.variants.get(vi, lethal ? PA.die : PA.ko, facing);
      const r = this.variants.get(vi, lethal ? PA.body : PA.kobody, facing);
      if (!r) return;
      e.death = d?.clip ?? null;
      e.rest = r.clip;
      e.restFrame = r.clip.frames.length - 1;
      e.flip = r.flip;
    } else {
      const unit = UNIT_IDS[b.type[k]!] ?? 'riot';
      const f = FACING4[facing]!;
      if (unit === 'humvee' || unit === 'tank') {
        const w = clipOf(`veh.${unit}.wreck.${f}`);
        if (!w) return;
        e.wreck = true;
        e.rest = w;
        e.restFrame = -1;
      } else if (unit === 'blockade' || unit === 'heli') {
        return;
      } else {
        const art = UNIT_ART[unit];
        if (note?.thrown) {
          e.thrown = note.thrown;
          e.death = null;
          e.rest = clipOf(`unit.${note.thrown.art}.splat.${f === 'ne' ? 'se' : f === 'nw' ? 'sw' : f}`);
          if (!e.rest) e.rest = clipOf(`unit.${art}.body.${f}`);
        } else {
          e.death = note?.fresh ? clipOf(`unit.${art}.death.${f}`) : null;
          e.rest = clipOf(`unit.${art}.body.${f}`);
          if (unit === 'mounted' && note?.fresh) this.horseFlees(e.x, e.y, f, now);
        }
        if (!e.rest) return;
        e.restFrame = e.rest.frames.length - 1;
      }
    }
    e.sprite = this.take(e.wreck ? this.layers.entities : e.thrown ? this.layers.air : this.layers.bodies);
    if (e.wreck) e.sprite.zIndex = depthKey(e.x, e.y);
    this.ents.push(e);
    if (note?.fresh && b.kind[k] === BODY_KIND.PROTESTER) {
      if (b.lethal[k] === 1) this.blood(e.x, e.y, now, id);
      else
        this.fx.spawn(id % 3 === 0 ? 'fx.ko.birds' : 'fx.ko.stars', e.x, e.y, now, {
          layer: 'entity',
          z: 14,
          loop: true,
          life: 2.5 + (id % 5) * 0.3,
          offset: 0.6,
          fade: 0.5,
          depth: depthKey(e.x, e.y) + 1,
          priority: 0,
        });
    }
  }

  private blood(x: number, y: number, now: number, id: number): void {
    this.fx.spawn(id & 1 ? 'fx.blood.puff.a' : 'fx.blood.puff.b', x, y, now, {
      layer: 'entity',
      z: 8,
      depth: depthKey(x, y) + 2,
      priority: 0,
    });
    this.decals.bake(`fx.blood.splat.${'abcde'[id % 5]}`, x + ((id >> 3) % 5) - 2, y + 1);
  }

  private horseFlees(x: number, y: number, f: string, now: number): void {
    const dir = f === 'se' ? [1, 0.5] : f === 'sw' ? [-1, 0.5] : f === 'ne' ? [1, -0.5] : [-1, -0.5];
    this.fx.spawn(`unit.horse.flee.${f}`, x, y, now, {
      layer: 'entity',
      loop: true,
      life: 3.5,
      vx: dir[0]! * 70,
      vy: dir[1]! * 70,
      offset: 0,
      fade: 0.8,
    });
  }

  update(now: number, view: ViewRect): void {
    const b = this.world.bodies;
    const cap = b.capacity;
    for (let k = 0; k < cap; k++) {
      if (b.alive[k] && this.known[k] !== b.id[k]) {
        this.known[k] = b.id[k]!;
        this.create(k, now);
      }
    }
    this.notes.clear();
    const list = this.ents;
    let live = 0;
    for (let n = list.length - 1; n >= 0; n--) {
      const e = list[n]!;
      const s = e.sprite;
      const simAlive = b.alive[e.slot] === 1 && b.id[e.slot] === e.id;
      if (!simAlive && e.fading < 0) e.fading = now;
      if (e.fading >= 0) {
        const a = 1 - (now - e.fading) / (e.wreck ? 3 : 1.2);
        if (a <= 0) {
          this.remove(n);
          continue;
        }
        s.alpha = a;
      }
      live++;
      const age = now - e.born;
      let x = e.x;
      let y = e.y;
      let lift = 0;
      if (e.thrown) {
        const th = e.thrown;
        const grab = clipOf(`unit.${th.art}.grabbed.se`);
        const flail = clipOf(`unit.${th.art}.flail.se`);
        const imp = clipOf(`unit.${th.art}.impact.se`);
        if (age < THROW_GRAB && grab) {
          setTex(s, grab.frames[grab.frameAt(age)]!);
          x = th.fromX;
          y = th.fromY;
          lift = th.top;
          s.zIndex = depthKey(x, y) + 1e6;
        } else if (age < THROW_GRAB + THROW_FLY && flail) {
          const f = (age - THROW_GRAB) / THROW_FLY;
          x = Math.round(th.fromX + (e.x - th.fromX) * f);
          y = Math.round(th.fromY + (e.y - th.fromY) * f);
          // Parabola: up a little, then down to the street.
          lift = Math.round(th.top * (1 - f) + 28 * 4 * f * (1 - f));
          setTex(s, flail.frames[flail.frameAt(age)]!);
          s.zIndex = depthKey(x, y) + 1e6;
          if (f > 0.9 && e.sprite.parent === this.layers.air && imp) {
            // about to land
          }
        } else {
          if (e.sprite.parent !== this.layers.bodies) {
            this.layers.bodies.addChild(s);
            this.fx.spawn('fx.dust.land', e.x, e.y, now, { layer: 'entity' });
          }
          const ia = age - THROW_GRAB - THROW_FLY;
          if (imp && ia < imp.duration) setTex(s, imp.frames[Math.min(imp.frames.length - 1, Math.floor(ia * imp.fps))]!);
          else if (e.rest) setTex(s, e.rest.frames[e.restFrame]!);
          e.thrown = null;
          e.born = now - 100;
        }
        s.tint = this.grade;
      } else if (e.wreck) {
        setTex(s, e.rest!.frames[e.rest!.frameAt(now)]!);
        s.tint = this.grade;
      } else if (e.death && age < e.death.duration) {
        setTex(s, e.death.frames[Math.min(e.death.frames.length - 1, Math.floor(age * e.death.fps))]!);
      } else if (e.rest) {
        setTex(s, e.rest.frames[e.restFrame]!);
      }
      s.position.set(e.flip ? x + 1 : x, y - lift);
      s.scale.x = e.flip ? -1 : 1;
      s.visible = x > view.x0 - 40 && x < view.x1 + 40 && y - lift > view.y0 - 40 && y < view.y1 + 40;
      // Trampling crowds kick up dust.
      if (b.trample[e.slot]! !== e.trample && simAlive) {
        if (s.visible && (e.id + b.trample[e.slot]!) % 3 === 0) {
          this.fx.spawn('fx.dust.trample', x, y, now, { layer: 'ground', priority: 0 });
        }
        e.trample = b.trample[e.slot]!;
      }
    }
    // Over the cap: bake the oldest (non-wreck, settled) bodies into the decal texture.
    if (live > this.cap) {
      let excess = live - this.cap;
      for (let n = 0; n < list.length && excess > 0; ) {
        const e = list[n]!;
        if (!e.wreck && !e.thrown && e.rest && now - e.born > 2) {
          this.decals.bake(e.rest.frames[e.restFrame]!, e.x, e.y, { flip: e.flip, alpha: 0.75 });
          this.remove(n);
          excess--;
        } else n++;
      }
    }
  }

  private remove(n: number): void {
    const e = this.ents[n]!;
    e.sprite.removeFromParent();
    e.sprite.visible = false;
    this.free.push(e.sprite);
    this.ents.splice(n, 1);
  }
}
