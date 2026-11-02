// 조명: 창 방향 키라이트(그림자), 실내 전구, 반구광, 바닥의 창빛 패치, 약한 환경 반사.
// 부천 날씨(비·눈·맑음)에 따라 창빛 색·세기를 살짝 바꾼다.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { QualityProfile } from '../core/quality';
import type { WeatherKind } from '../weather/bucheon';
import { BACK_OPENINGS, ROOM } from './layout';
import type { LampAnchor } from './props/lamps';
import { windowLightTexture } from './textures';

/** 빛이 나아가는 방향(창 밖 위쪽 → 방 안 아래쪽). */
export const KEY_DIR = new THREE.Vector3(0.32, -0.78, 1).normalize();

export interface Lighting {
  group: THREE.Group;
  applyQuality(q: QualityProfile): void;
  setWeather(kind: WeatherKind): void;
}

export function buildLighting(renderer: THREE.WebGLRenderer, scene: THREE.Scene, lamps: LampAnchor[], q: QualityProfile): Lighting {
  const group = new THREE.Group();
  group.name = 'lighting';

  // 흐린 비 오는 날의 창빛: 차분한 흰빛
  const key = new THREE.DirectionalLight(0xe9edf0, 2.4);
  const target = new THREE.Object3D();
  target.position.set(0, 0, 0);
  key.target = target;
  key.position.copy(KEY_DIR).multiplyScalar(-14);
  key.shadow.camera.left = -6.5;
  key.shadow.camera.right = 6.5;
  key.shadow.camera.top = 6.5;
  key.shadow.camera.bottom = -6.5;
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 30;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.025;
  key.shadow.radius = 3;
  group.add(key, target);

  // 실내 전구(2700K 느낌)
  const warm = 0xffb873;
  const points: THREE.PointLight[] = [];
  for (const l of lamps) {
    const p = new THREE.PointLight(warm, l.kind === 'floor' ? 1.4 : 1.5, 0, 2);
    p.position.copy(l.position);
    points.push(p);
    group.add(p);
  }
  // 그림자 담당 실내 광원: 평대 위 펜던트에서 아래로 비추는 SpotLight(PointLight 그림자는 6면이라 비용 6배)
  const islandPendant = lamps.find((l) => l.kind === 'pendant')!;
  const spot = new THREE.SpotLight(warm, 9, 0, 1.05, 0.85, 2);
  spot.position.copy(islandPendant.position).add(new THREE.Vector3(0.45, 0.02, 0));
  spot.target.position.set(spot.position.x, 0, spot.position.z);
  spot.shadow.bias = -0.0006;
  spot.shadow.normalBias = 0.02;
  spot.shadow.camera.near = 0.2;
  spot.shadow.camera.far = 4;
  group.add(spot, spot.target);

  const hemi = new THREE.HemisphereLight(0xf2e1c4, 0x4f3622, 0.65);
  group.add(hemi);

  // 바닥의 창 모양 밝은 영역: 창 네 모서리를 빛 방향으로 바닥에 투영한 평행사변형
  const patchTex = windowLightTexture(3, 2);
  const patchMat = new THREE.MeshBasicMaterial({
    color: 0xdde6ee, alphaMap: patchTex, transparent: true, opacity: 0.22,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: true,
  });
  const patches: THREE.Mesh[] = [];
  for (const o of BACK_OPENINGS.filter((o) => o.kind === 'window')) {
    const corners = [
      [o.cx - o.w / 2, o.y0], [o.cx + o.w / 2, o.y0], [o.cx - o.w / 2, o.y1], [o.cx + o.w / 2, o.y1],
    ].map(([x, y]) => {
      const t = y / -KEY_DIR.y;
      return new THREE.Vector3(x + KEY_DIR.x * t, 0.004, ROOM.z0 + KEY_DIR.z * t);
    });
    const g = new THREE.BufferGeometry();
    // 창 아래쪽이 벽 가까이, 위쪽이 방 안쪽에 닿는다. uv의 v는 창 높이 방향.
    g.setAttribute('position', new THREE.Float32BufferAttribute(corners.flatMap((c) => [c.x, c.y, c.z]), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    // 법선이 없으면 AO 법선 패스에서 NaN이 나와 Bloom이 화면 전체를 검게 번지게 한다.
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    const m = new THREE.Mesh(g, patchMat);
    m.renderOrder = 1;
    m.name = 'window-light';
    patches.push(m);
    group.add(m);
  }

  // 아주 약한 환경 반사(나무 니스·유리·금속이 죽지 않게)
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.18;
  pmrem.dispose();

  let lastQ = q;
  let weather: WeatherKind = 'rain';

  const tintForWeather = () => {
    if (weather === 'clear') {
      key.color.setHex(0xfff2d8);
      hemi.color.setHex(0xfff6e8);
      hemi.groundColor.setHex(0x5a4030);
      patchMat.color.setHex(0xffe8c4);
    } else if (weather === 'snow') {
      key.color.setHex(0xe8eef5);
      hemi.color.setHex(0xe8eef4);
      hemi.groundColor.setHex(0x4a4550);
      patchMat.color.setHex(0xdde6f0);
    } else {
      key.color.setHex(0xe9edf0);
      hemi.color.setHex(0xf2e1c4);
      hemi.groundColor.setHex(0x4f3622);
      patchMat.color.setHex(0xdde6ee);
    }
  };

  const applyWeatherBoost = () => {
    if (weather === 'clear') {
      key.intensity *= 1.35;
      patchMat.opacity = Math.min(0.4, patchMat.opacity * 1.5);
    } else if (weather === 'snow') {
      key.intensity *= 1.1;
    }
  };

  const applyQuality = (qq: QualityProfile) => {
    lastQ = qq;
    renderer.shadowMap.enabled = qq.shadows;
    key.castShadow = qq.shadows;
    if (qq.shadows) key.shadow.mapSize.set(qq.shadowMapSize, qq.shadowMapSize);
    spot.castShadow = qq.shadows && qq.shadowLights >= 2;
    spot.shadow.mapSize.set(1024, 1024);
    // 그림자가 없으면 키라이트가 벽을 뚫고 방 전체를 비추므로 크게 낮추고 창빛 패치를 키운다.
    key.intensity = qq.shadows ? 1.25 : 0.35;
    patchMat.opacity = qq.shadows ? 0.1 : 0.32;
    hemi.intensity = qq.shadows ? 0.65 : 0.85;
    tintForWeather();
    applyWeatherBoost();
    key.shadow.map?.dispose();
    key.shadow.map = null;
    spot.shadow.map?.dispose();
    spot.shadow.map = null;
    renderer.shadowMap.needsUpdate = true;
  };
  applyQuality(q);

  const setWeather = (kind: WeatherKind) => {
    weather = kind;
    applyQuality(lastQ);
  };

  return { group, applyQuality, setWeather };
}
