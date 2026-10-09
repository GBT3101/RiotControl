/**
 * Keyboard commands (PLAN §1.7): 1–0 deploy cards (H = helicopter), Esc cancel, Shift keeps
 * placing, G throws every charged gas grenade, Enter = "Let them come" / call the next wave
 * early, Space pause, F speed 1×/2×/3×. Camera keys (WASD/arrows/+/-) live in CameraController.
 * M9 moves this into its input/commands module; the controller API stays the same.
 */
import { UNIT_ORDER, type UnitId } from '../data/units';
import { HOTKEYS, type GameController } from './controller';

const BY_KEY = new Map<string, UnitId>(UNIT_ORDER.map((u) => [HOTKEYS[u], u]));

export function bindKeyboard(game: GameController): () => void {
  const down = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'Shift') {
      game.keepPlacing = true;
      return;
    }
    const digit = /^Digit(\d)$/.exec(e.code)?.[1];
    const key = digit ?? (e.code === 'KeyH' ? 'H' : null);
    if (key && BY_KEY.has(key)) {
      game.beginDeploy(BY_KEY.get(key)!);
      e.preventDefault();
      return;
    }
    switch (e.code) {
      case 'Escape':
        game.cancel();
        break;
      case 'KeyG':
        game.useAllAbilities();
        break;
      case 'Enter':
      case 'NumpadEnter':
        game.startWaves();
        break;
      case 'Space':
        game.togglePause();
        e.preventDefault();
        break;
      case 'KeyF':
        game.cycleSpeed();
        break;
      default:
    }
  };
  const up = (e: KeyboardEvent): void => {
    if (e.key === 'Shift') game.keepPlacing = false;
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
  };
}
