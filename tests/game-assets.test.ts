import { describe, expect, it } from 'vitest';
import { packSprites } from '../src/art/lib/atlas';
import { createBuffer, setPixel } from '../src/art/lib/pixels';
import { criticalJobs, deferredJobs } from '../src/game/assets';
import { CHUNK, mergeManifests, runJob } from '../src/game/assets/jobs';
import { readParams } from '../src/game/params';
import { loadMap } from '../src/maps';

describe('art jobs', () => {
  it('packSprites places every frame pixel-exact', () => {
    const a = createBuffer(3, 2);
    setPixel(a, 1, 1, 0xff0000ff >>> 0);
    const b = createBuffer(5, 4);
    setPixel(b, 4, 3, 0x00ff00ff >>> 0);
    const packed = packSprites([
      {
        name: 'a',
        group: 'g',
        frames: [a, b.w === 5 ? createBuffer(3, 2) : a],
        fps: 0,
        loop: true,
        anchor: { x: 1, y: 1 },
        tags: [],
        hasShadow: false,
      },
      {
        name: 'b',
        group: 'g',
        frames: [b],
        fps: 0,
        loop: true,
        anchor: { x: 0, y: 0 },
        tags: [],
        hasShadow: false,
      },
    ]);
    const fa = packed.sprites[0]!.frames[0]!;
    const pa = packed.pages[fa.page]!;
    const ia = ((fa.y + 1) * pa.w + fa.x + 1) * 4;
    expect([...pa.data.subarray(ia, ia + 4)]).toEqual([255, 0, 0, 255]);
    const fb = packed.sprites[1]!.frames[0]!;
    const pb = packed.pages[fb.page]!;
    const ib = ((fb.y + 3) * pb.w + fb.x + 4) * 4;
    expect([...pb.data.subarray(ib, ib + 4)]).toEqual([0, 255, 0, 255]);
    expect(packed.sprites[0]!.def).toMatchObject({ name: 'a', w: 3, h: 2, anchor: { x: 1, y: 1 } });
  });

  it('buildings job: every building of its part gets depth pieces, roof data and climb points', () => {
    const map = loadMap('paris');
    const r = runJob({ kind: 'buildings', city: 'paris', mapSeed: 0, part: 0, parts: 8 });
    const ids = map.buildings.filter((b) => b.id % 8 === 0).map((b) => b.id);
    expect(r.buildings!.map((b) => b.id)).toEqual(ids);
    const names = new Set(r.atlas!.sprites.map((s) => s.def.name));
    for (const b of r.buildings!) {
      expect(b.pieces.length).toBeGreaterThan(0);
      for (const p of b.pieces) {
        expect(names.has(p.name)).toBe(true);
        if (p.light) expect(names.has(p.light)).toBe(true);
      }
      expect(b.roofTopY).toBeGreaterThan(10);
    }
  });

  it('terrain job bakes chunk buffers of the right size (water chunks animate)', () => {
    const map = loadMap('london');
    const r = runJob({ kind: 'terrain', city: 'london', mapSeed: 0, part: 0, parts: 6 });
    expect(r.terrain!.length).toBeGreaterThan(0);
    for (const c of r.terrain!) {
      const i1 = Math.min(c.ci * CHUNK + CHUNK, map.w);
      const j1 = Math.min(c.cj * CHUNK + CHUNK, map.h);
      expect(c.w).toBe((i1 - c.ci * CHUNK + j1 - c.cj * CHUNK) * 16);
      expect(c.frames[0]!.length).toBe(c.w * c.h * 4);
      expect([1, 4]).toContain(c.frames.length);
    }
  });

  it('protester range jobs merge into one manifest', () => {
    const a = runJob({
      kind: 'protesters',
      city: 'madrid',
      seed: 3,
      types: ['woke'],
      from: 0,
      to: 2,
    });
    const b = runJob({
      kind: 'protesters',
      city: 'madrid',
      seed: 3,
      types: ['woke'],
      from: 2,
      to: 4,
    });
    const m = mergeManifests([a.protesters!, b.protesters!]);
    expect(m.variants.woke.map((v) => v.index)).toEqual([0, 1, 2, 3]);
  });

  it('critical + deferred jobs cover every protester type and all capitol states', () => {
    const o = { city: 'madrid' as const, mapSeed: 0, seed: 1, quality: 'desktop' as const };
    const all = [...criticalJobs(o), ...deferredJobs(o)];
    const types = new Set(all.flatMap((j) => (j.kind === 'protesters' ? j.types : [])));
    expect([...types].sort()).toEqual(
      [
        'breta',
        'crazy',
        'cultist',
        'mob',
        'paparazzi',
        'prophet',
        'student',
        'violent',
        'woke',
      ].sort(),
    );
    const states = all.flatMap((j) => (j.kind === 'capitol' ? j.states : [])).sort();
    expect(states).toEqual([0, 1, 2, 3, 4]);
    expect(criticalJobs(o).some((j) => j.kind === 'vehicles')).toBe(false);
  });
});

describe('params', () => {
  it('parses the debug query', () => {
    const p = readParams('?city=london&autoplay=1&t=90&stress=3000&level=7&tod=0.7&focus=crowd');
    expect(p).toMatchObject({
      city: 'london',
      autoplay: true,
      skip: 90,
      stress: 3000,
      level: 7,
      tod: 0.7,
      focus: 'crowd',
    });
    expect(readParams('?city=atlantis').city).toBe('madrid');
  });
});
