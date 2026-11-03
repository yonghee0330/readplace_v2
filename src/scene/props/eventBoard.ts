// 가오픈 포스트잇 코르크 보드(허브 창가). 클릭용 메시 + 노트 텍스처.
import * as THREE from 'three';
import { colorHex, type PostitNote, type PostitShape } from '../../net/postit';
import { bevelBox, projectUV, trs, type MergeBucket } from '../geom';
import { EVENT_BOARD, isPresent } from '../layout';

const TEX_W = 512;
const TEX_H = 460;

export interface EventBoardProp {
  group: THREE.Group;
  /** 레이캐스트용 보드 면 */
  hitMesh: THREE.Mesh;
  setNotes: (notes: PostitNote[]) => void;
}

function drawShape(
  g: CanvasRenderingContext2D,
  shape: PostitShape,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
): void {
  g.save();
  g.fillStyle = fill;
  g.strokeStyle = 'rgba(60,40,20,0.18)';
  g.lineWidth = 2;
  if (shape === 'round') {
    const r = 14;
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (shape === 'tag') {
    g.beginPath();
    g.moveTo(x + 10, y);
    g.lineTo(x + w, y);
    g.lineTo(x + w, y + h);
    g.lineTo(x + 10, y + h);
    g.lineTo(x, y + h / 2);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath();
    g.arc(x + 14, y + h / 2, 3.5, 0, Math.PI * 2);
    g.fill();
  } else if (shape === 'heart') {
    const cx = x + w / 2;
    const cy = y + h * 0.38;
    const s = Math.min(w, h) * 0.48;
    g.beginPath();
    g.moveTo(cx, cy + s * 0.35);
    g.bezierCurveTo(cx - s, cy - s * 0.2, cx - s * 0.85, cy - s, cx, cy - s * 0.45);
    g.bezierCurveTo(cx + s * 0.85, cy - s, cx + s, cy - s * 0.2, cx, cy + s * 0.35);
    g.closePath();
    g.fill();
    g.stroke();
  } else {
    g.fillRect(x, y, w, h);
    g.strokeRect(x, y, w, h);
  }
  g.restore();
}

function paintBoard(ctx: CanvasRenderingContext2D, notes: PostitNote[]): void {
  const w = TEX_W;
  const h = TEX_H;
  // 코르크 바탕
  ctx.fillStyle = '#c4a06a';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(90,60,30,0.12)' : 'rgba(255,230,180,0.1)';
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  // 테두리 안쪽
  ctx.strokeStyle = 'rgba(70,45,20,0.35)';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  // 상단 안내
  ctx.fillStyle = '#f3ead8';
  ctx.fillRect(w * 0.18, 18, w * 0.64, 36);
  ctx.strokeStyle = 'rgba(90,70,40,0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(w * 0.18, 18, w * 0.64, 36);
  ctx.fillStyle = '#2c2a24';
  ctx.font = '700 20px "Noto Serif KR", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('가오픈 포스트잇', w / 2, 36);

  for (const n of notes) {
    const pw = 78;
    const ph = n.shape === 'heart' ? 72 : 70;
    const px = n.x * w - pw / 2;
    const py = n.y * h - ph / 2;
    ctx.save();
    ctx.translate(n.x * w, n.y * h);
    ctx.rotate((n.rot * Math.PI) / 180);
    ctx.translate(-n.x * w, -n.y * h);
    // 그림자
    ctx.fillStyle = 'rgba(40,25,10,0.18)';
    drawShape(ctx, n.shape, px + 3, py + 4, pw, ph, 'rgba(40,25,10,0.18)');
    drawShape(ctx, n.shape, px, py, pw, ph, colorHex(n.color));
    // 압정
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(n.x * w, py + 8, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a241c';
    ctx.font = '600 11px "Pretendard", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    wrapText(ctx, n.text, n.x * w, py + 16, pw - 14, 13);
    ctx.restore();
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, maxW: number, lh: number): void {
  const chars = [...text];
  let line = '';
  let yy = y;
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy);
      line = ch;
      yy += lh;
      if (yy > y + lh * 3.2) break;
    } else line = test;
  }
  if (line && yy <= y + lh * 3.2) ctx.fillText(line, cx, yy);
}

/** 머지드 나무 틀 + 별도 코르크 면(텍스처 갱신). */
export function buildEventBoard(bucket: MergeBucket): EventBoardProp | null {
  if (!isPresent(EVENT_BOARD) || EVENT_BOARD.w < 0.2) return null;
  const { x, z, ry, w, h } = EVENT_BOARD;
  const yCenter = 1.72;
  const depth = 0.06;
  const base = trs(x, 0, z, 0, ry);
  const at = (m: THREE.Matrix4) => base.clone().multiply(m);
  const frame = 0.055;
  const wood = (g: THREE.BufferGeometry, grain: 'x' | 'y', m: THREE.Matrix4) => {
    projectUV(g, grain, { offset: [0.15, 0.2] });
    bucket.add('walnut', g, m);
  };
  // 사각 틀
  wood(bevelBox(frame, h + frame * 2, depth + 0.02, 0.005), 'y', at(trs(-w / 2 - frame / 2, yCenter, 0)));
  wood(bevelBox(frame, h + frame * 2, depth + 0.02, 0.005), 'y', at(trs(w / 2 + frame / 2, yCenter, 0)));
  wood(bevelBox(w + frame * 2, frame, depth + 0.02, 0.005), 'x', at(trs(0, yCenter + h / 2 + frame / 2, 0)));
  wood(bevelBox(w + frame * 2, frame, depth + 0.02, 0.005), 'x', at(trs(0, yCenter - h / 2 - frame / 2, 0)));
  // 작은 받침 선반
  wood(bevelBox(w * 0.55, 0.04, 0.12, 0.006), 'x', at(trs(0, yCenter - h / 2 - 0.08, 0.04)));

  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext('2d')!;
  paintBoard(ctx, []);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.92,
    metalness: 0,
  });
  const hitMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  hitMesh.position.set(0, yCenter, depth / 2 + 0.01);
  hitMesh.name = 'event-board-face';
  hitMesh.userData.eventBoard = true;

  const group = new THREE.Group();
  group.name = 'event-board';
  group.position.set(x, 0, z);
  group.rotation.y = ry;
  group.add(hitMesh);

  return {
    group,
    hitMesh,
    setNotes: (notes) => {
      paintBoard(ctx, notes);
      tex.needsUpdate = true;
    },
  };
}
