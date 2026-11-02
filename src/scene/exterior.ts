// 창밖: 하늘·실루엣·가로등·나무, 날씨에 따라 비·눈·맑음 연출.
import * as THREE from 'three';
import { Rng } from '../core/rng';
import type { WeatherKind } from '../weather/bucheon';
import { skylineTexture, skyTexture, treeTexture } from './textures';

export interface Exterior {
  group: THREE.Group;
  update(dt: number): void;
  /** @deprecated setWeather 사용 */
  setRain(count: number): void;
  setWeather(kind: WeatherKind, particleBudget: number): void;
}

export function buildExterior(rng: Rng, rainCount: number): Exterior {
  const r = rng.fork('exterior');
  const group = new THREE.Group();
  group.name = 'exterior';

  const skyMat = new THREE.MeshBasicMaterial({ map: skyTexture(), color: new THREE.Color(1.5, 1.5, 1.5), fog: false });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(60, 26), skyMat);
  sky.position.set(0, 8, -22);
  group.add(sky);

  const layers = [
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

  for (const [x, z, s] of [[-3.9, -6.8, 3.6], [3.9, -7.4, 4.2], [-0.2, -12, 3.6]] as const) {
    const tree = new THREE.Mesh(
      new THREE.PlaneGeometry(s, s),
      new THREE.MeshBasicMaterial({ map: treeTexture(r.fork(`tree-${x}`), '#3f483e'), transparent: true, depthWrite: false }),
    );
    tree.position.set(x, s / 2 - 0.6, z);
    group.add(tree);
  }

  const road = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshStandardMaterial({ color: 0x3b3d3c, roughness: 0.28, metalness: 0.1 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, -0.35, -13);
  group.add(road);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(20, 1.1, 0.25), new THREE.MeshStandardMaterial({ color: 0x77736a, roughness: 0.95 }));
  wall.position.set(0, 0.2, -6.2);
  group.add(wall);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 4.2, 10), new THREE.MeshStandardMaterial({ color: 0x2c2d2b, roughness: 0.6 }));
  pole.position.set(-0.9, 1.75, -5.4);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.05), pole.material);
  arm.position.set(-0.6, 3.8, -5.4);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.18, 0.12, 14), pole.material);
  head.position.set(-0.3, 3.74, -5.4);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.8, 0.5).multiplyScalar(5) }));
  glow.position.set(-0.3, 3.66, -5.4);
  group.add(pole, arm, head, glow);

  const box = { x0: -5, x1: 5, y0: -0.4, y1: 4.5, z0: -3.5, z1: -9 };
  let mode: WeatherKind | 'off' = 'off';
  let drops = new Float32Array(0);
  let speeds = new Float32Array(0);
  let drifts = new Float32Array(0);
  const geom = new THREE.BufferGeometry();
  const lineMat = new THREE.LineBasicMaterial({ color: 0xc8d2da, transparent: true, opacity: 0.32, depthWrite: false });
  const lines = new THREE.LineSegments(geom, lineMat);
  lines.frustumCulled = false;
  group.add(lines);
  const rr = r.fork('rain');

  const fillRain = (count: number) => {
    drops = new Float32Array(count * 6);
    speeds = new Float32Array(count);
    drifts = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const x = rr.range(box.x0, box.x1), y = rr.range(box.y0, box.y1), z = rr.range(box.z1, box.z0);
      drops.set([x, y, z, x + 0.01, y + 0.16, z], i * 6);
      speeds[i] = rr.range(5.5, 8);
      drifts[i] = 0;
    }
  };

  const fillSnow = (count: number) => {
    drops = new Float32Array(count * 6);
    speeds = new Float32Array(count);
    drifts = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const x = rr.range(box.x0, box.x1), y = rr.range(box.y0, box.y1), z = rr.range(box.z1, box.z0);
      const s = rr.range(0.04, 0.09);
      drops.set([x, y, z, x + s, y + s * 0.6, z], i * 6);
      speeds[i] = rr.range(0.55, 1.35);
      drifts[i] = rr.range(-0.35, 0.35);
    }
  };

  const applyGeom = () => {
    geom.setAttribute('position', new THREE.BufferAttribute(drops, 3));
    const normals = new Float32Array(drops.length);
    for (let i = 0; i < drops.length / 3; i++) normals[i * 3 + 2] = 1;
    geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  };

  const setWeather = (kind: WeatherKind, particleBudget: number) => {
    mode = kind;
    // 하늘 톤
    if (kind === 'clear') skyMat.color.setRGB(1.85, 1.75, 1.55);
    else if (kind === 'snow') skyMat.color.setRGB(1.65, 1.7, 1.78);
    else skyMat.color.setRGB(1.5, 1.5, 1.5);

    // 길 반사(비·눈은 젖은 느낌, 맑음은 덜 반짝)
    const roadMat = road.material as THREE.MeshStandardMaterial;
    if (kind === 'clear') {
      roadMat.roughness = 0.72;
      roadMat.metalness = 0.02;
      roadMat.color.setHex(0x4a4c49);
    } else if (kind === 'snow') {
      roadMat.roughness = 0.45;
      roadMat.metalness = 0.06;
      roadMat.color.setHex(0x5a5e62);
    } else {
      roadMat.roughness = 0.28;
      roadMat.metalness = 0.1;
      roadMat.color.setHex(0x3b3d3c);
    }

    if (kind === 'clear' || particleBudget <= 0) {
      drops = new Float32Array(0);
      speeds = new Float32Array(0);
      drifts = new Float32Array(0);
      applyGeom();
      lines.visible = false;
      return;
    }

    if (kind === 'snow') {
      fillSnow(Math.max(40, Math.floor(particleBudget * 0.7)));
      lineMat.color.setHex(0xeef3f8);
      lineMat.opacity = 0.55;
    } else {
      fillRain(particleBudget);
      lineMat.color.setHex(0xc8d2da);
      lineMat.opacity = 0.32;
    }
    applyGeom();
    lines.visible = true;
  };

  const setRain = (count: number) => setWeather(count > 0 ? 'rain' : 'clear', count);

  setWeather(rainCount > 0 ? 'rain' : 'clear', rainCount);

  let tAcc = 0;
  const update = (dt: number) => {
    if (!lines.visible || mode === 'clear' || mode === 'off') return;
    tAcc += dt;
    const n = speeds.length;
    for (let i = 0; i < n; i++) {
      const o = i * 6;
      let y = drops[o + 1] - speeds[i] * dt;
      let x = drops[o];
      if (mode === 'snow') {
        x += Math.sin(tAcc * 1.2 + i * 0.37) * drifts[i] * dt;
        if (x < box.x0) x = box.x1;
        if (x > box.x1) x = box.x0;
      }
      if (y < box.y0) {
        y += box.y1 - box.y0;
        x = rr.range(box.x0, box.x1);
      }
      const lenY = mode === 'snow' ? drops[o + 4] - drops[o + 1] : 0.16;
      const lenX = mode === 'snow' ? drops[o + 3] - drops[o] : 0.01;
      drops[o] = x;
      drops[o + 1] = y;
      drops[o + 3] = x + lenX;
      drops[o + 4] = y + lenY;
    }
    (geom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  };

  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  return { group, update, setRain, setWeather };
}
