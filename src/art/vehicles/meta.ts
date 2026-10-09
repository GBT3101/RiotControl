/**
 * Integration offsets for vehicle layers (pure maths, no rendering): where to draw the turret on
 * the hull, where muzzles / rotor hub / searchlight are, per facing. All offsets are integer
 * world pixels relative to the *anchor* of the layer they belong to (see docs/art/M4c.md).
 */
import type { Point } from '../lib/pixels';
import { DIR16, DIR8, yaw16, yaw8, type Dir16, type Dir8 } from './dirs';
import { HELI_ALT, HELI_HUB, HELI_LIGHT, HELI_MUZZLE, HELI_POSES, type HeliPose } from './heli';
import { HUMVEE_BOB, HUMVEE_ENGINE, HUMVEE_MUZZLE, HUMVEE_PIVOT } from './humvee';
import { projectPx, type V3 } from './render3d';
import { TANK_ENGINE, TANK_MUZZLE, TANK_PIVOT, TANK_RECOIL } from './tank';

export { HELI_ALT };

/** Humvee: turret anchor offset from the hull anchor (includes the drive-frame body bob). */
export function humveeTurretOffset(hullDir: Dir8, frame = 0): Point {
  const bob = HUMVEE_BOB[frame % 4]!;
  return projectPx([HUMVEE_PIVOT[0], HUMVEE_PIVOT[1], HUMVEE_PIVOT[2] + bob], {
    yaw: yaw8(hullDir),
  });
}
/** Humvee: muzzle offset from the turret anchor. */
export function humveeMuzzle(turretDir: Dir8): Point {
  return projectPx(HUMVEE_MUZZLE, { yaw: yaw8(turretDir) });
}
/** Humvee: engine/hood point (smoke, sparks) from the hull anchor. */
export function humveeEngine(hullDir: Dir8): Point {
  return projectPx(HUMVEE_ENGINE, { yaw: yaw8(hullDir) });
}

/** Tank: turret anchor offset from the hull anchor (the hull does not bob). */
export function tankTurretOffset(hullDir: Dir8): Point {
  return projectPx(TANK_PIVOT, { yaw: yaw8(hullDir) });
}
/** Tank: muzzle offset from the turret anchor (fire frame 0..3 includes recoil; default = rest). */
export function tankMuzzle(turretDir: Dir16, fireFrame?: number): Point {
  const r = fireFrame === undefined ? 0 : (TANK_RECOIL[fireFrame] ?? 0);
  const p: V3 = [TANK_MUZZLE[0] - r, TANK_MUZZLE[1], TANK_MUZZLE[2]];
  return projectPx(p, { yaw: yaw16(turretDir) });
}
export function tankEngine(hullDir: Dir8): Point {
  return projectPx(TANK_ENGINE, { yaw: yaw8(hullDir) });
}

function heliView(pose: HeliPose, d: Dir8) {
  return { yaw: yaw8(d), ...HELI_POSES[pose] };
}
/** Helicopter: rotor-hub offset from the body anchor (the body anchor is the centre of mass). */
export function heliHubOffset(pose: HeliPose, d: Dir8): Point {
  return projectPx(HELI_HUB, heliView(pose, d));
}
/** Helicopter: door-gun muzzle from the body anchor. */
export function heliMuzzle(pose: HeliPose, d: Dir8): Point {
  return projectPx(HELI_MUZZLE, heliView(pose, d));
}
/** Helicopter: searchlight lens from the body anchor. */
export function heliLight(pose: HeliPose, d: Dir8): Point {
  return projectPx(HELI_LIGHT, heliView(pose, d));
}

/** Precomputed tables (handy for docs & debugging). */
export function metaTables() {
  const t8 = <T>(f: (d: Dir8) => T) =>
    Object.fromEntries(DIR8.map((d) => [d, f(d)])) as Record<Dir8, T>;
  return {
    humveeTurretOffset: t8((d) => [0, 1, 2, 3].map((f) => humveeTurretOffset(d, f))),
    humveeMuzzle: t8(humveeMuzzle),
    humveeEngine: t8(humveeEngine),
    tankTurretOffset: t8(tankTurretOffset),
    tankMuzzle: Object.fromEntries(DIR16.map((d) => [d, tankMuzzle(d)])) as Record<Dir16, Point>,
    tankEngine: t8(tankEngine),
    heliHub: t8((d) => heliHubOffset('hover', d)),
    heliHubFly: t8((d) => heliHubOffset('fly', d)),
    heliMuzzle: t8((d) => heliMuzzle('hover', d)),
    heliLight: t8((d) => heliLight('hover', d)),
  };
}
