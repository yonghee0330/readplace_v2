// 가구 밑 접지 그림자. AO가 꺼진 낮은 품질에서도 가구가 바닥에 붙어 보이게 한다.
import * as THREE from 'three';
import { MergeBucket, trs } from '../geom';
import { BENCH, CHAIRS, COFFEE_TABLE, COUNTER, FLOOR_LAMPS, FLOOR_PLANTS, ISLAND, READING_TABLE, SHELF, SHELVES, SOFA } from '../layout';

export function buildContactShadows(bucket: MergeBucket): void {
  // k(0~1)는 그림자 진하기. 판을 살짝 작게 만들어 옅은 가장자리만 남기는 식으로 조절한다.
  const add = (x: number, z: number, w: number, d: number, ry: number, k = 1) => {
    // 진한 중심부(텍스처의 75%)가 가구 바닥 면적과 비슷해지도록 판 크기를 잡는다.
    const s = 0.8 + 0.2 * k;
    const g = new THREE.PlaneGeometry((w * 1.12 + 0.3) * s, (d * 1.12 + 0.3) * s);
    g.rotateX(-Math.PI / 2);
    bucket.add('contactShadow', g, trs(x, 0.003, z, 0, ry));
  };
  const pad = 0;
  for (const s of SHELVES) add(s.x + Math.sin(s.ry) * 0.04, s.z + Math.cos(s.ry) * 0.04, s.w + pad, SHELF.d + pad, s.ry, 0.9);
  add(ISLAND.x, ISLAND.z, ISLAND.w + pad, ISLAND.d + pad, 0, 1);
  add(READING_TABLE.x, READING_TABLE.z, READING_TABLE.w + pad, READING_TABLE.d + pad, 0, 0.6);
  for (const c of CHAIRS) add(c.x, c.z, 0.62, 0.6, 0, 0.6);
  add(SOFA.x, SOFA.z, SOFA.w + pad, SOFA.d + pad, SOFA.ry, 1);
  add(COFFEE_TABLE.x, COFFEE_TABLE.z, COFFEE_TABLE.w + 0.2, COFFEE_TABLE.d + 0.2, COFFEE_TABLE.ry, 0.75);
  add(BENCH.x, BENCH.z, BENCH.w + 0.24, BENCH.d + 0.24, 0, 0.65);
  add(COUNTER.x, COUNTER.z, COUNTER.w + pad, COUNTER.d + pad, COUNTER.ry, 1);
  for (const l of FLOOR_LAMPS) add(l.x, l.z, 0.48, 0.48, 0, 0.7);
  for (const p of FLOOR_PLANTS) add(p.x, p.z, 0.55 * p.scale, 0.55 * p.scale, 0, 0.8);
}
