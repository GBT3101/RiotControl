import { describe, expect, it } from 'vitest';
import {
  initSkillInput,
  reduceSkillInput,
  reticleState,
  type GestureContext,
  type GestureEvent,
  type SkillEffect,
  type SkillInputState,
} from '../src/game/skillGesture';

/** 1 tile = 40 device px, the origin (tank) at tile (10, 10) = screen (400, 400). */
const K = 40;
const ctx: GestureContext = {
  ox: 10,
  oy: 10,
  range: 16,
  minLen: 1.5,
  maxLen: 14,
  slop: 16,
  grab: 50,
  tapMs: 450,
  toScreen: (u, v) => ({ x: u * K, y: v * K }),
};

type Kind = 'down' | 'move' | 'up';
const pt = (
  kind: Kind,
  id: number,
  u: number,
  v: number,
  t = 0,
  type = 'touch',
  button = 0,
): GestureEvent => ({
  kind,
  p: { id, sx: u * K, sy: v * K, type, button },
  t,
  u,
  v,
});

function play(s: SkillInputState, evs: GestureEvent[]): { s: SkillInputState; fx: SkillEffect[] } {
  const fx: SkillEffect[] = [];
  for (const e of evs) {
    const r = reduceSkillInput(s, e, ctx);
    s = r.state;
    fx.push(...r.effects);
  }
  return { s, fx };
}
const fired = (fx: SkillEffect[]): SkillEffect[] => fx.filter((e) => e.type === 'fire');
const tap = (id: number, u: number, v: number, t = 0, type = 'touch'): GestureEvent[] => [
  pt('down', id, u, v, t, type),
  pt('up', id, u, v, t + 80, type),
];

describe('aim mode (tank missile)', () => {
  it('touch: a tap locks the spot, a second tap on the locked reticle fires there', () => {
    let { s, fx } = play(initSkillInput('aim'), tap(1, 14, 12));
    expect(fired(fx)).toEqual([]);
    expect(s.target).toEqual({ u: 14, v: 12 });
    expect(reticleState(s, ctx)).toBe('locked');
    expect(fx).toContainEqual({ type: 'sound', id: 'aimLock' });
    ({ s, fx } = play(s, tap(2, 14.3, 12.2, 500)));
    expect(fired(fx)).toEqual([{ type: 'fire', aim: { x: 14, y: 12 } }]);
    expect(s.done).toBe('fired');
  });

  it('touch: starts locked on the suggested crowd — one tap on it fires', () => {
    const { s, fx } = play(initSkillInput('aim', { u: 18, v: 9 }), tap(1, 18, 9));
    expect(fired(fx)).toEqual([{ type: 'fire', aim: { x: 18, y: 9 } }]);
    expect(s.done).toBe('fired');
  });

  it('a tap outside the range ring aborts', () => {
    const { s, fx } = play(initSkillInput('aim', { u: 12, v: 12 }), tap(1, 30, 10));
    expect(fired(fx)).toEqual([]);
    expect(s.done).toBe('cancelled');
    expect(fx).toContainEqual({ type: 'cancel' });
    expect(fx).toContainEqual({ type: 'sound', id: 'aimCancel' });
  });

  it('cancel aborts (CANCEL button / Esc) and nothing fires afterwards', () => {
    const a = play(initSkillInput('aim', { u: 12, v: 12 }), [{ kind: 'cancel' }]);
    expect(a.s.done).toBe('cancelled');
    expect(play(a.s, tap(1, 12, 12)).fx).toEqual([]);
  });

  it('a drag that starts off the reticle pans the camera and never fires', () => {
    const { s, fx } = play(initSkillInput('aim', { u: 12, v: 12 }), [
      pt('down', 1, 15, 15),
      pt('move', 1, 15.5, 15),
      pt('move', 1, 17, 15),
      pt('up', 1, 17, 15, 200),
    ]);
    expect(fired(fx)).toEqual([]);
    expect(fx.filter((e) => e.type === 'pan').length).toBeGreaterThan(0);
    expect(s.done).toBeNull();
    expect(s.target).toEqual({ u: 12, v: 12 });
  });

  it('a drag that starts on the reticle moves it (locked on release, not fired)', () => {
    const { s, fx } = play(initSkillInput('aim', { u: 12, v: 12 }), [
      pt('down', 1, 12, 12),
      pt('move', 1, 13, 12),
      pt('move', 1, 15, 13),
      pt('up', 1, 15, 13, 600),
    ]);
    expect(fired(fx)).toEqual([]);
    expect(fx.some((e) => e.type === 'pan')).toBe(false);
    expect(s.target).toEqual({ u: 15, v: 13 });
    expect(s.locked).toBe(true);
    expect(fx).toContainEqual({ type: 'sound', id: 'aimTick' });
  });

  it('pinch never fires — not even when one finger lifts on the reticle', () => {
    const { s, fx } = play(initSkillInput('aim', { u: 12, v: 12 }), [
      pt('down', 1, 12, 12),
      pt('down', 2, 14, 14, 30),
      pt('move', 2, 15, 15, 60),
      pt('up', 2, 15, 15, 90),
      pt('up', 1, 12, 12, 120),
      // The next tap is a fresh gesture again.
    ]);
    expect(fired(fx)).toEqual([]);
    expect(fx.map((e) => e.type)).toEqual(['pinchStart', 'pinch', 'pinchEnd']);
    expect(s.done).toBeNull();
    expect(s.g).toBe('idle');
  });

  it('mouse: the reticle follows the hover, a click inside fires, right click aborts', () => {
    const a = play(initSkillInput('aim'), [{ kind: 'hover', u: 20, v: 10 }]);
    expect(reticleState(a.s, ctx)).toBe('idle');
    const b = play(a.s, [{ kind: 'hover', u: 30, v: 10 }]);
    expect(reticleState(b.s, ctx)).toBe('invalid');
    expect(fired(play(b.s, tap(1, 20, 11, 0, 'mouse')).fx)).toEqual([
      { type: 'fire', aim: { x: 20, y: 11 } },
    ]);
    const r = play(initSkillInput('aim'), [pt('down', 1, 12, 12, 0, 'mouse', 2)]);
    expect(r.s.done).toBe('cancelled');
  });

  it('a long press is not a tap', () => {
    const { s, fx } = play(initSkillInput('aim', { u: 12, v: 12 }), [
      pt('down', 1, 12, 12),
      pt('up', 1, 12, 12, 900),
    ]);
    expect(fx).toEqual([]);
    expect(s.done).toBeNull();
  });
});

describe('paint mode (air strike)', () => {
  const stroke = (id: number, from: number, to: number, t0 = 0): GestureEvent[] => {
    const evs: GestureEvent[] = [pt('down', id, from, 10, t0)];
    for (let u = from + 0.5; u <= to + 1e-9; u += 0.5) evs.push(pt('move', id, u, 10, t0 + 10));
    return evs;
  };

  it('drag paints the line, release fires it', () => {
    const { s, fx } = play(initSkillInput('paint'), [
      ...stroke(1, 5, 12),
      pt('up', 1, 12, 10, 400),
    ]);
    const f = fired(fx);
    expect(f).toHaveLength(1);
    const path = (f[0] as { aim: { path: number[] } }).aim.path;
    expect(path.slice(0, 2)).toEqual([5, 10]);
    expect(path.slice(-2)).toEqual([12, 10]);
    expect(s.done).toBe('fired');
    expect(fx).toContainEqual({ type: 'sound', id: 'paintTick' });
  });

  it('a second finger voids the stroke: pinch / pan never fires', () => {
    const { s, fx } = play(initSkillInput('paint'), [
      ...stroke(1, 5, 10),
      pt('down', 2, 12, 12, 50),
      pt('move', 2, 13, 13, 60),
      pt('move', 1, 11, 10, 70),
      pt('up', 1, 11, 10, 90),
      pt('up', 2, 13, 13, 100),
    ]);
    expect(fired(fx)).toEqual([]);
    expect(fx.some((e) => e.type === 'pinch')).toBe(true);
    expect(s.stroke).toEqual([]);
    expect(s.done).toBeNull();
  });

  it('two fingers down at once: pinch only, nothing painted', () => {
    const { s, fx } = play(initSkillInput('paint'), [
      pt('down', 1, 5, 10),
      pt('down', 2, 8, 10, 5),
      pt('move', 1, 4, 10, 20),
      pt('move', 2, 9, 10, 20),
      pt('up', 1, 4, 10, 40),
      pt('up', 2, 9, 10, 40),
    ]);
    expect(fired(fx)).toEqual([]);
    expect(s.stroke).toEqual([]);
  });

  it('a tap or a too-short stroke does nothing; cancel aborts', () => {
    let { s, fx } = play(initSkillInput('paint'), [...tap(1, 5, 10)]);
    expect(fx).toEqual([]);
    ({ s, fx } = play(s, [...stroke(2, 5, 6), pt('up', 2, 6, 10, 100)]));
    expect(fired(fx)).toEqual([]);
    expect(s.done).toBeNull();
    ({ s, fx } = play(s, [...stroke(3, 5, 9), { kind: 'cancel' }, pt('up', 3, 9, 10, 100)]));
    expect(fired(fx)).toEqual([]);
    expect(s.done).toBe('cancelled');
  });

  it('pointer cancel (browser gesture) drops the stroke', () => {
    const { s, fx } = play(initSkillInput('paint'), [...stroke(1, 5, 12), { kind: 'lost', id: 1 }]);
    expect(fired(fx)).toEqual([]);
    expect(s.stroke).toEqual([]);
    expect(s.g).toBe('idle');
  });
});
