// 비북스 구역 소품: 칸막이, 세미나실, 1인실, 계단 객석, 스크린, 매장 긴 테이블.
import * as THREE from 'three';
import { Rng } from '../../core/rng';
import { MergeBucket, bevelBox, projectUV, taperLeg, trs } from '../geom';
import {
  PARTITIONS, RUG, SCREEN, SEATS, SEMINAR_CHAIRS, SEMINAR_TABLE, SOLO_CHAIR, SOLO_DESK,
  STAGE, STORE_CHAIRS, STORE_TABLE, THEATERS, TheaterBlock, WHITEBOARD, isPresent,
} from '../layout';
import { BookCollector, stackBooks } from './books';
import { buildChairAt, buildStoolAt } from './furniture';

function wood(bucket: MergeBucket, r: Rng, mat: string, g: THREE.BufferGeometry, grain: 'x' | 'y' | 'z', m: THREE.Matrix4, k = 1) {
  projectUV(g, grain, { offset: [r.float(), r.float()] });
  bucket.add(mat, g, m, new THREE.Color(k, k, k));
}

/** 내부 칸막이 벽(+문 구멍). */
export function buildPartitions(bucket: MergeBucket, rng: Rng): void {
  const r = rng.fork('partitions');
  const t = 0.1;
  for (const p of PARTITIONS) {
    const base = trs(p.x, 0, p.z, 0, p.ry);
    const at = (m: THREE.Matrix4) => base.clone().multiply(m);
    if (!p.door) {
      const g = bevelBox(p.len, p.h, t, 0.004);
      projectUV(g, 'x', { offset: [r.float(), r.float()] });
      bucket.add('plaster', g, at(trs(0, p.h / 2, 0)));
      continue;
    }
    const { cx, w, h } = p.door;
    const left = cx - w / 2, right = cx + w / 2;
    const segments: { x0: number; x1: number; y0: number; y1: number }[] = [
      { x0: -p.len / 2, x1: left, y0: 0, y1: p.h },
      { x0: right, x1: p.len / 2, y0: 0, y1: p.h },
      { x0: left, x1: right, y0: h, y1: p.h },
    ];
    for (const s of segments) {
      const ww = s.x1 - s.x0, hh = s.y1 - s.y0;
      if (ww < 0.04 || hh < 0.04) continue;
      const g = bevelBox(ww, hh, t, 0.003);
      projectUV(g, 'x', { offset: [r.float(), r.float()] });
      bucket.add('plaster', g, at(trs((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, 0)));
    }
    // 문틀 느낌
    wood(bucket, r, 'walnut', bevelBox(0.06, h, t + 0.02, 0.004), 'y', at(trs(left + 0.02, h / 2, 0)));
    wood(bucket, r, 'walnut', bevelBox(0.06, h, t + 0.02, 0.004), 'y', at(trs(right - 0.02, h / 2, 0)));
    wood(bucket, r, 'walnut', bevelBox(w, 0.06, t + 0.02, 0.004), 'x', at(trs(cx, h + 0.02, 0)));
  }
}

/** 세미나실: 긴 테이블 + 스툴 + 뒤벽 화이트보드(출입문 틈만 비움). */
export function buildSeminar(bucket: MergeBucket, rng: Rng, books: BookCollector): void {
  if (!isPresent(SEMINAR_TABLE) || SEMINAR_TABLE.w < 0.1) return;
  const r = rng.fork('seminar');
  buildLongTable(bucket, r, SEMINAR_TABLE, books);
  SEMINAR_CHAIRS.forEach((c, i) => buildStoolAt(bucket, r.fork(`sem-c-${i}`), trs(c.x, 0, c.z, 0, c.ry)));
  if (isPresent(WHITEBOARD) && WHITEBOARD.w > 0.1) {
    const wb = WHITEBOARD;
    // 징두리 위부터 천장 가까이 — 한 면 통짜
    const y = 1.05 + wb.h / 2;
    const wbM = trs(wb.x, y, wb.z, 0, wb.ry);
    bucket.add('iron', bevelBox(wb.w + 0.06, wb.h + 0.06, 0.034, 0.004), wbM);
    bucket.add('paper', bevelBox(wb.w, wb.h, 0.012, 0.002), wbM.clone().multiply(trs(0, 0, 0.022)), 0xf4f6f7);
    bucket.add('iron', bevelBox(wb.w + 0.02, 0.05, 0.055, 0.003),
      wbM.clone().multiply(trs(0, -wb.h / 2 - 0.04, 0.02)));
  }
}

/** 매장 8인 원목 테이블. */
export function buildStoreTable(bucket: MergeBucket, rng: Rng, books: BookCollector): void {
  if (!isPresent(STORE_TABLE) || STORE_TABLE.w < 0.1) return;
  const r = rng.fork('store-table');
  buildLongTable(bucket, r, STORE_TABLE, books);
  STORE_CHAIRS.forEach((c, i) => buildChairAt(bucket, r.fork(`sc-${i}`), trs(c.x, 0, c.z, 0, c.ry)));
}

function buildLongTable(
  bucket: MergeBucket,
  r: Rng,
  table: { x: number; z: number; ry: number; w: number; d: number; h: number },
  books: BookCollector,
): void {
  const base = trs(table.x, 0, table.z, 0, table.ry);
  const at = (m: THREE.Matrix4) => base.clone().multiply(m);
  const { w, d, h } = table;
  const topT = 0.038;
  wood(bucket, r, 'honey', bevelBox(w, topT, d, 0.014, 3), 'x', at(trs(0, h - topT / 2, 0)));
  const ah = 0.07;
  for (const sz of [-1, 1]) wood(bucket, r, 'honey', bevelBox(w - 0.16, ah, 0.022, 0.004), 'x', at(trs(0, h - topT - ah / 2, sz * (d / 2 - 0.07))));
  for (const sx of [-1, 1]) wood(bucket, r, 'honey', bevelBox(0.022, ah, d - 0.16, 0.004), 'z', at(trs(sx * (w / 2 - 0.07), h - topT - ah / 2, 0)));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    wood(bucket, r, 'honey', taperLeg(h - topT, 0.048, 0.03), 'y', at(trs(sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.08))));
  }
  // 중앙 가로대
  wood(bucket, r, 'honey', bevelBox(w - 0.3, 0.03, 0.03, 0.004), 'x', at(trs(0, 0.22, 0)));
  stackBooks(at(trs(-0.55, h, 0.1, 0, 0.2)), r, books, 2);
  const pot = new THREE.CylinderGeometry(0.05, 0.042, 0.12, 16);
  bucket.add('ceramic', pot, at(trs(0.15, h + 0.06, -0.08)), 0x2f3b30);
}

/** 1인 작업실: 벽면 붙박이 책상 + 박스 선반 + 뱅커스 램프 + 빨간 안락의자. */
export function buildSoloRoom(bucket: MergeBucket, rng: Rng, books: BookCollector): void {
  if (!isPresent(SOLO_DESK) || SOLO_DESK.w < 0.1) return;
  const r = rng.fork('solo');
  const d = SOLO_DESK;
  const base = trs(d.x, 0, d.z);
  const at = (m: THREE.Matrix4) => base.clone().multiply(m);

  // 벽 폭을 채우는 떠 있는 책상판
  wood(bucket, r, 'walnut', bevelBox(d.w, 0.045, d.d, 0.012, 2), 'x', at(trs(0, d.h - 0.022, 0)));
  // 벽 브래킷(뒤쪽)
  for (const sx of [-1, 1]) {
    wood(bucket, r, 'walnut', bevelBox(0.1, 0.32, 0.07, 0.005), 'y',
      at(trs(sx * (d.w / 2 - 0.14), d.h - 0.2, -d.d / 2 + 0.02)));
    wood(bucket, r, 'walnut', bevelBox(0.08, 0.04, 0.28, 0.004), 'z',
      at(trs(sx * (d.w / 2 - 0.14), d.h - 0.05, -0.02)));
  }

  // 위 박스형 벽 선반 (두 칸)
  const shW = 1.05, shH = 0.3, shD = 0.2, shY = 1.58;
  wood(bucket, r, 'walnut', bevelBox(shW, 0.025, shD, 0.005), 'x', at(trs(0, shY, -d.d / 2 + shD / 2 + 0.02)));
  wood(bucket, r, 'walnut', bevelBox(shW, 0.025, shD, 0.005), 'x', at(trs(0, shY + shH, -d.d / 2 + shD / 2 + 0.02)));
  wood(bucket, r, 'walnut', bevelBox(0.02, shH, shD, 0.004), 'y', at(trs(-shW / 2 + 0.01, shY + shH / 2, -d.d / 2 + shD / 2 + 0.02)));
  wood(bucket, r, 'walnut', bevelBox(0.02, shH, shD, 0.004), 'y', at(trs(shW / 2 - 0.01, shY + shH / 2, -d.d / 2 + shD / 2 + 0.02)));
  wood(bucket, r, 'walnut', bevelBox(0.018, shH, shD - 0.01, 0.003), 'y', at(trs(0, shY + shH / 2, -d.d / 2 + shD / 2 + 0.02)));
  // 선반 책(기대어 꽂힘)
  stackBooks(at(trs(-0.38, shY + 0.025, -d.d / 2 + 0.1, 0, 0.15)), r.fork('sh-a'), books, 4);
  stackBooks(at(trs(0.22, shY + 0.025, -d.d / 2 + 0.1, 0, -0.1)), r.fork('sh-b'), books, 3);

  // 뱅커스 램프 (앉은 사람 왼쪽 = -x)
  const lx = -0.55, lz = 0.02;
  bucket.add('brass', new THREE.CylinderGeometry(0.055, 0.065, 0.02, 16), at(trs(lx, d.h + 0.01, lz)));
  bucket.add('brass', new THREE.CylinderGeometry(0.014, 0.014, 0.3, 8), at(trs(lx, d.h + 0.17, lz)));
  const shade = new THREE.CylinderGeometry(0.1, 0.13, 0.11, 20, 1, true);
  bucket.add('lampShade', shade, at(trs(lx, d.h + 0.36, lz)), 0x2a6b3a);
  bucket.add('bulb', new THREE.SphereGeometry(0.032, 12, 10), at(trs(lx, d.h + 0.32, lz)));

  // 유리 화병 + 분홍 튤립 (오른쪽)
  const vx = 0.55, vz = 0.0;
  bucket.add('glass', new THREE.CylinderGeometry(0.04, 0.035, 0.16, 14, 1, true), at(trs(vx, d.h + 0.08, vz)));
  bucket.add('glass', new THREE.CylinderGeometry(0.038, 0.038, 0.01, 14), at(trs(vx, d.h + 0.01, vz)));
  for (let i = 0; i < 5; i++) {
    const a = -0.5 + i * 0.25;
    const sx = Math.sin(a) * 0.025, sz = Math.cos(a) * 0.02;
    bucket.add('leaf', new THREE.CylinderGeometry(0.004, 0.005, 0.22, 6), at(trs(vx + sx, d.h + 0.2, vz + sz, 0.15 * a, 0, 0.1 * a)), 0x3d6b3a);
    bucket.add('ceramic', new THREE.SphereGeometry(0.028, 10, 8), at(trs(vx + sx * 1.2, d.h + 0.34 + Math.abs(a) * 0.02, vz + sz)), 0xe8a0b8);
  }

  // 머그
  const mug = new THREE.CylinderGeometry(0.032, 0.03, 0.075, 14);
  bucket.add('ceramic', mug, at(trs(0.28, d.h + 0.038, -0.05)), 0xf4f0ea);
  bucket.add('ceramic', new THREE.TorusGeometry(0.028, 0.006, 8, 14, Math.PI), at(trs(0.32, d.h + 0.04, -0.05, 0, 0, Math.PI / 2)), 0xf4f0ea);

  // 책상 위 얇은 책 한 권
  stackBooks(at(trs(-0.15, d.h, 0.05, 0, 0.25)), r.fork('desk-book'), books, 1);

  // 빨간 빈티지 안락의자
  if (isPresent(SOLO_CHAIR)) buildSoloArmchair(bucket, r.fork('armchair'), trs(SOLO_CHAIR.x, 0, SOLO_CHAIR.z, 0, SOLO_CHAIR.ry));

  // 책상 아래 가방(왼쪽)
  bucket.add('iron', bevelBox(0.28, 0.32, 0.14, 0.02, 2), at(trs(-0.7, 0.16, 0.35)), 0x1a1a1a);
  bucket.add('iron', bevelBox(0.22, 0.04, 0.04, 0.008), at(trs(-0.7, 0.34, 0.35)), 0x222222);
}

/** 낮은 등받이·팔걸이 있는 가죽 안락의자. 앉은 사람은 +z. */
function buildSoloArmchair(bucket: MergeBucket, r: Rng, m: THREE.Matrix4): void {
  const at = (mm: THREE.Matrix4) => m.clone().multiply(mm);
  const fabric = (g: THREE.BufferGeometry, mm: THREE.Matrix4, hex: number) => {
    projectUV(g, 'x', { along: 0.35, across: 0.35, offset: [r.float(), r.float()] });
    bucket.add('cushion', g, mm, new THREE.Color(hex));
  };
  const legH = 0.14, seatH = 0.38, w = 0.58, d = 0.52;
  const red = 0x8a2e2e;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    wood(bucket, r, 'walnut', taperLeg(legH, 0.032, 0.022), 'y', at(trs(sx * (w / 2 - 0.07), 0, sz * (d / 2 - 0.07))));
  }
  // 좌석·팔걸이·등받이
  fabric(bevelBox(w - 0.06, 0.1, d - 0.08, 0.04, 4), at(trs(0, seatH - 0.02, 0.02)), red);
  for (const sx of [-1, 1]) {
    fabric(bevelBox(0.08, 0.22, d - 0.06, 0.035, 4), at(trs(sx * (w / 2 - 0.05), seatH + 0.08, 0)), 0x7a2828);
  }
  fabric(bevelBox(w - 0.08, 0.42, 0.12, 0.045, 4), at(trs(0, seatH + 0.22, -d / 2 + 0.1, -0.12)), 0x7a2828);
  // 등 쿠션
  fabric(bevelBox(w - 0.18, 0.28, 0.1, 0.05, 5), at(trs(0, seatH + 0.2, -d / 2 + 0.2, -0.25)), 0x9a3838);
}

/**
 * 회색 윙백 1인 소파(STRANDMON 느낌, 아바타 한 명 크기). 앉은 사람은 +z.
 */
function buildWingbackArmchair(bucket: MergeBucket, r: Rng, m0: THREE.Matrix4, scale = 1): void {
  const m = m0.clone().multiply(new THREE.Matrix4().makeScale(scale, scale, scale));
  const at = (mm: THREE.Matrix4) => m.clone().multiply(mm);
  const fabric = (g: THREE.BufferGeometry, mm: THREE.Matrix4, k = 1) => {
    projectUV(g, 'x', { along: 0.32, across: 0.32, offset: [r.float(), r.float()] });
    bucket.add('wingback', g, mm, new THREE.Color(k, k, k));
  };
  const legH = 0.1;
  const seatH = 0.38;
  const w = 0.5;
  const d = 0.52;
  const gray = 1.0;
  const grayDeep = 0.9;

  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = taperLeg(legH, 0.022, 0.014);
    projectUV(leg, 'y', { offset: [r.float(), r.float()] });
    bucket.add('iron', leg, at(trs(sx * (w / 2 - 0.07), 0, sz * (d / 2 - 0.07))), 0x1a1a1a);
  }

  fabric(bevelBox(w - 0.03, 0.09, d - 0.08, 0.035, 4), at(trs(0, seatH - 0.06, 0.015)), gray);
  fabric(bevelBox(w - 0.08, 0.08, d - 0.12, 0.04, 5), at(trs(0, seatH + 0.015, 0.03)), 1.05);

  for (const sx of [-1, 1]) {
    fabric(bevelBox(0.08, 0.2, d - 0.12, 0.03, 4), at(trs(sx * (w / 2 - 0.05), seatH + 0.07, 0.015)), grayDeep);
    fabric(bevelBox(0.1, 0.06, 0.15, 0.028, 4), at(trs(sx * (w / 2 - 0.015), seatH + 0.19, 0.04, 0, 0, sx * 0.3)), gray);
  }

  const backZ = -d / 2 + 0.09;
  fabric(bevelBox(w - 0.1, 0.52, 0.09, 0.032, 4), at(trs(0, seatH + 0.28, backZ, -0.08)), grayDeep);
  for (const sx of [-1, 1]) {
    fabric(bevelBox(0.085, 0.3, 0.2, 0.03, 4), at(trs(sx * (w / 2 - 0.07), seatH + 0.36, backZ + 0.09, -0.05, 0, sx * 0.18)), gray);
    fabric(bevelBox(0.07, 0.14, 0.12, 0.028, 4), at(trs(sx * (w / 2 - 0.08), seatH + 0.52, backZ + 0.04, 0.12)), grayDeep);
  }
  fabric(bevelBox(w - 0.18, 0.14, 0.05, 0.025, 3), at(trs(0, seatH + 0.16, backZ + 0.05, -0.1)), 0.95);
  for (let i = 0; i < 4; i++) {
    const bx = (i - 1.5) * 0.08;
    bucket.add('iron', new THREE.SphereGeometry(0.009, 8, 6), at(trs(bx, seatH + 0.16, backZ + 0.08)), 0x2c2c2c);
  }
}

/** 계단식 객석 윙 하나(데크·계단·방석). */
function buildTheaterWing(bucket: MergeBucket, rng: Rng, th: TheaterBlock, wingIdx: number): void {
  if (th.rows < 1) return;
  const r = rng.fork(`theater-${wingIdx}`);
  const { x, z, ry, rows, cols, rowDepth, seatW, rise, firstY } = th;
  const base = trs(x, 0, z, 0, ry);
  const at = (m: THREE.Matrix4) => base.clone().multiply(m);

  const deckW = cols * seatW + 0.45;
  const faceT = 0.04;
  const wallSide = -(th.stairSide ?? -1); // 계단 반대 = 벽쪽 옆판

  // —— 단 데크. localZ=0 벽쪽(뒤·높음) → localZ 클수록 앞·낮음.
  for (let i = 0; i < rows; i++) {
    const yTop = firstY + (rows - 1 - i) * rise;
    const z0 = i * rowDepth;
    const z1 = (i + 1) * rowDepth;
    const depth = z1 - z0;
    const w = deckW + i * 0.08;
    wood(bucket, r, 'honey', bevelBox(w, 0.05, depth - 0.02, 0.008, 2), 'x',
      at(trs(0, yTop - 0.025, z0 + depth / 2)));
    wood(bucket, r, 'honey', bevelBox(w + 0.02, yTop, faceT, 0.006), 'y',
      at(trs(0, yTop / 2, z1 - faceT / 2 - 0.01)));
    wood(bucket, r, 'honey', bevelBox(faceT, yTop, depth, 0.006), 'y',
      at(trs(wallSide * (w / 2 - faceT / 2), yTop / 2, z0 + depth / 2)));
  }

  // —— 오름 계단
  const side = th.stairSide ?? -1;
  const stairX = side * (deckW / 2 + 0.08);
  const stepN = rows * 2;
  const stairDepth = rows * rowDepth;
  const stepD = stairDepth / stepN;
  const stepH = (firstY + (rows - 1) * rise) / stepN;
  for (let s = 0; s < stepN; s++) {
    const yTop = (s + 1) * stepH;
    const z1 = stairDepth - s * stepD;
    const z0 = z1 - stepD;
    wood(bucket, r, 'honey', bevelBox(0.55, 0.04, stepD - 0.02, 0.006), 'x',
      at(trs(stairX + side * 0.28, yTop - 0.02, (z0 + z1) / 2)));
    wood(bucket, r, 'honey', bevelBox(0.55, yTop, 0.035, 0.005), 'y',
      at(trs(stairX + side * 0.28, yTop / 2, z0 + 0.02)));
  }
  const railH = firstY + (rows - 1) * rise;
  const railX = stairX + side * 0.55;
  wood(bucket, r, 'walnut', bevelBox(0.05, railH + 0.45, 0.05, 0.004), 'y',
    at(trs(railX, (railH + 0.45) / 2, stairDepth * 0.15)));
  wood(bucket, r, 'walnut', bevelBox(0.05, railH + 0.35, 0.05, 0.004), 'y',
    at(trs(railX, (railH + 0.35) / 2, stairDepth * 0.85)));
  wood(bucket, r, 'walnut', bevelBox(0.04, 0.04, stairDepth * 0.75, 0.004), 'z',
    at(trs(railX, railH + 0.42, stairDepth * 0.5)));

  // —— 동그란 방석
  const cushColors = [0x6b7a55, 0x8a8f86, 0xc4b49a, 0x7d6b58, 0x9aa890, 0xb7a78c];
  let ci = wingIdx * 7;
  for (let i = 0; i < rows; i++) {
    const yTop = firstY + (rows - 1 - i) * rise;
    const localZ = i * rowDepth + rowDepth * 0.45;
    for (let col = 0; col < cols; col++) {
      const lx = (col - (cols - 1) / 2) * seatW + r.range(-0.03, 0.03);
      const rad = 0.2 + r.range(-0.015, 0.015);
      const cush = new THREE.CylinderGeometry(rad, rad * 1.02, 0.055, 18);
      projectUV(cush, 'y', { along: 0.4, across: 0.4, offset: [r.float(), r.float()] });
      const hex = cushColors[ci++ % cushColors.length];
      bucket.add('cushion', cush, at(trs(lx, yTop + 0.028, localZ + r.range(-0.03, 0.03))), new THREE.Color(hex));
    }
  }
}

/** ㄱ자·다단 객석 + (있으면) 사각 무대, 또는 원형 카페트 위 강사 자리. */
export function buildTheater(bucket: MergeBucket, rng: Rng): void {
  const r = rng.fork('theater');
  THEATERS.forEach((th, i) => buildTheaterWing(bucket, r, th, i));

  // —— 사각 무대 + 의자 + 마이크(레거시)
  if (isPresent(STAGE) && STAGE.w > 0.1) {
    const s = STAGE;
    const sm = trs(s.x, 0, s.z);
    const sat = (m: THREE.Matrix4) => sm.clone().multiply(m);
    wood(bucket, r, 'honey', bevelBox(s.w, s.h, s.d, 0.01, 2), 'x', sat(trs(0, s.h / 2, 0)));
    wood(bucket, r, 'walnut', bevelBox(s.w + 0.02, 0.04, 0.03, 0.004), 'x', sat(trs(0, s.h - 0.02, s.d / 2 - 0.01)));
    for (const sx of [-1, 1]) {
      wood(bucket, r, 'walnut', bevelBox(0.03, 0.04, s.d, 0.004), 'z', sat(trs(sx * (s.w / 2 - 0.01), s.h - 0.02, 0)));
    }
    wood(bucket, r, 'honey', bevelBox(s.w * 0.45, 0.1, 0.28, 0.008), 'x', sat(trs(0, 0.05, s.d / 2 + 0.12)));
    buildChairAt(bucket, r.fork('author'), trs(s.x - 0.12, s.h, s.z - 0.05, 0, 0));
    const mx = 0.28, mz = 0.18;
    bucket.add('iron', new THREE.CylinderGeometry(0.07, 0.09, 0.015, 14), sat(trs(mx, s.h + 0.008, mz)));
    bucket.add('iron', new THREE.CylinderGeometry(0.01, 0.01, 0.38, 8), sat(trs(mx, s.h + 0.2, mz)));
    bucket.add('iron', new THREE.CylinderGeometry(0.016, 0.012, 0.07, 8), sat(trs(mx - 0.04, s.h + 0.42, mz + 0.02, 0, 0, 0.85)));
    bucket.add('iron', new THREE.SphereGeometry(0.022, 10, 8), sat(trs(mx - 0.07, s.h + 0.44, mz + 0.03)));
    return;
  }

  // —— 원형 카페트 위 윙백(강연장)
  if (isPresent(RUG) && RUG.round) {
    const cx = RUG.x;
    const cz = RUG.z;
    const seat = SEATS.find((s) => s.id === 'stage-1');
    const ry = seat?.ry ?? Math.atan2(-1.2 - cx, 0.85 - cz);
    buildWingbackArmchair(bucket, r.fork('performer'), trs(cx, 0, cz, 0, ry), 0.76);
  }
}

/** 영화 감상용 벽걸이 스크린(어두운 패널 + 약한 발광). 클릭으로 유튜브 재생. */
export function buildScreen(bucket: MergeBucket, rng: Rng): void {
  if (!isPresent(SCREEN) || SCREEN.w < 0.1) return;
  const r = rng.fork('screen');
  const s = SCREEN;
  const y = 0.55 + s.h / 2;
  const m = trs(s.x, y, s.z, 0, s.ry);
  // 프레임·베젤
  bucket.add('iron', bevelBox(0.05, s.h + 0.1, s.w + 0.1, 0.006), m);
  // 화면(방 안쪽 +x 로컬) — 어두운 패널(클릭하면 영화 재생)
  bucket.add('subfloor', bevelBox(0.02, s.h, s.w, 0.002), m.clone().multiply(trs(0.03, 0, 0)), 0x121820);
  // 벽 브래킷
  for (const sz of [-0.35, 0.35]) {
    wood(bucket, r, 'walnut', bevelBox(0.08, 0.06, 0.14, 0.004), 'z', m.clone().multiply(trs(-0.04, -s.h * 0.2, sz * s.w)));
  }
}
