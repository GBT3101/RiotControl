/**
 * Pixel-perfect Pixi stage.
 *
 * The canvas backing store is sized in **device pixels** (exactly, via
 * `devicePixelContentBoxSize` when available), Pixi renders at resolution 1, and every world
 * pixel is drawn as an integer block of device pixels (`zoom`). That keeps pixels square and
 * uniform on any devicePixelRatio, including fractional ones (1.25, 2.625 …).
 */
import { Application, TextureSource } from 'pixi.js';

export interface StageSize {
  /** Device pixels. */
  width: number;
  height: number;
  /** CSS pixels. */
  cssWidth: number;
  cssHeight: number;
  dpr: number;
}

export interface PixelStage {
  app: Application;
  canvas: HTMLCanvasElement;
  size: StageSize;
  /** Subscribe to size changes (fires once immediately). Returns an unsubscribe fn. */
  onResize(cb: (size: StageSize) => void): () => void;
  destroy(): void;
}

/** Global pixel-art defaults; call before creating any texture. */
export function configurePixelArtDefaults(): void {
  TextureSource.defaultOptions.scaleMode = 'nearest';
  TextureSource.defaultOptions.autoGenerateMipmaps = false;
}

function measure(host: HTMLElement, entry?: ResizeObserverEntry): StageSize {
  const dpr = window.devicePixelRatio || 1;
  const rect = host.getBoundingClientRect();
  const cssWidth = Math.max(1, rect.width);
  const cssHeight = Math.max(1, rect.height);
  let width = Math.round(cssWidth * dpr);
  let height = Math.round(cssHeight * dpr);
  // Exact device-pixel size when the browser reports it. Some engines (and DevTools / headless
  // device emulation) report CSS px here, so only trust values consistent with css × dpr.
  const dev = entry?.devicePixelContentBoxSize?.[0];
  if (dev && Math.abs(dev.inlineSize - width) <= 2 && Math.abs(dev.blockSize - height) <= 2) {
    width = dev.inlineSize;
    height = dev.blockSize;
  }
  return { width: Math.max(1, width), height: Math.max(1, height), cssWidth, cssHeight, dpr };
}

export async function createPixelStage(
  host: HTMLElement,
  background = '#1a1424',
): Promise<PixelStage> {
  configurePixelArtDefaults();
  const app = new Application();
  const initial = measure(host);
  await app.init({
    width: initial.width,
    height: initial.height,
    resolution: 1,
    autoDensity: false,
    antialias: false,
    roundPixels: true,
    background,
    preference: 'webgl',
    autoStart: false,
    sharedTicker: false,
    powerPreference: 'high-performance',
  });
  const canvas = app.canvas;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.imageRendering = 'pixelated';
  host.appendChild(canvas);

  const listeners = new Set<(s: StageSize) => void>();
  const stage: PixelStage = {
    app,
    canvas,
    size: initial,
    onResize(cb) {
      listeners.add(cb);
      cb(stage.size);
      return () => listeners.delete(cb);
    },
    destroy() {
      ro.disconnect();
      window.removeEventListener('resize', onWinResize);
      app.destroy(true);
    },
  };

  const apply = (size: StageSize): void => {
    if (
      size.width === stage.size.width &&
      size.height === stage.size.height &&
      size.dpr === stage.size.dpr
    ) {
      stage.size = size;
      return;
    }
    stage.size = size;
    app.renderer.resize(size.width, size.height);
    for (const cb of listeners) cb(size);
  };

  const ro = new ResizeObserver((entries) => apply(measure(host, entries[0])));
  try {
    ro.observe(host, { box: 'device-pixel-content-box' });
  } catch {
    ro.observe(host);
  }
  // DPR changes (moving the window between monitors, browser zoom) don't always resize.
  const onWinResize = (): void => apply(measure(host));
  window.addEventListener('resize', onWinResize);

  return stage;
}
