/**
 * UI pointer router. Capture-phase listeners on the game host element see every pointer event
 * before the canvas (where the camera controller listens). Presses that start on a UI node are
 * stopped there — taps on the HUD never fall through to the world — and routed to the node's
 * handlers: tap, long-press (touch info), hover (mouse), drag (scrolling the deploy sheet),
 * wheel. Presses that start on the world pass through untouched, even when they move over UI.
 */
import type { Container } from 'pixi.js';
import { hitTest, type HitResult, type UiHandlers, type UiNode, type UiPointerEvent } from './node';

const SLOP_CSS = 8;
const LONG_PRESS_MS = 420;

interface Press {
  id: number;
  node: UiNode;
  h: UiHandlers;
  x: number;
  y: number;
  sx: number;
  sy: number;
  moved: boolean;
  dragging: boolean;
  consumed: boolean;
  timer: number;
  type: string;
  button: number;
  shift: boolean;
}

export class UiInput {
  /** Top-most root last. */
  roots: Container[] = [];
  /** Called when the mouse moves onto the UI (the world should drop its hover ghost). */
  onEnterUi: (() => void) | null = null;
  /** Any UI press (audio unlock, dismiss toasts). */
  onAnyPress: (() => void) | null = null;
  private readonly presses = new Map<number, Press>();
  private hovered: { node: UiNode; h: UiHandlers } | null = null;
  private readonly disposers: Array<() => void> = [];
  private overUi = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
  ) {
    const on = <E extends Event>(type: string, fn: (e: E) => void, passive = false): void => {
      const l = fn as unknown as EventListener;
      host.addEventListener(type, l, { capture: true, passive });
      this.disposers.push(() => host.removeEventListener(type, l, { capture: true }));
    };
    on<PointerEvent>('pointerdown', (e) => this.down(e));
    on<PointerEvent>('pointermove', (e) => this.move(e));
    on<PointerEvent>('pointerup', (e) => this.up(e, false));
    on<PointerEvent>('pointercancel', (e) => this.up(e, true));
    on<WheelEvent>('wheel', (e) => this.wheel(e));
    on<MouseEvent>('contextmenu', (e) => e.preventDefault());
  }

  destroy(): void {
    for (const d of this.disposers) d();
  }

  /** Device px of a client point. */
  private toDevice(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const sx = r.width > 0 ? this.canvas.width / r.width : 1;
    const sy = r.height > 0 ? this.canvas.height / r.height : 1;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  }

  private devicePerCss(): number {
    const r = this.canvas.getBoundingClientRect();
    return r.width > 0 ? this.canvas.width / r.width : 1;
  }

  /** Top-most UI hit at a device point. */
  hit(x: number, y: number): HitResult | null {
    for (let k = this.roots.length - 1; k >= 0; k--) {
      const r = hitTest(this.roots[k]!, x, y);
      if (r) return r;
    }
    return null;
  }

  private evt(p: Press | null, local: { x: number; y: number }, e: PointerEvent): UiPointerEvent {
    return {
      x: local.x,
      y: local.y,
      pointerType: e.pointerType || 'mouse',
      button: p?.button ?? e.button,
      shift: e.shiftKey,
    };
  }

  private down(e: PointerEvent): void {
    const d = this.toDevice(e);
    const hit = this.hit(d.x, d.y);
    if (!hit) return;
    e.stopPropagation();
    e.preventDefault();
    this.onAnyPress?.();
    if (hit.handlers.blockOnly || hit.handlers.disabled) return;
    try {
      this.host.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events */
    }
    const p: Press = {
      id: e.pointerId,
      node: hit.node,
      h: hit.handlers,
      x: d.x,
      y: d.y,
      sx: d.x,
      sy: d.y,
      moved: false,
      dragging: false,
      consumed: false,
      timer: 0,
      type: e.pointerType,
      button: e.button,
      shift: e.shiftKey,
    };
    this.presses.set(e.pointerId, p);
    if (e.pointerType === 'mouse' && e.button === 2) {
      // Right click = info (desktop equivalent of a long press).
      p.consumed = !!hit.handlers.longPress?.(this.evt(p, hit.local, e));
      if (!p.consumed) p.consumed = true;
      return;
    }
    hit.handlers.state?.('pressed');
    if (hit.handlers.longPress && e.pointerType !== 'mouse') {
      p.timer = window.setTimeout(() => {
        if (p.moved || !this.presses.has(p.id)) return;
        if (p.h.longPress?.(this.evt(p, hit.local, e))) {
          p.consumed = true;
          p.h.state?.('normal');
        }
      }, LONG_PRESS_MS);
    }
  }

  private move(e: PointerEvent): void {
    const d = this.toDevice(e);
    const p = this.presses.get(e.pointerId);
    if (p) {
      e.stopPropagation();
      e.preventDefault();
      const dx = d.x - p.x;
      const dy = d.y - p.y;
      p.x = d.x;
      p.y = d.y;
      const slop = SLOP_CSS * this.devicePerCss();
      if (!p.moved && Math.hypot(d.x - p.sx, d.y - p.sy) > slop) {
        p.moved = true;
        window.clearTimeout(p.timer);
        if (p.h.drag) {
          p.dragging = true;
          p.h.state?.('normal');
          // Apply the movement accumulated inside the slop.
          const s = p.node.worldTransform.a || 1;
          p.h.drag((d.x - p.sx - dx) / s, (d.y - p.sy - dy) / s, this.evt(p, { x: 0, y: 0 }, e));
        } else p.h.state?.('normal');
      }
      if (p.dragging && p.h.drag) {
        const s = p.node.worldTransform.a || 1;
        p.h.drag(dx / s, dy / s, this.evt(p, { x: 0, y: 0 }, e));
      }
      return;
    }
    if (e.pointerType !== 'mouse' || e.buttons !== 0 || this.presses.size > 0) {
      // A world drag in progress: never interfere.
      if (e.buttons !== 0) return;
    }
    const hit = this.hit(d.x, d.y);
    const node = hit && !hit.handlers.blockOnly ? hit : null;
    if (node?.node !== this.hovered?.node) {
      if (this.hovered) {
        this.hovered.h.hover?.(false);
        if (!this.hovered.h.disabled) this.hovered.h.state?.('normal');
      }
      this.hovered = node ? { node: node.node, h: node.handlers } : null;
      if (node) {
        node.handlers.hover?.(true);
        if (!node.handlers.disabled) node.handlers.state?.('hover');
      }
      this.host.style.cursor =
        node && !node.handlers.disabled ? (node.handlers.cursor ?? 'pointer') : '';
    }
    if (hit) {
      e.stopPropagation();
      if (!this.overUi) this.onEnterUi?.();
      this.overUi = true;
    } else this.overUi = false;
  }

  private up(e: PointerEvent, cancelled: boolean): void {
    const p = this.presses.get(e.pointerId);
    if (!p) return;
    e.stopPropagation();
    e.preventDefault();
    this.presses.delete(e.pointerId);
    window.clearTimeout(p.timer);
    try {
      this.host.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (p.dragging) p.h.dragEnd?.();
    const d = this.toDevice(e);
    const hit = this.hit(d.x, d.y);
    const inside = hit?.node === p.node;
    p.h.state?.(inside && e.pointerType === 'mouse' ? 'hover' : 'normal');
    if (cancelled || p.moved || p.consumed || !inside || p.h.disabled) return;
    p.h.tap?.(this.evt(p, hit.local, e));
  }

  private wheel(e: WheelEvent): void {
    const d = this.toDevice(e);
    const hit = this.hit(d.x, d.y);
    if (!hit) return;
    e.stopPropagation();
    e.preventDefault();
    hit.handlers.wheel?.(e.deltaY + e.deltaX);
  }

  /** Forget hover/press state (screen change). */
  reset(): void {
    for (const p of this.presses.values()) window.clearTimeout(p.timer);
    this.presses.clear();
    this.hovered = null;
    this.host.style.cursor = '';
  }
}
