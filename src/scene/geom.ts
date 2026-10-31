// 공용 지오메트리 헬퍼와 재질별 병합 버킷.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Axis = 'x' | 'y' | 'z';

/** 모서리를 둥글린 판재. 중심 기준. r은 m 단위 베벨. */
export function bevelBox(w: number, h: number, d: number, r: number, seg = 2): THREE.BufferGeometry {
  const rr = Math.max(0.0005, Math.min(r, Math.min(w, h, d) / 2 - 0.0005));
  return new RoundedBoxGeometry(w, h, d, seg, rr);
}

/**
 * 박스 투영 UV. 면 방향에 따라 평면 좌표를 쓰되, grain 축이 있는 면에서는 u가 결 방향을 따른다.
 * 결 1m = u 1, 결 직각 0.5m = v 1 (woodTexture 기준).
 */
export function projectUV(g: THREE.BufferGeometry, grain: Axis, opts: { along?: number; across?: number; offset?: [number, number] } = {}): THREE.BufferGeometry {
  const along = opts.along ?? 1, across = opts.across ?? 0.5;
  const [ou, ov] = opts.offset ?? [0, 0];
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  const axes: Axis[] = ['x', 'y', 'z'];
  const get = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, i: number, ax: Axis) =>
    ax === 'x' ? a.getX(i) : ax === 'y' ? a.getY(i) : a.getZ(i);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    const normalAxis: Axis = nx >= ny && nx >= nz ? 'x' : ny >= nz ? 'y' : 'z';
    const inPlane = axes.filter((a) => a !== normalAxis);
    let uAx: Axis, vAx: Axis;
    if (normalAxis === grain) {
      // 나무 단면: 결 무늬를 촘촘한 링처럼 보이게
      [uAx, vAx] = inPlane;
    } else {
      uAx = grain;
      vAx = inPlane.find((a) => a !== grain)!;
    }
    uv[i * 2] = get(pos, i, uAx) / along + ou;
    uv[i * 2 + 1] = get(pos, i, vAx) / across + ov;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** 정점 색을 한 색으로 채운다. 병합 시 같은 재질 안에서 색조 차이를 낸다. */
export function tint(g: THREE.BufferGeometry, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** 위가 가늘고 아래가 더 가는 테이퍼 다리(사각). 높이 h, 위 폭 top, 아래 폭 bottom. 바닥이 y=0. */
export function taperLeg(h: number, top: number, bottom: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(top / Math.SQRT2, bottom / Math.SQRT2, h, 4, 1);
  g.rotateY(Math.PI / 4);
  g.translate(0, h / 2, 0);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

/** 곡면 잎. 길이 len, 폭 wid. 중심맥을 따라 접고 길이 방향으로 휜다. 밑동이 원점, +y로 자란다. */
export function leafGeometry(len: number, wid: number, bend: number, fold: number): THREE.BufferGeometry {
  const segL = 6, segW = 2;
  const g = new THREE.PlaneGeometry(1, 1, segW, segL);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i); // -0.5..0.5
    const t = p.getY(i) + 0.5; // 0..1 (밑동→끝)
    const width = Math.sin(Math.PI * Math.pow(t, 0.8)) * wid * (1 - t * 0.25);
    const px = x * 2 * width * 0.5;
    const pz = Math.abs(x) * 2 * fold * width - bend * t * t * len;
    p.setXYZ(i, px, t * len * (1 - bend * 0.3 * t), pz);
  }
  g.computeVertexNormals();
  return g;
}

/** 나무·패브릭 등을 재질 이름별로 모았다가 한 번에 병합한다(재질 하나 = 드로우콜 하나). */
export class MergeBucket {
  private parts = new Map<string, THREE.BufferGeometry[]>();

  add(material: string, geom: THREE.BufferGeometry, matrix?: THREE.Matrix4, color: THREE.ColorRepresentation = 0xffffff): void {
    let g = geom.index ? geom.toNonIndexed() : geom.clone();
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    if (!g.getAttribute('color')) tint(g, color);
    for (const name of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
    }
    g.morphAttributes = {};
    g.clearGroups();
    if (matrix) g.applyMatrix4(matrix);
    const list = this.parts.get(material) ?? [];
    list.push(g);
    this.parts.set(material, list);
  }

  build(materials: Record<string, THREE.Material>, opts: { castShadow?: (name: string) => boolean } = {}): THREE.Group {
    const group = new THREE.Group();
    for (const [name, list] of this.parts) {
      const mat = materials[name];
      if (!mat) throw new Error(`재질 없음: ${name}`);
      const merged = mergeGeometries(list, false);
      if (!merged) throw new Error(`병합 실패: ${name}`);
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = `merged:${name}`;
      mesh.castShadow = opts.castShadow ? opts.castShadow(name) : true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      list.forEach((g) => g.dispose());
    }
    this.parts.clear();
    return group;
  }
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
/** 위치·회전(라디안)·크기로 행렬을 만든다. */
export function trs(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  return _m.clone().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
