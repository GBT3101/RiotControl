/**
 * Interactive UI nodes. Any Pixi container can become interactive by attaching `UiHandlers`
 * (`makeInteractive`). The UI input router (`core/input.ts`) hit-tests the UI roots top-most
 * first in UI px and routes pointer events to the handlers, so taps on the UI never reach the
 * world (camera / placement).
 */
import { Point, type Container } from 'pixi.js';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type PressState = 'normal' | 'hover' | 'pressed' | 'disabled';

export interface UiPointerEvent {
  /** Pointer position in the node's local UI px. */
  x: number;
  y: number;
  pointerType: string;
  button: number;
  shift: boolean;
}

export interface UiHandlers {
  /** Hit rectangle in local UI px (default: the container's local bounds). */
  hit?: Rect | (() => Rect);
  /** Swallow pointer events without reacting (modal backdrops, panels). */
  blockOnly?: boolean;
  disabled?: boolean;
  /** CSS cursor while hovered. */
  cursor?: string;
  tap?(e: UiPointerEvent): void;
  /** Long press (touch) / right-click info. Return true if consumed (suppresses the tap). */
  longPress?(e: UiPointerEvent): boolean | void;
  hover?(over: boolean): void;
  /** Visual state changes (normal / hover / pressed). */
  state?(s: PressState): void;
  /** Drag (UI px since the last move). Returning true keeps the press alive (scrolling). */
  drag?(dx: number, dy: number, e: UiPointerEvent): boolean | void;
  dragEnd?(): void;
  wheel?(dy: number): void;
}

export interface UiNode extends Container {
  __ui?: UiHandlers;
}

export function makeInteractive<T extends Container>(c: T, h: UiHandlers): T & UiNode {
  (c as T & UiNode).__ui = h;
  return c as T & UiNode;
}

export function handlersOf(c: Container): UiHandlers | undefined {
  return (c as UiNode).__ui;
}

const tmp = new Point();

function rectOf(c: Container, h: UiHandlers): Rect {
  if (h.hit) return typeof h.hit === 'function' ? h.hit() : h.hit;
  const b = c.getLocalBounds();
  return { x: b.x, y: b.y, w: b.width, h: b.height };
}

export interface HitResult {
  node: UiNode;
  handlers: UiHandlers;
  local: { x: number; y: number };
}

/**
 * Top-most interactive node under a global (device px) point, searching `root` depth-first in
 * reverse child order (later children are drawn on top). Invisible subtrees are skipped.
 */
export function hitTest(root: Container, gx: number, gy: number): HitResult | null {
  if (!root.visible || root.alpha <= 0.01) return null;
  const kids = root.children;
  for (let k = kids.length - 1; k >= 0; k--) {
    const r = hitTest(kids[k] as Container, gx, gy);
    if (r) return r;
  }
  const h = handlersOf(root);
  if (!h) return null;
  tmp.set(gx, gy);
  const p = root.toLocal(tmp);
  const r = rectOf(root, h);
  if (p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h) {
    return { node: root as UiNode, handlers: h, local: { x: p.x, y: p.y } };
  }
  return null;
}

/** Global rect (device px) of a node's hit area. */
export function globalRect(c: Container): Rect {
  const h = handlersOf(c);
  const r = h
    ? rectOf(c, h)
    : (() => {
        const b = c.getLocalBounds();
        return { x: b.x, y: b.y, w: b.width, h: b.height };
      })();
  const a = c.toGlobal(new Point(r.x, r.y));
  const b = c.toGlobal(new Point(r.x + r.w, r.y + r.h));
  return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
}
