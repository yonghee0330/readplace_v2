// 카메라: 캡처용 고정 시점(?cam=overview|avatar|window)과 아바타를 따라가는 3인칭 오빗.
// 시선·줌은 현재 방(ROOM) 안으로 묶어, 공간 너머 허공으로 무한히 나가지 않게 한다.
import * as THREE from 'three';
import type { CamPreset } from '../core/params';
import { ROOM } from '../scene/layout';

export const CAM_PRESETS: Record<CamPreset, { pos: [number, number, number]; target: [number, number, number]; fov: number }> = {
  // 입구 쪽에서 허브 중앙을 내려다봄
  overview: { pos: [2.8, 2.4, 3.2], target: [0, 0.9, 0.2], fov: 58 },
  window: { pos: [0.4, 1.5, -0.6], target: [0.15, 1.2, -3.2], fov: 52 },
  avatar: { pos: [1.2, 2.0, 3.4], target: [0.2, 0.85, 2.2], fov: 50 },
};
/** 세로 화면(모바일)용 시점 */
const PORTRAIT: Partial<typeof CAM_PRESETS> = {
  overview: { pos: [2.2, 2.2, 2.8], target: [0, 0.95, 0.1], fov: 66 },
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
const MIN_PITCH = 12 * DEG, MAX_PITCH = 62 * DEG;
export const MIN_DIST = 1.35;

/** 현재 방 크기에 맞는 최대 오빗 거리 — 방 대각선의 ~38%, 허브도 크게 나가지 않음. */
export function maxOrbitDist(): number {
  const span = Math.hypot(ROOM.w, ROOM.d);
  return THREE.MathUtils.clamp(span * 0.38, 2.6, 6.2);
}

/** 방 안에서 아바타·공간을 잘 담는 기본 거리. */
export function idealOrbitDist(): number {
  const span = Math.hypot(ROOM.w, ROOM.d);
  return THREE.MathUtils.clamp(span * 0.28, 2.0, 3.6);
}

/**
 * 3인칭 오빗 카메라. 아바타를 부드럽게 따라가고(댐핑), 드래그로 돌리고, 휠·핀치로 줌.
 * 거리는 방 크기에 묶고, 카메라는 벽·천장 밖으로 거의 나가지 않아 공간 너머 허공을 보지 않는다.
 */
export class FollowCamera {
  yaw: number;
  pitch = 28 * DEG;
  distance = 3.2;
  readonly target = new THREE.Vector3();
  private goal = new THREE.Vector3();
  private shown = { yaw: 0, pitch: 28 * DEG, dist: 3.2 };
  reducedMotion = false;

  constructor(private cam: THREE.PerspectiveCamera, yaw: number) {
    this.yaw = yaw;
    this.shown.yaw = yaw;
  }

  /** 바라볼 높이(아바타 발 기준). 세로 화면에서는 더 위를 봐서 바닥이 화면을 덮지 않게 한다. */
  lookHeight = 0.72;

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
    this.distance = THREE.MathUtils.clamp(this.distance * factor, MIN_DIST, maxOrbitDist());
  }

  /** 공간 전환 시: 거리·각도를 그 방에 맞게 다시 잡는다. */
  fitToSpace(preferIdeal = true): void {
    const max = maxOrbitDist();
    if (preferIdeal || this.distance > max) this.distance = idealOrbitDist();
    this.distance = THREE.MathUtils.clamp(this.distance, MIN_DIST, max);
    this.pitch = THREE.MathUtils.clamp(this.pitch, MIN_PITCH, MAX_PITCH);
    this.shown.dist = this.distance;
    this.shown.pitch = this.pitch;
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
    const maxD = maxOrbitDist();
    // 방이 바뀌었거나 줌이 한도를 넘으면 끌어당긴다
    if (this.distance > maxD) this.distance = maxD;
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
    // 벽·천장 밖으로 거의 나가지 않음(끼임만 막는 아주 작은 여유)
    const slack = 0.12;
    const hit = roomExit(this.target, dir, slack) - 0.22;
    const d = Math.min(this.shown.dist, Math.max(0.55, hit));
    const orbitPos = this.target.clone().addScaledVector(dir, d);
    // 방 안에 남도록 한 번 더 클램프
    clampInsideRoom(orbitPos, 0.2);

    const zoomT = THREE.MathUtils.clamp((this.shown.dist - MIN_DIST) / Math.max(0.01, maxD - MIN_DIST), 0, 1);
    const nearFov = this.cam.aspect < 0.8 ? 60 : 52;
    // 줌 아웃해도 과하게 넓어지지 않게(공간 왜곡·허공 노출 완화)
    this.cam.fov = nearFov + zoomT * 6;
    this.cam.updateProjectionMatrix();
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

/** 점 p에서 dir 방향으로 카메라 경계(방 + slack)에 닿기까지의 거리. */
function roomExit(p: THREE.Vector3, dir: THREE.Vector3, slack = 0): number {
  let t = Infinity;
  const axis = (pos: number, d: number, lo: number, hi: number) => {
    if (d > 1e-6) t = Math.min(t, (hi - pos) / d);
    else if (d < -1e-6) t = Math.min(t, (lo - pos) / d);
  };
  axis(p.x, dir.x, ROOM.x0 - slack, ROOM.x1 + slack);
  axis(p.y, dir.y, 0.08, ROOM.h - 0.18 + slack * 0.4);
  axis(p.z, dir.z, ROOM.z0 - slack, ROOM.z1 + slack);
  return t;
}

/** 카메라 위치를 방 안(약간 안쪽)으로 밀어 넣는다. */
function clampInsideRoom(p: THREE.Vector3, pad: number): void {
  p.x = THREE.MathUtils.clamp(p.x, ROOM.x0 + pad, ROOM.x1 - pad);
  p.y = THREE.MathUtils.clamp(p.y, 0.35, ROOM.h - 0.25);
  p.z = THREE.MathUtils.clamp(p.z, ROOM.z0 + pad, ROOM.z1 - pad);
}
