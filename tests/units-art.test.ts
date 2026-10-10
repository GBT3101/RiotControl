/**
 * M4a — Ministry units art: registration completeness, catalog ↔ registry consistency,
 * palette compliance and a few structural invariants (impact frames, muzzles, seamless blockade).
 */
import { describe, expect, it } from 'vitest';
import { SpriteRegistry } from '../src/art/lib/registry';
import { PALETTE_RGB, SHADOW, SWATCHES } from '../src/art/palette';
import { BALANCE } from '../src/data/balance';
import { UNITS } from '../src/data/units';
import { registerUnits, unitAnimCatalog, rammedStars, BLOCKADE_PIECES } from '../src/art/units';

const reg = new SpriteRegistry();
registerUnits(reg);
const catalog = unitAnimCatalog();
const FACINGS = ['se', 'sw', 'ne', 'nw'] as const;

const REQUIRED: Record<string, readonly string[]> = {
  riot: ['idle', 'fidget', 'fidget2', 'walk', 'run', 'attack', 'hit', 'death', 'body', 'ko', 'deploy', 'rammed'],
  cop: ['idle', 'fidget', 'walk', 'run', 'attack', 'reload', 'hit', 'death', 'body', 'deploy', 'rammed'],
  soldier: ['idle', 'fidget', 'crouch', 'walk', 'run', 'attack', 'reload', 'hit', 'death', 'body', 'deploy', 'rammed'],
  gas: ['idle', 'fidget', 'charged', 'walk', 'run', 'attack', 'throw', 'hit', 'death', 'body', 'deploy', 'rammed'],
  horse: ['idle', 'fidget', 'walk', 'run', 'attack', 'hit', 'death', 'body', 'deploy', 'flee', 'rammed'],
  sniper: ['idle', 'fidget', 'aim', 'attack', 'reload', 'hit', 'death', 'body', 'deploy'],
  brigade: ['idle', 'fidget', 'aim', 'attack', 'reload', 'hit', 'death', 'body', 'deploy'],
};

describe('M4a units art', () => {
  it('registers every unit animation in all four facings', () => {
    for (const [unit, anims] of Object.entries(REQUIRED)) {
      for (const anim of anims) {
        for (const f of FACINGS) expect(reg.has(`unit.${unit}.${anim}.${f}`), `${unit}.${anim}.${f}`).toBe(true);
      }
    }
  });

  it('registers the thrown-off-the-roof sequence for both rooftop units', () => {
    for (const unit of ['sniper', 'brigade']) {
      for (const anim of ['grabbed', 'flail', 'impact', 'splat']) {
        expect(reg.has(`unit.${unit}.${anim}.se`)).toBe(true);
        expect(reg.has(`unit.${unit}.${anim}.sw`)).toBe(true);
      }
      expect(reg.get(`unit.${unit}.flail.se`).frames.length).toBe(4);
    }
  });

  it('registers blockade pieces (3 damage states) for both road axes, plus deploy and burst', () => {
    for (const axis of ['i', 'j']) {
      for (const piece of BLOCKADE_PIECES) {
        expect(reg.get(`unit.blockade.${piece}.${axis}`).frames.length).toBe(3);
      }
      expect(reg.get(`unit.blockade.burst.${axis}`).frames.length).toBeGreaterThanOrEqual(6);
      expect(reg.has(`unit.blockade.deploy.${axis}`)).toBe(true);
    }
  });

  it('registers a portrait per unit', () => {
    for (const unit of [...Object.keys(REQUIRED), 'blockade']) {
      const p = reg.get(`unit.${unit}.portrait`);
      expect(p.group).toBe('portraits');
      expect(p.frames[0]!.w).toBe(32);
    }
  });

  it('frame counts follow the animation standards', () => {
    for (const unit of Object.keys(REQUIRED)) {
      expect(reg.get(`unit.${unit}.idle.se`).frames.length).toBe(4);
      expect(reg.get(`unit.${unit}.fidget.se`).frames.length).toBe(8);
      const death = reg.get(`unit.${unit}.death.se`).frames.length;
      expect(death).toBeGreaterThanOrEqual(6);
      expect(death).toBeLessThanOrEqual(8);
      expect(reg.get(`unit.${unit}.hit.se`).frames.length).toBe(2);
    }
    for (const unit of ['riot', 'cop', 'soldier', 'gas', 'horse']) {
      const walk = reg.get(`unit.${unit}.walk.se`).frames.length;
      expect(walk).toBeGreaterThanOrEqual(6);
      expect(walk).toBeLessThanOrEqual(8);
    }
  });

  it('every rammable unit has a rammed-over clip lasting exactly the knockdown', () => {
    const ART: Record<string, string> = { riot: 'riot', gas: 'gas', mounted: 'horse', armed: 'cop', soldier: 'soldier' };
    for (const def of Object.values(UNITS)) {
      if (!def.rammable) continue;
      const art = ART[def.id];
      expect(art, def.id).toBeDefined();
      for (const f of FACINGS) {
        const d = reg.get(`unit.${art}.rammed.${f}`);
        expect(d.loop).toBe(false);
        expect(d.frames.length / d.fps).toBeCloseTo(BALANCE.mob.ramStun, 5);
        // Ends standing: the last frame matches the unit's height, not a lying pose.
        const idle = reg.get(`unit.${art}.idle.${f}`).frames[0]!;
        const last = d.frames[d.frames.length - 1]!;
        const top = (b: typeof idle): number => {
          for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (b.data[(y * b.w + x) * 4 + 3] === 255) return y;
          return b.h;
        };
        expect(Math.abs(top(last) - top(idle)), `${art}.${f}`).toBeLessThanOrEqual(1);
      }
      // KO stars orbit while he is down, never on the shove or once he is back up.
      expect(rammedStars(art!, 0)).toBeNull();
      expect(rammedStars(art!, 6)).not.toBeNull();
      expect(rammedStars(art!, 11)).toBeNull();
    }
  });

  it('catalog metadata matches the registered sprites', () => {
    for (const [name, m] of catalog) {
      const d = reg.get(name);
      expect(d.frames.length, name).toBe(m.frames);
      expect(d.anchor, name).toEqual(m.anchor);
      expect(d.frames[0]!.w).toBe(m.width);
      expect(d.fps).toBe(m.fps);
      expect(m.muzzle.length).toBe(m.frames);
      if (m.impactFrame !== null) expect(m.impactFrame).toBeLessThan(m.frames);
    }
  });

  it('every attack has an impact frame; muzzle pixels sit inside the frame near drawn pixels', () => {
    for (const [name, m] of catalog) {
      if (m.anim === 'attack') expect(m.impactFrame, name).not.toBeNull();
      const d = reg.get(name);
      m.muzzle.forEach((p, i) => {
        if (!p) return;
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThan(m.width);
        const f = d.frames[i]!;
        let near = false;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const x = p.x + dx;
            const y = p.y + dy;
            if (x >= 0 && y >= 0 && x < f.w && y < f.h && f.data[(y * f.w + x) * 4 + 3]! > 0) near = true;
          }
        }
        expect(near, `${name}[${i}] muzzle`).toBe(true);
      });
    }
  });

  it('uses RIOT-64 colours only (shadow swatch for partial alpha)', () => {
    const shadowRgb = parseInt(SWATCHES[SHADOW].slice(1), 16);
    for (const d of reg.list()) {
      for (const f of d.frames) {
        for (let i = 0; i < f.data.length; i += 4) {
          const a = f.data[i + 3]!;
          if (a === 0) continue;
          const rgb = (f.data[i]! << 16) | (f.data[i + 1]! << 8) | f.data[i + 2]!;
          if (a < 255) expect(rgb, d.name).toBe(shadowRgb);
          else expect(PALETTE_RGB.has(rgb), `${d.name} #${rgb.toString(16)}`).toBe(true);
        }
      }
    }
  });

  it('hit reactions start on a white flash frame', () => {
    const white = parseInt(SWATCHES.white.slice(1), 16);
    const f = reg.get('unit.riot.hit.se').frames[0]!;
    let whites = 0;
    for (let i = 0; i < f.data.length; i += 4) {
      const rgb = (f.data[i]! << 16) | (f.data[i + 1]! << 8) | f.data[i + 2]!;
      if (f.data[i + 3] === 255 && rgb === white) whites++;
    }
    expect(whites).toBeGreaterThan(100);
  });

  it('blockade mid segments tile seamlessly (no outline seam where segments meet)', () => {
    const mid = reg.get('unit.blockade.mid.i').frames[0]!;
    const ink = parseInt(SWATCHES.ink.slice(1), 16);
    // The first and last wall columns of a mid piece must be wall (face/top), not outline.
    for (const x of [6, 21]) {
      let face = 0;
      for (let y = 0; y < mid.h; y++) {
        const i = (y * mid.w + x) * 4;
        const rgb = (mid.data[i]! << 16) | (mid.data[i + 1]! << 8) | mid.data[i + 2]!;
        if (mid.data[i + 3] === 255 && rgb !== ink) face++;
      }
      expect(face, `column ${x}`).toBeGreaterThanOrEqual(8);
    }
    // Nothing is drawn outside the tile's own columns [6, 22).
    for (let y = 0; y < mid.h; y++) {
      expect(mid.data[(y * mid.w + 5) * 4 + 3]).toBe(0);
      expect(mid.data[(y * mid.w + 22) * 4 + 3]).toBe(0);
    }
  });
});
