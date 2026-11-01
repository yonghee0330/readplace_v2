// 카메라: 캡처용 고정 시점(?cam=overview|avatar|window)과 아바타를 따라가는 3인칭 오빗.
import * as THREE from 'three';
import type { CamPreset } from '../core/params';
import { ROOM } from '../scene/layout';

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


const DEG = Math.PI / 180;
const MIN_PITCH = 15 * DEG, MAX_PITCH = 70 * DEG;
export const MIN_DIST = 1.5, MAX_DIST = 7;

/**
 * 3인칭 오빗 카메라. 아바타를 부드럽게 따라가고(댐핑), 드래그로 돌리고, 휠·핀치로 1.5~7m 줌,
 * 상하 각도 15°~70°. 방(벽·천장) 밖으로 나가려 하면 카메라를 안쪽으로 당긴다.
 */
export class FollowCamera {
  yaw: number;
  pitch = 22 * DEG;
  distance = 3.3;
  readonly target = new THREE.Vector3();
  private goal = new THREE.Vector3();
  private shown = { yaw: 0, pitch: 22 * DEG, dist: 3.3 };
  reducedMotion = false;

  constructor(private cam: THREE.PerspectiveCamera, yaw: number) {
    this.yaw = yaw;
    this.shown.yaw = yaw;
  }

  /** 바라볼 높이(아바타 발 기준). 세로 화면에서는 더 위를 봐서 바닥이 화면을 덮지 않게 한다. */
  lookHeight = 0.62;

  /** 따라갈 점 */
  follow(p: THREE.Vector3, snap = false): void {
    this.goal.set(p.x, p.y + this.lookHeight, p.z);
    if (snap) this.target.copy(this.goal);
  }

  rotate(dx: number, dy: number): void {
    this.yaw -= dx * 0.006;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.005, MIN_PITCH, MAX_PITCH);
  }

  zoom(factor: number): void {
    this.distance = THREE.MathUtils.clamp(this.distance * factor, MIN_DIST, MAX_DIST);
  }

  /** 읽기 모드: 아바타 어깨 너머에서 책과 서점이 함께 보이는 구도. 끝나면 원래 오빗으로 돌아간다. */
  setFocus(pose: { pos: THREE.Vector3; look: THREE.Vector3 } | null): void {
    this.focusPose = pose;
  }

  get focused(): boolean {
    return this.focusPose !== null;
  }

  private focusPose: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;
  private focusBlend = 0;
  private lastFocus: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;

  update(dt: number): void {
    const k = (rate: number) => (this.reducedMotion ? 1 : 1 - Math.exp(-rate * dt));
    this.target.lerp(this.goal, k(6));
    const dy = Math.atan2(Math.sin(this.yaw - this.shown.yaw), Math.cos(this.yaw - this.shown.yaw));
    this.shown.yaw += dy * k(7);
    this.shown.pitch += (this.pitch - this.shown.pitch) * k(7);
    this.shown.dist += (this.distance - this.shown.dist) * k(6);
    const dir = new THREE.Vector3(
      Math.sin(this.shown.yaw) * Math.cos(this.shown.pitch),
      Math.sin(this.shown.pitch),
      Math.cos(this.shown.yaw) * Math.cos(this.shown.pitch),
    );
    const d = Math.min(this.shown.dist, roomExit(this.target, dir) - 0.18);
    const orbitPos = this.target.clone().addScaledVector(dir, Math.max(0.4, d));
    // 읽기 모드 구도와 섞기(약 0.8초)
    if (this.focusPose) this.lastFocus = this.focusPose;
    this.focusBlend += ((this.focusPose ? 1 : 0) - this.focusBlend) * k(5.5);
    if (this.lastFocus && this.focusBlend > 0.001) {
      const e = this.focusBlend * this.focusBlend * (3 - 2 * this.focusBlend);
      this.cam.position.lerpVectors(orbitPos, this.lastFocus.pos, e);
      this.cam.lookAt(new THREE.Vector3().lerpVectors(this.target, this.lastFocus.look, e));
    } else {
      this.cam.position.copy(orbitPos);
      this.cam.lookAt(this.target);
    }
  }

  /** 카메라가 바라보는 수평 방향(키보드 이동 기준) */
  get viewYaw(): number {
    return this.shown.yaw;
  }
}

/** 방 안의 점 p에서 dir 방향으로 벽·천장·바닥에 닿기까지의 거리(방 = 축 정렬 상자). */
function roomExit(p: THREE.Vector3, dir: THREE.Vector3): number {
  let t = Infinity;
  const axis = (pos: number, d: number, lo: number, hi: number) => {
    if (d > 1e-6) t = Math.min(t, (hi - pos) / d);
    else if (d < -1e-6) t = Math.min(t, (lo - pos) / d);
  };
  axis(p.x, dir.x, ROOM.x0, ROOM.x1);
  axis(p.y, dir.y, 0.05, ROOM.h - 0.12);
  axis(p.z, dir.z, ROOM.z0, ROOM.z1);
  return t;
}
