// 다른 사람·NPC가 읽는 책을 머리 위에 보여 주는 클릭용 빌보드.
// 이름표 위에 두고, 화면 좌표 히트테스트로 누르면 책 소개 시트를 연다.
import * as THREE from 'three';
import { OVERLAY_LAYER } from './nameplate';

const FONT = '"Pretendard Variable", Pretendard, system-ui, sans-serif';
const W = 640;
const H = 120;
const WORLD_W = 0.52;
const WORLD_H = WORLD_W * (H / W);
/** 클릭·호버 여유(월드 크기 배수). 손가락·트랙패드용으로 넉넉히 */
const HIT_PAD = 2.4;

const _v = new THREE.Vector3();

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
  readonly root = new THREE.Group();
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
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W, WORLD_H), mat);
    this.mesh.renderOrder = 22;
    this.mesh.layers.set(OVERLAY_LAYER);
    this.mesh.name = 'book-badge';
    this.mesh.raycast = () => {}; // 화면 좌표로만 고른다

    this.root.name = 'book-badge-root';
    this.root.add(this.mesh);
    this.root.visible = false;
    document.fonts?.ready.then(() => {
      if (this.title) this.redraw();
    });
  }

  set(actorId: string, title: string | null): void {
    this.actorId = actorId;
    this.root.userData.actorId = actorId;
    const t = title?.trim() || '';
    if (!t) {
      this.title = '';
      this.root.visible = false;
      return;
    }
    if (t === this.title && this.root.visible) return;
    this.title = t;
    this.redraw();
    this.root.visible = true;
  }

  private redraw(): void {
    drawBadge(this.canvas.getContext('2d')!, this.title);
    this.tex.needsUpdate = true;
  }

  update(world: THREE.Vector3, camera: THREE.Camera): void {
    if (!this.root.visible) return;
    this.root.position.copy(world);
    this.root.quaternion.copy(camera.quaternion);
    const d = camera.position.distanceTo(world);
    this.root.scale.setScalar(THREE.MathUtils.clamp(d * 0.42, 0.85, 2.8));
  }

  /**
   * 포인터가 배지 화면 영역 안이면 중심까지 픽셀 거리, 아니면 null.
   * 레이캐스트(레이어·빌보드 뒷면)에 의존하지 않는다.
   */
  hitDistance(clientX: number, clientY: number, camera: THREE.Camera, rect: DOMRectReadOnly): number | null {
    if (!this.root.visible) return null;
    _v.copy(this.root.position);
    const dist = camera.position.distanceTo(_v);
    if (dist < 0.05) return null;
    _v.project(camera);
    if (_v.z < -1 || _v.z > 1) return null;
    const sx = (_v.x * 0.5 + 0.5) * rect.width + rect.left;
    const sy = (-_v.y * 0.5 + 0.5) * rect.height + rect.top;
    const cam = camera as THREE.PerspectiveCamera;
    const fov = THREE.MathUtils.degToRad(cam.fov ?? 50);
    const pxPerWorld = (rect.height * 0.5) / (Math.tan(fov * 0.5) * dist);
    const scale = this.root.scale.x;
    const hw = WORLD_W * 0.5 * scale * HIT_PAD * pxPerWorld;
    const hh = WORLD_H * 0.5 * scale * HIT_PAD * pxPerWorld;
    const dx = clientX - sx;
    const dy = clientY - sy;
    if (Math.abs(dx) > hw || Math.abs(dy) > hh) return null;
    return Math.hypot(dx, dy);
  }

  dispose(): void {
    this.tex.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
