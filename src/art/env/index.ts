/**
 * Environment art (M3a): terrain tiles, city building kits, props, decals — sprite registration
 * entry point. The pure generators live next to this file:
 *   ground.ts      groundTile / groundTileFrames / groundCtxAt (autotiled terrain, per city)
 *   bld/building.ts paintBuilding (city building kits → image, lights, shadow, roof, climb points)
 *   props.ts       buildProps / propSprite (registered props, anchored at ground contact)
 *   decals.ts      buildDecals / decalSprite (ground overlays)
 *   preview.ts     renderPreview (composed street corner per city)
 *
 * Props and decals are always registered (the game places them by name). Tile samples, building
 * samples and the composed previews are review material: they are registered only outside the
 * game page (gallery, Node tools/tests) so the game atlas and boot time stay lean.
 */
import {
  CITIES,
  type BuildingKind,
  type CityId,
  type Ground,
  type Marking,
  type RoofType,
} from '../../maps/contract';
import type { SpriteRegistry } from '../lib/registry';
import { paintBuilding } from './bld/building';
import { buildDecals } from './decals';
import {
  GROUND_ANCHOR,
  WATER_FPS,
  groundTileFrames,
  type GroundCtx,
  type NeighbourDir,
} from './ground';
import { renderPreview } from './preview';
import { buildProps } from './props';

export {
  groundTile,
  groundTileFrames,
  groundCtxAt,
  GROUND_ANCHOR,
  WATER_FRAMES,
  WATER_FPS,
} from './ground';
export type { GroundCtx } from './ground';
export { paintBuilding } from './bld/building';
export type { BuildingArt, ClimbPoint } from './bld/building';
export { propSprite, PROP_KINDS } from './props';
export { decalSprite, DECAL_KINDS } from './decals';

/** True on the gallery page and in Node (tests, exporters); false in the game page. */
function reviewContext(): boolean {
  if (typeof document === 'undefined' || typeof location === 'undefined') return true;
  return /gallery/.test(location.pathname);
}

export function registerEnvironment(reg: SpriteRegistry): void {
  for (const p of buildProps()) {
    reg.add(p.name, {
      group: 'props',
      frames: p.sprite.frames,
      fps: p.sprite.fps ?? 0,
      anchor: p.sprite.anchor,
      hasShadow: true,
    });
    if (p.sprite.light) {
      reg.add(`${p.name}.light`, {
        group: 'props',
        frames: p.sprite.light,
        anchor: p.sprite.anchor,
      });
    }
  }
  for (const d of buildDecals())
    reg.add(d.name, { group: 'decals', frames: d.sprite.img, anchor: d.sprite.anchor });
  if (!reviewContext()) return;
  for (const city of CITIES) registerTileSamples(reg, city);
  for (const city of CITIES) registerBuildingSamples(reg, city);
  for (const city of CITIES) {
    const anchor = { x: 0, y: 0 };
    reg.add(`env.preview.${city}`, { group: 'preview', frames: renderPreview(city), anchor });
    reg.add(`env.preview.${city}.night`, {
      group: 'preview',
      frames: renderPreview(city, true),
      anchor,
    });
  }
}

// ------------------------------------------------------------------------------- tile samples --

function ctx(
  city: CityId,
  ground: Ground,
  nb: Partial<Record<NeighbourDir, Ground>> = {},
  seed = 1,
  marking: Marking = 'none',
): GroundCtx {
  const all: NeighbourDir[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
  const c = { city, ground, marking, seed } as GroundCtx;
  for (const d of all) c[d] = nb[d] ?? ground;
  return c;
}

function registerTileSamples(reg: SpriteRegistry, city: CityId): void {
  const group = 'tiles';
  const anchor = GROUND_ANCHOR;
  const add = (name: string, c: GroundCtx): void => {
    const frames = groundTileFrames(c);
    reg.add(`tile.${city}.${name}`, {
      group,
      frames,
      fps: frames.length > 1 ? WATER_FPS : 0,
      anchor,
    });
  };
  const grounds: Ground[] = ['asphalt', 'sidewalk', 'cobble', 'plaza', 'grass', 'parkPath', 'lot'];
  for (const g of grounds)
    for (let v = 0; v < 4; v++) add(`${g}.${v}`, ctx(city, g, {}, v * 7 + 3));
  for (const m of ['dashI', 'dashJ', 'zebraI', 'zebraJ', 'stopI', 'stopJ'] as const) {
    add(`mark.${m}`, ctx(city, 'asphalt', {}, 2, m));
  }
  const S: Ground = 'sidewalk';
  add('kerb.road.nw', ctx(city, 'asphalt', { nw: S, n: S, w: S }));
  add('kerb.road.ne', ctx(city, 'asphalt', { ne: S, n: S, e: S }));
  add('kerb.road.n', ctx(city, 'asphalt', { n: S }));
  add('kerb.road.nwne', ctx(city, 'asphalt', { nw: S, ne: S, n: S, e: S, w: S }));
  add('kerb.side.se', ctx(city, S, { se: 'asphalt', s: 'asphalt', e: 'asphalt' }));
  add('kerb.side.sw', ctx(city, S, { sw: 'asphalt', s: 'asphalt', w: 'asphalt' }));
  add('kerb.side.s', ctx(city, S, { s: 'asphalt' }));
  add('edge.grass.side', ctx(city, 'grass', { se: S, s: S, e: S }));
  add('edge.side.grass', ctx(city, S, { nw: 'grass', n: 'grass', w: 'grass' }));
  add(
    'edge.path.grass',
    ctx(city, 'parkPath', { ne: 'grass', nw: 'grass', n: 'grass', e: 'grass', w: 'grass' }),
  );
  add('water', ctx(city, 'water'));
  add(
    'water.quay',
    ctx(city, 'water', { nw: 'quay', ne: 'quay', n: 'quay', e: 'quay', w: 'quay' }),
  );
  add('water.bank', ctx(city, 'water', { nw: 'grass', n: 'grass', w: 'grass' }));
  add('water.bridge', ctx(city, 'water', { ne: 'bridge', n: 'bridge', e: 'bridge' }));
  add('quay.se', ctx(city, 'quay', { se: 'water', s: 'water', e: 'water' }));
  add('quay.nw', ctx(city, 'quay', { nw: 'water', n: 'water', w: 'water' }));
  add('bridge.nwse', ctx(city, 'bridge', { nw: 'water', se: 'water' }));
  add('bridge.dash', ctx(city, 'bridge', { ne: 'water', sw: 'water' }, 1, 'dashI'));
  add('steps', ctx(city, 'steps', { ne: 'lot', n: 'lot', e: 'lot' }));
  add('steps.i', ctx(city, 'steps', { nw: 'lot', n: 'lot', w: 'lot' }));
}

// --------------------------------------------------------------------------- building samples --

const SAMPLE_SPECS: ReadonlyArray<
  readonly [w: number, d: number, storeys: number, roof: RoofType | 'city', kind: BuildingKind]
> = [
  [1, 1, 3, 'pitched', 'residential'],
  [2, 1, 4, 'city', 'residential'],
  [2, 2, 5, 'flat', 'commercial'],
  [3, 2, 4, 'pitched', 'residential'],
  [2, 3, 6, 'city', 'commercial'],
  [3, 3, 5, 'terrace', 'residential'],
  [4, 2, 3, 'city', 'commercial'],
  [4, 4, 6, 'mansard', 'residential'],
  [5, 3, 5, 'city', 'residential'],
  [3, 5, 4, 'flat', 'civic'],
  [6, 6, 6, 'city', 'commercial'],
  [2, 2, 2, 'pitched', 'residential'],
];

const CITY_ROOF: Record<CityId, RoofType> = {
  madrid: 'terrace',
  london: 'pitched',
  paris: 'mansard',
};

function registerBuildingSamples(reg: SpriteRegistry, city: CityId): void {
  SAMPLE_SPECS.forEach(([w, d, storeys, roof, kind], k) => {
    const art = paintBuilding({
      i: 0,
      j: 0,
      w,
      d,
      storeys,
      roof: roof === 'city' ? CITY_ROOF[city] : roof,
      kind,
      style: city,
      rooftop: k % 3 === 0,
      doors: [{ i: Math.floor(w / 2), j: d }],
      seed: 4242 + k * 101,
    });
    reg.add(`bld.${city}.${k}`, { group: 'buildings', frames: art.image, anchor: art.anchor });
    if (k < 2) {
      reg.add(`bld.${city}.${k}.lights`, {
        group: 'buildings',
        frames: art.lights,
        anchor: art.anchor,
      });
      reg.add(`bld.${city}.${k}.shadow`, {
        group: 'buildings',
        frames: art.shadow,
        anchor: art.shadowAnchor,
        hasShadow: true,
      });
    }
  });
}
