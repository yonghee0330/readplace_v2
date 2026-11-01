// 창유리 빗방울(높음 품질만, SPEC 4-5): 유리 바로 안쪽에 얇은 판을 하나 더 두고 셰이더로
// 맺힌 물방울(정지)과 흘러내리는 물줄기(움직임)를 그린다. 드로우콜 1개.
// 투명 판이라 AO 계산에서 빼도록 오버레이 레이어에 둔다(AO 사각형 자국 방지).
import * as THREE from 'three';
import { OVERLAY_LAYER } from '../avatar/nameplate';

export interface WindowRain {
  mesh: THREE.Mesh;
  update(dt: number): void;
  /** on: 보이기, moving: 물줄기가 흐르는지(모션 줄이기면 멈춘 물방울만) */
  set(on: boolean, moving: boolean): void;
}

const vert = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const frag = /* glsl */ `
uniform float uTime;
varying vec3 vW;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// 유리에 맺혀 있는 작은 물방울: 격자마다 하나쯤, 위치·크기·유무가 제각각
float beads(vec2 p, float scale, float density) {
  vec2 g = p * scale;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash(id);
  vec2 o = vec2(hash(id + 1.7), hash(id + 9.2)) - 0.5;
  float r = 0.08 + 0.16 * hash(id + 4.4);
  float d = length((f - o * 0.55) * vec2(1.0, 0.85));
  return smoothstep(r, r * 0.35, d) * step(1.0 - density, h);
}

// 흘러내리는 물줄기: 세로 칸마다 속도·출발이 다른 방울 + 위로 남는 꼬리
float runs(vec2 p, float t) {
  float cols = 16.0;
  float cx = floor(p.x * cols);
  float h = hash(vec2(cx, 3.1));
  if (h < 0.55) return 0.0;
  float x = fract(p.x * cols) - 0.5 + sin(p.y * 9.0 + h * 20.0) * 0.12;
  float speed = 0.12 + 0.3 * hash(vec2(cx, 8.3));
  float y = fract(p.y * 0.55 + t * speed + h * 7.0);
  float head = smoothstep(0.16, 0.05, length(vec2(x, (y - 0.06) * 3.0)));
  float trail = smoothstep(0.06, 0.0, abs(x)) * smoothstep(0.06, 0.4, y) * (1.0 - y) * 0.55;
  return max(head, trail);
}

void main() {
  vec2 p = vW.xy;
  float b = beads(p, 26.0, 0.35) + beads(p + 3.7, 48.0, 0.25) * 0.7;
  float r = runs(p, uTime);
  float m = clamp(b + r, 0.0, 1.0);
  // 물방울은 바깥 빛을 모아 조금 밝고, 가장자리는 어둡게 보인다
  vec3 col = mix(vec3(0.42, 0.47, 0.52), vec3(0.86, 0.9, 0.94), m);
  gl_FragColor = vec4(col, m * 0.32);
  #include <colorspace_fragment>
}`;

export function buildWindowRain(glass: THREE.BufferGeometry): WindowRain {
  const geom = glass.clone();
  // 유리보다 2mm 안쪽(방 쪽, +z)
  geom.translate(0, 0, 0.002);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = 'window-rain';
  mesh.layers.set(OVERLAY_LAYER);
  mesh.renderOrder = 3;
  mesh.frustumCulled = false;
  let moving = true;
  return {
    mesh,
    update(dt) {
      if (mesh.visible && moving) mat.uniforms.uTime.value += dt;
    },
    set(on, mv) {
      mesh.visible = on;
      moving = mv;
    },
  };
}
