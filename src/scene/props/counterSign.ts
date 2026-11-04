// 카운터 앞면(손님 쪽, 방 안) 안내 간판: 호두색 판 + 황동 테두리 + '카운터'.
import * as THREE from 'three';
import { COUNTER, isPresent } from '../layout';

const TW = 512;
const TH = 180;

function paint(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#4a3020';
  ctx.fillRect(0, 0, TW, TH);
  // 나뭇결
  ctx.strokeStyle = 'rgba(20,10,4,0.22)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const y = 14 + i * 20;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(TW * 0.3, y + 6, TW * 0.6, y - 6, TW, y + 3);
    ctx.stroke();
  }
  ctx.strokeStyle = '#c9a15a';
  ctx.lineWidth = 7;
  ctx.strokeRect(14, 14, TW - 28, TH - 28);
  ctx.fillStyle = '#f6ecd6';
  ctx.font = '900 96px "Noto Serif KR", "Apple SD Gothic Neo", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('카운터', TW / 2, TH / 2 + 6);
}

export function buildCounterSign(): THREE.Mesh | null {
  if (!isPresent(COUNTER) || COUNTER.w < 0.1) return null;
  const { x, z, ry, d } = COUNTER;
  const canvas = document.createElement('canvas');
  canvas.width = TW;
  canvas.height = TH;
  const ctx = canvas.getContext('2d')!;
  paint(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  void document.fonts?.ready.then(() => { paint(ctx); tex.needsUpdate = true; });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.5 * (TH / TW)),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0 }),
  );
  sign.name = 'counter-sign';
  // 카운터 로컬: 손님 쪽 앞면(-z)에 붙인다. 스툴(로컬 x -0.3)과 겹치지 않게 오른쪽(+x).
  const lx = 0.32;
  const lz = -d / 2 - 0.012;
  const c = Math.cos(ry), s = Math.sin(ry);
  sign.position.set(x + lx * c + lz * s, 0.62, z - lx * s + lz * c);
  sign.rotation.y = ry + Math.PI;
  return sign;
}
