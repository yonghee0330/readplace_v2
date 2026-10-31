// 화분: Lathe 화분(테두리 말림) + 곡면 잎 여러 장. 키 큰 화분, 덤불, 늘어지는 덩굴 3종.
import * as THREE from 'three';
import { Rng } from '../../core/rng';
import { MergeBucket, leafGeometry, trs } from '../geom';

export type PlantKind = 'tall' | 'bush' | 'trail';
const GREENS = ['#4f6b3a', '#5f7d43', '#3e5a33', '#6f8a4c'];

function pot(bucket: MergeBucket, m: THREE.Matrix4, r: number, h: number, mat: 'terracotta' | 'ceramic', color: THREE.ColorRepresentation): void {
  const prof = [
    new THREE.Vector2(0.001, 0), new THREE.Vector2(r * 0.72, 0), new THREE.Vector2(r * 0.76, 0.01),
    new THREE.Vector2(r * 0.95, h * 0.85), new THREE.Vector2(r * 1.06, h * 0.86), new THREE.Vector2(r * 1.08, h),
    new THREE.Vector2(r * 0.94, h), new THREE.Vector2(r * 0.92, h * 0.9),
  ];
  bucket.add(mat, new THREE.LatheGeometry(prof, 28), m, color);
  const soil = new THREE.CircleGeometry(r * 0.92, 24);
  soil.rotateX(-Math.PI / 2);
  bucket.add('soil', soil, m.clone().multiply(trs(0, h * 0.88, 0)));
}

/** m은 화분 바닥 중앙. scale 1 = 바닥 화분 기준 크기. */
export function buildPlant(bucket: MergeBucket, rng: Rng, m: THREE.Matrix4, kind: PlantKind, scale: number): void {
  const r = rng;
  const at = (mm: THREE.Matrix4) => m.clone().multiply(mm);
  const leafColor = () => {
    const c = new THREE.Color(r.pick(GREENS));
    c.offsetHSL(r.range(-0.02, 0.02), 0, r.range(-0.04, 0.05));
    return c;
  };

  if (kind === 'tall') {
    const pr = 0.17 * scale, ph = 0.3 * scale;
    pot(bucket, m, pr, ph, 'terracotta', 0xffffff);
    const stems = 8;
    for (let i = 0; i < stems; i++) {
      const a = (i / stems) * Math.PI * 2 + r.range(-0.3, 0.3);
      const tilt = r.range(0.15, 0.5);
      const len = r.range(0.5, 0.95) * scale;
      const stem = new THREE.CylinderGeometry(0.005, 0.008, len, 5);
      stem.translate(0, len / 2, 0);
      const sm = at(trs(Math.cos(a) * pr * 0.3, ph * 0.85, Math.sin(a) * pr * 0.3, 0, -a, tilt));
      bucket.add('leaf', stem, sm, '#56703d');
      // 줄기 끝의 큰 잎(아래로 살짝 처짐)
      const leaf = leafGeometry(r.range(0.24, 0.34) * scale, r.range(0.14, 0.2) * scale, r.range(0.2, 0.45), r.range(0.15, 0.3));
      bucket.add('leaf', leaf, sm.clone().multiply(trs(0, len, 0, 0, r.range(-0.4, 0.4), -r.range(0.6, 1.2))), leafColor());
      // 중간 잎
      if (r.chance(0.7)) {
        const leaf2 = leafGeometry(r.range(0.16, 0.24) * scale, r.range(0.1, 0.14) * scale, 0.3, 0.2);
        bucket.add('leaf', leaf2, sm.clone().multiply(trs(0, len * 0.6, 0, 0, r.range(0, Math.PI * 2), r.range(0.7, 1.3))), leafColor());
      }
    }
  } else if (kind === 'bush') {
    const pr = 0.075 * scale, ph = 0.11 * scale;
    pot(bucket, m, pr, ph, 'ceramic', r.pick(['#e8e0d0', '#c9d3cf', '#d9b9a0']));
    const n = 22;
    for (let i = 0; i < n; i++) {
      const a = r.range(0, Math.PI * 2);
      const out = r.range(0.3, 1.2);
      const leaf = leafGeometry(r.range(0.07, 0.12) * scale, r.range(0.035, 0.055) * scale, r.range(0.1, 0.4), 0.25);
      bucket.add('leaf', leaf, at(trs(Math.cos(a) * pr * 0.3, ph * 0.9, Math.sin(a) * pr * 0.3, 0, -a + Math.PI / 2, 0).multiply(trs(0, 0, 0, out, 0, 0))), leafColor());
    }
  } else {
    const pr = 0.07 * scale, ph = 0.1 * scale;
    pot(bucket, m, pr, ph, 'terracotta', 0xe0c0a0);
    const vines = 5;
    for (let v = 0; v < vines; v++) {
      const a = (v / vines) * Math.PI * 2 + r.range(-0.4, 0.4);
      const len = r.range(0.15, 0.4) * scale;
      const steps = 7;
      for (let s = 0; s < steps; s++) {
        const t = s / (steps - 1);
        const rad = pr * (0.6 + t * 0.7);
        const y = ph * 0.95 + 0.03 * scale - t * t * len;
        const leaf = leafGeometry(0.05 * scale, 0.035 * scale, 0.3, 0.3);
        bucket.add('leaf', leaf, at(trs(Math.cos(a) * rad, y, Math.sin(a) * rad, 0, -a + Math.PI / 2 + r.range(-0.6, 0.6), 0).multiply(trs(0, 0, 0, r.range(0.9, 2.2), 0, 0))), leafColor());
      }
    }
  }
}
