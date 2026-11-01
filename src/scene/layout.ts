// 방 치수, 소품 배치, 앉을 자리, 충돌 박스. 모든 좌표는 m, 바닥 y=0.
// x: 왼쪽(-4)→오른쪽(+4), z: 뒤(창 벽 -3)→앞(+3).

export const ROOM = { w: 8, d: 6, h: 2.8, x0: -4, x1: 4, z0: -3, z1: 3 } as const;
export const WAINSCOT_H = 1.0;

export interface Opening { cx: number; w: number; y0: number; y1: number; kind: 'window' | 'door' }

/** 뒤쪽 긴 벽(z = -3)의 창 2개와 출입문 */
export const BACK_OPENINGS: Opening[] = [
  { cx: -2.2, w: 1.5, y0: 1.0, y1: 2.4, kind: 'window' },
  { cx: 1.4, w: 1.5, y0: 1.0, y1: 2.4, kind: 'window' },
  { cx: 3.2, w: 0.95, y0: 0, y1: 2.15, kind: 'door' },
];

export interface Placement { x: number; z: number; ry: number }

/** 벽 서가 5개. ry는 서가 앞면이 바라보는 방향(0 = +z). */
export const SHELVES: (Placement & { w: number })[] = [
  { x: -3.84, z: -1.85, ry: Math.PI / 2, w: 1.15 },
  { x: -3.84, z: -0.66, ry: Math.PI / 2, w: 1.15 },
  { x: -0.4, z: -2.84, ry: 0, w: 1.2 },
  { x: 3.84, z: -1.55, ry: -Math.PI / 2, w: 1.15 },
  { x: 3.84, z: -0.36, ry: -Math.PI / 2, w: 1.15 },
];
export const SHELF = { h: 2.1, d: 0.32, board: 0.02, levels: 5, plinth: 0.08 } as const;

export const ISLAND: Placement & { w: number; d: number; h: number } = { x: 0.3, z: 0.05, ry: 0, w: 1.5, d: 0.85, h: 0.78 };
export const READING_TABLE: Placement & { w: number; d: number; h: number } = { x: -2.2, z: -2.3, ry: 0, w: 1.15, d: 0.62, h: 0.74 };
export const CHAIRS: Placement[] = [
  { x: -2.55, z: -1.78, ry: Math.PI },
  { x: -1.82, z: -1.78, ry: Math.PI },
];
/** 소파: 왼쪽 벽에 붙어 +x를 바라봄 */
export const SOFA: Placement & { w: number; d: number } = { x: -3.52, z: 1.5, ry: Math.PI / 2, w: 1.95, d: 0.88 };
export const RUG = { x: -2.25, z: 1.5, w: 1.6, d: 2.3 } as const;
export const COUNTER: Placement & { w: number; d: number; h: number } = { x: 2.9, z: 1.7, ry: -Math.PI / 2, w: 1.5, d: 0.55, h: 0.98 };
export const FLOOR_LAMPS: Placement[] = [
  { x: -3.62, z: 2.72, ry: 0 },
  { x: -3.6, z: 0.24, ry: 0 },
];
export const PENDANTS = [
  { x: -0.18, z: 0.05, drop: 0.85 },
  { x: 0.78, z: 0.05, drop: 0.85 },
  { x: -2.2, z: -2.3, drop: 0.95 },
] as const;
/** 오른쪽 창 아래 창가 벤치(방석), 소파 앞 낮은 테이블 */
export const BENCH: Placement & { w: number; d: number; h: number } = { x: 1.4, z: -2.6, ry: 0, w: 1.3, d: 0.42, h: 0.44 };
export const COFFEE_TABLE: Placement & { w: number; d: number; h: number } = { x: -2.42, z: 1.5, ry: Math.PI / 2, w: 0.95, d: 0.5, h: 0.4 };
export const FLOOR_PLANTS = [
  { x: 2.44, z: -2.66, scale: 1.25 },
  { x: 3.6, z: 0.62, scale: 0.9 },
] as const;

export interface Seat { id: string; x: number; z: number; ry: number; y: number; approach: 1 | -1 }
/** 앉을 수 있는 자리. ry는 앉은 사람이 바라보는 방향. y는 엉덩이 높이.
 *  approach: 1이면 앞쪽(바라보는 쪽)에서, -1이면 뒤쪽에서 다가와 앉는다(창을 보는 의자). */
export const SEATS: Seat[] = [
  { id: 'chair-1', x: CHAIRS[0].x, z: CHAIRS[0].z + 0.02, ry: Math.PI, y: 0.46, approach: -1 },
  { id: 'chair-2', x: CHAIRS[1].x, z: CHAIRS[1].z + 0.02, ry: Math.PI, y: 0.46, approach: -1 },
  { id: 'sofa-1', x: SOFA.x + 0.12, z: SOFA.z - 0.6, ry: Math.PI / 2, y: 0.44, approach: 1 },
  { id: 'sofa-2', x: SOFA.x + 0.12, z: SOFA.z, ry: Math.PI / 2, y: 0.44, approach: 1 },
  { id: 'sofa-3', x: SOFA.x + 0.12, z: SOFA.z + 0.6, ry: Math.PI / 2, y: 0.44, approach: 1 },
  { id: 'bench-1', x: BENCH.x - 0.32, z: BENCH.z + 0.02, ry: 0, y: 0.47, approach: 1 },
  { id: 'bench-2', x: BENCH.x + 0.32, z: BENCH.z + 0.02, ry: 0, y: 0.47, approach: 1 },
];

/** 앉으러 갈 때 먼저 걸어갈 지점 */
export function seatApproach(s: Seat, dist = 0.5): { x: number; z: number } {
  return { x: s.x + Math.sin(s.ry) * dist * s.approach, z: s.z + Math.cos(s.ry) * dist * s.approach };
}

/** 처음 들어왔을 때 서는 자리(계산대 앞, 서점 안쪽을 바라봄). 한 입장에서 20명이 겹치지 않게 통로에 나눈다. */
export const SPAWN = { x: 1.15, z: 1.05, ry: -2.6 } as const;
export const SPAWNS = [
  SPAWN,
  { x: 1.13, z: 1.63, ry: -2.6 },
  { x: 1.63, z: 1.38, ry: -2.6 },
  { x: 0.63, z: 1.38, ry: -2.6 },
  { x: 1.63, z: 0.63, ry: -2.6 },
  { x: 0.38, z: 0.88, ry: -2.6 },
  { x: 1.38, z: 0.13, ry: -2.6 },
  { x: 2.13, z: 1.13, ry: -2.6 },
  { x: 1.38, z: 2.13, ry: -2.6 },
  { x: 1.88, z: 1.88, ry: -2.6 },
  { x: 0.38, z: 1.88, ry: -2.6 },
  { x: 2.13, z: 0.38, ry: -2.6 },
  { x: -0.13, z: 1.13, ry: -2.6 },
  { x: 0.88, z: 2.38, ry: -2.6 },
  { x: 1.88, z: -0.13, ry: -2.6 },
  { x: 2.63, z: 0.63, ry: -2.6 },
  { x: -0.38, z: 1.63, ry: -2.6 },
  { x: 1.63, z: 2.63, ry: -2.6 },
  { x: 2.13, z: 2.38, ry: -2.6 },
  { x: -0.13, z: 2.13, ry: -2.6 },
] as const;

export interface Collider { x0: number; x1: number; z0: number; z1: number; h: number; seatable: boolean; seats?: string[] }

/** 경로 탐색·클릭 판정용 장애물(축 정렬 박스). h는 클릭 판정 높이, seats는 그 가구에 딸린 자리. */
export function colliders(): Collider[] {
  const list: Collider[] = [];
  const rect = (cx: number, cz: number, w: number, d: number, ry: number, h: number, seats?: string[]) => {
    const rot = Math.abs(Math.sin(ry)) > 0.5;
    const hw = (rot ? d : w) / 2, hd = (rot ? w : d) / 2;
    list.push({ x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd, h, seatable: !!seats, seats });
  };
  for (const s of SHELVES) rect(s.x, s.z, s.w, SHELF.d, s.ry, SHELF.h);
  rect(ISLAND.x, ISLAND.z, ISLAND.w, ISLAND.d, 0, ISLAND.h);
  rect(READING_TABLE.x, READING_TABLE.z, READING_TABLE.w, READING_TABLE.d, 0, READING_TABLE.h);
  CHAIRS.forEach((c, i) => rect(c.x, c.z, 0.44, 0.44, 0, 0.84, [`chair-${i + 1}`]));
  rect(SOFA.x, SOFA.z, SOFA.w, SOFA.d, SOFA.ry, 0.85, ['sofa-1', 'sofa-2', 'sofa-3']);
  rect(COUNTER.x, COUNTER.z, COUNTER.w, COUNTER.d, COUNTER.ry, COUNTER.h);
  rect(BENCH.x, BENCH.z, BENCH.w, BENCH.d, 0, BENCH.h + 0.06, ['bench-1', 'bench-2']);
  rect(COFFEE_TABLE.x, COFFEE_TABLE.z, COFFEE_TABLE.w, COFFEE_TABLE.d, COFFEE_TABLE.ry, COFFEE_TABLE.h);
  for (const l of FLOOR_LAMPS) rect(l.x, l.z, 0.34, 0.34, 0, 1.5);
  for (const p of FLOOR_PLANTS) rect(p.x, p.z, 0.45 * p.scale, 0.45 * p.scale, 0, 1.0 * p.scale);
  return list;
}
