/**
 * Composition recipes for the special-skill FX (DOM-free, deterministic for a seed).
 *
 * Each recipe returns a flat list of timed spawns that maps 1:1 onto the view's
 * `FxSystem.spawn(name, x, y, now, opts)` (src/view/fx.ts): `delay` → `offset: -delay`, the rest
 * are FxOpts fields. Entries with `decal: true` are ground marks to bake into the decal layer
 * (`decals.bake(name, x, y)`) after `delay`. Positions are absolute world px (ground point);
 * `z` lifts a sprite (px), velocities are px/s, gravity `g` px/s² on z.
 *
 * Radius scaling (see docs/art/specials.md): a blast is drawn as ground flash + shock ring sized
 * to the lethal radius (the ring's last frame sits exactly on it), one central fireball, then
 * secondary bursts, rolling dust, debris and smoke scattered by fractions of the radius — so the
 * effect covers the kill zone however big it is, while each sprite stays a hand-tuned size.
 */
import { prng } from './draw';
import type { WorldPoint } from './specialGuides';
import { TILE_RX, TILE_RY } from './specialBlasts';
import { dir16 } from './specialShots';
import type { Dir8 } from './particles';
import { DIR_VEC } from './particles';

export type { WorldPoint };
/** FxSystem layers the recipes use (src/view/fx.ts `FxLayer`). */
export type FxLayerName = 'entity' | 'ground' | 'air' | 'light';

/** Tile-space length of a world-px vector. */
function tilesOf(dx: number, dy: number): number {
  return Math.hypot(dx / TILE_RX, dy / TILE_RY);
}

/** Lethal radii the registered rings are drawn for (keep in sync with `data/units.ts`). */
export const FRAG_RADIUS = 2.2;
export const MISSILE_RADIUS = 4.5;
/** Helicopter body altitude above its ground point (veh.heli, docs/art/M4c.md). */
export const HELI_ALT = 40;

export interface FxSpawn {
  name: string;
  x: number;
  y: number;
  /** Seconds after the recipe starts. */
  delay: number;
  layer: FxLayerName;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  g?: number;
  life?: number;
  fade?: number;
  flip?: boolean;
  loop?: boolean;
  emissive?: boolean;
  alpha?: number;
  /** Bake into the decal layer instead of spawning. */
  decal?: boolean;
}

export interface FxRecipe {
  spawns: FxSpawn[];
  /** Screen shake (integer px) and its duration (s), started at `shakeAt`. */
  shake: number;
  shakeTime: number;
  shakeAt: number;
  /** Hit-stop on the impact (ms; 0 = none). */
  hitStopMs: number;
  /** Seconds until the last spawn has finished (for bookkeeping). */
  duration: number;
}

function recipe(spawns: FxSpawn[], shake = 0, shakeTime = 0, hitStopMs = 0, shakeAt = 0): FxRecipe {
  let duration = 0;
  for (const s of spawns) duration = Math.max(duration, s.delay + (s.life ?? 1));
  return {
    spawns: spawns.sort((a, b) => a.delay - b.delay),
    shake,
    shakeTime,
    shakeAt,
    hitStopMs,
    duration,
  };
}

/** Random point in the iso disc of `r` tiles (fraction band lo..hi of the radius). */
function inDisc(
  rnd: () => number,
  r: number,
  lo: number,
  hi: number,
): { dx: number; dy: number; a: number; f: number } {
  const a = rnd() * Math.PI * 2;
  const f = lo + Math.sqrt(rnd()) * (hi - lo);
  return { dx: Math.cos(a) * r * TILE_RX * f, dy: Math.sin(a) * r * TILE_RY * f, a, f };
}

/* ------------------------------------------------------------------ blasts */

export interface BlastOptions {
  seed?: number;
  /** Blast radius in tiles (defaults to the kind's radius). Rings are drawn for 2.2 / 4.5. */
  radius?: number;
}

/**
 * Debris particles thrown out of ground zero (entity layer, tumbling chunks on ballistic arcs
 * that land around `reach` × radius). `fire` = how many are burning.
 */
function debris(
  out: FxSpawn[],
  rnd: () => number,
  o: WorldPoint,
  r: number,
  n: number,
  fire: number,
  names: readonly string[],
  t0: number,
): void {
  for (let k = 0; k < n; k++) {
    const p = inDisc(rnd, r, 0.45, 1.15);
    const vz = 70 + rnd() * 90 + r * 10;
    const g = 300;
    const life = (2 * vz) / g;
    out.push({
      name: k < fire ? 'fx.special.debris.fire' : names[k % names.length]!,
      x: o.x,
      y: o.y,
      delay: t0 + rnd() * 0.05,
      layer: 'entity',
      z: 6,
      vx: p.dx / life,
      vy: p.dy / life,
      vz,
      g,
      life,
      loop: true,
      emissive: k < fire,
    });
  }
}

/**
 * The Soldiers' frag grenade (lethal, ≈2.2 tiles). Timeline: 0 s flash + fireball + light,
 * 0.03 s shock ring, shrapnel and debris fly 0–0.6 s, rolling dust rides the ring, smoke lingers
 * to ~2 s, scorch baked at 0.1 s. Blood / bodies come from the existing death system.
 */
export function fragBlastRecipe(o: WorldPoint, opts: BlastOptions = {}): FxRecipe {
  const rnd = prng(opts.seed ?? 1);
  const r = opts.radius ?? FRAG_RADIUS;
  const out: FxSpawn[] = [
    { name: 'fx.special.frag.flash', x: o.x, y: o.y, delay: 0, layer: 'ground', emissive: true },
    { name: 'fx.special.frag.ring', x: o.x, y: o.y, delay: 0.03, layer: 'ground' },
    { name: 'fx.special.frag.fireball', x: o.x, y: o.y, delay: 0, layer: 'entity', emissive: true },
    {
      name: 'fx.light.blast',
      x: o.x,
      y: o.y,
      delay: 0,
      layer: 'light',
      life: 0.25,
      fade: 0.2,
      alpha: 0.45,
    },
    { name: 'fx.special.frag.scorch', x: o.x, y: o.y, delay: 0.1, layer: 'ground', decal: true },
  ];
  // Shrapnel: hot slivers skimming out to the lethal radius in ~0.25 s.
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + rnd() * 0.4;
    const life = 0.22 + rnd() * 0.08;
    out.push({
      name: 'fx.special.debris.c',
      x: o.x,
      y: o.y,
      delay: 0.02,
      layer: 'entity',
      z: 5,
      vx: (Math.cos(a) * r * TILE_RX) / life,
      vy: (Math.sin(a) * r * TILE_RY) / life,
      vz: 20,
      g: 160,
      life,
      loop: true,
      emissive: true,
    });
  }
  debris(out, rnd, o, r * 0.8, 7, 1, ['fx.special.debris.a', 'fx.special.debris.b'], 0.04);
  // Rolling dust rides out behind the ring.
  rollingRing(out, rnd, o, r, 7, 0.06, 0.55);
  // Lingering smoke.
  for (let k = 0; k < 4; k++) {
    const p = inDisc(rnd, r, 0.05, 0.55);
    out.push({
      name: k % 2 ? 'fx.special.smoke.a' : 'fx.special.smoke.b',
      x: o.x + p.dx,
      y: o.y + p.dy,
      delay: 0.25 + rnd() * 0.25,
      layer: 'entity',
      vz: 5 + rnd() * 6,
      vx: 4 + rnd() * 3,
      flip: rnd() < 0.5,
    });
  }
  return recipe(out, 3, 0.35, 40);
}

function rollingRing(
  out: FxSpawn[],
  rnd: () => number,
  o: WorldPoint,
  r: number,
  n: number,
  t0: number,
  life: number,
): void {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rnd() * 0.3;
    const from = 0.3;
    const to = 0.92;
    out.push({
      name: 'fx.special.dust.roll',
      x: o.x + Math.cos(a) * r * TILE_RX * from,
      y: o.y + Math.sin(a) * r * TILE_RY * from,
      delay: t0 + rnd() * 0.05,
      layer: 'entity',
      vx: (Math.cos(a) * r * TILE_RX * (to - from)) / life,
      vy: (Math.sin(a) * r * TILE_RY * (to - from)) / life,
      life,
      flip: Math.cos(a) < 0,
    });
  }
}

/**
 * The Tank's missile (huge, ≈4.5 tiles). Multi-stage: 0 s flash + fireball (1.3 s mushroom) +
 * big light; 0.04 s shock ring to the full radius; 0.12–0.55 s five secondary bursts across the
 * zone; rolling dust surge; 22 debris chunks (5 burning) incl. slabs; smoke rolls in 0.3–1 s and a
 * black column lingers 5 s; crater baked at 0.15 s.
 */
export function missileBlastRecipe(o: WorldPoint, opts: BlastOptions = {}): FxRecipe {
  const rnd = prng(opts.seed ?? 2);
  const r = opts.radius ?? MISSILE_RADIUS;
  const out: FxSpawn[] = [
    { name: 'fx.special.missile.flash', x: o.x, y: o.y, delay: 0, layer: 'ground', emissive: true },
    { name: 'fx.special.missile.ring', x: o.x, y: o.y, delay: 0.04, layer: 'ground' },
    {
      name: 'fx.special.missile.fireball',
      x: o.x,
      y: o.y,
      delay: 0,
      layer: 'entity',
      emissive: true,
    },
    {
      name: 'fx.special.light.big',
      x: o.x,
      y: o.y,
      delay: 0,
      layer: 'light',
      life: 0.5,
      fade: 0.4,
      alpha: 0.5,
    },
    {
      name: 'fx.special.missile.crater',
      x: o.x,
      y: o.y,
      delay: 0.15,
      layer: 'ground',
      decal: true,
    },
    {
      name: 'fx.smoke.column.black',
      x: o.x + 4,
      y: o.y,
      delay: 1.1,
      layer: 'entity',
      loop: true,
      life: 5,
      fade: 1.5,
    },
  ];
  // Secondary bursts across the kill zone (front ones later so the eye sweeps outward).
  for (let k = 0; k < 5; k++) {
    const p = inDisc(rnd, r, 0.4, 0.85);
    out.push({
      name: k % 2 ? 'fx.special.burst.a' : 'fx.special.burst.b',
      x: o.x + p.dx,
      y: o.y + p.dy,
      delay: 0.12 + k * 0.09 + rnd() * 0.04,
      layer: 'entity',
      emissive: true,
      flip: rnd() < 0.5,
    });
    out.push({
      name: 'fx.special.strike.scorch.' + (k % 2 ? 'a' : 'b'),
      x: o.x + p.dx,
      y: o.y + p.dy,
      delay: 0.2 + k * 0.09,
      layer: 'ground',
      decal: true,
    });
  }
  debris(
    out,
    rnd,
    o,
    r * 0.85,
    22,
    5,
    ['fx.special.debris.a', 'fx.special.debris.d', 'fx.special.debris.b', 'fx.special.debris.c'],
    0.05,
  );
  rollingRing(out, rnd, o, r, 14, 0.1, 0.9);
  for (let k = 0; k < 8; k++) {
    const p = inDisc(rnd, r, 0.1, 0.75);
    out.push({
      name: k % 3 ? 'fx.special.smoke.b' : 'fx.special.smoke.a',
      x: o.x + p.dx,
      y: o.y + p.dy,
      delay: 0.3 + rnd() * 0.7,
      layer: 'entity',
      vz: 6 + rnd() * 8,
      vx: 4 + rnd() * 4,
      flip: rnd() < 0.5,
    });
  }
  return recipe(out, 5, 0.6, 70);
}

/** Pick the right blast for a radius: ≥ 3 tiles = missile style, else frag style. */
export function blastRecipe(o: WorldPoint, radius: number, seed = 1): FxRecipe {
  return radius >= 3
    ? missileBlastRecipe(o, { seed, radius })
    : fragBlastRecipe(o, { seed, radius });
}

/* ------------------------------------------------------------------ projectiles */

/**
 * Lofted flight split into short straight legs, each drawn with the 16-dir sprite matching its
 * screen tangent (FxSystem moves sprites linearly, so the arc is a chain of legs). Trail puffs
 * every `puffEvery` s. `from.z` / `peak` in px.
 */
function lofted(
  out: FxSpawn[],
  base: string,
  trail: string | null,
  from: WorldPoint & { z?: number },
  to: WorldPoint,
  time: number,
  peak: number,
  t0: number,
  legs = 8,
  puffEvery = 0.035,
): void {
  const z0 = from.z ?? 0;
  const at = (u: number): { x: number; y: number; z: number } => ({
    x: from.x + (to.x - from.x) * u,
    y: from.y + (to.y - from.y) * u,
    z: z0 * (1 - u) + 4 * peak * u * (1 - u),
  });
  for (let k = 0; k < legs; k++) {
    const a = at(k / legs);
    const b = at((k + 1) / legs);
    const dt = time / legs;
    const k16 = dir16(b.x - a.x, b.y - b.z - (a.y - a.z));
    out.push({
      name: `${base}.${k16}`,
      x: a.x,
      y: a.y,
      z: a.z,
      delay: t0 + k * dt,
      layer: 'air',
      vx: (b.x - a.x) / dt,
      vy: (b.y - a.y) / dt,
      vz: (b.z - a.z) / dt,
      life: dt,
      loop: true,
      emissive: true,
    });
  }
  if (!trail) return;
  for (let t = puffEvery; t < time; t += puffEvery) {
    const p = at(t / time);
    out.push({ name: trail, x: p.x, y: p.y, z: p.z, delay: t0 + t, layer: 'air' });
  }
}

/**
 * Tank missile: back-blast at the launcher, a lofted flight to `target` (peak 40 + 3 px per
 * tile), then `missileBlastRecipe` on impact. `launcher.z` = launcher height above the ground.
 */
export function missileRecipe(
  launcher: WorldPoint & { z?: number },
  target: WorldPoint,
  opts: BlastOptions = {},
): FxRecipe & { impactAt: number } {
  const dist = tilesOf(target.x - launcher.x, target.y - launcher.y);
  const time = 0.45 + dist * 0.045;
  const out: FxSpawn[] = [
    {
      name: 'fx.special.missile.launch',
      x: launcher.x,
      y: launcher.y,
      z: launcher.z ?? 0,
      delay: 0,
      layer: 'entity',
    },
  ];
  lofted(
    out,
    'fx.special.missile',
    'fx.special.missile.trail',
    launcher,
    target,
    time,
    40 + dist * 3,
    0.02,
  );
  const blast = missileBlastRecipe(target, opts);
  for (const s of blast.spawns) out.push({ ...s, delay: s.delay + time + 0.02 });
  const r = recipe(out, blast.shake, blast.shakeTime, blast.hitStopMs, time + 0.02);
  return { ...r, impactAt: time + 0.02 };
}

/**
 * Frag throw: the spoon flicks off at the hand, the grenade spins along an arc (peak 18 px)
 * with its ground shadow, lands, and `fragBlastRecipe` goes off `fuse` s after landing.
 */
export function fragThrowRecipe(
  hand: WorldPoint & { z?: number },
  target: WorldPoint,
  opts: BlastOptions & { fuse?: number } = {},
): FxRecipe & { impactAt: number } {
  const dist = tilesOf(target.x - hand.x, target.y - hand.y);
  const time = 0.35 + dist * 0.07;
  const z0 = hand.z ?? 12;
  const peak = 18 + dist * 2;
  const g = (8 * peak) / (time * time);
  // z(t) = z0 + vz·t − g·t²/2 lands on the ground (z = 0) at t = time.
  const vz = (g * time * time) / 2 / time - z0 / time;
  const vx = (target.x - hand.x) / time;
  const vy = (target.y - hand.y) / time;
  const out: FxSpawn[] = [
    { name: 'fx.special.frag.spoon', x: hand.x, y: hand.y, z: z0, delay: 0, layer: 'entity' },
    {
      name: 'fx.special.frag.grenade',
      x: hand.x,
      y: hand.y,
      z: z0,
      delay: 0,
      layer: 'air',
      vx,
      vy,
      vz,
      g,
      life: time,
      loop: true,
    },
    {
      name: 'fx.special.frag.shadow',
      x: hand.x,
      y: hand.y,
      delay: 0,
      layer: 'ground',
      vx,
      vy,
      life: time,
    },
  ];
  const fuse = opts.fuse ?? 0.15;
  // A short rest on the ground (frame 0 held) before the boom.
  out.push({
    name: 'fx.special.frag.grenade',
    x: target.x,
    y: target.y,
    delay: time,
    layer: 'entity',
    life: fuse,
    loop: true,
  });
  const blast = fragBlastRecipe(target, opts);
  const at = time + fuse;
  for (const s of blast.spawns) out.push({ ...s, delay: s.delay + at });
  const r = recipe(out, blast.shake, blast.shakeTime, blast.hitStopMs, at);
  return { ...r, impactAt: at };
}

/* ------------------------------------------------------------------ rapid fire */

/**
 * Armed Cops' rapid fire: 5 shots `gap` s apart from `muzzle` (world px + z) at `targets`
 * (cycled), each a hot flash, a long tracer racing to the target (700 px/s) and a dirt / spark
 * hit; the casing arc plays once from the shooter's ground point (`shooter`), mirrored when the
 * shooter faces left. `dir` = the shooter's facing (screen DIRS).
 */
export function rapidFireRecipe(
  shooter: WorldPoint,
  muzzle: WorldPoint & { z: number },
  dir: Dir8,
  targets: readonly WorldPoint[],
  gap = 0.12,
): FxRecipe {
  const out: FxSpawn[] = [];
  const left = DIR_VEC[dir][0] < 0;
  out.push({
    name: `fx.special.rapid.casings.${left ? 'w' : 'e'}`,
    x: shooter.x,
    y: shooter.y + 1,
    delay: 0,
    layer: 'entity',
  });
  for (let k = 0; k < 5; k++) {
    const tg = targets[k % Math.max(1, targets.length)] ?? {
      x: muzzle.x + DIR_VEC[dir][0] * 80,
      y: muzzle.y + DIR_VEC[dir][1] * 80,
    };
    const t = k * gap;
    out.push({
      name: `fx.special.rapid.flash.${dir}`,
      x: muzzle.x,
      y: muzzle.y,
      z: muzzle.z,
      delay: t,
      layer: 'air',
      emissive: true,
    });
    out.push({
      name: 'fx.light.muzzle',
      x: muzzle.x,
      y: muzzle.y,
      delay: t,
      layer: 'light',
      life: 0.06,
      alpha: 0.5,
    });
    const dx = tg.x - muzzle.x;
    const dy = tg.y - (muzzle.y - muzzle.z);
    const dist = Math.hypot(dx, dy);
    const life = Math.max(0.03, dist / 700);
    out.push({
      name: `fx.special.rapid.tracer.${nearestDir8(dx, dy)}`,
      x: muzzle.x,
      y: muzzle.y,
      z: muzzle.z,
      delay: t,
      layer: 'air',
      vx: (tg.x - muzzle.x) / life,
      vy: (tg.y - muzzle.y) / life,
      vz: -muzzle.z / life,
      life,
      emissive: true,
    });
    out.push({ name: 'fx.impact.dirt', x: tg.x, y: tg.y, delay: t + life, layer: 'entity' });
  }
  return recipe(out, 1, 0.6, 0);
}

function nearestDir8(dx: number, dy: number): Dir8 {
  let best: Dir8 = 'e';
  let bd = -Infinity;
  for (const [d, v] of Object.entries(DIR_VEC) as Array<[Dir8, [number, number]]>) {
    const dot = (v[0] * dx + v[1] * dy) / (Math.hypot(dx, dy) || 1);
    if (dot > bd) {
      bd = dot;
      best = d;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ ram */

/**
 * Mounted ram trail from `from` to `to` over `time` s: gallop dust every ~7 px behind the horse
 * (mirrored when heading left), hoof-strike puffs on a 4-beat gallop (alternating hooves ±3 px).
 * The lane marker (`ramLane` / `ui.special.ram.lane.<dir>`) should flash ~0.5 s before this.
 * Per bowled protester add `ramHitSpawns`.
 */
export function ramTrailRecipe(from: WorldPoint, to: WorldPoint, time: number): FxRecipe {
  const out: FxSpawn[] = [];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const left = dx < 0;
  const n = Math.max(2, Math.floor(len / 7));
  for (let k = 0; k < n; k++) {
    const u = k / n;
    out.push({
      name: `fx.special.ram.dust.${left ? 'w' : 'e'}`,
      x: from.x + dx * u - (left ? -4 : 4),
      y: from.y + dy * u,
      delay: u * time,
      layer: 'entity',
    });
  }
  const beat = 0.09;
  for (let t = 0, k = 0; t < time; t += beat, k++) {
    if (k % 4 === 3) continue; // gallop: 3 strikes then a suspension beat
    const u = t / time;
    const side = k % 2 ? 3 : -3;
    out.push({
      name: 'fx.special.ram.hoof',
      x: from.x + dx * u + side,
      y: from.y + dy * u + (k % 2 ? 1 : -1),
      delay: t,
      layer: 'ground',
    });
  }
  return recipe(out, 1, time, 0);
}

/**
 * One protester bowled aside at `at`: the knock burst (mirrored toward the side they fly), KO
 * stars over the head (`headZ` px above the feet) for `ko` seconds, and a body-fall dust.
 */
export function ramHitSpawns(
  at: WorldPoint,
  flyLeft: boolean,
  delay = 0,
  headZ = 19,
  ko = 2.5,
): FxSpawn[] {
  return [
    {
      name: `fx.special.ram.knock.${flyLeft ? 'w' : 'e'}`,
      x: at.x,
      y: at.y,
      delay,
      layer: 'entity',
    },
    {
      name: 'fx.ko.stars',
      x: at.x + (flyLeft ? -6 : 6),
      y: at.y,
      z: headZ - 8,
      delay: delay + 0.25,
      layer: 'air',
      loop: true,
      life: ko,
      fade: 0.4,
    },
    {
      name: 'fx.dust.land',
      x: at.x + (flyLeft ? -8 : 8),
      y: at.y + 1,
      delay: delay + 0.22,
      layer: 'entity',
    },
  ];
}

/* ------------------------------------------------------------------ air strike */

export interface AirStrikeOptions {
  seed?: number;
  /** Corridor half-width in tiles (impacts scatter inside it). Default 1.2. */
  width?: number;
  /** Seconds from the call until the first rocket lands. Default 0.6 (the heli dives in). */
  lead?: number;
  /** Impact spacing along the line (tiles). Default 0.7. */
  spacing?: number;
  /** Seconds between consecutive impacts. Default 0.075. */
  cadence?: number;
}

/**
 * Air strike along a painted `path` (world px, ≥ 2 points). The helicopter flies the path at
 * strafing speed (`flyover`: position over time — draw `veh.heli.fly.<dir>` + rotor + shadow at
 * HELI_ALT); rockets leave it 0.22 s before each impact and streak down; impacts chain along the
 * line, alternating sides inside the corridor: a burst, dust kick, scorch decal, a few chunks;
 * lights every other impact. Returns the spawn list plus the flyover keyframes.
 */
export function airStrikeRecipe(
  path: readonly WorldPoint[],
  o: AirStrikeOptions = {},
): FxRecipe & {
  flyover: Array<{ t: number; x: number; y: number }>;
  impacts: Array<{ t: number; x: number; y: number }>;
} {
  const rnd = prng(o.seed ?? 3);
  const W = o.width ?? 1.2;
  const lead = o.lead ?? 0.6;
  const spacing = o.spacing ?? 0.7;
  const cadence = o.cadence ?? 0.075;
  // Arc length in tiles along the polyline.
  const segs: Array<{ a: WorldPoint; b: WorldPoint; len: number; at: number }> = [];
  let total = 0;
  for (let k = 0; k + 1 < path.length; k++) {
    const a = path[k]!;
    const b = path[k + 1]!;
    const len = tilesOf(b.x - a.x, b.y - a.y);
    segs.push({ a, b, len, at: total });
    total += len;
  }
  const pointAt = (s: number): { x: number; y: number; nx: number; ny: number } => {
    const sg = segs.find((q) => s <= q.at + q.len) ?? segs[segs.length - 1]!;
    const u = sg.len > 0 ? Math.min(1, Math.max(0, (s - sg.at) / sg.len)) : 0;
    const ex = sg.b.x - sg.a.x;
    const ey = sg.b.y - sg.a.y;
    // Ground-plane normal of the travel direction, as a world-px offset of one tile.
    const ti = (ex / 16 + ey / 8) / 2;
    const tj = (ey / 8 - ex / 16) / 2;
    const L = Math.hypot(ti, tj) || 1;
    const ni = -tj / L;
    const nj = ti / L;
    return { x: sg.a.x + ex * u, y: sg.a.y + ey * u, nx: (ni - nj) * 16, ny: (ni + nj) * 8 };
  };
  const out: FxSpawn[] = [];
  const impacts: Array<{ t: number; x: number; y: number }> = [];
  const n = Math.max(2, Math.round(total / spacing) + 1);
  for (let k = 0; k < n; k++) {
    const s = (k / (n - 1)) * total;
    const p = pointAt(s);
    const side = (k % 2 ? 1 : -1) * W * (0.25 + rnd() * 0.45);
    const x = p.x + p.nx * side;
    const y = p.y + p.ny * side;
    const t = lead + k * cadence;
    impacts.push({ t, x, y });
    // Rocket from the heli (a little behind/above), streaking down to the impact.
    const back = pointAt(Math.max(0, s - 1.6));
    lofted(
      out,
      'fx.special.rocket',
      'fx.special.rocket.trail',
      { x: back.x, y: back.y, z: HELI_ALT - 6 },
      { x, y },
      0.22,
      2,
      t - 0.22,
      3,
      0.04,
    );
    out.push({
      name: k % 2 ? 'fx.special.burst.a' : 'fx.special.burst.b',
      x,
      y,
      delay: t,
      layer: 'entity',
      emissive: true,
      flip: rnd() < 0.5,
    });
    out.push({ name: 'fx.dust.land', x, y: y + 2, delay: t + 0.05, layer: 'entity' });
    out.push({
      name: `fx.special.strike.scorch.${k % 2 ? 'a' : 'b'}`,
      x,
      y,
      delay: t + 0.08,
      layer: 'ground',
      decal: true,
    });
    if (k % 2 === 0)
      out.push({
        name: 'fx.light.blast',
        x,
        y,
        delay: t,
        layer: 'light',
        life: 0.18,
        fade: 0.14,
        alpha: 0.35,
      });
    debris(
      out,
      rnd,
      { x, y },
      0.8,
      2,
      k % 3 === 0 ? 1 : 0,
      ['fx.special.debris.a', 'fx.special.debris.b'],
      t,
    );
  }
  // Smoke drifting over the scorched line afterwards.
  for (let k = 0; k < Math.ceil(n / 2); k++) {
    const p = impacts[k * 2]!;
    out.push({
      name: 'fx.special.smoke.a',
      x: p.x,
      y: p.y,
      delay: p.t + 0.3,
      layer: 'entity',
      vz: 6,
      vx: 5,
      flip: rnd() < 0.5,
    });
  }
  // Flyover keyframes: the heli runs in along the line's first direction, over every path
  // point at strafing speed (it is ~1.6 tiles ahead of each impact when the rocket leaves),
  // and on past the end.
  const speed = total / Math.max(0.2, (n - 1) * cadence); // tiles / s
  const tAt = (s: number): number => lead - 0.22 + (s + 1.6) / speed;
  const extend = (from: WorldPoint, to: WorldPoint, tiles: number): WorldPoint => {
    const l = tilesOf(to.x - from.x, to.y - from.y) || 1;
    return { x: to.x + ((to.x - from.x) / l) * tiles, y: to.y + ((to.y - from.y) / l) * tiles };
  };
  const p0 = path[0]!;
  const pn = path[path.length - 1]!;
  const entry = extend(path[1]!, p0, 3);
  const exit = extend(path[path.length - 2]!, pn, 4);
  const flyover = [
    { t: tAt(-3), ...entry },
    ...path.map((p, k) => ({
      t: tAt(k === 0 ? 0 : segs[k - 1]!.at + segs[k - 1]!.len),
      x: p.x,
      y: p.y,
    })),
    { t: tAt(total + 4), ...exit },
  ];
  const r = recipe(out, 2, (n - 1) * cadence + 0.3, 0, lead);
  return { ...r, flyover, impacts };
}
