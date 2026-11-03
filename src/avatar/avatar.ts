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
    // 서든리 매니저: 부드러운 가르마·커튼 헤어(뿔처럼 튀어나오지 않게)
    parts.push(top(Math.PI * 0.46, 0.08, 0.228));
    parts.push(paint(hairShell(0.23, Math.PI * 0.7, Math.PI * 0.62), HAIR));
    // 이마를 살짝 덮는 앞머리 띠
    const fringe = new THREE.SphereGeometry(0.227, 24, 8, Math.PI * 0.18, Math.PI * 0.64, Math.PI * 0.22, Math.PI * 0.14);
    parts.push(paint(fringe, HAIR));
    // 관자놀이 쪽 옅은 회색(납작하게 붙임)
    for (const sx of [-1, 1]) {
      const temple = new THREE.SphereGeometry(0.04, 10, 8);
      temple.scale(0.35, 0.75, 0.55);
      temple.translate(sx * 0.195, 0.04, 0.04);
      parts.push(paint(temple, HAIR_GRAY.clone().lerp(HAIR, 0.35)));
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

/** 콧수염·턱수염만 자연스럽게 + 오른쪽 볼 점. */
function faceExtrasGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // 콧수염: 입 위 납작한 좌우 덩어리
  for (const sx of [-1, 1]) {
    const m = new THREE.SphereGeometry(0.038, 12, 10);
    m.scale(0.95, 0.38, 0.45);
    m.translate(sx * 0.032, -0.048, 0.198);
    parts.push(paint(m, BEARD));
  }
  // 가운데 콧수염 연결
  const mid = new THREE.SphereGeometry(0.022, 10, 8);
  mid.scale(1.1, 0.35, 0.4);
  mid.translate(0, -0.052, 0.2);
  parts.push(paint(mid, BEARD));
  // 턱수염: 턱에 붙는 납작한 타원(뿔처럼 앞으로 안 튀게)
  const goatee = new THREE.SphereGeometry(0.055, 14, 12);
  goatee.scale(0.7, 0.85, 0.42);
  goatee.translate(0, -0.155, 0.168);
  parts.push(paint(goatee, (y) => (y < -0.01 ? BEARD_GRAY : BEARD)));
  // 볼 점
  const mole = new THREE.SphereGeometry(0.007, 8, 6);
  mole.translate(-0.115, -0.035, 0.188);
  parts.push(paint(mole, MOLE));
  return merge(parts);
}

/** 둥근 금테 안경 — XY면(정면 +z)을 바라보게. */
function glassesGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const z = 0.208;
  const rim = (sx: number) => {
    // Torus 기본면 = XY → 정면에서 원형으로 보임
    const t = new THREE.TorusGeometry(0.038, 0.0045, 10, 28);
    t.translate(sx * 0.068, 0.008, z);
    return paint(t, GOLD);
  };
  parts.push(rim(-1), rim(1));
  // 브릿지
  const bridge = new THREE.BoxGeometry(0.028, 0.006, 0.006);
  bridge.translate(0, 0.012, z);
  parts.push(paint(bridge, GOLD));
  // 코받침
  for (const sx of [-1, 1]) {
    const pad = new THREE.SphereGeometry(0.006, 8, 6);
    pad.scale(0.7, 1, 0.7);
    pad.translate(sx * 0.018, -0.002, z - 0.008);
    parts.push(paint(pad, GOLD));
  }
  // 다리(옆 → 귀)
  for (const sx of [-1, 1]) {
    const arm = new THREE.BoxGeometry(0.006, 0.005, 0.085);
    arm.translate(sx * 0.105, 0.012, z - 0.045);
    parts.push(paint(arm, GOLD));
  }
  return merge(parts);
}

const APRON = new THREE.Color('#e8dfd0');
const APRON_STRAP = new THREE.Color('#c4b59a');
const APRON_POCKET = new THREE.Color('#ddd2c0');

/** 서점 주인 작업용 앞치마(몸통 앞에 두른 천 + 어깨끈). */
function apronGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // 본체: 가슴~허벅지
  const body = new THREE.BoxGeometry(0.22, 0.28, 0.04, 1, 1, 1);
  body.translate(0, 0.12, 0.12);
  parts.push(paint(body, APRON));
  // 하단 살짝 넓게
  const hem = new THREE.BoxGeometry(0.24, 0.04, 0.035);
  hem.translate(0, -0.02, 0.118);
  parts.push(paint(hem, APRON.clone().multiplyScalar(0.95)));
  // 앞주머니
  const pocket = new THREE.BoxGeometry(0.12, 0.07, 0.02);
  pocket.translate(0, 0.02, 0.138);
  parts.push(paint(pocket, APRON_POCKET));
  // 어깨끈
  for (const sx of [-1, 1]) {
    const strap = new THREE.BoxGeometry(0.028, 0.16, 0.018);
    strap.translate(sx * 0.08, 0.28, 0.08);
    strap.rotateX(-0.35);
    parts.push(paint(strap, APRON_STRAP));
  }
  // 허리 매듭
  const tie = new THREE.BoxGeometry(0.2, 0.025, 0.03);
  tie.translate(0, 0.02, 0.1);
  parts.push(paint(tie, APRON_STRAP));
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
    if (this.look.manager) {
      add(this.body, apronGeometry()).position.y = -0.01;
    }
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
