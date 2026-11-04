// 조명: 창 방향 키라이트(그림자), 실내 전구, 반구광, 바닥의 창빛 패치, 약한 환경 반사.
// 부천 날씨(비·눈·맑음)에 따라 창빛 색·세기를 살짝 바꾼다. 공간마다 램프 위치를 맞춘다.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { QualityProfile } from '../core/quality';
import type { WeatherKind } from '../weather/bucheon';
import { BACK_OPENINGS, ROOM, SPACE_ORDER, type SpaceId } from './layout';
import type { LampAnchor } from './props/lamps';
import { windowLightTexture } from './textures';

/** 빛이 나아가는 방향(창 밖 위쪽 → 방 안 아래쪽). */
export const KEY_DIR = new THREE.Vector3(0.32, -0.78, 1).normalize();

export interface Lighting {
  group: THREE.Group;
  applyQuality(q: QualityProfile): void;
  setWeather(kind: WeatherKind): void;
  setSpaceMood(space: SpaceId): void;
  /** 영화 재생 중: 감상실을 거의 암전해 화면만 남긴다. */
  setCinemaPlaying(on: boolean): void;
}

const WARM = 0xffb873;

export function buildLighting(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  lampsBySpace: Partial<Record<SpaceId, LampAnchor[]>>,
  q: QualityProfile,
): Lighting {
  const group = new THREE.Group();
  group.name = 'lighting';

  // 흐린 비 오는 날의 창빛: 차분한 흰빛
  const key = new THREE.DirectionalLight(0xe9edf0, 2.4);
  const target = new THREE.Object3D();
  target.position.set(0, 0, 0);
  key.target = target;
  key.position.copy(KEY_DIR).multiplyScalar(-22);
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 42;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.025;
  key.shadow.radius = 3;
  group.add(key, target);

  // 공간별 전구(전환 시 위치를 맞춘다)
  const points: THREE.PointLight[] = [];
  const spot = new THREE.SpotLight(WARM, 9, 0, 1.05, 0.85, 2);
  spot.shadow.bias = -0.0006;
  spot.shadow.normalBias = 0.02;
  spot.shadow.camera.near = 0.2;
  spot.shadow.camera.far = 4;
  group.add(spot, spot.target);

  // 창 없는 방 보조 필(세미나·강연)
  const roomFill = new THREE.PointLight(0xffe0b8, 0, 14, 2);
  roomFill.position.set(0, 2.15, 0.4);
  group.add(roomFill);

  const hemi = new THREE.HemisphereLight(0xf2e1c4, 0x4f3622, 0.65);
  group.add(hemi);

  // 영화감상실용: 은은한 노란 필·백라이트
  const cinemaFill = new THREE.PointLight(0xffd089, 0, 8, 2);
  cinemaFill.position.set(0, 1.55, 1.4);
  const cinemaBack = new THREE.PointLight(0xffb86a, 0, 6, 2);
  cinemaBack.position.set(0, 1.15, -1.3);
  const cinemaAmb = new THREE.PointLight(0xffe2b0, 0, 10, 2);
  cinemaAmb.position.set(0, 2.1, 0);
  group.add(cinemaFill, cinemaBack, cinemaAmb);

  // 1인실: 뱅커스 램프 위치의 따뜻한 포인트 + 약한 앰비언트
  const soloLamp = new THREE.PointLight(0xffc070, 0, 4.5, 2);
  soloLamp.position.set(-0.55, 1.12, 1.02);
  const soloAmb = new THREE.PointLight(0xffe0b8, 0, 5.5, 2);
  soloAmb.position.set(0.15, 1.85, 0.2);
  group.add(soloLamp, soloAmb);

  // 바닥의 창 모양 밝은 영역: 허브 창만(초기 레이아웃 기준)
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
    g.setAttribute('position', new THREE.Float32BufferAttribute(corners.flatMap((c) => [c.x, c.y, c.z]), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    const m = new THREE.Mesh(g, patchMat);
    m.renderOrder = 1;
    m.name = 'window-light';
    patches.push(m);
    group.add(m);
  }

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.18;
  pmrem.dispose();

  let lastQ = q;
  let weather: WeatherKind = 'rain';
  let mood: SpaceId = 'hub';
  let cinemaPlaying = false;

  /** 활성 공간의 램프 앵커에 PointLight·Spot을 맞춘다. */
  const syncSpaceLamps = (space: SpaceId) => {
    const anchors = lampsBySpace[space] ?? [];
    while (points.length < anchors.length) {
      const p = new THREE.PointLight(WARM, 1.5, 0, 2);
      points.push(p);
      group.add(p);
    }
    for (let i = 0; i < points.length; i++) {
      const a = anchors[i];
      const p = points[i]!;
      if (!a) {
        p.intensity = 0;
        p.visible = false;
        continue;
      }
      p.visible = true;
      p.position.copy(a.position);
      p.intensity = a.kind === 'floor' ? 1.4 : 1.6;
      p.distance = 0;
      p.decay = 2;
    }
    const pend = anchors.find((a) => a.kind === 'pendant') ?? anchors[0];
    if (pend) {
      spot.visible = true;
      spot.position.copy(pend.position);
      if (pend.kind === 'pendant') spot.position.x += 0.35;
      spot.target.position.set(pend.position.x, 0, pend.position.z);
      spot.target.updateMatrixWorld();
      spot.intensity = 8;
    } else {
      spot.visible = false;
      spot.intensity = 0;
    }
  };

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

  const applyMood = () => {
    const cinema = mood === 'cinema';
    const solo = mood === 'solo';
    const seminar = mood === 'seminar';
    const lecture = mood === 'lecture';
    const playing = cinema && cinemaPlaying;
    const hush = cinema || solo;

    // 기본: 공간 램프 동기화(허브·세미나·강연). 영화/1인실은 아래에서 끈다.
    syncSpaceLamps(mood);

    if (hush) {
      for (const p of points) p.intensity = 0;
      spot.intensity = 0;
      spot.visible = false;
    }

    cinemaFill.intensity = playing ? 0.05 : cinema ? 0.85 : 0;
    cinemaBack.intensity = playing ? 0.02 : cinema ? 0.45 : 0;
    cinemaAmb.intensity = playing ? 0.04 : cinema ? 0.55 : 0;
    soloLamp.intensity = solo ? 2.4 : 0;
    soloAmb.intensity = solo ? 0.55 : 0;
    // 창 없는 세미나·강연: 테이블/무대 펜던트 + 천장 필
    roomFill.intensity = seminar ? 1.35 : lecture ? 1.1 : 0;
    if (seminar) roomFill.position.set(0, 2.2, 0.2);
    if (lecture) roomFill.position.set(2.45, 2.25, -0.55);

    if (playing) {
      key.intensity = 0.02;
      hemi.intensity = 0.06;
      hemi.color.setHex(0x1a1410);
      hemi.groundColor.setHex(0x080604);
      patchMat.opacity = 0;
      for (const m of patches) m.visible = false;
      scene.environmentIntensity = 0.02;
      key.color.setHex(0x332820);
    } else if (cinema) {
      key.intensity = 0.12;
      hemi.intensity = 0.28;
      hemi.color.setHex(0xffe6c4);
      hemi.groundColor.setHex(0x4a3220);
      patchMat.opacity = 0;
      for (const m of patches) m.visible = false;
      scene.environmentIntensity = 0.08;
      key.color.setHex(0xffe0b0);
    } else if (solo) {
      key.intensity = 0.18;
      hemi.intensity = 0.38;
      hemi.color.setHex(0xffefd4);
      hemi.groundColor.setHex(0x4a3424);
      patchMat.opacity = 0;
      for (const m of patches) m.visible = false;
      scene.environmentIntensity = 0.12;
      key.color.setHex(0xffe2b8);
    } else if (seminar || lecture) {
      // 창 없음: 키라이트는 약하게, 반구·펜던트·필로 밝게
      key.intensity = lastQ.shadows ? 0.45 : 0.28;
      hemi.intensity = lastQ.shadows ? 0.85 : 0.95;
      hemi.color.setHex(0xfff0dc);
      hemi.groundColor.setHex(0x5a4030);
      patchMat.opacity = 0;
      for (const m of patches) m.visible = false;
      scene.environmentIntensity = 0.22;
      // 펜던트 스팟을 테이블/무대 위로
      if (spot.visible) spot.intensity = seminar ? 10 : 8;
      for (const p of points) {
        if (p.visible) p.intensity = Math.max(p.intensity, 1.8);
      }
    } else {
      for (const m of patches) m.visible = true;
      scene.environmentIntensity = 0.18;
    }
  };

  const applyQuality = (qq: QualityProfile) => {
    lastQ = qq;
    renderer.shadowMap.enabled = qq.shadows;
    key.castShadow = qq.shadows;
    if (qq.shadows) key.shadow.mapSize.set(qq.shadowMapSize, qq.shadowMapSize);
    spot.castShadow = qq.shadows && qq.shadowLights >= 2;
    spot.shadow.mapSize.set(1024, 1024);
    key.intensity = qq.shadows ? 1.25 : 0.35;
    patchMat.opacity = qq.shadows ? 0.1 : 0.32;
    hemi.intensity = qq.shadows ? 0.65 : 0.85;
    tintForWeather();
    applyWeatherBoost();
    applyMood();
    key.shadow.map?.dispose();
    key.shadow.map = null;
    spot.shadow.map?.dispose();
    spot.shadow.map = null;
    renderer.shadowMap.needsUpdate = true;
  };

  // 허브 램프로 초기화
  for (const id of SPACE_ORDER) {
    if (!lampsBySpace[id]) lampsBySpace[id] = [];
  }
  syncSpaceLamps('hub');
  applyQuality(q);

  const setWeather = (kind: WeatherKind) => {
    weather = kind;
    applyQuality(lastQ);
  };

  const setSpaceMood = (space: SpaceId) => {
    mood = space;
    if (space !== 'cinema') cinemaPlaying = false;
    applyQuality(lastQ);
  };

  const setCinemaPlaying = (on: boolean) => {
    cinemaPlaying = on;
    applyQuality(lastQ);
  };

  return { group, applyQuality, setWeather, setSpaceMood, setCinemaPlaying };
}
