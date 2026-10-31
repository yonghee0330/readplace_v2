// 벽 서가: 측판·선반 판재 두께 2cm, 베벨, 선반 5단, 뒤판(세로 판재), 받침, 상판 몰딩.
import * as THREE from 'three';
import { Rng } from '../../core/rng';
import { MergeBucket, bevelBox, projectUV, trs } from '../geom';
import { SHELF, SHELVES } from '../layout';

/** 책을 꽂을 칸. matrix는 칸 왼쪽 아래(선반 윗면, 깊이 중앙) 기준 로컬→월드. */
export interface Compartment { matrix: THREE.Matrix4; width: number; height: number; depth: number }

export function buildShelves(bucket: MergeBucket, rng: Rng): Compartment[] {
  const comps: Compartment[] = [];
  SHELVES.forEach((s, idx) => {
    const r = rng.fork(`shelf-${idx}`);
    const base = trs(s.x, 0, s.z, 0, s.ry);
    const { h, d, board: b, levels, plinth } = SHELF;
    const w = s.w;
    const tintK = 1 + r.range(-0.04, 0.04);
    const tintC = new THREE.Color(tintK, tintK, tintK);
    const add = (g: THREE.BufferGeometry, grain: 'x' | 'y' | 'z', m: THREE.Matrix4, mat = 'medium', color: THREE.Color = tintC) => {
      projectUV(g, grain, { offset: [r.float(), r.float()] });
      bucket.add(mat, g, base.clone().multiply(m), color);
    };

    const topCapH = 0.035;
    const bodyH = h - topCapH;
    // 측판
    for (const sx of [-1, 1]) add(bevelBox(b, bodyH, d, 0.004), 'y', trs(sx * (w / 2 - b / 2), bodyH / 2, 0));
    // 선반 판재: 바닥판 + 중간 4장 + 윗판
    const innerW = w - 2 * b;
    const yBottom = plinth;
    const yTop = bodyH - b;
    const gap = (yTop - (yBottom + b) - (levels - 1) * b) / levels;
    const boardYs: number[] = [yBottom];
    for (let i = 1; i < levels; i++) boardYs.push(yBottom + b + i * gap + (i - 1) * b);
    boardYs.push(yTop);
    boardYs.forEach((y, i) => {
      const inset = i === 0 || i === boardYs.length - 1 ? 0 : 0.012;
      // 가운데가 아주 살짝 처진 선반(1~2mm)은 생략하고, 앞 모서리 베벨로 두께감을 준다.
      add(bevelBox(innerW + 0.004, b, d - 0.012 - inset, 0.004), 'x', trs(0, y + b / 2, 0.006 - inset / 2));
    });
    // 상판 몰딩
    add(bevelBox(w + 0.04, topCapH, d + 0.03, 0.01), 'x', trs(0, bodyH + topCapH / 2, 0.012));
    // 받침(걸레받이처럼 살짝 들어감)
    add(bevelBox(innerW, plinth, 0.02, 0.004), 'x', trs(0, plinth / 2, d / 2 - 0.03));
    // 뒤판: 세로 판재 여러 장(짙은 월넛)
    add(new THREE.PlaneGeometry(innerW, bodyH - plinth), 'y', trs(0, plinth + (bodyH - plinth) / 2, -d / 2 - 0.001), 'subfloor');
    const nBack = Math.max(3, Math.round(innerW / 0.2));
    const bw = innerW / nBack;
    for (let i = 0; i < nBack; i++) {
      const k = 1 + r.range(-0.06, 0.06);
      add(bevelBox(bw - 0.003, bodyH - plinth, 0.01, 0.002, 1), 'y', trs(-innerW / 2 + bw * (i + 0.5), plinth + (bodyH - plinth) / 2, -d / 2 + 0.005), 'walnut', new THREE.Color(k, k, k));
    }

    for (let i = 0; i < levels; i++) {
      const y = boardYs[i] + b;
      const height = boardYs[i + 1] - y;
      comps.push({
        matrix: base.clone().multiply(trs(-innerW / 2, y, 0.006)),
        width: innerW,
        height,
        depth: d - 0.02,
      });
    }
  });
  return comps;
}
