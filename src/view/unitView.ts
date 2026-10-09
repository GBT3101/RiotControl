/**
 * Ministry units: riot police & co. (animation state machines), rooftop shooters standing on
 * their building's roof (brigade = three snipers), blockade runs, and vehicles — Humvee (hull
 * dir from movement, turret from aim, fire loop), tank (16-way turret, tread dust, recoil
 * shot), helicopter (altitude + bob, rotor layer, ground shadow, downwash, night searchlight).
 *
 * Attack animations are re-started from the sim's `lastAttack` so the impact frame lands on
 * the damage tick; hits flash white; idles break into fidgets. Units behind buildings get a
 * blue x-ray silhouette.
 */
import { Sprite, type Container } from 'pixi.js';
import { art, type AnimClip } from '../art/lib/atlas';
import { BRIGADE_SQUAD_OFFSETS, unitAnimCatalog } from '../art/units';
import { facing16, type Dir16, type Dir8 } from '../art/vehicles/dirs';
import {
  HELI_ALT,
  heliHubOffset,
  heliMuzzle,
  humveeMuzzle,
  humveeTurretOffset,
  tankMuzzle,
  tankTurretOffset,
} from '../art/vehicles/meta';
import { depthKey, HALF_TH, HALF_TW, tileToWorld } from '../core/iso';
import type { UnitId } from '../data/units';
import { US, type Unit } from '../sim/units';
import type { World } from '../sim/world';
import { pieceDepthKey } from './depth';
import type { ViewLayers } from './layers';
import { GhostGate, GhostMarkers, silhouetteOf } from './silhouette';
import { setTex } from './sprites';
import type { RoofInfo } from './staticView';
import type { ViewRect } from './terrainView';

/** Sim unit id → art id (M4a names differ for two units). */
export const UNIT_ART: Readonly<Record<UnitId, string>> = {
  riot: 'riot',
  sniper: 'sniper',
  blockade: 'blockade',
  gas: 'gas',
  mounted: 'horse',
  armed: 'cop',
  soldier: 'soldier',
  humvee: 'humvee',
  brigade: 'brigade',
  tank: 'tank',
  heli: 'heli',
};

export const FACING4 = ['se', 'sw', 'ne', 'nw'] as const;
/** Sim dir8 (0 E, 1 SE, 2 S …) → vehicle art direction name. */
export const DIR8_NAMES: readonly Dir8[] = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];

const clipCache = new Map<string, AnimClip | null>();
export function clipOf(name: string): AnimClip | null {
  let c = clipCache.get(name);
  if (c === undefined) {
    c = art.has(name) ? art.anim(name) : null;
    if (c) clipCache.set(name, c);
  }
  return c ?? null;
}
/** Forget cached misses (after deferred art arrives). */
export function resetClipCache(): void {
  clipCache.clear();
}

function frameOnce(clip: AnimClip, t: number): number {
  const f = Math.floor(t * clip.fps);
  return f < 0 ? 0 : f >= clip.frames.length ? clip.frames.length - 1 : f;
}

class UnitEnt {
  sprites: Sprite[] = [];
  ghost: Sprite | null = null;
  deployT = -99;
  atkSeen = -1;
  atkStart = -99;
  hurtSeen = -1;
  hurtT = -99;
  throwT = -99;
  nextFidget = 0;
  fidgetT = -99;
  fidget = 'fidget';
  /** World px (for picking / rings). */
  x = 0;
  y = 0;
  /** Height of the drawn body above the ground point (roof / air). */
  lift = 0;
  /** Sort key of the body (rooftop units: just in front of their building). */
  key = 0;
  /** Vehicles */
  lastDir = 1;
  dirChangeT = -99;
  gasPuffT = 0;
  /** Blockade tiles / axis (for the destruction burst). */
  tiles: number[] = [];
  axis: 'i' | 'j' = 'i';
  constructor(
    readonly id: number,
    readonly type: UnitId,
  ) {}
}

/** Ally x-ray silhouettes drawn per frame (people fully hidden behind buildings). */
const MAX_ALLY_GHOSTS = 8;

export class UnitView {
  private readonly ents = new Map<number, UnitEnt>();
  /** M13a: which hidden allies get a ghost (selected / engaged / near the focus, de-stacked). */
  private readonly gate = new GhostGate({ max: MAX_ALLY_GHOSTS });
  private readonly markers: GhostMarkers;
  /** Selected unit id (set by the world view each frame; -1 = none). */
  selected = -1;
  private readonly seen = new Set<number>();
  grade = 0xffffff;
  darkness = 0;
  /** Gas spray puff callback (combat FX spawns them). */
  onGasPuff: ((u: Unit, x: number, y: number) => void) | null = null;
  /** A blockade was destroyed (its tiles and art axis). */
  onBlockadeGone: ((tiles: readonly number[], axis: 'i' | 'j') => void) | null = null;

  constructor(
    private readonly world: World,
    private readonly layers: ViewLayers,
    private readonly roof: (b: number) => RoofInfo | undefined,
    private readonly occluded: (x: number, y: number) => boolean,
  ) {
    this.markers = new GhostMarkers(layers.ghostsAlly);
  }

  onDeployed(id: number, now: number): void {
    const e = this.ents.get(id) ?? this.create(id);
    if (e) e.deployT = now;
  }

  onAbilityUsed(id: number, now: number): void {
    const e = this.ents.get(id);
    if (e) e.throwT = now;
  }

  entity(id: number): { x: number; y: number; lift: number; key: number } | undefined {
    return this.ents.get(id);
  }

  private create(id: number): UnitEnt | null {
    const u = this.world.units.get(id);
    if (!u) return null;
    const e = new UnitEnt(id, u.type);
    e.nextFidget = 3 + (id % 7);
    this.ents.set(id, e);
    return e;
  }

  private sprite(e: UnitEnt, k: number, layer: Container): Sprite {
    let s = e.sprites[k];
    if (!s) {
      s = new Sprite();
      layer.addChild(s);
      e.sprites[k] = s;
    } else if (s.parent !== layer) layer.addChild(s);
    s.visible = true;
    return s;
  }

  private destroyEnt(e: UnitEnt): void {
    if (e.type === 'blockade' && e.tiles.length > 0) this.onBlockadeGone?.(e.tiles, e.axis);
    for (const s of e.sprites) s.destroy();
    e.ghost?.destroy();
    this.ents.delete(e.id);
  }

  /** World point of a unit's muzzle (for tracers); falls back to its body. */
  muzzle(id: number, out: { x: number; y: number }): boolean {
    const e = this.ents.get(id);
    const u = this.world.units.get(id);
    if (!e || !u) return false;
    out.x = e.x;
    out.y = e.y - e.lift;
    const f = FACING4[u.facing]!;
    if (u.type === 'humvee') {
      const d = DIR8_NAMES[u.dir8]!;
      const t = humveeTurretOffset(d, 0);
      const m = humveeMuzzle(DIR8_NAMES[u.aim8]!);
      out.x += t.x + m.x;
      out.y += t.y + m.y;
      return true;
    }
    if (u.type === 'tank') {
      const t = tankTurretOffset(DIR8_NAMES[u.dir8]!);
      const m = tankMuzzle(facing16(u.aimX, u.aimY) as Dir16, 0);
      out.x += t.x + m.x;
      out.y += t.y + m.y;
      return true;
    }
    if (u.type === 'heli') {
      const m = heliMuzzle('hover', DIR8_NAMES[u.aim8]!);
      out.x += m.x;
      out.y += m.y;
      return true;
    }
    const art = UNIT_ART[u.type];
    const meta = unitAnimCatalog().get(`unit.${art}.attack.${f}`);
    if (meta && meta.impactFrame !== null) {
      const p = meta.muzzle[meta.impactFrame] ?? meta.muzzle.find((m) => m) ?? null;
      if (p) {
        out.x += p.x - meta.anchor.x;
        out.y += p.y - meta.anchor.y;
        return true;
      }
    }
    out.y -= 12;
    return true;
  }

  /** Nearest unit whose drawn body covers world point (x, y), or -1. */
  pick(x: number, y: number): number {
    let best = -1;
    let bd = Infinity;
    for (const e of this.ents.values()) {
      const big = e.type === 'humvee' || e.type === 'tank' || e.type === 'heli';
      const cy = e.y - e.lift - (big ? 10 : 9);
      const dx = x - e.x;
      const dy = y - cy;
      const rx = big ? 22 : 10;
      const ry = big ? 16 : 13;
      if (Math.abs(dx) > rx || Math.abs(dy) > ry) continue;
      const d = dx * dx + dy * dy * 1.5;
      if (d < bd) {
        bd = d;
        best = e.id;
      }
    }
    return best;
  }

  update(now: number, alpha: number, view: ViewRect): void {
    const list = this.world.units.active;
    this.seen.clear();
    this.gate.begin((view.x0 + view.x1) / 2, (view.y0 + view.y1) / 2);
    for (let k = 0; k < list.length; k++) {
      const u = list[k]!;
      if (!u.alive) continue;
      this.seen.add(u.id);
      const e = this.ents.get(u.id) ?? this.create(u.id)!;
      const ux = u.px + (u.x - u.px) * alpha;
      const uy = u.py + (u.y - u.py) * alpha;
      e.x = Math.round((ux - uy) * HALF_TW);
      e.y = Math.round((ux + uy) * HALF_TH);
      const vis =
        e.x > view.x0 - 60 && e.x < view.x1 + 60 && e.y > view.y0 - 20 && e.y < view.y1 + 120;
      if (!vis && u.type !== 'heli') {
        for (const s of e.sprites) s.visible = false;
        if (e.ghost) e.ghost.visible = false;
        continue;
      }
      // Track attack / hurt timestamps.
      if (u.lastAttack !== e.atkSeen) {
        e.atkSeen = u.lastAttack;
        e.atkStart = u.lastAttack;
      }
      if (u.lastHurt !== e.hurtSeen) {
        e.hurtSeen = u.lastHurt;
        // Flash at most every ~1.2 s (units in constant melee would strobe white).
        if (now - e.hurtT > 1.2) e.hurtT = now;
      }
      switch (u.type) {
        case 'blockade':
          this.drawBlockade(u, e, now);
          break;
        case 'humvee':
          this.drawHumvee(u, e, now);
          break;
        case 'tank':
          this.drawTank(u, e, now);
          break;
        case 'heli':
          this.drawHeli(u, e, now);
          break;
        default:
          this.drawHuman(u, e, now);
      }
    }
    // Deleting the current entry while iterating a Map is safe (no per-frame array copy).
    for (const e of this.ents.values()) if (!this.seen.has(e.id)) this.destroyEnt(e);
    this.markers.draw(this.gate.groups(), now);
  }

  // ── People ───────────────────────────────────────────────────────────────────────────

  private humanAnim(
    u: Unit,
    e: UnitEnt,
    now: number,
    base: string,
    f: string,
  ): [AnimClip, number] | null {
    const get = (a: string): AnimClip | null => clipOf(`${base}.${a}.${f}`);
    // Deploy-in.
    const dep = get('deploy');
    if (dep && now - e.deployT < dep.duration) return [dep, frameOnce(dep, now - e.deployT)];
    // Grenade throw.
    const thr = get('throw');
    if (thr && now - e.throwT < thr.duration) return [thr, frameOnce(thr, now - e.throwT)];
    // Hit flash.
    const hit = get('hit');
    if (hit && now - e.hurtT < 0.17 && u.def.placement !== 'rooftop') {
      return [hit, frameOnce(hit, now - e.hurtT)];
    }
    if (u.moving || u.state === US.MOVING) {
      const walk = get(u.type === 'mounted' ? 'run' : 'walk');
      if (walk) return [walk, walk.frameAt(now + (u.id % 5) * 0.11)];
    }
    const atk = get('attack');
    if (atk) {
      if (u.type === 'gas' && u.state === US.ATTACKING) return [atk, atk.frameAt(now)];
      const meta = unitAnimCatalog().get(`${base}.attack.${f}`);
      const impact = meta?.impactFrame ?? 1;
      const t = now - (e.atkStart - impact / atk.fps);
      if (t >= 0 && t < atk.duration && u.type !== 'gas') return [atk, frameOnce(atk, t)];
    }
    if (u.state === US.ATTACKING) {
      const crouch = get('crouch');
      if (crouch) return [crouch, crouch.frameAt(now)];
      const aim = get('aim');
      if (aim) return [aim, aim.frames.length - 1];
    }
    if (u.abilityReady) {
      const ch = get('charged');
      if (ch) return [ch, ch.frameAt(now)];
    }
    // Idle with the odd fidget.
    if (now >= e.nextFidget && e.fidgetT < now - 10) {
      e.fidgetT = now;
      e.fidget = u.type === 'riot' && (u.id + Math.floor(now)) % 2 === 0 ? 'fidget2' : 'fidget';
      e.nextFidget = now + 5 + ((u.id * 7919 + Math.floor(now * 3)) % 60) / 10;
    }
    const fid = get(e.fidget);
    if (fid && now - e.fidgetT < fid.duration) return [fid, frameOnce(fid, now - e.fidgetT)];
    const idle = get('idle');
    return idle ? [idle, idle.frameAt(now + (u.id % 7) * 0.17)] : null;
  }

  private drawHuman(u: Unit, e: UnitEnt, now: number): void {
    const base = `unit.${UNIT_ART[u.type]}`;
    const f = FACING4[u.facing]!;
    const r = this.humanAnim(u, e, now, base, f);
    if (!r) return;
    const [clip, fi] = r;
    let x = e.x;
    let y = e.y;
    let key = depthKey(x, y);
    e.lift = 0;
    if (u.building >= 0) {
      const roof = this.roof(u.building);
      if (roof) {
        x = roof.x;
        y = roof.y;
        e.x = x;
        e.y = y;
        e.lift = roof.top;
        key = roof.frontKey + 2;
      }
    }
    e.key = key;
    const n = u.type === 'brigade' ? Math.max(1, u.members) : 1;
    const mirror = f === 'sw' || f === 'nw' ? -1 : 1;
    for (let k = 0; k < 3; k++) {
      if (k >= n) {
        if (e.sprites[k]) e.sprites[k]!.visible = false;
        continue;
      }
      const s = this.sprite(e, k, this.layers.entities);
      const off = n > 1 ? BRIGADE_SQUAD_OFFSETS[k]! : { x: 0, y: 0 };
      // De-sync the squad.
      const fk = n > 1 ? (fi + k) % clip.frames.length : fi;
      setTex(s, clip.frames[clip.loop ? fk : fi]!);
      s.position.set(x + off.x * mirror, y - e.lift + off.y);
      s.zIndex = key + k;
      s.tint = this.grade;
    }
    // Gas spray drift puffs.
    if (u.type === 'gas' && u.state === US.ATTACKING && now - e.gasPuffT > 0.22) {
      e.gasPuffT = now;
      this.onGasPuff?.(u, x, y);
    }
    const engaged = u.state === US.ATTACKING || now - e.atkStart < 2.5 || now - e.hurtT < 2.5;
    this.updateGhost(e, e.sprites[0]!, e.lift === 0, u.id === this.selected, engaged);
  }

  private updateGhost(
    e: UnitEnt,
    main: Sprite,
    ground: boolean,
    selected: boolean,
    engaged: boolean,
  ): void {
    const occ =
      ground &&
      this.occluded(e.x, e.y) &&
      this.gate.allow(e.x, e.y, selected, engaged, main.texture.height - 2);
    if (!occ) {
      if (e.ghost) e.ghost.visible = false;
      return;
    }
    if (!e.ghost) {
      e.ghost = new Sprite();
      this.layers.ghostsAlly.addChild(e.ghost);
    }
    const g = e.ghost;
    const sil = silhouetteOf(main.texture);
    g.visible = sil !== null;
    if (!sil) return;
    setTex(g, sil);
    g.position.copyFrom(main.position);
    g.scale.x = main.scale.x;
  }

  // ── Blockade ─────────────────────────────────────────────────────────────────────────

  private drawBlockade(u: Unit, e: UnitEnt, now: number): void {
    const mw = this.world.map.w;
    const tiles = u.tiles;
    if (tiles.length === 0) return;
    const i0 = tiles[0]! % mw;
    const i1 = tiles[tiles.length - 1]! % mw;
    const axis = i0 !== i1 ? 'i' : 'j';
    const n = tiles.length;
    e.tiles = tiles;
    e.axis = axis;
    const dep = clipOf(`unit.blockade.deploy.${axis}`);
    const deploying = dep && now - e.deployT < dep.duration;
    const state = u.damageState;
    for (let k = 0; k < n; k++) {
      const t = tiles[k]!;
      const ti = t % mw;
      const tj = (t - ti) / mw;
      const piece = n === 1 ? 'single' : k === 0 ? 'end0' : k === n - 1 ? 'end1' : 'mid';
      const s = this.sprite(e, k, this.layers.entities);
      if (deploying && dep) setTex(s, dep.frames[frameOnce(dep, now - e.deployT)]!);
      else {
        const c = clipOf(`unit.blockade.${piece}.${axis}`);
        if (c) setTex(s, c.frames[Math.min(state, c.frames.length - 1)]!);
      }
      const p = tileToWorld(ti, tj);
      s.position.set(p.x, p.y);
      s.zIndex = pieceDepthKey(ti, tj, 1);
      s.tint = this.grade;
    }
    for (let k = n; k < e.sprites.length; k++) e.sprites[k]!.visible = false;
  }

  // ── Vehicles ─────────────────────────────────────────────────────────────────────────

  private hullState(u: Unit): string {
    const f = u.hp / u.maxHp;
    return f > 0.66 ? 'drive' : f > 0.33 ? 'drive.dmg1' : 'drive.dmg2';
  }

  private drawHumvee(u: Unit, e: UnitEnt, now: number): void {
    const d = DIR8_NAMES[u.dir8]!;
    const hull = clipOf(`veh.humvee.${this.hullState(u)}.${d}`);
    if (!hull) return;
    const moving = u.moving;
    const fi = moving ? hull.frameAt(now) : 0;
    const key = depthKey(e.x, e.y);
    const hs = this.sprite(e, 0, this.layers.entities);
    setTex(hs, hull.frames[fi]!);
    hs.position.set(e.x, e.y);
    hs.zIndex = key;
    hs.tint = this.grade;
    const td = DIR8_NAMES[u.aim8]!;
    const firing = u.state === US.ATTACKING && now - e.atkStart < 0.2;
    const dmg = u.hp / u.maxHp <= 0.33;
    const tc = clipOf(
      firing ? `veh.humvee.turret.fire.${td}` : `veh.humvee.turret${dmg ? '.dmg' : ''}.${td}`,
    );
    const ts = this.sprite(e, 1, this.layers.entities);
    if (tc) setTex(ts, tc.frames[firing ? tc.frameAt(now) : 0]!);
    const off = humveeTurretOffset(d, fi);
    ts.position.set(e.x + off.x, e.y + off.y);
    ts.zIndex = key + 1;
    ts.tint = this.grade;
    e.lift = 0;
    // Vehicles get no silhouette (big boxy outlines clutter the view more than they tell).
  }

  private drawTank(u: Unit, e: UnitEnt, now: number): void {
    const d = DIR8_NAMES[u.dir8]!;
    const hull = clipOf(`veh.tank.${this.hullState(u)}.${d}`);
    if (!hull) return;
    const fi = u.moving ? hull.frameAt(now) : 0;
    const key = depthKey(e.x, e.y);
    const hs = this.sprite(e, 0, this.layers.entities);
    setTex(hs, hull.frames[fi]!);
    hs.position.set(e.x, e.y);
    hs.zIndex = key;
    hs.tint = this.grade;
    // Tread dust: behind the tank (under the hull facing the camera, over it facing away).
    const dust = this.sprite(e, 2, this.layers.entities);
    const dc = clipOf(`veh.tank.dust.${d}`);
    if (u.moving && dc) {
      setTex(dust, dc.frames[dc.frameAt(now)]!);
      dust.position.set(e.x, e.y);
      dust.zIndex = d === 'se' || d === 's' || d === 'sw' ? key - 1 : key + 2;
      dust.tint = this.grade;
    } else dust.visible = false;
    const t16 = facing16(u.aimX, u.aimY) as Dir16;
    const fireAge = now - e.atkStart;
    const fire = clipOf(`veh.tank.turret.fire.${t16}`);
    const dmg = u.hp / u.maxHp <= 0.33;
    const ts = this.sprite(e, 1, this.layers.entities);
    if (fire && fireAge >= 0 && fireAge < fire.duration)
      setTex(ts, fire.frames[frameOnce(fire, fireAge)]!);
    else {
      const tc = clipOf(`veh.tank.turret${dmg ? '.dmg' : ''}.${t16}`);
      if (tc) setTex(ts, tc.frames[0]!);
    }
    const off = tankTurretOffset(d);
    ts.position.set(e.x + off.x, e.y + off.y);
    ts.zIndex = key + 1;
    ts.tint = this.grade;
    e.lift = 0;
    // Vehicles get no silhouette (big boxy outlines clutter the view more than they tell).
  }

  private drawHeli(u: Unit, e: UnitEnt, now: number): void {
    const d = DIR8_NAMES[u.moving ? u.dir8 : u.aim8]!;
    if (u.dir8 !== e.lastDir) {
      e.lastDir = u.dir8;
      e.dirChangeT = now;
    }
    const firing = u.state === US.ATTACKING && now - e.atkStart < 0.25;
    const pose = u.moving ? 'fly' : 'hover';
    const bodyName = firing && !u.moving ? `veh.heli.fire.${d}` : `veh.heli.${pose}.${d}`;
    const body = clipOf(bodyName);
    if (!body) return;
    const bob = Math.round(Math.sin(now * 5.2 + u.id) * 1);
    const alt = HELI_ALT + bob;
    e.lift = alt;
    // Ground: shadow + downwash (bodies layer = ground level, graded).
    const sh = this.sprite(e, 0, this.layers.bodies);
    const shc = clipOf(`veh.heli.shadow.${d}`);
    if (shc) setTex(sh, shc.frames[0]!);
    sh.position.set(e.x, e.y);
    const dw = this.sprite(e, 1, this.layers.bodies);
    const dwc = clipOf('veh.heli.downwash');
    if (dwc) setTex(dw, dwc.frames[dwc.frameAt(now)]!);
    dw.position.set(e.x, e.y);
    // Body + rotor in the air.
    const bs = this.sprite(e, 2, this.layers.air);
    setTex(bs, body.frames[body.frameAt(now)]!);
    bs.position.set(e.x, e.y - alt);
    bs.zIndex = depthKey(e.x, e.y);
    bs.tint = this.grade;
    const rot = clipOf('veh.heli.rotor');
    const rs = this.sprite(e, 3, this.layers.air);
    if (rot) setTex(rs, rot.frames[rot.frameAt(now)]!);
    const hub = heliHubOffset(pose, d);
    rs.position.set(e.x + hub.x, e.y - alt + hub.y);
    rs.zIndex = bs.zIndex + 1;
    rs.tint = this.grade;
    // Night searchlight.
    const beam = clipOf(`veh.heli.beam.${d}`);
    const bm = this.sprite(e, 4, this.layers.lights);
    if (beam && this.darkness > 0.05) {
      setTex(bm, beam.frames[0]!);
      bm.blendMode = 'add';
      bm.position.set(e.x, e.y);
      bm.alpha = this.darkness;
    } else bm.visible = false;
  }
}
