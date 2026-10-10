/**
 * Special skills art (playtest round 2): ram, rapid fire, frag grenade, tank missile and air
 * strike — FX, projectiles and world-space aim / paint guides. Registration entry point; the
 * composition recipes live in `specialRecipes.ts`. Catalogue & how-to: docs/art/specials.md.
 */
import type { SpriteRegistry } from '../lib/registry';
import {
  blastSmoke,
  debrisChunk,
  fireball,
  flamingDebris,
  groundFlash,
  rollingDust,
  scorchDecal,
  shockRing,
  type Framed,
} from './specialBlasts';
import {
  casingBurst,
  exhaustPuff,
  flightShadow,
  fragGrenade,
  fragSpoon,
  gallopDust,
  hoofPuff,
  knockBurst,
  launchBlast,
  rapidFlash,
  rapidTracer,
  rocketSet,
} from './specialShots';
import { lightPool } from './lights';
import { DIRS } from './particles';
import { registerGuides } from './specialGuides';
import { FRAG_RADIUS, MISSILE_RADIUS } from './specialRecipes';

function add(
  reg: SpriteRegistry,
  name: string,
  f: Framed,
  fps: number,
  loop = false,
  group = 'fx',
): void {
  reg.add(name, { group, frames: f.frames, fps, loop, anchor: f.anchor });
}

function registerBlasts(reg: SpriteRegistry): void {
  // Frag grenade (2.2 tiles).
  add(
    reg,
    'fx.special.frag.fireball',
    fireball({ R: 12, frames: 11, seed: 61, debris: 9, embers: 8 }),
    16,
  );
  add(reg, 'fx.special.frag.flash', groundFlash(30, 5), 20);
  add(reg, 'fx.special.frag.ring', shockRing(FRAG_RADIUS, 7, 6), 18);
  // Missile (4.5 tiles).
  add(
    reg,
    'fx.special.missile.fireball',
    fireball({ R: 22, frames: 16, seed: 83, mushroom: true, debris: 16, embers: 14 }),
    14,
  );
  add(reg, 'fx.special.missile.flash', groundFlash(64, 9, 3), 18);
  add(reg, 'fx.special.missile.ring', shockRing(MISSILE_RADIUS, 11, 7), 16);
  // Mid-size bursts (missile secondaries, air-strike chain).
  add(reg, 'fx.special.burst.a', fireball({ R: 8, frames: 9, seed: 17, debris: 5, embers: 4 }), 16);
  add(reg, 'fx.special.burst.b', fireball({ R: 9, frames: 9, seed: 29, debris: 6, embers: 5 }), 16);
  // Particles.
  for (const k of ['a', 'b', 'c', 'd'] as const)
    add(reg, `fx.special.debris.${k}`, debrisChunk(k), 14, true);
  add(reg, 'fx.special.debris.fire', flamingDebris(), 14, true);
  add(reg, 'fx.special.smoke.a', blastSmoke(1, 6), 8);
  add(reg, 'fx.special.smoke.b', blastSmoke(2, 8), 8);
  add(reg, 'fx.special.dust.roll', rollingDust(7), 10);
  // Big additive light (missile).
  const light = lightPool(92, 50, [
    'rust0',
    'rust1',
    'rust2',
    'rust3',
    'ochre2',
    'ochre3',
    'ochre4',
  ]);
  reg.add('fx.special.light.big', {
    group: 'fx',
    frames: light,
    anchor: { x: Math.floor(light.w / 2), y: Math.floor(light.h / 2) },
    tags: ['additive'],
  });
  // Decals.
  const scorch = scorchDecal(26, 3, false);
  reg.add('fx.special.frag.scorch', {
    group: 'fx',
    frames: scorch.frames,
    anchor: scorch.anchor,
    tags: ['decal'],
  });
  const crater = scorchDecal(52, 8, true);
  reg.add('fx.special.missile.crater', {
    group: 'fx',
    frames: crater.frames,
    anchor: crater.anchor,
    tags: ['decal'],
  });
  for (const [k, seed] of [
    ['a', 21],
    ['b', 34],
  ] as const) {
    const s = scorchDecal(13, seed, false);
    reg.add(`fx.special.strike.scorch.${k}`, {
      group: 'fx',
      frames: s.frames,
      anchor: s.anchor,
      tags: ['decal'],
    });
  }
}

/** Register a sprite drawn facing screen-right plus its mirror (`.e` / `.w`). */
function addMirrored(reg: SpriteRegistry, base: string, f: Framed, fps: number): void {
  reg.add(`${base}.e`, {
    group: 'fx',
    frames: f.frames,
    fps,
    loop: false,
    anchor: f.anchor,
    mirrorAs: `${base}.w`,
  });
}

function registerShots(reg: SpriteRegistry): void {
  // Ram.
  addMirrored(reg, 'fx.special.ram.dust', gallopDust(), 12);
  add(reg, 'fx.special.ram.hoof', hoofPuff(), 16);
  addMirrored(reg, 'fx.special.ram.knock', knockBurst(), 14);
  // Rapid fire.
  DIRS.forEach((d, i) => {
    add(reg, `fx.special.rapid.flash.${d}`, rapidFlash(d, 40 + i), 25);
    const t = rapidTracer(d);
    reg.add(`fx.special.rapid.tracer.${d}`, {
      group: 'fx',
      frames: t.frames,
      fps: 20,
      loop: false,
      anchor: t.anchor,
    });
  });
  addMirrored(reg, 'fx.special.rapid.casings', casingBurst(), 25);
  // Frag grenade.
  add(reg, 'fx.special.frag.grenade', fragGrenade(), 20, true);
  add(reg, 'fx.special.frag.spoon', fragSpoon(), 16);
  const sh = flightShadow(3);
  reg.add('fx.special.frag.shadow', {
    group: 'fx',
    frames: sh.frames,
    anchor: sh.anchor,
    hasShadow: true,
  });
  // Missile & rockets (16 directions).
  rocketSet('missile').forEach((f, k) => add(reg, `fx.special.missile.${k}`, f, 16, true));
  rocketSet('rocket').forEach((f, k) => add(reg, `fx.special.rocket.${k}`, f, 16, true));
  add(reg, 'fx.special.missile.trail', exhaustPuff(true), 14);
  add(reg, 'fx.special.rocket.trail', exhaustPuff(false), 16);
  add(reg, 'fx.special.missile.launch', launchBlast(), 16);
}

export function registerSpecials(reg: SpriteRegistry): void {
  registerBlasts(reg);
  registerShots(reg);
  registerGuides(reg);
}
