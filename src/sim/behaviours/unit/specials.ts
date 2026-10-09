/**
 * Special unit behaviours: Tear Gas Shooter (cone + grenade ability), Mounted Riot Police
 * (commandable melee, knocks students aside), MG Humvee, Tank (ballistic shell with friendly
 * fire, crushes protesters), Helicopter (free flight, door gun, rotor wash).
 */
import { DMG } from '../../../data/damage';
import { PT } from '../../../data/protesters';
import { acquireTarget, aimAt, killProtester, validateHolders } from '../../combat';
import { PS } from '../../crowd';
import { TEAM_POLICE } from '../../projectiles';
import { US, type Unit } from '../../units';
import type { World } from '../../world';
import type { UnitBehaviour } from '../types';
import { isDisabled, meleeStrike, moverUpdate, rangedFire, recruit } from './common';

const buf = new Int32Array(1024);

// ── Tear Gas Shooter ───────────────────────────────────────────────────────────────────

function chargeAbility(w: World, u: Unit, dt: number): void {
  const ab = u.def.ability;
  if (!ab || u.abilityReady) return;
  u.charge += dt;
  if (u.charge >= ab.charge) {
    u.charge = ab.charge;
    u.abilityReady = true;
    w.events.push('abilityReady', { unitId: u.id });
  }
}

/** Spray cone: protesters inside choke (gas DoT) and are stunned. */
function gasCone(w: World, u: Unit, dt: number): void {
  const a = u.def.attack;
  if (!a) return;
  if (isDisabled(u)) {
    u.state = US.STUNNED;
    return;
  }
  if (u.cd > 0) u.cd -= dt;
  const t = acquireTarget(w, u, a.range, dt);
  if (t < 0) {
    if (w.time - u.lastAttack > 0.6) u.state = US.IDLE;
    return;
  }
  const c = w.crowd;
  aimAt(u, c.x[t]!, c.y[t]!);
  u.state = US.ATTACKING;
  if (u.cd > 0) return;
  u.cd += a.cooldown;
  if (u.cd < 0) u.cd = 0;
  const cosHalf = Math.cos(((a.coneAngle ?? 60) * Math.PI) / 360);
  const n = w.hash.query(c, u.x, u.y, a.range, buf);
  let hits = 0;
  for (let k = 0; k < n; k++) {
    const s = buf[k]!;
    const st = c.state[s]!;
    if (st === PS.ON_ROOF || st === PS.CLIMBING || st === PS.CLIMB_DOWN) continue;
    const dx = c.x[s]! - u.x;
    const dy = c.y[s]! - u.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 0.3 && (dx * u.aimX + dy * u.aimY) / d < cosHalf) continue;
    c.gasT[s] = Math.max(c.gasT[s]!, a.gasLinger ?? 0.5);
    if (a.stun) c.stun[s] = Math.max(c.stun[s]!, a.stun);
    hits++;
  }
  // One `fired` per second keeps the event stream light; the view loops the spray while ATTACKING.
  if (w.time - u.lastAttack >= 1) {
    u.lastAttack = w.time;
    w.events.push('fired', {
      shooterKind: 'unit',
      shooterId: u.id,
      weapon: 'gasCone',
      x0: u.x,
      y0: u.y,
      z0: 0,
      x1: u.x + u.aimX * a.range,
      y1: u.y + u.aimY * a.range,
      projectileId: -1,
      hits,
    });
  }
}

/**
 * Densest crowd point within `range` of (x, y): the cell maximising the 3×3 neighbourhood
 * count (ties → nearer). Returns false if nobody is in range. Result in `densest`.
 */
export const densest = { x: 0, y: 0, count: 0 };
export function findDensest(w: World, x: number, y: number, range: number): boolean {
  const hash = w.hash;
  const r2 = range * range;
  let best = 0;
  let bestD = Infinity;
  const i0 = Math.max(0, Math.floor(x - range));
  const i1 = Math.min(hash.w - 1, Math.floor(x + range));
  const j0 = Math.max(0, Math.floor(y - range));
  const j1 = Math.min(hash.h - 1, Math.floor(y + range));
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const dx = i + 0.5 - x;
      const dy = j + 0.5 - y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2 || hash.cellCount(i, j) === 0) continue;
      let n = 0;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) n += hash.cellCount(i + a, j + b);
      if (n > best || (n === best && d2 < bestD)) {
        best = n;
        bestD = d2;
        densest.x = i + 0.5;
        densest.y = j + 0.5;
      }
    }
  }
  densest.count = best;
  return best > 0;
}

/** Throw the charged gas grenade at the densest crowd in range. */
export function useGasGrenade(w: World, u: Unit): boolean {
  const ab = u.def.ability;
  if (!ab || !u.abilityReady || !u.alive || isDisabled(u)) return false;
  if (!findDensest(w, u.x, u.y, ab.range)) return false;
  const tx = densest.x;
  const ty = densest.y;
  aimAt(u, tx, ty);
  const p = w.projectiles.spawn(
    'gasGrenade',
    TEAM_POLICE,
    u.id,
    u.x,
    u.y,
    0,
    tx,
    ty,
    ab.projectileSpeed,
  );
  p.damage = 0;
  p.radius = ab.radius;
  p.areaKind = 'gas';
  p.areaRadius = ab.radius;
  p.areaTtl = ab.duration;
  p.areaDps = ab.dps;
  p.areaStun = ab.stun;
  u.abilityReady = false;
  u.charge = 0;
  u.lastAttack = w.time;
  w.events.push('abilityUsed', { unitId: u.id, x: tx, y: ty });
  w.events.push('fired', {
    shooterKind: 'unit',
    shooterId: u.id,
    weapon: 'gasGrenade',
    x0: u.x,
    y0: u.y,
    z0: 0,
    x1: tx,
    y1: ty,
    projectileId: p.id,
    hits: 0,
  });
  return true;
}

export const gasser: UnitBehaviour = {
  id: 'gasser',
  update(w, u, dt) {
    validateHolders(w, u);
    recruit(w, u);
    chargeAbility(w, u, dt);
    gasCone(w, u, dt);
  },
};

// ── Mounted Riot Police ────────────────────────────────────────────────────────────────

function knockStudents(w: World, u: Unit): void {
  const kb = u.def.knockback;
  if (!kb) return;
  const c = w.crowd;
  const n = w.hash.query(c, u.x, u.y, u.def.radius + 0.4, buf);
  for (let k = 0; k < n; k++) {
    const s = buf[k]!;
    if (c.type[s] !== PT.student) continue;
    const st = c.state[s]!;
    if (st !== PS.MARCH && st !== PS.ENGAGED && st !== PS.SPAWNING) continue;
    if (c.stun[s]! > 0) continue;
    // Shove sideways relative to the horse's heading.
    const dx = c.x[s]! - u.x;
    const dy = c.y[s]! - u.y;
    const side = dx * -u.aimY + dy * u.aimX >= 0 ? 1 : -1;
    c.vx[s] = -u.aimY * side * kb.impulse;
    c.vy[s] = u.aimX * side * kb.impulse;
    c.stun[s] = kb.stun;
  }
}

export const mountedMelee: UnitBehaviour = {
  id: 'mountedMelee',
  update(w, u, dt) {
    const moving = moverUpdate(w, u, dt);
    if (moving) {
      validateHolders(w, u, true);
      // Heading for the shove direction.
      const mw = w.map.w;
      const next = u.path[u.pathIdx];
      if (next !== undefined) {
        const dx = (next % mw) + 0.5 - u.x;
        const dy = Math.floor(next / mw) + 0.5 - u.y;
        const l = Math.sqrt(dx * dx + dy * dy);
        if (l > 1e-6) {
          u.aimX = dx / l;
          u.aimY = dy / l;
        }
      }
      knockStudents(w, u);
      return;
    }
    validateHolders(w, u);
    recruit(w, u);
    meleeStrike(w, u, dt);
  },
};

// ── MG Humvee ──────────────────────────────────────────────────────────────────────────

export const vehicleGun: UnitBehaviour = {
  id: 'vehicleGun',
  update(w, u, dt) {
    const moving = moverUpdate(w, u, dt);
    validateHolders(w, u, moving);
    recruit(w, u);
    rangedFire(w, u, dt);
    if (moving && u.state !== US.ATTACKING) u.state = US.MOVING;
  },
};

// ── Tank ───────────────────────────────────────────────────────────────────────────────

function crush(w: World, u: Unit): void {
  const c = w.crowd;
  const n = w.hash.query(c, u.x, u.y, u.def.radius * 0.85, buf);
  for (let k = 0; k < n; k++) {
    const s = buf[k]!;
    const st = c.state[s]!;
    if (st === PS.CLIMBING || st === PS.ON_ROOF || st === PS.CLIMB_DOWN) continue;
    if (c.type[s] === PT.prophet) continue; // prophets explode on contact instead (crowd update)
    killProtester(w, s, DMG.crush, true, u.id);
  }
}

export const tank: UnitBehaviour = {
  id: 'tank',
  update(w, u, dt) {
    const moving = moverUpdate(w, u, dt);
    validateHolders(w, u, moving);
    recruit(w, u);
    if (moving && u.def.crushes) crush(w, u);
    rangedFire(w, u, dt);
    if (moving && u.state !== US.ATTACKING) u.state = US.MOVING;
  },
};

// ── Helicopter ─────────────────────────────────────────────────────────────────────────

function rotorWash(w: World, u: Unit, dt: number): void {
  const r = u.def.rotorWash;
  if (!r) return;
  for (const a of w.areas.active) {
    if (a.kind !== 'gas') continue;
    const dx = a.x - u.x;
    const dy = a.y - u.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r * r || d2 < 1e-6) continue;
    const d = Math.sqrt(d2);
    const push = (1 - d / r) * 1.5 * dt;
    a.x += (dx / d) * push;
    a.y += (dy / d) * push;
  }
}

export const heli: UnitBehaviour = {
  id: 'heli',
  update(w, u, dt) {
    const moving = moverUpdate(w, u, dt);
    rangedFire(w, u, dt);
    rotorWash(w, u, dt);
    if (moving && u.state !== US.ATTACKING) u.state = US.MOVING;
  },
};
