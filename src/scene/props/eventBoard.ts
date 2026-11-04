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
    // 박스(x,y,w,h)를 꽉 채우는 하트
    const cx = x + w / 2;
    g.beginPath();
    g.moveTo(cx, y + h * 0.26);
    g.bezierCurveTo(cx, y - h * 0.02, x, y - h * 0.02, x, y + h * 0.32);
    g.bezierCurveTo(x, y + h * 0.62, cx - w * 0.14, y + h * 0.8, cx, y + h);
    g.bezierCurveTo(cx + w * 0.14, y + h * 0.8, x + w, y + h * 0.62, x + w, y + h * 0.32);
    g.bezierCurveTo(x + w, y - h * 0.02, cx, y - h * 0.02, cx, y + h * 0.26);
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
  // 코르크 바탕(시드 고정 — 노트 갱신 때마다 알갱이가 바뀌지 않게)
  ctx.fillStyle = '#c4a06a';
  ctx.fillRect(0, 0, w, h);
  let seed = 0xC0C0;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let i = 0; i < 1800; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(90,60,30,0.12)' : 'rgba(255,230,180,0.1)';
    ctx.fillRect(x, y, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  // 테두리 안쪽
  ctx.strokeStyle = 'rgba(70,45,20,0.35)';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  // 상단 안내
  ctx.fillStyle = '#f3ead8';
  ctx.fillRect(w * 0.08, 16, w * 0.84, 40);
  ctx.strokeStyle = 'rgba(90,70,40,0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(w * 0.08, 16, w * 0.84, 40);
  ctx.fillStyle = '#2c2a24';
  ctx.font = '700 16px "Noto Serif KR", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('b.books-M 공간이 생겼어요!', w / 2, 36);

  for (const n of notes) {
    // UI와 같이 네모 기본 크기(모든 모양 동일 박스)
    const pw = 78;
    const ph = 78;
    const heart = n.shape === 'heart';
    const px = n.x * w - pw / 2;
    const py = n.y * h - ph / 2;
    ctx.save();
    ctx.translate(n.x * w, n.y * h);
    ctx.rotate((n.rot * Math.PI) / 180);
    ctx.translate(-n.x * w, -n.y * h);
    drawShape(ctx, n.shape, px + 3, py + 4, pw, ph, 'rgba(40,25,10,0.18)');
    drawShape(ctx, n.shape, px, py, pw, ph, colorHex(n.color));
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(heart ? px + pw * 0.27 : n.x * w, heart ? py + ph * 0.14 : py + 8, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a241c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const textTop = heart ? py + ph * 0.22 : py + 14;
    const textH = heart ? ph * 0.55 : ph - 28;
    fitText(ctx, n.text, n.x * w, textTop, pw - 14, textH);
    ctx.restore();
  }
}

/** 영역(maxW × maxH)에 들어갈 때까지 글자 크기를 줄여 가며 줄바꿈해 그린다. */
function fitText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, maxW: number, maxH: number): void {
  for (const size of [12, 11, 10, 9, 8, 7]) {
    ctx.font = `600 ${size}px "Pretendard", system-ui, sans-serif`;
    const lh = size * 1.3;
    const lines: string[] = [];
    let line = '';
    for (const ch of [...text]) {
      if (ctx.measureText(line + ch).width > maxW && line) {
        lines.push(line);
        line = ch;
      } else line += ch;
    }
    if (line) lines.push(line);
    if (lines.length * lh <= maxH || size === 7) {
      const top = y + Math.max(0, (maxH - lines.length * lh) / 2);
      lines.forEach((l, i) => ctx.fillText(l, cx, top + i * lh));
      return;
    }
  }
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
    side: THREE.DoubleSide,
  });
  // 클릭 영역을 조금 넓혀 창가에서도 잘 잡히게 한다
  const hitMesh = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.08, h + 0.08), mat);
  hitMesh.position.set(0, yCenter, depth / 2 + 0.02);
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
