// 벽 간판·액자·시계. 허브에서만 풍성하게, 서브룸은 간판만.
import * as THREE from 'three';
import { Rng } from '../../core/rng';
import { MergeBucket, bevelBox, projectUV, trs } from '../geom';
import { ROOM, currentSpaceId } from '../layout';

export function buildWallDecor(bucket: MergeBucket, rng: Rng): void {
  const r = rng.fork('decor');
  const signM = trs(-ROOM.w * 0.22, 2.48, ROOM.z0 + 0.02);
  const sign = bevelBox(0.9, 0.28, 0.04, 0.008);
  projectUV(sign, 'x', { offset: [r.float(), r.float()] });
  bucket.add('walnut', sign, signM);
  bucket.add('paper', bevelBox(0.78, 0.18, 0.01, 0.002), signM.clone().multiply(trs(0, 0, 0.025)), 0xf4ead8);

  if (currentSpaceId() !== 'hub') return;

  const frame = (m: THREE.Matrix4, w: number, h: number, mat: string) => {
    bucket.add('walnut', bevelBox(w + 0.04, h + 0.04, 0.03, 0.004), m);
    bucket.add(mat, bevelBox(w, h, 0.01, 0.002), m.clone().multiply(trs(0, 0, 0.02)));
  };
  frame(trs(ROOM.x0 + 0.02, 1.65, 1.8, 0, Math.PI / 2), 0.46, 0.58, 'painting1');
  frame(trs(ROOM.x1 - 0.02, 1.6, -0.4, 0, -Math.PI / 2), 0.5, 0.62, 'painting2');
  const clockM = trs(ROOM.w * 0.15, 2.15, ROOM.z1 - 0.02, 0, Math.PI);
  bucket.add('walnut', new THREE.CylinderGeometry(0.16, 0.16, 0.04, 24), clockM);
  bucket.add('paper', new THREE.CircleGeometry(0.13, 24), clockM.clone().multiply(trs(0, 0, 0.025)));
}
