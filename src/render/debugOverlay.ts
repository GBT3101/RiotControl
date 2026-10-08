/**
 * FPS / debug overlay (DOM, crisp at any DPR). Toggle with the backtick key (`).
 * Game code pushes named lines via `set(key, value)`; FPS is measured here.
 */
export class DebugOverlay {
  readonly el: HTMLPreElement;
  private readonly lines = new Map<string, string>();
  private frames = 0;
  private acc = 0;
  private fps = 0;
  private worst = 0;
  private worstShown = 0;
  private visible: boolean;
  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.code === 'Backquote') {
      this.toggle();
      e.preventDefault();
    }
  };

  constructor(parent: HTMLElement, visible = false) {
    this.el = document.createElement('pre');
    this.el.className = 'debug-overlay';
    parent.appendChild(this.el);
    this.visible = visible;
    this.el.hidden = !visible;
    window.addEventListener('keydown', this.onKey);
  }

  toggle(force?: boolean): void {
    this.visible = force ?? !this.visible;
    this.el.hidden = !this.visible;
  }

  get shown(): boolean {
    return this.visible;
  }

  set(key: string, value: string | number): void {
    this.lines.set(key, String(value));
  }

  /** Call once per rendered frame with the real frame time (ms). */
  frame(dtMs: number): void {
    this.frames++;
    this.acc += dtMs;
    this.worst = Math.max(this.worst, dtMs);
    if (this.acc >= 500) {
      this.fps = (this.frames * 1000) / this.acc;
      this.worstShown = this.worst;
      this.frames = 0;
      this.acc = 0;
      this.worst = 0;
      if (this.visible) this.render();
    }
  }

  get currentFps(): number {
    return this.fps;
  }

  private render(): void {
    const out = [`fps   ${this.fps.toFixed(0)}  (worst ${this.worstShown.toFixed(1)} ms)`];
    for (const [k, v] of this.lines) out.push(`${k.padEnd(5)} ${v}`);
    this.el.textContent = out.join('\n');
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey);
    this.el.remove();
  }
}
