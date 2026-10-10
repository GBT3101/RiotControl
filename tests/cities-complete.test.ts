/**
 * E0 city completeness: a city is PLAYABLE once its blueprint is registered
 * (src/maps/cities/index.ts). Every playable city must then also have every per-city piece —
 * environment style, Capitol + landmark art for each landmark it places, flags, music, copy,
 * parked cars, protest item, graffiti tag — so a half-built city fails CI instead of borrowing
 * Madrid's stand-ins at runtime. Also checks that nothing reachable at runtime can load a city
 * that has no blueprint yet. Guide: docs/E0.md.
 */
import { describe, expect, it } from 'vitest';
import { buildDecals } from '../src/art/env/decals';
import { buildProps, PROP_FALLBACK, propSprite } from '../src/art/env/props';
import { ENV_CITIES, OWN_ENV } from '../src/art/env/style';
import { CAPITOL_ART, LANDMARK_CITIES, OWN_LANDMARKS, SECONDARY } from '../src/art/landmarks';
import { BOOK } from '../src/art/protesters/figure';
import { textRows } from '../src/art/protesters/glyphs';
import { masthead } from '../src/art/uikit/newspaper';
import { CIVIL_IDS } from '../src/art/vehicles/civil';
import { CITY_VEHICLE_IDS } from '../src/art/vehicles/cityVehicles';
import { OWN_MUSIC } from '../src/audio/music/patterns';
import {
  BLUEPRINTS,
  CAPITOL_FOOTPRINT,
  CITIES,
  LANDMARKS,
  PLAYABLE_CITIES,
  cityTable,
  isPlayable,
  loadMap,
  playableOr,
  type CityId,
} from '../src/maps';
import { sanitizeGameSettings } from '../src/ui/settings';
import { sanitizeRecords } from '../src/ui/records';
import { OWN_COPY } from '../src/ui/text/cities';

const UNBUILT = CITIES.filter((c) => !isPlayable(c));

describe('city registries', () => {
  it('the original three cities stay playable, in canonical order', () => {
    expect(PLAYABLE_CITIES.slice(0, 3)).toEqual(['madrid', 'london', 'paris']);
    expect(PLAYABLE_CITIES).toEqual(CITIES.filter((c) => BLUEPRINTS[c]));
  });

  it('every blueprint is filed under its own city id', () => {
    for (const c of PLAYABLE_CITIES) expect(BLUEPRINTS[c]!.city).toBe(c);
  });

  it('every contract landmark belongs to a known city and every city has a Capitol footprint', () => {
    for (const [id, l] of Object.entries(LANDMARKS)) expect(CITIES, id).toContain(l.city);
    for (const c of CITIES)
      expect(CAPITOL_FOOTPRINT[c].w * CAPITOL_FOOTPRINT[c].d).toBeGreaterThan(0);
  });
});

describe.each(PLAYABLE_CITIES)('%s is complete', (city: CityId) => {
  const map = loadMap(city);

  it('has its own environment style (src/art/env/cities/<city>.ts)', () => {
    expect(OWN_ENV[city], 'add src/art/env/cities/<city>.ts + one line in its index').toBeDefined();
  });

  it('has its own Capitol art at the contract footprint (src/art/landmarks/<city>/)', () => {
    const own = OWN_LANDMARKS[city];
    expect(own, 'add src/art/landmarks/<city>/index.ts + one line in cities.ts').toBeDefined();
    expect(CAPITOL_ART[city]).toBe(own!.capitol);
    expect([own!.capitol.w, own!.capitol.d]).toEqual([
      CAPITOL_FOOTPRINT[city].w,
      CAPITOL_FOOTPRINT[city].d,
    ]);
    expect(Object.keys(own!.flags).length, 'flags').toBeGreaterThan(0);
  });

  it('has art for every landmark its blueprint places', () => {
    const own = OWN_LANDMARKS[city]?.landmarks ?? {};
    for (const l of map.landmarks) {
      expect(LANDMARKS[l.id].city).toBe(city);
      expect(own[l.id], `landmark art for ${l.id}`).toBeDefined();
      expect(SECONDARY[l.id]).toBe(own[l.id]);
    }
  });

  it('has its own music (src/audio/music/cities/<city>.ts)', () => {
    expect(OWN_MUSIC[city], 'add src/audio/music/cities/<city>.ts').toBeDefined();
  });

  it('has its own copy, masthead and renderable sign slogans (src/ui/text/city/<city>.ts)', () => {
    const copy = OWN_COPY[city];
    expect(copy, 'add src/ui/text/city/<city>.ts').toBeDefined();
    expect(copy!.masthead.title.length).toBeGreaterThan(0);
    expect(masthead(city).w).toBeGreaterThan(0);
    expect(copy!.slogans.length).toBeGreaterThanOrEqual(6);
    for (const s of copy!.slogans) {
      // Throws on a character the 3×5 sign font lacks (add it to art/protesters/glyphs.ts).
      expect(textRows(s)[0]!.length, s).toBeLessThanOrEqual(23);
    }
  });

  it('parks only decor vehicles that exist, carries an existing item, sprays a known tag', () => {
    const env = OWN_ENV[city];
    if (!env) return; // reported above
    const vehicles = new Set([...CIVIL_IDS, ...CITY_VEHICLE_IDS]);
    expect(env.cars.length).toBeGreaterThan(0);
    for (const id of env.cars) expect(vehicles.has(id), `vehicle ${id}`).toBe(true);
    expect(BOOK.has(`item.${env.protest.item}.down`), `item ${env.protest.item}`).toBe(true);
    const decals = new Set(buildDecals().map((d) => d.name));
    expect(decals.has(`decal.tag.${env.decals.tag}`), `tag ${env.decals.tag}`).toBe(true);
  });

  it('resolves every decor prop it places (directly or via PROP_FALLBACK, like the view)', () => {
    const props = new Set(buildProps().map((p) => p.name));
    for (const d of map.decor) {
      if (d.kind === 'boat' || d.kind === 'pigeon' || d.kind === 'litter') continue; // not props
      const at = (k: string): string => propSprite(k, city, d.seed ?? 0, d.axis ?? 'i');
      const name = props.has(at(d.kind)) ? at(d.kind) : at(PROP_FALLBACK[d.kind] ?? d.kind);
      expect(props.has(name), `${d.kind} → ${name}`).toBe(true);
    }
  });
});

describe('unbuilt cities stay out of reach', () => {
  it('own per-city entries exist only for known ids (the registries reject typos)', () => {
    for (const c of [...ENV_CITIES, ...LANDMARK_CITIES]) expect(CITIES).toContain(c);
    expect(() => cityTable({ budapset: 1 } as never, 'test')).toThrow(/not a CityId/);
    expect(Object.keys(cityTable<number>({ paris: 3, madrid: 1 }, 'test'))).toEqual([
      'madrid',
      'paris',
    ]);
  });

  it.each(UNBUILT.length ? UNBUILT : ['—'])('%s cannot be loaded, picked or remembered', (c) => {
    if (c === '—') return;
    expect(() => loadMap(c as CityId)).toThrow(/not playable/);
    expect(playableOr(c)).toBe('madrid');
    expect(sanitizeGameSettings({ lastCity: c }).lastCity).toBeUndefined();
    // Records exist for every id (zeros) so a city's first run needs no migration.
    expect(sanitizeRecords({})[c as CityId].runs).toBe(0);
  });

  it('unknown ids are rejected too', () => {
    expect(isPlayable('atlantis')).toBe(false);
    expect(playableOr('atlantis', 'paris')).toBe('paris');
    expect(sanitizeGameSettings({ lastCity: 'atlantis' }).lastCity).toBeUndefined();
  });
});
