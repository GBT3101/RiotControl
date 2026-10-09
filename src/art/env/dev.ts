/**
 * Dev-only review helpers (not registered): terrain test patch, building line-ups, a prop contact
 * sheet and a perf probe. Render them with any vite runner (see docs/art/M3a.md).
 */
import type { CityId } from '../../maps/contract';
import type { PixelBuffer } from '../lib/pixels';
import { renderScene, sceneFromRows } from './scene';
import { paintBuilding } from './bld/building';
import { createBuffer } from '../lib/pixels';
import { stamp } from './util';
import type { RoofType, BuildingKind } from '../../maps/contract';
import { buildProps } from './props';
import { renderPreview } from './preview';

export { renderPreview };

// prettier-ignore
const TEST_ROWS = [
  'GGGGGRGGSSAAAASS',
  'GGGGGRGGSSAAAASS',
  'GGRRRRGGSSAAAASS',
  'GGGGGRGGSSAAAASS',
  'SSSSSSSSSSAAAASS',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAA',
  'SSSSSSSSSSAAAASS',
  'QQQQQQQQSSAAAASS',
  'WWWWWWWWQSBBBBSS',
  'WWWWWWWWWWBBBBWW',
  'WWWWWWWWWWBBBBWW',
  'PPPPCCCCWWBBBBWW',
  'PPTTCCCCQQSSSSQQ',
];
// prettier-ignore
const TEST_MARKS = [
  '................',
  '................',
  '...........//...',
  '...........//...',
  '..........ZZZZ..',
  '................',
  '-------.....----',
  '................',
  '................',
  '..........zzzz..',
  '................',
  '...........//...',
  '...........//...',
  '...........//...',
  '................',
  '................',
];

export function testTerrain(city: CityId): PixelBuffer {
  return renderScene(sceneFromRows(city, TEST_ROWS, TEST_MARKS), 16, 8);
}

export function testBuildings(city: CityId, seed = 1): PixelBuffer {
  const specs: Array<[number, number, number, RoofType, BuildingKind]> = [
    [3, 2, 4, 'pitched', 'residential'],
    [2, 2, 5, 'flat', 'commercial'],
    [4, 3, 6, city === 'paris' ? 'mansard' : 'terrace', 'commercial'],
    [1, 1, 3, 'pitched', 'residential'],
    [3, 3, 3, 'mansard', 'residential'],
    [2, 4, 2, 'flat', 'civic'],
  ];
  const arts = specs.map(([w, d, storeys, roof, kind], k) =>
    paintBuilding({ w, d, storeys, roof, kind, style: city, rooftop: false, seed: seed * 100 + k }),
  );
  const W = arts.reduce((a, b) => a + b.image.w + 4, 4);
  const H = Math.max(...arts.map((a) => a.image.h)) + 4;
  const out = createBuffer(W, H);
  let x = 4;
  for (const a of arts) {
    stamp(out, a.image, x, H - a.image.h - 2);
    x += a.image.w + 4;
  }
  return out;
}

export function perfBuildings(n = 400): PixelBuffer {
  const t0 = performance.now();
  const cities: CityId[] = ['madrid', 'london', 'paris'];
  const roofs: RoofType[] = ['flat', 'pitched', 'mansard', 'terrace'];
  for (let k = 0; k < n; k++) {
    const w = 1 + (k % 5);
    const d = 1 + ((k * 7) % 4);
    paintBuilding({
      w,
      d,
      storeys: 2 + (k % 5),
      roof: roofs[k % 4]!,
      kind: k % 3 === 0 ? 'commercial' : 'residential',
      style: cities[k % 3]!,
      rooftop: false,
      seed: k * 31 + 7,
    });
  }
  console.info('buildings ms', (performance.now() - t0).toFixed(0));
  return createBuffer(1, 1);
}

/** Contact sheet of every prop (first frame), for review. */
export function testProps(filter = ''): PixelBuffer {
  const all = buildProps().filter((p) => p.name.includes(filter) && !p.name.endsWith('.j'));
  const W = 560;
  let x = 4;
  let y = 4;
  let rowH = 0;
  const pos: Array<[number, number]> = [];
  for (const p of all) {
    const f = p.sprite.frames[0]!;
    if (x + f.w > W) {
      x = 4;
      y += rowH + 6;
      rowH = 0;
    }
    pos.push([x, y]);
    x += f.w + 6;
    rowH = Math.max(rowH, f.h);
  }
  const out = createBuffer(W, y + rowH + 4);
  all.forEach((p, k) => stamp(out, p.sprite.frames[0]!, pos[k]![0], pos[k]![1]));
  return out;
}

/** Review sheet: one building line-up per city above the prop contact sheet. */
export function kitSheet(): PixelBuffer {
  const parts = [testBuildings('madrid', 3), testBuildings('london', 3), testBuildings('paris', 3), testProps()];
  const W = Math.max(...parts.map((p) => p.w));
  const H = parts.reduce((a, p) => a + p.h + 4, 0);
  const out = createBuffer(W, H);
  let y = 0;
  for (const p of parts) {
    stamp(out, p, 0, y);
    y += p.h + 4;
  }
  return out;
}
