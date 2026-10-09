/**
 * Camera input: mouse drag + inertia, wheel zoom toward the cursor (trackpad: two-finger
 * scroll pans, pinch = ctrl+wheel zooms), one-finger drag and two-finger pinch on touch, WASD / arrow keys, +/- keys. Distinguishes taps from drags and
 * emits `tap` (and `hover` for mice) with world and tile coordinates.
 */
import { EventBus } from '../core/events';
import { worldToTile } from '../core/iso';
import type { Camera } from './camera';

export interface PointerInfo {
  /** Device-pixel position on the canvas. */
  sx: number;
  sy: number;
  /** World pixel position (unsnapped). */
  worldX: number;
  worldY: number;
  /** Continuous tile coordinates and integer tile indices. */
  u: number;
  v: number;
  i: number;
  j: number;
}

export interface TapEvent extends PointerInfo {
  button: number;
  pointerType: string;
}

export interface CameraInputEvents {
  tap: TapEvent;
  /** Mouse hover (null when the pointer leaves the canvas). */
  hover: PointerInfo | null;
  /** A drag/pinch started (UI may cancel hover states). */
  dragStart: undefined;
}

interface ActivePointer {
  id: number;
  type: string;
  button: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  t0: number;
}

const TAP_SLOP_CSS = 8; // CSS px a finger/mouse may wander and still count as a tap
const TAP_MAX_MS = 450;
const KEY_PAN_CSS_PER_SEC = 700;
const WHEEL_STEP = 100; // accumulated wheel delta per zoom step (one mouse notch)
/** A trackpad scroll gesture keeps panning for this long after its last event (ms). */
const TRACKPAD_STICKY_MS = 250;

/** The fields of a WheelEvent the classifier needs (`wheelDeltaY` is non-standard). */
export interface WheelLike {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  wheelDeltaY?: number;
}

/**
 * Wheel event → what the user did (M13b): `zoom` (mouse wheel notch, or a trackpad pinch,
 * which browsers send as ctrl+wheel) or `pan` (two-finger trackpad scroll). Trackpad scrolls
 * have pixel deltas and either a horizontal component, or (Chromium/WebKit) a legacy
 * `wheelDeltaY` of exactly −3 × deltaY; mouse notches are line/page deltas or multiples of 120
 * in `wheelDeltaY`. Firefox (no `wheelDeltaY`): small fractional pixel deltas = trackpad.
 */
export function classifyWheel(e: WheelLike): 'zoom' | 'pan' {
  if (e.ctrlKey) return 'zoom';
  if (e.deltaMode !== 0) return 'zoom';
  if (e.deltaX !== 0) return 'pan';
  const wd = e.wheelDeltaY;
  if (typeof wd === 'number' && wd !== 0) {
    if (Math.abs(wd + 3 * e.deltaY) < 0.5 && Math.abs(wd) % 120 !== 0) return 'pan';
    return Math.abs(wd) % 120 === 0 ? 'zoom' : 'pan';
  }
  const ay = Math.abs(e.deltaY);
  return ay > 0 && ay < 40 && !Number.isInteger(e.deltaY) ? 'pan' : 'zoom';
}

export class CameraController {
  readonly events = new EventBus<CameraInputEvents>();
  enabled = true;

  private readonly pointers = new Map<number, ActivePointer>();
  private mode: 'idle' | 'pending' | 'drag' | 'pinch' = 'idle';
  private pinch = { dist: 1, zoom: 1, mx: 0, my: 0 };
  private samples: Array<{ t: number; x: number; y: number }> = [];
  private wheelAcc = 0;
  private trackpadUntil = 0;
  private readonly keys = new Set<string>();
  private readonly disposers: Array<() => void> = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: Camera,
  ) {
    canvas.style.touchAction = 'none';
    const on = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement | Window | Document,
      type: K | string,
      fn: (e: never) => void,
      opts?: AddEventListenerOptions,
    ): void => {
      target.addEventListener(type, fn as EventListener, opts);
      this.disposers.push(() => target.removeEventListener(type, fn as EventListener, opts));
    };
    on(canvas, 'pointerdown', (e: PointerEvent) => this.onDown(e));
    on(canvas, 'pointermove', (e: PointerEvent) => this.onMove(e));
    on(canvas, 'pointerup', (e: PointerEvent) => this.onUp(e, false));
    on(canvas, 'pointercancel', (e: PointerEvent) => this.onUp(e, true));
    on(canvas, 'pointerleave', (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && this.pointers.size === 0) this.events.emit('hover', null);
    });
    on(canvas, 'wheel', (e: WheelEvent) => this.onWheel(e), { passive: false });
    on(canvas, 'contextmenu', (e: Event) => e.preventDefault());
    // Safari pinch-zoom of the page.
    on(document, 'gesturestart', (e: Event) => e.preventDefault(), { passive: false });
    on(window, 'keydown', (e: KeyboardEvent) => this.onKey(e, true));
    on(window, 'keyup', (e: KeyboardEvent) => this.onKey(e, false));
    on(window, 'blur', () => this.keys.clear());
  }

  destroy(): void {
    for (const d of this.disposers) d();
    this.disposers.length = 0;
    this.events.clear();
  }

  /** Per-frame update (real dt seconds): keyboard panning. */
  update(dt: number): void {
    if (!this.enabled || this.keys.size === 0) return;
    let dx = 0;
    let dy = 0;
    if (this.keys.has('left')) dx -= 1;
    if (this.keys.has('right')) dx += 1;
    if (this.keys.has('up')) dy -= 1;
    if (this.keys.has('down')) dy += 1;
    if (dx === 0 && dy === 0) return;
    const len = Math.hypot(dx, dy);
    const speed = KEY_PAN_CSS_PER_SEC * this.devicePerCss() * dt;
    this.camera.stop();
    this.camera.panByScreen((-dx / len) * speed, (-dy / len) * speed);
  }

  /** Pointer info for a device-pixel canvas position. */
  infoAt(sx: number, sy: number): PointerInfo {
    const w = this.camera.screenToWorld(sx, sy);
    const t = worldToTile(w.x, w.y);
    return {
      sx,
      sy,
      worldX: w.x,
      worldY: w.y,
      u: t.u,
      v: t.v,
      i: Math.floor(t.u),
      j: Math.floor(t.v),
    };
  }

  private devicePerCss(): number {
    const r = this.canvas.getBoundingClientRect();
    return r.width > 0 ? this.canvas.width / r.width : 1;
  }

  private toDevice(e: PointerEvent | WheelEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const sx = r.width > 0 ? this.canvas.width / r.width : 1;
    const sy = r.height > 0 ? this.canvas.height / r.height : 1;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  }

  private onDown(e: PointerEvent): void {
    if (!this.enabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1 && e.button !== 2) return;
    e.preventDefault();
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events may not be capturable */
    }
    const p = this.toDevice(e);
    this.pointers.set(e.pointerId, {
      id: e.pointerId,
      type: e.pointerType,
      button: e.button,
      x: p.x,
      y: p.y,
      startX: p.x,
      startY: p.y,
      t0: performance.now(),
    });
    this.camera.stop();
    if (this.pointers.size === 1) {
      this.mode = 'pending';
      this.samples = [{ t: performance.now(), x: p.x, y: p.y }];
    } else if (this.pointers.size === 2) {
      this.startPinch();
    }
  }

  private startPinch(): void {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return;
    if (this.mode !== 'pinch') this.events.emit('dragStart', undefined);
    this.mode = 'pinch';
    this.pinch = {
      dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      zoom: this.camera.zoom,
      mx: (a.x + b.x) / 2,
      my: (a.y + b.y) / 2,
    };
  }

  private onMove(e: PointerEvent): void {
    const p = this.toDevice(e);
    const ptr = this.pointers.get(e.pointerId);
    if (!ptr) {
      if (e.pointerType === 'mouse' && this.enabled)
        this.events.emit('hover', this.infoAt(p.x, p.y));
      return;
    }
    const dx = p.x - ptr.x;
    const dy = p.y - ptr.y;
    ptr.x = p.x;
    ptr.y = p.y;
    if (this.mode === 'pinch') {
      const [a, b] = [...this.pointers.values()];
      if (!a || !b) return;
      const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      this.camera.panByScreen(mx - this.pinch.mx, my - this.pinch.my);
      this.camera.setZoomAround((this.pinch.zoom * dist) / this.pinch.dist, mx, my);
      this.pinch.mx = mx;
      this.pinch.my = my;
      return;
    }
    if (this.mode === 'pending') {
      const slop = TAP_SLOP_CSS * this.devicePerCss();
      if (Math.hypot(p.x - ptr.startX, p.y - ptr.startY) > slop) {
        this.mode = 'drag';
        this.events.emit('dragStart', undefined);
        // Apply the movement accumulated inside the slop so the drag doesn't lag behind.
        this.camera.panByScreen(p.x - ptr.startX, p.y - ptr.startY);
      }
    } else if (this.mode === 'drag') {
      this.camera.panByScreen(dx, dy);
    }
    const now = performance.now();
    this.samples.push({ t: now, x: p.x, y: p.y });
    while (this.samples.length > 2 && now - this.samples[0]!.t > 100) this.samples.shift();
  }

  private onUp(e: PointerEvent, cancelled: boolean): void {
    const ptr = this.pointers.get(e.pointerId);
    if (!ptr) return;
    this.pointers.delete(e.pointerId);
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (this.mode === 'pinch') {
      if (this.pointers.size === 1) {
        // Continue as a drag with the remaining finger (no tap afterwards).
        const rest = [...this.pointers.values()][0]!;
        rest.startX = rest.x;
        rest.startY = rest.y;
        this.mode = 'drag';
        this.samples = [{ t: performance.now(), x: rest.x, y: rest.y }];
      } else if (this.pointers.size === 0) {
        this.mode = 'idle';
        this.camera.zoomTo(Math.round(this.camera.zoom), this.pinch.mx, this.pinch.my);
      }
      return;
    }
    if (this.pointers.size > 0) return;
    const wasMode = this.mode;
    this.mode = 'idle';
    if (cancelled) return;
    if (wasMode === 'pending' && performance.now() - ptr.t0 <= TAP_MAX_MS) {
      const p = this.toDevice(e);
      this.events.emit('tap', {
        ...this.infoAt(p.x, p.y),
        button: ptr.button,
        pointerType: ptr.type,
      });
    } else if (wasMode === 'drag') {
      this.releaseInertia();
    }
  }

  private releaseInertia(): void {
    const now = performance.now();
    const s = this.samples;
    if (s.length < 2) return;
    const last = s[s.length - 1]!;
    if (now - last.t > 80) return; // finger stopped before lifting
    const first = s[0]!;
    const dt = (last.t - first.t) / 1000;
    if (dt <= 0.005) return;
    const z = this.camera.zoom;
    this.camera.setVelocity(-(last.x - first.x) / dt / z, -(last.y - first.y) / dt / z);
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    if (!this.enabled) return;
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    // Two-finger trackpad scroll pans (sticky for the rest of the gesture).
    const now = performance.now();
    const kind = classifyWheel(e as WheelLike);
    if (!e.ctrlKey && (kind === 'pan' || now < this.trackpadUntil)) {
      this.trackpadUntil = now + TRACKPAD_STICKY_MS;
      const k = this.devicePerCss() * scale;
      this.camera.stop();
      this.camera.panByScreen(-e.deltaX * k, -e.deltaY * k);
      return;
    }
    // Trackpad pinch arrives as ctrl+wheel with small deltas: amplify.
    this.wheelAcc += e.deltaY * scale * (e.ctrlKey ? 4 : 1);
    const p = this.toDevice(e);
    // At most one level per event; leftover delta (trackpads) keeps accumulating.
    if (Math.abs(this.wheelAcc) >= WHEEL_STEP) {
      const dir = this.wheelAcc > 0 ? -1 : 1;
      this.wheelAcc = 0;
      this.camera.zoomBy(dir, p.x, p.y);
    }
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const map: Record<string, string> = {
      KeyW: 'up',
      ArrowUp: 'up',
      KeyS: 'down',
      ArrowDown: 'down',
      KeyA: 'left',
      ArrowLeft: 'left',
      KeyD: 'right',
      ArrowRight: 'right',
    };
    const dir = map[e.code];
    if (dir) {
      if (down) this.keys.add(dir);
      else this.keys.delete(dir);
      e.preventDefault();
      return;
    }
    if (!down || !this.enabled) return;
    if (e.key === '+' || e.key === '=') this.camera.zoomBy(1);
    else if (e.key === '-' || e.key === '_') this.camera.zoomBy(-1);
  }
}
