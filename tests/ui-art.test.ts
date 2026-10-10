import { describe, expect, it } from 'vitest';
import { frontPage } from '../src/art/uikit/newspaper';
import { resolveColor } from '../src/art/palette';
import { compactCard } from '../src/ui/art';
import { tooltipCard } from '../src/ui/widgets/tooltip';
import {
  alertCard,
  levelUpPlacement,
  unlockDossier,
  unlockDossierLayout,
} from '../src/ui/widgets/moments';
import { firstOverlap, inside, overlaps } from '../src/ui/core/boxes';
import { NO_INSETS, computeHudLayout } from '../src/ui/layout';
import { ribbon } from '../src/art/uikit/banners';
import { FONTS } from '../src/art/uikit/text';
import { UI_TEXT } from '../src/ui/strings';
import { frontPageBox, ledgerSections, newsprintPhoto } from '../src/ui/screens/end';
import { minimapBase, minimapTiles, minimapToTile, tileToMinimap } from '../src/ui/hud/minimap';
import { createStats } from '../src/sim/stats';
import { UNIT_IDS } from '../src/data/units';
import { loadMap } from '../src/maps';
import { SWATCHES, hexToRgba } from '../src/art/palette';
import type { PixelBuffer } from '../src/art/lib/pixels';

const PALETTE = new Set(Object.values(SWATCHES).map((c) => hexToRgba(c) >>> 0));

function paletteOnly(b: PixelBuffer): boolean {
  for (let i = 0; i < b.data.length; i += 4) {
    const a = b.data[i + 3]!;
    if (a === 0) continue;
    if (a !== 255) return false;
    const c = ((b.data[i]! << 24) | (b.data[i + 1]! << 16) | (b.data[i + 2]! << 8) | 255) >>> 0;
    if (!PALETTE.has(c)) return false;
  }
  return true;
}

describe('UI compositions are palette-pure', () => {
  it('compact cards, tooltips, alerts, dossiers', () => {
    for (const st of ['ready', 'unaffordable', 'locked', 'selected'] as const)
      expect(paletteOnly(compactCard({ portrait: null, cost: 300, state: st, level: 7 }))).toBe(
        true,
      );
    expect(paletteOnly(tooltipCard('RIOT CONTROL [1]\nRoad.\n"Holds the line."'))).toBe(true);
    expect(paletteOnly(alertCard('breta', 'BRETA SIGHTED!', 'How dare you.', null))).toBe(true);
    const d = unlockDossier('sniper', 1);
    expect(paletteOnly(d.base)).toBe(true);
  });
});

describe('newspaper picture box', () => {
  it('matches the front page layout', () => {
    for (const [w, h] of [
      [300, 220],
      [246, 182],
      [222, 168],
    ] as const) {
      const head = 'ORDER RESTORED';
      const deck = 'Ministry hails "proportionate response".';
      const page = frontPage('london', head, deck, w, h);
      const box = frontPageBox('london', head, deck, w, h);
      const at = (x: number, y: number) => {
        const i = (y * page.w + x) * 4;
        return (
          ((page.data[i]! << 24) | (page.data[i + 1]! << 16) | (page.data[i + 2]! << 8) | 255) >>> 0
        );
      };
      const fill = resolveColor('stone3') >>> 0;
      expect(at(box.x, box.y)).toBe(fill);
      expect(at(box.x + box.w - 1, box.y + box.h - 1)).toBe(fill);
    }
  });

  it('reprints pixels as dithered newsprint greys', () => {
    const w = 8;
    const h = 4;
    const src = new Uint8Array(w * 2 * h * 2 * 4);
    for (let i = 0; i < src.length; i += 4) {
      src[i] = src[i + 1] = src[i + 2] = (i / 4) % 256;
      src[i + 3] = 255;
    }
    const p = newsprintPhoto(src, w * 2, h * 2, w, h);
    expect(p.w).toBe(w);
    expect(paletteOnly(p)).toBe(true);
  });
});

describe('stats ledger', () => {
  it('lists fallen types, officers lost and the bottom line', () => {
    const s = createStats();
    s.protestersFallen.student = 40;
    s.protestersFallen.prophet = 2;
    s.officersLost.riot = 3;
    s.bretaSpawned = 1;
    s.bretaDowned = 1;
    s.capitolIntegrity = 0.75;
    const [prot, units, bottom] = ledgerSections(s);
    expect(prot!.rows.map((r) => r.value)).toEqual(['40', '2', '42']);
    expect(units!.rows.map((r) => r.label)).toEqual(['Riot Control', 'TOTAL']);
    expect(bottom!.rows.find((r) => r.label === 'Breta')!.value).toBe('DOWNED');
    expect(bottom!.rows.find((r) => r.label === 'Capitol damage')!.value).toBe('25%');
  });
});

describe('minimap projection', () => {
  it('maps tiles ↔ minimap pixels', () => {
    const iw = 96;
    const p = tileToMinimap(36, 36, 72, 72, iw);
    const t = minimapToTile(p.x, p.y, 72, 72, iw);
    expect(t.u).toBeCloseTo(36);
    expect(t.v).toBeCloseTo(36);
    const tiles = minimapTiles(72, 72, iw, 48);
    expect(tiles[24 * iw + 48]).toBeGreaterThanOrEqual(0); // centre is on the map
    expect(tiles[0]).toBe(-1); // corners are outside the diamond
  });

  it('paints a palette-pure base image with the Capitol', () => {
    const map = loadMap('madrid', 0);
    const tiles = minimapTiles(map.w, map.h, 96, 48);
    const b = minimapBase(map, tiles, 96, 48);
    expect(paletteOnly(b)).toBe(true);
    const gold = resolveColor('ochre4') >>> 0;
    let n = 0;
    for (let i = 0; i < b.data.length; i += 4) {
      const c = ((b.data[i]! << 24) | (b.data[i + 1]! << 16) | (b.data[i + 2]! << 8) | 255) >>> 0;
      if (c === gold) n++;
    }
    expect(n).toBeGreaterThan(4);
  });
});

describe('unlock dossier text', () => {
  it('name, notes and footnote never overlap and stay on the paper, for every unit', () => {
    for (const id of UNIT_IDS) {
      const l = unlockDossierLayout(id);
      expect(firstOverlap({ title: l.title, notes: l.notes, footnote: l.footnote }), id).toBe(null);
      for (const part of [l.title, l.notes, l.footnote]) {
        expect(part.w, id).toBeLessThanOrEqual(112);
        expect(inside(part, l.paper, 1), id).toBe(true);
      }
      expect(paletteOnly(unlockDossier(id, 1).base), id).toBe(true);
    }
  });

  it('APPROVED and LEVEL n stamps never cover the card, the text or the clip (all units, levels, both layouts)', () => {
    for (const wide of [false, true])
      for (const id of UNIT_IDS)
        for (let level = 1; level <= 10; level++) {
          const l = unlockDossierLayout(id, level, wide);
          const msg = `${id} L${level} ${wide ? 'wide' : 'narrow'}`;
          const fixed = { card: l.card, title: l.title, notes: l.notes, footnote: l.footnote };
          for (const st of [l.approved, l.level]) {
            for (const [k, b] of Object.entries({ ...fixed, clip: l.clip }))
              expect(overlaps(st, b), `${msg}: stamp × ${k}`).toBe(false);
            expect(inside(st, { x: 0, y: 10, w: l.w, h: l.h - 10 }, 1), msg).toBe(true);
          }
          expect(overlaps(l.approved, l.level), msg).toBe(false);
          expect(inside(l.card, { x: 0, y: 10, w: l.w, h: l.h - 10 }), msg).toBe(true);
        }
  });

  it('the ribbon and the dossier never overlap on phone and desktop screens', () => {
    for (const [W, H] of [
      [234, 506],
      [506, 234],
      [480, 300],
      [640, 360],
      [195, 422],
    ] as const) {
      const hud = computeHudLayout(W, H, NO_INSETS, { touch: W < 300 || H < 280 });
      const rib = ribbon(UI_TEXT.levelUp, W < 310 ? FONTS.smallBold : FONTS.large);
      for (const id of UNIT_IDS) {
        const wide = W >= unlockDossierLayout(id, 10, true).w + 8;
        const d = unlockDossierLayout(id, 10, wide);
        const at = levelUpPlacement(
          hud,
          { width: rib.w, height: rib.h },
          { width: d.w, height: d.h },
        );
        expect(overlaps(at.ribbon, at.dossier), `${W}x${H} ${id}`).toBe(false);
        expect(at.dossier.x, `${W}x${H} ${id}`).toBeGreaterThanOrEqual(0);
        expect(at.dossier.x + at.dossier.w, `${W}x${H} ${id}`).toBeLessThanOrEqual(W);
        expect(at.ribbon.y, `${W}x${H} ${id}`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
