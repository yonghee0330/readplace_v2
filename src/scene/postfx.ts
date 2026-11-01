// 후처리: RenderPass → GTAO(높음) / SAO(보통) → 약한 Bloom → OutputPass(톤매핑·sRGB).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { SAOPass } from 'three/examples/jsm/postprocessing/SAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import type { QualityProfile } from '../core/quality';

export interface PostFx {
  render(): void;
  setSize(w: number, h: number): void;
  setCamera(cam: THREE.PerspectiveCamera): void;
  dispose(): void;
}

export function buildPostFx(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, q: QualityProfile): PostFx {
  // 진단용: ?fx=noao,nobloom 으로 패스를 하나씩 끌 수 있다.
  const fxOff = new URLSearchParams(location.search).get('fx') ?? '';
  const size = renderer.getSize(new THREE.Vector2());
  // AO는 레이어 0만 보는 카메라로 계산한다. 이름표·발밑 그림자 같은 오버레이(레이어 1)가
  // AO 깊이·법선 버퍼에 들어가 사각형 자국을 남기지 않게 하기 위함.
  let mainCam: THREE.PerspectiveCamera = camera;
  const aoCam = camera.clone();
  aoCam.layers.set(0);
  const syncAo = () => {
    aoCam.position.copy(mainCam.position);
    aoCam.quaternion.copy(mainCam.quaternion);
    aoCam.fov = mainCam.fov;
    aoCam.aspect = mainCam.aspect;
    aoCam.near = mainCam.near;
    aoCam.far = mainCam.far;
    aoCam.updateMatrixWorld();
    aoCam.updateProjectionMatrix();
  };
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  // 메인 장면 패스만의 드로우콜·삼각형(성능 예산 비교용). AO·Bloom 패스는 프레임 전체 수치에 따로 잡힌다.
  composer.addPass(new MeasurePass(renderer));

  let gtao: GTAOPass | null = null;
  let sao: SAOPass | null = null;
  if (fxOff.includes('noao')) {
    // 끔
  } else if (q.ao === 'gtao') {
    gtao = new GTAOPass(scene, aoCam, size.x, size.y);
    gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.6, thickness: 1.2, scale: 1.1, samples: 16 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    gtao.blendIntensity = 0.9;
    composer.addPass(gtao);
  } else if (q.ao === 'sao') {
    sao = new SAOPass(scene, aoCam, new THREE.Vector2(size.x, size.y));
    Object.assign(sao.params, {
      saoBias: 0.5, saoIntensity: 0.06, saoScale: 4, saoKernelRadius: 56,
      saoMinResolution: 0, saoBlur: true, saoBlurRadius: 6, saoBlurStdDev: 3.5, saoBlurDepthCutoff: 0.008,
    });
    composer.addPass(sao);
  }

  if (q.bloom && !fxOff.includes('nobloom')) {
    const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.28, 0.5, 1.0);
    composer.addPass(bloom);
  }
  composer.addPass(new OutputPass());

  return {
    render: () => {
      syncAo();
      composer.render();
    },
    setSize: (w, h) => {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    },
    setCamera: (cam) => {
      mainCam = cam;
      renderPass.camera = cam;
    },
    dispose: () => {
      composer.dispose();
      gtao?.dispose();
      sao?.dispose();
    },
  };
}

class MeasurePass extends Pass {
  constructor(private r: THREE.WebGLRenderer) {
    super();
    this.needsSwap = false;
  }
  render(): void {
    (window as unknown as { __BBOOKS_MAIN?: unknown }).__BBOOKS_MAIN = { calls: this.r.info.render.calls, triangles: this.r.info.render.triangles };
  }
}
