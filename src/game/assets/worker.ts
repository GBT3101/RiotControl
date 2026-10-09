/**
 * Art worker: runs one art job per message (see jobs.ts) and posts the packed result back with
 * its pixel buffers transferred (zero-copy).
 */
import { runJob, transfersOf, type ArtJob } from './jobs';

interface Req {
  id: number;
  job?: ArtJob;
  /** Version probe: replies with this worker bundle's URL (content-hashed in builds). */
  hello?: boolean;
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<Req>) => void) | null;
  postMessage(msg: unknown, transfer: Transferable[]): void;
};

ctx.onmessage = (e) => {
  const { id, job, hello } = e.data;
  if (hello || !job) {
    ctx.postMessage({ id, version: String(self.location.href) }, []);
    return;
  }
  try {
    const result = runJob(job);
    ctx.postMessage({ id, result }, transfersOf(result));
  } catch (err) {
    ctx.postMessage(
      { id, error: err instanceof Error ? (err.stack ?? err.message) : String(err) },
      [],
    );
  }
};
