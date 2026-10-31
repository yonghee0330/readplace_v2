// Canvas로 만드는 절차 텍스처. 외부 이미지 없이 나뭇결·회벽·패브릭·러그를 그린다.
import * as THREE from 'three';
import { Rng } from '../core/rng';

// ---------- 노이즈 ----------

/** 주기를 갖는 값 노이즈. 주기를 텍스처 크기에 맞추면 이음매 없이 반복된다. */
class PeriodicNoise {
  private table: Float32Array;
  constructor(rng: Rng, private size = 256) {
    this.table = new Float32Array(size * size);
    for (let i = 0; i < this.table.length; i++) this.table[i] = rng.float();
  }
  private at(x: number, y: number, px: number, py: number): number {
    const s = this.size;
    const xi = ((x % px) + px) % px;
    const yi = ((y % py) + py) % py;
    return this.table[(yi % s) * s + (xi % s)];
  }
  /** x, y는 격자 단위. px, py는 격자 주기. */
  sample(x: number, y: number, px = 1e6, py = 1e6): number {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = this.at(x0, y0, px, py), b = this.at(x0 + 1, y0, px, py);
    const c = this.at(x0, y0 + 1, px, py), d = this.at(x0 + 1, y0 + 1, px, py);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  fbm(x: number, y: number, octaves: number, px = 1e6, py = 1e6): number {
    let sum = 0, amp = 0.5, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += this.sample(x, y, px, py) * amp;
      norm += amp;
      x *= 2; y *= 2; px *= 2; py *= 2; amp *= 0.5;
    }
    return sum / norm;
  }
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })!];
}

function toTexture(c: HTMLCanvasElement, color: boolean, repeat = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

// ---------- 나뭇결 ----------

export type WoodKind = 'honey' | 'medium' | 'walnut' | 'oak';
const WOOD: Record<WoodKind, { light: string; dark: string; ring: number; warp: number }> = {
  honey: { light: '#d2a774', dark: '#a0754a', ring: 0.55, warp: 1.6 },
  medium: { light: '#9e7550', dark: '#5f4029', ring: 0.6, warp: 1.6 },
  walnut: { light: '#6a4a33', dark: '#38261a', ring: 0.7, warp: 1.8 },
  // 마루: 결이 곧고 차분한 오크
  oak: { light: '#c3a07c', dark: '#8a684c', ring: 0.45, warp: 0.9 },
};

/**
 * 나뭇결. u(가로) 방향이 결 방향이다. 길게 늘인 노이즈 + 결 줄무늬 + 옹이.
 * 가로 1장 = 결 방향 1m, 세로 1장 = 결 직각 0.5m 기준으로 UV를 잡는다.
 */
export function woodTexture(kind: WoodKind, rng: Rng, size = 512): { map: THREE.CanvasTexture; rough: THREE.CanvasTexture } {
  const spec = WOOD[kind];
  const [c, ctx] = canvas(size, size);
  const [rc, rctx] = canvas(size, size);
  const img = ctx.createImageData(size, size);
  const rimg = rctx.createImageData(size, size);
  const n = new PeriodicNoise(rng.fork('wood-n'));
  const L = hex(spec.light), D = hex(spec.dark);

  // 옹이: 결을 휘게 만드는 중심점
  const knots = Array.from({ length: rng.int(1, 3) }, () => ({
    x: rng.float(), y: rng.float(), r: rng.range(0.02, 0.05),
  }));

  const PX = 4, PY = 64; // 노이즈 격자 주기(결 방향은 성기게, 직각은 촘촘하게)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      let warp = n.fbm(u * PX, v * 8, 3, PX, 8) * spec.warp;
      let knotDark = 0;
      for (const k of knots) {
        let dx = u - k.x; dx -= Math.round(dx);
        let dy = (v - k.y) * 2; dy -= Math.round(dy);
        const d = Math.sqrt(dx * dx * 0.25 + dy * dy);
        const f = Math.max(0, 1 - d / (k.r * 3));
        warp += f * f * 1.5 * Math.sign(dy || 1);
        knotDark += Math.max(0, 1 - d / k.r) * 0.8;
      }
      const ring = v * 22 + warp * 3;
      const stripe = Math.pow(0.5 + 0.5 * Math.sin(ring * Math.PI * 2), 3);
      const fine = n.fbm(u * 2, v * PY, 2, 2, PY);
      let t = 0.35 + stripe * spec.ring * 0.6 + (fine - 0.5) * 0.35 + knotDark;
      t = Math.min(1, Math.max(0, t));
      const pore = n.sample(u * 256, v * 512, 256, 512) > 0.86 ? 0.9 : 1;
      const i = (y * size + x) * 4;
      img.data[i] = clamp255(mix(L[0], D[0], t) * pore);
      img.data[i + 1] = clamp255(mix(L[1], D[1], t) * pore);
      img.data[i + 2] = clamp255(mix(L[2], D[2], t) * pore);
      img.data[i + 3] = 255;
      const r = clamp255((0.55 + stripe * 0.12 + (fine - 0.5) * 0.2) * 255);
      rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = r;
      rimg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  rctx.putImageData(rimg, 0, 0);
  return { map: toTexture(c, true), rough: toTexture(rc, false) };
}

// ---------- 회벽 ----------

export function plasterTexture(rng: Rng, size = 512): THREE.CanvasTexture {
  const [c, ctx] = canvas(size, size);
  const img = ctx.createImageData(size, size);
  const n = new PeriodicNoise(rng.fork('plaster'));
  const base = hex('#e9dcc6');
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const big = n.fbm(u * 4, v * 4, 4, 4, 4);
      const grain = n.sample(u * 128, v * 128, 128, 128);
      const k = 1 + (big - 0.5) * 0.07 + (grain - 0.5) * 0.035;
      const i = (y * size + x) * 4;
      img.data[i] = clamp255(base[0] * k);
      img.data[i + 1] = clamp255(base[1] * k);
      img.data[i + 2] = clamp255(base[2] * k * 0.995);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, true);
}

// ---------- 패브릭(짜임) ----------

export function fabricTexture(rng: Rng, base: string, size = 256): THREE.CanvasTexture {
  const [c, ctx] = canvas(size, size);
  const img = ctx.createImageData(size, size);
  const n = new PeriodicNoise(rng.fork('fabric'));
  const B = hex(base);
  const cell = 4; // 실 한 가닥 = 4px
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      const over = (cx + cy) % 2 === 0; // 평직
      const fx = (x % cell) / cell, fy = (y % cell) / cell;
      const along = over ? fx : fy;
      const shade = 0.86 + 0.14 * Math.sin(along * Math.PI);
      const slub = 1 + (n.sample(x / 16, y / 2, size / 16, size / 2) - 0.5) * 0.12;
      const k = shade * slub * (over ? 1.0 : 0.93);
      const i = (y * size + x) * 4;
      img.data[i] = clamp255(B[0] * k);
      img.data[i + 1] = clamp255(B[1] * k);
      img.data[i + 2] = clamp255(B[2] * k);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, true);
}

// ---------- 러그(테두리 무늬) ----------

export function rugTexture(rng: Rng, w = 1024, h = 640): THREE.CanvasTexture {
  const [c, ctx] = canvas(w, h);
  const field = '#7d3b2c', border = '#2f3a2e', accent = '#d9b47a', inner = '#a5573c';
  ctx.fillStyle = border;
  ctx.fillRect(0, 0, w, h);
  const b = 70;
  ctx.fillStyle = accent;
  ctx.fillRect(b - 10, b - 10, w - 2 * (b - 10), h - 2 * (b - 10));
  ctx.fillStyle = field;
  ctx.fillRect(b, b, w - 2 * b, h - 2 * b);
  // 테두리 마름모 띠
  ctx.fillStyle = accent;
  const step = 34;
  const drawDiamonds = (x0: number, y0: number, len: number, horiz: boolean) => {
    for (let s = step / 2; s < len; s += step) {
      const x = horiz ? x0 + s : x0, y = horiz ? y0 : y0 + s;
      ctx.beginPath();
      ctx.moveTo(x, y - 9); ctx.lineTo(x + 9, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 9, y);
      ctx.closePath(); ctx.fill();
    }
  };
  drawDiamonds(0, 30, w, true); drawDiamonds(0, h - 30, w, true);
  drawDiamonds(30, 0, h, false); drawDiamonds(w - 30, 0, h, false);
  // 가운데 메달리온
  ctx.strokeStyle = accent; ctx.lineWidth = 6;
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, 170, 110, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = border;
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, 70, 44, 0, 0, Math.PI * 2);
  ctx.fill();
  // 모서리 문양
  ctx.fillStyle = inner;
  for (const [x, y] of [[b + 40, b + 40], [w - b - 40, b + 40], [b + 40, h - b - 40], [w - b - 40, h - b - 40]]) {
    ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill();
  }
  // 털 결: 미세 노이즈
  const img = ctx.getImageData(0, 0, w, h);
  const n = new PeriodicNoise(rng.fork('rug'));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = 0.88 + n.sample(x / 3, y / 3) * 0.2 + (((x * 7 + y * 13) % 5) - 2) * 0.012;
      const i = (y * w + x) * 4;
      img.data[i] = clamp255(img.data[i] * k);
      img.data[i + 1] = clamp255(img.data[i + 1] * k);
      img.data[i + 2] = clamp255(img.data[i + 2] * k);
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, true, false);
}

// ---------- 책등 아틀라스 (4종) ----------

/** 흰 바탕 책등 무늬 4종을 가로로 붙인 아틀라스. 인스턴스 색이 곱해진다. */
export function spineAtlas(rng: Rng): THREE.CanvasTexture {
  const W = 512, H = 512, cw = W / 4;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  for (let k = 0; k < 4; k++) {
    const x0 = k * cw;
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, 0, cw, H); ctx.clip();
    if (k === 0) {
      // 위아래 금색 띠 두 줄
      ctx.fillStyle = 'rgba(255,230,170,0.9)';
      for (const y of [40, 56, H - 60, H - 44]) ctx.fillRect(x0 + 6, y, cw - 12, 6);
    } else if (k === 1) {
      // 가운데 라벨
      ctx.fillStyle = 'rgba(250,244,230,0.95)';
      ctx.fillRect(x0 + 18, 150, cw - 36, 120);
      ctx.fillStyle = 'rgba(60,50,40,0.6)';
      for (let i = 0; i < 4; i++) ctx.fillRect(x0 + 34, 175 + i * 22, cw - 68 - rng.int(0, 30), 7);
    } else if (k === 2) {
      // 어두운 상단 띠 + 글자 줄
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x0, 0, cw, 90);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 6; i++) ctx.fillRect(x0 + cw / 2 - 6, 130 + i * 38, 12, 22);
    } else {
      // 단색 + 아래쪽 출판사 표식
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(x0 + cw / 2, H - 70, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = 0; i < 5; i++) ctx.fillRect(x0 + cw / 2 - 5, 80 + i * 36, 10, 20);
    }
    ctx.restore();
  }
  // 종이 질감
  const img = ctx.getImageData(0, 0, W, H);
  const n = new PeriodicNoise(rng.fork('spine'));
  for (let i = 0; i < W * H; i++) {
    const k = 0.93 + n.sample((i % W) / 2, Math.floor(i / W) / 2) * 0.07;
    img.data[i * 4] = clamp255(img.data[i * 4] * k);
    img.data[i * 4 + 1] = clamp255(img.data[i * 4 + 1] * k);
    img.data[i * 4 + 2] = clamp255(img.data[i * 4 + 2] * k);
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, true, false);
}

// ---------- 종이 단면 ----------

export function pageEdgeTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(64, 64);
  ctx.fillStyle = '#efe5cf';
  ctx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 2) {
    ctx.fillStyle = `rgba(120,100,70,${0.05 + ((y * 37) % 7) * 0.012})`;
    ctx.fillRect(0, y, 64, 1);
  }
  return toTexture(c, true);
}

// ---------- 서점 간판 ----------

export function signTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(1024, 384);
  ctx.fillStyle = '#e8dcc3';
  ctx.fillRect(0, 0, 1024, 384);
  // 손글씨 느낌: 같은 글자를 살짝 어긋나게 두 번 칠한다
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 190px "Noto Serif KR", serif';
  ctx.fillStyle = 'rgba(36,37,31,0.35)';
  ctx.save(); ctx.translate(514, 170); ctx.rotate(-0.025); ctx.fillText('비북스', 0, 0); ctx.restore();
  ctx.fillStyle = '#24251f';
  ctx.save(); ctx.translate(510, 166); ctx.rotate(-0.02); ctx.fillText('비북스', 0, 0); ctx.restore();
  ctx.font = '500 44px "Noto Serif KR", serif';
  ctx.fillStyle = '#8a5a2b';
  ctx.fillText('원미동 동네 서점 · since 2019', 512, 318);
  // 붓 자국 밑줄
  ctx.strokeStyle = '#c08a4e';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(300, 262);
  ctx.bezierCurveTo(420, 252, 600, 270, 724, 256);
  ctx.stroke();
  return toTexture(c, true, false);
}

// ---------- 액자 그림(추상) ----------

export function paintingTexture(rng: Rng, palette: string[]): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 640);
  ctx.fillStyle = palette[0];
  ctx.fillRect(0, 0, 512, 640);
  // 수평선 풍경 느낌의 겹친 색면
  for (let i = 1; i < palette.length; i++) {
    ctx.fillStyle = palette[i];
    ctx.globalAlpha = 0.85;
    const y = rng.range(160, 560);
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) ctx.lineTo(x, y + Math.sin(x / 80 + i) * rng.range(8, 30));
    ctx.lineTo(512, 640); ctx.lineTo(0, 640); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,240,210,0.85)';
  ctx.beginPath(); ctx.arc(rng.range(120, 390), rng.range(110, 200), rng.range(30, 50), 0, Math.PI * 2); ctx.fill();
  // 캔버스 결
  const img = ctx.getImageData(0, 0, 512, 640);
  for (let i = 0; i < 512 * 640; i++) {
    const x = i % 512, y = Math.floor(i / 512);
    const k = 0.95 + ((x % 3 === 0 ? 1 : 0) + (y % 3 === 0 ? 1 : 0)) * 0.025;
    img.data[i * 4] = clamp255(img.data[i * 4] * k);
    img.data[i * 4 + 1] = clamp255(img.data[i * 4 + 1] * k);
    img.data[i * 4 + 2] = clamp255(img.data[i * 4 + 2] * k);
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, true, false);
}

// ---------- 창빛 패치(바닥의 창 모양) ----------

/** 창 격자 모양 밝은 영역. 가장자리는 흐리게. 알파로 쓴다. */
export function windowLightTexture(cols: number, rows: number): THREE.CanvasTexture {
  const W = 512, H = 512;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.filter = 'blur(10px)';
  ctx.fillStyle = '#fff';
  const m = 40, bar = 14;
  const pw = (W - 2 * m - bar * (cols - 1)) / cols;
  const ph = (H - 2 * m - bar * (rows - 1)) / rows;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) ctx.fillRect(m + i * (pw + bar), m + j * (ph + bar), pw, ph);
  ctx.filter = 'none';
  const t = toTexture(c, false, false);
  return t;
}

// ---------- 창밖 ----------

export function skyTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(64, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#93a0ab');
  g.addColorStop(0.45, '#b9c0c3');
  g.addColorStop(0.8, '#ddd4c3');
  g.addColorStop(1, '#e8dcc6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 512);
  return toTexture(c, true, false);
}

/** 건물 실루엣 한 겹. 창 불빛 점을 몇 개 넣는다. 알파 포함. */
export function skylineTexture(rng: Rng, color: string, lit: number, tall: number): THREE.CanvasTexture {
  const W = 1024, H = 512;
  const [c, ctx] = canvas(W, H);
  ctx.clearRect(0, 0, W, H);
  let x = -20;
  while (x < W) {
    const bw = rng.range(70, 190);
    const bh = rng.range(0.3, 1) * H * tall;
    ctx.fillStyle = color;
    ctx.fillRect(x, H - bh, bw + 1, bh);
    // 옥상 물탱크·난간
    if (rng.chance(0.4)) ctx.fillRect(x + bw * 0.2, H - bh - 18, bw * 0.25, 18);
    if (rng.chance(0.3)) ctx.fillRect(x + bw * 0.6, H - bh - 30, 4, 30);
    // 창 불빛
    for (let wy = H - bh + 22; wy < H - 20; wy += 34) {
      for (let wx = x + 12; wx < x + bw - 18; wx += 26) {
        if (rng.chance(lit)) {
          ctx.fillStyle = rng.chance(0.75) ? 'rgba(255,205,140,0.7)' : 'rgba(205,200,180,0.45)';
          ctx.fillRect(wx, wy, 9, 12);
        }
      }
    }
    x += bw + rng.range(-10, 14);
  }
  const t = toTexture(c, true, false);
  return t;
}

/** 나무 실루엣. */
export function treeTexture(rng: Rng, color: string): THREE.CanvasTexture {
  const W = 512, H = 512;
  const [c, ctx] = canvas(W, H);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = color;
  ctx.fillRect(W / 2 - 9, H * 0.55, 18, H * 0.45);
  for (let i = 0; i < 70; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng.float()) * 160;
    ctx.beginPath();
    ctx.arc(W / 2 + Math.cos(a) * r, H * 0.38 + Math.sin(a) * r * 0.8, rng.range(26, 54), 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(c, true, false);
}

// ---------- 접지 그림자(가구 밑 부드러운 어둠) ----------

/** 가장자리로 갈수록 옅어지는 둥근 사각형. 알파로 쓴다. */
export function contactShadowTexture(): THREE.CanvasTexture {
  const S = 256;
  const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, S, S);
  ctx.filter = 'blur(20px)';
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(32, 32, S - 64, S - 64, 24);
  ctx.fill();
  ctx.filter = 'none';
  return toTexture(c, false, false);
}
