import '@fontsource/noto-serif-kr/500.css';
import '@fontsource/noto-serif-kr/700.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './style.css';

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { applyPreset, createCamera } from './controls/camera';
import { Loop } from './core/loop';
import { readParams, roomLabel } from './core/params';
import { detectQuality, profileFor } from './core/quality';
import { Rng } from './core/rng';
import { buildBookstore } from './scene/bookstore';
import { buildPostFx } from './scene/postfx';
import { LoadingScreen } from './ui/loading';

declare global {
  interface Window {
    __BBOOKS_READY?: boolean;
  }
}

const params = readParams();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const startEl = document.getElementById('start')!;
document.getElementById('start-room')!.textContent = roomLabel(params.instance);

let entered = false;

async function enter(): Promise<void> {
  if (entered) return;
  entered = true;
  startEl.hidden = true;
  const loading = new LoadingScreen();
  loading.show();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  // three r187에서 PCFSoftShadowMap이 없어져 PCFShadowMap + shadow.radius로 부드러운 그림자를 낸다.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.info.autoReset = false;

  const level = params.quality ?? detectQuality(renderer.getContext());
  const q = profileFor(level);
  renderer.setPixelRatio(q.pixelRatio);
  renderer.setSize(innerWidth, innerHeight, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1d1c19);
  const camera = createCamera(innerWidth / innerHeight);
  const rng = new Rng(params.seed);

  const store = await buildBookstore(renderer, scene, q, rng, loading);
  const fx = buildPostFx(renderer, scene, camera, q);

  // 단계 3 전까지는 고정 시점 + 둘러보기(OrbitControls)
  const target = applyPreset(camera, params.cam ?? 'overview');
  let controls: OrbitControls | null = null;
  if (!params.cam) {
    controls = new OrbitControls(camera, canvas);
    controls.target.copy(target);
    controls.enableDamping = true;
    controls.minDistance = 1.5;
    controls.maxDistance = 7;
    controls.update();
  }

  const onResize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    applyPreset(camera, params.cam ?? 'overview');
    if (controls) controls.update();
    fx.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', onResize);
  fx.setSize(innerWidth, innerHeight);

  await loading.begin('연결');
  const loop = new Loop(() => fx.render(), renderer, params.debug);
  loop.add((dt) => {
    store.exterior.update(dt);
    controls?.update();
  });
  loop.start();

  // 첫 프레임(그림자 포함)이 그려진 뒤 로딩을 걷고 준비 완료 표시
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  await loading.finish(reducedMotion);
  window.__BBOOKS_READY = true;
  console.info(`[bbooks] 품질 ${level}, 책 ${store.stats.books}권, 마루 널 ${store.stats.planks}장`);
}

document.getElementById('start-enter')!.addEventListener('click', () => void enter());
if (params.autostart) void enter();
