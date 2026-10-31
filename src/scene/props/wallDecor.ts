// 벽 장식: 손글씨 느낌 "비북스" 안내판, 액자 2개, 작은 벽시계.
import * as THREE from 'three';
import { Rng } from '../../core/rng';
import { MergeBucket, bevelBox, projectUV, trs } from '../geom';
import { COUNTER, ROOM, SHELVES, SOFA } from '../layout';

export function buildWallDecor(bucket: MergeBucket, rng: Rng): void {
  const r = rng.fork('decor');
  // 안내판: 가운데 서가 위
  const back = SHELVES[2];
  const signM = trs(back.x, 2.43, ROOM.z0 + 0.02);
  const board = bevelBox(1.02, 0.4, 0.03, 0.01, 2);
  projectUV(board, 'x', { offset: [r.float(), r.float()] });
  bucket.add('walnut', board, signM);
  const face = new THREE.PlaneGeometry(0.94, 0.3525);
  bucket.add('sign', face, signM.clone().multiply(trs(0, 0, 0.0155)));

  // 액자: 틀(꿀색 판재 4장) + 캔버스
  const frame = (m: THREE.Matrix4, w: number, h: number, mat: string) => {
    const t = 0.045, depth = 0.03;
    const part = (g: THREE.BufferGeometry, grain: 'x' | 'y', mm: THREE.Matrix4) => {
      projectUV(g, grain, { offset: [r.float(), r.float()] });
      bucket.add('honey', g, m.clone().multiply(mm));
    };
    part(bevelBox(w, t, depth, 0.006), 'x', trs(0, h / 2 - t / 2, 0));
    part(bevelBox(w, t, depth, 0.006), 'x', trs(0, -h / 2 + t / 2, 0));
    part(bevelBox(t, h - 2 * t, depth, 0.006), 'y', trs(-w / 2 + t / 2, 0, 0));
    part(bevelBox(t, h - 2 * t, depth, 0.006), 'y', trs(w / 2 - t / 2, 0, 0));
    // 매트(여백 종이) + 그림
    bucket.add('paper', new THREE.PlaneGeometry(w - 2 * t, h - 2 * t), m.clone().multiply(trs(0, 0, 0.004)), 0xf3ecdc);
    bucket.add(mat, new THREE.PlaneGeometry(w - 2 * t - 0.07, h - 2 * t - 0.09), m.clone().multiply(trs(0, 0.008, 0.006)));
  };
  // 소파 위(왼쪽 벽)
  frame(trs(ROOM.x0 + 0.02, 1.62, SOFA.z - 0.35, 0, Math.PI / 2, 0.012), 0.46, 0.58, 'painting1');
  frame(trs(ROOM.x0 + 0.02, 1.72, SOFA.z + 0.33, 0, Math.PI / 2, -0.008), 0.36, 0.46, 'painting2');
  // 계산대 뒤(오른쪽 벽)
  frame(trs(ROOM.x1 - 0.02, 1.6, COUNTER.z, 0, -Math.PI / 2, 0.006), 0.5, 0.62, 'painting2');

  // 벽시계(앞 벽)
  const clockM = trs(1.4, 2.1, ROOM.z1 - 0.02, 0, Math.PI);
  const rim = new THREE.TorusGeometry(0.15, 0.015, 10, 40);
  bucket.add('walnut', rim, clockM);
  const dial = new THREE.CircleGeometry(0.15, 40);
  bucket.add('paper', dial, clockM.clone().multiply(trs(0, 0, -0.005)), 0xf6efe0);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    bucket.add('iron', new THREE.BoxGeometry(0.006, i % 3 === 0 ? 0.025 : 0.014, 0.002), clockM.clone().multiply(trs(Math.sin(a) * 0.12, Math.cos(a) * 0.12, 0.001, 0, 0, -a)));
  }
  bucket.add('iron', new THREE.BoxGeometry(0.008, 0.08, 0.003), clockM.clone().multiply(trs(0.02, 0.03, 0.004, 0, 0, -0.9)));
  bucket.add('iron', new THREE.BoxGeometry(0.006, 0.11, 0.003), clockM.clone().multiply(trs(-0.02, 0.05, 0.006, 0, 0, 0.4)));
}
