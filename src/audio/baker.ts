/**
 * Offline baking: render a recipe once into an AudioBuffer (OfflineAudioContext), trim the
 * silent tail, or crossfade it into a seamless loop. Baked buffers make frequent sounds cost
 * one buffer-source voice at runtime instead of a dozen oscillator/filter nodes.
 */
import { Synth } from './sfx/kit';
import { Rng } from '../core/rng';

type OfflineCtor = new (channels: number, length: number, sampleRate: number) => OfflineAudioContext;

export function offlineCtor(): OfflineCtor | null {
  const g = globalThis as unknown as {
    OfflineAudioContext?: OfflineCtor;
    webkitOfflineAudioContext?: OfflineCtor;
  };
  return g.OfflineAudioContext ?? g.webkitOfflineAudioContext ?? null;
}

/** Render `seconds` of mono audio drawn by `draw` (Safari's old callback API supported). */
export function renderOffline(
  sampleRate: number,
  seconds: number,
  draw: (c: OfflineAudioContext) => void,
  channels = 1,
): Promise<AudioBuffer> {
  const Ctor = offlineCtor();
  if (!Ctor) return Promise.reject(new Error('OfflineAudioContext unavailable'));
  const c = new Ctor(channels, Math.max(1, Math.ceil(seconds * sampleRate)), sampleRate);
  draw(c);
  return new Promise<AudioBuffer>((resolve, reject) => {
    let done = false;
    c.oncomplete = (e) => {
      if (!done) {
        done = true;
        resolve(e.renderedBuffer);
      }
    };
    try {
      const p = c.startRendering() as Promise<AudioBuffer> | undefined;
      if (p && typeof p.then === 'function') {
        p.then(
          (b) => {
            if (!done) {
              done = true;
              resolve(b);
            }
          },
          (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))),
        );
      }
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/** Seeded random source for a bake variant (deterministic per id/variant). */
export function variantRng(id: string, variant: number): () => number {
  const r = new Rng(`${id}#${variant}`);
  return () => r.next();
}

export function bakeRecipe(
  sampleRate: number,
  seconds: number,
  recipe: (s: Synth) => void,
  rnd: () => number,
): Promise<AudioBuffer> {
  return renderOffline(sampleRate, seconds, (c) => {
    recipe(new Synth(c, c.destination, 0, rnd));
  });
}

/** Index after the last sample above `threshold` (+ a few ms). */
export function audibleLength(data: Float32Array, sampleRate: number, threshold = 2e-4): number {
  let i = data.length - 1;
  while (i > 0 && Math.abs(data[i]!) < threshold) i--;
  return Math.min(data.length, i + 1 + Math.floor(sampleRate * 0.005));
}

/** Copy `buf` into a new buffer of `length` samples (via `make`, a context's createBuffer). */
export function sliceBuffer(
  buf: AudioBuffer,
  length: number,
  make: (channels: number, length: number, sampleRate: number) => AudioBuffer,
): AudioBuffer {
  const n = Math.max(1, Math.min(buf.length, length));
  const out = make(buf.numberOfChannels, n, buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    out.copyToChannel(buf.getChannelData(ch).subarray(0, n), ch);
  }
  return out;
}

/** Trim the silent tail and apply a 3 ms fade at the cut. */
export function trimBuffer(
  buf: AudioBuffer,
  make: (channels: number, length: number, sampleRate: number) => AudioBuffer,
): AudioBuffer {
  const n = audibleLength(buf.getChannelData(0), buf.sampleRate);
  const out = sliceBuffer(buf, n, make);
  const fade = Math.min(n, Math.floor(buf.sampleRate * 0.003));
  for (let ch = 0; ch < out.numberOfChannels; ch++) {
    const d = out.getChannelData(ch);
    for (let i = 0; i < fade; i++) d[n - 1 - i]! *= i / fade;
  }
  return out;
}

/**
 * In-place crossfade for seamless looping: given samples rendered for `L + F`, the first `F`
 * samples become `head·(i/F) + tail·(1 − i/F)` where tail = samples [L, L+F). Returns the
 * first `L` samples as the loop. Pure on Float32Array (unit-tested).
 */
export function crossfadeLoop(data: Float32Array, L: number, F: number): Float32Array {
  const f = Math.min(F, data.length - L);
  const out = data.slice(0, L);
  for (let i = 0; i < f; i++) {
    const w = i / f;
    // Equal-power crossfade.
    const a = Math.sin((w * Math.PI) / 2);
    const b = Math.cos((w * Math.PI) / 2);
    out[i] = data[i]! * a + data[L + i]! * b;
  }
  return out;
}

export function bakeLoop(
  sampleRate: number,
  length: number,
  xfade: number,
  recipe: (s: Synth, total: number, length: number) => void,
  rnd: () => number,
  make: (channels: number, length: number, sampleRate: number) => AudioBuffer,
): Promise<AudioBuffer> {
  const total = length + xfade;
  return renderOffline(sampleRate, total, (c) => {
    recipe(new Synth(c, c.destination, 0, rnd), total, length);
  }).then((buf) => {
    const L = Math.round(length * sampleRate);
    const F = Math.round(xfade * sampleRate);
    const looped = crossfadeLoop(buf.getChannelData(0), L, F);
    const out = make(1, L, sampleRate);
    out.copyToChannel(looped as Float32Array<ArrayBuffer>, 0);
    return out;
  });
}

export interface BufferStats {
  peak: number;
  rms: number;
  duration: number;
}

export function bufferStats(buf: AudioBuffer): BufferStats {
  let peak = 0;
  let sum = 0;
  let n = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) {
      const v = d[i]!;
      const a = Math.abs(v);
      if (a > peak) peak = a;
      sum += v * v;
      n++;
    }
  }
  return { peak, rms: Math.sqrt(sum / Math.max(1, n)), duration: buf.duration };
}
