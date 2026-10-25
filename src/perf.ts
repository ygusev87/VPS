// A hidden meter for checking speed on the real iPad: five quick taps on the
// game's title show or hide it (remembered on the device). Once a second it
// shows frames a second, the slowest frame, the picture quality and what each
// frame costs to draw.
import type { Stage } from './stage';

const KEY = 'electro-table:perf';

export class PerfMeter {
  private el = document.createElement('div');
  private on = false;
  private frames: number[] = [];
  private last = 0;
  private shownAt = 0;

  constructor(
    private stage: Stage,
    /** The title in the corner; it lets taps through, so they are counted by position. */
    title: Element,
  ) {
    this.el.className = 'perf';
    document.body.append(this.el);
    let on = false;
    try {
      on = localStorage.getItem(KEY) === '1';
    } catch {
      // Storage blocked: the meter starts hidden.
    }
    this.show(on);
    let taps: number[] = [];
    document.addEventListener(
      'pointerdown',
      (e) => {
        const r = title.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
        const now = performance.now();
        taps = [...taps.filter((t) => now - t < 2500), now];
        if (taps.length < 5) return;
        taps = [];
        this.show(!this.on);
      },
      true,
    );
  }

  private show(on: boolean) {
    this.on = on;
    this.el.hidden = !on;
    this.frames = [];
    this.last = 0;
    // Counted over a whole second (every pass of every frame) while the meter is up.
    this.stage.renderer.info.autoReset = !on;
    this.stage.renderer.info.reset();
    try {
      localStorage.setItem(KEY, on ? '1' : '0');
    } catch {
      // Not remembered; fine.
    }
  }

  /** Call once a frame, after drawing. */
  tick(now: number) {
    if (!this.on) return;
    if (this.last) this.frames.push(now - this.last);
    this.last = now;
    if (now - this.shownAt < 1000 || !this.frames.length) return;
    this.shownAt = now;
    const n = this.frames.length;
    const avg = this.frames.reduce((a, b) => a + b, 0) / n;
    const worst = Math.max(...this.frames);
    const r = this.stage.renderer;
    const { calls, triangles } = r.info.render;
    const c = r.domElement;
    this.el.textContent =
      `${Math.round(1000 / avg)} к/с · худший кадр ${Math.round(worst)} мс · качество ${this.stage.quality} · ` +
      `${c.width}×${c.height} (×${r.getPixelRatio().toFixed(2)}) · ${Math.round(calls / n)} вызовов · ` +
      `${Math.round(triangles / n / 1000)} тыс. треуг. · ${r.info.memory.textures} текстур · ${r.info.memory.geometries} сеток`;
    r.info.reset();
    this.frames = [];
  }
}
