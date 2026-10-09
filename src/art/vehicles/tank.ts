/**
 * Main battle tank: heavy olive MBT with mud-caked side skirts, animated tracks, an angular
 * turret (16 facings) with a long 120 mm gun, a commander in a beret + headset leaning out of
 * the hatch, stowage bins, smoke dischargers and antennae.
 */
import { flame, smokeColumn } from './fxparts';
import { antenna, crew } from './parts';
import { charPaint } from './materials';
import { Model, rotY, rotZ, type Paint, type V3 } from './render3d';
import { STENCILS } from './stamps';

export type TankState = 'ok' | 'dmg1' | 'dmg2' | 'wreck';

/** Model-space turret pivot (turret ring on the hull roof). */
export const TANK_PIVOT: V3 = [-1.5, 0, 9.6];
/** Muzzle point in turret model space (barrel at rest). */
export const TANK_MUZZLE: V3 = [20.2, 0, 2.6];
/** Engine deck (rear) — dmg2 smoke, wreck fire. */
export const TANK_ENGINE: V3 = [-11, 0, 9.6];
/** Recoil per fire frame (units the barrel slides back). */
export const TANK_RECOIL = [3, 2, 1, 0] as const;

const SCORCH: Array<[V3, number]> = [
  [[-11, -3, 9.5], 4],
  [[6, 9, 5], 3],
  [[12, -6, 7], 2.5],
];
const DENTS: Array<[V3, number]> = [
  [[8, 9, 4.5], 1.1],
  [[-4, -9, 5], 1.0],
  [[14, 3, 7.5], 1.0],
];
function near(q: V3, list: Array<[V3, number]>): boolean {
  return list.some(
    ([c, r]) => (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2 + ((q[2] - c[2]) * 1.3) ** 2 < r * r,
  );
}

function hullPaint(state: TankState): Paint {
  return (_p, n, q) => {
    if (state === 'wreck') return near(q, SCORCH) || q[2] < 4 ? 'soot' : charPaint(q, n);
    if (state === 'dmg2' && near(q, SCORCH)) return 'soot';
    if (state !== 'ok' && near(q, DENTS)) return 'dentDk';
    const mudLine = 3.6 + 0.8 * Math.sin(q[0] * 0.7 + q[1]) + (Math.abs(q[0]) > 12 ? 1 : 0);
    if (q[2] < mudLine && Math.abs(n[2]) < 0.7) return 'mud';
    return undefined;
  };
}

/** One track unit (belt + road wheels + skirt), centred at y = yc. */
function track(m: Model, yc: number, frame: number, state: TankState): void {
  const wreck = state === 'wreck';
  const phase = (frame % 4) * 0.5; // links are 2 units apart → 4-frame loop
  const outer = yc + Math.sign(yc) * 2.4;
  const link: Paint = (_p, n, q) => {
    if (wreck) return 'soot';
    // Cleats run across the belt; they slide backwards relative to the hull when driving.
    const along = Math.abs(n[2]) > 0.5 ? q[0] : Math.abs(n[0]) > 0.3 ? q[2] : q[0];
    const k = Math.floor((along + phase + 100) / 1) % 2;
    if (Math.abs(n[1]) > 0.6) return q[2] < 1.5 ? (k ? 'tread' : 'rubber') : 'dark';
    return k ? 'tread' : 'rubber';
  };
  m.box('tread', [-12.5, yc - 2.3, 0.3], [12.5, yc + 2.3, 6.0]).paint(link);
  for (const x of [-12.5, 12.5]) m.cyl('tread', [x, yc, 3.15], 2.85, 4.6, 'y').paint(link);
  // Road wheels peeking under the skirt.
  for (let i = 0; i < 6; i++) {
    const x = -11 + i * 4.4;
    m.cyl(wreck ? 'char' : 'oliveDk', [x, outer - Math.sign(yc) * 0.4, 2.2], 1.9, 0.8, 'y').paint(
      (p, n) => {
        if (Math.abs(n[1]) < 0.5) return undefined;
        const d = Math.hypot(p[0], p[2]);
        if (d < 0.6) return 'steel';
        const a = Math.atan2(p[2], p[0]) + phase * 1.6;
        return d > 1.2 && Math.abs(Math.sin(a * 2)) > 0.9 ? 'dark' : undefined;
      },
    );
  }
  // Drive sprocket (rear) and idler (front) hubs.
  for (const x of [-12.5, 12.5])
    m.cyl('steel', [x, outer - Math.sign(yc) * 0.2, 3.15], 1.0, 0.7, 'y');
}

export function tankHull(frame: number, state: TankState, withTurret?: { yaw: number }): Model {
  const m = new Model();
  const wreck = state === 'wreck';
  const paint = hullPaint(state);
  const body = wreck ? 'char' : 'olive';
  for (const yc of [-6.7, 6.7]) track(m, yc, frame, state);
  // Lower hull between the tracks.
  m.box(wreck ? 'soot' : 'oliveDk', [-14, -4.6, 1.2], [14.5, 4.6, 6]);
  // Upper hull / fenders over the tracks, sloped glacis & rear plate.
  m.box(body, [-15.4, -9.2, 5.6], [15.6, 9.2, 9.6])
    .cut([1, 0, 1.4], [15.6, 0, 6.6])
    .cut([-1, 0, 1.6], [-15.4, 0, 7.4])
    .bevel(0.6, { top: true })
    .paint((p, n, q) => {
      // Driver's hatch & vision blocks on the glacis.
      if (n[0] > 0.4 && n[2] > 0.4) {
        if (Math.abs(q[1] - 2.2) < 1.3 && q[0] > 11.2 && q[0] < 12.6) return 'dark';
        if (Math.abs(q[1] - 2.2) < 1.1 && q[0] > 10.2 && q[0] < 11.2)
          return wreck ? 'soot' : 'glass';
        // Headlight clusters.
        if (Math.abs(Math.abs(q[1]) - 7.5) < 0.8 && q[2] < 7.4) return wreck ? 'soot' : 'lampY';
      }
      // Turret-ring shadow on the roof (separates the turret layer from the hull).
      if (n[2] > 0.7 && (q[0] - TANK_PIVOT[0]) ** 2 + q[1] ** 2 < 6.6 * 6.6)
        return wreck ? 'inkFlat' : 'oliveDk';
      // Engine deck grilles.
      if (n[2] > 0.7 && q[0] < -6 && q[0] > -14 && Math.abs(q[1]) < 6) {
        if (Math.floor(q[0] + 100) % 2 === 0) return wreck ? 'inkFlat' : 'grille';
      }
      // Rear plate: tail lights.
      if (n[0] < -0.4 && Math.abs(Math.abs(q[1]) - 7.6) < 0.7) return wreck ? 'soot' : 'lampR';
      return paint(p, n, q);
    });
  // Side skirts (armour panels) with bolt rows, mud and number stencil.
  // Five panels per side; battle damage knocks panels off (dmg1: one, dmg2+: three).
  const lost = state === 'ok' ? [] : state === 'dmg1' ? ['1:2'] : ['1:2', '-1:1', '1:4'];
  for (const s of [-1, 1]) {
    for (let k = 0; k < 5; k++) {
      if (lost.includes(`${s}:${k}`)) continue;
      const x0 = -14.6 + k * 5.96;
      m.box(body, [x0, s * 9.2 - 0.5, 4.3], [x0 + 5.86, s * 9.2 + 0.5, 6.4])
        .cut([1, 0, 0.9], [15.2, 0, 5.2])
        .paint((p, n, q) => {
          if (Math.abs(n[1]) > 0.6 && q[0] - x0 < 0.5) return 'oliveDk';
          return paint(p, n, q);
        });
    }
  }
  // Tow cable along the deck, spare track links, toolbox.
  if (!wreck) {
    m.box('gun', [-12, 7.4, 9.6], [6, 8.2, 10.2]);
    for (const x of [8, 10.2]) m.box('tread', [x, -8.6, 9.6], [x + 1.8, -6.6, 10.2]);
    m.box('oliveDk', [-9, -8.8, 9.6], [-4, -6.8, 11]).bevel(0.3, { top: true });
  }
  if (!wreck) {
    for (const s of [-1, 1]) {
      m.decal({ at: [s > 0 ? -2 : 3, s * 9.75, 5.2], n: [0, s, 0], img: STENCILS.chevron });
    }
  }
  // Damage smoke / wreck with a knocked-askew turret and fires.
  if (state === 'dmg2') smokeColumn(m, TANK_ENGINE, frame, 'dark', 3);
  if (withTurret) {
    const R = rotZ(withTurret.yaw);
    m.add(
      tankTurret('idle', wreck ? 'wreck' : state === 'dmg2' ? 'dmg' : 'ok', frame),
      TANK_PIVOT,
      R,
    );
  }
  if (wreck) {
    flame(m, [TANK_ENGINE[0], 2, TANK_ENGINE[2]], frame, true, 0);
    flame(m, [TANK_ENGINE[0] + 2, -4, TANK_ENGINE[2]], frame, true, 2);
    flame(m, [4, 7, 10], frame, false, 1);
    smokeColumn(m, [TANK_ENGINE[0], 0, TANK_ENGINE[2] + 12], frame, 'dark', 4, 5);
  }
  return m;
}

export type TurretState = 'ok' | 'dmg' | 'wreck';

/**
 * Turret. Origin = pivot. `fire` 0..3 = recoil frames (0 = shot), 'idle' = at rest.
 */
export function tankTurret(
  fire: 'idle' | 0 | 1 | 2 | 3,
  state: TurretState = 'ok',
  frame = 0,
): Model {
  const m = new Model();
  const wreck = state === 'wreck';
  const body = wreck ? 'char' : 'olive';
  const recoil = fire === 'idle' ? 0 : TANK_RECOIL[fire];
  const scorch: Paint = (_p, n, q) => {
    if (wreck) return charPaint(q, n);
    if (state === 'dmg' && (q[0] - 2) ** 2 + (q[1] + 4) ** 2 < 5) return 'soot';
    return undefined;
  };
  // Angular welded turret: wedge front, flat sides, overhanging rear bustle.
  m.box(body, [-8.5, -6.2, 0], [6.5, 6.2, 4.6])
    .cut([1, 0.62, 0], [6.5, -1.5, 0])
    .cut([1, -0.62, 0], [6.5, 1.5, 0])
    .cut([0, 1, 0.55], [0, 6.2, 3.2])
    .cut([0, -1, 0.55], [0, -6.2, 3.2])
    .bevel(0.5, { top: true })
    .paint(scorch);
  // Stowage basket on the bustle.
  if (!wreck) {
    m.box('oliveDk', [-11, -5.2, 1.0], [-8.4, 5.2, 3.6]).paint((_p, n, q) =>
      n[2] > 0.5
        ? Math.floor(q[1] + 20) % 3 === 0
          ? 'canvas'
          : 'canvasDk'
        : Math.floor(q[1] + 20) % 2
          ? 'gun'
          : undefined,
    );
    m.box('canvas', [-10.6, -4.6, 3.4], [-8.6, -0.6, 4.6]).bevel(0.5, { top: true });
  }
  // Gun mantlet and the long 120 mm gun with thermal sleeve, bore evacuator & muzzle reference.
  const droop = wreck ? 1.2 : 0;
  const g = new Model();
  g.box(body, [5.2, -2.1, 1.0], [7.4, 2.1, 4.0]).bevel(0.4, { top: true, front: true });
  g.cyl(body, [10, 0, 2.6], 0.95, 6.4, 'x');
  g.cyl(wreck ? 'soot' : 'oliveDk', [13.9, 0, 2.6], 1.15, 2.0, 'x');
  g.cyl(body, [17.0, 0, 2.6], 0.85, 4.6, 'x');
  g.cyl(wreck ? 'soot' : 'oliveDk', [19.5, 0, 2.6], 1.0, 0.9, 'x');
  m.add(g, [-recoil, 0, droop ? 0.4 : 0], droop ? rotY(droop * 4) : undefined);
  // Coax / smoke dischargers on the cheeks.
  if (!wreck) {
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++)
        m.cyl('gun', [3.4 - k * 1.1, s * 5.9, 3.9], 0.45, 1.6, 'y').rot('x', s * -30);
    }
  }
  // Commander's cupola with the commander leaning out; loader's hatch closed.
  m.cyl(wreck ? 'soot' : 'oliveDk', [-3.2, 2.8, 4.9], 2.1, 0.9, 'z');
  if (state !== 'wreck') {
    crew(m, [-3.2, 2.8, 4.4], {
      beret: true,
      helmet: 'navyCloth',
      body: 'oliveDk',
      headset: true,
      noArms: true,
      big: true,
    });
    m.box('oliveDk', [-2.2, 1.0, 5.2], [-1.2, 4.6, 6.0]); // forearms on the hatch rim
    m.box(state === 'dmg' ? 'soot' : 'gun', [-1.0, 0.6, 5.3], [3.2, 1.3, 6.0]); // pintle MG
  }
  m.cyl(wreck ? 'soot' : 'oliveDk', [-3.0, -2.8, 4.8], 1.7, 0.6, 'z');
  // Antennae on the bustle.
  if (!wreck) {
    antenna(m, [-8.4, -4.8, 4.6], 11, 10);
    antenna(m, [-8.4, 4.6, 4.6], 8, 14);
  }
  // Turret number stencil.
  if (!wreck) {
    for (const s of [-1, 1])
      m.decal({ at: [s > 0 ? -6 : -1, s * 6.25, 2.8], n: [0, s, 0], img: STENCILS.star });
  }
  void frame;
  return m;
}
