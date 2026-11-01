// 캔버스 포인터 입력: 클릭과 드래그 구분(6px 미만만 클릭), 드래그 = 카메라 회전, 휠·핀치 = 줌.
// 키보드: WASD·방향키(설정에서 켰을 때 이동).

export interface InputHandlers {
  click(x: number, y: number): void;
  drag(dx: number, dy: number): void;
  zoom(factor: number): void;
}

const CLICK_SLOP = 6;

export class CanvasInput {
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number }>();
  private dragged = false;
  private pinchDist = 0;
  readonly keys = new Set<string>();

  constructor(private el: HTMLElement, private h: InputHandlers) {
    el.addEventListener('pointerdown', this.down);
    el.addEventListener('pointermove', this.move);
    el.addEventListener('pointerup', this.up);
    el.addEventListener('pointercancel', this.cancel);
    el.addEventListener('wheel', this.wheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('keydown', this.keydown);
    addEventListener('keyup', this.keyup);
    addEventListener('blur', () => this.keys.clear());
  }

  private down = (e: PointerEvent) => {
    this.el.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    if (this.pointers.size === 1) this.dragged = false;
    if (this.pointers.size === 2) {
      this.dragged = true;
      this.pinchDist = this.pinchDistance();
    }
  };

  private move = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pointers.size === 2) {
      const d = this.pinchDistance();
      if (this.pinchDist > 0 && d > 0) this.h.zoom(this.pinchDist / d);
      this.pinchDist = d;
      return;
    }
    if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) >= CLICK_SLOP) this.dragged = true;
    if (this.dragged) this.h.drag(dx, dy);
  };

  private up = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (!p) return;
    if (!this.dragged && this.pointers.size === 0 && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < CLICK_SLOP) {
      this.h.click(e.clientX, e.clientY);
    }
    if (this.pointers.size < 2) this.pinchDist = 0;
  };

  private cancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    this.pinchDist = 0;
  };

  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    this.h.zoom(Math.exp(e.deltaY * 0.0012));
  };

  private pinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private keydown = (e: KeyboardEvent) => {
    if (isTyping(e)) return;
    this.keys.add(e.key.toLowerCase());
  };
  private keyup = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  /** WASD·방향키 → (x: 오른쪽+, y: 앞+) */
  moveAxis(): { x: number; y: number } {
    const k = this.keys;
    const y = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    const x = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    return { x, y };
  }
}

export function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}
