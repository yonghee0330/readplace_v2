// 서점 고양이 "치즈": 허브를 어슬렁거리는 절차 모델 NPC. 접속자 수·알림에서 빠진다.
// 치즈 태비 무늬(머리 큰 둥근 체형), 뼈 없이 부위 트랜스폼만으로 움직인다(드로우콜 약 15).
// 동작: 앉기·그루밍·식빵 굽기·낮잠·기지개·야옹·꼬리 쫓기·덮치기·우다다·소파 점프·인사하러 오기·쓰다듬기.
import * as THREE from 'three';
import type { NavGrid, Pt } from '../controls/pathfinding';
import type { Rng } from '../core/rng';
import { SEATS, SPACE_LAYOUTS, seatApproach, type Seat } from '../scene/layout';
import { merge, paint, type Painter } from './avatar';
import { Nameplate, OVERLAY_LAYER } from './nameplate';

const C = (hex: string) => new THREE.Color(hex);
const ORANGE = C('#e49a4f');
const ORANGE_DARK = C('#b96a2c');
const CREAM = C('#f8efe0');
const PINK = C('#eba3a0');
const IRIS = C('#a9d36b');
const PUPIL = C('#1c1410');
const SPARK = C('#ffffff');
const WHISKER = C('#fffaf0');
const LID = C('#4b2a1a');

export const CAT_NAME = '치즈';
const ACCENT = '#e49a4f';

const FUR = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
const EYE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2 });
const LID_MAT = new THREE.MeshBasicMaterial({ color: LID });

type V3 = [number, number, number];

function ball(r: number, s: V3, p: V3, c: THREE.Color | Painter, seg = 20): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, seg, Math.max(8, Math.round(seg * 0.65)));
  g.scale(s[0], s[1], s[2]);
  g.translate(p[0], p[1], p[2]);
  return paint(g, c);
}

/** 몸통 털무늬: 등·옆구리에 줄무늬, 배·가슴은 크림색 */
const coat: Painter = (y, x, z) => {
  if ((y < -0.052 && Math.abs(x) < 0.08) || (z > 0.1 && y < 0.015)) return CREAM;
  const band = Math.sin(z * 64 + Math.abs(x) * 10);
  if (y > -0.035 && band > 0.6) return ORANGE_DARK;
  return ORANGE;
};

function bodyGeometry(): THREE.BufferGeometry {
  const parts = [
    ball(0.1, [0.9, 0.88, 1.45], [0, 0, 0], coat, 26),
    ball(0.084, [1, 1, 0.9], [0, -0.006, 0.075], CREAM),
    ball(0.074, [0.82, 1, 1.1], [0.066, -0.016, -0.085], coat),
    ball(0.074, [0.82, 1, 1.1], [-0.066, -0.016, -0.085], coat),
  ];
  return merge(parts);
}

function headGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const skull: Painter = (y, x, z) => {
    // 이마 줄무늬 M
    const stripe = z > 0.0 && y > 0.045 && Math.abs(Math.sin(x * 120)) > 0.86;
    return stripe ? ORANGE_DARK : ORANGE;
  };
  parts.push(ball(0.085, [1.14, 0.95, 1], [0, 0, 0], skull, 28));
  for (const sx of [-1, 1]) {
    parts.push(ball(0.04, [1, 0.85, 1], [sx * 0.058, -0.032, 0.044], CREAM));
    // 볼 홍조
    const blush = new THREE.CircleGeometry(0.014, 12);
    blush.lookAt(new THREE.Vector3(sx * 0.5, -0.1, 0.85).normalize());
    blush.translate(sx * 0.065, -0.026, 0.066);
    parts.push(paint(blush, C('#f2a9a0')));
  }
  parts.push(ball(0.033, [1.25, 0.8, 0.8], [0, -0.033, 0.07], CREAM));
  parts.push(ball(0.02, [1.3, 0.8, 0.9], [0, -0.062, 0.056], CREAM));
  parts.push(ball(0.0115, [1.25, 0.8, 0.7], [0, -0.016, 0.092], PINK, 12));
  // 수염
  for (const sx of [-1, 1]) {
    for (const k of [-1, 0, 1]) {
      const w = new THREE.BoxGeometry(0.08, 0.0016, 0.0016);
      w.translate(sx * 0.04, 0, 0);
      w.rotateZ(sx * k * 0.2);
      w.translate(sx * 0.03, -0.034 - k * 0.0, 0.074);
      parts.push(paint(w, WHISKER));
    }
  }
  return merge(parts);
}

function eyesGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const x = sx * 0.041;
    parts.push(ball(0.0195, [1, 1.2, 0.55], [x, 0.016, 0.066], IRIS, 16));
    parts.push(ball(0.0108, [0.55, 1.25, 0.4], [x, 0.016, 0.0735], PUPIL, 12));
    parts.push(ball(0.0046, [1, 1, 0.5], [x + 0.0065, 0.0255, 0.0775], SPARK, 8));
    parts.push(ball(0.0026, [1, 1, 0.5], [x - 0.005, 0.008, 0.0775], SPARK, 8));
  }
  return merge(parts);
}

/** 감은 눈 호: happy는 ∩, sleep은 ∪ */
function lidsGeometry(happy: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const t = new THREE.TorusGeometry(0.0155, 0.0023, 6, 14, Math.PI);
    if (!happy) t.rotateZ(Math.PI);
    t.translate(sx * 0.041, happy ? 0.008 : 0.024, 0.0765);
    parts.push(paint(t, LID));
  }
  return merge(parts);
}

function earGeometry(): THREE.BufferGeometry {
  const outer = new THREE.ConeGeometry(0.04, 0.078, 12);
  outer.scale(1, 1, 0.5);
  outer.translate(0, 0.039, 0);
  const inner = new THREE.ConeGeometry(0.026, 0.056, 12);
  inner.scale(1, 1, 0.5);
  inner.translate(0, 0.03, 0.01);
  return merge([paint(outer, (y) => (y > 0.062 ? ORANGE_DARK : ORANGE)), paint(inner, PINK)]);
}

function legGeometry(): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(0.027, 0.085, 6, 12);
  g.translate(0, -0.0695, 0);
  return paint(g, (y) => {
    if (y < -0.098) return CREAM;
    if (Math.sin(y * 170) > 0.82) return ORANGE_DARK;
    return ORANGE;
  });
}

const TAIL_SEG = 4;
const TAIL_STEP = 0.07;
function tailGeometry(i: number): THREE.BufferGeometry {
  const r = 0.0205 - i * 0.0022;
  const g = new THREE.CapsuleGeometry(r, 0.05, 6, 10);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, -0.044);
  const last = i === TAIL_SEG - 1;
  return paint(g, (_y, _x, z) => (last || Math.sin(z * 95 + i * 2) > 0.55 ? ORANGE_DARK : ORANGE));
}

// ---------------------------------------------------------------- 자세

type Mode =
  | 'stand' | 'walk' | 'run' | 'sit' | 'groom' | 'loaf' | 'sleep' | 'stretch' | 'meow'
  | 'chase' | 'crouch' | 'jump' | 'happy';

interface Pose {
  y: number; pitch: number; roll: number; zs: number;
  hp: number; hy: number; hr: number; hdy: number; hdz: number;
  lf: number; rf: number; lb: number; rb: number; sf: number; sb: number;
  tp: number; tc: number; ty: number; sw: number; swHz: number;
  ear: number; open: number;
}

const STAND: Pose = {
  y: 0.185, pitch: 0, roll: 0, zs: 0,
  hp: 0.05, hy: 0, hr: 0, hdy: 0, hdz: 0,
  lf: 0, rf: 0, lb: 0, rb: 0, sf: 1, sb: 1,
  tp: 0.6, tc: 0.22, ty: 0, sw: 0.22, swHz: 0.6,
  ear: 0, open: 1,
};

const SIT: Pose = {
  ...STAND, y: 0.15, pitch: -0.95, zs: -0.02,
  hp: 0.82, lf: 0.95, rf: 0.95, lb: -0.62, rb: -0.62, sf: 1.35, sb: 0.55,
  tp: 0.9, tc: 0, ty: 0.34, sw: 0.1, swHz: 0.5,
};

const POSES: Record<Mode, Pose> = {
  stand: STAND,
  walk: { ...STAND, tp: 0.85, tc: 0.3, sw: 0.14, swHz: 0.9 },
  run: { ...STAND, y: 0.17, tp: 0.25, tc: 0.1, sw: 0.1, swHz: 1.4, ear: 0.9, hp: 0.12 },
  sit: SIT,
  groom: { ...SIT, hp: 0.95, rf: -1.22, sf: 0.95, open: 0.15, sw: 0.05 },
  loaf: {
    ...STAND, y: 0.098, hp: 0.12, hdy: -0.03,
    lf: -1.35, rf: -1.35, lb: -0.9, rb: -0.9, sf: 0.5, sb: 0.45,
    tp: 0, tc: 0, ty: 0.5, sw: 0.04, swHz: 0.35, open: 0.7,
  },
  sleep: {
    ...STAND, y: 0.088, hp: 0.78, hy: 0.35, hr: 0.28, hdy: -0.05, hdz: 0.03,
    lf: -1.4, rf: -1.4, lb: -0.95, rb: -0.95, sf: 0.45, sb: 0.4,
    tp: 0, tc: 0, ty: 0.85, sw: 0.015, swHz: 0.25, open: 0, ear: 0.25,
  },
  stretch: {
    ...STAND, y: 0.176, pitch: 0.3, hp: -0.4, hdy: -0.02,
    lf: -0.95, rf: -0.95, lb: 0.2, rb: 0.2, sf: 1.15, sb: 1.4,
    tp: 1.05, tc: 0.12, sw: 0.1, swHz: 0.5, open: 0.4,
  },
  meow: { ...SIT, hp: 0.5, sw: 0.18, swHz: 0.9 },
  chase: { ...STAND, y: 0.17, hp: 0.35, hy: 1.0, lf: 0.2, rf: 0.2, lb: 0.1, rb: 0.1, tp: 0.25, ty: 0.6, tc: 0, sw: 0.1, swHz: 2 },
  crouch: {
    ...STAND, y: 0.108, pitch: 0.05, hp: -0.05, lf: -0.9, rf: -0.9, lb: -0.7, rb: -0.7,
    sf: 0.62, sb: 0.7, tp: 0.12, tc: 0, sw: 0.4, swHz: 1.6, ear: 0.45, open: 1,
  },
  jump: {
    ...STAND, y: 0.2, pitch: -0.4, hp: 0.3, lf: -1.0, rf: -1.0, lb: 0.9, rb: 0.9,
    sf: 1.2, sb: 1.2, tp: 0.4, tc: 0, ear: 0.7, open: 1,
  },
  happy: {
    ...SIT, hp: 0.78, hr: 0.35, tp: 1.15, tc: 0.35, ty: 0, sw: 0.2, swHz: 1.1, open: 0, ear: -0.1,
  },
};

const POSE_KEYS = Object.keys(STAND) as (keyof Pose)[];
const damp = (cur: number, to: number, rate: number, dt: number) => cur + (to - cur) * (1 - Math.exp(-rate * dt));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = THREE.MathUtils.clamp;

// ---------------------------------------------------------------- 고양이

export interface CatHooks {
  /** 지금 내 위치(허브 안) */
  player(): { x: number; z: number };
  /** 소파 좌석을 누가 쓰고 있는지 */
  seatTaken(id: string): boolean;
  /** 현재 내비 격자 */
  grid(): NavGrid;
  /** 읽기 모드 등에서 이름표 숨기기 */
  labelsHidden(): boolean;
  /** 소리 */
  onMeow?(): void;
}

interface Jump { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; arc: number; after: Mode }

const SOFA_Y = 0.4;

export class Cat {
  readonly root = new THREE.Group();
  readonly nameplate: Nameplate;
  readonly overlay = new THREE.Group();
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private eyes: THREE.Mesh;
  private lidsHappy: THREE.Mesh;
  private lidsSleep: THREE.Mesh;
  private ears: THREE.Group[] = [];
  private legs: THREE.Group[] = []; // lf, rf, lb, rb
  private tail: THREE.Group[] = [];
  private shadow: THREE.Mesh;
  private geoms: THREE.BufferGeometry[] = [];

  private cur: Pose = { ...STAND };
  private mode: Mode = 'sit';
  private modeT = 0;
  private modeDur = 2;
  private path: Pt[] = [];
  private speed = 0.55;
  private jump: Jump | null = null;
  private after: (() => void) | null = null;
  private gait = 0;
  private phase = 0;
  private baseY = 0;
  private onSofa: Seat | null = null;
  private lastMode: Mode = 'sit';
  private greetCool = 6;
  private say = '';
  private sayT = 0;
  private lookT = 0;
  private lookYaw = 0;
  private lookPitch = 0;
  private blinkT = 2;
  private blinking = 0;
  private flickT = 3;
  private flickSide = 0;
  private flick = 0;
  private spin = 0;
  private placed = false;
  private visible = false;
  private heading = 0;

  constructor(private rng: Rng, private hooks: CatHooks) {
    this.root.name = 'cat';
    this.nameplate = new Nameplate(CAT_NAME, ACCENT);
    this.overlay.add(this.nameplate.mesh);

    const mk = (g: THREE.BufferGeometry, mat: THREE.Material = FUR) => {
      this.geoms.push(g);
      const m = new THREE.Mesh(g, mat);
      m.castShadow = false;
      return m;
    };

    this.root.add(this.torso);
    this.torso.add(mk(bodyGeometry()));

    this.torso.add(this.head);
    this.head.position.set(0, 0.07, 0.15);
    this.head.add(mk(headGeometry()));
    this.eyes = mk(eyesGeometry(), EYE);
    this.lidsHappy = mk(lidsGeometry(true), LID_MAT);
    this.lidsSleep = mk(lidsGeometry(false), LID_MAT);
    this.lidsHappy.visible = this.lidsSleep.visible = false;
    this.head.add(this.eyes, this.lidsHappy, this.lidsSleep);

    const earG = earGeometry();
    for (const sx of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(sx * 0.058, 0.062, -0.006);
      g.add(mk(earG));
      g.userData.sx = sx;
      this.head.add(g);
      this.ears.push(g);
    }

    const legG = legGeometry();
    const legAt: V3[] = [[0.056, -0.04, 0.09], [-0.056, -0.04, 0.09], [0.062, -0.03, -0.1], [-0.062, -0.03, -0.1]];
    for (const p of legAt) {
      const g = new THREE.Group();
      g.position.set(...p);
      g.add(mk(legG));
      this.torso.add(g);
      this.legs.push(g);
    }

    let parent: THREE.Object3D = this.torso;
    for (let i = 0; i < TAIL_SEG; i++) {
      const g = new THREE.Group();
      g.position.set(0, i === 0 ? 0.02 : 0, i === 0 ? -0.14 : -TAIL_STEP);
      g.add(mk(tailGeometry(i)));
      parent.add(g);
      this.tail.push(g);
      parent = g;
    }

    // 발밑 그림자(AO 레이어 밖)
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,0.85)');
    grd.addColorStop(0.55, 'rgba(255,255,255,0.4)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 64, 64);
    const sg = new THREE.PlaneGeometry(0.46, 0.46);
    sg.rotateX(-Math.PI / 2);
    this.shadow = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({
      color: 0x140c06, alphaMap: new THREE.CanvasTexture(c), transparent: true, opacity: 0.38,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3,
    }));
    this.shadow.position.y = 0.006;
    this.shadow.layers.set(OVERLAY_LAYER);
    this.root.add(this.shadow);

    // 시작 위치: 허브 소파 앞 러그 가장자리
    this.root.position.set(-0.6, 0, 1.55);
    this.root.visible = false;
    this.nameplate.mesh.visible = false;
    this.enter('sit', 4);
  }

  get object(): THREE.Object3D {
    return this.root;
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.root.visible = v;
    if (!v) this.nameplate.mesh.visible = false;
    else this.placed = false;
  }

  get mood(): Mode {
    return this.mode;
  }

  /** 디버그·테스트: 동작을 강제로 지정 */
  force(mode: Mode, dur = 6): void {
    this.path = [];
    this.jump = null;
    this.after = null;
    this.enter(mode, dur);
  }

  /** 디버그·테스트: 행동 묶음(sofa, nap, zoomies, pounce …)을 바로 시작 */
  perform(kind: string): void {
    this.path = [];
    this.jump = null;
    this.after = null;
    this.startIdle(kind);
  }

  /** 화면 좌표가 고양이를 가리키는지 */
  hit(clientX: number, clientY: number, camera: THREE.Camera, rect: DOMRectReadOnly): boolean {
    if (!this.visible || !(camera instanceof THREE.PerspectiveCamera)) return false;
    const p = new THREE.Vector3(this.root.position.x, this.root.position.y + 0.17, this.root.position.z);
    const d = camera.position.distanceTo(p);
    p.project(camera);
    if (p.z > 1) return false;
    const sx = rect.left + (p.x * 0.5 + 0.5) * rect.width;
    const sy = rect.top + (-p.y * 0.5 + 0.5) * rect.height;
    const worldR = 0.3;
    const px = (worldR / (2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))) * rect.height;
    return Math.hypot(clientX - sx, clientY - sy) < Math.max(px, 26);
  }

  /** 쓰다듬기: 눈을 감고 그르릉 */
  pet(): void {
    if (!this.visible) return;
    this.path = [];
    this.after = null;
    if (this.jump) return;
    this.enter('happy', 3.4);
    this.speakAs('그르릉~', 3);
    this.hooks.onMeow?.();
  }

  private speakAs(text: string, sec: number): void {
    this.say = text;
    this.sayT = sec;
  }

  // ---------------------------------------------------------------- 상태 전환

  private enter(mode: Mode, dur: number): void {
    this.mode = mode;
    this.modeT = 0;
    this.modeDur = dur;
    this.lookT = 0;
    if (mode === 'meow') {
      this.speakAs('냐옹~', 1.6);
      this.hooks.onMeow?.();
    }
    if (mode === 'chase') this.spin = 0;
  }

  private randomFree(minDist = 1.2, maxDist = 4.5): Pt | null {
    const g = this.hooks.grid();
    const me = this.root.position;
    for (let k = 0; k < 24; k++) {
      const i = Math.floor(this.rng.float() * g.cols), j = Math.floor(this.rng.float() * g.rows);
      if (!g.free(i, j)) continue;
      const p = g.center(i, j);
      const d = Math.hypot(p.x - me.x, p.z - me.z);
      if (d < minDist || d > maxDist) continue;
      return p;
    }
    return null;
  }

  private walkTo(target: Pt, mode: Mode, speed: number, then: () => void): boolean {
    const g = this.hooks.grid();
    const me = this.root.position;
    const path = g.findPath({ x: me.x, z: me.z }, target);
    if (!path || path.length < 2) return false;
    this.path = path.slice(1);
    this.speed = speed;
    this.after = then;
    this.enter(mode, 999);
    return true;
  }

  private pickNext(): void {
    const r = this.rng;
    const hooks = this.hooks;
    // 소파 위: 낮잠·식빵·그루밍 위주, 자리가 차면 뛰어내림
    if (this.onSofa) {
      if (hooks.seatTaken(this.onSofa.id)) return this.hopDown();
      const opts: [string, number][] = [['sleep', 3], ['loaf', 3], ['groom', 2], ['meow', 0.6], ['stretch', 1], ['down', 1.6]];
      const pick = this.weighted(opts.filter(([k]) => k === 'down' || k !== (this.lastMode as string)));
      if (pick === 'down') return this.hopDown();
      return this.startIdle(pick);
    }
    // 방금 낮잠 → 기지개
    if (this.lastMode === 'sleep') return this.startIdle('stretch');

    const p = hooks.player();
    const me = this.root.position;
    const pd = Math.hypot(p.x - me.x, p.z - me.z);
    if (pd > 0.9 && pd < 4 && this.greetCool <= 0 && r.chance(0.55)) {
      if (this.greet(p)) return;
    }
    const opts: [string, number][] = [
      ['sit', 3], ['groom', 2], ['loaf', 2], ['stretch', 1.4], ['meow', 0.9], ['chase', 0.8],
      ['wander', 3.2], ['zoomies', 1], ['pounce', 1], ['sofa', 1.4], ['nap', 1],
    ];
    this.startIdle(this.weighted(opts.filter(([k]) => k !== (this.lastMode as string))));
  }

  private weighted(opts: [string, number][]): string {
    const total = opts.reduce((a, [, w]) => a + w, 0);
    let x = this.rng.float() * total;
    for (const [k, w] of opts) {
      x -= w;
      if (x <= 0) return k;
    }
    return opts[0][0];
  }

  private startIdle(kind: string): void {
    const r = this.rng;
    const done = () => this.enter('sit', r.range(2, 4));
    switch (kind) {
      case 'sit': return this.enter('sit', r.range(3, 7));
      case 'groom': return this.enter('groom', r.range(4, 6.5));
      case 'loaf': return this.enter('loaf', r.range(6, 12));
      case 'sleep': return this.enter('sleep', r.range(12, 22));
      case 'stretch': return this.enter('stretch', 2.6);
      case 'meow': return this.enter('meow', 1.8);
      case 'chase': return this.enter('chase', 3.2);
      case 'pounce': return this.pounce();
      case 'wander': {
        const t = this.randomFree();
        if (t && this.walkTo(t, 'walk', 0.5, done)) return;
        return this.enter('sit', 3);
      }
      case 'zoomies': return this.zoomies();
      case 'sofa': return this.goSofa();
      case 'nap': {
        // 러그 위에서 낮잠
        const rug = SPACE_LAYOUTS.hub.rug;
        const t: Pt = rug ? { x: rug.x + r.range(-0.5, 0.5), z: rug.z + r.range(-0.5, 0.5) } : { x: 2.2, z: 2 };
        if (this.walkTo(t, 'walk', 0.45, () => this.enter('sleep', r.range(10, 18)))) return;
        return this.enter('loaf', 6);
      }
      default: return this.enter('sit', 3);
    }
  }

  private greet(p: Pt): boolean {
    const me = this.root.position;
    const dx = me.x - p.x, dz = me.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    const target: Pt = { x: p.x + (dx / d) * 0.62, z: p.z + (dz / d) * 0.62 };
    this.greetCool = 28;
    return this.walkTo(target, 'walk', 0.75, () => {
      this.faceTo(this.hooks.player());
      this.enter('meow', 2);
    });
  }

  private zoomies(): void {
    const pts: Pt[] = [];
    for (let i = 0; i < 3; i++) {
      const t = this.randomFree(1, 5);
      if (t) pts.push(t);
    }
    if (!pts.length) return this.enter('sit', 3);
    const g = this.hooks.grid();
    let from: Pt = { x: this.root.position.x, z: this.root.position.z };
    const all: Pt[] = [];
    for (const t of pts) {
      const seg = g.findPath(from, t);
      if (seg && seg.length > 1) {
        all.push(...seg.slice(1));
        from = t;
      }
    }
    if (!all.length) return this.enter('sit', 3);
    this.path = all;
    this.speed = 1.9;
    this.after = () => this.enter('stand', 1.2);
    this.enter('run', 999);
  }

  private pounce(): void {
    // 숨을 죽이고 엉덩이를 흔든 뒤 앞으로 폴짝
    this.enter('crouch', 1.1);
    this.after = () => {
      const me = this.root.position;
      const dir = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
      const g = this.hooks.grid();
      let len = 0.6;
      while (len > 0.15 && !g.lineFree({ x: me.x, z: me.z }, { x: me.x + dir.x * len, z: me.z + dir.z * len })) len -= 0.15;
      const to = new THREE.Vector3(me.x + dir.x * len, this.baseY, me.z + dir.z * len);
      this.startLeap(to, 0.38, 0.14, 'sit');
    };
  }

  private goSofa(): void {
    const seats = SEATS.filter((s) => s.id.startsWith('sofa-') && !this.hooks.seatTaken(s.id));
    if (!seats.length) return this.enter('sit', 3);
    const seat = this.rng.pick(seats);
    const ap = seatApproach(seat, 0.55);
    const ok = this.walkTo(ap, 'walk', 0.6, () => {
      if (this.hooks.seatTaken(seat.id)) return this.enter('sit', 3);
      this.faceTo({ x: seat.x, z: seat.z });
      this.enter('crouch', 0.5);
      this.after = () => {
        this.startLeap(new THREE.Vector3(seat.x, SOFA_Y, seat.z), 0.6, 0.22, 'loaf', () => {
          this.onSofa = seat;
          this.heading = seat.ry;
        });
      };
    });
    if (!ok) this.enter('sit', 3);
  }

  private hopDown(): void {
    const seat = this.onSofa;
    if (!seat) return;
    const ap = seatApproach(seat, 0.62);
    this.faceTo(ap);
    this.enter('crouch', 0.4);
    this.after = () => {
      this.startLeap(new THREE.Vector3(ap.x, 0, ap.z), 0.55, 0.2, 'stand', () => {
        this.onSofa = null;
      });
    };
  }

  private startLeap(to: THREE.Vector3, dur: number, arc: number, after: Mode, onLand?: () => void): void {
    const from = this.root.position.clone();
    from.y = this.baseY;
    this.jump = { from, to, t: 0, dur, arc, after };
    this.enter('jump', dur + 1);
    this.after = onLand ?? null;
  }

  private faceTo(p: Pt): void {
    const me = this.root.position;
    this.heading = Math.atan2(p.x - me.x, p.z - me.z);
  }

  // ---------------------------------------------------------------- 매 프레임

  update(dt: number, t: number, camera: THREE.Camera): void {
    if (!this.visible) return;
    dt = Math.min(dt, 0.1);
    if (!this.placed) {
      const g = this.hooks.grid();
      const f = g.nearestFree({ x: this.root.position.x, z: this.root.position.z });
      if (f && !this.onSofa) this.root.position.set(f.x, 0, f.z);
      this.placed = true;
    }
    this.modeT += dt;
    this.greetCool -= dt;
    this.sayT -= dt;

    this.stepMotion(dt);
    this.stepBehavior(dt);
    this.applyPose(dt, t);
    this.updateLabel(camera);
  }

  private stepMotion(dt: number): void {
    const root = this.root;
    const j = this.jump;
    if (j) {
      j.t += dt;
      const u = clamp(j.t / j.dur, 0, 1);
      const e = u * u * (3 - 2 * u);
      root.position.set(
        j.from.x + (j.to.x - j.from.x) * e,
        j.from.y + (j.to.y - j.from.y) * e + j.arc * 4 * u * (1 - u),
        j.from.z + (j.to.z - j.from.z) * e,
      );
      this.baseY = root.position.y;
      const dx = j.to.x - j.from.x, dz = j.to.z - j.from.z;
      if (Math.hypot(dx, dz) > 0.02) this.heading = Math.atan2(dx, dz);
      if (u >= 1) {
        root.position.copy(j.to);
        this.baseY = j.to.y;
        this.jump = null;
        const cb = this.after;
        this.after = null;
        cb?.();
        this.enter(j.after, j.after === 'loaf' ? this.rng.range(5, 9) : 2);
        this.lastMode = 'jump';
      }
    } else if (this.path.length && (this.mode === 'walk' || this.mode === 'run')) {
      const tgt = this.path[0];
      const dx = tgt.x - root.position.x, dz = tgt.z - root.position.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      this.heading = want;
      const diff = Math.abs(wrap(want - root.rotation.y));
      const f = clamp(1 - diff / 1.3, 0.12, 1);
      const step = Math.min(dist, this.speed * f * dt);
      if (dist > 1e-4) {
        root.position.x += (dx / dist) * step;
        root.position.z += (dz / dist) * step;
      }
      this.gait = damp(this.gait, this.mode === 'run' ? 1 : 0.6, 8, dt);
      this.phase += dt * ((Math.PI * 2 * this.speed * f) / (this.mode === 'run' ? 0.34 : 0.2));
      if (dist < 0.06) this.path.shift();
      if (!this.path.length) {
        const cb = this.after;
        this.after = null;
        this.lastMode = this.mode;
        if (cb) cb();
        else this.enter('sit', 3);
      }
    } else {
      this.gait = damp(this.gait, 0, 7, dt);
    }
    if (this.mode === 'chase') {
      const u = this.modeT / this.modeDur;
      this.spin = Math.sin(clamp(u, 0, 1) * Math.PI) * 6.5;
      this.heading = root.rotation.y + this.spin * dt;
      root.rotation.y = this.heading;
    } else {
      root.rotation.y += wrap(this.heading - root.rotation.y) * (1 - Math.exp(-9 * dt));
    }
  }

  private stepBehavior(dt: number): void {
    // 시간제 동작이 끝나면 다음으로
    const timed = !(this.mode === 'walk' || this.mode === 'run' || this.mode === 'jump');
    if (timed && this.modeT >= this.modeDur) {
      const cb = this.after;
      if (cb && this.mode === 'crouch') {
        this.after = null;
        cb();
        return;
      }
      this.lastMode = this.mode;
      this.pickNext();
    }
    // 눈 깜빡임·귀 쫑긋·두리번
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.blinking = 0.13;
      this.blinkT = this.rng.range(2.2, 6);
    }
    this.blinking = Math.max(0, this.blinking - dt);
    this.flickT -= dt;
    if (this.flickT <= 0) {
      this.flick = 0.28;
      this.flickSide = this.rng.chance(0.3) ? 2 : this.rng.int(0, 1);
      this.flickT = this.rng.range(2, 5.5);
    }
    this.flick = Math.max(0, this.flick - dt);

    // 두리번 / 사람 쳐다보기
    const calm = this.mode === 'sit' || this.mode === 'stand' || this.mode === 'loaf' || this.mode === 'meow';
    if (calm) {
      const p = this.hooks.player();
      const me = this.root.position;
      const d = Math.hypot(p.x - me.x, p.z - me.z);
      if (d < 3.2) {
        const to = Math.atan2(p.x - me.x, p.z - me.z);
        this.lookYaw = clamp(wrap(to - this.root.rotation.y), -1.05, 1.05);
        this.lookPitch = clamp((d - 1.2) * -0.03, -0.25, 0.1);
        // 많이 돌아서 있으면 몸을 돌린다
        if (this.mode !== 'meow' && Math.abs(wrap(to - this.root.rotation.y)) > 1.2 && this.modeT > 0.8) this.heading = to;
      } else {
        this.lookT -= dt;
        if (this.lookT <= 0) {
          this.lookT = this.rng.range(1.6, 4);
          this.lookYaw = this.rng.range(-0.9, 0.9);
          this.lookPitch = this.rng.range(-0.15, 0.12);
        }
      }
    } else if (this.mode !== 'chase') {
      this.lookYaw = 0;
      this.lookPitch = 0;
    }
  }

  private applyPose(dt: number, t: number): void {
    const target = { ...POSES[this.mode] };
    const m = this.mode;
    const cur = this.cur;

    // 모드별 덧입히기
    const tt = this.modeT;
    if (m === 'sit' || m === 'stand' || m === 'loaf' || m === 'meow') {
      target.hy += this.lookYaw;
      target.hp += this.lookPitch;
    }
    if (m === 'groom') {
      target.hp += Math.sin(tt * 7) * 0.12;
      target.hy += Math.sin(tt * 1.3) * 0.15;
      target.rf += Math.sin(tt * 7 + 1) * 0.28;
    }
    if (m === 'meow') {
      const pulse = Math.max(0, Math.sin(tt * 4.2 * Math.PI * 0.6));
      target.hp -= pulse * 0.22;
      target.hr += Math.sin(tt * 5) * 0.06;
    }
    if (m === 'happy') {
      target.hr += Math.sin(tt * 2.2) * 0.1;
      target.hp += Math.sin(tt * 9) * 0.03;
    }
    if (m === 'stretch') {
      // 앞다리를 쭉 뻗었다가 천천히 일어난다
      const u = clamp(tt / this.modeDur, 0, 1);
      const k = u < 0.18 ? u / 0.18 : u > 0.82 ? (1 - u) / 0.18 : 1;
      for (const key of ['y', 'pitch', 'hp', 'lf', 'rf', 'lb', 'rb', 'sf', 'sb', 'tp', 'open'] as const) {
        target[key] = STAND[key] + (target[key] - STAND[key]) * k;
      }
    }
    if (m === 'jump' && this.jump) {
      const u = clamp(this.jump.t / this.jump.dur, 0, 1);
      target.pitch = -0.45 + u * 0.8;
    }
    if (m === 'crouch') {
      target.pitch = 0.04 + Math.sin(tt * 3) * 0.02;
    }

    // 현재 자세를 목표로
    const rate = m === 'jump' ? 16 : m === 'crouch' ? 10 : m === 'run' ? 12 : 7;
    for (const k of POSE_KEYS) cur[k] = damp(cur[k], target[k], rate, dt);

    // ---- 적용
    const breathe = Math.sin(t * (m === 'sleep' ? 1.9 : 3.1)) * (m === 'sleep' ? 0.028 : 0.014);
    this.torso.scale.set(1 + breathe * 0.5, 1 + breathe, 1);

    let bob = 0, bound = 0;
    const ga = this.gait;
    if (ga > 0.02) {
      const sw = Math.sin(this.phase);
      bob = Math.abs(sw) * 0.008 * ga + (m === 'run' ? Math.sin(this.phase * 2) * 0.012 : 0);
      bound = m === 'run' ? Math.sin(this.phase + 0.6) * 0.09 : sw * 0.02;
    }
    const wig = m === 'crouch' ? Math.sin(tt * 26) * 0.1 * clamp(tt / 0.6, 0, 1) : 0;
    this.torso.position.set(0, cur.y + bob, cur.zs);
    this.torso.rotation.set(cur.pitch + bound, wig, cur.roll);

    // 다리
    const swing = Math.sin(this.phase) * 0.62 * ga * (m === 'run' ? 1.5 : 1);
    this.legs[0].rotation.x = cur.lf + swing;
    this.legs[1].rotation.x = cur.rf - swing;
    this.legs[2].rotation.x = cur.lb - swing;
    this.legs[3].rotation.x = cur.rb + swing;
    this.legs[0].scale.y = this.legs[1].scale.y = cur.sf;
    this.legs[2].scale.y = this.legs[3].scale.y = cur.sb;

    // 머리
    this.head.position.set(0, 0.07 + cur.hdy, 0.15 + cur.hdz);
    this.head.rotation.set(cur.hp + (ga > 0.02 ? Math.sin(this.phase * 2) * 0.03 : 0), cur.hy, cur.hr);

    // 귀
    for (let i = 0; i < 2; i++) {
      const g = this.ears[i];
      const sx = g.userData.sx as number;
      const fl = this.flickSide === 2 || this.flickSide === i ? Math.sin((this.flick / 0.28) * Math.PI) : 0;
      g.rotation.z = -sx * (0.38 + cur.ear * 0.55) + sx * fl * 0.35;
      g.rotation.x = 0.1 - cur.ear * 0.5 + fl * 0.15;
    }

    // 눈
    const closed = cur.open < 0.3;
    const blink = this.blinking > 0 ? 0.08 : 1;
    this.eyes.visible = !closed;
    this.eyes.scale.set(1, Math.max(0.08, cur.open * blink), 1);
    const happy = m === 'happy' || m === 'groom';
    this.lidsHappy.visible = closed && happy;
    this.lidsSleep.visible = closed && !happy;

    // 꼬리
    const tailUp = m === 'happy';
    for (let i = 0; i < TAIL_SEG; i++) {
      const g = this.tail[i];
      const wave = Math.sin(t * Math.PI * 2 * cur.swHz - i * 0.9);
      const pitch = i === 0 ? cur.tp : i === TAIL_SEG - 1 ? -cur.tc * 1.2 : cur.tc * (1 - i * 0.4);
      g.rotation.x = pitch + (tailUp ? wave * 0.05 : 0);
      g.rotation.y = cur.ty + wave * cur.sw * (0.6 + i * 0.45);
    }

    this.root.position.y = this.baseY;
    // 그림자: 점프 중 높이에 따라 흐려짐
    const air = this.jump ? Math.max(0, this.root.position.y - Math.min(this.jump.from.y, this.jump.to.y)) : 0;
    this.shadow.position.y = 0.006 - air;
    this.shadow.scale.setScalar(m === 'loaf' || m === 'sleep' ? 1.15 : 1);
  }

  private updateLabel(camera: THREE.Camera): void {
    const sub = this.sayT > 0 ? this.say : this.mode === 'sleep' ? 'zZ' : '';
    this.nameplate.set(CAT_NAME, ACCENT, sub);
    const p = this.root.position;
    const h = this.mode === 'sleep' || this.mode === 'loaf' ? 0.3 : 0.5;
    this.nameplate.mesh.visible = !this.hooks.labelsHidden();
    this.nameplate.update(new THREE.Vector3(p.x, p.y + h + 0.1, p.z), camera);
    // 고양이는 작으니 이름표도 조금 작게
    this.nameplate.mesh.scale.multiplyScalar(0.8);
  }

  dispose(): void {
    for (const g of this.geoms) g.dispose();
    this.nameplate.dispose();
    this.root.removeFromParent();
    this.overlay.removeFromParent();
  }
}
