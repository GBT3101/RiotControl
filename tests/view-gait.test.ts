/**
 * Playtest round: protesters walk 1.5× faster, so the crowd's walk / run cycles are played at
 * the actual ground speed. The per-frame strides in the view must match the leg drawings, or
 * feet slide again.
 */
import { describe, expect, it } from 'vitest';
import { BODY_BOOK } from '../src/art/protesters/body.grid';
import { BALANCE } from '../src/data/balance';
import { PROTESTERS } from '../src/data/protesters';
import { GAIT_RATE_MAX, GAIT_RATE_MIN, STRIDE_PX, gaitRate } from '../src/view/protesterView';

/** Rows of a part in the protester body book. */
function part(name: string): string[] {
  const lines = BODY_BOOK.split('\n');
  const at = lines.findIndex((l) => l.trim().startsWith(`== ${name} `));
  expect(at, name).toBeGreaterThanOrEqual(0);
  const rows: string[] = [];
  for (let i = at + 1; i < lines.length; i++) {
    const l = lines[i]!.trim();
    if (l === '' || l.startsWith('==')) break;
    if (!l.startsWith('@')) rows.push(l);
  }
  return rows;
}

/**
 * Distance between the back and front foot (px) on a contact frame: the boots / soles
 * (`B b W`) in the two bottom drawn rows, centre of the leftmost and rightmost runs.
 */
function footSpread(name: string): number {
  const rows = part(name).filter((r) => /[^.]/.test(r));
  const cols = new Set<number>();
  for (const r of rows.slice(-2))
    for (let x = 0; x < r.length; x++) if ('BbW'.includes(r[x]!)) cols.add(x);
  const xs = [...cols].sort((a, b) => a - b);
  const runs: number[][] = [];
  for (const x of xs) {
    const last = runs[runs.length - 1];
    if (last && x === last[last.length - 1]! + 1) last.push(x);
    else runs.push([x]);
  }
  const mid = (r: number[]): number => (r[0]! + r[r.length - 1]!) / 2;
  return mid(runs[runs.length - 1]!) - mid(runs[0]!);
}

describe('crowd gait', () => {
  it('strides match the leg drawings (one step = contact spread over the frames per step)', () => {
    // walk: 8 frames per cycle, 4 per step; shuffle: legs alternate every 2 frames; run: 3.
    expect(Math.abs(footSpread('legs.walk0') / 4 - STRIDE_PX.walk)).toBeLessThan(0.2);
    expect(Math.abs(footSpread('legs.shuffle0') / 2 - STRIDE_PX.shuffle)).toBeLessThan(0.2);
    expect(Math.abs(footSpread('legs.run0') / 3 - STRIDE_PX.run)).toBeLessThan(0.2);
  });

  it('plays the walk faster at the new walking speed, at the art rate at the old one', () => {
    const old = gaitRate(1.15, STRIDE_PX.walk, 10);
    expect(old).toBeGreaterThan(0.95);
    expect(old).toBeLessThan(1.15);
    const now = gaitRate(BALANCE.walkSpeed, STRIDE_PX.walk, 10);
    expect(now / old).toBeCloseTo(BALANCE.walkSpeed / 1.15, 5);
    // Feet planted: ground covered per second on screen = foot travel per second.
    const footPxPerS = STRIDE_PX.walk * 10 * now;
    expect(footPxPerS).toBeCloseTo(BALANCE.walkSpeed * 16, 5);
  });

  it('keeps every protester type inside the clamp at its walking speed', () => {
    for (const p of PROTESTERS) {
      const v = BALANCE.walkSpeed * p.speed;
      for (const stride of [STRIDE_PX.walk, STRIDE_PX.shuffle]) {
        const r = gaitRate(v, stride, 10);
        expect(r, p.id).toBeGreaterThan(GAIT_RATE_MIN);
        expect(r, p.id).toBeLessThan(GAIT_RATE_MAX);
      }
    }
  });

  it('clamps shoving-in-place and sprints', () => {
    expect(gaitRate(0, STRIDE_PX.walk, 10)).toBe(GAIT_RATE_MIN);
    expect(gaitRate(50, STRIDE_PX.run, 12)).toBe(GAIT_RATE_MAX);
  });
});
