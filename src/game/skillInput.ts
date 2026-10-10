/**
 * Canvas pointer shell for the aim / paint modes (the rules live in the pure `skillGesture.ts`).
 *
 * While a session is active (`active()`), capture-phase listeners on the canvas take every pointer
 * event before the camera controller sees it (`stopImmediatePropagation`): one-finger gestures
 * aim, paint or pan as the state machine decides, two fingers pinch / pan the camera here (same
 * maths as `CameraController`). Presses that start on the HUD never get here (the UI router stops
 * them on the host element first). The wheel and the camera keys stay with the camera controller.
 */
import type { GestureEvent } from './skillGesture';

export interface SkillInputTarget {
  /** A session is running (otherwise events pass through untouched). */
  active(): boolean;
  /** Continuous tile point under a device-px canvas point. */
  tileAt(sx: number, sy: number): { u: number; v: number };
  feed(ev: GestureEvent): void;
}

export class SkillPointerInput {
  private readonly disposers: Array<() => void> = [];
  private readonly mine = new Set<number>();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly target: SkillInputTarget,
  ) {
    const on = (type: string, fn: (e: PointerEvent) => void): void => {
      const l = fn as unknown as EventListener;
      canvas.addEventListener(type, l, { capture: true });
      this.disposers.push(() => canvas.removeEventListener(type, l, { capture: true }));
    };
    on('pointerdown', (e) => this.handle(e, 'down'));
    on('pointermove', (e) => this.handle(e, 'move'));
    on('pointerup', (e) => this.handle(e, 'up'));
    on('pointercancel', (e) => this.handle(e, 'lost'));
  }

  destroy(): void {
    for (const d of this.disposers) d();
    this.disposers.length = 0;
  }

  private toDevice(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const sx = r.width > 0 ? this.canvas.width / r.width : 1;
    const sy = r.height > 0 ? this.canvas.height / r.height : 1;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  }

  private handle(e: PointerEvent, kind: 'down' | 'move' | 'up' | 'lost'): void {
    const owned = this.mine.has(e.pointerId);
    // Only presses that began in a session belong to it (a drag already panning stays a pan).
    if (!owned && (kind !== 'down' || !this.target.active())) {
      if (kind === 'move' && e.pointerType === 'mouse' && e.buttons === 0 && this.target.active()) {
        const p = this.toDevice(e);
        const t = this.target.tileAt(p.x, p.y);
        this.target.feed({ kind: 'hover', u: t.u, v: t.v });
        e.stopImmediatePropagation();
      }
      return;
    }
    e.stopImmediatePropagation();
    e.preventDefault();
    if (kind === 'lost') {
      this.mine.delete(e.pointerId);
      this.target.feed({ kind: 'lost', id: e.pointerId });
      return;
    }
    if (kind === 'down') {
      this.mine.add(e.pointerId);
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic events may not be capturable */
      }
    } else if (kind === 'up') {
      this.mine.delete(e.pointerId);
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    const p = this.toDevice(e);
    const t = this.target.tileAt(p.x, p.y);
    this.target.feed({
      kind,
      p: { id: e.pointerId, sx: p.x, sy: p.y, type: e.pointerType || 'mouse', button: e.button },
      t: performance.now(),
      u: t.u,
      v: t.v,
    });
  }
}
