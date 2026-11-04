// 세미나실 화이트보드 우측 포스터: 이달의 비모임 안내. 클릭하면 비북스 모임 페이지로 이동.
import * as THREE from 'three';
import { WHITEBOARD, isPresent } from '../layout';

export const MOIM_URL = 'https://bbooks.co.kr/moim/';
const TW = 720;
const TH = 860;

export interface MoimPosterProp {
  group: THREE.Group;
  hitMesh: THREE.Mesh;
}

const SPINES: { c: string; h: number; w: number }[] = [
  { c: '#4e7a58', h: 0.78, w: 56 }, { c: '#5059a8', h: 0.9, w: 62 }, { c: '#b07c30', h: 0.7, w: 52 },
  { c: '#c86446', h: 1.0, w: 60 }, { c: '#42808a', h: 0.74, w: 56 }, { c: '#7a52a4', h: 0.88, w: 54 },
  { c: '#3a6a5c', h: 0.68, w: 52 }, { c: '#8a6a4a', h: 0.96, w: 60 },
];

function paint(ctx: CanvasRenderingContext2D): void {
  const serif = '"Noto Serif KR", "Apple SD Gothic Neo", serif';
  const sans = '"Pretendard", "Apple SD Gothic Neo", system-ui, sans-serif';
  ctx.fillStyle = '#fffdf8';
  ctx.fillRect(0, 0, TW, TH);
  ctx.strokeStyle = 'rgba(120,80,40,0.28)';
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, TW - 28, TH - 28);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#a4502e';
  ctx.font = `700 34px ${sans}`;
  ctx.fillText('이달의 서가 · 2026.11', 56, 100);

  ctx.fillStyle = '#2a211a';
  ctx.font = `900 118px ${serif}`;
  ctx.fillText('11월', 52, 235);
  ctx.fillText('비모임', 52, 360);

  ctx.fillStyle = '#4a4038';
  ctx.font = `500 33px ${sans}`;
  ctx.fillText('늦가을, 책 한 권과 함께', 56, 425);
  ctx.fillStyle = '#6a5e52';
  ctx.font = `400 27px ${sans}`;
  ctx.fillText('부천 원미동 비북스에서 열리는', 56, 468);
  ctx.fillText('이번 달 모임과 행사를 모았어요.', 56, 506);

  // 서가 책등
  const baseY = 700;
  let x = 56;
  for (const s of SPINES) {
    const h = 150 * s.h + 40;
    ctx.fillStyle = s.c;
    ctx.fillRect(x, baseY - h, s.w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(x, baseY - h + 14, s.w, 4);
    ctx.fillRect(x, baseY - 28, s.w, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(x + s.w - 7, baseY - h, 7, h);
    x += s.w + 4;
  }
  ctx.fillStyle = '#85593a';
  ctx.fillRect(40, baseY, TW - 80, 16);
  ctx.fillStyle = '#5c3d28';
  ctx.fillRect(48, baseY + 16, TW - 96, 7);

  // 안내 버튼
  const bx = 56, by = 760, bw = TW - 112, bh = 66, r = 33;
  ctx.fillStyle = '#c4673c';
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
  ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
  ctx.arcTo(bx, by + bh, bx, by, r);
  ctx.arcTo(bx, by, bx + bw, by, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `700 31px ${sans}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('눌러서 11월 모임 보기 →', TW / 2, by + bh / 2 + 1);
}

/** 화이트보드의 오른쪽 끝(방 안쪽에서 볼 때)에 걸리는 포스터. 세미나실 전용. */
export function buildMoimPoster(): MoimPosterProp | null {
  if (!isPresent(WHITEBOARD) || WHITEBOARD.w < 0.1) return null;
  const { x, z, ry, w, h } = WHITEBOARD;
  const ph = Math.min(h - 0.1, 1.5);
  const pw = ph * (TW / TH);
  // 보드는 ry=π라 방 안에서 볼 때 오른쪽이 로컬 +x(=월드 -x). 로컬 x가 +인 쪽 끝에 붙인다.
  const lx = w / 2 - pw / 2 - 0.12;
  const canvas = document.createElement('canvas');
  canvas.width = TW;
  canvas.height = TH;
  const ctx = canvas.getContext('2d')!;
  paint(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  // 웹폰트가 늦게 로드되면 한 번 더 그린다
  void document.fonts?.ready.then(() => { paint(ctx); tex.needsUpdate = true; });

  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 });
  const hitMesh = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat);
  hitMesh.position.set(lx, 0, 0.032);
  hitMesh.name = 'moim-poster-face';
  hitMesh.userData.moimPoster = true;

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.6 });
  const t = 0.03;
  const bars: [number, number, number, number][] = [
    [pw + t * 2, t, 0, ph / 2 + t / 2], [pw + t * 2, t, 0, -ph / 2 - t / 2],
    [t, ph, -pw / 2 - t / 2, 0], [t, ph, pw / 2 + t / 2, 0],
  ];
  const group = new THREE.Group();
  group.name = 'moim-poster';
  group.position.set(x, 1.05 + h / 2, z);
  group.rotation.y = ry;
  for (const [bw, bh, bx, by] of bars) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.03), frameMat);
    m.position.set(lx + bx, by, 0.026);
    group.add(m);
  }
  // 마스킹테이프 두 조각
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0xe8d9a8, roughness: 0.9, transparent: true, opacity: 0.85 });
  for (const sx of [-1, 1]) {
    const tape = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.05), tapeMat);
    tape.position.set(lx + sx * (pw / 2 - 0.1), ph / 2 + 0.01, 0.045);
    tape.rotation.z = sx * 0.35;
    group.add(tape);
  }
  group.add(hitMesh);
  return { group, hitMesh };
}
