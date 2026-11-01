// 이름표와 머리 위 책 아이콘: 항상 카메라를 보는 빌보드. 거리에 따라 크기를 조절해 멀리서도 읽힌다.
// 오버레이 레이어(1)에 두어 AO 패스에서 빠진다(투명 판이 AO에 사각형 자국을 남기지 않게).
// 읽기 중이면 닉네임 아래에 책 제목을 한 줄 더 그린다.
import * as THREE from 'three';

export const OVERLAY_LAYER = 1;
const FONT = '"Pretendard Variable", Pretendard, system-ui, sans-serif';
const W = 640;
const H_SINGLE = 160;
const H_DUAL = 220;

function drawPill(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  text: string,
  accent: string,
  subtitle: string,
): void {
  ctx.clearRect(0, 0, w, h);
  const dual = !!subtitle;
  ctx.font = `600 46px ${FONT}`;
  const nickTw = Math.min(w - 60, ctx.measureText(text).width);
  let subTw = 0;
  if (dual) {
    ctx.font = `500 32px ${FONT}`;
    subTw = Math.min(w - 60, ctx.measureText(subtitle).width);
  }
  const innerW = Math.max(nickTw, subTw);
  const pw = innerW + 64;
  const ph = dual ? 118 : 76;
  const x = (w - pw) / 2;
  const y = (h - ph) / 2;
  ctx.fillStyle = 'rgba(36,37,31,0.72)';
  ctx.beginPath();
  ctx.roundRect(x, y, pw, ph, dual ? 28 : ph / 2);
  ctx.fill();
  // 옷 색 점
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(x + 30, dual ? y + 36 : h / 2, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbf6ec';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `600 46px ${FONT}`;
  ctx.fillText(text, x + 48, dual ? y + 38 : h / 2 + 2, nickTw);
  if (dual) {
    ctx.font = `500 32px ${FONT}`;
    ctx.fillStyle = 'rgba(251,246,236,0.82)';
    ctx.fillText(subtitle, x + 48, y + 84, subTw);
  }
}

export class Nameplate {
  readonly mesh: THREE.Mesh;
  private canvas = document.createElement('canvas');
  private tex: THREE.CanvasTexture;
  private text = '';
  private subtitle = '';
  private accent = '#ffffff';
  private dual = false;
  private static width = 0.48;

  constructor(text: string, accent: string) {
    this.canvas.width = W;
    this.canvas.height = H_SINGLE;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false });
    const g = new THREE.PlaneGeometry(Nameplate.width, Nameplate.width * (H_SINGLE / W));
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.renderOrder = 20;
    this.mesh.layers.set(OVERLAY_LAYER);
    this.mesh.name = 'nameplate';
    this.set(text, accent);
    // 글꼴이 늦게 로드되면 다시 그린다.
    document.fonts?.ready.then(() => this.redraw());
  }

  set(text: string, accent: string, subtitle = ''): void {
    const sub = subtitle.trim();
    if (text === this.text && accent === this.accent && sub === this.subtitle) return;
    this.text = text;
    this.accent = accent;
    this.subtitle = sub;
    this.redraw();
  }

  private redraw(): void {
    const dual = !!this.subtitle;
    if (dual !== this.dual) {
      this.dual = dual;
      this.canvas.height = dual ? H_DUAL : H_SINGLE;
      this.mesh.geometry.dispose();
      this.mesh.geometry = new THREE.PlaneGeometry(
        Nameplate.width,
        Nameplate.width * (this.canvas.height / W),
      );
    }
    drawPill(this.canvas.getContext('2d')!, this.canvas.width, this.canvas.height, this.text, this.accent, this.subtitle);
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
