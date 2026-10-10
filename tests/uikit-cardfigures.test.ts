/** Deploy-card figures: whole units (in-game sprites, vehicle card renditions) in the card windows. */
import { describe, expect, it } from 'vitest';
import { SpriteRegistry } from '../src/art/lib/registry';
import type { PixelBuffer } from '../src/art/lib/pixels';
import { PALETTE_RGB } from '../src/art/palette';
import { registerUnits } from '../src/art/units';
import { registerCardFigures } from '../src/art/vehicles/cardFigures';
import { CARD_FIGURES, composeFigure, type FigureSource } from '../src/art/uikit/cardFigures';
import { CARD_H, CARD_W, deployCard } from '../src/art/uikit/cards';
import { COMPACT_H, COMPACT_W, compactCard } from '../src/ui/art';
import { UNIT_IDS, UNITS } from '../src/data/units';

const reg = new SpriteRegistry();
registerUnits(reg);
registerCardFigures(reg);
const get: FigureSource = (name, frame) =>
  reg.has(name) ? { buf: reg.get(name).frames[frame]!, anchor: reg.get(name).anchor } : null;

/** Interior sizes of the picture windows (cards.ts / ui/art.ts). */
const WIN = { card: { w: 30, h: 29 }, compact: { w: 22, h: 22 } } as const;
const VEHICLES = new Set(['humvee', 'tank', 'heli']);
const STATES = ['ready', 'unaffordable', 'locked', 'selected'] as const;

function pure(b: PixelBuffer): boolean {
  for (let i = 0; i < b.data.length; i += 4) {
    if (!b.data[i + 3]) continue;
    if (b.data[i + 3] !== 255) return false;
    if (!PALETTE_RGB.has((b.data[i]! << 16) | (b.data[i + 1]! << 8) | b.data[i + 2]!)) return false;
  }
  return true;
}

describe('deploy-card figures', () => {
  it('compose for every unit and size, and are null while art is missing', () => {
    for (const id of UNIT_IDS)
      for (const size of ['card', 'compact'] as const) {
        const f = composeFigure(CARD_FIGURES[id][size], get);
        expect(f, `${id} ${size}`).not.toBeNull();
        expect(f!.body.w * f!.body.h, `${id} ${size}`).toBeGreaterThan(100);
      }
    expect(composeFigure(CARD_FIGURES.tank.card, () => null)).toBeNull();
  });

  it('vehicles, infantry and the blockade fit both windows whole', () => {
    for (const id of UNIT_IDS) {
      const c = composeFigure(CARD_FIGURES[id].card, get)!;
      const s = composeFigure(CARD_FIGURES[id].compact, get)!;
      if (VEHICLES.has(id)) {
        expect(c.body.w, id).toBeLessThanOrEqual(WIN.card.w);
        expect(c.all.h, id).toBeLessThanOrEqual(WIN.card.h);
        expect(s.body.w, id).toBeLessThanOrEqual(WIN.compact.w);
        expect(s.all.h, id).toBeLessThanOrEqual(WIN.compact.h);
      } else if (id !== 'brigade' && id !== 'mounted') {
        // Infantry and the blockade at 1×, whole, in both windows.
        for (const f of [c, s]) {
          expect(f.body.w, id).toBeLessThanOrEqual(WIN.compact.w);
          expect(f.all.h, id).toBeLessThanOrEqual(WIN.compact.h);
        }
      }
    }
  });

  it('cards with figures keep their size and stay palette-pure in every state', () => {
    for (const id of UNIT_IDS) {
      const c = composeFigure(CARD_FIGURES[id].card, get);
      const s = composeFigure(CARD_FIGURES[id].compact, get);
      for (const state of STATES) {
        const spec = { cost: UNITS[id].cost, state, level: UNITS[id].level };
        const full = deployCard({ ...spec, figure: c, hotkey: '1' });
        const small = compactCard({ ...spec, figure: s });
        expect([full.w, full.h]).toEqual([CARD_W, CARD_H]);
        expect([small.w, small.h]).toEqual([COMPACT_W, COMPACT_H]);
        expect(pure(full), `${id} ${state}`).toBe(true);
        expect(pure(small), `${id} ${state}`).toBe(true);
      }
    }
    expect(pure(deployCard({ figure: null, cost: 5, state: 'ready' }))).toBe(true);
  });
});
