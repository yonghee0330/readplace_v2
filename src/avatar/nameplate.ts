// 이름표와 머리 위 책 아이콘: 항상 카메라를 보는 빌보드. 거리에 따라 크기를 조절해 멀리서도 읽힌다.
// 오버레이 레이어(1)에 두어 AO 패스에서 빠진다(투명 판이 AO에 사각형 자국을 남기지 않게).
import * as THREE from 'three';

export const OVERLAY_LAYER = 1;
const FONT = '"Pretendard Variable", Pretendard, system-ui, sans-serif';

function drawPill(ctx: CanvasRenderingContext2D, w: number, h: number, text: string, accent: string): void {
  ctx.clearRect(0, 0, w, h);
  ctx.font = `600 46px ${FONT}`;
  const tw = Math.min(w - 60, ctx.measureText(text).width);
  const pw = tw + 64, ph = 76;
  const x = (w - pw) / 2, y = (h - ph) / 2;
  ctx.fillStyle = 'rgba(36,37,31,0.72)';
  ctx.beginPath();
  ctx.roundRect(x, y, pw, ph, ph / 2);
  ctx.fill();
  // 옷 색 점
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(x + 30, h / 2, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbf6ec';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 48, h / 2 + 2, tw);
}

export class Nameplate {
  readonly mesh: THREE.Mesh;
  private canvas = document.createElement('canvas');
  private tex: THREE.CanvasTexture;
  private text = '';
  private accent = '#ffffff';
  private static aspect = 4;

  constructor(text: string, accent: string) {
    this.canvas.width = 640;
    this.canvas.height = 160;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false });
    const g = new THREE.PlaneGeometry(Nameplate.aspect * 0.12, 0.12);
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.renderOrder = 20;
    this.mesh.layers.set(OVERLAY_LAYER);
    this.mesh.name = 'nameplate';
    this.set(text, accent);
    // 글꼴이 늦게 로드되면 다시 그린다.
    document.fonts?.ready.then(() => this.redraw());
  }

  set(text: string, accent: string): void {
    if (text === this.text && accent === this.accent) return;
    this.text = text;
    this.accent = accent;
    this.redraw();
  }

  private redraw(): void {
    drawPill(this.canvas.getContext('2d')!, this.canvas.width, this.canvas.height, this.text, this.accent);
    this.tex.needsUpdate = true;
  }

  /** 월드 위치(머리 위)와 카메라로 방향·크기를 맞춘다. */
  update(world: THREE.Vector3, camera: THREE.Camera): void {
    this.mesh.position.copy(world);
    this.mesh.quaternion.copy(camera.quaternion);
    const d = camera.position.distanceTo(world);
    this.mesh.scale.setScalar(THREE.MathUtils.clamp(d * 0.42, 0.8, 2.6));
  }

  dispose(): void {
    this.tex.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

let bookIconTex: THREE.CanvasTexture | null = null;
/** 읽기 중 머리 위에 뜨는 작은 책 아이콘 텍스처(공용). */
export function bookIconTexture(): THREE.CanvasTexture {
  if (bookIconTex) return bookIconTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(36,37,31,0.72)';
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();
  // 펼친 책
  ctx.fillStyle = '#fbf6ec';
  ctx.strokeStyle = '#ffcf8a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(64, 46); ctx.quadraticCurveTo(46, 36, 28, 42); ctx.lineTo(28, 86); ctx.quadraticCurveTo(46, 80, 64, 90);
  ctx.quadraticCurveTo(82, 80, 100, 86); ctx.lineTo(100, 42); ctx.quadraticCurveTo(82, 36, 64, 46);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(64, 46); ctx.lineTo(64, 90); ctx.stroke();
  ctx.strokeStyle = 'rgba(60,50,40,0.5)'; ctx.lineWidth = 3;
  for (const y of [54, 63, 72]) {
    ctx.beginPath(); ctx.moveTo(36, y); ctx.lineTo(56, y + 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(72, y + 2); ctx.lineTo(92, y); ctx.stroke();
  }
  bookIconTex = new THREE.CanvasTexture(c);
  bookIconTex.colorSpace = THREE.SRGBColorSpace;
  return bookIconTex;
}
