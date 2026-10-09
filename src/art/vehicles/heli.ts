/**
 * Ministry police helicopter: dark navy twin-engine light helicopter with a hi-vis Battenburg
 * band, blue strobes, a Nightsun searchlight under the nose, an enclosed fenestron tail rotor
 * and a door gunner (with a very unofficial machine gun) in the open starboard door.
 * The main rotor is a separate 4-frame layer; the ground shadow is a separate sprite.
 *
 * Model origin = centre of mass (on the mast axis). The body sprite's anchor is that point;
 * draw it at (groundX, groundY − HELI_ALT). The shadow's anchor is the ground point.
 */
import { muzzleFlash } from './stamps';
import { crew } from './parts';
import { Model, project, rotZ, type Paint, type V3, type View } from './render3d';

/** Default flying altitude in world px (body anchor above its ground point). */
export const HELI_ALT = 40;
/** Rotor hub (top of the mast) in model space. */
export const HELI_HUB: V3 = [0, 0, 8.2];
/** Searchlight lens (model space). */
export const HELI_LIGHT: V3 = [7.4, 2.4, -4.6];
/** Door-gun muzzle (model space). */
export const HELI_MUZZLE: V3 = [-2.0, 10.8, -0.1];

export type HeliPose = 'hover' | 'fly' | 'bankl' | 'bankr';
export const HELI_POSES: Record<HeliPose, { pitch: number; roll: number }> = {
  hover: { pitch: 0, roll: 0 },
  fly: { pitch: 9, roll: 0 },
  bankl: { pitch: 5, roll: -13 },
  bankr: { pitch: 5, roll: 13 },
};

/**
 * Body. `frame` 0..3 animates the fenestron and strobes; `fire` adds the door-gun burst
 * (flash on frames 0 and 2).
 */
export function heliBody(frame: number, fire = false, view?: View): Model {
  const m = new Model();
  const body: Paint = (_p, n, q) => {
    // Battenburg hi-vis band along the lower flanks.
    if (q[2] < -0.2 && q[2] > -3.9 && Math.abs(n[1]) > 0.35) {
      return (Math.floor((q[0] + 40) / 1.6) + Math.floor((q[2] + 40) / 1.5)) % 2 ? 'hivisPaint' : 'blue';
    }
    if (q[2] < -3.9 && n[2] < -0.3) return 'navyDk';
    return undefined;
  };
  // Cabin.
  m.box('navy', [-8, -4.5, -4.0], [4.2, 4.5, 3.6])
    .bevel(1.6, { top: true, vert: true, bottom: true })
    .paint((p, n, q) => {
      // Starboard door opening (gunner sits in it).
      if (n[1] > 0.6 && q[0] > -5.2 && q[0] < 0.6 && q[2] > -3.2 && q[2] < 2.6) return 'dark';
      // Side windows (port side + aft starboard).
      if (Math.abs(n[1]) > 0.6 && q[2] > 0.0 && q[2] < 2.5) {
        if (q[0] > -7.2 && q[0] < -5.2) return 'glass';
        if (n[1] < 0 && q[0] > -4.6 && q[0] < 0.2) return Math.abs(q[0] - q[2] * 0.6 + 2) < 0.45 ? 'glassHi' : 'glass';
      }
      return body(p, n, q);
    });
  // Nose bubble with a big canopy.
  m.ell('navy', [4.2, 0, -0.3], [5.6, 4.5, 3.7])
    .cut([-1, 0, 0], [4.2, 0, 0])
    .paint((p, n, q) => {
      if (q[2] > -1.3 && p[0] > 0.6) {
        if (Math.abs(q[1]) < 0.35) return 'navyDk';
        if (Math.abs(q[1] - q[2] * 0.8 - 1.4) < 0.5) return 'glassHi';
        return 'glass';
      }
      return body(p, n, q);
    });
  // Aft fairing tapering into the boom.
  m.ell('navy', [-8, 0, 0.2], [4.5, 4.0, 3.4]).cut([1, 0, 0], [-8, 0, 0]).paint(body);
  // Engine cowling, exhausts, mast, hub.
  m.box('navy', [-7.2, -2.9, 3.2], [1.8, 2.9, 5.8]).bevel(1.0, { top: true, front: true }).paint((_p, n, q) => {
    if (Math.abs(n[1]) > 0.6 && q[0] < -3.5 && q[0] > -6 && q[2] > 4) return 'grille';
    return undefined;
  });
  for (const s of [-1, 1]) m.cyl('steel', [-7.4, s * 1.7, 4.7], 0.75, 1.4, 'x');
  m.cyl('gun', [0, 0, 6.6], 0.7, 1.8, 'z');
  m.cyl('steel', [0, 0, 7.8], 1.4, 0.9, 'z');
  // Tail boom (two tapering sections) with a blue/white stripe.
  const boom: Paint = (_p, _n, q) => (Math.abs(q[2] - 1.0) < 0.35 ? 'hivisPaint' : undefined);
  m.cyl('navy', [-16, 0, 1.0], 1.55, 12, 'x').paint(boom);
  m.cyl('navy', [-24.5, 0, 1.3], 1.15, 5.5, 'x');
  // Horizontal stabiliser with end plates.
  m.box('navy', [-24.4, -4.4, 1.0], [-22.2, 4.4, 1.6]);
  for (const s of [-1, 1]) m.box('navyDk', [-24.6, s * 4.4 - 0.35, 0.1], [-22.4, s * 4.4 + 0.35, 2.8]);
  // Fenestron fin: shrouded tail rotor, blades spin with the frame.
  const spin = (frame % 4) * 22.5;
  m.box('navy', [-30.4, -0.8, -1.0], [-25.8, 0.8, 7.2])
    .cut([1, 0, 0.55], [-25.8, 0, 3.0])
    .cut([-1, 0, -0.35], [-30.4, 0, -0.5])
    .paint((_p, n, q) => {
      if (Math.abs(n[1]) < 0.6) return undefined;
      const dx = q[0] + 28.2;
      const dz = q[2] - 1.6;
      const d = Math.hypot(dx, dz);
      if (d < 0.6) return 'steel';
      if (d < 2.2) {
        const a = ((Math.atan2(dz, dx) * 180) / Math.PI + spin + 720) % 45;
        return a < 12 ? 'gun' : 'dark';
      }
      if (d < 2.7) return 'navyDk';
      if (q[2] > 5.4) return 'hivisPaint';
      return undefined;
    });
  // Skids with struts.
  for (const s of [-1, 1]) {
    m.cyl('steel', [0.4, s * 4.8, -7.3], 0.5, 15, 'x').cut([1, 0, -0.9], [7.2, 0, -7.3]);
    m.cyl('steel', [7.6, s * 4.8, -6.7], 0.5, 1.6, 'x').rot('y', -40);
    for (const x of [-4.2, 3.6]) m.box('gun', [x - 0.4, s * 3.6 - 0.4, -7.2], [x + 0.4, s * 4.9 + 0.4, -3.4]);
  }
  // Searchlight (Nightsun) under the nose; strobes.
  m.cyl('gun', [6.6, 2.4, -4.6], 1.0, 1.6, 'x');
  m.boxc('lampW', [7.5, 2.4, -4.6], [0.3, 1.3, 1.3]);
  const strobe = frame % 2 === 0;
  m.boxc(strobe ? 'lampBhi' : 'lampBoff', [-2, 0, 6.0], [1.2, 1.0, 0.7]);
  m.boxc(strobe ? 'lampR' : 'lampRdk', [-30.2, 0, 7.4], [0.7, 0.7, 0.7]);
  m.boxc(strobe ? 'lampBoff' : 'lampB', [0, -4.6, -4.2], [0.8, 0.5, 0.6]);
  // Door gunner sitting in the starboard door, legs braced, gun pointing outboard.
  const g = new Model();
  const recoil = fire && frame % 2 === 0 ? -0.6 : 0;
  crew(g, [0.4, 0, -1.4], { helmet: 'helmetNavy', body: 'navyCloth', goggles: true, gripX: 2.0 + recoil, gripZ: 2.3, big: true });
  g.box('gun', [1.2 + recoil, -0.5, 2.0], [3.8 + recoil, 0.5, 2.9]);
  g.cyl('gun', [5.4 + recoil, 0, 2.5], 0.42, 3.6, 'x');
  g.box('oliveDk', [2.0 + recoil, -1.6, 1.2], [3.2 + recoil, -0.5, 2.2]);
  m.add(g, [-2.0, 3.4, -2.6], rotZ(90));
  if (fire && frame % 2 === 0 && view) {
    const a = project(HELI_MUZZLE, view);
    const b = project([HELI_MUZZLE[0], HELI_MUZZLE[1] + 3, HELI_MUZZLE[2]], view);
    const f = muzzleFlash(b.x - a.x, b.y - a.y, 1, frame === 0 ? 0 : 1);
    m.overlay({ at: HELI_MUZZLE, img: f.img, origin: f.origin });
  }
  return m;
}
