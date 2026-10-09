import { describe, expect, it } from 'vitest';
import {
  BLUEPRINTS,
  CITIES,
  CAPITOL_FOOTPRINT,
  GROUNDS,
  LANDMARKS,
  buildingAt,
  clearMapCache,
  inBounds,
  isPlaceableRoad,
  isWalkable,
  loadMap,
  nearestWalkable,
  tileIndex,
  type MapData,
} from '../src/maps';
import { distanceField } from '../src/maps/flow';
import { rasterize } from '../src/maps/rasterize';
import { spawnDoors, validateMap } from '../src/maps/validate';

const REQUIRED_STREETS: Record<(typeof CITIES)[number], string[]> = {
  madrid: [
    'Carrera de San Jerónimo',
    'Calle de Alcalá',
    'Gran Vía',
    'Paseo del Prado',
    'Paseo de Recoletos',
    'Calle de Atocha',
  ],
  london: [
    'Whitehall',
    'The Mall',
    'Victoria Street',
    'Millbank',
    'Westminster Bridge',
    'Lambeth Bridge',
    'Birdcage Walk',
  ],
  paris: [
    'Pont de la Concorde',
    "Quai d'Orsay",
    'Boulevard Saint-Germain',
    'Rue de Rivoli',
    'Avenue des Champs-Élysées',
    "Rue de l'Université",
    'Pont Alexandre III',
  ],
};

const G = (name: (typeof GROUNDS)[number]): number => GROUNDS.indexOf(name);

function hashMap(m: MapData): string {
  let h = 0x811c9dc5;
  const mix = (v: number): void => {
    h = Math.imul(h ^ (v & 0xff), 0x01000193);
  };
  m.ground.forEach(mix);
  m.marking.forEach(mix);
  m.building.forEach(mix);
  return `${h >>> 0}:${JSON.stringify(m.buildings)}:${JSON.stringify(m.decor)}:${JSON.stringify(m.spawns)}`;
}

describe.each(CITIES)('%s blueprint', (city) => {
  const map = loadMap(city);
  const bp = BLUEPRINTS[city];

  it('passes every validator with no errors', () => {
    const errors = validateMap(map, bp).filter((x) => x.level === 'error');
    expect(errors).toEqual([]);
  });

  it('has a sane size and the right capitol footprint', () => {
    expect(map.w).toBeGreaterThanOrEqual(64);
    expect(map.w).toBeLessThanOrEqual(80);
    expect(map.h).toBeGreaterThanOrEqual(64);
    expect(map.h).toBeLessThanOrEqual(80);
    expect(map.capitol.w).toBe(CAPITOL_FOOTPRINT[city].w);
    expect(map.capitol.d).toBe(CAPITOL_FOOTPRINT[city].d);
  });

  it('every spawn door reaches the capitol steps', () => {
    const field = distanceField(map, map.capitol.steps, { costs: false });
    const doors = spawnDoors(map);
    expect(doors.length).toBeGreaterThan(30);
    for (const d of doors) expect(Number.isFinite(field[tileIndex(map, d.i, d.j)]!)).toBe(true);
  });

  it('all road tiles form one connected network', () => {
    const field = distanceField(map, map.capitol.steps, { costs: false });
    for (let k = 0; k < map.ground.length; k++) {
      if (isPlaceableRoad(map, k % map.w, Math.floor(k / map.w)))
        expect(Number.isFinite(field[k]!)).toBe(true);
    }
  });

  it('spawn districts: 5–7, two on wave 1, all unlocked by wave 8', () => {
    expect(map.spawns.length).toBeGreaterThanOrEqual(5);
    expect(map.spawns.length).toBeLessThanOrEqual(7);
    expect(map.spawns.filter((s) => s.unlockWave === 1).length).toBe(2);
    expect(Math.max(...map.spawns.map((s) => s.unlockWave))).toBeLessThanOrEqual(8);
    for (const s of map.spawns) {
      expect(s.buildingIds.length).toBeGreaterThanOrEqual(5);
      expect(isWalkable(map, s.rally.i, s.rally.j)).toBe(true);
    }
  });

  it('chokepoints exist on walkable tiles', () => {
    expect(map.chokepoints.length).toBeGreaterThanOrEqual(2);
    for (const c of map.chokepoints) expect(isWalkable(map, c.i, c.j)).toBe(true);
  });

  it('buildings never overlap roads, water, landmarks or the capitol', () => {
    const fixed = new Set<number>();
    const c = map.capitol;
    for (let j = c.j; j < c.j + c.d; j++)
      for (let i = c.i; i < c.i + c.w; i++) fixed.add(tileIndex(map, i, j));
    for (const l of map.landmarks) {
      const d = LANDMARKS[l.id];
      for (let j = l.j; j < l.j + d.d; j++)
        for (let i = l.i; i < l.i + d.w; i++) fixed.add(tileIndex(map, i, j));
    }
    for (const b of map.buildings) {
      for (let j = b.j; j < b.j + b.d; j++) {
        for (let i = b.i; i < b.i + b.w; i++) {
          const k = tileIndex(map, i, j);
          expect(map.ground[k]).toBe(G('lot'));
          expect(fixed.has(k)).toBe(false);
          expect(buildingAt(map, i, j)?.id).toBe(b.id);
        }
      }
    }
    for (const k of fixed) {
      expect(map.ground[k]).toBe(G('lot'));
      expect(map.building[k]).toBe(-1);
    }
  });

  it('has ≥ 12 rooftop buildings and roofs along every approach', () => {
    expect(map.buildings.filter((b) => b.rooftop).length).toBeGreaterThanOrEqual(12);
  });

  it('steps exist on the +j front and are reachable from ≥ 3 final approaches', () => {
    expect(map.capitol.steps.length).toBeGreaterThan(0);
    for (const s of map.capitol.steps) {
      expect(map.ground[tileIndex(map, s.i, s.j)]).toBe(G('steps'));
      expect(s.j).toBeGreaterThanOrEqual(map.capitol.j + map.capitol.d);
    }
    expect(bp.approaches.filter((a) => a.final).length).toBeGreaterThanOrEqual(3);
    expect(bp.approaches.length).toBeGreaterThanOrEqual(4);
  });

  it('labels the real streets', () => {
    const names = new Set(map.streets.map((s) => s.name));
    for (const n of REQUIRED_STREETS[city]) expect(names, n).toContain(n);
  });

  it('places only its own city landmarks', () => {
    expect(map.landmarks.length).toBeGreaterThanOrEqual(4);
    for (const l of map.landmarks) expect(LANDMARKS[l.id].city).toBe(city);
  });

  it('is deterministic per seed and the seed varies buildings, not the layout', () => {
    const a = rasterize(bp, 0);
    const b = rasterize(bp, 0);
    expect(hashMap(a)).toBe(hashMap(b));
    const c = rasterize(bp, 7);
    expect(hashMap(c)).not.toBe(hashMap(a));
    expect(validateMap(c, bp).filter((x) => x.level === 'error')).toEqual([]);
    expect(c.capitol).toEqual(a.capitol);
  });

  it('rasterises quickly (< 50 ms warm)', () => {
    rasterize(bp, 1);
    let best = Infinity;
    for (let r = 0; r < 3; r++) {
      const t = performance.now();
      rasterize(bp, 1);
      best = Math.min(best, performance.now() - t);
    }
    expect(best).toBeLessThan(50);
  });

  it('decor sits on free tiles with known kinds', () => {
    const seen = new Set<number>();
    for (const d of map.decor) {
      expect(inBounds(map, d.i, d.j)).toBe(true);
      expect(map.building[tileIndex(map, d.i, d.j)]).toBe(-1);
      expect(seen.has(tileIndex(map, d.i, d.j))).toBe(false);
      seen.add(tileIndex(map, d.i, d.j));
      expect(d.kind).toMatch(/^[a-z]+(\.[a-z]+)?$/);
    }
  });
});

describe('map API helpers', () => {
  it('caches loadMap per city+seed', () => {
    clearMapCache();
    expect(loadMap('madrid')).toBe(loadMap('madrid'));
    expect(loadMap('madrid', 3)).not.toBe(loadMap('madrid'));
  });

  it('nearestWalkable snaps from a building to a walkable tile', () => {
    const map = loadMap('paris');
    const b = map.buildings[0]!;
    const p = nearestWalkable(map, b.i, b.j)!;
    expect(p).not.toBeNull();
    expect(isWalkable(map, p.i, p.j)).toBe(true);
    expect(isWalkable(map, -1, 0)).toBe(false);
  });
});

describe('seed robustness', () => {
  it.each(CITIES)('%s validates for seeds 1..12', (city) => {
    for (let seed = 1; seed <= 12; seed++) {
      const errors = validateMap(rasterize(BLUEPRINTS[city], seed), BLUEPRINTS[city]).filter(
        (x) => x.level === 'error',
      );
      expect(errors, `seed ${seed}`).toEqual([]);
    }
  });
});
