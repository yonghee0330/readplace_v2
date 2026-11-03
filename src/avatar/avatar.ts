// 절차 아바타: 둥글고 머리 큰 독서가(키 약 0.9m). 뼈 없이 부위 트랜스폼으로 움직인다.
// 머리·머리카락·볼 홍조는 정점 색으로 한 메시에 합쳐 드로우콜을 줄인다(아바타 하나 = 7~8콜).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AvatarState, HairStyle } from '../net/presence';
import { AvatarAnimator } from './animations';

const SKIN = new THREE.Color('#f3d2b5');
const HAIR = new THREE.Color('#3b2a20');
const HAIR_GRAY = new THREE.Color('#9a9590');
const BEARD = new THREE.Color('#4a433c');
const BEARD_GRAY = new THREE.Color('#a8a29a');
const BLUSH = new THREE.Color('#f09a8c');
const PANTS = new THREE.Color('#3d3833');
const SHOE = new THREE.Color('#2a211c');
const GOLD = new THREE.Color('#c4a46a');
const MOLE = new THREE.Color('#5a3a28');

/** 모든 아바타가 같이 쓰는 재질(색은 정점 색). */
const SHARED = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 });
const EYE_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25 });

export const HEAD_Y = 0.69;
export const HIP_Y = 0.2;

function paint(g: THREE.BufferGeometry, color: THREE.Color | ((y: number) => THREE.Color)): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  const pos = ng.getAttribute('position');
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const c = typeof color === 'function' ? color(pos.getY(i)) : color;
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  ng.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  for (const k of Object.keys(ng.attributes)) if (!['position', 'normal', 'color'].includes(k)) ng.deleteAttribute(k);
  return ng;
}

function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(list)!;
  g.computeBoundingSphere();
  return g;
}

/** 앞쪽(+z)을 비워 둔 구 조각. 머리카락용. */
function hairShell(r: number, frontGap: number, thetaLen: number, thetaStart = 0): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, 28, 14, Math.PI / 2 + frontGap / 2, Math.PI * 2 - frontGap, thetaStart, thetaLen);
}

function headGeometry(hair: HairStyle): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(paint(new THREE.SphereGeometry(0.215, 32, 20), SKIN));
  // 볼 홍조
  for (const sx of [-1, 1]) {
    const c = new THREE.CircleGeometry(0.032, 16);
    const n = new THREE.Vector3(sx * 0.55, -0.22, 0.8).normalize();
    c.lookAt(n);
    c.translate(n.x * 0.2165, n.y * 0.2165, n.z * 0.2165);
    parts.push(paint(c, BLUSH));
  }
  // 머리카락 3종
  const top = (thetaLen: number, tilt: number, r = 0.226) => {
    const g = new THREE.SphereGeometry(r, 28, 12, 0, Math.PI * 2, 0, thetaLen);
    g.rotateX(-tilt);
    return paint(g, HAIR);
  };
  if (hair === 'bangs') {
    parts.push(top(Math.PI * 0.5, 0.2));
    // 앞머리: 이마를 덮는 띠
    // phi가 π/2 근처면 +z(얼굴 쪽)
    const fringe = new THREE.SphereGeometry(0.229, 24, 6, Math.PI * 0.12, Math.PI * 0.76, Math.PI * 0.2, Math.PI * 0.16);
    parts.push(paint(fringe, HAIR));
    parts.push(paint(hairShell(0.228, Math.PI * 0.9, Math.PI * 0.62), HAIR));
  } else if (hair === 'bob') {
    parts.push(top(Math.PI * 0.42, 0.05, 0.232));
    parts.push(paint(hairShell(0.236, Math.PI * 0.62, Math.PI * 0.7), HAIR));
    const fringe = new THREE.SphereGeometry(0.234, 24, 6, Math.PI * 0.1, Math.PI * 0.8, Math.PI * 0.18, Math.PI * 0.12);
    parts.push(paint(fringe, HAIR));
  } else if (hair === 'curtain') {
    // 서든리 매니저: 가르마·커튼 헤어 + 회색 줄기
    parts.push(top(Math.PI * 0.48, 0.12, 0.232));
    parts.push(paint(hairShell(0.234, Math.PI * 0.55, Math.PI * 0.68), HAIR));
    // 좌우 커튼 앞머리
    for (const sx of [-1, 1]) {
      const fringe = new THREE.SphereGeometry(0.1, 12, 10, 0, Math.PI, 0, Math.PI);
      fringe.scale(0.55, 0.85, 0.7);
      fringe.rotateZ(sx * -0.55);
      fringe.rotateX(0.55);
      fringe.translate(sx * 0.09, 0.12, 0.16);
      parts.push(paint(fringe, (y) => (y > 0.08 ? HAIR_GRAY.clone().lerp(HAIR, 0.45) : HAIR)));
    }
    // 관자놀이 회색
    for (const sx of [-1, 1]) {
      const temple = new THREE.SphereGeometry(0.05, 10, 8);
      temple.scale(0.55, 0.9, 0.7);
      temple.translate(sx * 0.18, 0.02, 0.02);
      parts.push(paint(temple, HAIR_GRAY));
    }
  } else {
    parts.push(top(Math.PI * 0.4, 0.32, 0.224));
    // 정수리 삐침
    const tuft = new THREE.ConeGeometry(0.03, 0.08, 8);
    tuft.rotateZ(-0.5);
    tuft.translate(0.03, 0.235, -0.02);
    parts.push(paint(tuft, HAIR));
  }
  const g = merge(parts);
  return g;
}

/** 수염·콧수염(소금후추) + 오른쪽 볼 점. */
function faceExtrasGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // 콧수염
  const mustache = new THREE.TorusGeometry(0.055, 0.016, 8, 16, Math.PI);
  mustache.rotateX(Math.PI / 2);
  mustache.rotateZ(Math.PI);
  mustache.translate(0, -0.055, 0.195);
  parts.push(paint(mustache, BEARD));
  // 턱수염(타원)
  const goatee = new THREE.SphereGeometry(0.07, 14, 12);
  goatee.scale(0.75, 0.95, 0.55);
  goatee.translate(0, -0.145, 0.175);
  parts.push(paint(goatee, (y) => (y < -0.02 ? BEARD_GRAY : BEARD)));
  // 턱 끝 회색
  const tip = new THREE.SphereGeometry(0.028, 10, 8);
  tip.scale(0.9, 1.1, 0.7);
  tip.translate(0, -0.195, 0.185);
  parts.push(paint(tip, BEARD_GRAY));
  // 볼 점(사진 기준 오른쪽 볼 = 아바타 -x)
  const mole = new THREE.SphereGeometry(0.008, 8, 6);
  mole.translate(-0.12, -0.04, 0.185);
  parts.push(paint(mole, MOLE));
  return merge(parts);
}

/** 둥근 금테 안경. */
function glassesGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const rim = (sx: number) => {
    const t = new THREE.TorusGeometry(0.042, 0.005, 8, 24);
    t.rotateY(Math.PI / 2);
    t.translate(sx * 0.07, 0.01, 0.205);
    return paint(t, GOLD);
  };
  parts.push(rim(-1), rim(1));
  // 코받침·브릿지
  const bridge = new THREE.CylinderGeometry(0.004, 0.004, 0.03, 6);
  bridge.rotateZ(Math.PI / 2);
  bridge.translate(0, 0.012, 0.208);
  parts.push(paint(bridge, GOLD));
  // 다리
  for (const sx of [-1, 1]) {
    const arm = new THREE.CylinderGeometry(0.0035, 0.0035, 0.1, 6);
    arm.rotateX(Math.PI / 2);
    arm.translate(sx * 0.11, 0.015, 0.155);
    parts.push(paint(arm, GOLD));
  }
  return merge(parts);
}

function eyesGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.SphereGeometry(0.03, 14, 10);
    e.scale(0.85, 1.1, 0.5);
    e.translate(sx * 0.075, 0, 0);
    parts.push(paint(e, new THREE.Color('#1d1a17')));
    const hl = new THREE.SphereGeometry(0.009, 8, 6);
    hl.translate(sx * 0.075 + 0.01, 0.012, 0.014);
    parts.push(paint(hl, new THREE.Color('#ffffff')));
  }
  return merge(parts);
}

function bodyGeometry(outfit: THREE.Color): THREE.BufferGeometry {
  // 아래가 넓은 종 모양 몸통(Lathe) + 목
  const prof = [
    [0.001, 0], [0.11, 0.0], [0.14, 0.03], [0.155, 0.09], [0.15, 0.16], [0.13, 0.23], [0.095, 0.28], [0.06, 0.3], [0.001, 0.305],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.LatheGeometry(prof, 28);
  const collar = new THREE.TorusGeometry(0.075, 0.018, 8, 24);
  collar.rotateX(Math.PI / 2);
  collar.translate(0, 0.285, 0);
  const outfitLight = outfit.clone().offsetHSL(0, -0.05, 0.12);
  return merge([paint(body, (y) => (y < 0.035 ? outfit.clone().multiplyScalar(0.8) : outfit)), paint(collar, outfitLight)]);
}

function armGeometry(outfit: THREE.Color): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(0.045, 0.1, 6, 12);
  g.translate(0, -0.085, 0); // 어깨가 원점
  return paint(g, (y) => (y < -0.13 ? SKIN : outfit));
}

function legGeometry(): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(0.055, 0.08, 6, 12);
  g.translate(0, -0.095, 0); // 엉덩이가 원점
  return paint(g, (y) => (y < -0.15 ? SHOE : PANTS));
}

/** 두 손에 드는 펼친 책. */
function heldBookGeometry(cover: THREE.Color): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const c = new THREE.BoxGeometry(0.1, 0.005, 0.14);
    c.translate(sx * 0.05, 0, 0);
    c.rotateZ(sx * 0.28);
    parts.push(paint(c, cover));
    const p = new THREE.BoxGeometry(0.094, 0.012, 0.13);
    p.translate(sx * 0.05, 0.008, 0);
    p.rotateZ(sx * 0.28);
    parts.push(paint(p, new THREE.Color('#f4ecd8')));
  }
  return merge(parts);
}

export interface AvatarLook {
  color: string;
  hair: HairStyle;
  /** 서든리 매니저 전용 외형(안경·수염 등) */
  manager?: boolean;
}

export class Avatar {
  readonly root = new THREE.Group();
  /** 몸 전체(앉기·인사 때 기울임) */
  readonly body = new THREE.Group();
  readonly head = new THREE.Group();
  readonly armL = new THREE.Group();
  readonly armR = new THREE.Group();
  readonly legL = new THREE.Group();
  readonly legR = new THREE.Group();
  readonly eyes: THREE.Mesh;
  readonly book: THREE.Mesh;
  readonly anim: AvatarAnimator;
  private meshes: THREE.Mesh[] = [];
  private look: AvatarLook;

  constructor(look: AvatarLook) {
    this.look = { ...look };
    this.root.name = 'avatar';
    this.eyes = new THREE.Mesh(eyesGeometry(), EYE_MAT);
    this.eyes.position.set(0, -0.01, 0.192);
    this.book = new THREE.Mesh(heldBookGeometry(new THREE.Color('#8c2f2a')), SHARED);
    this.book.visible = false;
    this.build();
    this.anim = new AvatarAnimator(this);
  }

  private build(): void {
    for (const m of this.meshes) {
      m.removeFromParent();
      m.geometry.dispose();
    }
    this.meshes = [];
    const outfit = new THREE.Color(this.look.color);
    const add = (parent: THREE.Object3D, g: THREE.BufferGeometry) => {
      const m = new THREE.Mesh(g, SHARED);
      m.castShadow = false;
      parent.add(m);
      this.meshes.push(m);
      return m;
    };
    this.root.add(this.body);
    this.body.position.y = HIP_Y;
    add(this.body, bodyGeometry(outfit)).position.y = -0.01;
    this.body.add(this.head);
    this.head.position.y = HEAD_Y - HIP_Y;
    const hair = this.look.manager ? 'curtain' : this.look.hair;
    add(this.head, headGeometry(hair));
    if (this.look.manager) {
      add(this.head, faceExtrasGeometry());
      add(this.head, glassesGeometry());
    }
    this.head.add(this.eyes);
    for (const [arm, sx] of [[this.armL, 1], [this.armR, -1]] as const) {
      this.body.add(arm);
      arm.position.set(sx * 0.15, 0.24, 0);
      add(arm, armGeometry(outfit));
    }
    for (const [leg, sx] of [[this.legL, 1], [this.legR, -1]] as const) {
      this.root.add(leg);
      leg.position.set(sx * 0.065, HIP_Y + 0.01, 0);
      add(leg, legGeometry());
    }
    this.body.add(this.book);
    this.book.position.set(0, 0.2, 0.2);
    this.book.rotation.x = -0.55;
  }

  setLook(look: AvatarLook): void {
    if (
      look.color === this.look.color
      && look.hair === this.look.hair
      && !!look.manager === !!this.look.manager
    ) return;
    this.look = { ...look };
    this.build();
  }

  get state(): AvatarState {
    return this.anim.state;
  }

  update(dt: number, t: number): void {
    this.anim.update(dt, t);
  }

  dispose(): void {
    for (const m of this.meshes) m.geometry.dispose();
    this.root.removeFromParent();
  }
}
