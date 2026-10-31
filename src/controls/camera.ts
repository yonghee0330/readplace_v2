// 카메라. 캡처용 고정 시점(?cam=overview|avatar|window)과 둘러보기.
// 단계 3에서 아바타를 따라가는 3인칭 오빗으로 확장한다.
import * as THREE from 'three';
import type { CamPreset } from '../core/params';

export const CAM_PRESETS: Record<CamPreset, { pos: [number, number, number]; target: [number, number, number]; fov: number }> = {
  overview: { pos: [2.55, 1.72, 2.7], target: [-1.5, 0.85, -1.15], fov: 58 },
  window: { pos: [-1.0, 1.45, 0.2], target: [-2.3, 1.15, -3.0], fov: 50 },
  avatar: { pos: [1.4, 2.1, 3.1], target: [0.0, 0.7, -0.4], fov: 50 },
};
/** 세로 화면(모바일)용 시점: 더 낮고 가깝게, 서가 높이에 맞춘다. */
const PORTRAIT: Partial<typeof CAM_PRESETS> = {
  overview: { pos: [2.1, 1.5, 2.45], target: [-1.2, 1.0, -1.75], fov: 68 },
};

export function createCamera(aspect: number): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(CAM_PRESETS.overview.fov, aspect, 0.05, 80);
  applyPreset(cam, 'overview');
  return cam;
}

export function applyPreset(cam: THREE.PerspectiveCamera, preset: CamPreset): THREE.Vector3 {
  const portrait = cam.aspect < 0.8;
  const p = { ...((portrait && PORTRAIT[preset]) || CAM_PRESETS[preset]) };
  // 구도 조정용: ?campos=x,y,z&camtgt=x,y,z 로 덮어쓴다.
  const q = new URLSearchParams(location.search);
  const vec = (k: string) => q.get(k)?.split(',').map(Number) as [number, number, number] | undefined;
  const cp = vec('campos'), ct = vec('camtgt');
  if (cp?.length === 3 && cp.every(Number.isFinite)) p.pos = cp;
  if (ct?.length === 3 && ct.every(Number.isFinite)) p.target = ct;
  cam.position.set(...p.pos);
  cam.fov = p.fov;
  const target = new THREE.Vector3(...p.target);
  cam.lookAt(target);
  // 세로 화면 전용 시점이 없으면 시야각을 넓혀 서점이 잘리지 않게 한다.
  if (portrait && !PORTRAIT[preset]) cam.fov = p.fov * 1.3;
  cam.updateProjectionMatrix();
  return target;
}
