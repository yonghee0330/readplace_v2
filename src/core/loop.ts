import type { WebGLRenderer } from 'three';

export type UpdateFn = (dt: number, t: number) => void;

/** requestAnimationFrame 루프. dt는 0.1초로 잘라 탭 복귀 때 튀지 않게 한다. */
export class Loop {
  private updates: UpdateFn[] = [];
  private last = 0;
  private running = false;
  private fpsEl: HTMLElement | null = null;
  private frames = 0;
  private fpsT = 0;

  constructor(private render: () => void, private renderer: WebGLRenderer, debug: boolean) {
    if (debug) {
      this.fpsEl = document.createElement('div');
      this.fpsEl.className = 'debug-fps';
      document.body.appendChild(this.fpsEl);
    }
  }

  add(fn: UpdateFn): () => void {
    this.updates.push(fn);
    return () => {
      this.updates = this.updates.filter((f) => f !== fn);
    };
  }

  start(): void {
    // 캡처 스크립트가 스크린샷 직전에 루프를 멈출 수 있게 노출한다(소프트웨어 렌더링 대비).
    (window as unknown as { __BBOOKS_LOOP: unknown }).__BBOOKS_LOOP = { stop: () => this.stop(), start: () => this.start() };
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      const t = now / 1000;
      for (const fn of this.updates) fn(dt, t);
      this.renderer.info.reset();
      this.render();
      this.stats(dt);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
  }

  private stats(dt: number): void {
    const info = this.renderer.info.render;
    const main = (window as unknown as { __BBOOKS_MAIN?: { calls: number; triangles: number } }).__BBOOKS_MAIN;
    (window as unknown as { __BBOOKS_STATS: unknown }).__BBOOKS_STATS = {
      calls: info.calls,
      triangles: info.triangles,
      mainCalls: main?.calls,
      mainTriangles: main?.triangles,
    };
    if (!this.fpsEl) return;
    this.frames++;
    this.fpsT += dt;
    if (this.fpsT >= 0.5) {
      const fps = Math.round(this.frames / this.fpsT);
      this.fpsEl.textContent = `${fps} fps · 메인 ${main?.calls ?? '-'}콜 / 전체 ${info.calls}콜 · ${(info.triangles / 1000).toFixed(0)}k tris`;
      this.frames = 0;
      this.fpsT = 0;
    }
  }
}
