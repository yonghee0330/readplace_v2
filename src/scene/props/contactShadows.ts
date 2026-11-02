// 가구·서가 발밑의 아주 옅은 접촉 그림자(머지드 쿼드). 실내 그림자를 보조한다.
import * as THREE from 'three';
import { MergeBucket, trs } from '../geom';
import {
  BAR_TABLE, BENCH, CHAIRS, COFFEE_TABLE, COUNTER, FLOOR_LAMPS, FLOOR_PLANTS, ISLANDS,
  READING_TABLE, SEMINAR_CHAIRS, SEMINAR_TABLE, SHELF, SHELVES, SOFA, SOLO_CHAIR,
  SOLO_DESK, STAGE, STORE_CHAIRS, STORE_TABLE, THEATER, isPresent,
} from '../layout';

export function buildContactShadows(bucket: MergeBucket): void {
  const add = (x: number, z: number, w: number, d: number, ry: number, opacity = 0.85) => {
    if (w < 0.05 || d < 0.05) return;
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    bucket.add('contactShadow', g, trs(x, 0.003, z, 0, ry), new THREE.Color(opacity, opacity, opacity));
  };
  const pad = 0.06;
  for (const s of SHELVES) add(s.x + Math.sin(s.ry) * 0.04, s.z + Math.cos(s.ry) * 0.04, s.w + pad, SHELF.d + pad, s.ry, 0.9);
  for (const isl of ISLANDS) add(isl.x, isl.z, isl.w + pad, isl.d + pad, isl.ry, 0.88);
  if (isPresent(READING_TABLE)) add(READING_TABLE.x, READING_TABLE.z, READING_TABLE.w + pad, READING_TABLE.d + pad, 0, 0.85);
  if (isPresent(STORE_TABLE)) add(STORE_TABLE.x, STORE_TABLE.z, STORE_TABLE.w + pad, STORE_TABLE.d + pad, 0, 0.88);
  if (isPresent(SEMINAR_TABLE)) add(SEMINAR_TABLE.x, SEMINAR_TABLE.z, SEMINAR_TABLE.w + pad, SEMINAR_TABLE.d + pad, 0, 0.88);
  if (isPresent(SOLO_DESK)) add(SOLO_DESK.x, SOLO_DESK.z, SOLO_DESK.w + pad, SOLO_DESK.d + pad, 0, 0.8);
  if (isPresent(COUNTER)) add(COUNTER.x, COUNTER.z, COUNTER.w + pad, COUNTER.d + pad, COUNTER.ry, 0.9);
  if (isPresent(SOFA)) add(SOFA.x, SOFA.z, SOFA.w + pad, SOFA.d + pad, SOFA.ry, 0.9);
  if (isPresent(BENCH)) add(BENCH.x, BENCH.z, BENCH.w + pad, BENCH.d + pad, 0, 0.8);
  if (isPresent(BAR_TABLE)) add(BAR_TABLE.x, BAR_TABLE.z, BAR_TABLE.w + pad, BAR_TABLE.d + pad, 0, 0.85);
  if (isPresent(COFFEE_TABLE)) add(COFFEE_TABLE.x, COFFEE_TABLE.z, COFFEE_TABLE.w + pad, COFFEE_TABLE.d + pad, COFFEE_TABLE.ry, 0.75);
  if (isPresent(STAGE)) add(STAGE.x, STAGE.z, STAGE.w + pad, STAGE.d + pad, 0, 0.7);
  if (isPresent(THEATER) && THEATER.rows > 0) {
    add(THEATER.x, THEATER.z, THEATER.cols * THEATER.seatW + 0.4, THEATER.rows * THEATER.rowDepth + 0.3, THEATER.ry, 0.75);
  }
  for (const c of [...CHAIRS, ...STORE_CHAIRS, ...SEMINAR_CHAIRS, ...(isPresent(SOLO_CHAIR) ? [SOLO_CHAIR] : [])]) {
    add(c.x, c.z, 0.4, 0.4, 0, 0.7);
  }
  for (const l of FLOOR_LAMPS) add(l.x, l.z, 0.35, 0.35, 0, 0.65);
  for (const p of FLOOR_PLANTS) add(p.x, p.z, 0.4 * p.scale, 0.4 * p.scale, 0, 0.6);
}
