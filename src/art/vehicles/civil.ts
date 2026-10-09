/**
 * Decor / ambient vehicles (parked or driving through along the tile axes): police van,
 * ambulance, fire truck, city buses (London double-decker, Madrid EMT, Paris RATP), London
 * black cab, Madrid taxi, Paris small cars (2CV-ish, Twingo-ish), generic hatchbacks & saloons
 * in several colours, Vespa scooter, delivery van — plus burnt / overturned / burning variants
 * for riot aftermath.
 */
import type { SpriteRegistry } from '../lib/registry';
import { DIR4, yaw8, type Dir4 } from './dirs';
import { flame, smokeColumn } from './fxparts';
import { burntKey, MATS } from './materials';
import { crew, wheel } from './parts';
import { Model, renderAnim, type Paint, type V3, type View } from './render3d';
import { battenburg, STENCILS, text } from './stamps';

const G = 'vehicles';
export type CivState = 'ok' | 'burnt';

// ---------------------------------------------------------------------------------------------
// Shared builders
// ---------------------------------------------------------------------------------------------

interface CarSpec {
  L: number;
  W: number;
  wheelR: number;
  wheelX: [number, number];
  sill: number;
  belt: number;
  roof: number;
  /** Cabin (greenhouse) at the beltline: rear x, front x (windscreen base). */
  cabin: [number, number];
  /** Horizontal run of windscreen / rear window (rake). */
  rake: [number, number];
  body: string;
  roofMat?: string;
  /** Nose & tail slope (units dropped at the very ends). */
  nose?: number;
  tail?: number;
  /** Extra side paint (stripes, two-tone). Called before the generic paint. */
  side?: Paint;
  extras?: (m: Model, frame: number, state: CivState) => void;
  hub?: string;
}

function windowPaint(spec: CarSpec, state: CivState): Paint {
  const glass = state === 'burnt' ? 'glassBroken' : 'glass';
  const [cr, cf] = spec.cabin;
  return (_p, n, q) => {
    const z0 = spec.belt + 0.5;
    const z1 = spec.roof - 0.7;
    if (q[2] < z0 || q[2] > z1) return undefined;
    // Side windows with a B-pillar.
    if (Math.abs(n[1]) > 0.6) {
      const mid = (cr + spec.rake[0] + cf - spec.rake[1]) / 2;
      if (Math.abs(q[0] - mid) < 0.45) return undefined;
      const slopeF = cf - ((q[2] - spec.belt) / (spec.roof - spec.belt)) * spec.rake[1] - 0.6;
      const slopeR = cr + ((q[2] - spec.belt) / (spec.roof - spec.belt)) * spec.rake[0] + 0.6;
      if (q[0] > slopeR && q[0] < slopeF) {
        if (state === 'ok' && Math.abs(q[0] - mid - 2 - (q[2] - z0) * 0.7) < 0.4) return 'glassHi';
        return glass;
      }
      return undefined;
    }
    // Windscreen & rear window.
    if (Math.abs(q[1]) < spec.W / 2 - 1.3) {
      if (state === 'ok' && n[0] > 0.3 && Math.abs(q[1] + (q[2] - z0) * 0.9 - 1) < 0.5) return 'glassHi';
      return glass;
    }
    return undefined;
  };
}

/** A car: lower body, greenhouse, wheels, lamps, bumpers. */
function car(spec: CarSpec, frame: number, state: CivState): Model {
  const m = new Model();
  const burnt = state === 'burnt';
  const { L, W } = spec;
  const hx = L / 2;
  const hy = W / 2;
  const sink = burnt ? -0.9 : 0;
  for (const x of spec.wheelX) {
    for (const s of [-1, 1]) {
      wheel(m, [x, s * (hy - 1.1), spec.wheelR], spec.wheelR, 1.8, {
        phase: frame / 2,
        rimOnly: burnt,
        hub: spec.hub ?? 'silver',
        tread: 8,
      });
    }
  }
  const b = new Model();
  const nose = spec.nose ?? 1.6;
  const tail = spec.tail ?? 1.0;
  b.box('dark', [-hx + 1.5, -hy + 1.2, spec.sill - 0.6], [hx - 1.5, hy - 1.2, spec.sill + 1]);
  b.box(spec.body, [-hx, -hy, spec.sill], [hx, hy, spec.belt])
    .bevel(0.9, { top: true, vert: true })
    .cut([1, 0, 1.2], [hx, 0, spec.belt - nose])
    .cut([-1, 0, 1.2], [-hx, 0, spec.belt - tail])
    .paint((p, n, q) => {
      if (Math.abs(n[1]) > 0.6) {
        for (const wx of spec.wheelX) {
          if ((q[0] - wx) ** 2 + (q[2] - spec.wheelR) ** 2 < (spec.wheelR + 0.9) ** 2) return 'dark';
        }
      }
      const s = spec.side?.(p, n, q);
      if (s) return s;
      // Lamps: headlights on the nose, tail lights at the back, amber side repeaters.
      const lampZ = q[2] > spec.belt - nose - 1.6 && q[2] < spec.belt - 0.4;
      if (n[0] > 0.45 && lampZ && Math.abs(q[1]) > hy - 2.6 && Math.abs(q[1]) < hy - 0.6) return burnt ? 'soot' : 'lampY';
      if (n[0] > 0.45 && lampZ && Math.abs(q[1]) < hy - 3.4) return 'grille';
      if (n[0] < -0.45 && lampZ && Math.abs(q[1]) > hy - 2.4 && Math.abs(q[1]) < hy - 0.6) return burnt ? 'soot' : 'lampR';
      return undefined;
    });
  // Greenhouse.
  const [cr, cf] = spec.cabin;
  const [rr, rf] = spec.rake;
  const h = spec.roof - spec.belt;
  b.box(spec.roofMat ?? spec.body, [cr, -hy + 0.5, spec.belt - 0.05], [cf, hy - 0.5, spec.roof])
    .cut([h, 0, rf], [cf, 0, spec.belt])
    .cut([-h, 0, rr], [cr, 0, spec.belt])
    .bevel(0.7, { top: true })
    .paint(windowPaint(spec, state));
  // Bumpers.
  b.box(burnt ? 'char' : 'dark', [hx - 0.4, -hy + 0.3, spec.sill], [hx + 0.5, hy - 0.3, spec.sill + 1.2]);
  b.box(burnt ? 'char' : 'dark', [-hx - 0.5, -hy + 0.3, spec.sill], [-hx + 0.4, hy - 0.3, spec.sill + 1.2]);
  // Mirrors.
  if (!burnt) for (const s of [-1, 1]) b.boxc(spec.body, [cf - rf * 0.2, s * (hy + 0.4), spec.belt + 0.8], [0.8, 0.9, 0.8]);
  spec.extras?.(b, frame, state);
  m.add(b, [0, 0, sink]);
  return m;
}

/** Tall box vehicle (vans, trucks, buses): body box, sloped cab front, windows by callback. */
interface BoxSpec {
  L: number;
  W: number;
  H: number;
  wheelR: number;
  wheelX: number[];
  sill: number;
  body: string;
  /** Windscreen: base z at the front face, and its rake (units back at the top). */
  screenZ: number;
  rake: number;
  /** Nose block in front of the windscreen (vans): length & height. */
  nose?: [number, number];
  paint?: Paint;
  extras?: (m: Model, frame: number, state: CivState) => void;
  bevel?: number;
}

function boxVehicle(spec: BoxSpec, frame: number, state: CivState): Model {
  const m = new Model();
  const burnt = state === 'burnt';
  const hx = spec.L / 2;
  const hy = spec.W / 2;
  for (const x of spec.wheelX) {
    for (const s of [-1, 1]) {
      wheel(m, [x, s * (hy - 1.2), spec.wheelR], spec.wheelR, 2.0, { phase: frame / 2, rimOnly: burnt, hub: 'silver', tread: 9 });
    }
  }
  const b = new Model();
  const glass = burnt ? 'glassBroken' : 'glass';
  const front = spec.nose ? hx - spec.nose[0] : hx;
  b.box('dark', [-hx + 1.5, -hy + 1.2, spec.sill - 0.6], [hx - 1.5, hy - 1.2, spec.sill + 1]);
  b.box(spec.body, [-hx, -hy, spec.sill], [front, hy, spec.H])
    .cut([spec.H - spec.screenZ, 0, spec.rake], [front, 0, spec.screenZ])
    .bevel(spec.bevel ?? 0.9, { top: true, vert: true })
    .paint((p, n, q) => {
      if (Math.abs(n[1]) > 0.6) {
        for (const wx of spec.wheelX) {
          if ((q[0] - wx) ** 2 + (q[2] - spec.wheelR) ** 2 < (spec.wheelR + 0.9) ** 2) return 'dark';
        }
      }
      // Windscreen.
      if (n[0] > 0.5 && n[2] > -0.1 && q[2] > spec.screenZ + 0.4 && q[2] < spec.H - 0.9 && Math.abs(q[1]) < hy - 0.9) {
        if (!burnt && Math.abs(q[1] + (q[2] - spec.screenZ) * 0.9 - 1.2) < 0.55) return 'glassHi';
        return glass;
      }
      const s = spec.paint?.(p, n, q);
      if (s) return s;
      // Lamps.
      if (n[0] > 0.5 && !spec.nose && q[2] > spec.sill + 1.2 && q[2] < spec.sill + 2.6 && Math.abs(q[1]) > hy - 2.4)
        return burnt ? 'soot' : 'lampY';
      if (n[0] < -0.5 && q[2] > spec.sill + 1.2 && q[2] < spec.sill + 3.2 && Math.abs(q[1]) > hy - 1.8)
        return burnt ? 'soot' : 'lampR';
      return undefined;
    });
  if (spec.nose) {
    const [nl, nh] = spec.nose;
    b.box(spec.body, [front - 0.5, -hy + 0.2, spec.sill], [hx, hy - 0.2, nh])
      .bevel(0.9, { top: true, vert: true })
      .paint((p, n, q) => {
        if (Math.abs(n[1]) > 0.6) {
          for (const wx of spec.wheelX) {
            if ((q[0] - wx) ** 2 + (q[2] - spec.wheelR) ** 2 < (spec.wheelR + 0.9) ** 2) return 'dark';
          }
        }
        const s = spec.paint?.(p, n, q);
        if (s) return s;
        if (n[0] > 0.5 && q[2] > nh - 2.2 && Math.abs(q[1]) > hy - 2.6) return burnt ? 'soot' : 'lampY';
        if (n[0] > 0.5 && q[2] > nh - 2.4 && Math.abs(q[1]) < hy - 3.2) return 'grille';
        return undefined;
      });
    void nl;
  }
  b.box(burnt ? 'char' : 'dark', [hx - 0.3, -hy + 0.3, spec.sill], [hx + 0.6, hy - 0.3, spec.sill + 1.3]);
  b.box(burnt ? 'char' : 'dark', [-hx - 0.6, -hy + 0.3, spec.sill], [-hx + 0.3, hy - 0.3, spec.sill + 1.3]);
  if (!burnt) {
    for (const s of [-1, 1]) {
      b.boxc('dark', [front - 0.6, s * (hy + 0.6), spec.screenZ + 1.6], [0.6, 0.8, 2.0]);
    }
  }
  spec.extras?.(b, frame, state);
  m.add(b, [0, 0, burnt ? -1 : 0]);
  return m;
}

/** Blue lightbar on the roof; frames alternate left/right lamps. */
function lightbar(m: Model, at: V3, len: number, frame: number, state: CivState, colourA = 'lampB'): void {
  if (state === 'burnt') {
    m.boxc('char', at, [1.4, len, 0.9]);
    return;
  }
  const on = frame % 2 === 0;
  m.boxc('dark', [at[0], at[1], at[2] - 0.2], [1.6, len + 0.4, 0.5]);
  const a = on ? colourA : 'lampBoff';
  const c = on ? 'lampBoff' : colourA;
  m.boxc(a, [at[0], at[1] - len / 4, at[2] + 0.4], [1.4, len / 2 - 0.2, 0.9]);
  m.boxc(c, [at[0], at[1] + len / 4, at[2] + 0.4], [1.4, len / 2 - 0.2, 0.9]);
}

function sideDecals(m: Model, hy: number, img: ReturnType<typeof text>, x0: number, z: number): void {
  // Right side reads front→back… we want front-to-back = left-to-right only when the reader
  // sees the right side; decals take their reading direction from the face normal.
  m.decal({ at: [x0, hy + 0.02, z], n: [0, 1, 0], img });
  m.decal({ at: [x0 + img.w, -hy - 0.02, z], n: [0, -1, 0], img });
}

/** Burnt shell: every material charred, decals gone, soot streaks above windows. */
function burn(m: Model): Model {
  for (const p of m.prims) {
    p.mat = burntKey(p.mat);
    const paint = p.paint;
    if (paint) p.paint = (a, n, q) => {
      const k = paint(a, n, q);
      return k ? burntKey(k) : undefined;
    };
  }
  m.decals.length = 0;
  return m;
}

// ---------------------------------------------------------------------------------------------
// Vehicle catalogue
// ---------------------------------------------------------------------------------------------

type Builder = (frame: number, state: CivState) => Model;

const hatch = (body: string, roofMat?: string): Builder => (f, s) =>
  car(
    {
      L: 19,
      W: 9.6,
      wheelR: 2.3,
      wheelX: [-6.0, 6.2],
      sill: 1.3,
      belt: 5.0,
      roof: 8.4,
      cabin: [-8.8, 3.6],
      rake: [0.8, 3.4],
      body,
      roofMat,
      nose: 1.8,
      tail: 0.6,
    },
    f,
    s,
  );

const sedan = (body: string, extras?: CarSpec['extras'], side?: Paint): Builder => (f, s) =>
  car(
    {
      L: 22,
      W: 9.8,
      wheelR: 2.3,
      wheelX: [-7.0, 7.2],
      sill: 1.3,
      belt: 5.0,
      roof: 8.2,
      cabin: [-6.4, 4.4],
      rake: [2.8, 3.4],
      body,
      nose: 1.4,
      tail: 0.8,
      extras,
      side,
    },
    f,
    s,
  );

/** Madrid taxi: white saloon, red diagonal band on the front doors, green roof lamp + sign. */
const taxiMadrid: Builder = sedan(
  'white',
  (m, f, s) => {
    if (s === 'burnt') return;
    m.boxc('white', [-1.4, 0, 8.8], [1.4, 3.6, 1.2]);
    m.boxc(f % 2 === 0 ? 'lampGreen' : 'lampGreenDk', [-1.4, 0, 9.6], [0.8, 0.8, 0.5]);
  },
  (_p, n, q) => (Math.abs(n[1]) > 0.6 && Math.abs(q[0] - 1.8 + (q[2] - 1) * 0.8) < 1.0 && q[2] < 5.2 ? 'red' : undefined),
);

/** London black cab: tall, round, TAXI sign glowing amber. */
const cabLondon: Builder = (f, s) =>
  car(
    {
      L: 20,
      W: 9.6,
      wheelR: 2.4,
      wheelX: [-6.4, 6.6],
      sill: 1.4,
      belt: 5.0,
      roof: 9.8,
      cabin: [-8.4, 4.0],
      rake: [1.8, 3.2],
      body: 'black',
      nose: 1.8,
      tail: 1.2,
      hub: 'chrome',
      extras: (m, _f, st) => {
        if (st === 'burnt') return;
        m.boxc('lampAmber', [1.0, 0, 10.2], [0.9, 2.6, 0.9]);
        m.box('chrome', [9.7, -2.6, 2.6], [10.3, 2.6, 4.6]).paint((_p, n, q) =>
          n[0] > 0.5 && Math.floor(q[1] + 10) % 2 ? 'dark' : undefined,
        );
      },
    },
    f,
    s,
  );

/** Paris: 2CV-ish — narrow body, separate round wings, corrugated bonnet, roll-top canvas roof. */
const deuche: Builder = (f, s) => {
  const burnt = s === 'burnt';
  const m = new Model();
  for (const x of [-6.2, 6.6]) for (const y of [-3.6, 3.6]) wheel(m, [x, y, 2.2], 2.2, 1.4, { phase: f / 2, rimOnly: burnt, hub: 'cream', tread: 8 });
  const b = new Model();
  const body = 'mint';
  b.box('dark', [-7, -2.6, 0.9], [7.6, 2.6, 2.4]);
  // Wings (mudguards) over each wheel.
  for (const x of [-6.2, 6.6]) for (const y of [-3.7, 3.7]) b.ell(body, [x, y, 3.0], [3.0, 1.3, 1.9]).cut([0, 0, -1], [0, 0, 2.0]);
  // Bonnet: sloped, ribbed.
  b.box(body, [3.4, -3.0, 2.0], [9.2, 3.0, 5.4])
    .cut([1, 0, 2.2], [9.2, 0, 3.2])
    .bevel(0.8, { top: true, vert: true })
    .paint((_p, n, q) => {
      if (n[2] > 0.5 && Math.floor(q[1] * 1.4 + 10) % 2 === 0) return 'mintDk';
      if (n[0] > 0.5 && Math.abs(q[1]) < 1.6 && q[2] < 4.6) return 'chrome';
      return undefined;
    });
  for (const y of [-2.6, 2.6]) b.ell('chrome', [8.8, y, 4.6], [0.9, 0.9, 0.9]).paint((_p, n) => (n[0] > 0.6 && !burnt ? 'lampY' : undefined));
  // Cabin: tall, rounded "umbrella on wheels".
  b.box(body, [-8.4, -3.4, 2.0], [3.6, 3.4, 8.8])
    .cut([1, 0, 0.35], [3.6, 0, 5.4])
    .cut([-1, 0, 0.9], [-8.4, 0, 4.4])
    .bevel(1.4, { top: true, vert: true })
    .paint((_p, n, q) => {
      if (q[2] > 8.0 && q[0] > -6.6 && q[0] < 2.2 && Math.abs(n[2]) > 0.4) return burnt ? 'inkFlat' : 'canvasGrey';
      if (q[2] > 5.4 && q[2] < 8.0) {
        if (Math.abs(n[1]) > 0.6 && Math.abs(q[0] + 2.2) > 0.4 && q[0] > -7.6 && q[0] < 2.8) return burnt ? 'glassBroken' : 'glass';
        if (n[0] > 0.5 && Math.abs(q[1]) < 2.6) return burnt ? 'glassBroken' : Math.abs(q[1] - 1) < 0.4 ? 'glassHi' : 'glass';
      }
      if (n[0] < -0.5 && q[2] < 5 && Math.abs(q[1]) > 2.2) return burnt ? 'soot' : 'lampR';
      return undefined;
    });
  b.boxc('chrome', [9.4, 0, 2.2], [0.6, 6.0, 0.8]);
  m.add(b, [0, 0, burnt ? -0.9 : 0]);
  return m;
};

/** Paris: Twingo-ish one-box city car with a big smiley face. */
const twingo: Builder = (f, s) =>
  car(
    {
      L: 16,
      W: 9.0,
      wheelR: 2.1,
      wheelX: [-5.2, 5.0],
      sill: 1.2,
      belt: 4.6,
      roof: 8.8,
      cabin: [-7.6, 6.0],
      rake: [0.6, 5.0],
      body: 'yellow',
      nose: 0.6,
      tail: 0.4,
      extras: (m, _f, st) => {
        if (st === 'burnt') return;
        for (const y of [-2.8, 2.8]) m.ell('lampW', [7.7, y, 4.3], [0.5, 0.9, 0.9]);
      },
    },
    f,
    s,
  );

/** Delivery van: white panel van with an orange stripe and roof rack. */
const deliveryVan: Builder = (f, s) =>
  boxVehicle(
    {
      L: 23,
      W: 10,
      H: 11.5,
      wheelR: 2.4,
      wheelX: [-7.2, 7.4],
      sill: 1.4,
      body: 'white',
      screenZ: 6.0,
      rake: 2.6,
      nose: [2.2, 6.0],
      paint: (_p, n, q) => {
        if (Math.abs(n[1]) > 0.6) {
          if (q[2] > 4.6 && q[2] < 5.8) return 'orange';
          if (q[0] > 5.2 && q[0] < 8.2 && q[2] > 7 && q[2] < 10) return 'glass';
        }
        if (n[0] < -0.6 && Math.abs(q[1]) < 0.3) return 'gray';
        return undefined;
      },
      extras: (m, _f, st) => {
        if (st === 'burnt') return;
        for (const x of [-9, -3, 3]) m.box('gun', [x - 0.4, -4.6, 11.5], [x + 0.4, 4.6, 12.1]);
        for (const y of [-4.4, 4.4]) m.box('gun', [-10, y - 0.3, 12.1], [4, y + 0.3, 12.5]);
        m.box('cardboard', [-8, -3, 12.1], [-4, 1, 13.9]);
      },
    },
    f,
    s,
  );

/** Ministry police van: navy with a hi-vis Battenburg band, POLICE lettering, blue lightbar. */
const policeVan: Builder = (f, s) =>
  boxVehicle(
    {
      L: 28,
      W: 11,
      H: 12.4,
      wheelR: 2.6,
      wheelX: [-9.0, 9.4],
      sill: 1.6,
      body: 'navy',
      screenZ: 6.4,
      rake: 2.4,
      nose: [2.4, 6.4],
      paint: (_p, n, q) => {
        if (Math.abs(n[1]) > 0.6) {
          if (q[2] > 3.2 && q[2] < 6.0) return (Math.floor((q[0] + 40) / 1.5) + Math.floor((q[2] + 40) / 1.4)) % 2 ? 'hivisPaint' : 'blue';
          if (q[0] > 7.4 && q[0] < 10.6 && q[2] > 7.2 && q[2] < 11) return 'glass';
          if (q[0] < -2 && q[2] > 8.6 && q[2] < 10.4 && Math.floor((q[0] + 40) / 3) % 2 === 0) return 'glassGrille';
        }
        if (n[0] < -0.6) {
          if (Math.abs(q[1]) < 0.3) return 'navyDk';
          if (q[2] > 3.2 && q[2] < 5.8) return (Math.floor((q[1] + 40) / 1.5) + Math.floor((q[2] + 40) / 1.4)) % 2 ? 'hivisPaint' : 'blue';
        }
        return undefined;
      },
      extras: (m, fr, st) => {
        lightbar(m, [8.6, 0, 12.8], 7, fr, st);
        if (st === 'ok') sideDecals(m, 5.5, text('POLICE', 'white'), -13.4, 11.6);
        if (st === 'ok') m.boxc('steel', [-14.4, 0, 2.6], [0.8, 4, 0.6]);
      },
    },
    f,
    s,
  );

/** Ambulance: yellow/green Battenburg box ambulance with red crosses and blue lights. */
const ambulance: Builder = (f, s) =>
  boxVehicle(
    {
      L: 27,
      W: 11,
      H: 13,
      wheelR: 2.5,
      wheelX: [-8.6, 9.2],
      sill: 1.6,
      body: 'white',
      screenZ: 6.4,
      rake: 2.4,
      nose: [2.4, 6.4],
      paint: (_p, n, q) => {
        if (Math.abs(n[1]) > 0.6) {
          if (q[2] > 2.6 && q[2] < 5.4) return (Math.floor((q[0] + 40) / 1.5) + Math.floor((q[2] + 40) / 1.4)) % 2 ? 'hivisPaint' : 'green';
          if (q[0] > 7.0 && q[0] < 10.2 && q[2] > 7.2 && q[2] < 11) return 'glass';
          if (q[2] > 11.6) return 'hivisPaint';
        }
        if (n[0] < -0.6 && q[2] > 2.6 && q[2] < 5.4) return (Math.floor((q[1] + 40) / 1.5) + Math.floor((q[2] + 40) / 1.4)) % 2 ? 'hivisPaint' : 'green';
        return undefined;
      },
      extras: (m, fr, st) => {
        lightbar(m, [8.6, 0, 13.4], 7, fr, st);
        if (st === 'ok') {
          for (const s2 of [-1, 1]) m.decal({ at: [s2 > 0 ? -4 : 0, s2 * 5.52, 10], n: [0, s2, 0], img: STENCILS.cross });
          m.decal({ at: [-13.52, -2, 10.5], n: [-1, 0, 0], img: STENCILS.cross });
        }
      },
    },
    f,
    s,
  );

/** Fire engine: red, white stripe, ladder on the roof, lightbar. */
const fireTruck: Builder = (f, s) =>
  boxVehicle(
    {
      L: 34,
      W: 11.6,
      H: 12,
      wheelR: 2.9,
      wheelX: [-10, -4.4, 11],
      sill: 1.8,
      body: 'redBus',
      screenZ: 6.8,
      rake: 1.6,
      paint: (_p, n, q) => {
        if (Math.abs(n[1]) > 0.6) {
          if (q[2] > 5.0 && q[2] < 5.8) return 'white';
          if (q[0] > 9 && q[2] > 7.4 && q[2] < 10.6 && Math.abs(q[0] - 12.2) > 0.4) return 'glass';
          if (q[0] < 6 && q[2] > 6.4 && q[2] < 10.6 && Math.floor((q[0] + 40) / 4.2) !== Math.floor((q[0] + 40.5) / 4.2)) return 'redDk';
        }
        if (n[0] > 0.5 && q[2] < 4.6 && Math.abs(q[1]) < 3.4) return 'chrome';
        return undefined;
      },
      extras: (m, fr, st) => {
        lightbar(m, [12.6, 0, 12.4], 8, fr, st);
        const rail = st === 'burnt' ? 'char' : 'silver';
        for (const y of [-2.2, 2.2]) m.box(rail, [-16.5, y - 0.35, 12.8], [9, y + 0.35, 13.5]);
        for (let x = -15.5; x < 9; x += 2) m.box(rail, [x - 0.25, -2.2, 12.9], [x + 0.25, 2.2, 13.3]);
        for (const x of [-15, 6]) m.box('dark', [x - 0.5, -2.6, 12], [x + 0.5, 2.6, 12.8]);
        if (st === 'ok') m.box('chrome', [-17.6, -4, 2.4], [-17, 4, 3.2]);
      },
    },
    f,
    s,
  );

interface BusSpec {
  body: string;
  decks: 1 | 2;
  band?: string;
  skirt?: string;
  roofMat?: string;
  extras?: (m: Model, frame: number, state: CivState) => void;
}

/** City bus, single or double deck. */
const bus = (spec: BusSpec): Builder => (f, s) => {
  const H = spec.decks === 2 ? 23 : 14.5;
  const winRows: Array<[number, number]> = spec.decks === 2 ? [[7.4, 11.4], [15.4, 20.0]] : [[6.6, 12.4]];
  return boxVehicle(
    {
      L: 42,
      W: 12,
      H,
      wheelR: 2.9,
      wheelX: [-12.5, 14],
      sill: 1.8,
      body: spec.body,
      screenZ: 5.6,
      rake: 0.8,
      bevel: 1.2,
      paint: (_p, n, q) => {
        const side = Math.abs(n[1]) > 0.6;
        if (side || n[0] < -0.6) {
          for (const [z0, z1] of winRows) {
            if (q[2] > z0 && q[2] < z1) {
              const u = side ? q[0] : q[1];
              if (side && Math.floor((u + 40) / 5) !== Math.floor((u + 40.6) / 5)) return spec.body;
              if (side && q[0] > 16.8 && z0 < 8 && spec.decks === 1) return 'glass';
              if (side && Math.abs(q[0] - 15.4) < 1.6 && z0 < 8) return 'dark';
              return Math.abs(u - (q[2] - z0) * 0.8 - 2) < 0.4 && s === 'ok' ? 'glassHi' : 'glass';
            }
          }
          if (side && Math.abs(q[0] - 15.4) < 1.6 && q[2] < 7.4) return 'dark'; // front door
          if (side && Math.abs(q[0] + 1.5) < 1.6 && q[2] < 6.6) return 'dark'; // middle door
        }
        if (spec.skirt && q[2] < 4.6 && Math.abs(n[2]) < 0.6) return spec.skirt;
        if (spec.band && q[2] > 13.0 && q[2] < 14.6 && spec.decks === 2) return spec.band;
        if (spec.band && spec.decks === 1 && q[2] > 4.6 && q[2] < 5.8) return spec.band;
        if (spec.roofMat && n[2] > 0.6) return spec.roofMat;
        // Destination blind.
        if (n[0] > 0.5 && q[2] > H - 3 && q[2] < H - 1.2 && Math.abs(q[1]) < 4) return s === 'ok' ? 'lampAmber' : 'dark';
        return undefined;
      },
      extras: spec.extras,
    },
    f,
    s,
  );
};

const busLondon = bus({
  body: 'redBus',
  decks: 2,
  band: 'cream',
  skirt: 'redDk',
  roofMat: 'redBus',
  extras: (m, _f, s) => {
    if (s === 'ok') {
      sideDecals(m, 6, text('LONDON', 'gray7'), -10, 5.6);
    }
  },
});
const busMadrid = bus({
  body: 'white',
  decks: 1,
  band: 'red',
  skirt: 'blue',
  roofMat: 'blue',
  extras: (m, _f, s) => {
    if (s === 'ok') sideDecals(m, 6, text('EMT', 'navy1'), -18, 4.4);
  },
});
const busParis = bus({
  body: 'white',
  decks: 1,
  band: 'teal',
  skirt: 'teal',
  extras: (m, _f, s) => {
    if (s === 'ok') {
      for (const sd of [-1, 1]) m.decal({ at: [sd > 0 ? -8 : -4, sd * 6.02, 4.2], n: [0, sd, 0], img: STENCILS.ratp });
    }
  },
});

/** Vespa: parked (no rider) or ridden. */
const vespa = (body: string, rider: boolean): Builder => (f, s) => {
  const burnt = s === 'burnt';
  const m = new Model();
  for (const x of [-3.2, 3.4]) wheel(m, [x, 0, 1.3], 1.3, 1.0, { phase: f / 2, rimOnly: burnt, hub: 'silver', tread: 6 });
  const b = new Model();
  b.ell(body, [-2.6, 0, 2.6], [2.6, 1.9, 1.7]).cut([0, 0, -1], [0, 0, 1.6]);
  b.box('dark', [-1.4, -0.9, 1.2], [2.0, 0.9, 1.9]);
  b.box(body, [2.4, -1.5, 1.4], [3.4, 1.5, 6.0]).bevel(0.4, { vert: true }).paint((_p, n, q) => (n[0] > 0.5 && q[2] > 5.0 && !burnt ? 'lampY' : undefined));
  b.ell(body, [3.4, 0, 2.2], [1.4, 0.9, 1.2]);
  b.box('black', [-4.4, -1.0, 4.2], [-0.6, 1.0, 4.9]).bevel(0.3, { top: true });
  b.box('chrome', [2.8, -2.2, 6.0], [3.4, 2.2, 6.5]);
  if (rider && !burnt) {
    const r = new Model();
    crew(r, [0, 0, 0], { helmet: 'helmetRed', body: 'denim', goggles: true, gripX: 2.6, gripZ: 2.2 });
    b.add(r, [-2.0, 0, 4.6]);
    for (const y of [-1.1, 1.1]) b.box('denim', [-2.2, y - 0.5, 2.2], [0.2, y + 0.5, 5.0]);
  }
  m.add(b, [0, 0, burnt ? -0.8 : 0]);
  if (burnt) burn(m);
  return m;
};

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

interface CivDef {
  id: string;
  build: Builder;
  /** Lights flash → parked is a 2-frame anim. */
  flashing?: boolean;
  /** Generate burnt & overturned variants. */
  burnt?: boolean;
  flipped?: boolean;
  burning?: boolean;
  /** Half-width (for the overturned pose: lies on its side). */
  hw: number;
}

const CIVS: CivDef[] = [
  { id: 'police_van', build: policeVan, flashing: true, burnt: true, flipped: true, hw: 5.5 },
  { id: 'ambulance', build: ambulance, flashing: true, burnt: true, hw: 5.5 },
  { id: 'fire_truck', build: fireTruck, flashing: true, hw: 5.8 },
  { id: 'bus_london', build: busLondon, burnt: true, burning: true, hw: 6 },
  { id: 'bus_madrid', build: busMadrid, burnt: true, burning: true, hw: 6 },
  { id: 'bus_paris', build: busParis, burnt: true, burning: true, hw: 6 },
  { id: 'cab_london', build: cabLondon, burnt: true, flipped: true, hw: 4.8 },
  { id: 'taxi_madrid', build: taxiMadrid, burnt: true, flipped: true, hw: 4.9 },
  { id: 'car_2cv', build: deuche, burnt: true, flipped: true, hw: 4.4 },
  { id: 'car_twingo', build: twingo, burnt: true, flipped: true, hw: 4.5 },
  { id: 'hatch', build: hatch('red'), burnt: true, flipped: true, burning: true, hw: 4.8 },
  { id: 'hatch_blue', build: hatch('blue'), hw: 4.8 },
  { id: 'hatch_white', build: hatch('white'), hw: 4.8 },
  { id: 'hatch_yellow', build: hatch('yellow'), hw: 4.8 },
  { id: 'hatch_green', build: hatch('green'), hw: 4.8 },
  { id: 'hatch_silver', build: hatch('silver'), hw: 4.8 },
  { id: 'sedan', build: sedan('plum'), burnt: true, flipped: true, burning: true, hw: 4.9 },
  { id: 'sedan_black', build: sedan('black'), hw: 4.9 },
  { id: 'sedan_beige', build: sedan('beige'), hw: 4.9 },
  { id: 'sedan_teal', build: sedan('teal'), hw: 4.9 },
  { id: 'delivery_van', build: deliveryVan, burnt: true, flipped: true, hw: 5 },
  { id: 'scooter', build: vespa('mint', false), burnt: true, flipped: true, hw: 1.6 },
  { id: 'scooter_red', build: vespa('red', false), hw: 1.6 },
];

const RIDERS: Record<string, Builder> = {
  scooter: vespa('mint', true),
  scooter_red: vespa('red', true),
};

/** Ids of every decor vehicle (for spawners). */
export const CIVIL_IDS = CIVS.map((c) => c.id);

export function registerCivil(reg: SpriteRegistry): void {
  for (const c of CIVS) {
    for (const d of DIR4) {
      const v: View = { yaw: yaw8(d as Dir4) };
      const add = (name: string, models: Model[], fps: number, view: View = v, tags: string[] = []) => {
        const a = renderAnim(models, MATS, view);
        reg.add(`veh.${c.id}.${name}.${d}`, { group: G, frames: a.frames, fps, anchor: a.anchor, hasShadow: true, tags: ['decor', ...tags] });
      };
      const driver = RIDERS[c.id] ?? c.build;
      add('drive', [0, 1, 2, 3].map((f) => driver(f, 'ok')), 10);
      add('parked', (c.flashing ? [0, 1] : [0]).map((f) => c.build(f, 'ok')), c.flashing ? 4 : 0);
      if (c.burnt) add('burnt', [burn(c.build(0, 'burnt'))], 0, v, ['aftermath']);
      if (c.flipped) {
        // On its side (left side up), resting on the ground.
        const fv: View = { yaw: v.yaw, roll: -90, offset: [0, 0, c.hw] };
        add('flipped', [c.build(0, 'ok')], 0, fv, ['aftermath']);
      }
      if (c.burning) {
        const frames = [0, 1, 2, 3].map((f) => {
          const m = burn(c.build(0, 'burnt'));
          const big = c.id.startsWith('bus');
          flame(m, [big ? 8 : 2, 0, big ? 13 : 7], f, true, 0);
          flame(m, [big ? -6 : -3, big ? 2 : 1, big ? 13 : 6], f, big, 2);
          if (big) flame(m, [-16, -2, 12], f, false, 1);
          smokeColumn(m, [0, 0, big ? 22 : 14], f, 'dark', 3, 5);
          return m;
        });
        add('burning', frames, 8, v, ['aftermath']);
      }
    }
  }
}
