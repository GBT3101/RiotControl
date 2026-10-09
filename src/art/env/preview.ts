/**
 * Composed environment preview (gallery review image, registered as `env.preview.<city>`):
 * a 16×19-tile street corner — avenue with markings and crossings, kerbed pavements, a row of
 * buildings, trees, lamps, café terrace, a bit of park, a quay and a bridge over water.
 * Uses the same pure APIs the world view (M8) will use: groundTile, paintBuilding, propSprite.
 */
import type { BuildingData, BuildingKind, CityId, RoofType } from '../../maps/contract';
import type { PixelBuffer } from '../lib/pixels';
import { paintBuilding } from './bld/building';
import { decalSprite, getDecal } from './decals';
import { getProp, propSprite } from './props';
import { addDecal, addSprite, renderScene, sceneFromRows, type Scene } from './scene';

// prettier-ignore
const ROWS = [
  'LLLLLLLSSAAASSLL',
  'LLLLLLLSSAAASSLL',
  'LLLLLLLSSAAASSLL',
  'LLLLLLLSSAAASSLL',
  'SSSSSSSSSAAASSSS',
  'SSSSSSSSSAAASSSS',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'SSSSSSSSSAAASSSS',
  'SSSSSSSSSAAASSPP',
  'GGGGGGGSSAAASSPP',
  'GRRRRRGSSAAASSPP',
  'GGGGGRGSSAAASSPP',
  'QQQQQQQQQBBBQQQQ',
  'WWWWWWWWWBBBWWWW',
  'WWWWWWWWWBBBWWWW',
];
// prettier-ignore
const MARKS = [
  '..........S.....',
  '........../.....',
  '..........S.....',
  '........../.....',
  '.........SS.....',
  '.........ZZZ....',
  '.......z.....z..',
  '.......z.....z..',
  '-------z.....z--',
  '.......z.....z..',
  '.......z.....z..',
  '.........ZZZ....',
  '..........S.....',
  '........../.....',
  '................',
  '........../.....',
  '................',
  '........../.....',
  '................',
];

interface CityPlan {
  blds: Array<
    [
      i: number,
      j: number,
      w: number,
      d: number,
      storeys: number,
      roof: RoofType,
      kind: BuildingKind,
    ]
  >;
  park: [string, string];
  street: string;
}

const PLANS: Record<CityId, CityPlan> = {
  madrid: {
    blds: [
      [0, 0, 3, 4, 5, 'terrace', 'residential'],
      [3, 0, 2, 4, 4, 'pitched', 'commercial'],
      [5, 0, 2, 4, 6, 'flat', 'commercial'],
      [14, 0, 2, 4, 5, 'pitched', 'residential'],
    ],
    park: ['tree.pine', 'tree.plane'],
    street: 'tree.plane',
  },
  london: {
    blds: [
      [0, 0, 3, 4, 4, 'pitched', 'residential'],
      [3, 0, 2, 4, 4, 'pitched', 'commercial'],
      [5, 0, 2, 4, 5, 'flat', 'commercial'],
      [14, 0, 2, 4, 5, 'mansard', 'residential'],
    ],
    park: ['tree.oak', 'tree.plane'],
    street: 'tree.plane',
  },
  paris: {
    blds: [
      [0, 0, 3, 4, 6, 'mansard', 'residential'],
      [3, 0, 2, 4, 6, 'mansard', 'commercial'],
      [5, 0, 2, 4, 5, 'mansard', 'commercial'],
      [14, 0, 2, 4, 6, 'mansard', 'residential'],
    ],
    park: ['tree.chestnut', 'tree.plane'],
    street: 'tree.plane',
  },
};

function prop(s: Scene, name: string, i: number, j: number, du = 0.5, dv = 0.5): void {
  const p = getProp(name);
  const u = i + du;
  const v = j + dv;
  const x = Math.round((u - v) * 16);
  const y = Math.round((u + v) * 8);
  addSprite(s, p.frames[0]!, p.anchor, x, y, undefined, p.light);
  if (name.startsWith('prop.lamp') || name.startsWith('prop.metro.paris')) s.pools.push([x, y, 9]);
}

function decal(s: Scene, name: string, i: number, j: number): void {
  const d = getDecal(name);
  addDecal(s, d.img, d.anchor, Math.round((i - j) * 16), Math.round((i + j + 1) * 8));
}

export function previewScene(city: CityId): Scene {
  const s = sceneFromRows(city, ROWS, MARKS);
  const plan = PLANS[city];
  const P = (kind: string, seed = 0, axis: 'i' | 'j' = 'i'): string =>
    propSprite(kind, city, seed, axis);
  // Buildings (+ cast shadows as decals).
  plan.blds.forEach(([i, j, w, d, storeys, roof, kind], k) => {
    const spec: BuildingData = {
      id: k,
      i,
      j,
      w,
      d,
      storeys,
      style: city,
      kind,
      roof,
      rooftop: k === 2,
      doors: [{ i: i + Math.floor(w / 2), j: j + d }],
      seed: (city === 'madrid' ? 1005 : 1000) + k * 77 + city.length,
    };
    const art = paintBuilding(spec);
    const wx = (i - j) * 16;
    const wy = (i + j) * 8;
    addDecal(s, art.shadow, art.shadowAnchor, wx, wy);
    addSprite(s, art.image, art.anchor, wx, wy, (i + j + Math.min(w, d)) * 8 * 4096, art.lights);
  });
  // Street trees and lamps on the far pavement (row 5) and near pavement (row 11).
  for (const i of [1, 4]) prop(s, P(plan.street, i), i, 5);
  for (const i of [0, 3, 6]) prop(s, P('tree.' + plan.street.split('.')[1]!, i + 9), i, 11);
  prop(s, P('lamp'), 2, 4, 0.5, 0.8);
  prop(s, P('lamp'), 6, 5, 0.5, 0.7);
  prop(s, P('lamp'), 14, 5, 0.5, 0.7);
  prop(s, P('lamp'), 5, 11, 0.5, 0.3);
  prop(s, P('lamp'), 13, 11, 0.5, 0.3);
  // Corner furniture.
  prop(s, P('trafficlight'), 8, 5, 0.8, 0.8);
  prop(s, P('trafficlight'), 12, 11, 0.2, 0.2);
  prop(s, P('bin'), 8, 11, 0.7, 0.3);
  prop(s, P('bench', 1), 2, 12);
  prop(s, P('busstop'), 3, 4, 0.5, 0.6);
  prop(s, P('bike', 0, 'j'), 7, 4);
  prop(s, P('bike', 1, 'j'), 7, 3, 0.5, 0.4);
  for (const i of [9, 10, 11]) prop(s, P('bollard'), i, 12, 0.5, 0.2);
  prop(s, P('hydrant'), 13, 4, 0.3, 0.3);
  prop(s, P('sign', 0), 12, 5, 0.2, 0.8);
  // City icons.
  if (city === 'paris') {
    prop(s, P('morris'), 13, 12);
    prop(s, P('wallace'), 7, 14);
    prop(s, P('metro'), 13, 4, 0.5, 0.7);
    prop(s, P('kiosk'), 15, 5);
  } else if (city === 'london') {
    prop(s, P('phonebox'), 13, 12);
    prop(s, P('postbox'), 7, 12, 0.6, 0.4);
    prop(s, P('metro'), 13, 5, 0.3, 0.7);
    prop(s, P('kiosk'), 15, 5);
  } else {
    prop(s, P('kiosk'), 13, 12);
    prop(s, P('metro'), 13, 5, 0.3, 0.7);
    prop(s, P('flag'), 7, 14);
  }
  // Café terrace on the plaza.
  prop(s, P('cafe', 0), 14, 13);
  prop(s, P('cafe', 1), 15, 12);
  prop(s, P('cafe', 2), 15, 14);
  prop(s, P('planter', 0), 14, 15);
  // Park: trees, hedge, bush, statue, bench.
  prop(s, P(plan.park[0], 1), 1, 13);
  prop(s, P(plan.park[1], 2), 4, 13, 0.3, 0.5);
  prop(s, P(plan.park[0], 3), 0, 15);
  prop(s, P('bush', 1), 6, 13);
  prop(s, P('bush', 2), 3, 15);
  prop(s, P('statue'), 2, 14, 0.5, 0.2);
  prop(s, P('bench', 2, 'i'), 4, 15);
  prop(s, P('lamp'), 6, 15, 0.5, 0.5);
  // Life & wear.
  prop(s, 'prop.pigeon.idle', 14, 14, 0.2, 0.3);
  prop(s, 'prop.pigeon.peck', 13, 14, 0.6, 0.6);
  prop(s, 'prop.pigeon.peck', 2, 5, 0.6, 0.6);
  prop(s, P('cone'), 0, 10, 0.6, 0.3);
  prop(s, P('cone'), 1, 10, 0.4, 0.3);
  decal(s, decalSprite('tag', city.length), 6, 5);
  decal(s, decalSprite('puddle', 1), 3, 9);
  decal(s, decalSprite('leaflets', 0), 10, 13);
  decal(s, decalSprite('litter', 2), 8, 12);
  decal(s, decalSprite('tyre', 0, 'i'), 2, 7);
  return s;
}

/** Render the composed preview for a city. */
export function renderPreview(city: CityId, night = false): PixelBuffer {
  return renderScene(previewScene(city), 104, 6, night);
}

/** Night version: dimmed scene, lit windows, shopfronts and lamp light pools. */
export function renderPreviewNight(city: CityId): PixelBuffer {
  return renderPreview(city, true);
}
