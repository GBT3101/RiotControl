/**
 * Persistent art cache (IndexedDB): packed atlas pages and job data keyed by the job and the
 * build (the hashed worker bundle URL changes whenever any art code changes). A repeat visit
 * skips the art workers entirely. Every failure (private mode, quota, old browsers) silently
 * falls back to generating the art.
 */
import type { ArtJob, JobResult } from './jobs';

const DB_NAME = 'riot-control-art';
const STORE = 'jobs';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('idb'));
  });
}

export class ArtCache {
  private constructor(
    private readonly db: IDBDatabase,
    private readonly version: string,
  ) {}

  /** Open the cache for a build version; null when unavailable. */
  static async open(version: string): Promise<ArtCache | null> {
    if (typeof indexedDB === 'undefined' || !version) return null;
    try {
      const open = indexedDB.open(DB_NAME, 1);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE);
      };
      const db = await Promise.race([
        req(open),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('idb timeout')), 1500)),
      ]);
      const cache = new ArtCache(db, version);
      void cache.prune();
      return cache;
    } catch {
      return null;
    }
  }

  private key(job: ArtJob): string {
    return `${this.version}|${JSON.stringify(job)}`;
  }

  async get(job: ArtJob): Promise<JobResult | undefined> {
    try {
      const tx = this.db.transaction(STORE, 'readonly');
      return (await req(tx.objectStore(STORE).get(this.key(job)))) as JobResult | undefined;
    } catch {
      return undefined;
    }
  }

  put(job: ArtJob, r: JobResult): void {
    try {
      const tx = this.db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(r, this.key(job));
    } catch {
      /* quota / clone errors: just don't cache */
    }
  }

  /** Drop entries of other builds. */
  private async prune(): Promise<void> {
    try {
      const tx = this.db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const keys = (await req(store.getAllKeys())) as string[];
      for (const k of keys) if (!k.startsWith(`${this.version}|`)) store.delete(k);
    } catch {
      /* ignore */
    }
  }
}
