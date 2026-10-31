// 스탠드 조명 2개, 펜던트 조명 3개. 빛 위치는 lighting.ts가 받아 쓴다.
import * as THREE from 'three';
import { MergeBucket, trs } from '../geom';
import { FLOOR_LAMPS, PENDANTS, ROOM } from '../layout';

export interface LampAnchor { kind: 'floor' | 'pendant'; position: THREE.Vector3 }

export function buildLamps(bucket: MergeBucket): LampAnchor[] {
  const anchors: LampAnchor[] = [];

  for (const l of FLOOR_LAMPS) {
    const at = (m: THREE.Matrix4) => trs(l.x, 0, l.z).multiply(m);
    bucket.add('iron', new THREE.CylinderGeometry(0.14, 0.155, 0.025, 32), at(trs(0, 0.0125, 0)));
    bucket.add('brass', new THREE.CylinderGeometry(0.035, 0.05, 0.03, 20), at(trs(0, 0.04, 0)));
    bucket.add('brass', new THREE.CylinderGeometry(0.011, 0.011, 1.38, 10), at(trs(0, 0.05 + 0.69, 0)));
    // 갓: 아래로 퍼지는 열린 원뿔, 위아래 테두리를 살짝 말아 둠
    const shadeProfile = [
      new THREE.Vector2(0.115, 0.27), new THREE.Vector2(0.12, 0.265),
      new THREE.Vector2(0.2, 0.01), new THREE.Vector2(0.205, 0.0),
    ];
    const shade = new THREE.LatheGeometry(shadeProfile, 40);
    bucket.add('lampShade', shade, at(trs(0, 1.22, 0)));
    bucket.add('brass', new THREE.TorusGeometry(0.117, 0.004, 6, 40), at(trs(0, 1.22 + 0.268, 0, Math.PI / 2)));
    bucket.add('bulb', new THREE.SphereGeometry(0.04, 16, 12), at(trs(0, 1.32, 0)));
    anchors.push({ kind: 'floor', position: new THREE.Vector3(l.x, 1.3, l.z) });
  }

  for (const p of PENDANTS) {
    const yTop = ROOM.h;
    const yShade = yTop - p.drop;
    const at = (m: THREE.Matrix4) => trs(p.x, 0, p.z).multiply(m);
    bucket.add('iron', new THREE.CylinderGeometry(0.05, 0.05, 0.02, 20), at(trs(0, yTop - 0.01, 0)));
    bucket.add('iron', new THREE.CylinderGeometry(0.004, 0.004, p.drop - 0.12, 6), at(trs(0, yShade + 0.12 + (p.drop - 0.12) / 2, 0)));
    bucket.add('brass', new THREE.CylinderGeometry(0.022, 0.026, 0.06, 16), at(trs(0, yShade + 0.11, 0)));
    // 금속 돔 갓(안쪽은 밝은 색으로 반사)
    const prof: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      prof.push(new THREE.Vector2(0.03 + Math.sin(t * Math.PI * 0.5) * 0.15, 0.11 - t * t * 0.12));
    }
    prof.push(new THREE.Vector2(0.185, -0.012));
    bucket.add('pendantShade', new THREE.LatheGeometry(prof, 40), at(trs(0, yShade, 0)));
    bucket.add('bulb', new THREE.SphereGeometry(0.045, 18, 12), at(trs(0, yShade - 0.005, 0)));
    anchors.push({ kind: 'pendant', position: new THREE.Vector3(p.x, yShade - 0.03, p.z) });
  }
  return anchors;
}
