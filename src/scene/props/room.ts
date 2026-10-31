// 방 껍데기: 마루 널, 벽(창·문 구멍), 나무 징두리 판, 걸레받이, 천장과 보.
import * as THREE from 'three';
import { Rng } from '../../core/rng';
import { MergeBucket, bevelBox, projectUV, trs } from '../geom';
import { BACK_OPENINGS, ROOM, WAINSCOT_H } from '../layout';

const WALL_T = 0.2;

export function buildFloor(bucket: MergeBucket, rng: Rng): number {
  const r = rng.fork('floor');
  const plankW = 0.12, gap = 0.0025, plankH = 0.022;
  let count = 0;
  const rows = Math.round(ROOM.d / plankW);
  for (let j = 0; j < rows; j++) {
    const z = ROOM.z0 + plankW * (j + 0.5);
    let x = ROOM.x0 - r.range(0, 0.9);
    while (x < ROOM.x1) {
      const len = r.range(0.7, 1.5);
      const xa = Math.max(x, ROOM.x0), xb = Math.min(x + len, ROOM.x1);
      const l = xb - xa - gap;
      if (l > 0.05) {
        const g = bevelBox(l, plankH, plankW - gap, 0.0025, 1);
        projectUV(g, 'x', { along: 1.0, across: 0.5, offset: [r.float(), r.float()] });
        const k = 1 + r.range(-0.05, 0.05);
        const warm = r.range(-0.02, 0.02);
        const color = new THREE.Color(k + warm, k, k - warm);
        bucket.add('floor', g, trs((xa + xb) / 2, -plankH / 2, z), color);
        count++;
      }
      x += len;
    }
  }
  // 널 사이 틈으로 보이는 어두운 밑판
  const sub = new THREE.PlaneGeometry(ROOM.w, ROOM.d);
  sub.rotateX(-Math.PI / 2);
  bucket.add('subfloor', sub, trs(0, -plankH + 0.001, 0));
  return count;
}

/** 구멍 뚫린 벽 한 장(로컬 xy 평면, +z를 바라봄). */
function wallWithHoles(width: number, height: number, holes: { x0: number; x1: number; y0: number; y1: number }[]): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-width / 2, 0);
  s.lineTo(width / 2, 0);
  s.lineTo(width / 2, height);
  s.lineTo(-width / 2, height);
  s.closePath();
  for (const h of holes) {
    const p = new THREE.Path();
    p.moveTo(h.x0, h.y0);
    p.lineTo(h.x0, h.y1);
    p.lineTo(h.x1, h.y1);
    p.lineTo(h.x1, h.y0);
    p.closePath();
    s.holes.push(p);
  }
  return new THREE.ShapeGeometry(s, 1);
}

interface WallDef { matrix: THREE.Matrix4; length: number; holes: { x0: number; x1: number; y0: number; y1: number }[] }

function wallDefs(): WallDef[] {
  const H = ROOM.h;
  return [
    // 뒤 벽(창 2 + 문), +z를 바라봄. 로컬 x = 월드 x
    { matrix: trs(0, 0, ROOM.z0), length: ROOM.w, holes: BACK_OPENINGS.map((o) => ({ x0: o.cx - o.w / 2, x1: o.cx + o.w / 2, y0: o.y0, y1: o.y1 })) },
    // 앞 벽, -z를 바라봄
    { matrix: trs(0, 0, ROOM.z1, 0, Math.PI), length: ROOM.w, holes: [] },
    // 왼쪽 벽, +x를 바라봄. 로컬 x = 월드 -z... (회전 +90°)
    { matrix: trs(ROOM.x0, 0, 0, 0, Math.PI / 2), length: ROOM.d, holes: [] },
    // 오른쪽 벽, -x를 바라봄
    { matrix: trs(ROOM.x1, 0, 0, 0, -Math.PI / 2), length: ROOM.d, holes: [] },
  ].map((w) => ({ ...w, holes: w.holes.filter(() => H > 0) }));
}

export function buildWalls(bucket: MergeBucket, rng: Rng): void {
  const r = rng.fork('walls');
  for (const w of wallDefs()) {
    const g = wallWithHoles(w.length, ROOM.h, w.holes);
    projectUV(g, 'x', { along: 2.2, across: 2.2, offset: [r.float(), r.float()] });
    bucket.add('plaster', g, w.matrix);
    // 바깥면(그림자용 두께)
    const back = wallWithHoles(w.length, ROOM.h, w.holes);
    back.rotateY(Math.PI);
    back.translate(0, 0, -WALL_T);
    bucket.add('plaster', back, w.matrix, 0x9a9080);

    // 징두리 판: 세로 판재, 문 구간은 건너뜀
    const boardW = 0.1, gap = 0.003, t = 0.014, bh = WAINSCOT_H - 0.05 - 0.1;
    // 판재 틈으로 흰 벽이 비치지 않게 어두운 받침판을 깐다.
    const backer = new THREE.PlaneGeometry(w.length, bh);
    bucket.add('subfloor', backer, w.matrix.clone().multiply(trs(0, 0.1 + bh / 2, 0.002)));
    const doorHoles = w.holes.filter((h) => h.y0 < 0.01);
    for (let x = -w.length / 2 + boardW / 2; x < w.length / 2; x += boardW) {
      if (doorHoles.some((h) => x > h.x0 - 0.06 && x < h.x1 + 0.06)) continue;
      const g2 = bevelBox(boardW - gap, bh, t, 0.003, 1);
      projectUV(g2, 'y', { along: 1, across: 0.5, offset: [r.float(), r.float()] });
      const k = 1 + r.range(-0.04, 0.04);
      const m = w.matrix.clone().multiply(trs(x, 0.1 + bh / 2, t / 2));
      bucket.add('medium', g2, m, new THREE.Color(k, k, k));
    }
    // 걸레받이와 상단 몰딩: 문 구간을 피해 잘라 놓는다
    const segs = splitAround(-w.length / 2, w.length / 2, doorHoles.map((h) => [h.x0 - 0.06, h.x1 + 0.06]));
    for (const [a, b] of segs) {
      const len = b - a;
      if (len < 0.05) continue;
      const base = bevelBox(len, 0.1, 0.022, 0.004, 1);
      projectUV(base, 'x', { offset: [r.float(), r.float()] });
      bucket.add('walnut', base, w.matrix.clone().multiply(trs((a + b) / 2, 0.05, 0.011)));
      const cap = bevelBox(len, 0.05, 0.035, 0.008, 2);
      projectUV(cap, 'x', { offset: [r.float(), r.float()] });
      bucket.add('walnut', cap, w.matrix.clone().multiply(trs((a + b) / 2, WAINSCOT_H - 0.025, 0.0175)));
    }
  }

  // 창·문 개구부 안쪽 면(벽 두께)
  for (const o of BACK_OPENINGS) {
    const x0 = o.cx - o.w / 2, x1 = o.cx + o.w / 2;
    const h = o.y1 - o.y0;
    const side = new THREE.BoxGeometry(0.02, h, WALL_T);
    bucket.add('plaster', side.clone(), trs(x0 - 0.01, o.y0 + h / 2, ROOM.z0 - WALL_T / 2));
    bucket.add('plaster', side, trs(x1 + 0.01, o.y0 + h / 2, ROOM.z0 - WALL_T / 2));
    const top = new THREE.BoxGeometry(o.w + 0.04, 0.02, WALL_T);
    bucket.add('plaster', top, trs(o.cx, o.y1 + 0.01, ROOM.z0 - WALL_T / 2));
  }
}

function splitAround(a: number, b: number, cuts: number[][]): [number, number][] {
  const out: [number, number][] = [];
  let cur = a;
  for (const [c0, c1] of cuts.sort((p, q) => p[0] - q[0])) {
    if (c0 > cur) out.push([cur, Math.min(c0, b)]);
    cur = Math.max(cur, c1);
  }
  if (cur < b) out.push([cur, b]);
  return out;
}

export function buildCeiling(bucket: MergeBucket, rng: Rng): void {
  const r = rng.fork('ceiling');
  const g = new THREE.PlaneGeometry(ROOM.w, ROOM.d);
  g.rotateX(Math.PI / 2);
  projectUV(g, 'x', { along: 2.2, across: 2.2 });
  bucket.add('ceiling', g, trs(0, ROOM.h, 0));
  // 보: z 방향으로 가로지른다
  for (const x of [-2.75, 0.3, 2.95]) {
    const beam = bevelBox(0.14, 0.17, ROOM.d, 0.01, 2);
    projectUV(beam, 'z', { along: 1.2, across: 0.5, offset: [r.float(), r.float()] });
    bucket.add('walnut', beam, trs(x, ROOM.h - 0.085, 0));
  }
}
