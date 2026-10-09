/**
 * Keyboard commands (PLAN §1.7, M9). Camera keys (WASD / arrows / + / wheel) stay in the
 * CameraController.
 *
 *   1–9, 0, -   deploy card (Riot Control … Tank, Helicopter)   H also selects the helicopter
 *   Shift       hold: keep placing after a deploy
 *   Esc         leave deploy / clear selection / close menu / pause menu
 *   G           throw every charged tear-gas grenade
 *   Space       pause / resume (quick)  F   speed 1× / 2× / 3×
 *   Enter       "Let them come" / call the next wave early
 *   M           mute                    Tab minimap on/off
 *
 * The main-row "-" is the helicopter hotkey here, so it is taken before the camera sees it
 * (zoom out with the wheel, pinch or numpad −).
 */
import { UNIT_ORDER, type UnitId } from '../data/units';
import type { GameController } from './controller';
import { HOTKEYS } from './controller';

/** What the keyboard drives (implemented by the UI app). */
export interface KeyTarget {
  readonly game: GameController | null;
  /** 'game' while a run is in progress. */
  readonly mode: string;
  /** A screen (menu) is open. */
  readonly topScreen: unknown;
  /** Give a key to the top-most screen (menus); true when consumed. */
  screenKey(code: string): boolean;
  pickUnit(unit: UnitId): void;
  escape(): void;
  toggleMute(): void;
  toggleMinimap(): void;
  /** Space: quick pause toggle (closes the pause menu if it is open). */
  quickPause(): void;
}

const BY_KEY = new Map<string, UnitId>(UNIT_ORDER.map((u) => [HOTKEYS[u], u]));

/** Hotkey for a keyboard event code ('Digit1' → '1', 'Minus' → '-', 'KeyH' → '-'). */
export function hotkeyOf(code: string): UnitId | null {
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(code)?.[1];
  const key = digit ?? (code === 'Minus' || code === 'KeyH' ? '-' : null);
  return key ? (BY_KEY.get(key) ?? null) : null;
}

export function bindKeyboard(app: KeyTarget): () => void {
  const typing = (e: KeyboardEvent): boolean => {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  };
  const down = (e: KeyboardEvent): void => {
    if (typing(e)) return;
    const game = app.game;
    const inGame = app.mode === 'game' && !!game && !game.attract;
    if (e.key === 'Shift') {
      if (game) game.keepPlacing = true;
      return;
    }
    if (e.code === 'Escape') {
      app.escape();
      e.preventDefault();
      return;
    }
    if (app.topScreen && app.screenKey(e.code)) {
      e.preventDefault();
      return;
    }
    if (e.code === 'KeyM') {
      app.toggleMute();
      return;
    }
    if (!inGame || !game) return;
    if (e.code === 'Space') {
      app.quickPause();
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (app.topScreen) return;
    const unit = hotkeyOf(e.code);
    if (unit && !e.ctrlKey && !e.metaKey && !e.altKey) {
      app.pickUnit(unit);
      e.preventDefault();
      // Keep the main-row "-" from also zooming the camera out.
      if (e.code === 'Minus') e.stopImmediatePropagation();
      return;
    }
    switch (e.code) {
      case 'KeyG':
        game.useAllAbilities();
        break;
      case 'Enter':
      case 'NumpadEnter':
        game.startWaves();
        break;
      case 'KeyF':
        game.cycleSpeed();
        break;
      case 'Tab':
        app.toggleMinimap();
        e.preventDefault();
        break;
      default:
    }
  };
  const up = (e: KeyboardEvent): void => {
    if (e.key === 'Shift' && app.game) app.game.keepPlacing = false;
  };
  // Capture phase: runs before the camera controller's window listeners.
  window.addEventListener('keydown', down, { capture: true });
  window.addEventListener('keyup', up, { capture: true });
  return () => {
    window.removeEventListener('keydown', down, { capture: true });
    window.removeEventListener('keyup', up, { capture: true });
  };
}
