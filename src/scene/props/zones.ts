// 비북스 구역 소품: 칸막이, 세미나실, 1인실, 계단 객석, 스크린, 매장 긴 테이블.
import * as THREE from 'three';
import { Rng } from '../../core/rng';
import { MergeBucket, bevelBox, projectUV, taperLeg, trs } from '../geom';
import {
  PARTITIONS, SCREEN, SEMINAR_CHAIRS, SEMINAR_MONITOR, SEMINAR_TABLE, SOLO_CHAIR, SOLO_DESK,
  STAGE, STORE_CHAIRS, STORE_TABLE, THEATER, WHITEBOARD, isPresent,
} from '../layout';
import { BookCollector, stackBooks } from './books';
import { buildChairAt } from './furniture';

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

/** 세미나실: 긴 테이블 + 의자 + 화이트보드 + 모니터. */
export function buildSeminar(bucket: MergeBucket, rng: Rng, books: BookCollector): void {
  if (!isPresent(SEMINAR_TABLE) || SEMINAR_TABLE.w < 0.1) return;
  const r = rng.fork('seminar');
  buildLongTable(bucket, r, SEMINAR_TABLE, books);
  SEMINAR_CHAIRS.forEach((c, i) => buildChairAt(bucket, r.fork(`sem-c-${i}`), trs(c.x, 0, c.z, 0, c.ry)));
  // 화이트보드
  const wb = WHITEBOARD;
  const wbM = trs(wb.x, 1.35, wb.z, 0, wb.ry);
  bucket.add('iron', bevelBox(wb.w + 0.04, wb.h + 0.04, 0.03, 0.004), wbM);
  bucket.add('paper', bevelBox(wb.w, wb.h, 0.01, 0.002), wbM.clone().multiply(trs(0, 0, 0.02)), 0xf4f6f7);
  bucket.add('iron', bevelBox(wb.w + 0.02, 0.04, 0.05, 0.003), trs(wb.x, 1.35 - wb.h / 2 - 0.03, wb.z + 0.02));
  // 모니터
  const mon = SEMINAR_MONITOR;
  const mm = trs(mon.x, 1.2, mon.z, 0, mon.ry);
  bucket.add('iron', bevelBox(0.72, 0.44, 0.04, 0.004), mm);
  bucket.add('subfloor', bevelBox(0.66, 0.38, 0.01, 0.002), mm.clone().multiply(trs(0, 0, 0.025)), 0x111318);
  bucket.add('iron', bevelBox(0.12, 0.35, 0.08, 0.004), mm.clone().multiply(trs(0, -0.4, -0.02)));
  bucket.add('iron', bevelBox(0.32, 0.03, 0.22, 0.004), mm.clone().multiply(trs(0, -0.58, 0)));
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

/** 1인 작업실: 붙박이 책상 + 뱅커스 램프 + 의자. */
export function buildSoloRoom(bucket: MergeBucket, rng: Rng, books: BookCollector): void {
  if (!isPresent(SOLO_DESK) || SOLO_DESK.w < 0.1) return;
  const r = rng.fork('solo');
  const d = SOLO_DESK;
  const base = trs(d.x, 0, d.z);
  const at = (m: THREE.Matrix4) => base.clone().multiply(m);
  wood(bucket, r, 'walnut', bevelBox(d.w, 0.04, d.d, 0.01, 2), 'x', at(trs(0, d.h - 0.02, 0)));
  // 벽 브래킷
  for (const sx of [-1, 1]) wood(bucket, r, 'walnut', bevelBox(0.08, 0.35, 0.06, 0.004), 'y', at(trs(sx * (d.w / 2 - 0.1), d.h - 0.2, -d.d / 2 + 0.02)));
  // 위 선반
  wood(bucket, r, 'honey', bevelBox(d.w - 0.1, 0.03, 0.22, 0.006), 'x', at(trs(0, 1.55, -0.05)));
  // 뱅커스 램프
  const lx = 0.32, lz = 0.05;
  bucket.add('brass', new THREE.CylinderGeometry(0.05, 0.06, 0.02, 16), at(trs(lx, d.h + 0.01, lz)));
  bucket.add('brass', new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8), at(trs(lx, d.h + 0.16, lz)));
  const shade = new THREE.CylinderGeometry(0.11, 0.14, 0.1, 20, 1, true);
  bucket.add('lampShade', shade, at(trs(lx, d.h + 0.34, lz)), 0x2f6b4a);
  bucket.add('bulb', new THREE.SphereGeometry(0.035, 12, 10), at(trs(lx, d.h + 0.3, lz)));
  stackBooks(at(trs(-0.25, d.h, 0.05, 0, 0.3)), r, books, 1);
  const mug = new THREE.CylinderGeometry(0.035, 0.032, 0.08, 14);
  bucket.add('ceramic', mug, at(trs(-0.05, d.h + 0.04, -0.08)), 0xf0ebe0);
  buildChairAt(bucket, r.fork('solo-chair'), trs(SOLO_CHAIR.x, 0, SOLO_CHAIR.z, 0, SOLO_CHAIR.ry));
}

/** 계단식 객석 + 낮은 무대. */
export function buildTheater(bucket: MergeBucket, rng: Rng): void {
  if (!isPresent(THEATER) || THEATER.rows < 1) return;
  const r = rng.fork('theater');
  const { x, z, ry, rows, cols, rowDepth, seatW, rise, firstY } = THEATER;
  const base = trs(x, 0, z, 0, ry);
  const at = (m: THREE.Matrix4) => base.clone().multiply(m);
  if (isPresent(STAGE) && STAGE.w > 0.1) {
    wood(bucket, r, 'walnut', bevelBox(STAGE.w, STAGE.h, STAGE.d, 0.008, 2), 'x',
      trs(STAGE.x, STAGE.h / 2, STAGE.z));
  }
  for (let row = 0; row < rows; row++) {
    const y0 = firstY + row * rise;
    const localZ = row * rowDepth;
    // 단 상판
    wood(bucket, r, 'honey', bevelBox(cols * seatW + 0.15, 0.06, rowDepth - 0.08, 0.008, 2), 'x',
      at(trs(0, y0 + 0.03, localZ)));
    // 등받이
    wood(bucket, r, 'honey', bevelBox(cols * seatW + 0.1, 0.42, 0.05, 0.006), 'x',
      at(trs(0, y0 + 0.28, localZ - rowDepth / 2 + 0.06)));
    for (let col = 0; col < cols; col++) {
      const lx = (col - (cols - 1) / 2) * seatW;
      const cush = projectUV(bevelBox(seatW - 0.1, 0.05, rowDepth - 0.22, 0.02, 3), 'x', { along: 0.3, across: 0.3, offset: [r.float(), r.float()] });
      bucket.add('cushion', cush, at(trs(lx, y0 + 0.085, localZ + 0.05)), new THREE.Color(1, 1, 1).multiplyScalar(0.92 + r.range(0, 0.08)));
    }
  }
  // 스탠드 조명 느낌의 작은 기둥
  for (const sx of [-1.15, 1.15]) {
    bucket.add('brass', new THREE.CylinderGeometry(0.025, 0.03, 1.1, 10), at(trs(sx * (cols * seatW) / 2, 0.55, -0.15)));
    bucket.add('bulb', new THREE.SphereGeometry(0.04, 10, 8), at(trs(sx * (cols * seatW) / 2, 1.15, -0.15)));
  }
}

/** 영화 감상용 스크린(어두운 패널). */
export function buildScreen(bucket: MergeBucket, rng: Rng): void {
  if (!isPresent(SCREEN) || SCREEN.w < 0.1) return;
  const r = rng.fork('screen');
  const s = SCREEN;
  const m = trs(s.x, 1.15, s.z, 0, s.ry);
  bucket.add('iron', bevelBox(0.06, s.h + 0.12, s.w + 0.12, 0.006), m);
  bucket.add('subfloor', bevelBox(0.02, s.h, s.w, 0.002), m.clone().multiply(trs(0.03, 0, 0)), 0x0c0d10);
  // 스탠드 다리
  wood(bucket, r, 'walnut', bevelBox(0.08, 0.7, 0.08, 0.004), 'y', m.clone().multiply(trs(0, -0.9, -s.w / 2 + 0.1)));
  wood(bucket, r, 'walnut', bevelBox(0.08, 0.7, 0.08, 0.004), 'y', m.clone().multiply(trs(0, -0.9, s.w / 2 - 0.1)));
}
