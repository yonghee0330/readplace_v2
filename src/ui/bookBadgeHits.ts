// 머리 위 책 배지용 HTML 클릭 영역.
// 3D 레이캐스트·드래그 슬롭에 의존하지 않고, 배지 위치에 버튼을 맞춰 둔다.
import type { PerspectiveCamera } from 'three';
import type { Crowd } from '../avatar/crowd';

const PAD_PX = 14;

export class BookBadgeHits {
  readonly root: HTMLElement;
  private buttons = new Map<string, HTMLButtonElement>();
  private onPick: (actorId: string, clientX: number, clientY: number) => void;

  constructor(parent: HTMLElement, onPick: (actorId: string, clientX: number, clientY: number) => void) {
    this.onPick = onPick;
    this.root = document.createElement('div');
    this.root.className = 'book-badge-hits';
    this.root.setAttribute('aria-hidden', 'true');
    parent.appendChild(this.root);
  }

  sync(crowd: Crowd, camera: PerspectiveCamera, canvas: HTMLCanvasElement, enabled: boolean): void {
    const rect = canvas.getBoundingClientRect();
    const seen = new Set<string>();
    if (enabled) {
      for (const a of crowd.list()) {
        const badge = a.bookBadge;
        if (!a.root.visible || !badge?.root.visible || !a.bookTitle) continue;
        seen.add(a.id);
        const btn = this.ensure(a.id, a.bookTitle);
        const p = badge.root.position.clone().project(camera);
        if (p.z < -1 || p.z > 1) {
          btn.hidden = true;
          continue;
        }
        const sx = rect.left + (p.x * 0.5 + 0.5) * rect.width;
        const sy = rect.top + (-p.y * 0.5 + 0.5) * rect.height;
        const dist = camera.position.distanceTo(badge.root.position);
        const fov = (camera.fov * Math.PI) / 180;
        const pxPerWorld = (rect.height * 0.5) / (Math.tan(fov * 0.5) * Math.max(0.05, dist));
        const scale = badge.root.scale.x;
        // 캔버스 텍스처 안 알약만 실제 클릭 영역(플레인 전체보다 좁음)
        const w = Math.min(200, Math.max(88, 0.52 * scale * pxPerWorld * 0.72 + PAD_PX * 2));
        const h = Math.min(64, Math.max(36, 0.52 * (120 / 640) * scale * pxPerWorld * 1.15 + PAD_PX * 2));
        btn.hidden = false;
        btn.style.width = `${w}px`;
        btn.style.height = `${h}px`;
        btn.style.transform = `translate(${sx - w / 2}px, ${sy - h / 2}px)`;
        btn.setAttribute('aria-label', `${a.nickname}님이 읽는 ${a.bookTitle}`);
      }
    }
    for (const [id, btn] of this.buttons) {
      if (!seen.has(id) || !enabled) {
        btn.remove();
        this.buttons.delete(id);
      }
    }
  }

  private ensure(id: string, title: string): HTMLButtonElement {
    let btn = this.buttons.get(id);
    if (btn) return btn;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'book-badge-hit';
    btn.dataset.actorId = id;
    btn.title = title;
    // 캔버스 드래그로 넘어가지 않게 포인터를 여기서 끝낸다
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onPick(id, e.clientX, e.clientY);
    });
    this.root.appendChild(btn);
    this.buttons.set(id, btn);
    return btn;
  }

  dispose(): void {
    this.root.remove();
    this.buttons.clear();
  }
}
