/**
 * Tiny JSON-in-localStorage helpers. Every access is wrapped in try/catch: private windows,
 * blocked storage, quota errors or corrupt JSON never break the game (PLAN §4.3).
 */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** The browser's localStorage, or null when unavailable (Node, blocked, sandboxed). */
export function browserStorage(): KeyValueStorage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

export function readJson(storage: KeyValueStorage | null, key: string): unknown {
  if (!storage) return null;
  try {
    const txt = storage.getItem(key);
    return txt ? (JSON.parse(txt) as unknown) : null;
  } catch {
    return null;
  }
}

/** Returns false when the write failed. */
export function writeJson(storage: KeyValueStorage | null, key: string, value: unknown): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** In-memory storage (tests, or when localStorage is unavailable). */
export function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
  };
}
