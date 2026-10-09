/** M5 UI kit: registration, palette purity, generators. */
import { describe, expect, it } from 'vitest';
import { registerUiKit } from '../src/art/uikit';
import { SpriteRegistry } from '../src/art/lib/registry';
import { PALETTE_RGB } from '../src/art/palette';
import { panel, NINE_SLICE, type PanelKind } from '../src/art/uikit/panels';
import {
  deployCard,
  CARD_W,
  CARD_H,
  legitMeter,
  levelSeal,
  integrityMeter,
  abilityRing,
} from '../src/art/uikit/cards';
import { stampButton, bigRedButton, roundButton, BUTTON_STATES } from '../src/art/uikit/buttons';
import { rubberStamp, waveBanner, ribbon } from '../src/art/uikit/banners';
import { frontPage, masthead } from '../src/art/uikit/newspaper';
import type { PixelBuffer } from '../src/art/lib/pixels';

const reg = new SpriteRegistry();
registerUiKit(reg);

function pure(b: PixelBuffer): boolean {
  for (let i = 0; i < b.data.length; i += 4) {
    if (!b.data[i + 3]) continue;
    if (b.data[i + 3] !== 255) return false;
    if (!PALETTE_RGB.has((b.data[i]! << 16) | (b.data[i + 1]! << 8) | b.data[i + 2]!)) return false;
  }
  return true;
}

describe('M5 UI kit registry', () => {
  it('registers the groups', () => {
    expect(reg.groups().sort()).toEqual(['font', 'portraits-ui', 'ui']);
    expect(reg.size).toBeGreaterThan(60);
  });

  it.each(reg.list().map((d) => [d.name, d] as const))('%s is palette-pure', (_n, d) => {
    for (const f of d.frames) expect(pure(f)).toBe(true);
    expect(d.anchor.x).toBeLessThan(d.frames[0]!.w);
    expect(d.anchor.y).toBeLessThan(d.frames[0]!.h);
  });

  it('panels draw at any size with valid insets', () => {
    for (const k of Object.keys(NINE_SLICE) as PanelKind[]) {
      const p = panel(k, 70, 41);
      expect([p.w, p.h]).toEqual([70, 41]);
      expect(pure(p)).toBe(true);
      const ins = NINE_SLICE[k];
      const src = reg.get(`ui.panel.${k}`).frames[0]!;
      expect(ins.left + ins.right).toBeLessThan(src.w);
      expect(ins.top + ins.bottom).toBeLessThan(src.h);
    }
  });

  it('cards keep a constant size across states', () => {
    for (const state of ['ready', 'unaffordable', 'locked', 'selected'] as const) {
      const c = deployCard({ cost: 300, hotkey: '0', state, level: 7 });
      expect([c.w, c.h]).toEqual([CARD_W, CARD_H]);
      expect(pure(c)).toBe(true);
    }
  });

  it('buttons have 4 states of equal size', () => {
    const sizes = BUTTON_STATES.map((s) => roundButton('pause', s, 'sm')).map(
      (b) => `${b.w}x${b.h}`,
    );
    expect(new Set(sizes).size).toBe(1);
    expect(
      new Set(BUTTON_STATES.map((s) => stampButton('Deploy', 40, s)).map((b) => `${b.w}x${b.h}`))
        .size,
    ).toBe(1);
    expect(
      new Set(
        BUTTON_STATES.map((s) => bigRedButton('LET THEM COME', s)).map((b) => `${b.w}x${b.h}`),
      ).size,
    ).toBe(1);
  });

  it('meters, stamps, banners and newspapers are palette-pure', () => {
    const all = [
      legitMeter(0.3, 9, 120),
      integrityMeter(0.05),
      abilityRing(10),
      rubberStamp('DENIED', 'crim1'),
      rubberStamp('CLASSIFIED', 'crim1', { tilt: 0, sub: 'FILE 07-B' }),
      waveBanner(12),
      ribbon('ÉLITE'),
      masthead('madrid'),
      masthead('london', 0, 200),
      frontPage('paris', 'LA RÉGIME EST TOMBÉ', '…', 280, 220),
    ];
    for (const b of all) expect(pure(b)).toBe(true);
  });

  it('minister has talk/blink/sweat/smug/panic', () => {
    for (const a of ['idle', 'talk', 'blink', 'sweat', 'smug', 'panic', 'mouths']) {
      const d = reg.get(`ui.portrait.minister.${a}`);
      expect(d.frames[0]!.w).toBe(48);
      expect(d.frames[0]!.h).toBe(48);
    }
  });
});

describe('M13a legitimacy seal', () => {
  it('levels 0–10 fit on the seal plate and stay palette-pure', () => {
    const a = levelSeal(8);
    const b = levelSeal(10);
    expect(a.w).toBe(18);
    expect(b.w).toBe(18);
    for (const s of [a, b]) {
      for (let i = 0; i < s.data.length; i += 4) {
        if (s.data[i + 3] === 0) continue;
        const rgb = (s.data[i]! << 16) | (s.data[i + 1]! << 8) | s.data[i + 2]!;
        expect(PALETTE_RGB.has(rgb)).toBe(true);
      }
    }
    // Different levels → different art.
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(false);
  });
});
