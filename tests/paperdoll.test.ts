import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { resolveColor } from '../src/art/palette';
import { keyFrames, keyGrid } from '../src/art/lib/grid';
import {
  composeDoll,
  mirrorFrames,
  pickSlots,
  recolourRefs,
  remapKeys,
} from '../src/art/lib/paperdoll';
import { getPixel } from '../src/art/lib/pixels';

const base = {
  frames: keyFrames('....\n.SS.\n.SS.\n....\n\n....\n....\n.SS.\n.SS.'),
  keys: { S: '$skin.1' },
  anchors: {
    head: [
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
  },
};
const hat = {
  frames: keyGrid('HH'),
  keys: { H: '$hair.0' },
  attach: 'head',
  origin: { x: 0, y: 1 },
};

describe('paper-doll compositor', () => {
  it('attaches parts to per-frame anchors and recolours slots', () => {
    const frames = composeDoll(base, [hat], { slots: { skin: 'skin3', hair: 'dyePink' } });
    expect(frames).toHaveLength(2);
    // Frame 0: hat sits at row 0 (anchor y 1 − origin y 1); frame 1 bobs down one row.
    expect(getPixel(frames[0]!, 1, 0)).toBe(resolveColor('dyePink.0'));
    expect(getPixel(frames[1]!, 1, 1)).toBe(resolveColor('dyePink.0'));
    expect(getPixel(frames[0]!, 1, 1)).toBe(resolveColor('skin3.1'));
  });

  it('respects z-order (behind parts are covered by the body)', () => {
    const behind = { ...hat, origin: { x: 0, y: 0 }, z: -1 };
    const front = { ...hat, origin: { x: 0, y: 0 }, z: 1 };
    const v = { slots: { skin: 'skin1', hair: 'dyeTeal' } } as const;
    expect(getPixel(composeDoll(base, [behind], v)[0]!, 1, 1)).toBe(resolveColor('skin1.1'));
    expect(getPixel(composeDoll(base, [front], v)[0]!, 1, 1)).toBe(resolveColor('dyeTeal.0'));
  });

  it('adds margin + outline', () => {
    const [f] = composeDoll(base, [], { slots: { skin: 'skin6' } }, { margin: 1, outline: 'ink' });
    expect([f!.w, f!.h]).toEqual([6, 6]);
    expect(getPixel(f!, 2, 1)).toBe(resolveColor('ink'));
  });

  it('variants are seeded and helpers work', () => {
    const choices = {
      hair: ['dyePink', 'dyeTeal', 'hairBlonde'],
      skin: ['skin1', 'skin6'],
    } as const;
    expect(pickSlots(new Rng(4), choices)).toEqual(pickSlots(new Rng(4), choices));
    expect(remapKeys({ H: 'ink' }, { H: 'X' })).toEqual({ X: 'ink' });
    const [f] = composeDoll(base, [], { slots: { skin: 'skin2' } });
    recolourRefs(f!, { 'skin2.1': 'crim2' });
    expect(getPixel(f!, 1, 1)).toBe(resolveColor('crim2'));
    expect(getPixel(mirrorFrames([f!])[0]!, 2, 1)).toBe(resolveColor('crim2'));
  });
});
