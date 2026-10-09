/**
 * M4b protester variation system: determinism, counts, palette compliance, atlas budget,
 * uniqueness and readable (un-mirrored) sign lettering.
 */
import { describe, expect, it } from 'vitest';
import { SpriteRegistry } from '../src/art/lib/registry';
import { packShelves } from '../src/art/lib/packer';
import { mirrorX } from '../src/art/lib/pixels';
import { PALETTE_RGB, SHADOW, SWATCHES } from '../src/art/palette';
import {
  DEFAULT_VARIANTS,
  PROTESTER_TYPES,
  buildProtesterSheets,
  protesterVariantCount,
  rollVariant,
} from '../src/art/protesters';
import { BOOK } from '../src/art/protesters/figure';
import { protesterSprite } from '../src/art/protesters/build';

const shadowRgb = parseInt(SWATCHES[SHADOW].slice(1), 16);
const reg = new SpriteRegistry();
const manifest = buildProtesterSheets(reg, { city: 'madrid', seed: 7 });

function sameBuf(a: { data: Uint8ClampedArray }, b: { data: Uint8ClampedArray }): boolean {
  if (a.data.length !== b.data.length) return false;
  for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) return false;
  return true;
}

describe('protester variants', () => {
  it('rolls are deterministic and independent of build size', () => {
    for (const t of PROTESTER_TYPES) {
      const a = JSON.stringify(rollVariant(t, 3, { seed: 7, city: 'paris' }));
      const b = JSON.stringify(rollVariant(t, 3, { seed: 7, city: 'paris' }));
      expect(a).toBe(b);
    }
    const small = new SpriteRegistry();
    buildProtesterSheets(small, { city: 'madrid', seed: 7, types: ['woke'], variantsPerType: 4 });
    for (const name of ['prot.woke.v3.walk.se', 'prot.woke.v2.attack.ne', 'prot.woke.v0.die.se']) {
      const x = small.get(name);
      const y = reg.get(name);
      expect(x.frames.length).toBe(y.frames.length);
      x.frames.forEach((f, i) => expect(sameBuf(f, y.frames[i]!)).toBe(true));
    }
  });

  it('builds the default variant counts', () => {
    for (const t of PROTESTER_TYPES) {
      expect(manifest.variants[t].length).toBe(protesterVariantCount(t));
      expect(protesterVariantCount(t)).toBe(DEFAULT_VARIANTS[t]);
    }
    expect(protesterVariantCount('breta')).toBe(1);
    expect(protesterVariantCount('paparazzi')).toBeGreaterThanOrEqual(6);
    expect(protesterVariantCount('student')).toBeGreaterThanOrEqual(24);
  });

  it('registers the expected animations per type', () => {
    const has = (n: string): boolean => reg.has(n);
    for (const t of PROTESTER_TYPES) {
      const p = `prot.${t}.v0`;
      for (const a of ['idle', 'walk', 'run', 'hit', 'die', 'ko']) {
        expect(has(`${p}.${a}.se`), `${p}.${a}.se`).toBe(true);
        expect(has(`${p}.${a}.ne`), `${p}.${a}.ne`).toBe(true);
      }
      for (const a of ['body', 'kobody', 'door']) expect(has(`${p}.${a}.se`)).toBe(true);
    }
    for (const t of ['woke', 'mob', 'violent'] as const) {
      expect(has(`prot.${t}.v0.climb.ne`)).toBe(true);
      expect(has(`prot.${t}.v0.heave.se`)).toBe(true);
      expect(has(`prot.${t}.v0.attack.se`)).toBe(true);
    }
    expect(has('prot.violent.v0.molotov.se')).toBe(true);
    expect(has('prot.crazy.v0.attack.se')).toBe(true);
    expect(has('prot.paparazzi.v0.flash.se')).toBe(true);
    expect(has('prot.prophet.v0.windup.se')).toBe(true);
    expect(has('prot.student.v0.attack.se')).toBe(false);
    const loadouts = new Set(manifest.variants.cultist.map((v) => v.loadout));
    expect([...loadouts].sort()).toEqual(['bazooka', 'machete', 'rifle']);
  });

  it('reports gameplay events (impact / release / muzzle)', () => {
    const baz = manifest.variants.cultist.find((v) => v.loadout === 'bazooka')!;
    const ev = manifest.events[`${baz.prefix}.attack.se`]!;
    expect(ev.frame).toBe(2);
    expect(ev.dx).toBeGreaterThan(4);
    expect(manifest.events['prot.violent.v0.molotov.se']!.frame).toBe(2);
    expect(manifest.events['prot.crazy.v0.attack.se']!.frame).toBe(1);
  });

  it('all sprites use palette colours only (shadow = partial-alpha ink)', () => {
    for (const def of reg.list()) {
      for (const f of def.frames) {
        const d = f.data;
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3]!;
          if (a === 0) continue;
          const rgb = (d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!;
          if (a < 255) expect(rgb, def.name).toBe(shadowRgb);
          else if (!PALETTE_RGB.has(rgb)) throw new Error(`${def.name}: off-palette #${rgb.toString(16)}`);
        }
      }
      expect(def.anchor.x).toBeLessThan(def.frames[0]!.w);
      expect(def.anchor.y).toBeLessThan(def.frames[0]!.h);
    }
  });

  it('every variant of a type looks different', () => {
    for (const t of PROTESTER_TYPES) {
      const frames = manifest.variants[t].map((v) => reg.get(`${v.prefix}.walk.se`).frames[0]!);
      for (let i = 0; i < frames.length; i++) {
        for (let j = i + 1; j < frames.length; j++) expect(sameBuf(frames[i]!, frames[j]!), `${t} v${i} = v${j}`).toBe(false);
      }
    }
  });

  it('fits the atlas budget (≤ 2 pages of 2048²)', () => {
    const items = reg.list().flatMap((d) => d.frames.map((f) => ({ w: f.w, h: f.h })));
    expect(packShelves(items, 2048, 1).pages.length).toBeLessThanOrEqual(2);
  });

  it('keeps sign lettering readable on mirrored facings', () => {
    const v = manifest.variants.student.find((s) => reg.has(`${s.prefix}.idle.sw`))!;
    expect(v).toBeDefined();
    const se = reg.get(`${v.prefix}.idle.se`).frames[0]!;
    const sw = reg.get(`${v.prefix}.idle.sw`).frames[0]!;
    expect(sameBuf(mirrorX(se), sw)).toBe(false);
    expect(protesterSprite((n) => reg.has(n), v.prefix, 'idle', 'sw')).toEqual({ name: `${v.prefix}.idle.sw`, flip: false });
    const plain = manifest.variants.crazy[0]!;
    expect(protesterSprite((n) => reg.has(n), plain.prefix, 'walk', 'nw')).toEqual({ name: `${plain.prefix}.walk.ne`, flip: true });
  });

  it('has enough paper-doll parts (≥12 hair, ≥10 tops, ≥15 held items)', () => {
    const names = [...BOOK.keys()];
    const count = (re: RegExp): number => new Set(names.map((n) => re.exec(n)?.[1]).filter(Boolean)).size;
    expect(count(/^hair\.([a-z]+)\.se$/)).toBeGreaterThanOrEqual(12);
    expect(count(/^torso\.([a-z]+)\.se$/)).toBeGreaterThanOrEqual(10);
    expect(count(/^item\.([a-z]+)\./)).toBeGreaterThanOrEqual(15);
    expect(count(/^hat\.([a-z]+)\.se$/)).toBeGreaterThanOrEqual(10);
  });
});

describe('protester signs', () => {
  it('every slogan renders in the tiny font and fits a sign (≤ 21 px)', async () => {
    const { SLOGANS, STUDENT_SLOGANS } = await import('../src/art/protesters/sign');
    const { textWidth } = await import('../src/art/protesters/glyphs');
    for (const s of [...Object.values(SLOGANS).flat(), ...STUDENT_SLOGANS]) {
      expect(textWidth(s), s).toBeLessThanOrEqual(21);
    }
  });
});
