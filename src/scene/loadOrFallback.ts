// 외부 모델 교체 구조: assets/models/{name}.glb가 있으면 쓰고, 없으면 절차 모델을 쓴다.
// 어떤 glb가 있는지는 빌드 시점에 import.meta.glob으로 알기 때문에, 없는 파일을 요청해 404를 내지 않는다.
import type { Object3D } from 'three';

const MODELS = import.meta.glob('/assets/models/*.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

export async function loadOrFallback(name: string, fallbackFactory: () => Object3D | Promise<Object3D>): Promise<Object3D> {
  const url = MODELS[`/assets/models/${name}.glb`];
  if (!url) return fallbackFactory();
  try {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(url);
    gltf.scene.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    return gltf.scene;
  } catch (err) {
    console.warn(`[loadOrFallback] ${name}.glb을 읽지 못해 절차 모델로 대체합니다.`, err);
    return fallbackFactory();
  }
}

export function hasModel(name: string): boolean {
  return `/assets/models/${name}.glb` in MODELS;
}
