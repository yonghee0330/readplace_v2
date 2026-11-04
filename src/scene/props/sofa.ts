// 소파: 받침, 팔걸이, 등받이, 좌석 쿠션 3, 등 쿠션 3, 다리, 쿠션 위 담요. 러그.
import * as THREE from 'three';
import { Rng } from '../../core/rng';
import { MergeBucket, bevelBox, projectUV, taperLeg, trs } from '../geom';
import { RUG, SOFA, isPresent } from '../layout';

const fabricUV = (g: THREE.BufferGeometry, r: Rng) => projectUV(g, 'x', { along: 0.35, across: 0.35, offset: [r.float(), r.float()] });

export function buildSofa(bucket: MergeBucket, rng: Rng): void {
  if (!isPresent(SOFA) || SOFA.w < 0.1) return;
  const r = rng.fork('sofa');
  const { x, z, ry, w, d } = SOFA;
  const base = trs(x, 0, z, 0, ry);
  const at = (m: THREE.Matrix4) => base.clone().multiply(m);
  const legH = 0.1;
  const add = (g: THREE.BufferGeometry, m: THREE.Matrix4, k = 1) => bucket.add('sofa', fabricUV(g, r), at(m), new THREE.Color(k, k, k));

  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = taperLeg(legH, 0.045, 0.03);
    projectUV(leg, 'y', { offset: [r.float(), r.float()] });
    bucket.add('walnut', leg, at(trs(sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.08))));
  }
  // 받침 프레임
  add(bevelBox(w, 0.2, d, 0.03, 3), trs(0, legH + 0.1, 0), 0.92);
  // 팔걸이
  const armW = 0.17, armH = 0.42;
  for (const sx of [-1, 1]) add(bevelBox(armW, armH, d, 0.07, 4), trs(sx * (w / 2 - armW / 2), legH + armH / 2 + 0.05, 0));
  // 등받이 몸체
  add(bevelBox(w - 0.04, 0.55, 0.2, 0.06, 4), trs(0, legH + 0.2 + 0.25, -d / 2 + 0.1), 0.95);
  // 좌석 쿠션 3
  const innerW = w - 2 * armW;
  const cw = innerW / 3;
  const seatTop = legH + 0.2 + 0.15;
  for (let i = 0; i < 3; i++) {
    const cx = -innerW / 2 + cw * (i + 0.5);
    add(bevelBox(cw - 0.012, 0.15, d - 0.22, 0.055, 5), trs(cx, seatTop - 0.075, 0.09, r.range(-0.01, 0.01), r.range(-0.015, 0.015)), 1 + r.range(-0.03, 0.03));
    // 등 쿠션(뒤로 살짝 기울어짐)
    add(bevelBox(cw - 0.02, 0.4, 0.15, 0.065, 5), trs(cx, seatTop + 0.19, -d / 2 + 0.25, -0.2, r.range(-0.03, 0.03)), 1 + r.range(-0.03, 0.03));
  }
  // 담요: 오른쪽 쿠션 위에 펼쳐져 앞 모서리로 흘러내림
  bucket.add('blanket', blanket(r), at(trs(innerW / 2 - cw * 0.55, seatTop + 0.004, 0.0, 0, 0.12)));
  // 작은 쿠션(장식) 하나
  add(bevelBox(0.36, 0.34, 0.12, 0.08, 5), trs(-innerW / 2 + 0.22, seatTop + 0.17, -d / 2 + 0.37, -0.35, 0.3), 0.7);
}

/** 쿠션 위에 놓이고 앞으로 흘러내리는 담요. 로컬 원점은 쿠션 윗면 중앙. */
function blanket(r: Rng): THREE.BufferGeometry {
  const W = 0.55, segU = 16, segV = 24;
  const g = new THREE.PlaneGeometry(1, 1, segU, segV);
  const p = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  const flat = 0.42; // 쿠션 위 길이
  const edgeZ = 0.32; // 앞 모서리
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5; // 0..1
    const v = 0.5 - p.getY(i); // 0(뒤)..1(아래 끝)
    const s = v * 0.75; // 담요 길이를 따라간 거리
    const ripple = Math.sin(u * Math.PI * 5 + r.range(0, 0.3)) * 0.008 + Math.sin(u * 13) * 0.003;
    let y: number, z: number;
    if (s < flat) {
      y = 0.012 + ripple * (s / flat) + Math.sin((s / flat) * Math.PI) * 0.01;
      z = edgeZ - flat + s;
    } else {
      const a = Math.min(Math.PI / 2, (s - flat) / 0.07);
      const rr = 0.045;
      if (a < Math.PI / 2) {
        y = 0.012 - rr + Math.cos(a) * rr + ripple;
        z = edgeZ + Math.sin(a) * rr;
      } else {
        const down = s - flat - 0.07 * (Math.PI / 2);
        y = 0.012 - rr - down;
        z = edgeZ + rr + down * 0.08 + ripple * 2;
      }
    }
    p.setXYZ(i, (u - 0.5) * W + Math.sin(v * 9) * 0.01, y, z);
    uv.setXY(i, u * 2, v * 3);
  }
  g.computeVertexNormals();
  return g.toNonIndexed();
}

export function buildRug(bucket: MergeBucket): void {
  if (!isPresent(RUG) || RUG.w < 0.1) return;
  if (RUG.round) {
    const rad = Math.min(RUG.w, RUG.d) / 2;
    const top = new THREE.CircleGeometry(rad, 48);
    top.rotateX(-Math.PI / 2);
    bucket.add('rug', top, trs(RUG.x, 0.012, RUG.z));
    // 테두리 링(살짝 두툼)
    const rim = new THREE.RingGeometry(rad * 0.92, rad, 48);
    rim.rotateX(-Math.PI / 2);
    bucket.add('rug', rim, trs(RUG.x, 0.014, RUG.z));
    const edge = new THREE.CylinderGeometry(rad, rad * 0.99, 0.012, 40, 1, true);
    const uv = edge.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.005, 0.005);
    bucket.add('rug', edge, trs(RUG.x, 0.006, RUG.z));
    return;
  }
  const top = new THREE.PlaneGeometry(RUG.d, RUG.w);
  top.rotateX(-Math.PI / 2);
  top.rotateY(Math.PI / 2);
  bucket.add('rug', top, trs(RUG.x, 0.012, RUG.z));
  const edge = bevelBox(RUG.w, 0.011, RUG.d, 0.004, 1);
  const uv = edge.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.005, 0.005);
  bucket.add('rug', edge, trs(RUG.x, 0.0055, RUG.z));
}
