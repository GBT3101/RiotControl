/**
 * MG Humvee ("hammer"): olive army Humvee with a canvas-covered rear, sandbagged hood,
 * jerry cans, whip antennae, mud-caked flanks and a roof ring. The gunner + M2 machine gun
 * is a separate turret layer that rotates independently.
 */
import { flame, smokeColumn } from './fxparts';
import { antenna, crew, jerryCan, sandbag, wheel } from './parts';
import { charPaint } from './materials';
import { Model, type Paint, type V3 } from './render3d';
import { STENCILS } from './stamps';

export type HullState = 'ok' | 'dmg1' | 'dmg2' | 'wreck';

/** Model-space turret pivot (top of the roof ring). */
export const HUMVEE_PIVOT: V3 = [-1.0, 0, 13.0];
/** Body bob per drive frame (units = px). */
export const HUMVEE_BOB = [0, 1, 1, 0] as const;
/** Engine (hood) point: smoke on dmg2, main fire on the wreck. */
export const HUMVEE_ENGINE: V3 = [8, 0, 8.4];
/** Muzzle point of the M2 in turret model space. */
export const HUMVEE_MUZZLE: V3 = [10.0, 0, 5.6];

const SCORCH: Array<[V3, number]> = [
  [[8.5, 2, 8.2], 3.4],
  [[-1, -6, 9.5], 2.4],
  [[-10, 5, 8], 2.4],
];
const DENTS: Array<[V3, number]> = [
  [[6.5, 6, 6.2], 1.0],
  [[-6, 6, 8.6], 0.8],
  [[12, -3, 6.5], 0.9],
  [[0.5, -6, 6.5], 0.9],
];
const SCRATCHES: Array<[V3, V3]> = [
  [
    [4.5, 6, 6.6],
    [7.5, 6, 5.6],
  ],
  [
    [-3.5, -6, 6.8],
    [-0.5, -6, 6.2],
  ],
];

function near(q: V3, list: Array<[V3, number]>): boolean {
  return list.some(
    ([c, r]) => (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2 + ((q[2] - c[2]) * 1.3) ** 2 < r * r,
  );
}

/** Base paint for olive panels: mud on the lower flanks, damage marks per state. */
function olivePaint(state: HullState): Paint {
  return (_p, n, q) => {
    if (state === 'wreck') return near(q, SCORCH) || q[2] < 5 ? 'soot' : charPaint(q, n);
    if (state === 'dmg2' && near(q, SCORCH)) return 'soot';
    if (state !== 'ok') {
      if (near(q, DENTS)) return 'dentDk';
      for (const [a, b] of SCRATCHES) {
        if (Math.abs(q[1] - a[1]) > 0.5 || Math.abs(n[1]) < 0.5) continue;
        const t = (q[0] - a[0]) / (b[0] - a[0]);
        if (t < 0 || t > 1) continue;
        if (Math.abs(q[2] - (a[2] + (b[2] - a[2]) * t)) < 0.35) return 'scrape';
      }
    }
    // Mud splashed up the flanks and nose (wavy hand-placed edge).
    const mudLine = 5.1 + 0.7 * Math.sin(q[0] * 0.9 + q[1] * 0.4) + (Math.abs(q[0]) > 9 ? 0.6 : 0);
    if (q[2] < mudLine && Math.abs(n[2]) < 0.7) return 'mud';
    return undefined;
  };
}

export function humveeHull(frame: number, state: HullState): Model {
  const m = new Model();
  const wreck = state === 'wreck';
  const bob = wreck ? -1.4 : HUMVEE_BOB[frame % 4]!;
  const phase = frame / 4;
  // Wheels (stay on the ground; the body bobs on its suspension).
  for (const x of [-7.8, 8.0]) {
    for (const y of [-5.2, 5.2]) {
      wheel(m, [x, y, 3.5], 3.5, 2.8, { phase, rimOnly: wreck, hub: 'oliveDk', tread: 9 });
    }
  }
  const b = new Model();
  const paint = olivePaint(state);
  const body = wreck ? 'char' : 'olive';
  const glass = wreck ? 'glassBroken' : 'glass';
  // Underbody & skid plate.
  b.box('dark', [-10.5, -4.2, 1.6], [11, 4.2, 4.2]);
  // Lower hull / fenders: the wide Humvee stance, sloped nose with grille and lamps.
  b.box(body, [-12, -6, 3.9], [12, 6, 7.6])
    .bevel(0.8, { top: true })
    .cut([1, 0, 1.15], [12, 0, 5.4])
    .paint((p, n, q) => {
      if (Math.abs(n[1]) > 0.6) {
        for (const wx of [-7.8, 8.0]) {
          if ((q[0] - wx) ** 2 + (q[2] - 3.5) ** 2 < 4.4 * 4.4) return wreck ? 'inkFlat' : 'dark';
        }
        if (!wreck && (Math.abs(q[0] - 3.3) < 0.3 || Math.abs(q[0] + 4.1) < 0.3) && q[2] > 4.6)
          return 'oliveDk';
      }
      if (n[0] > 0.5 && n[2] > 0.3) {
        if (Math.abs(q[1]) < 3.2) return Math.floor(q[1] + 10) % 2 === 0 ? 'grille' : 'dark';
        if (Math.abs(q[1]) > 3.9 && Math.abs(q[1]) < 5.1 && q[2] > 5.6 && q[2] < 6.7) {
          if (wreck || (state !== 'ok' && q[1] < 0)) return 'glassBroken';
          return 'lampY';
        }
      }
      if (n[0] > 0.9 && Math.abs(q[1]) < 4.6) return 'dark';
      return paint(p, n, q);
    });
  // Hood bulge.
  b.box(body, [3.6, -4.2, 7.2], [11.0, 4.2, 8.1]).bevel(0.6, { top: true }).paint(paint);
  // Cabin with raked windscreen, door windows and handles.
  b.box(body, [-4.4, -5.6, 7.3], [3.6, 5.6, 12.1])
    .cut([1, 0, 0.32], [3.6, 0, 7.6])
    .bevel(0.5, { vert: true })
    .paint((p, n, q) => {
      if (n[0] > 0.6) {
        if (q[2] > 8.6 && q[2] < 11.5 && Math.abs(q[1]) < 4.9 && Math.abs(q[1]) > 0.45) {
          if (state === 'dmg1' || state === 'dmg2') {
            const d = Math.abs(q[1] - 2.6) + Math.abs(q[2] - 10.2);
            if (d < 1.4 && (Math.round(q[1] * 2) + Math.round(q[2] * 2)) % 3 === 0)
              return 'glassHi';
          }
          if (!wreck && Math.abs(q[1] + q[2] * 0.9 - 7.6) < 0.6) return 'glassHi';
          return glass;
        }
        return paint(p, n, q);
      }
      if (Math.abs(n[1]) > 0.6) {
        if (q[2] > 8.7 && q[2] < 11.3) {
          if ((q[0] > -3.9 && q[0] < -0.8) || (q[0] > -0.2 && q[0] < 2.9)) {
            if (!wreck && Math.abs(q[0] - q[2] * 0.6 + 4.2) < 0.45) return 'glassHi';
            return glass;
          }
        }
        if (!wreck && Math.abs(q[0] + 0.5) < 0.3 && q[2] < 8.7) return 'oliveDk';
        if (
          !wreck &&
          q[2] > 7.9 &&
          q[2] < 8.4 &&
          (Math.abs(q[0] - 1.6) < 0.6 || Math.abs(q[0] + 2.4) < 0.6)
        )
          return 'steel';
      }
      return paint(p, n, q);
    });
  // Roof plate & ring base.
  b.box(body, [-4.8, -5.8, 12.1], [3.9, 5.8, 12.7]).bevel(0.4, { top: true }).paint(paint);
  b.cyl(wreck ? 'soot' : 'oliveDk', [HUMVEE_PIVOT[0], 0, 12.9], 3.5, 0.5, 'z');
  // Rear load bed under a sand canvas cover with hoops and tie-down ropes.
  b.box(body, [-12, -5.8, 7.3], [-4.4, 5.8, 8.6]).paint((p, n, q) => {
    if (n[0] < -0.6 && Math.abs(q[1]) > 4.4)
      return wreck ? 'soot' : state === 'dmg2' && q[1] > 0 ? 'lampRdk' : 'lampR';
    return paint(p, n, q);
  });
  if (!wreck) {
    b.box('canvas', [-11.8, -5.5, 8.4], [-4.6, 5.5, 11.6])
      .bevel(1.3, { top: true })
      .paint((_p, _n, q) => {
        if (Math.abs(q[0] + 6.6) < 0.4 || Math.abs(q[0] + 9.6) < 0.4) return 'canvasDk';
        if (state === 'dmg2' && near(q, [[[-9, 5.5, 10], 1.6]])) return 'dark';
        if (state !== 'ok' && near(q, [[[-7, -5.5, 10.4], 0.8]])) return 'dark';
        return undefined;
      });
  } else {
    // Burnt hoops only.
    for (const x of [-6.6, -9.6])
      b.box('char', [x - 0.4, -5.4, 8.6], [x + 0.4, 5.4, 11]).cut([0, 0, 1], [0, 0, 10.6]);
  }
  // Bumpers, winch and tow hooks.
  b.box('steel', [11.8, -6.3, 3.6], [13.0, 6.3, 4.9]).bevel(0.3, { top: true });
  b.box('dark', [12.0, -1.6, 4.7], [12.9, 1.6, 5.8]);
  for (const s of [-1, 1]) b.boxc('gun', [13.1, s * 4.6, 4.2], [0.8, 0.6, 1.2]);
  b.box('steel', [-13.0, -6.0, 3.8], [-12.0, 6.0, 4.9]);
  // Mirrors.
  if (!wreck) {
    for (const s of [-1, 1]) {
      if (state === 'dmg2' && s > 0) continue;
      b.box('gun', [2.8, s * 5.6 - 0.25, 10.0], [3.2, s * 6.9 + 0.25, 10.3]);
      b.boxc('dark', [3.0, s * 7.0, 9.8], [0.6, 0.6, 1.8]);
    }
  }
  // Sandbags across the nose, two stacked behind.
  if (!wreck) {
    for (const y of [-3.6, 0, 3.6]) sandbag(b, [9.2, y, 8.8], true, y === 0);
    for (const y of [-1.8, 1.8]) sandbag(b, [8.9, y, 10.2], true, y > 0);
  } else {
    sandbag(b, [9.2, -2, 8.7], true, true);
  }
  // Jerry cans on the tailgate.
  for (const y of [-3.4, 3.4]) jerryCan(b, [-13.5, y, 6.6], wreck ? 'char' : 'jerry');
  // Antennae.
  if (!wreck) {
    antenna(b, [-11.4, -4.8, 8.6], state === 'dmg2' ? 6 : 13, state === 'ok' ? 10 : 34);
    antenna(b, [-11.4, 4.8, 8.6], 10, 12);
  }
  // Stencilled Ministry star on both doors, unit chevron on the rear quarter.
  if (!wreck) {
    for (const s of [-1, 1]) {
      b.decal({ at: [s > 0 ? -1.9 : 1.1, s * 6.0, 7.2], n: [0, s, 0], img: STENCILS.star });
      b.decal({ at: [s > 0 ? -10.2 : -7.2, s * 5.8, 8.2], n: [0, s, 0], img: STENCILS.chevron });
    }
  }
  m.add(b, [0, 0, bob]);
  // Damage smoke / wreck fire.
  const eng: V3 = [HUMVEE_ENGINE[0], HUMVEE_ENGINE[1], HUMVEE_ENGINE[2] + bob];
  if (state === 'dmg2') smokeColumn(m, eng, frame, 'grey', 3);
  if (wreck) {
    flame(m, [eng[0], eng[1] + 1, eng[2] - 0.5], frame, true, 0);
    flame(m, [-1, -2, 11.5 + bob], frame, true, 2);
    flame(m, [-8, 3, 9 + bob], frame, false, 1);
    smokeColumn(m, [eng[0] - 2, 0, eng[2] + 10], frame, 'dark', 4, 5);
  }
  return m;
}

/** Gunner turret: ring hatch, armour shield, M2 machine gun, gunner. Origin = pivot. */
export function humveeTurret(frame: 'idle' | 'fire0' | 'fire1', dmg = false): Model {
  const m = new Model();
  const recoil = frame === 'fire0' ? -0.9 : frame === 'fire1' ? -0.4 : 0;
  m.cyl('oliveDk', [0, 0, 0.5], 3.4, 1.0, 'z');
  // Gun shield: front plate + angled wings.
  const shieldPaint: Paint = (_p, n, q) => {
    if (dmg && (q[1] - 1.2) ** 2 + (q[2] - 3.4) ** 2 < 1.8) return 'soot';
    if (n[0] > 0.5 && q[2] > 3.2 && q[2] < 3.8 && Math.abs(q[1]) > 1) return 'oliveDk';
    return undefined;
  };
  m.box('olive', [2.2, -3.8, 0.8], [3.0, 3.8, 4.8]).bevel(0.6, { top: true }).paint(shieldPaint);
  for (const s of [-1, 1]) {
    m.box('olive', [-0.4, s * 3.6 - 0.4, 0.8], [2.6, s * 3.6 + 0.4, 4.2])
      .rot('z', s * 24)
      .paint(shieldPaint);
  }
  m.box('steel', [0.4, -0.45, 1.0], [1.3, 0.45, 5.0]);
  // M2 .50 cal: receiver, barrel jacket, barrel, flash hider; ammo can on the left.
  const g = new Model();
  g.box('gun', [-0.6, -0.8, 5.0], [2.5, 0.8, 6.3]).bevel(0.3, { top: true });
  g.box('gun', [-1.4, -0.6, 5.1], [-0.6, 0.6, 6.0]);
  g.cyl('gun', [3.4, 0, 5.6], 0.85, 1.8, 'x');
  g.cyl('gun', [6.2, 0, 5.6], 0.5, 5.6, 'x');
  g.cyl('steel', [9.2, 0, 5.6], 0.7, 1.1, 'x');
  g.box('oliveDk', [0.2, -2.2, 4.3], [1.9, -0.8, 5.9]).paint((p, n) =>
    n[1] < -0.5 && Math.abs(p[2]) < 0.25 ? 'hivis' : undefined,
  );
  m.add(g, [recoil, 0, 0]);
  // Gunner behind the gun, hands on the spade grips.
  crew(m, [-2.4 + recoil * 0.4, 0, 0.8], {
    helmet: 'helmetNavy',
    body: 'oliveDk',
    goggles: true,
    gripX: -1.2 + recoil,
    gripZ: 5.3,
    big: true,
  });
  return m;
}
