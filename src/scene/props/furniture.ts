// 아일랜드 평대, 창가 독서 테이블, 의자, 계산대.
import * as THREE from 'three';
import { Rng } from '../../core/rng';
import { MergeBucket, bevelBox, projectUV, taperLeg, trs } from '../geom';
import { BENCH, CHAIRS, COFFEE_TABLE, COUNTER, ISLAND, READING_TABLE } from '../layout';
import { BookCollector, displayBook, stackBooks } from './books';

/** k는 밝기 배율(판재마다 색조 차이). */
function woodPart(bucket: MergeBucket, r: Rng, mat: string, g: THREE.BufferGeometry, grain: 'x' | 'y' | 'z', m: THREE.Matrix4, k = 1) {
  projectUV(g, grain, { offset: [r.float(), r.float()] });
  bucket.add(mat, g, m, new THREE.Color(k, k, k));
}

export function buildIsland(bucket: MergeBucket, rng: Rng, books: BookCollector): void {
  const r = rng.fork('island');
  const { x, z, w, d, h } = ISLAND;
  const base = trs(x, 0, z);
  const at = (m: THREE.Matrix4) => base.clone().multiply(m);
  // 굽 + 몸통(세로 판재) + 상판
  woodPart(bucket, r, 'walnut', bevelBox(w - 0.12, 0.08, d - 0.12, 0.01), 'x', at(trs(0, 0.04, 0)));
  const bodyH = h - 0.08 - 0.04;
  const nSlat = 14;
  for (const side of [-1, 1]) {
    for (let i = 0; i < nSlat; i++) {
      const sw = (w - 0.06) / nSlat;
      woodPart(bucket, r, 'honey', bevelBox(sw - 0.004, bodyH, 0.018, 0.003, 1), 'y',
        at(trs(-w / 2 + 0.03 + sw * (i + 0.5), 0.08 + bodyH / 2, side * (d / 2 - 0.04))), 1 + r.range(-0.05, 0.05));
    }
  }
  for (const side of [-1, 1]) {
    woodPart(bucket, r, 'honey', bevelBox(0.02, bodyH, d - 0.08, 0.004), 'y', at(trs(side * (w / 2 - 0.04), 0.08 + bodyH / 2, 0)));
  }
  woodPart(bucket, r, 'honey', bevelBox(w, 0.04, d, 0.012, 3), 'x', at(trs(0, h - 0.02, 0)));

  // 위에 눕힌 책 더미와 세운 추천 책
  const top = h;
  stackBooks(at(trs(-0.5, top, 0.14, 0, 0.1)), r, books, 5);
  stackBooks(at(trs(-0.18, top, -0.18, 0, -0.08)), r, books, 4);
  stackBooks(at(trs(0.32, top, 0.2, 0, 0.05)), r, books, 6);
  stackBooks(at(trs(0.45, top, -0.2, 0, 0.18)), r, books, 3);
  displayBook(at(trs(-0.48, top, -0.22, 0, 0.2)), r, books, bucket);
  displayBook(at(trs(0.08, top, 0.24, 0, -0.15)), r, books, bucket);
  displayBook(at(trs(0.62, top, 0.12, 0, Math.PI - 0.3)), r, books, bucket);
}

export function buildReadingTable(bucket: MergeBucket, rng: Rng, books: BookCollector): void {
  const r = rng.fork('table');
  const { x, z, w, d, h } = READING_TABLE;
  const base = trs(x, 0, z);
  const at = (m: THREE.Matrix4) => base.clone().multiply(m);
  const topT = 0.035;
  woodPart(bucket, r, 'honey', bevelBox(w, topT, d, 0.012, 3), 'x', at(trs(0, h - topT / 2, 0)));
  // 에이프런
  const ah = 0.07;
  for (const sz of [-1, 1]) woodPart(bucket, r, 'honey', bevelBox(w - 0.14, ah, 0.02, 0.004), 'x', at(trs(0, h - topT - ah / 2, sz * (d / 2 - 0.06))));
  for (const sx of [-1, 1]) woodPart(bucket, r, 'honey', bevelBox(0.02, ah, d - 0.14, 0.004), 'z', at(trs(sx * (w / 2 - 0.06), h - topT - ah / 2, 0)));
  // 테이퍼 다리
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    woodPart(bucket, r, 'honey', taperLeg(h - topT, 0.045, 0.028), 'y', at(trs(sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06))));
  }
  // 테이블 위: 펼친 책 한 권, 눕힌 책 두 권, 머그
  stackBooks(at(trs(0.3, h, -0.1, 0, 0.3)), r, books, 2);
  openBook(bucket, at(trs(-0.28, h + 0.003, 0.05, 0, 0.12)));
  const mug = new THREE.CylinderGeometry(0.04, 0.037, 0.095, 20, 1, false);
  bucket.add('ceramic', mug, at(trs(0.05, h + 0.0475, -0.12)), 0xd9c6a5);
  const handle = new THREE.TorusGeometry(0.025, 0.007, 8, 16, Math.PI);
  bucket.add('ceramic', handle, at(trs(0.093, h + 0.05, -0.12, 0, 0, -Math.PI / 2)), 0xd9c6a5);

  CHAIRS.forEach((c, i) => buildChair(bucket, r.fork(`chair-${i}`), trs(c.x, 0, c.z, 0, c.ry)));
}

/** 펼쳐 놓은 책: 휘어진 두 쪽. */
function openBook(bucket: MergeBucket, m: THREE.Matrix4): void {
  const pw = 0.15, ph = 0.22;
  for (const side of [-1, 1]) {
    const g = new THREE.PlaneGeometry(pw, ph, 8, 1);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const u = (p.getX(i) + pw / 2) / pw; // 0(가운데)→1(바깥)
      p.setXYZ(i, side * u * pw, Math.sin(u * Math.PI) * 0.018 + u * 0.004, p.getY(i));
    }
    g.computeVertexNormals();
    bucket.add('paper', g, m);
  }
  bucket.add('walnut', bevelBox(pw * 2 + 0.012, 0.004, ph + 0.01, 0.0015, 1), m.clone().multiply(trs(0, -0.002, 0)), 0x8c2f2a);
}

/** 의자: 좌판 + 테이퍼 다리 + 등받이 살 5개 + 등받이 상단 + 방석. m은 의자 바닥 중앙, 앉은 사람은 +z를 바라봄. */
function buildChair(bucket: MergeBucket, r: Rng, m: THREE.Matrix4): void {
  const at = (mm: THREE.Matrix4) => m.clone().multiply(mm);
  const seatH = 0.44, sw = 0.42, sd = 0.4, st = 0.03;
  woodPart(bucket, r, 'honey', bevelBox(sw, st, sd, 0.01, 3), 'x', at(trs(0, seatH - st / 2, 0)));
  // 앞다리
  for (const sx of [-1, 1]) woodPart(bucket, r, 'honey', taperLeg(seatH - st, 0.034, 0.024), 'y', at(trs(sx * (sw / 2 - 0.03), 0, sd / 2 - 0.03)));
  // 뒷다리는 등받이까지 이어짐
  const backH = 0.84;
  for (const sx of [-1, 1]) woodPart(bucket, r, 'honey', taperLeg(backH, 0.03, 0.026), 'y', at(trs(sx * (sw / 2 - 0.03), 0, -sd / 2 + 0.03, -0.05)));
  // 다리 가로대
  for (const sx of [-1, 1]) woodPart(bucket, r, 'honey', bevelBox(0.018, 0.018, sd - 0.06, 0.004), 'z', at(trs(sx * (sw / 2 - 0.03), 0.16, 0)));
  // 등받이 상단 + 살
  const topY = backH - 0.05;
  const backZ = -sd / 2 + 0.03 - Math.sin(0.05) * topY;
  woodPart(bucket, r, 'honey', bevelBox(sw - 0.02, 0.06, 0.025, 0.008), 'x', at(trs(0, topY, backZ - 0.005, -0.05)));
  for (let i = 0; i < 5; i++) {
    const sx = -0.12 + i * 0.06;
    const slatH = topY - seatH - 0.03;
    woodPart(bucket, r, 'honey', bevelBox(0.018, slatH, 0.012, 0.004), 'y', at(trs(sx, seatH + slatH / 2, -sd / 2 + 0.03 - Math.sin(0.05) * (seatH + slatH / 2), -0.05)));
  }
  // 방석
  bucket.add('cushion', projectUV(bevelBox(sw - 0.05, 0.035, sd - 0.05, 0.015, 3), 'x', { along: 0.25, across: 0.25 }), at(trs(0, seatH + 0.017, 0.01)));
}

export function buildCounter(bucket: MergeBucket, rng: Rng, books: BookCollector): void {
  const r = rng.fork('counter');
  const { x, z, ry, w, d, h } = COUNTER;
  const base = trs(x, 0, z, 0, ry);
  const at = (m: THREE.Matrix4) => base.clone().multiply(m);
  const bodyH = h - 0.04;
  // 굽
  woodPart(bucket, r, 'walnut', bevelBox(w - 0.06, 0.08, d - 0.06, 0.006), 'x', at(trs(0, 0.04, 0)));
  // 앞면 세로 판재(+z가 손님 쪽)
  const n = 16, slw = (w - 0.04) / n;
  for (let i = 0; i < n; i++) {
    woodPart(bucket, r, 'walnut', bevelBox(slw - 0.004, bodyH - 0.08, 0.02, 0.003, 1), 'y', at(trs(-w / 2 + 0.02 + slw * (i + 0.5), 0.08 + (bodyH - 0.08) / 2, d / 2 - 0.01)), 1 + r.range(-0.06, 0.06));
  }
  for (const sx of [-1, 1]) woodPart(bucket, r, 'walnut', bevelBox(0.03, bodyH, d, 0.006), 'y', at(trs(sx * (w / 2 - 0.015), bodyH / 2, 0)));
  woodPart(bucket, r, 'walnut', bevelBox(w - 0.06, bodyH, 0.02, 0.004), 'y', at(trs(0, bodyH / 2, -d / 2 + 0.01)));
  // 상판(꿀색, 앞으로 살짝 나옴)
  woodPart(bucket, r, 'honey', bevelBox(w + 0.06, 0.04, d + 0.06, 0.012, 3), 'x', at(trs(0, h - 0.02, 0.02)));

  // 소품: 작은 화분은 plants.ts에서, 여기서는 종이봉투·영수증 꽂이·책 더미
  const top = h;
  // 종이봉투: 위쪽을 접어 구겨진 느낌
  const bag = new THREE.BoxGeometry(0.2, 0.26, 0.11, 6, 8, 3);
  const bp = bag.getAttribute('position');
  for (let i = 0; i < bp.count; i++) {
    const y = bp.getY(i);
    if (y > 0.08) {
      const k = (y - 0.08) / 0.05;
      bp.setX(i, bp.getX(i) + Math.sin(bp.getZ(i) * 60 + y * 40) * 0.006 * k);
      bp.setZ(i, bp.getZ(i) * (1 - 0.3 * k));
    }
  }
  bag.computeVertexNormals();
  bucket.add('kraft', bag, at(trs(0.5, top + 0.13, -0.05, 0, 0.25)));
  // 영수증 꽂이
  bucket.add('iron', new THREE.CylinderGeometry(0.035, 0.04, 0.012, 16), at(trs(-0.15, top + 0.006, -0.08)));
  bucket.add('iron', new THREE.CylinderGeometry(0.002, 0.002, 0.14, 6), at(trs(-0.15, top + 0.08, -0.08)));
  for (let i = 0; i < 4; i++) {
    const slip = new THREE.PlaneGeometry(0.06, 0.1);
    slip.rotateX(-Math.PI / 2 + r.range(-0.2, 0.2));
    bucket.add('paper', slip, at(trs(-0.15 + r.range(-0.01, 0.01), top + 0.04 + i * 0.02, -0.08, 0, r.range(0, Math.PI))));
  }
  stackBooks(at(trs(-0.55, top, 0.0, 0, 0.2)), r, books, 4);
  // 카드 단말기 대신 작은 장부
  bucket.add('walnut', bevelBox(0.2, 0.02, 0.28, 0.004), at(trs(0.15, top + 0.01, 0.05, 0, -0.1)), 0x3f5f4a);
}

/** 창가 벤치: 판재 좌석 + 테이퍼 다리 + 앞 가로대 + 방석 2개 + 쿠션에 기댄 책. */
export function buildBench(bucket: MergeBucket, rng: Rng, books: BookCollector): void {
  const r = rng.fork('bench');
  const { x, z, w, d, h } = BENCH;
  const at = (m: THREE.Matrix4) => trs(x, 0, z).multiply(m);
  const topT = 0.035;
  woodPart(bucket, r, 'honey', bevelBox(w, topT, d, 0.01, 3), 'x', at(trs(0, h - topT / 2, 0)));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    woodPart(bucket, r, 'honey', taperLeg(h - topT, 0.04, 0.03), 'y', at(trs(sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.05))));
  }
  woodPart(bucket, r, 'honey', bevelBox(w - 0.14, 0.05, 0.02, 0.004), 'x', at(trs(0, h - topT - 0.03, d / 2 - 0.05)));
  woodPart(bucket, r, 'honey', bevelBox(w - 0.14, 0.02, 0.02, 0.004), 'x', at(trs(0, 0.12, 0)));
  for (const sx of [-1, 1]) {
    const cushion = projectUV(bevelBox(w / 2 - 0.04, 0.06, d - 0.04, 0.025, 4), 'x', { along: 0.3, across: 0.3, offset: [r.float(), r.float()] });
    bucket.add('benchCushion', cushion, at(trs(sx * (w / 4), h + 0.03, 0, 0, r.range(-0.03, 0.03))), new THREE.Color(1, 1, 1).multiplyScalar(1 + r.range(-0.04, 0.04)));
  }
  stackBooks(at(trs(0.42, h + 0.06, -0.06, 0, 0.4)), r, books, 2);
}

/** 소파 앞 낮은 테이블: 둥근 모서리 상판 + 아래 선반 + 다리, 위에 책·찻잔. */
export function buildCoffeeTable(bucket: MergeBucket, rng: Rng, books: BookCollector): void {
  const r = rng.fork('coffee');
  const { x, z, ry, w, d, h } = COFFEE_TABLE;
  const base = trs(x, 0, z, 0, ry);
  const at = (m: THREE.Matrix4) => base.clone().multiply(m);
  woodPart(bucket, r, 'walnut', bevelBox(w, 0.035, d, 0.016, 3), 'x', at(trs(0, h - 0.0175, 0)));
  woodPart(bucket, r, 'walnut', bevelBox(w - 0.1, 0.02, d - 0.1, 0.006), 'x', at(trs(0, 0.12, 0)));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    woodPart(bucket, r, 'walnut', taperLeg(h - 0.035, 0.04, 0.028), 'y', at(trs(sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.05))));
  }
  stackBooks(at(trs(-0.32, h, 0.02, 0, 0.15)), r, books, 3);
  stackBooks(at(trs(-0.2, 0.13, 0.0, 0, -0.1)), r, books, 4);
  openBook(bucket, at(trs(0.18, h + 0.003, 0.0, 0, Math.PI + 0.25)));
  const cup = new THREE.CylinderGeometry(0.045, 0.032, 0.06, 20);
  bucket.add('ceramic', cup, at(trs(0.36, h + 0.03, -0.12)), 0xeae4d8);
  const saucer = new THREE.CylinderGeometry(0.07, 0.065, 0.008, 24);
  bucket.add('ceramic', saucer, at(trs(0.36, h + 0.004, -0.12)), 0xeae4d8);
}
