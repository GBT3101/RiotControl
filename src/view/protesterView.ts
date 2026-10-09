/**
 * The crowd: thousands of pooled sprites bound to the sim's SoA arrays.
 *
 * Each frame, every alive protester inside the view gets a pooled sprite; its animation is
 * chosen from the sim state/anim hint (idle, walk, run, attack/shoot synced to `lastAtk` so the
 * impact frame lands on the damage tick, molotov/bazooka throws, climb up the facade, fighting
 * on a roof, heave when a sniper goes over the edge, door exit, hit flash, paparazzi flash …),
 * with a per-protester phase offset so crowds never march in sync. Looks come from the city's
 * paper-doll variants (cultists by loadout). Prophets/cultists hidden behind buildings get a
 * crisp red x-ray silhouette (capped). At far zoom with huge crowds, animation frames update
 * at half rate (LOD).
 *
 * No allocation in the per-frame loop.
 */
import { Sprite, type Container } from 'pixi.js';
import { art, type AnimClip } from '../art/lib/atlas';
import { PROTESTER_TYPES, type ProtesterType } from '../art/protesters';
import { protesterSprite } from '../art/protesters/build';
import type { ProtesterManifest } from '../art/protesters';
import { depthKey, HALF_TH, HALF_TW } from '../core/iso';
import { PANIM, PS } from '../sim/crowd';
import type { World } from '../sim/world';
import { GhostGate, silhouetteOf } from './silhouette';
import { setTex } from './sprites';
import type { RoofInfo } from './staticView';
import type { ViewRect } from './terrainView';

/** View animation ids. */
export const PA = {
  idle: 0,
  walk: 1,
  run: 2,
  attack: 3,
  molotov: 4,
  flash: 5,
  windup: 6,
  climb: 7,
  heave: 8,
  hit: 9,
  die: 10,
  ko: 11,
  body: 12,
  kobody: 13,
  door: 14,
} as const;
const ANIM_NAMES = Object.keys(PA) as Array<keyof typeof PA>;
const N_ANIMS = ANIM_NAMES.length;
const FACING_NAMES = ['se', 'sw', 'ne', 'nw'] as const;

export interface ClipRef {
  clip: AnimClip;
  flip: boolean;
  /** Impact/release frame (from the manifest), -1 if none. */
  key: number;
}

/** Share of protesters (of types that have both) drawn with a raised sign / placard. */
export const SIGN_SHARE = 0.12;

/** Does this variant hold up a sign, placard or flag? */
function holdsSign(v: { idle: string; loadout: string }): boolean {
  return v.idle === 'sign' || v.idle === 'card' || v.loadout === 'sign';
}

/**
 * Variant registry: art variants → per (anim, facing) clips, resolved lazily. Variants are
 * split into sign carriers and the rest so only ≈1 in 4–5 protesters raises a sign (a crowd
 * where everyone does reads as a wall of rectangles).
 */
export class VariantTable {
  readonly prefixes: string[] = [];
  private readonly clips: Array<Array<ClipRef | null> | null> = [];
  private readonly byType = new Map<string, number[]>();
  private readonly signed = new Set<number>();
  private readonly split = new Map<number[], { sign: number[]; plain: number[] }>();
  private manifest: ProtesterManifest;

  constructor(manifest: ProtesterManifest) {
    this.manifest = manifest;
    this.rebuild(manifest);
  }

  /** New art arrived (deferred protester types): extend the table. */
  rebuild(manifest: ProtesterManifest): void {
    this.manifest = manifest;
    for (const type of PROTESTER_TYPES) {
      for (const v of manifest.variants[type] ?? []) {
        if (this.prefixes.includes(v.prefix)) continue;
        const vi = this.prefixes.length;
        this.prefixes.push(v.prefix);
        this.clips.push(null);
        if (holdsSign(v)) this.signed.add(vi);
        const all = this.byType.get(type) ?? [];
        all.push(vi);
        this.byType.set(type, all);
        const lk = `${type}:${v.loadout}`;
        const byLoad = this.byType.get(lk) ?? [];
        byLoad.push(vi);
        this.byType.set(lk, byLoad);
      }
    }
    this.split.clear();
  }

  private splitOf(list: number[]): { sign: number[]; plain: number[] } {
    let sp = this.split.get(list);
    if (!sp) {
      sp = { sign: list.filter((v) => this.signed.has(v)), plain: [] };
      sp.plain = list.filter((v) => !this.signed.has(v));
      this.split.set(list, sp);
    }
    return sp;
  }

  /** Variant index for a sim protester (type index, look seed, loadout index). */
  pick(type: number, seed: number, loadout: number): number {
    const t: ProtesterType = PROTESTER_TYPES[type] ?? 'student';
    let list: number[] | undefined;
    if (t === 'cultist')
      list = this.byType.get(`cultist:${['machete', 'rifle', 'bazooka'][loadout] ?? 'machete'}`);
    if (!list || list.length === 0) list = this.byType.get(t);
    // Deferred types not built yet: borrow the closest available look.
    if (!list || list.length === 0) list = this.byType.get('mob') ?? this.byType.get('student');
    if (!list || list.length === 0) return -1;
    const sp = this.splitOf(list);
    const h = seed >>> 3;
    const useSign = sp.plain.length === 0 || (sp.sign.length > 0 && h % 100 < SIGN_SHARE * 100);
    const from = useSign ? sp.sign : sp.plain;
    return from[(h >>> 7) % from.length]!;
  }

  get(vi: number, anim: number, facing: number): ClipRef | null {
    let row = this.clips[vi];
    if (row === undefined) return null;
    if (row === null) {
      row = new Array<ClipRef | null>(N_ANIMS * 4).fill(null);
      const prefix = this.prefixes[vi]!;
      const has = (n: string): boolean => art.has(n);
      for (let a = 0; a < N_ANIMS; a++) {
        for (let f = 0; f < 4; f++) {
          const r = protesterSprite(has, prefix, ANIM_NAMES[a]!, FACING_NAMES[f]!);
          if (!art.has(r.name)) continue;
          const ev = this.manifest.events[r.name];
          row[a * 4 + f] = { clip: art.anim(r.name), flip: r.flip, key: ev ? ev.frame : -1 };
        }
      }
      this.clips[vi] = row;
    }
    return row[anim * 4 + facing] ?? null;
  }

  has(vi: number, anim: number): boolean {
    return this.get(vi, anim, 0) !== null;
  }
}

interface PoolEntry {
  sprite: Sprite;
  tint: number;
  /** Crowd slot drawn last frame (LOD may keep its frame). */
  slot: number;
}

const PROPHET = PROTESTER_TYPES.indexOf('prophet');
/** `vHandle` of a slot not bound to any protester yet (handle 0 is a real handle). */
const UNBOUND = 0xffffffff;
const CULTIST = PROTESTER_TYPES.indexOf('cultist');
/**
 * Enemy silhouettes: only the dangerous ones (prophets, armed cultists) and only a few — a
 * whole horde behind a block would just paint the building red.
 */
const MAX_GHOSTS = 8;

export interface ProtesterViewOpts {
  /** Ghost silhouettes for occluded protesters. */
  occluded?: (x: number, y: number) => boolean;
  roof: (building: number) => RoofInfo | undefined;
  roofTop: (building: number) => number;
}

export class ProtesterView {
  readonly variants: VariantTable;
  private readonly pool: PoolEntry[] = [];
  private readonly ghosts: Sprite[] = [];
  private used = 0;
  private ghostUsed = 0;
  /** M13a: de-stack enemy ghosts (one per screen cell; prophets always shown). */
  private readonly ghostGate = new GhostGate({ max: MAX_GHOSTS, cellW: 32, cellH: 24 });
  private frameNo = 0;
  /** Per crowd slot view state. */
  private readonly vHandle: Uint32Array;
  private readonly vVariant: Int32Array;
  private readonly vHitT: Float64Array;
  private readonly vDoorT: Float64Array;
  private readonly vFlashT: Float64Array;
  private readonly vHeaveT: Float64Array;
  private readonly vPhase: Float32Array;
  grade = 0xffffff;
  /** Anim LOD (half-rate frame updates). */
  lod = false;
  visibleCount = 0;

  constructor(
    private readonly world: World,
    manifest: ProtesterManifest,
    private readonly layer: Container,
    private readonly ghostLayer: Container,
    private readonly opts: ProtesterViewOpts,
  ) {
    this.variants = new VariantTable(manifest);
    const cap = world.crowd.capacity;
    this.vHandle = new Uint32Array(cap).fill(UNBOUND);
    this.vVariant = new Int32Array(cap).fill(-1);
    this.vHitT = new Float64Array(cap).fill(-99);
    this.vDoorT = new Float64Array(cap).fill(-99);
    this.vFlashT = new Float64Array(cap).fill(-99);
    this.vHeaveT = new Float64Array(cap).fill(-99);
    this.vPhase = new Float32Array(cap);
  }

  /** Bind a slot to its current protester (resets view state when the slot was reused). */
  private bind(s: number): void {
    const c = this.world.crowd;
    const h = c.handle(s);
    if (this.vHandle[s] === h) return;
    this.vHandle[s] = h;
    this.vVariant[s] = this.variants.pick(c.type[s]!, c.variant[s]!, c.loadout[s]!);
    this.vHitT[s] = this.vDoorT[s] = this.vFlashT[s] = this.vHeaveT[s] = -99;
    this.vPhase[s] = ((c.variant[s]! >>> 11) & 1023) / 512;
  }

  /**
   * New looks arrived: protesters drawn with a borrowed look (their type was not built yet)
   * pick again on their next frame. Everyone else keeps their look.
   */
  refreshLooks(): void {
    const c = this.world.crowd;
    const vt = this.variants;
    for (let s = 0; s < c.hi; s++) {
      const vi = this.vVariant[s]!;
      if (vi < 0 || this.vHandle[s] === UNBOUND) continue;
      const type = PROTESTER_TYPES[c.type[s]!] ?? 'student';
      if (!vt.prefixes[vi]!.startsWith(`prot.${type}.`)) this.vHandle[s] = UNBOUND;
    }
  }

  /** Variant index of a (possibly just dead) protester handle, -1 if unknown. */
  variantOfHandle(handle: number): number {
    const s = handle & 0xffff;
    return this.vHandle[s] === handle ? this.vVariant[s]! : -1;
  }

  onHit(handle: number, now: number): void {
    const s = this.world.crowd.resolve(handle);
    if (s < 0) return;
    this.bind(s);
    if (now - this.vHitT[s]! > 0.5) this.vHitT[s] = now;
  }

  onSpawn(handle: number, now: number): void {
    const s = this.world.crowd.resolve(handle);
    if (s < 0) return;
    this.bind(s);
    this.vDoorT[s] = now;
  }

  onFlash(handle: number, now: number): void {
    const s = this.world.crowd.resolve(handle);
    if (s < 0) return;
    this.bind(s);
    this.vFlashT[s] = now;
  }

  onHeave(building: number, now: number): void {
    const c = this.world.crowd;
    for (let s = 0; s < c.hi; s++) {
      if (c.alive[s] && c.bld[s] === building && c.state[s] === PS.ON_ROOF) {
        this.bind(s);
        this.vHeaveT[s] = now;
      }
    }
  }

  private acquire(): PoolEntry {
    let e = this.pool[this.used];
    if (!e) {
      const sprite = new Sprite();
      this.layer.addChild(sprite);
      e = { sprite, tint: -1, slot: -1 };
      this.pool.push(e);
    }
    this.used++;
    e.sprite.visible = true;
    return e;
  }

  private ghost(tex: Sprite): void {
    let g = this.ghosts[this.ghostUsed];
    if (!g) {
      g = new Sprite();
      this.ghostLayer.addChild(g);
      this.ghosts.push(g);
    }
    const sil = silhouetteOf(tex.texture);
    if (!sil) return;
    this.ghostUsed++;
    g.visible = true;
    setTex(g, sil);
    g.position.copyFrom(tex.position);
    g.scale.x = tex.scale.x;
  }

  /** A ground unit on or next to the tile at (x, y)? (sim's per-tick unit grid) */
  private unitNear(x: number, y: number): boolean {
    const w = this.world;
    const mw = w.map.w;
    const ci = x | 0;
    const cj = y | 0;
    for (let j = cj - 1; j <= cj + 1; j++) {
      if (j < 0 || j >= w.map.h) continue;
      for (let i = ci - 1; i <= ci + 1; i++) {
        if (i < 0 || i >= mw) continue;
        const t = j * mw + i;
        if (w.ugStart[t + 1]! > w.ugStart[t]!) return true;
      }
    }
    return false;
  }

  update(now: number, alpha: number, view: ViewRect): void {
    const c = this.world.crowd;
    const hi = c.hi;
    const prevUsed = this.used;
    const prevGhosts = this.ghostUsed;
    this.used = 0;
    this.ghostUsed = 0;
    this.ghostGate.begin(0, 0);
    this.frameNo++;
    const lodOdd = this.lod ? this.frameNo & 1 : -1;
    const vt = this.variants;
    const occluded = this.opts.occluded;
    const x0 = view.x0 - 24;
    const x1 = view.x1 + 24;
    const y0 = view.y0 - 8;
    const y1 = view.y1 + 40;
    const grade = this.grade;
    for (let s = 0; s < hi; s++) {
      if (!c.alive[s]) continue;
      const st = c.state[s]!;
      // Ground position (interpolated).
      const u = c.px[s]! + (c.x[s]! - c.px[s]!) * alpha;
      const v = c.py[s]! + (c.y[s]! - c.py[s]!) * alpha;
      let x = Math.round((u - v) * HALF_TW);
      let y = Math.round((u + v) * HALF_TH);
      let lift = 0;
      let key: number;
      const onFacade = st === PS.CLIMBING || st === PS.CLIMB_DOWN;
      if (st === PS.ON_ROOF) {
        const roof = this.opts.roof(c.bld[s]!);
        if (roof) {
          const h = c.variant[s]!;
          x = roof.x + ((h & 15) - 7);
          y = roof.y + (((h >>> 4) & 7) - 3);
          lift = roof.top;
          key = roof.frontKey + 3;
        } else key = depthKey(x, y);
      } else {
        if (onFacade) lift = Math.round(c.climb[s]! * this.opts.roofTop(c.bld[s]!));
        key = depthKey(x, y);
      }
      if (x < x0 || x > x1 || y - lift < y0 || y - lift > y1) continue;
      this.bind(s);
      const vi = this.vVariant[s]!;
      if (vi < 0) continue;
      // ── Animation choice ─────────────────────────────────────────────────────────────
      const facing = c.facing[s]!;
      const an = c.anim[s]!;
      let anim: number = PA.idle;
      let t = now + this.vPhase[s]!;
      let hold = false;
      const hitAge = now - this.vHitT[s]!;
      const lastAtk = c.lastAtk[s]!;
      if (onFacade) {
        anim = PA.climb;
      } else if (now - this.vHeaveT[s]! < 0.7 && vt.has(vi, PA.heave)) {
        anim = PA.heave;
        t = now - this.vHeaveT[s]!;
      } else if (hitAge >= 0 && hitAge < 0.17) {
        anim = PA.hit;
        t = hitAge;
      } else if (now - this.vFlashT[s]! < 0.25 && vt.has(vi, PA.flash)) {
        anim = PA.flash;
        t = now - this.vFlashT[s]!;
      } else if (st === PS.SPAWNING && now - this.vDoorT[s]! < 0.5) {
        anim = PA.door;
        t = now - this.vDoorT[s]!;
      } else {
        switch (an) {
          case PANIM.WALK:
          case PANIM.COUGH:
            anim = PA.walk;
            break;
          case PANIM.RUN:
            anim = PA.run;
            break;
          case PANIM.STUNNED:
            anim = PA.hit;
            hold = true;
            break;
          case PANIM.THROW:
          case PANIM.SHOOT:
          case PANIM.ATTACK:
          case PANIM.RIOT:
          case PANIM.ROOF: {
            const a =
              an === PANIM.THROW && vt.has(vi, PA.molotov)
                ? PA.molotov
                : vt.has(vi, PA.attack)
                  ? PA.attack
                  : an === PANIM.ROOF && vt.has(vi, PA.heave)
                    ? PA.heave
                    : PA.idle;
            if (a === PA.idle) break;
            const ref = vt.get(vi, a, facing);
            if (!ref) break;
            const k = ref.key >= 0 ? ref.key : 1;
            const ta = now - (lastAtk - k / Math.max(1, ref.clip.fps));
            if (ta >= 0 && ta < ref.clip.duration) {
              anim = a;
              t = ta;
            } else if (an === PANIM.RIOT || an === PANIM.ROOF) {
              anim = PA.idle;
            }
            break;
          }
          default:
            anim = PA.idle;
        }
        // Prophets sprint with their arms up — and start glowing when a unit is near.
        if (c.type[s] === PROPHET && (anim === PA.walk || anim === PA.run || anim === PA.idle)) {
          anim = this.unitNear(c.x[s]!, c.y[s]!) && vt.has(vi, PA.windup) ? PA.windup : PA.run;
        }
      }
      let ref = vt.get(vi, anim, facing);
      if (!ref) {
        ref = vt.get(vi, PA.idle, facing);
        if (!ref) continue;
      }
      const clip = ref.clip;
      const e = this.acquire();
      const sp = e.sprite;
      if (lodOdd < 0 || (s & 1) === lodOdd || e.slot !== s) {
        const n = clip.frames.length;
        let fi: number;
        if (hold) fi = n - 1;
        else if (clip.loop && anim !== PA.hit && anim !== PA.heave && anim !== PA.door) {
          fi = clip.frameAt(t);
        } else {
          fi = Math.floor(t * clip.fps);
          if (fi >= n) fi = n - 1;
          if (fi < 0) fi = 0;
        }
        setTex(sp, clip.frames[fi]!);
      }
      e.slot = s;
      const flip = ref.flip;
      sp.position.set(flip ? x + 1 : x, y - lift);
      sp.scale.x = flip ? -1 : 1;
      sp.zIndex = key;
      if (e.tint !== grade) {
        e.tint = grade;
        sp.tint = grade;
      }
      if (
        occluded &&
        lift === 0 &&
        this.ghostUsed < MAX_GHOSTS &&
        (c.type[s] === PROPHET || c.type[s] === CULTIST) &&
        occluded(x, y) &&
        this.ghostGate.allow(x, y, c.type[s] === PROPHET, true)
      ) {
        this.ghost(sp);
      }
    }
    for (let k = this.used; k < prevUsed; k++) this.pool[k]!.sprite.visible = false;
    for (let k = this.ghostUsed; k < prevGhosts; k++) this.ghosts[k]!.visible = false;
    this.visibleCount = this.used;
  }
}
