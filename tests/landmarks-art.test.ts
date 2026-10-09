/**
 * M3b landmark art: every contract landmark and Capitol is registered with its night mask,
 * ground shadow and overlays; sprites fit their contract footprints (anchor = footprint top
 * vertex); overlays point at registered sprites.
 */
import { describe, expect, it } from 'vitest';
import { SpriteRegistry } from '../src/art/lib/registry';
import { opaqueBounds } from '../src/art/lib/pixels';
import { CAPITOL_ART, landmarkOverlays, registerLandmarks, SECONDARY } from '../src/art/landmarks';
import { CAPITOL_FOOTPRINT, CITIES, LANDMARKS, type LandmarkId } from '../src/maps/contract';

const reg = new SpriteRegistry();
registerLandmarks(reg);

describe('M3b capitols', () => {
  it.each(CITIES.map((c) => [c]))('%s: 5 damage states + night + shadow + step tile', (city) => {
    const fp = CAPITOL_FOOTPRINT[city];
    expect(CAPITOL_ART[city].w).toBe(fp.w);
    expect(CAPITOL_ART[city].d).toBe(fp.d);
    const base = reg.get(`lm.capitol.${city}.0`);
    for (let s = 0; s < 5; s++) {
      const def = reg.get(`lm.capitol.${city}.${s}`);
      expect(def.group).toBe('landmarks');
      expect(def.anchor).toEqual(base.anchor);
      expect(def.frames[0]!.w).toBe(base.frames[0]!.w);
      // Footprint fit: anchor sits 16·d px from the left footprint vertex (2 px margin),
      // nothing hangs left of the footprint or below its bottom vertex (+1 px outline).
      expect(def.anchor.x).toBe(16 * fp.d + 2);
      const b = opaqueBounds(def.frames[0]!)!;
      expect(b.x).toBeGreaterThanOrEqual(def.anchor.x - 16 * fp.d - 1);
      expect(b.y + b.h - 1).toBeLessThanOrEqual(def.anchor.y + 8 * (fp.w + fp.d) + 1);
      expect(b.x + b.w - 1).toBeLessThanOrEqual(def.anchor.x + 16 * fp.w + 1);
    }
    const night = reg.get(`lm.capitol.${city}.night`);
    expect(night.frames[0]!.w).toBe(base.frames[0]!.w);
    expect(opaqueBounds(night.frames[0]!)).not.toBeNull();
    expect(reg.get(`lm.capitol.${city}.shadow`).hasShadow).toBe(true);
    const tile = reg.get(`lm.capitol.${city}.steptile`);
    expect([tile.frames[0]!.w, tile.frames[0]!.h]).toEqual([32, 16]);
  });

  it('overlays reference registered sprites; flags tear and fires appear with damage', () => {
    for (const city of CITIES) {
      for (let s = 0; s < 5; s++) {
        const ov = landmarkOverlays(`lm.capitol.${city}.${s}`);
        for (const o of ov) expect(reg.has(o.sprite), o.sprite).toBe(true);
        const names = ov.map((o) => o.sprite);
        if (s === 0) expect(names.some((n) => n.startsWith('lm.flag.') && !n.endsWith('.torn'))).toBe(true);
        if (s >= 2) expect(names.some((n) => n.endsWith('.torn'))).toBe(true);
        if (s >= 3) expect(names.some((n) => n.startsWith('lm.fx.'))).toBe(true);
      }
    }
    expect(landmarkOverlays('lm.capitol.london.0').map((o) => o.sprite)).toContain('lm.capitol.london.hands.l');
    expect(reg.get('lm.capitol.london.hands.l').frames.length).toBeGreaterThanOrEqual(12);
  });
});

describe('M3b secondary landmarks', () => {
  it.each(Object.keys(LANDMARKS).map((id) => [id]))('%s is registered at its footprint', (id) => {
    const lid = id as LandmarkId;
    const fp = LANDMARKS[lid];
    const def = reg.get(`lm.${lid}`);
    const side = SECONDARY[lid].side ?? 0;
    expect(def.anchor.x).toBe(16 * fp.d + 2 + side);
    const b = opaqueBounds(def.frames[0]!)!;
    expect(b.y + b.h - 1).toBeLessThanOrEqual(def.anchor.y + 8 * (fp.w + fp.d) + 1);
    expect(reg.has(`lm.${lid}.night`)).toBe(true);
    expect(reg.get(`lm.${lid}.shadow`).hasShadow).toBe(true);
    for (const o of landmarkOverlays(`lm.${lid}`)) expect(reg.has(o.sprite)).toBe(true);
  });

  it('water features and the London Eye animate', () => {
    for (const id of ['cibeles', 'neptuno', 'concordeFountain', 'londonEye']) {
      const def = reg.get(`lm.${id}`);
      expect(def.frames.length).toBeGreaterThanOrEqual(4);
      expect(def.fps).toBeGreaterThan(0);
      const a = def.frames[0]!.data;
      const b = def.frames[1]!.data;
      expect(a.some((v, i) => v !== b[i])).toBe(true);
    }
  });
});
