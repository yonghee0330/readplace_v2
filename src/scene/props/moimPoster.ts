// 중앙 홀 포스트잇 보드 우측 포스터: 이달의 비모임 안내. 클릭하면 비북스 모임 페이지로 이동.
import * as THREE from 'three';
import { EVENT_BOARD, isPresent } from '../layout';

export const MOIM_URL = 'https://bbooks.co.kr/moim/';
const TW = 720;
const TH = 860;
const BW = 720;
const BH = 900;
export const POINT_URL = 'https://bbooks.co.kr/point';
export const YOUTH_URL = 'https://youth.bbooks.co.kr/adult.html';
export const BTALK_URL = 'https://bbooks.co.kr/moim/m/btalk-seogyul-2611/';

export interface PosterHit { mesh: THREE.Mesh; url: string; toast: string }
export interface MoimPosterProp {
  group: THREE.Group;
  hits: PosterHit[];
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


function paintBtalk(ctx: CanvasRenderingContext2D, cover: HTMLImageElement | null): void {
  const sans = '"Pretendard", "Apple SD Gothic Neo", system-ui, sans-serif';
  ctx.fillStyle = '#404d73';
  ctx.fillRect(0, 0, BW, BH);
  // 협업 라벨(글자만)
  ctx.fillStyle = '#fffdf8';
  ctx.beginPath();
  ctx.roundRect(70, 40, BW - 70, 62, [31, 0, 0, 31]);
  ctx.fill();
  ctx.fillStyle = '#1c1c20';
  ctx.font = `700 27px ${sans}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('비북스 b.books  ✕  위즈덤하우스  ✕  yes24', 100, 72);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#d9def0';
  ctx.font = `400 25px ${sans}`;
  ctx.fillText('잔꾀와 눈물과 육두문자로 써 내려간', 48, 162);
  ctx.fillText('유쾌 발랄 여걸 활극의 탄생!', 48, 197);
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 80px ${sans}`;
  ctx.fillText('《채달금전》', 44, 282);
  ctx.fillText('서귤 작가와의 만남', 44, 372);
  // 신간 표지(크게)
  const ch = 500;
  const cw = ch * (301 / 486);
  const cx = (BW - cw) / 2;
  const cy = 392;
  if (cover) {
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.drawImage(cover, cx, cy, cw, ch);
    ctx.shadowColor = 'transparent';
  } else {
    ctx.fillStyle = '#7a3aa0';
    ctx.fillRect(cx, cy, cw, ch);
  }
}

function paintPoint(ctx: CanvasRenderingContext2D, cap: HTMLImageElement | null): void {
  const sans = '"Pretendard", "Apple SD Gothic Neo", system-ui, sans-serif';
  ctx.fillStyle = '#e8f2fb';
  ctx.fillRect(0, 0, TW, TH);
  // 캡처 위쪽(마감 알약)·아래쪽(안내 문구)을 그대로 쓴다
  if (cap) {
    const pw = 300;
    ctx.drawImage(cap, 266, 46, 322, 50, (TW - pw) / 2, 52, pw, pw * (50 / 322));
    const sw = 640;
    ctx.drawImage(cap, 100, 518, 660, 84, (TW - sw) / 2, 596, sw, sw * (84 / 660));
  } else {
    ctx.fillStyle = '#f0c57a';
    ctx.beginPath();
    ctx.roundRect(210, 52, 300, 46, 23);
    ctx.fill();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#22379a';
  ctx.font = `700 30px ${sans}`;
  ctx.fillText('비북스 Bbooks', TW / 2, 160);
  ctx.fillStyle = '#f0c57a';
  ctx.fillRect(40, 300, TW - 80, 84);
  ctx.fillStyle = '#22379a';
  ctx.font = `900 112px ${sans}`;
  ctx.fillText('독서포인트', TW / 2, 290 + 70);
  ctx.font = `900 92px ${sans}`;
  ctx.fillText('사용 마감', TW / 2, 478);
  ctx.fillStyle = '#d6453a';
  ctx.font = `900 112px ${sans}`;
  ctx.fillText('임박', TW / 2, 590);
  // 안내 버튼
  const bx = 56, by = 756, bw = TW - 112, bh = 66, r = 33;
  ctx.fillStyle = '#22379a';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, r);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `700 31px ${sans}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('눌러서 독서포인트 주문서 보기 →', TW / 2, by + bh / 2 + 1);
}

function paintYouth(ctx: CanvasRenderingContext2D, art: HTMLImageElement | null): void {
  const sans = '"Pretendard", "Apple SD Gothic Neo", system-ui, sans-serif';
  const BLUE = '#afc0c4', MAROON = '#4a1a22', SALMON = '#e29c7b', CREAM = '#fdf5ea';
  ctx.fillStyle = BLUE;
  ctx.fillRect(0, 0, TW, 640);
  ctx.fillStyle = SALMON;
  ctx.fillRect(0, 640, TW, TH - 640);
  ctx.fillStyle = MAROON;
  ctx.fillRect(0, 636, TW, 8);
  // 핵심 키워드: 멀리서도 읽히게 크게
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = MAROON;
  ctx.font = `800 54px ${sans}`;
  ctx.fillText('청 소 년', TW / 2, 92);
  ctx.font = `900 188px ${sans}`;
  ctx.fillText('책사줄게', TW / 2, 262);
  if (art) {
    const aw = 600, ah = aw * (art.naturalHeight / art.naturalWidth);
    ctx.drawImage(art, (TW - aw) / 2 + 10, 636 - ah, aw, ah);
  }
  ctx.fillStyle = MAROON;
  ctx.font = `800 31px ${sans}`;
  ctx.fillText('부천의 어른들이, 부천의 청소년에게,', TW / 2, 700);
  ctx.fillText('책 한 권.', TW / 2, 742);
  // 안내 버튼
  const bx = 56, by = 772, bw = TW - 112, bh = 66;
  ctx.fillStyle = MAROON;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 33);
  ctx.fill();
  ctx.fillStyle = CREAM;
  ctx.font = `700 31px ${sans}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('어른 · 책값 먼저 내기 →', TW / 2, by + bh / 2 + 1);
}

function makeFrame(pw: number, ph: number, lx: number, ly: number, group: THREE.Group, face: THREE.Mesh): void {
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.6 });
  const t = 0.014;
  const bars: [number, number, number, number][] = [
    [pw + t * 2, t, 0, ph / 2 + t / 2], [pw + t * 2, t, 0, -ph / 2 - t / 2],
    [t, ph, -pw / 2 - t / 2, 0], [t, ph, pw / 2 + t / 2, 0],
  ];
  for (const [bw, bh, bx, by] of bars) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.03), frameMat);
    m.position.set(lx + bx, ly + by, 0.026);
    group.add(m);
  }
  face.position.set(lx, ly, 0.034);
  group.add(face);
}

function canvasFace(w: number, h: number, pw: number, ph: number, draw: (ctx: CanvasRenderingContext2D) => void, name: string): { mesh: THREE.Mesh; redraw: () => void } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 }));
  mesh.name = name;
  return { mesh, redraw: () => { draw(ctx); tex.needsUpdate = true; } };
}

/** 중앙 홀 포스트잇 보드 양쪽 벽에 하나씩 붙는 포스터 두 장(왼쪽 11월 비모임, 오른쪽 서귤 북토크). 허브 전용. */
export function buildMoimPoster(): MoimPosterProp | null {
  if (!isPresent(EVENT_BOARD) || EVENT_BOARD.w < 0.2) return null;
  const { x, z, ry } = EVENT_BOARD;
  // 보드 양쪽 벽 틈(왼쪽 중심 x≈-1.13, 오른쪽 ≈1.36)의 중앙. 보드 기준 로컬 좌표.
  const lxL = -1.21;
  const lxR = 1.215;
  const pw = 0.5;
  const ph1 = pw * (TH / TW);
  const ph2 = pw * (BH / BW);
  const y1 = 0;
  const y2 = 0;
  const root = new THREE.Group();
  root.name = 'posters';
  const group = new THREE.Group();
  root.add(group);
  group.name = 'moim-posters';
  group.position.set(x, 1.75, z);
  group.rotation.y = ry;

  const a = canvasFace(TW, TH, pw, ph1, paint, 'moim-poster-face');
  a.mesh.userData.moimPoster = true;
  makeFrame(pw, ph1, lxL, y1, group, a.mesh);

  let cover: HTMLImageElement | null = null;
  const b = canvasFace(BW, BH, pw, ph2, (c) => paintBtalk(c, cover), 'btalk-poster-face');
  b.mesh.userData.moimPoster = true;
  makeFrame(pw, ph2, lxR, y2, group, b.mesh);
  const img = new Image();
  img.onload = () => { cover = img; b.redraw(); };
  img.src = `${import.meta.env.BASE_URL}posters/chaedalgeumjeon.jpg`;

  // 웹폰트가 늦게 로드되면 한 번 더 그린다
  void document.fonts?.ready.then(() => { a.redraw(); b.redraw(); });

  // 카운터 뒤 앞벽(출입문과 서가 사이 빈 벽)의 독서포인트 안내 포스터
  const pg = new THREE.Group();
  pg.name = 'point-poster';
  pg.position.set(-1.14, 1.75, 3.42);
  pg.rotation.y = Math.PI;
  root.add(pg);
  let cap: HTMLImageElement | null = null;
  const c = canvasFace(TW, TH, pw, ph1, (cx) => paintPoint(cx, cap), 'point-poster-face');
  c.mesh.userData.moimPoster = true;
  makeFrame(pw, ph1, 0, 0, pg, c.mesh);
  const capImg = new Image();
  capImg.onload = () => { cap = capImg; c.redraw(); };
  capImg.src = `${import.meta.env.BASE_URL}posters/point-capture.png`;
  void document.fonts?.ready.then(() => c.redraw());

  // 독서포인트 포스터 왼쪽(카운터 쪽) 빈 벽의 청소년 책사줄게 캠페인 포스터. 클릭하면 어른 참여 페이지
  const yg = new THREE.Group();
  yg.name = 'youth-poster';
  yg.position.set(-1.78, 1.75, 3.42);
  yg.rotation.y = Math.PI;
  root.add(yg);
  let art: HTMLImageElement | null = null;
  const d = canvasFace(TW, TH, pw, ph1, (cx) => paintYouth(cx, art), 'youth-poster-face');
  d.mesh.userData.moimPoster = true;
  makeFrame(pw, ph1, 0, 0, yg, d.mesh);
  const artImg = new Image();
  artImg.onload = () => { art = artImg; d.redraw(); };
  artImg.src = `${import.meta.env.BASE_URL}posters/chaeksajulge-art.png`;
  void document.fonts?.ready.then(() => d.redraw());

  return {
    group: root,
    hits: [
      { mesh: c.mesh, url: POINT_URL, toast: '독서포인트 주문서 페이지를 열어요' },
      { mesh: d.mesh, url: YOUTH_URL, toast: '청소년 책사줄게 참여 페이지를 열어요' },
      { mesh: a.mesh, url: MOIM_URL, toast: '11월 비모임 페이지를 열어요' },
      { mesh: b.mesh, url: BTALK_URL, toast: '서귤 북토크 페이지를 열어요' },
    ],
  };
}
