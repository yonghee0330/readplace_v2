// 절차 아바타: 둥글고 머리 큰 독서가(키 약 0.9m). 뼈 없이 부위 트랜스폼으로 움직인다.
// 머리·머리카락·볼 홍조는 정점 색으로 한 메시에 합쳐 드로우콜을 줄인다(아바타 하나 = 7~8콜).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AvatarState, HairStyle } from '../net/presence';
import { AvatarAnimator } from './animations';

const SKIN = new THREE.Color('#f3d2b5');
const HAIR = new THREE.Color('#2c211b');
const HAIR_GRAY = new THREE.Color('#9a9590');
const HAIR_STREAK = HAIR.clone().lerp(HAIR_GRAY, 0.75);
const BEARD = new THREE.Color('#4a433c');
const BEARD_GRAY = new THREE.Color('#a8a29a');
const STUBBLE = BEARD.clone().lerp(SKIN, 0.5);
const STUBBLE_GRAY = BEARD_GRAY.clone().lerp(SKIN, 0.3);
const BROW = new THREE.Color('#2a2420');
const BLUSH = new THREE.Color('#f09a8c');
const PANTS = new THREE.Color('#3d3833');
const SHOE = new THREE.Color('#2a211c');
const GOLD = new THREE.Color('#c4a46a');
const MOLE = new THREE.Color('#5a3a28');

/** 써든리 매니저의 옷 색(먼지 낀 핑크 티셔츠). 매니저는 look.color 대신 이 색을 쓴다. */
export const MANAGER_COLOR = '#d6b0ab';

/** 모든 아바타가 같이 쓰는 재질(색은 정점 색). */
const SHARED = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 });
const EYE_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25 });

export const HEAD_Y = 0.69;
export const HIP_Y = 0.2;

/** 정점 위치(y, x, z)로 색을 정하는 함수. */
export type Painter = (y: number, x: number, z: number) => THREE.Color;

export function paint(g: THREE.BufferGeometry, color: THREE.Color | Painter): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  const pos = ng.getAttribute('position');
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const c = typeof color === 'function' ? color(pos.getY(i), pos.getX(i), pos.getZ(i)) : color;
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  ng.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  for (const k of Object.keys(ng.attributes)) if (!['position', 'normal', 'color'].includes(k)) ng.deleteAttribute(k);
  return ng;
}

export function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(list)!;
  g.computeBoundingSphere();
  return g;
}

/** 앞쪽(+z)을 비워 둔 구 조각. 머리카락용. */
function hairShell(r: number, frontGap: number, thetaLen: number, thetaStart = 0): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, 28, 14, Math.PI / 2 + frontGap / 2, Math.PI * 2 - frontGap, thetaStart, thetaLen);
}

/** 회색 머리가 군데군데 섞인 머리색(써든리용). */
const graying: Painter = (y, x, z) => {
  const s = Math.sin(x * 95 + z * 41 + y * 23) * Math.sin(z * 77 - x * 29 + y * 57);
  return s > 0.35 ? HAIR_STREAK : HAIR;
};

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
  const hc: THREE.Color | Painter = hair === 'curtain' ? graying : HAIR;
  // 머리카락 3종 + 써든리용 커튼
  const top = (thetaLen: number, tilt: number, r = 0.226) => {
    const g = new THREE.SphereGeometry(r, 28, 12, 0, Math.PI * 2, 0, thetaLen);
    g.rotateX(-tilt);
    return paint(g, hc);
  };
  if (hair === 'bangs') {
    parts.push(top(Math.PI * 0.5, 0.2));
    // 앞머리: 이마를 덮는 띠
    // phi가 π/2 근처면 +z(얼굴 쪽)
    const fringe = new THREE.SphereGeometry(0.229, 24, 6, Math.PI * 0.12, Math.PI * 0.76, Math.PI * 0.2, Math.PI * 0.16);
    parts.push(paint(fringe, hc));
    parts.push(paint(hairShell(0.228, Math.PI * 0.9, Math.PI * 0.62), hc));
  } else if (hair === 'bob') {
    parts.push(top(Math.PI * 0.42, 0.05, 0.232));
    parts.push(paint(hairShell(0.236, Math.PI * 0.62, Math.PI * 0.7), hc));
    const fringe = new THREE.SphereGeometry(0.234, 24, 6, Math.PI * 0.1, Math.PI * 0.8, Math.PI * 0.18, Math.PI * 0.12);
    parts.push(paint(fringe, hc));
  } else if (hair === 'curtain') {
    // 써든리 매니저: 숱 많은 검은 머리에 흰머리가 섞인 커튼 헤어.
    // 정수리는 이마 위까지만, 앞머리 띠가 눈썹 바로 위까지 내려오고, 옆머리는 귀 윗부분을 덮는다.
    parts.push(top(Math.PI * 0.36, 0.08, 0.228));
    parts.push(paint(hairShell(0.23, Math.PI * 0.7, Math.PI * 0.66), hc));
    const fringe = new THREE.SphereGeometry(0.231, 24, 8, Math.PI * 0.16, Math.PI * 0.68, Math.PI * 0.2, Math.PI * 0.19);
    parts.push(paint(fringe, hc));
  } else {
    parts.push(top(Math.PI * 0.4, 0.32, 0.224));
    // 정수리 삐침
    const tuft = new THREE.ConeGeometry(0.03, 0.08, 8);
    tuft.rotateZ(-0.5);
    tuft.translate(0.03, 0.235, -0.02);
    parts.push(paint(tuft, HAIR));
  }
  return merge(parts);
}

/** 써든리 얼굴 요소: 귀, 코, 짙은 눈썹, 콧수염, 턱선을 따라 난 회색 섞인 수염, 오른쪽 볼 점. */
function faceExtrasGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // 귀(사진에서 귀가 눈에 띈다): 머리카락 바깥으로 살짝 튀어나오게
  for (const sx of [-1, 1]) {
    const ear = new THREE.SphereGeometry(0.045, 12, 10);
    ear.scale(0.35, 1, 0.7);
    ear.translate(sx * 0.228, -0.03, 0.0);
    parts.push(paint(ear, SKIN));
  }

  // 코
  const nose = new THREE.SphereGeometry(0.022, 12, 10);
  nose.scale(0.85, 1.05, 0.95);
  nose.translate(0, -0.03, 0.205);
  parts.push(paint(nose, SKIN));

  // 눈썹: 두껍고 안쪽이 살짝 내려온 찡그린 모양. 머리 곡면을 따라 기울여 붙인다.
  for (const sx of [-1, 1]) {
    const b = new THREE.BoxGeometry(0.07, 0.016, 0.012);
    b.rotateZ(sx * 0.14);
    b.rotateY(sx * 0.4);
    b.translate(sx * 0.08, 0.066, 0.19);
    parts.push(paint(b, BROW));
  }

  // 턱선 수염(까칠하게 난 부분): 얼굴 아래쪽 앞면을 얇게 덮고 턱 쪽은 회색
  const jaw = new THREE.SphereGeometry(0.2185, 28, 10, Math.PI * 0.5 - Math.PI * 0.5, Math.PI * 1.0, 2.0, 0.85);
  parts.push(paint(jaw, (y, x, z) => {
    const gray = y < -0.15 || Math.sin(x * 130 + z * 70) * Math.sin(z * 110 - y * 60) > 0.5;
    return gray ? STUBBLE_GRAY : STUBBLE;
  }));

  // 콧수염: 입 위 납작한 덩어리 + 양 끝이 살짝 처진 모양, 회색 살짝
  const stache = BEARD.clone().lerp(BEARD_GRAY, 0.25);
  for (const sx of [-1, 1]) {
    const m = new THREE.SphereGeometry(0.042, 12, 10);
    m.scale(1.1, 0.4, 0.5);
    m.translate(sx * 0.036, -0.05, 0.2);
    parts.push(paint(m, stache));
    const droop = new THREE.SphereGeometry(0.024, 10, 8);
    droop.scale(0.9, 0.6, 0.5);
    droop.translate(sx * 0.07, -0.07, 0.185);
    parts.push(paint(droop, stache));
  }
  const mid = new THREE.SphereGeometry(0.022, 10, 8);
  mid.scale(1.1, 0.35, 0.4);
  mid.translate(0, -0.052, 0.202);
  parts.push(paint(mid, stache));

  // 턱수염: 턱 앞에 붙는 넉넉한 타원, 아래로 갈수록 회색
  const goatee = new THREE.SphereGeometry(0.06, 14, 12);
  goatee.scale(0.85, 0.9, 0.45);
  goatee.translate(0, -0.165, 0.15);
  parts.push(paint(goatee, (y) => (y < -0.14 ? BEARD_GRAY : BEARD)));

  // 볼 점
  const mole = new THREE.SphereGeometry(0.007, 8, 6);
  mole.translate(-0.115, -0.035, 0.188);
  parts.push(paint(mole, MOLE));
  return merge(parts);
}

/** 얇은 금속테 안경. 렌즈가 큼직하고 살짝 납작한 원형. XY면(정면 +z)을 바라본다. */
function glassesGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const z = 0.21;
  const rimR = 0.05;
  const rimX = 0.082;
  for (const sx of [-1, 1]) {
    const t = new THREE.TorusGeometry(rimR, 0.0038, 8, 28);
    t.scale(1, 0.92, 1);
    t.translate(sx * rimX, 0, z);
    parts.push(paint(t, GOLD));
  }
  // 브릿지
  const bridge = new THREE.BoxGeometry(rimX * 2 - rimR * 2 + 0.004, 0.005, 0.005);
  bridge.translate(0, 0.012, z);
  parts.push(paint(bridge, GOLD));
  // 코받침
  for (const sx of [-1, 1]) {
    const pad = new THREE.SphereGeometry(0.006, 8, 6);
    pad.scale(0.7, 1, 0.7);
    pad.translate(sx * 0.026, -0.012, z - 0.008);
    parts.push(paint(pad, GOLD));
  }
  // 다리: 렌즈 바깥쪽에서 귀 쪽으로 비스듬히
  for (const sx of [-1, 1]) {
    const len = 0.11;
    const arm = new THREE.BoxGeometry(0.005, 0.005, len);
    arm.rotateY(-sx * 0.364);
    arm.translate(sx * (rimX + rimR + 0.0196), 0.012, z - 0.0514);
    parts.push(paint(arm, GOLD));
  }
  return merge(parts);
}

// ───────────────────────── 몸통 + 목수 앞치마 ─────────────────────────

/** 몸통 단면 [반지름, 높이]. 몸통과 앞치마가 같은 표를 써서 딱 맞게 붙는다. */
const BODY_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.001, 0], [0.11, 0.0], [0.14, 0.03], [0.155, 0.09], [0.15, 0.16], [0.13, 0.23], [0.095, 0.28], [0.06, 0.3], [0.001, 0.305],
];

/** 높이 y에서 몸통 반지름. */
function bodyR(y: number): number {
  for (let i = 1; i < BODY_PROFILE.length; i++) {
    const [r0, y0] = BODY_PROFILE[i - 1];
    const [r1, y1] = BODY_PROFILE[i];
    if (y1 > y0 && y >= y0 && y <= y1) return r0 + (r1 - r0) * ((y - y0) / (y1 - y0));
  }
  return 0.06;
}

/** 몸통 표면에서 off만큼 띄운 앞면 z 좌표(옆으로 x만큼 간 지점). */
function frontZ(y: number, x: number, off: number): number {
  const r = bodyR(y) + off;
  return Math.sqrt(Math.max(0, r * r - x * x));
}

/** 몸통 앞면(+z)을 span 각도만큼 감싸는 얇은 껍질. ys는 아래→위 순서. */
function shell(ys: number[], off: number, span: number, color: THREE.Color | Painter, segs = 20): THREE.BufferGeometry {
  const pts = ys.map((y) => new THREE.Vector2(bodyR(y) + off, y));
  return paint(new THREE.LatheGeometry(pts, segs, -span / 2, span), color);
}

const CANVAS = new THREE.Color('#b08d5b'); // 면 캔버스 천
const CANVAS_DARK = new THREE.Color('#93713f'); // 주머니 천
const LEATHER = new THREE.Color('#5a3d28'); // 가죽 보강·허리띠
const WEBBING = new THREE.Color('#6b4a30'); // 어깨끈
const COPPER = new THREE.Color('#b87333'); // 리벳
const STITCH = new THREE.Color('#e8dcc0'); // 박음질
const STEEL = new THREE.Color('#6d7075');
const WOOD = new THREE.Color('#b07a45');
const TAPE_YELLOW = new THREE.Color('#e6c02e');
const PENCIL_RED = new THREE.Color('#c0392b');
const PENCIL_TIP = new THREE.Color('#2b2b2b');

/** 어깨끈: 앞치마 가슴판 위쪽에서 어깨를 넘어 등 쪽 허리띠까지. 옷깃 위로 둥글게 넘어간다. */
function strapGeometry(sx: number): THREE.BufferGeometry {
  const x = sx * 0.048;
  const at = (y: number, rho: number, back: boolean) => {
    const z = Math.sqrt(Math.max(0.0004, rho * rho - x * x));
    return new THREE.Vector3(x, y, back ? -z : z);
  };
  const pts: THREE.Vector3[] = [
    at(0.262, bodyR(0.262) + 0.012, false),
    at(0.276, 0.112, false),
    at(0.288, 0.105, false),
    at(0.3, 0.098, false),
    at(0.312, 0.085, false),
    new THREE.Vector3(x, 0.316, 0),
    at(0.312, 0.085, true),
    at(0.3, 0.098, true),
    at(0.288, 0.105, true),
    at(0.276, 0.112, true),
    at(0.26, bodyR(0.26) + 0.012, true),
    at(0.23, bodyR(0.23) + 0.012, true),
    at(0.2, bodyR(0.2) + 0.012, true),
    at(0.188, bodyR(0.188) + 0.014, true),
  ];
  const curve = new THREE.CatmullRomCurve3(pts);
  return paint(new THREE.TubeGeometry(curve, 48, 0.0075, 6, false), WEBBING);
}

/** 목수 작업용 앞치마: 캔버스 가슴판 + 큰 못주머니 + 가슴 주머니(연필) + 망치·줄자 + 가죽 허리띠. */
function apronGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // 치마(허리 아래): 아랫단은 가죽으로 보강
  parts.push(shell([0.02, 0.05, 0.055, 0.09, 0.16], 0.008, Math.PI * 0.6, (y) => (y <= 0.05 ? LEATHER : CANVAS), 24));
  // 가슴판(허리 위)
  parts.push(shell([0.158, 0.2, 0.24, 0.272], 0.008, Math.PI * 0.36, CANVAS, 16));
  // 가죽 허리띠(몸을 한 바퀴)
  parts.push(shell([0.148, 0.184], 0.016, Math.PI * 2, LEATHER, 32));
  // 버클
  const buckle = new THREE.BoxGeometry(0.032, 0.026, 0.008);
  buckle.translate(0, 0.166, bodyR(0.166) + 0.02);
  parts.push(paint(buckle, GOLD));

  // 큰 못주머니(치마 앞면) + 윗단 가죽
  parts.push(shell([0.045, 0.108, 0.112, 0.122], 0.016, Math.PI * 0.28, (y) => (y >= 0.11 ? LEATHER : CANVAS_DARK), 16));
  // 주머니 칸막이 박음질 2줄
  for (const sx of [-1, 1]) {
    const x = sx * 0.026;
    const seam = new THREE.BoxGeometry(0.004, 0.066, 0.004);
    seam.translate(x, 0.076, frontZ(0.076, x, 0.016) + 0.001);
    parts.push(paint(seam, STITCH));
  }
  // 주머니 윗단 리벳 4개
  for (const x of [-0.068, -0.026, 0.026, 0.068]) {
    const rivet = new THREE.SphereGeometry(0.0048, 8, 6);
    rivet.translate(x, 0.116, frontZ(0.116, x, 0.016) + 0.002);
    parts.push(paint(rivet, COPPER));
  }

  // 가슴 주머니 + 연필
  parts.push(shell([0.195, 0.226, 0.23, 0.238], 0.014, Math.PI * 0.21, (y) => (y >= 0.228 ? LEATHER : CANVAS_DARK), 12));
  const pencil = new THREE.CylinderGeometry(0.0045, 0.0045, 0.056, 6);
  pencil.rotateZ(0.1);
  pencil.translate(-0.018, 0.245, frontZ(0.22, -0.018, 0.008));
  parts.push(paint(pencil, (y) => (y > 0.264 ? PENCIL_TIP : PENCIL_RED)));

  // 오른쪽 허리(아바타 기준)에 망치: 머리는 허리띠 위, 자루는 치마를 따라 아래로
  {
    const x = -0.1;
    const a = Math.asin(x / (bodyR(0.125) + 0.017));
    const handle = new THREE.CylinderGeometry(0.0065, 0.0065, 0.1, 8);
    handle.translate(x, 0.125, frontZ(0.125, x, 0.017));
    parts.push(paint(handle, WOOD));
    const head = new THREE.BoxGeometry(0.052, 0.018, 0.02);
    head.rotateY(a);
    head.translate(x, 0.19, frontZ(0.19, x, 0.017));
    parts.push(paint(head, STEEL));
    const loop = new THREE.BoxGeometry(0.02, 0.012, 0.02);
    loop.rotateY(a);
    loop.translate(x, 0.152, frontZ(0.152, x, 0.016));
    parts.push(paint(loop, LEATHER));
  }

  // 왼쪽 허리에 줄자
  {
    const x = 0.1;
    const a = Math.asin(x / (bodyR(0.135) + 0.02));
    const tape = new THREE.CylinderGeometry(0.02, 0.02, 0.016, 14);
    tape.rotateX(Math.PI / 2);
    tape.rotateY(a);
    tape.translate(x, 0.132, frontZ(0.132, x, 0.02));
    parts.push(paint(tape, TAPE_YELLOW));
    const tab = new THREE.BoxGeometry(0.012, 0.008, 0.008);
    tab.rotateY(a);
    tab.translate(x + 0.012, 0.108, frontZ(0.108, x + 0.012, 0.02));
    parts.push(paint(tab, PENCIL_TIP));
    const clip = new THREE.BoxGeometry(0.012, 0.03, 0.012);
    clip.rotateY(a);
    clip.translate(x, 0.158, frontZ(0.158, x, 0.016));
    parts.push(paint(clip, LEATHER));
  }

  // 어깨끈 2줄
  parts.push(strapGeometry(-1), strapGeometry(1));
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
  const prof = BODY_PROFILE.map(([x, y]) => new THREE.Vector2(x, y));
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

/** 손에 드는 잔(도자기 + 음료 수면). liquid는 정점 색으로. */
function cupGeometry(liquid: THREE.Color): THREE.BufferGeometry {
  const ceramic = new THREE.Color('#f2ebe0');
  const parts: THREE.BufferGeometry[] = [];
  const body = new THREE.CylinderGeometry(0.028, 0.024, 0.055, 14, 1, true);
  body.translate(0, 0.028, 0);
  parts.push(paint(body, ceramic));
  const bottom = new THREE.CircleGeometry(0.024, 14);
  bottom.rotateX(-Math.PI / 2);
  parts.push(paint(bottom, ceramic));
  const rim = new THREE.TorusGeometry(0.028, 0.0035, 8, 18);
  rim.rotateX(Math.PI / 2);
  rim.translate(0, 0.055, 0);
  parts.push(paint(rim, ceramic));
  const drink = new THREE.CircleGeometry(0.025, 14);
  drink.rotateX(-Math.PI / 2);
  drink.translate(0, 0.05, 0);
  parts.push(paint(drink, liquid));
  const handle = new THREE.TorusGeometry(0.016, 0.004, 8, 14, Math.PI);
  handle.rotateY(Math.PI / 2);
  handle.translate(0.03, 0.03, 0);
  parts.push(paint(handle, ceramic));
  return merge(parts);
}

export const CAN_STYLE_COUNT = 7;

/** 물뿌리개 7종. 주둥이는 대략 +z, 손잡이 위치·몸통 실루엣이 서로 다르다. */
function wateringCanGeometry(style = 0): THREE.BufferGeometry {
  const palettes = [
    ['#e8a317', '#c88810'],
    ['#7dba8a', '#4e8a62'],
    ['#e07a62', '#b55240'],
    ['#6eb0d4', '#3d7ea8'],
    ['#f3ead2', '#c4b496'],
    ['#b7a0d4', '#7d68a8'],
    ['#c46a3a', '#8a4524'],
  ];
  const [a, b] = palettes[((style % 7) + 7) % 7]!;
  const main = new THREE.Color(a);
  const deep = new THREE.Color(b);
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, c: THREE.Color) => parts.push(paint(g, c));
  const i = ((style % 7) + 7) % 7;

  if (i === 1) {
    // 둥근 몸통 · 짧은 주둥이 · 옆 고리 손잡이
    const body = new THREE.SphereGeometry(0.038, 16, 12);
    body.translate(0, 0.042, 0);
    add(body, main);
    const neck = new THREE.CylinderGeometry(0.016, 0.022, 0.02, 12);
    neck.translate(0, 0.072, 0);
    add(neck, deep);
    const spout = new THREE.CylinderGeometry(0.007, 0.01, 0.034, 8);
    spout.rotateX(Math.PI / 2.3);
    spout.translate(0, 0.05, 0.038);
    add(spout, main);
    const handle = new THREE.TorusGeometry(0.016, 0.0045, 8, 14);
    handle.rotateY(Math.PI / 2);
    handle.translate(-0.034, 0.05, 0);
    add(handle, deep);
  } else if (i === 2) {
    // 길쭉한 콘 · 긴 주둥이 · 작은 고리
    const body = new THREE.CylinderGeometry(0.02, 0.034, 0.09, 14);
    body.translate(0, 0.05, 0);
    add(body, main);
    const spout = new THREE.CylinderGeometry(0.005, 0.008, 0.07, 8);
    spout.rotateX(Math.PI / 2.15);
    spout.translate(0, 0.07, 0.04);
    add(spout, deep);
    const rose = new THREE.SphereGeometry(0.012, 10, 8);
    rose.translate(0, 0.055, 0.078);
    add(rose, main);
    const handle = new THREE.TorusGeometry(0.014, 0.0035, 6, 12);
    handle.translate(0, 0.1, -0.01);
    add(handle, deep);
  } else if (i === 3) {
    // 납작하고 넓은 몸통 · 큰 샤워 헤드
    const body = new THREE.CylinderGeometry(0.046, 0.048, 0.042, 16);
    body.translate(0, 0.028, 0);
    add(body, main);
    const spout = new THREE.CylinderGeometry(0.012, 0.014, 0.04, 10);
    spout.rotateX(Math.PI / 2.5);
    spout.translate(0, 0.03, 0.04);
    add(spout, deep);
    const rose = new THREE.CylinderGeometry(0.022, 0.02, 0.008, 14);
    rose.rotateX(Math.PI / 2.3);
    rose.translate(0, 0.02, 0.062);
    add(rose, main);
    const handle = new THREE.TorusGeometry(0.02, 0.004, 6, 12, Math.PI);
    handle.rotateY(Math.PI / 2);
    handle.translate(-0.04, 0.04, 0);
    add(handle, deep);
  } else if (i === 4) {
    // 저그 · 주둥이 대신 짧은 립 · 큰 옆 손잡이
    const body = new THREE.CylinderGeometry(0.03, 0.036, 0.075, 8);
    body.translate(0, 0.042, 0);
    add(body, main);
    const lip = new THREE.BoxGeometry(0.02, 0.012, 0.028);
    lip.translate(0, 0.07, 0.028);
    add(lip, deep);
    const handle = new THREE.TorusGeometry(0.022, 0.005, 8, 14, Math.PI * 1.15);
    handle.rotateY(Math.PI / 2);
    handle.translate(-0.028, 0.05, 0);
    add(handle, deep);
  } else if (i === 5) {
    // 종 모양 · 위로 굽은 손잡이
    const body = new THREE.CylinderGeometry(0.04, 0.022, 0.07, 16);
    body.translate(0, 0.04, 0);
    add(body, main);
    const spout = new THREE.CylinderGeometry(0.006, 0.009, 0.05, 8);
    spout.rotateX(1.15);
    spout.translate(0, 0.055, 0.036);
    add(spout, deep);
    const handle = new THREE.TorusGeometry(0.03, 0.004, 6, 16, Math.PI);
    handle.rotateZ(Math.PI);
    handle.translate(0, 0.095, 0);
    add(handle, main);
  } else if (i === 6) {
    // 돔 · 거위목 주둥이
    const body = new THREE.SphereGeometry(0.036, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.65);
    body.translate(0, 0.02, 0);
    add(body, main);
    const base = new THREE.CylinderGeometry(0.03, 0.034, 0.02, 14);
    base.translate(0, 0.012, 0);
    add(base, deep);
    const neck = new THREE.TorusGeometry(0.02, 0.006, 6, 10, Math.PI * 0.7);
    neck.rotateY(Math.PI / 2);
    neck.rotateZ(-0.4);
    neck.translate(0, 0.05, 0.02);
    add(neck, main);
    const rose = new THREE.CylinderGeometry(0.012, 0.01, 0.006, 10);
    rose.rotateX(0.8);
    rose.translate(0, 0.04, 0.05);
    add(rose, deep);
  } else {
    // 기본: 높은 원통 · 긴 주둥이 · 위 아치 손잡이
    const body = new THREE.CylinderGeometry(0.034, 0.04, 0.07, 16);
    body.translate(0, 0.04, 0);
    add(body, main);
    const rim = new THREE.TorusGeometry(0.032, 0.004, 6, 16);
    rim.rotateX(Math.PI / 2);
    rim.translate(0, 0.074, 0);
    add(rim, deep);
    const spout = new THREE.CylinderGeometry(0.008, 0.011, 0.055, 8);
    spout.rotateX(Math.PI / 2.6);
    spout.translate(0, 0.045, 0.04);
    add(spout, main);
    const rose = new THREE.CylinderGeometry(0.016, 0.014, 0.006, 12);
    rose.rotateX(Math.PI / 2.4);
    rose.translate(0, 0.038, 0.068);
    add(rose, deep);
    const handle = new THREE.TorusGeometry(0.026, 0.005, 8, 16, Math.PI);
    handle.rotateZ(Math.PI);
    handle.translate(0, 0.09, -0.006);
    add(handle, main);
  }
  return merge(parts);
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
  /** 써든리 매니저 전용 외형(안경·수염·목수 앞치마 등) */
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
  /** 마실 때 오른손에 드는 잔 */
  readonly cup: THREE.Mesh;
  /** 화분에 물 줄 때 드는 물뿌리개 */
  readonly can: THREE.Mesh;
  readonly drops: THREE.Mesh[];
  readonly anim: AvatarAnimator;
  private meshes: THREE.Mesh[] = [];
  private look: AvatarLook;
  private canStyle = 0;

  constructor(look: AvatarLook) {
    this.look = { ...look };
    this.root.name = 'avatar';
    this.eyes = new THREE.Mesh(eyesGeometry(), EYE_MAT);
    this.eyes.position.set(0, -0.01, 0.192);
    this.book = new THREE.Mesh(heldBookGeometry(new THREE.Color('#8c2f2a')), SHARED);
    this.book.visible = false;
    this.cup = new THREE.Mesh(cupGeometry(new THREE.Color('#9ec9e0')), SHARED);
    this.cup.visible = false;
    this.can = new THREE.Mesh(wateringCanGeometry(0), SHARED);
    this.can.visible = false;
    const dropMat = new THREE.MeshBasicMaterial({ color: 0x8fd0ea, transparent: true, opacity: 0.8 });
    this.drops = [0, 1, 2, 3, 4].map(() => {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), dropMat);
      d.visible = false;
      this.can.add(d);
      return d;
    });
    this.build();
    this.anim = new AvatarAnimator(this);
  }

  /** 잔 속 음료 색을 바꾼다. */
  setCupLiquid(hex: string): void {
    this.cup.geometry.dispose();
    this.cup.geometry = cupGeometry(new THREE.Color(hex));
  }

  /** 화분마다 다른 물뿌리개. */
  setCanStyle(style: number): void {
    const i = ((style % CAN_STYLE_COUNT) + CAN_STYLE_COUNT) % CAN_STYLE_COUNT;
    if (i === this.canStyle) return;
    this.canStyle = i;
    this.can.geometry.dispose();
    this.can.geometry = wateringCanGeometry(i);
  }

  private build(): void {
    for (const m of this.meshes) {
      m.removeFromParent();
      m.geometry.dispose();
    }
    this.meshes = [];
    const outfit = new THREE.Color(this.look.manager ? MANAGER_COLOR : this.look.color);
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
    // 오른팔 끝(손 근처)에 잔
    this.armR.add(this.cup);
    this.cup.position.set(0.01, -0.175, 0.02);
    this.cup.rotation.set(0.35, 0.2, -0.4);
    this.cup.scale.setScalar(1);
    this.armR.add(this.can);
    this.can.position.set(0.02, -0.16, 0.03);
    this.can.rotation.set(0.4, 0.2, -0.2);
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
