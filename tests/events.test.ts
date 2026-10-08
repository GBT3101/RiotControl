import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/core/events';

type Ev = { hit: { dmg: number }; reset: undefined };

describe('EventBus', () => {
  it('delivers typed payloads and unsubscribes', () => {
    const bus = new EventBus<Ev>();
    const fn = vi.fn();
    const off = bus.on('hit', fn);
    bus.emit('hit', { dmg: 3 });
    off();
    bus.emit('hit', { dmg: 4 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ dmg: 3 });
    expect(bus.listenerCount('hit')).toBe(0);
  });

  it('once() fires a single time', () => {
    const bus = new EventBus<Ev>();
    const fn = vi.fn();
    bus.once('reset', fn);
    bus.emit('reset', undefined);
    bus.emit('reset', undefined);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('handlers may unsubscribe during dispatch', () => {
    const bus = new EventBus<Ev>();
    const calls: string[] = [];
    const offA = bus.on('reset', () => {
      calls.push('a');
      offA();
    });
    bus.on('reset', () => calls.push('b'));
    bus.emit('reset', undefined);
    bus.emit('reset', undefined);
    expect(calls).toEqual(['a', 'b', 'b']);
  });
});
