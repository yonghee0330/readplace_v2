// 창밖: 흐린 하늘, 건물 실루엣 3겹(뒤로 갈수록 옅게), 골목 가로등, 나무 실루엣, 젖은 길, 빗줄기.
import * as THREE from 'three';
import { Rng } from '../core/rng';
import { skylineTexture, skyTexture, treeTexture } from './textures';

export interface Exterior {
  group: THREE.Group;
  update(dt: number): void;
  setRain(count: number): void;
}

export function buildExterior(rng: Rng, rainCount: number): Exterior {
  const r = rng.fork('exterior');
  const group = new THREE.Group();
  group.name = 'exterior';

  const sky = new THREE.Mesh(new THREE.PlaneGeometry(60, 26), new THREE.MeshBasicMaterial({ map: skyTexture(), color: new THREE.Color(1.5, 1.5, 1.5), fog: false }));
  sky.position.set(0, 8, -22);
  group.add(sky);

  const layers = [
    // 창 너머로 지붕선이 겹겹이 보이도록 높이를 맞춘다(가까울수록 낮고 진하게).
    { z: -18, color: '#a3a9ad', lit: 0.05, tall: 0.31, w: 44, h: 16, k: 1.0 },
    { z: -13, color: '#747a7b', lit: 0.1, tall: 0.34, w: 32, h: 12, k: 0.95 },
    { z: -8.5, color: '#454842', lit: 0.16, tall: 0.38, w: 22, h: 8.5, k: 0.9 },
  ];
  for (const l of layers) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(l.w, l.h),
      new THREE.MeshBasicMaterial({ map: skylineTexture(r.fork(`sky-${l.z}`), l.color, l.lit, l.tall), color: new THREE.Color(l.k, l.k, l.k), transparent: true, depthWrite: false }),
    );
    m.position.set(r.range(-2, 2), l.h / 2 - 0.6, l.z);
    group.add(m);
  }

  // 나무 실루엣
  for (const [x, z, s] of [[-3.9, -6.8, 3.6], [3.9, -7.4, 4.2], [-0.2, -12, 3.6]] as const) {
    const tree = new THREE.Mesh(
      new THREE.PlaneGeometry(s, s),
      new THREE.MeshBasicMaterial({ map: treeTexture(r.fork(`tree-${x}`), '#3f483e'), transparent: true, depthWrite: false }),
    );
    tree.position.set(x, s / 2 - 0.6, z);
    group.add(tree);
  }

  // 젖은 길
  const road = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshStandardMaterial({ color: 0x3b3d3c, roughness: 0.28, metalness: 0.1 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, -0.35, -13);
  group.add(road);
  // 길 건너 낮은 담
  const wall = new THREE.Mesh(new THREE.BoxGeometry(20, 1.1, 0.25), new THREE.MeshStandardMaterial({ color: 0x77736a, roughness: 0.95 }));
  wall.position.set(0, 0.2, -6.2);
  group.add(wall);

  // 골목 가로등
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 4.2, 10), new THREE.MeshStandardMaterial({ color: 0x2c2d2b, roughness: 0.6 }));
  pole.position.set(-0.9, 1.75, -5.4);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.05), pole.material);
  arm.position.set(-0.6, 3.8, -5.4);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.18, 0.12, 14), pole.material);
  head.position.set(-0.3, 3.74, -5.4);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.8, 0.5).multiplyScalar(5) }));
  glow.position.set(-0.3, 3.66, -5.4);
  group.add(pole, arm, head, glow);

  // 빗줄기: 창밖 상자 안을 떨어지는 짧은 선분
  const box = { x0: -5, x1: 5, y0: -0.4, y1: 4.5, z0: -3.5, z1: -9 };
  let drops = new Float32Array(0);
  let speeds = new Float32Array(0);
  const geom = new THREE.BufferGeometry();
  const lines = new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color: 0xc8d2da, transparent: true, opacity: 0.32, depthWrite: false }));
  lines.frustumCulled = false;
  group.add(lines);
  const rr = r.fork('rain');
  const setRain = (count: number) => {
    drops = new Float32Array(count * 6);
    speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const x = rr.range(box.x0, box.x1), y = rr.range(box.y0, box.y1), z = rr.range(box.z1, box.z0);
      drops.set([x, y, z, x + 0.01, y + 0.16, z], i * 6);
      speeds[i] = rr.range(5.5, 8);
    }
    geom.setAttribute('position', new THREE.BufferAttribute(drops, 3));
    // AO 법선 패스용(법선이 없으면 NaN)
    const normals = new Float32Array(count * 6);
    for (let i = 0; i < count * 2; i++) normals[i * 3 + 2] = 1;
    geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    lines.visible = count > 0;
  };
  setRain(rainCount);

  const update = (dt: number) => {
    if (!lines.visible) return;
    const n = speeds.length;
    for (let i = 0; i < n; i++) {
      const o = i * 6;
      let y = drops[o + 1] - speeds[i] * dt;
      if (y < box.y0) y += box.y1 - box.y0;
      drops[o + 1] = y;
      drops[o + 4] = y + 0.16;
    }
    (geom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  };

  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  return { group, update, setRain };
}
