import { describe, expect, it } from 'vitest';
import { FixedStepLoop, lerp } from '../src/core/loop';

function make(opts = {}) {
  const log = { steps: 0, renders: [] as number[] };
  const loop = new FixedStepLoop(
    {
      update: () => log.steps++,
      render: (alpha) => log.renders.push(alpha),
    },
    opts,
  );
  return { loop, log };
}

describe('FixedStepLoop', () => {
  it('runs 30 Hz steps and exposes interpolation alpha', () => {
    const { loop, log } = make();
    expect(loop.advance(1000 / 30)).toBe(1);
    expect(loop.advance(1000 / 60)).toBe(0);
    expect(log.renders.at(-1)).toBeCloseTo(0.5, 5);
    loop.advance(1000 / 60);
    expect(log.steps).toBe(2);
    // 1 s of 60 fps frames = 30 steps.
    const { loop: l2, log: g2 } = make();
    for (let i = 0; i < 60; i++) l2.advance(1000 / 60);
    expect(g2.steps).toBe(30);
    expect(l2.simTime).toBeCloseTo(1, 5);
  });

  it('time scale multiplies sim speed', () => {
    const { loop, log } = make();
    loop.timeScale = 3;
    for (let i = 0; i < 60; i++) loop.advance(1000 / 60);
    expect(log.steps).toBe(90);
  });

  it('pause stops sim but keeps rendering', () => {
    const { loop, log } = make();
    loop.paused = true;
    loop.advance(500);
    expect(log.steps).toBe(0);
    expect(log.renders.length).toBe(1);
    loop.stepOnce();
    expect(log.steps).toBe(1);
  });

  it('caps steps after a stall (no spiral of death)', () => {
    const { loop, log } = make({ maxStepsPerFrame: 4, maxFrameMs: 10000 });
    loop.advance(5000);
    expect(log.steps).toBe(4);
    expect(loop.alpha).toBeLessThan(1);
  });

  it('clamps huge frame deltas', () => {
    const { loop, log } = make({ maxFrameMs: 100, maxStepsPerFrame: 100 });
    loop.advance(10000);
    expect(log.steps).toBe(3);
  });

  it('lerp', () => {
    expect(lerp(2, 4, 0.25)).toBe(2.5);
  });
});
