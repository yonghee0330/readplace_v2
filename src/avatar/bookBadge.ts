// 다른 사람·NPC가 읽는 책을 머리 위에 보여 주는 클릭용 빌보드.
// 이름표 위에 두고, 레이캐스트로 누르면 책 소개 시트를 연다.
import * as THREE from 'three';
import { OVERLAY_LAYER } from './nameplate';

const FONT = '"Pretendard Variable", Pretendard, system-ui, sans-serif';
const W = 640;
const H = 120;
const WORLD_W = 0.52;

function drawBadge(ctx: CanvasRenderingContext2D, title: string): void {
  ctx.clearRect(0, 0, W, H);
  ctx.font = `600 40px ${FONT}`;
  const label = title.length > 18 ? `${[...title].slice(0, 17).join('')}…` : title;
  const tw = Math.min(W - 120, ctx.measureText(label).width);
  const pw = tw + 108;
  const ph = 78;
  const x = (W - pw) / 2;
  const y = (H - ph) / 2;
  ctx.fillStyle = 'rgba(36,37,31,0.78)';
  ctx.beginPath();
  ctx.roundRect(x, y, pw, ph, 22);
  ctx.fill();
  // 작은 책 아이콘
  ctx.fillStyle = '#ffcf8a';
  ctx.beginPath();
  ctx.roundRect(x + 18, y + 18, 28, 42, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(251,246,236,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 32, y + 20);
  ctx.lineTo(x + 32, y + 56);
  ctx.stroke();
  ctx.fillStyle = '#fbf6ec';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 58, H / 2 + 2, tw);
}

export class BookBadge {
  readonly mesh: THREE.Mesh;
  private canvas = document.createElement('canvas');
  private tex: THREE.CanvasTexture;
  private title = '';
  actorId = '';

  constructor() {
    this.canvas.width = W;
    this.canvas.height = H;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({
      map: this.tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W, WORLD_W * (H / W)), mat);
    this.mesh.renderOrder = 22;
    this.mesh.layers.set(OVERLAY_LAYER);
    this.mesh.name = 'book-badge';
    this.mesh.userData.bookBadge = true;
    this.mesh.visible = false;
    document.fonts?.ready.then(() => {
      if (this.title) this.redraw();
    });
  }

  set(actorId: string, title: string | null): void {
    this.actorId = actorId;
    this.mesh.userData.actorId = actorId;
    const t = title?.trim() || '';
    if (!t) {
      this.title = '';
      this.mesh.visible = false;
      return;
    }
    if (t === this.title && this.mesh.visible) return;
    this.title = t;
    this.redraw();
    this.mesh.visible = true;
  }

  private redraw(): void {
    drawBadge(this.canvas.getContext('2d')!, this.title);
    this.tex.needsUpdate = true;
  }

  update(world: THREE.Vector3, camera: THREE.Camera): void {
    if (!this.mesh.visible) return;
    this.mesh.position.copy(world);
    this.mesh.quaternion.copy(camera.quaternion);
    const d = camera.position.distanceTo(world);
    this.mesh.scale.setScalar(THREE.MathUtils.clamp(d * 0.42, 0.85, 2.8));
  }

  dispose(): void {
    this.tex.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
