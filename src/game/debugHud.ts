/**
 * Bare debug HUD (DOM text) so the game is playable end-to-end before M9's real HUD:
 * Hate, Legitimacy/level, wave/phase, crowd, Capitol integrity, deploy keys, speed/pause,
 * plus a simple victory/defeat overlay. FPS and perf lines come from the debug overlay (`).
 */
import type { GameController } from './controller';

export class DebugHud {
  private readonly el: HTMLPreElement;
  private readonly over: HTMLDivElement;
  private acc = 0;

  constructor(private readonly game: GameController) {
    this.el = document.createElement('pre');
    this.el.className = 'debug-hud';
    document.body.appendChild(this.el);
    this.over = document.createElement('div');
    this.over.className = 'game-over';
    this.over.hidden = true;
    document.body.appendChild(this.over);
    game.bus.on('gameOver', (e) => {
      this.over.hidden = false;
      this.over.textContent = e.victory
        ? 'ORDER RESTORED — but at what cost?'
        : 'THE REGIME HAS FALLEN';
      console.info(`[riot] ${e.victory ? 'victory' : 'defeat'}`, e.stats);
    });
  }

  update(dtMs: number): void {
    this.acc += dtMs;
    if (this.acc < 150) return;
    this.acc = 0;
    const h = this.game.hud();
    const g = this.game;
    const hh = Math.floor(h.hour);
    const mm = Math.floor((h.hour % 1) * 60);
    const phase =
      h.phase === 'prep'
        ? 'PREP — press Enter: "Let them come"'
        : h.phase === 'breather'
          ? `breather ${h.breather.toFixed(0)}s (Enter: call early)`
          : `wave in progress (${h.pending} queued)`;
    const opts = g
      .deployOptions()
      .map((o) => (o.unlocked ? `${o.hotkey}:${o.unit}${o.affordable ? '' : '·'}` : ''))
      .filter(Boolean)
      .join(' ');
    this.el.textContent = [
      `HATE ${h.hate}   LEGIT ${h.legit}/${h.nextLevelAt} (L${h.level})   CAPITOL ${(h.integrity * 100).toFixed(0)}%`,
      `WAVE ${h.wave} ${phase}   CROWD ${h.crowd}`,
      `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  x${h.speed}${h.paused ? ' PAUSED' : ''}  ${g.deployUnit ? `DEPLOY ${g.deployUnit} (Esc)` : g.selectedUnit !== null ? `SELECTED #${g.selectedUnit}` : ''}`,
      opts,
    ].join('\n');
  }
}
