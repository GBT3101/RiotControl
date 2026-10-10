/**
 * Aim / paint input for the player-aimed skills (docs/specials.md): the Tank's missile (aim mode)
 * and the Helicopter's air strike (paint mode). Pure state machine over raw pointer events — no
 * DOM, no camera — so the gesture rules are unit-tested; `skillInput.ts` feeds it from the canvas
 * and applies the returned effects (camera pan / pinch, sounds, fire, cancel).
 *
 * Rules (mobile first: one thumb, see it before it happens, never fire by accident):
 * - Two fingers always pan / zoom the camera and never fire: a stroke being painted is voided,
 *   and the finger left after a pinch is spent until every finger lifts.
 * - Aim, touch: the reticle starts locked on the densest crowd in range. A tap on the map moves
 *   it there and locks it (`aimLock`); a tap on the locked reticle fires. So firing always takes
 *   a deliberate second tap on the thing you can see, like the deploy confirm tap. A one-finger
 *   drag that starts on the reticle drags it; one that starts anywhere else pans the camera.
 *   A tap outside the range ring aborts.
 * - Aim, mouse: the reticle follows the pointer (hover); a click inside the ring fires, a click
 *   outside aborts, a drag pans, right click aborts.
 * - Paint: a one-finger (left-button) drag paints the line; release fires it when it is at least
 *   `minLen` long (the sim cuts it at `maxLen`; the guide shows the cut part as "too long"). A tap
 *   or a too-short stroke does nothing.
 * - `cancel` (CANCEL button, Esc, right click) aborts either mode.
 */

export type SkillInputMode = 'aim' | 'paint';

export interface GesturePointer {
  id: number;
  /** Device px on the canvas. */
  sx: number;
  sy: number;
  type: string;
  button: number;
}

export type GestureEvent =
  /** `u, v` = the continuous tile point under the pointer; `t` = ms timestamp. */
  | { kind: 'down' | 'move' | 'up'; p: GesturePointer; t: number; u: number; v: number }
  /** The browser took the pointer away (pointercancel). */
  | { kind: 'lost'; id: number }
  /** Mouse moving with no button down. */
  | { kind: 'hover'; u: number; v: number }
  /** CANCEL button, Esc. */
  | { kind: 'cancel' };

export interface GestureContext {
  /** The skill's origin (tank) in tile coords and the aim range (tiles). */
  ox: number;
  oy: number;
  range: number;
  /** Paint: line length limits (tiles). */
  minLen: number;
  maxLen: number;
  /** Device px a press may wander and still be a tap. */
  slop: number;
  /** Device px radius around the reticle that grabs it. */
  grab: number;
  /** Longest press (ms) that still counts as a tap. */
  tapMs: number;
  /** Device px of a tile point (reticle grabs). */
  toScreen(u: number, v: number): { x: number; y: number };
}

type Gesture = 'idle' | 'press' | 'grab' | 'drag' | 'pan' | 'paint' | 'pinch' | 'spent';

interface Ptr {
  id: number;
  type: string;
  button: number;
  sx: number;
  sy: number;
  startX: number;
  startY: number;
  u0: number;
  v0: number;
  t0: number;
}

export interface SkillInputState {
  mode: SkillInputMode;
  /** Aim: the reticle (tile coords); `locked` = a tap on it fires (touch). */
  target: { u: number; v: number } | null;
  locked: boolean;
  /** Paint: the stroke (flat tile coords, ≥ ¼-tile steps) and its length (tiles). */
  stroke: number[];
  strokeLen: number;
  /** A second finger turned the stroke into a pinch: shown greyed, never fired. */
  strokeVoid: boolean;
  /** Bumped whenever the stroke changes (the view repaints the line). */
  strokeVersion: number;
  g: Gesture;
  pointers: Ptr[];
  pinch: { dist: number; mx: number; my: number } | null;
  /** Where the last aim / paint tick sounded (tile coords / arc length). */
  tickU: number;
  tickV: number;
  tickLen: number;
  done: null | 'fired' | 'cancelled';
}

export type SkillSound = 'aimTick' | 'aimLock' | 'aimCancel' | 'paintTick';

export type SkillEffect =
  | { type: 'pan'; dx: number; dy: number }
  | { type: 'pinchStart' }
  /** Zoom by `scale` (relative to the pinch start) around (mx, my), after panning by (dmx, dmy). */
  | { type: 'pinch'; scale: number; mx: number; my: number; dmx: number; dmy: number }
  | { type: 'pinchEnd'; mx: number; my: number }
  | { type: 'fire'; aim: { x: number; y: number } | { path: number[] } }
  | { type: 'cancel' }
  | { type: 'sound'; id: SkillSound };

/** A fresh aim / paint session. `target` = where the reticle starts (aim), locked on. */
export function initSkillInput(
  mode: SkillInputMode,
  target: { u: number; v: number } | null = null,
): SkillInputState {
  return {
    mode,
    target,
    locked: target !== null,
    stroke: [],
    strokeLen: 0,
    strokeVoid: false,
    strokeVersion: 0,
    g: 'idle',
    pointers: [],
    pinch: null,
    tickU: target?.u ?? 0,
    tickV: target?.v ?? 0,
    tickLen: 0,
    done: null,
  };
}

/** Is a tile point inside the aim range? */
export function inAimRange(ctx: GestureContext, u: number, v: number): boolean {
  return Math.hypot(u - ctx.ox, v - ctx.oy) <= ctx.range;
}

/** The reticle's look: idle (following), locked, or invalid (out of range). */
export function reticleState(
  s: SkillInputState,
  ctx: GestureContext,
): 'idle' | 'locked' | 'invalid' | null {
  if (!s.target) return null;
  if (!inAimRange(ctx, s.target.u, s.target.v)) return 'invalid';
  return s.locked ? 'locked' : 'idle';
}

const STEP = 0.25;

function pinchOf(ps: Ptr[]): { dist: number; mx: number; my: number } {
  const a = ps[0]!;
  const b = ps[1]!;
  return {
    dist: Math.max(1, Math.hypot(a.sx - b.sx, a.sy - b.sy)),
    mx: (a.sx + b.sx) / 2,
    my: (a.sy + b.sy) / 2,
  };
}

/**
 * Advance the machine by one event. Returns the next state (the input is not mutated) and the
 * effects to apply. A state with `done` set ends the session.
 */
export function reduceSkillInput(
  prev: SkillInputState,
  ev: GestureEvent,
  ctx: GestureContext,
): { state: SkillInputState; effects: SkillEffect[] } {
  const s: SkillInputState = {
    ...prev,
    stroke: prev.stroke,
    pointers: prev.pointers.map((p) => ({ ...p })),
    pinch: prev.pinch ? { ...prev.pinch } : null,
  };
  const fx: SkillEffect[] = [];
  if (s.done) return { state: s, effects: fx };
  const end = (how: 'fired' | 'cancelled', e: SkillEffect): void => {
    s.done = how;
    s.g = 'idle';
    fx.push(e);
    if (how === 'cancelled') fx.push({ type: 'sound', id: 'aimCancel' });
  };
  const setTarget = (u: number, v: number): void => {
    s.target = { u, v };
    if (Math.hypot(u - s.tickU, v - s.tickV) >= 0.5) {
      s.tickU = u;
      s.tickV = v;
      fx.push({ type: 'sound', id: 'aimTick' });
    }
  };
  const onReticle = (p: { sx: number; sy: number }): boolean => {
    if (!s.target) return false;
    const r = ctx.toScreen(s.target.u, s.target.v);
    return Math.hypot(p.sx - r.x, p.sy - r.y) <= ctx.grab;
  };
  const addPoint = (u: number, v: number): void => {
    const st = s.stroke;
    const n = st.length;
    if (n >= 2) {
      const d = Math.hypot(u - st[n - 2]!, v - st[n - 1]!);
      if (d < STEP) return;
      s.strokeLen += d;
    }
    s.stroke = [...st, u, v];
    s.strokeVersion++;
    if (s.strokeLen - s.tickLen >= 0.5) {
      s.tickLen = s.strokeLen;
      fx.push({ type: 'sound', id: 'paintTick' });
    }
  };
  const clearStroke = (): void => {
    if (s.stroke.length === 0 && !s.strokeVoid) return;
    s.stroke = [];
    s.strokeLen = 0;
    s.tickLen = 0;
    s.strokeVoid = false;
    s.strokeVersion++;
  };

  switch (ev.kind) {
    case 'cancel':
      end('cancelled', { type: 'cancel' });
      break;

    case 'hover':
      if (s.mode === 'aim' && s.g === 'idle') {
        s.locked = false;
        setTarget(ev.u, ev.v);
      }
      break;

    case 'lost': {
      const k = s.pointers.findIndex((p) => p.id === ev.id);
      if (k < 0) break;
      s.pointers.splice(k, 1);
      if (s.g === 'paint') clearStroke();
      s.pinch = null;
      s.g = s.pointers.length > 0 ? 'spent' : 'idle';
      break;
    }

    case 'down': {
      const p = ev.p;
      if (p.type === 'mouse' && p.button === 2) {
        end('cancelled', { type: 'cancel' });
        break;
      }
      if (s.pointers.some((q) => q.id === p.id)) break;
      s.pointers.push({
        id: p.id,
        type: p.type,
        button: p.button,
        sx: p.sx,
        sy: p.sy,
        startX: p.sx,
        startY: p.sy,
        u0: ev.u,
        v0: ev.v,
        t0: ev.t,
      });
      if (s.pointers.length === 1) {
        if (s.g === 'spent') break;
        s.g = s.mode === 'aim' && p.type !== 'mouse' && onReticle(p) ? 'grab' : 'press';
      } else if (s.pointers.length === 2) {
        // Two fingers: camera only. A stroke in progress is void (shown greyed until lifted).
        if (s.g === 'paint') {
          s.strokeVoid = true;
          s.strokeVersion++;
        }
        s.g = 'pinch';
        s.pinch = pinchOf(s.pointers);
        fx.push({ type: 'pinchStart' });
      }
      break;
    }

    case 'move': {
      const p = s.pointers.find((q) => q.id === ev.p.id);
      if (!p) break;
      const dx = ev.p.sx - p.sx;
      const dy = ev.p.sy - p.sy;
      p.sx = ev.p.sx;
      p.sy = ev.p.sy;
      const far = Math.hypot(p.sx - p.startX, p.sy - p.startY) > ctx.slop;
      switch (s.g) {
        case 'pinch': {
          if (s.pointers.length < 2 || !s.pinch) break;
          const q = pinchOf(s.pointers);
          fx.push({
            type: 'pinch',
            scale: q.dist / s.pinch.dist,
            mx: q.mx,
            my: q.my,
            dmx: q.mx - s.pinch.mx,
            dmy: q.my - s.pinch.my,
          });
          s.pinch = { dist: s.pinch.dist, mx: q.mx, my: q.my };
          break;
        }
        case 'press':
          if (!far) break;
          if (s.mode === 'paint') {
            s.g = 'paint';
            clearStroke();
            addPoint(p.u0, p.v0);
            addPoint(ev.u, ev.v);
          } else {
            s.g = 'pan';
            fx.push({ type: 'pan', dx: p.sx - p.startX, dy: p.sy - p.startY });
          }
          break;
        case 'grab':
          if (!far) break;
          s.g = 'drag';
          s.locked = false;
          setTarget(ev.u, ev.v);
          break;
        case 'drag':
          setTarget(ev.u, ev.v);
          break;
        case 'pan':
          fx.push({ type: 'pan', dx, dy });
          break;
        case 'paint':
          addPoint(ev.u, ev.v);
          break;
        default:
      }
      break;
    }

    case 'up': {
      const k = s.pointers.findIndex((q) => q.id === ev.p.id);
      if (k < 0) break;
      const p = s.pointers[k]!;
      s.pointers.splice(k, 1);
      const g = s.g;
      if (g === 'pinch') {
        const pin = s.pinch;
        s.pinch = null;
        s.g = s.pointers.length > 0 ? 'spent' : 'idle';
        if (pin) fx.push({ type: 'pinchEnd', mx: pin.mx, my: pin.my });
        if (s.g === 'idle' && s.strokeVoid) clearStroke();
        break;
      }
      s.g = s.pointers.length > 0 ? 'spent' : 'idle';
      if (g === 'spent') {
        if (s.g === 'idle' && s.strokeVoid) clearStroke();
        break;
      }
      const tap = ev.t - p.t0 <= ctx.tapMs;
      if (s.mode === 'aim') {
        if (g === 'drag') {
          // Dropped the reticle: locked when it is inside the ring (a tap on it then fires).
          s.locked = inAimRange(ctx, ev.u, ev.v);
          if (s.locked) fx.push({ type: 'sound', id: 'aimLock' });
          break;
        }
        if ((g !== 'press' && g !== 'grab') || !tap) break;
        if (!inAimRange(ctx, ev.u, ev.v)) {
          end('cancelled', { type: 'cancel' });
          break;
        }
        if (p.type === 'mouse') {
          end('fired', { type: 'fire', aim: { x: ev.u, y: ev.v } });
          break;
        }
        if (g === 'grab' && s.locked && s.target) {
          end('fired', { type: 'fire', aim: { x: s.target.u, y: s.target.v } });
          break;
        }
        s.target = { u: ev.u, v: ev.v };
        s.tickU = ev.u;
        s.tickV = ev.v;
        s.locked = true;
        fx.push({ type: 'sound', id: 'aimLock' });
        break;
      }
      // Paint.
      if (g === 'paint') {
        if (!s.strokeVoid && s.strokeLen >= ctx.minLen) {
          end('fired', { type: 'fire', aim: { path: s.stroke.slice() } });
        } else clearStroke();
      }
      break;
    }
  }
  return { state: s, effects: fx };
}

/** Painted length within the cap (tiles) and whether the stroke runs past it. */
export function strokeStatus(
  s: SkillInputState,
  ctx: GestureContext,
): { len: number; tooLong: boolean; ok: boolean } {
  const tooLong = s.strokeLen > ctx.maxLen;
  return {
    len: Math.min(s.strokeLen, ctx.maxLen),
    tooLong,
    ok: !s.strokeVoid && s.strokeLen >= ctx.minLen,
  };
}
