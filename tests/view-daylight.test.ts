import { describe, expect, it } from 'vitest';
import { gradeAt, mixColor, mulColor, PREP_TOD, stepTod, targetTod } from '../src/view/daylight';
import { covers, occlusionGrid } from '../src/view/occlusion';

describe('day/night grade', () => {
  it('day is untinted, night is dark and blue, golden hour is warm', () => {
    expect(gradeAt(0.1)).toMatchObject({ tint: 0xffffff, darkness: 0 });
    const night = gradeAt(0.7);
    expect(night.darkness).toBe(1);
    expect(night.tint & 255).toBeGreaterThan((night.tint >> 16) & 255); // blue > red
    const gold = gradeAt(0.38);
    expect((gold.tint >> 16) & 255).toBeGreaterThan(gold.tint & 255); // red > blue
    expect(gradeAt(1.1).tint).toBe(gradeAt(0.1).tint);
  });

  it('the clock is tied to waves and only runs forward', () => {
    expect(targetTod(0, 0)).toBe(PREP_TOD);
    expect(targetTod(2, 0)).toBeGreaterThan(targetTod(1, 1) - 1e-9);
    let t = PREP_TOD;
    const goal = targetTod(1, 0.5);
    for (let k = 0; k < 600; k++) t = stepTod(t, goal, 1 / 30);
    expect(t).toBeCloseTo(goal, 3);
    expect(stepTod(0.5, 0.2, 1)).toBe(0.5);
  });

  it('colour helpers', () => {
    expect(mulColor(0xffffff, 0x804020)).toBe(0x804020);
    expect(mixColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
  });
});

describe('occlusion', () => {
  const box = { i: 10, j: 10, w: 2, d: 2, h: 40 };
  it('covers points behind a box, not in front', () => {
    // Directly behind (screen above) the box.
    expect(covers(box, 0, (10 + 10) * 8 - 10)).toBe(true);
    // In front (below the front vertex).
    expect(covers(box, 0, (12 + 12) * 8 + 4)).toBe(false);
    // Far to the side.
    expect(covers(box, 200, 160)).toBe(false);
  });

  it('marks tiles hidden behind a tall building', () => {
    const grid = occlusionGrid(20, 20, [box], (t) => {
      const i = t % 20;
      const j = (t - i) / 20;
      return i >= 10 && i < 12 && j >= 10 && j < 12;
    });
    expect(grid[9 * 20 + 9]).toBe(1); // diagonally behind
    expect(grid[13 * 20 + 13]).toBe(0); // in front
    expect(grid[2 * 20 + 2]).toBe(0); // far behind, above the roofline
  });
});
