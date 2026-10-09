/**
 * Ballistic projectiles (tank shells, bazooka rockets, molotovs, gas grenades) in a small
 * object pool. Hitscan weapons do not create projectiles (they emit `fired` tracers).
 *
 * Flight is a straight ground path with a parabolic height profile; `x, y` = ground position,
 * `z` = height in tiles above the ground for the view.
 */
import { DMG, type DamageId } from '../data/damage';
import { blast, hurtUnit } from './combat';
import type { ProjectileKind } from './events';
import type { World } from './world';

export const TEAM_POLICE = 0;
export const TEAM_PROTESTERS = 1;

export class Projectile {
  id = 0;
  kind: ProjectileKind = 'shell';
  team = TEAM_POLICE;
  /** Unit id (police) or protester handle (protesters). */
  ownerId = -1;
  x0 = 0;
  y0 = 0;
  /** Launch height (storeys → tiles: the view decides). */
  z0 = 0;
  x1 = 0;
  y1 = 0;
  x = 0;
  y = 0;
  z = 0;
  t = 0;
  dur = 1;
  apex = 1;
  damage = 0;
  radius = 0;
  dmg: DamageId = DMG.explosion;
  lethal = true;
  /** Damage factor to protesters / own ground units in the blast. */
  crowdFactor = 1;
  unitFactor = 0;
  /** Rooftop target unit slot+gen (bazooka at a sniper), -1. */
  roofTarget = -1;
  roofGen = 0;
  /** Area left behind: fire patch (molotov) or gas cloud (grenade). */
  areaKind: 'none' | 'fire' | 'gas' = 'none';
  areaRadius = 0;
  areaTtl = 0;
  areaDps = 0;
  areaStun = 0;
}

export class Projectiles {
  active: Projectile[] = [];
  private readonly pool: Projectile[] = [];
  private nextId = 1;

  spawn(
    kind: ProjectileKind,
    team: number,
    ownerId: number,
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    speed: number,
  ): Projectile {
    const p = this.pool.pop() ?? new Projectile();
    p.id = this.nextId++;
    p.kind = kind;
    p.team = team;
    p.ownerId = ownerId;
    p.x0 = p.x = x0;
    p.y0 = p.y = y0;
    p.z0 = p.z = z0;
    p.x1 = x1;
    p.y1 = y1;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const d = Math.sqrt(dx * dx + dy * dy);
    p.t = 0;
    p.dur = Math.max(0.15, d / Math.max(0.1, speed));
    p.apex = kind === 'shell' ? 0.4 + d * 0.05 : 0.6 + d * 0.15;
    p.roofTarget = -1;
    p.roofGen = 0;
    p.areaKind = 'none';
    p.crowdFactor = 1;
    p.unitFactor = 0;
    this.active.push(p);
    return p;
  }

  update(w: World, dt: number): void {
    const list = this.active;
    for (let k = list.length - 1; k >= 0; k--) {
      const p = list[k]!;
      p.t += dt;
      const f = Math.min(1, p.t / p.dur);
      p.x = p.x0 + (p.x1 - p.x0) * f;
      p.y = p.y0 + (p.y1 - p.y0) * f;
      p.z = p.z0 * (1 - f) + p.apex * 4 * f * (1 - f);
      if (f < 1) continue;
      // Impact. Remove first (impact may spawn more projectiles — never mid-iteration issue
      // since we iterate backwards and new ones are appended).
      list[k] = list[list.length - 1]!;
      list.pop();
      impact(w, p);
      this.pool.push(p);
    }
  }
}

function impact(w: World, p: Projectile): void {
  const police = p.team === TEAM_POLICE;
  if (p.kind !== 'gasGrenade') {
    w.events.push('exploded', { kind: p.kind, x: p.x1, y: p.y1, radius: p.radius });
  }
  if (p.damage > 0) {
    blast(w, p.x1, p.y1, p.radius, p.damage, p.dmg, p.lethal, {
      crowd: p.crowdFactor,
      units: p.unitFactor,
      roofs: false,
      attackerKind: police ? 'unit' : 'protester',
      attackerId: p.ownerId,
      by: police ? p.ownerId : -1,
    });
  }
  if (p.roofTarget >= 0) {
    const u = w.units.at(p.roofTarget, p.roofGen);
    if (u && u.building >= 0) {
      w.events.push('attacked', {
        attackerKind: 'protester',
        attackerId: p.ownerId,
        targetKind: 'unit',
        targetId: u.id,
        x: u.x,
        y: u.y,
        damage: p.damage,
        dmgType: 'explosion',
      });
      hurtUnit(w, u, p.damage, p.dmg, p.lethal, 'protester', p.ownerId);
    }
  }
  if (p.areaKind !== 'none') {
    w.areas.spawnArea(
      w,
      p.areaKind,
      p.x1,
      p.y1,
      p.areaRadius,
      p.areaTtl,
      p.areaDps,
      p.areaStun,
      police ? TEAM_POLICE : TEAM_PROTESTERS,
    );
  }
}
