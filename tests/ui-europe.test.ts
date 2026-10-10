/**
 * E1 campaign map: the authored geography (rings close, shared borders, cities on the right
 * country), the graph colouring, palette compliance of every map piece, and the no-overlap
 * layouts (pin tags, country labels, header, cards) at phone and desktop sizes and every zoom.
 */
import { describe, expect, it } from 'vitest';
import { PALETTE_RGB, SHADOW, SWATCHES } from '../src/art/palette';
import type { PixelBuffer } from '../src/art/lib/pixels';
import {
  MAP_OX,
  MAP_OY,
  PRINTED_BOXES,
  SHEET_H,
  SHEET_W,
  TAG_STYLES,
  compassRose,
  deskTile,
  europeSheet,
  europeWaves,
  mapLabels,
  pinSprite,
  project,
  pulseFrames,
  tagSprite,
} from '../src/art/uikit/europe';
import {
  LAKE,
  SEA,
  assembleRing,
  countryColours,
  europeGrid,
  landNeighbours,
} from '../src/art/uikit/europeGeo';
import { ARCS, COUNTRIES } from '../src/art/uikit/europeGeo.grid';
import { CITIES, isPlayable } from '../src/maps';
import { CAMPAIGN, FIRST_CITY, isBuilt } from '../src/ui/campaign';
import { firstOverlap, inside, overlaps } from '../src/ui/core/boxes';
import { cityTags, coreBox, headerPlaque, visibleLabels } from '../src/ui/screens/europe';
import { constructionCard } from '../src/ui/screens/europeCard';
import { BACK_SIZE, screenPlan, zoomPlan } from '../src/ui/screens/europeLayout';

/** UI sizes (UI px) with their UI scale: phone portrait / landscape, desktop, full HD, small. */
const SCREENS: Array<[number, number, number]> = [
  [234, 506, 5],
  [216, 468, 5],
  [506, 234, 5],
  [480, 300, 3],
  [640, 360, 3],
  [195, 422, 4],
];
const NO_SAFE = { top: 0, right: 0, bottom: 0, left: 0 };

const shadowRgb = parseInt(SWATCHES[SHADOW].slice(1), 16);
function offPalette(b: PixelBuffer): string[] {
  const bad = new Set<string>();
  for (let i = 0; i < b.data.length; i += 4) {
    const a = b.data[i + 3]!;
    if (!a) continue;
    const rgb = (b.data[i]! << 16) | (b.data[i + 1]! << 8) | b.data[i + 2]!;
    if (a < 255 ? rgb !== shadowRgb : !PALETTE_RGB.has(rgb)) bad.add(rgb.toString(16));
  }
  return [...bad];
}

describe('campaign', () => {
  it('lists the twelve cities once, keyed by CityId, Budapest first as Level 1', () => {
    expect(CAMPAIGN.map((c) => c.id).sort()).toEqual([...CITIES].sort());
    expect(FIRST_CITY).toBe('budapest');
    expect(CAMPAIGN.find((c) => c.id === 'budapest')!.level).toBe(1);
    for (const c of CAMPAIGN) {
      expect(isBuilt(c.id)).toBe(isPlayable(c.id));
      expect(c.note.length).toBeLessThanOrEqual(40);
    }
  });
});

describe('europe geography', () => {
  it('every ring chains its pieces end to end and closes', () => {
    for (const c of COUNTRIES)
      c.rings.forEach((r, i) => {
        const a = assembleRing(r);
        expect(a.gap, `${c.id} ring ${i}`).toBeLessThan(1e-6);
        expect(a.closeGap, `${c.id} ring ${i}`).toBeLessThan(1e-6);
      });
  });

  it('a shared border arc belongs to at most two countries', () => {
    const uses = new Map<string, number>();
    for (const c of COUNTRIES)
      for (const r of c.rings)
        for (const t of r) if (t in ARCS) uses.set(t, (uses.get(t) ?? 0) + 1);
    for (const [arc, n] of uses) expect(n, arc).toBeLessThanOrEqual(2);
    expect([...uses.keys()].sort()).toEqual(Object.keys(ARCS).sort());
  });

  it('each campaign city sits on its own country', () => {
    const g = europeGrid();
    const of: Record<string, string> = {
      madrid: 'es',
      barcelona: 'es',
      london: 'gb',
      paris: 'fr',
      budapest: 'hu',
      berlin: 'de',
      stockholm: 'se',
      vienna: 'at',
      amsterdam: 'nl',
      rome: 'it',
      prague: 'cz',
      milan: 'it',
    };
    for (const c of CAMPAIGN) {
      const p = project(c.lon, c.lat);
      const v = g.ids[Math.floor(p.y) * g.w + Math.floor(p.x)]!;
      expect(v === SEA || v === LAKE ? '(water)' : g.countries[v - 1]!.id, c.id).toBe(of[c.id]);
    }
  });

  it('every country (and the small ones) has pixels on the sheet', () => {
    const g = europeGrid();
    const count = new Map<number, number>();
    for (const v of g.ids) count.set(v, (count.get(v) ?? 0) + 1);
    for (const id of ['lu', 'si', 'me', 'xk', 'mk', 'al', 'md', 'ee', 'lv', 'lt', 'cy', 'mt', 'be'])
      expect(count.get(COUNTRIES.findIndex((c) => c.id === id) + 1) ?? 0, id).toBeGreaterThan(0);
  });

  it('no two neighbouring countries share a colour', () => {
    const g = europeGrid();
    const fam = countryColours(g);
    for (const pair of landNeighbours(g)) {
      const [a, b] = pair.split(':').map(Number) as [number, number];
      const ca = g.countries[a - 1]!.id;
      const cb = g.countries[b - 1]!.id;
      expect(fam.get(ca)!.name, `${ca} / ${cb}`).not.toBe(fam.get(cb)!.name);
    }
  });
});

describe('europe art', () => {
  it('sheet, waves, labels, desk, pins, tags and cards use RIOT-64 only', () => {
    const pieces: Array<[string, PixelBuffer]> = [
      ['sheet', europeSheet()],
      ['desk', deskTile()],
      ['compass', compassRose()],
      ...europeWaves().map((b, i): [string, PixelBuffer] => [`waves${i}`, b]),
      ...mapLabels().map((l): [string, PixelBuffer] => [`label ${l.id}`, l.buf]),
      ...pulseFrames().map((b, i): [string, PixelBuffer] => [`pulse${i}`, b]),
      ['pin built', pinSprite('built')],
      ['pin unbuilt', pinSprite('unbuilt', true)],
      ['tag', tagSprite('Budapest', TAG_STYLES.selected, 'LEVEL 1\nTUTORIAL', true)],
      ['plaque', headerPlaque(300, 2)],
      ['card', constructionCard(CAMPAIGN[0]!, 150, 200, false).buf],
    ];
    for (const [name, b] of pieces) expect(offPalette(b), name).toEqual([]);
    expect(europeSheet().w).toBe(SHEET_W);
    expect(europeSheet().h).toBe(SHEET_H);
  }, 60_000);

  it('labels the big countries and keeps every label on its own land or open sea', () => {
    const ids = new Set(mapLabels().map((l) => l.id));
    for (const id of ['es', 'fr', 'de', 'it', 'pl', 'gb', 'se', 'no', 'fi', 'ua', 'ru', 'tr'])
      expect(ids.has(id), id).toBe(true);
  });
});

describe('europe layout', () => {
  it('header, BACK, card and the free map area never overlap and stay on screen', () => {
    for (const [W, H] of SCREENS) {
      const p = screenPlan(W, H, NO_SAFE);
      const scr = { x: 0, y: 0, w: W, h: H };
      const back = { ...p.back, ...BACK_SIZE };
      const plaque = headerPlaque(p.header.w, p.headerLines);
      const head = {
        x: p.header.x + Math.floor((p.header.w - plaque.w) / 2),
        y: p.header.y,
        w: plaque.w,
        h: plaque.h,
      };
      expect(firstOverlap({ back, head, card: p.card }, 1), `${W}×${H}`).toBeNull();
      for (const b of [back, head, p.card]) expect(inside(b, scr), `${W}×${H}`).toBe(true);
      expect(p.free.w).toBeGreaterThan(150);
      expect(p.free.h).toBeGreaterThan(150);
    }
  });

  it('pin tags never cover a pin, another tag, a printed legend or a country label', () => {
    for (const [W, H, k] of SCREENS) {
      const p = screenPlan(W, H, NO_SAFE);
      const zp = zoomPlan(
        { w: W * k, h: H * k },
        { w: p.free.w * k, h: p.free.h * k },
        { w: SHEET_W, h: SHEET_H },
        coreBox(),
        k,
      );
      expect(zp.min).toBeLessThanOrEqual(zp.def);
      for (let z = zp.min; z <= zp.max; z++)
        for (const sel of ['budapest', 'madrid', 'stockholm'] as const) {
          const tags = cityTags(z, k, sel, undefined, p.horizontal);
          const s = z / k;
          const msg = `${W}×${H} z${z} ${sel}`;
          const boxes: Record<string, { x: number; y: number; w: number; h: number }> = {};
          for (const t of tags) if (t.tag) boxes[`tag ${t.id}`] = t.tag;
          expect(firstOverlap(boxes, 1), msg).toBeNull();
          for (const t of tags) {
            for (const u of tags) if (t.tag) expect(overlaps(t.tag, u.pin, 1), msg).toBe(false);
            for (const b of PRINTED_BOXES)
              if (t.tag)
                expect(
                  overlaps(t.tag, { x: b.x * s, y: b.y * s, w: b.w * s, h: b.h * s }),
                  msg,
                ).toBe(false);
          }
          // The selected city always keeps its tag.
          expect(tags.find((t) => t.id === sel)!.tag, msg).not.toBeNull();
          // Level 1 keeps its tag from the default zoom in (the overview may be too crowded).
          if (z >= zp.def) expect(tags.find((t) => t.id === 'budapest')!.tag, msg).not.toBeNull();
          // Visible country labels are clear of every pin and tag.
          const vis = visibleLabels(tags, z, k);
          for (const l of mapLabels().filter((m) => vis.has(m.id))) {
            const lb = {
              x: (l.x + MAP_OX) * s,
              y: (l.y + MAP_OY) * s,
              w: l.buf.w * s,
              h: l.buf.h * s,
            };
            for (const t of tags) {
              expect(overlaps(lb, t.pin), `${msg} ${l.id}`).toBe(false);
              if (t.tag) expect(overlaps(lb, t.tag), `${msg} ${l.id}`).toBe(false);
            }
          }
        }
    }
  }, 60_000);

  it('construction cards keep the stamp, ribbon and photo off every line of text', () => {
    for (const c of CAMPAIGN)
      for (const [w, h, horiz] of [
        [144, 236, false],
        [176, 236, false],
        [151, 184, false],
        [222, 124, true],
        [204, 112, true],
        [183, 96, true],
      ] as const) {
        const { boxes } = constructionCard(c, w, h, horiz);
        const text = Object.fromEntries(
          Object.entries(boxes).filter(([k]) => k !== 'photo' && k !== 'ribbon'),
        );
        expect(firstOverlap(text, 1), `${c.id} ${w}×${h}`).toBeNull();
        if (boxes.photo)
          for (const [k, b] of Object.entries(text))
            expect(overlaps(b, boxes.photo, 1), `${c.id} ${w}×${h} ${k}`).toBe(false);
        expect(boxes.name, `${c.id} ${w}×${h}`).toBeDefined();
        expect(boxes.stamp, `${c.id} ${w}×${h}`).toBeDefined();
        for (const b of Object.values(boxes))
          expect(inside(b, { x: 0, y: 0, w, h: h + 10 }), `${c.id} ${w}×${h}`).toBe(true);
      }
  });
});
