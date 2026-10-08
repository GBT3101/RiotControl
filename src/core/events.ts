/**
 * Minimal typed event bus.
 *
 *   type Events = { tap: { x: number; y: number }; waveStart: number };
 *   const bus = new EventBus<Events>();
 *   const off = bus.on('tap', (e) => ...);
 *   bus.emit('tap', { x: 1, y: 2 });
 */
export type Handler<T> = (payload: T) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- event maps are arbitrary records
export class EventBus<Events extends Record<string, any>> {
  private readonly handlers = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(type: K, handler: Handler<Events[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(type, handler);
  }

  once<K extends keyof Events>(type: K, handler: Handler<Events[K]>): () => void {
    const off = this.on(type, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off<K extends keyof Events>(type: K, handler: Handler<Events[K]>): void {
    this.handlers.get(type)?.delete(handler as Handler<never>);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    // Copy so handlers may unsubscribe during dispatch.
    for (const h of [...set]) (h as Handler<Events[K]>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }

  listenerCount<K extends keyof Events>(type: K): number {
    return this.handlers.get(type)?.size ?? 0;
  }
}
