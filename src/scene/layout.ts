// 공간 배치: 중앙 허브 + 포털로 이어지는 네 방.
// x: 왼쪽(-)→오른쪽(+), z: 뒤 창벽(-)→앞 입구(+). 단위 m, 바닥 y=0.
// 빌드·전환 시 applyLayout()으로 활성 공간 상수를 맞춘다.

export type SpaceId = 'hub' | 'seminar' | 'cinema' | 'lecture' | 'solo';

export interface RoomBounds {
  w: number; d: number; h: number;
  x0: number; x1: number; z0: number; z1: number;
}

export interface Opening { cx: number; w: number; y0: number; y1: number; kind: 'window' | 'door' }
export interface Placement { x: number; z: number; ry: number }
export interface Seat { id: string; x: number; z: number; ry: number; y: number; approach: 1 | -1 }
export interface Collider { x0: number; x1: number; z0: number; z1: number; h: number; seatable: boolean; seats?: string[] }
export interface PortalDef {
  /** 이 포털이 보내는 곳(허브의 포털은 서브룸, 서브룸은 보통 hub) */
  to: SpaceId;
  x: number; z: number; ry: number;
  label: string;
  /** 클릭/트리거 박스 크기 */
  w: number; d: number;
}

export interface PartitionWall {
  x: number; z: number; ry: number; len: number; h: number;
  door?: { cx: number; w: number; h: number };
}

export interface SpaceLayout {
  id: SpaceId;
  label: string;
  room: RoomBounds;
  openings: Opening[];
  shelves: (Placement & { w: number; wing: 'A' | 'B' | 'C' | 'mid' })[];
  islands: (Placement & { w: number; d: number; h: number; kind: 'flat' | 'stand' })[];
  partitions: PartitionWall[];
  readingTable: (Placement & { w: number; d: number; h: number }) | null;
  chairs: Placement[];
  storeTable: (Placement & { w: number; d: number; h: number }) | null;
  storeChairs: Placement[];
  seminarTable: (Placement & { w: number; d: number; h: number }) | null;
  seminarChairs: Placement[];
  whiteboard: { x: number; z: number; ry: number; w: number; h: number } | null;
  seminarMonitor: Placement | null;
  soloDesk: (Placement & { w: number; d: number; h: number }) | null;
  soloChair: Placement | null;
  sofa: (Placement & { w: number; d: number }) | null;
  coffeeTable: (Placement & { w: number; d: number; h: number }) | null;
  rug: { x: number; z: number; w: number; d: number } | null;
  screen: { x: number; z: number; ry: number; w: number; h: number } | null;
  theater: {
    x: number; z: number; ry: number;
    rows: number; cols: number; rowDepth: number; seatW: number; rise: number; firstY: number;
  } | null;
  stage: { x: number; z: number; w: number; d: number; h: number } | null;
  bench: (Placement & { w: number; d: number; h: number }) | null;
  /** 창가 바테이블(높은 테이블) */
  barTable: (Placement & { w: number; d: number; h: number }) | null;
  counter: (Placement & { w: number; d: number; h: number }) | null;
  floorLamps: Placement[];
  pendants: { x: number; z: number; drop: number }[];
  floorPlants: { x: number; z: number; scale: number }[];
  seats: Seat[];
  spawn: { x: number; z: number; ry: number };
  spawns: { x: number; z: number; ry: number }[];
  portals: PortalDef[];
}

export const WAINSCOT_H = 1.0;
export const SHELF = { h: 2.15, d: 0.32, board: 0.02, levels: 5, plinth: 0.08 } as const;

function roomOf(w: number, d: number, h = 2.9): RoomBounds {
  return { w, d, h, x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 };
}

function chairSeat(id: string, p: Placement, y = 0.46, approach: 1 | -1 = 1): Seat {
  return { id, x: p.x, z: p.z, ry: p.ry, y, approach };
}

function theaterSeats(t: NonNullable<SpaceLayout['theater']>): Seat[] {
  const out: Seat[] = [];
  const { x, z, ry, rows, cols, rowDepth, seatW, rise, firstY } = t;
  const cos = Math.cos(ry), sin = Math.sin(ry);
  for (let row = 0; row < Math.min(rows, 2); row++) {
    for (let col = 0; col < cols; col++) {
      const localX = (col - (cols - 1) / 2) * seatW;
      const localZ = row * rowDepth;
      out.push({
        id: `theater-${row + 1}-${col + 1}`,
        x: x + localX * cos - localZ * sin,
        z: z + localX * sin + localZ * cos,
        ry, y: firstY + 0.28 + row * rise, approach: 1,
      });
    }
  }
  return out;
}

function emptyBase(id: SpaceId, label: string, room: RoomBounds): Omit<SpaceLayout,
  'openings' | 'shelves' | 'islands' | 'seats' | 'spawn' | 'spawns' | 'portals' | 'pendants' | 'floorLamps' | 'floorPlants' | 'chairs'
> {
  return {
    id, label, room,
    partitions: [],
    readingTable: null, storeTable: null, storeChairs: [],
    seminarTable: null, seminarChairs: [], whiteboard: null, seminarMonitor: null,
    soloDesk: null, soloChair: null,
    sofa: null, coffeeTable: null, rug: null, screen: null,
    theater: null, stage: null, bench: null, barTable: null, counter: null,
  };
}

/** 중앙 허브 — 테이블·서가·창가 바·매대·소파만 */
function makeHub(): SpaceLayout {
  const room = roomOf(9, 7);
  const chairs: Placement[] = [
    { x: -0.55, z: 0.55, ry: Math.PI },
    { x: 0.55, z: 0.55, ry: Math.PI },
    { x: -0.55, z: -0.55, ry: 0 },
    { x: 0.55, z: -0.55, ry: 0 },
  ];
  const sofa = { x: 3.05, z: 2.05, ry: -Math.PI / 2, w: 1.85, d: 0.85 };
  const spawn = { x: 0.2, z: 2.55, ry: Math.PI };
  // 벽 서가와 겹치지 않게 통로 쪽 문틀
  const portals: PortalDef[] = [
    { to: 'seminar', x: -3.55, z: -2.35, ry: Math.PI / 2, label: '세미나실', w: 0.85, d: 0.35 },
    { to: 'cinema', x: 3.55, z: -2.35, ry: -Math.PI / 2, label: '영화감상실', w: 0.85, d: 0.35 },
    { to: 'lecture', x: -3.55, z: 2.15, ry: Math.PI / 2, label: '계단식 강연', w: 0.85, d: 0.35 },
    { to: 'solo', x: 3.55, z: 2.15, ry: -Math.PI / 2, label: '1인 작업실', w: 0.85, d: 0.35 },
  ];
  return {
    ...emptyBase('hub', '원미서가', room),
    openings: [
      { cx: -2.2, w: 1.55, y0: 1.0, y1: 2.5, kind: 'window' },
      { cx: 0.15, w: 1.7, y0: 1.0, y1: 2.5, kind: 'window' },
      { cx: 2.5, w: 1.55, y0: 1.0, y1: 2.5, kind: 'window' },
      // 앞벽 출입문(로컬 x는 앞벽에서도 월드 x)
      { cx: 0, w: 1.05, y0: 0, y1: 2.2, kind: 'door' },
    ],
    shelves: [
      { x: -4.28, z: -0.1, ry: Math.PI / 2, w: 1.35, wing: 'A' },
      { x: -4.28, z: 2.4, ry: Math.PI / 2, w: 1.2, wing: 'A' },
      { x: 4.28, z: -0.1, ry: -Math.PI / 2, w: 1.35, wing: 'C' },
      { x: 4.28, z: 2.4, ry: -Math.PI / 2, w: 1.2, wing: 'C' },
      { x: -3.0, z: 3.28, ry: Math.PI, w: 1.2, wing: 'A' },
      { x: 3.0, z: 3.28, ry: Math.PI, w: 1.2, wing: 'C' },
    ],
    islands: [
      { x: -2.15, z: 0.15, ry: 0.08, w: 1.15, d: 0.72, h: 0.78, kind: 'flat' },
    ],
    readingTable: { x: 0, z: 0, ry: 0, w: 1.35, d: 0.78, h: 0.74 },
    chairs,
    barTable: { x: 0.15, z: -3.05, ry: 0, w: 2.4, d: 0.42, h: 1.05 },
    counter: { x: -2.55, z: 2.55, ry: 0.15, w: 1.35, d: 0.52, h: 0.98 },
    sofa,
    coffeeTable: { x: 1.85, z: 2.05, ry: Math.PI / 2, w: 0.75, d: 0.42, h: 0.4 },
    rug: { x: 2.45, z: 2.05, w: 2.0, d: 2.0 },
    floorLamps: [{ x: 3.65, z: 2.85, ry: 0 }],
    pendants: [
      { x: 0, z: 0, drop: 0.95 },
      { x: -2.15, z: 0.15, drop: 0.9 },
      { x: 2.45, z: 2.05, drop: 1.0 },
    ],
    floorPlants: [
      { x: -3.7, z: -3.0, scale: 1.0 },
      { x: 3.7, z: -3.0, scale: 0.9 },
      { x: 1.2, z: 3.0, scale: 0.85 },
    ],
    seats: [
      ...chairs.map((p, i) => chairSeat(`chair-${i + 1}`, p, 0.46, p.ry === 0 ? 1 : -1)),
      { id: 'sofa-1', x: sofa.x - 0.08, z: sofa.z - 0.48, ry: sofa.ry, y: 0.44, approach: 1 },
      { id: 'sofa-2', x: sofa.x - 0.08, z: sofa.z, ry: sofa.ry, y: 0.44, approach: 1 },
      { id: 'sofa-3', x: sofa.x - 0.08, z: sofa.z + 0.48, ry: sofa.ry, y: 0.44, approach: 1 },
      { id: 'bar-1', x: -0.7, z: -2.7, ry: Math.PI, y: 0.72, approach: 1 },
      { id: 'bar-2', x: 0.15, z: -2.7, ry: Math.PI, y: 0.72, approach: 1 },
      { id: 'bar-3', x: 1.0, z: -2.7, ry: Math.PI, y: 0.72, approach: 1 },
    ],
    spawn,
    spawns: [
      spawn,
      { x: 0.8, z: 2.3, ry: Math.PI },
      { x: -0.6, z: 2.2, ry: Math.PI },
      { x: 1.2, z: 1.4, ry: -2.4 },
      { x: -1.3, z: 1.3, ry: 2.4 },
      { x: 0.0, z: 1.5, ry: Math.PI },
      { x: 1.6, z: 0.3, ry: -1.2 },
      { x: -1.35, z: 1.1, ry: 1.2 },
    ],
    portals,
  };
}

function makeSeminar(): SpaceLayout {
  const room = roomOf(6.5, 5.5);
  const table = { x: 0, z: -0.15, ry: 0, w: 2.4, d: 0.95, h: 0.74 };
  const chairs: Placement[] = [
    { x: -0.75, z: -0.75, ry: Math.PI },
    { x: 0, z: -0.75, ry: Math.PI },
    { x: 0.75, z: -0.75, ry: Math.PI },
    { x: -0.75, z: 0.45, ry: 0 },
    { x: 0, z: 0.45, ry: 0 },
    { x: 0.75, z: 0.45, ry: 0 },
    { x: -1.25, z: -0.15, ry: Math.PI / 2 },
    { x: 1.25, z: -0.15, ry: -Math.PI / 2 },
  ];
  const spawn = { x: 0, z: 2.0, ry: Math.PI };
  return {
    ...emptyBase('seminar', '세미나실', room),
    openings: [{ cx: 0, w: 0.95, y0: 0, y1: 2.15, kind: 'door' }],
    shelves: [
      { x: -3.0, z: -1.4, ry: Math.PI / 2, w: 1.2, wing: 'A' },
      { x: 3.0, z: -1.4, ry: -Math.PI / 2, w: 1.2, wing: 'C' },
    ],
    islands: [],
    chairs: [],
    seminarTable: table,
    seminarChairs: chairs,
    whiteboard: { x: 0, z: -2.5, ry: 0, w: 2.0, h: 1.15 },
    seminarMonitor: { x: 1.35, z: -2.35, ry: -0.2 },
    floorLamps: [],
    pendants: [{ x: 0, z: -0.15, drop: 1.0 }],
    floorPlants: [{ x: -2.6, z: 2.1, scale: 0.9 }],
    seats: chairs.map((p, i) => chairSeat(`seminar-${i + 1}`, p)),
    spawn,
    spawns: [spawn, { x: -0.7, z: 1.7, ry: Math.PI }, { x: 0.7, z: 1.7, ry: Math.PI }],
    // 출입문은 뒤벽(창·문 개구) — 포털도 같은 쪽
    portals: [{ to: 'hub', x: 0, z: -2.45, ry: Math.PI, label: '원미서가', w: 0.95, d: 0.35 }],
  };
}

function makeCinema(): SpaceLayout {
  const room = roomOf(6, 5);
  const sofa = { x: 1.35, z: 0.1, ry: -Math.PI / 2, w: 2.0, d: 0.88 };
  const spawn = { x: 0.2, z: 1.7, ry: Math.PI };
  return {
    ...emptyBase('cinema', '영화감상실', room),
    openings: [{ cx: 0, w: 0.95, y0: 0, y1: 2.15, kind: 'door' }],
    shelves: [{ x: -2.75, z: -1.5, ry: Math.PI / 2, w: 1.15, wing: 'A' }],
    islands: [],
    chairs: [],
    sofa,
    coffeeTable: { x: 0.35, z: 0.1, ry: Math.PI / 2, w: 0.9, d: 0.48, h: 0.4 },
    rug: { x: 0.8, z: 0.1, w: 2.2, d: 2.3 },
    screen: { x: -1.55, z: 0.1, ry: Math.PI / 2, w: 1.7, h: 1.0 },
    floorLamps: [{ x: 2.2, z: 1.4, ry: 0 }, { x: 2.2, z: -1.2, ry: 0 }],
    pendants: [{ x: 0.6, z: 0.1, drop: 1.05 }],
    floorPlants: [{ x: -2.3, z: 1.8, scale: 0.85 }],
    seats: [
      { id: 'sofa-1', x: sofa.x - 0.1, z: sofa.z - 0.58, ry: sofa.ry, y: 0.44, approach: 1 },
      { id: 'sofa-2', x: sofa.x - 0.1, z: sofa.z, ry: sofa.ry, y: 0.44, approach: 1 },
      { id: 'sofa-3', x: sofa.x - 0.1, z: sofa.z + 0.58, ry: sofa.ry, y: 0.44, approach: 1 },
    ],
    spawn,
    spawns: [spawn, { x: 0.5, z: 1.4, ry: Math.PI }],
    portals: [{ to: 'hub', x: 0, z: -2.2, ry: Math.PI, label: '원미서가', w: 0.95, d: 0.35 }],
  };
}

function makeLecture(): SpaceLayout {
  const room = roomOf(7, 6);
  const theater = {
    x: -0.6, z: 0.55, ry: Math.PI,
    rows: 3, cols: 4, rowDepth: 0.72, seatW: 0.52, rise: 0.22, firstY: 0.18,
  };
  const stage = { x: -0.6, z: -2.15, w: 2.4, d: 1.1, h: 0.18 };
  const spawn = { x: 2.35, z: 1.85, ry: -2.4 };
  return {
    ...emptyBase('lecture', '계단식 강연', room),
    openings: [{ cx: 2.5, w: 0.95, y0: 0, y1: 2.15, kind: 'door' }],
    shelves: [],
    islands: [],
    chairs: [],
    theater,
    stage,
    floorLamps: [],
    pendants: [{ x: -0.6, z: -1.4, drop: 1.1 }],
    floorPlants: [{ x: 2.8, z: 2.2, scale: 0.9 }],
    seats: theaterSeats(theater),
    spawn,
    spawns: [spawn, { x: 2.2, z: 1.4, ry: -2.0 }],
    portals: [{ to: 'hub', x: 2.5, z: -2.7, ry: Math.PI, label: '원미서가', w: 0.95, d: 0.35 }],
  };
}

function makeSolo(): SpaceLayout {
  const room = roomOf(5, 4.5);
  const desks = [
    { x: -1.35, z: -1.2, ry: 0, w: 1.15, d: 0.48, h: 0.74 },
    { x: 1.15, z: -1.2, ry: 0, w: 1.15, d: 0.48, h: 0.74 },
  ];
  const chairs: Placement[] = [
    { x: -1.35, z: -0.55, ry: Math.PI },
    { x: 1.15, z: -0.55, ry: Math.PI },
  ];
  const spawn = { x: 0, z: 1.4, ry: Math.PI };
  return {
    ...emptyBase('solo', '1인 작업실', room),
    openings: [{ cx: 0, w: 0.9, y0: 0, y1: 2.1, kind: 'door' }],
    shelves: [
      { x: -2.25, z: 0.3, ry: Math.PI / 2, w: 1.1, wing: 'A' },
      { x: 2.25, z: 0.3, ry: -Math.PI / 2, w: 1.1, wing: 'C' },
    ],
    islands: [],
    chairs: [],
    soloDesk: desks[0],
    soloChair: chairs[0],
    readingTable: desks[1],
    storeChairs: [chairs[1]],
    floorLamps: [{ x: -1.9, z: 1.4, ry: 0 }],
    pendants: [{ x: -1.35, z: -1.0, drop: 1.0 }, { x: 1.15, z: -1.0, drop: 1.0 }],
    floorPlants: [{ x: 1.9, z: 1.5, scale: 0.8 }],
    seats: [
      chairSeat('solo-1', chairs[0], 0.46, -1),
      chairSeat('solo-2', chairs[1], 0.46, -1),
    ],
    spawn,
    spawns: [spawn, { x: -0.7, z: 1.2, ry: Math.PI }],
    portals: [{ to: 'hub', x: 0, z: -1.95, ry: Math.PI, label: '원미서가', w: 0.9, d: 0.35 }],
  };
}

export const SPACE_LAYOUTS: Record<SpaceId, SpaceLayout> = {
  hub: makeHub(),
  seminar: makeSeminar(),
  cinema: makeCinema(),
  lecture: makeLecture(),
  solo: makeSolo(),
};

export const SPACE_ORDER: SpaceId[] = ['hub', 'seminar', 'cinema', 'lecture', 'solo'];

// ---------- 활성 레이아웃(빌드·내비·클릭이 읽음) ----------
let activeId: SpaceId = 'hub';

/** 활성 공간 id */
export function currentSpaceId(): SpaceId {
  return activeId;
}

export function currentSpace(): SpaceLayout {
  return SPACE_LAYOUTS[activeId];
}

export function spaceLabel(id: SpaceId = activeId): string {
  return SPACE_LAYOUTS[id].label;
}

/** 활성 레이아웃 필드를 모듈 export 상수의 내용에 반영 */
export function applyLayout(id: SpaceId): SpaceLayout {
  activeId = id;
  const L = SPACE_LAYOUTS[id];
  Object.assign(ROOM, L.room);
  BACK_OPENINGS.splice(0, BACK_OPENINGS.length, ...L.openings);
  SHELVES.splice(0, SHELVES.length, ...L.shelves);
  ISLANDS.splice(0, ISLANDS.length, ...L.islands);
  PARTITIONS.splice(0, PARTITIONS.length, ...L.partitions);
  CHAIRS.splice(0, CHAIRS.length, ...L.chairs);
  STORE_CHAIRS.splice(0, STORE_CHAIRS.length, ...(L.storeChairs ?? []));
  SEMINAR_CHAIRS.splice(0, SEMINAR_CHAIRS.length, ...(L.seminarChairs ?? []));
  FLOOR_LAMPS.splice(0, FLOOR_LAMPS.length, ...L.floorLamps);
  PENDANTS.splice(0, PENDANTS.length, ...L.pendants);
  FLOOR_PLANTS.splice(0, FLOOR_PLANTS.length, ...L.floorPlants);
  SEATS.splice(0, SEATS.length, ...L.seats);
  SPAWNS.splice(0, SPAWNS.length, ...L.spawns);
  Object.assign(SPAWN, L.spawn);

  assignOrClear(READING_TABLE, L.readingTable);
  assignOrClear(STORE_TABLE, L.storeTable);
  assignOrClear(SEMINAR_TABLE, L.seminarTable);
  assignOrClear(WHITEBOARD, L.whiteboard);
  assignOrClear(SEMINAR_MONITOR, L.seminarMonitor);
  assignOrClear(SOLO_DESK, L.soloDesk);
  assignOrClear(SOLO_CHAIR, L.soloChair);
  assignOrClear(SOFA, L.sofa);
  assignOrClear(COFFEE_TABLE, L.coffeeTable);
  assignOrClear(RUG, L.rug);
  assignOrClear(SCREEN, L.screen);
  assignOrClear(THEATER, L.theater);
  assignOrClear(STAGE, L.stage);
  assignOrClear(BENCH, L.bench);
  assignOrClear(BAR_TABLE, L.barTable);
  assignOrClear(COUNTER, L.counter);
  PORTALS.splice(0, PORTALS.length, ...L.portals);
  return L;
}

function assignOrClear<T extends object>(target: T, src: Partial<T> | null | undefined): void {
  if (!src) {
    for (const k of Object.keys(target) as (keyof T)[]) delete (target as Record<string, unknown>)[k as string];
    (target as { _empty?: boolean })._empty = true;
    return;
  }
  delete (target as { _empty?: boolean })._empty;
  Object.assign(target, src);
}

/** 활성 레이아웃에 해당 가구가 있는지(비어 표시면 false). */
export function isPresent(obj: object | null | undefined): boolean {
  if (!obj) return false;
  const o = obj as { _empty?: boolean; w?: number; rows?: number };
  if (o._empty) return false;
  if (typeof o.w === 'number' && o.w < 0.05) return false;
  if (typeof o.rows === 'number' && o.rows < 1) return false;
  return true;
}

// 허브로 초기화한 mutable export (기존 import 호환)
const HUB = SPACE_LAYOUTS.hub;
export const ROOM: RoomBounds = { ...HUB.room };
export const BACK_OPENINGS: Opening[] = [...HUB.openings];
export const SHELVES = [...HUB.shelves];
export const ISLANDS = [...HUB.islands];
export const PARTITIONS: PartitionWall[] = [...HUB.partitions];
export const ISLAND = ISLANDS[0];
export const READING_TABLE: Placement & { w: number; d: number; h: number } = { ...(HUB.readingTable!) };
export const CHAIRS: Placement[] = [...HUB.chairs];
export const STORE_TABLE: Placement & { w: number; d: number; h: number } = { x: 0, z: 0, ry: 0, w: 0, d: 0, h: 0, _empty: true } as never;
export const STORE_CHAIRS: Placement[] = [];
export const SEMINAR_TABLE: Placement & { w: number; d: number; h: number } = { x: 0, z: 0, ry: 0, w: 0, d: 0, h: 0, _empty: true } as never;
export const SEMINAR_CHAIRS: Placement[] = [];
export const WHITEBOARD: { x: number; z: number; ry: number; w: number; h: number } = { x: 0, z: 0, ry: 0, w: 0, h: 0, _empty: true } as never;
export const SEMINAR_MONITOR: Placement = { x: 0, z: 0, ry: 0, _empty: true } as never;
export const SOLO_DESK: Placement & { w: number; d: number; h: number } = { x: 0, z: 0, ry: 0, w: 0, d: 0, h: 0, _empty: true } as never;
export const SOLO_CHAIR: Placement = { x: 0, z: 0, ry: 0, _empty: true } as never;
export const SOFA: Placement & { w: number; d: number } = { ...(HUB.sofa!) };
export const COFFEE_TABLE: Placement & { w: number; d: number; h: number } = { ...(HUB.coffeeTable!) };
export const RUG = { ...HUB.rug! };
export const SCREEN: { x: number; z: number; ry: number; w: number; h: number } = { x: 0, z: 0, ry: 0, w: 0, h: 0, _empty: true } as never;
export const THEATER: NonNullable<SpaceLayout['theater']> = {
  x: 0, z: 0, ry: 0, rows: 0, cols: 0, rowDepth: 0, seatW: 0, rise: 0, firstY: 0, _empty: true,
} as never;
export const STAGE: { x: number; z: number; w: number; d: number; h: number } = { x: 0, z: 0, w: 0, d: 0, h: 0, _empty: true } as never;
export const BENCH: Placement & { w: number; d: number; h: number } = { x: 0, z: 0, ry: 0, w: 0, d: 0, h: 0, _empty: true } as never;
export const BAR_TABLE: Placement & { w: number; d: number; h: number } = { ...(HUB.barTable!) };
export const COUNTER: Placement & { w: number; d: number; h: number } = { ...(HUB.counter!) };
export const FLOOR_LAMPS: Placement[] = [...HUB.floorLamps];
export const PENDANTS: { x: number; z: number; drop: number }[] = [...HUB.pendants];
export const FLOOR_PLANTS: { x: number; z: number; scale: number }[] = [...HUB.floorPlants];
export const SEATS: Seat[] = [...HUB.seats];
export const SPAWN = { ...HUB.spawn };
export const SPAWNS: { x: number; z: number; ry: number }[] = [...HUB.spawns];
export const PORTALS: PortalDef[] = [...HUB.portals];

applyLayout('hub');

export function seatApproach(s: Seat, dist = 0.5): { x: number; z: number } {
  return { x: s.x + Math.sin(s.ry) * dist * s.approach, z: s.z + Math.cos(s.ry) * dist * s.approach };
}

export function colliders(): Collider[] {
  const list: Collider[] = [];
  const rect = (cx: number, cz: number, w: number, d: number, ry: number, h: number, seats?: string[]) => {
    if (w <= 0.01 || d <= 0.01) return;
    const rot = Math.abs(Math.sin(ry)) > 0.5;
    const hw = (rot ? d : w) / 2, hd = (rot ? w : d) / 2;
    list.push({ x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd, h, seatable: !!seats, seats });
  };
  for (const s of SHELVES) rect(s.x, s.z, s.w, SHELF.d, s.ry, SHELF.h);
  for (const p of PARTITIONS) {
    const thick = 0.12;
    if (!p.door) {
      rect(p.x, p.z, p.len, thick, p.ry, p.h);
      continue;
    }
    const cos = Math.cos(p.ry), sin = Math.sin(p.ry);
    const left = -p.len / 2, right = p.len / 2;
    const d0 = p.door.cx - p.door.w / 2, d1 = p.door.cx + p.door.w / 2;
    const seg = (a: number, b: number) => {
      const len = b - a;
      if (len < 0.08) return;
      const mid = (a + b) / 2;
      rect(p.x + mid * cos, p.z + mid * sin, len, thick, p.ry, p.h);
    };
    seg(left, d0);
    seg(d1, right);
  }
  for (const isl of ISLANDS) rect(isl.x, isl.z, isl.w, isl.d, isl.ry, isl.h);
  if (isPresent(STORE_TABLE)) rect(STORE_TABLE.x, STORE_TABLE.z, STORE_TABLE.w, STORE_TABLE.d, 0, STORE_TABLE.h);
  STORE_CHAIRS.forEach((c, i) => rect(c.x, c.z, 0.36, 0.36, 0, 0.84, [`store-${i + 1}`]));
  if (isPresent(SEMINAR_TABLE)) rect(SEMINAR_TABLE.x, SEMINAR_TABLE.z, SEMINAR_TABLE.w, SEMINAR_TABLE.d, 0, SEMINAR_TABLE.h);
  SEMINAR_CHAIRS.forEach((c, i) => rect(c.x, c.z, 0.36, 0.36, 0, 0.84, [`seminar-${i + 1}`]));
  if (isPresent(SOLO_DESK)) rect(SOLO_DESK.x, SOLO_DESK.z, SOLO_DESK.w, SOLO_DESK.d, 0, SOLO_DESK.h);
  if (isPresent(SOLO_CHAIR)) rect(SOLO_CHAIR.x, SOLO_CHAIR.z, 0.4, 0.4, 0, 0.9, ['solo-1']);
  if (isPresent(READING_TABLE)) {
    rect(READING_TABLE.x, READING_TABLE.z, READING_TABLE.w, READING_TABLE.d, 0, READING_TABLE.h);
    // 솔로 2번 책상 좌석
    if (currentSpaceId() === 'solo') {
      STORE_CHAIRS.forEach((c, i) => rect(c.x, c.z, 0.4, 0.4, 0, 0.9, [`solo-${i + 2}`]));
    }
  }
  CHAIRS.forEach((c, i) => rect(c.x, c.z, 0.36, 0.36, 0, 0.84, [`chair-${i + 1}`]));
  if (isPresent(SOFA)) {
    const sofaIds = SEATS.filter((s) => s.id.startsWith('sofa-')).map((s) => s.id);
    rect(SOFA.x, SOFA.z, SOFA.w, SOFA.d, SOFA.ry, 0.85, sofaIds);
  }
  if (isPresent(COUNTER)) rect(COUNTER.x, COUNTER.z, COUNTER.w, COUNTER.d, COUNTER.ry, COUNTER.h);
  if (isPresent(BENCH)) {
    const ids = SEATS.filter((s) => s.id.startsWith('bench-')).map((s) => s.id);
    rect(BENCH.x, BENCH.z, BENCH.w, BENCH.d, 0, BENCH.h + 0.06, ids);
  }
  if (isPresent(BAR_TABLE)) {
    const ids = SEATS.filter((s) => s.id.startsWith('bar-')).map((s) => s.id);
    rect(BAR_TABLE.x, BAR_TABLE.z, BAR_TABLE.w, BAR_TABLE.d, 0, BAR_TABLE.h, ids);
  }
  if (isPresent(COFFEE_TABLE)) rect(COFFEE_TABLE.x, COFFEE_TABLE.z, COFFEE_TABLE.w, COFFEE_TABLE.d, COFFEE_TABLE.ry, COFFEE_TABLE.h);
  if (isPresent(SCREEN)) rect(SCREEN.x, SCREEN.z, 0.08, SCREEN.w, SCREEN.ry, SCREEN.h + 0.6);
  if (isPresent(STAGE)) rect(STAGE.x, STAGE.z, STAGE.w, STAGE.d, 0, STAGE.h + 0.05);
  if (isPresent(THEATER) && THEATER.rows > 0) {
    const tw = THEATER.cols * THEATER.seatW + 0.2;
    const td = THEATER.rows * THEATER.rowDepth + 0.15;
    const theaterIds = SEATS.filter((s) => s.id.startsWith('theater-')).map((s) => s.id);
    rect(THEATER.x, THEATER.z + (THEATER.rows - 1) * THEATER.rowDepth * 0.35, tw, td, THEATER.ry, 1.1, theaterIds);
  }
  for (const l of FLOOR_LAMPS) rect(l.x, l.z, 0.34, 0.34, 0, 1.5);
  for (const p of FLOOR_PLANTS) rect(p.x, p.z, 0.45 * p.scale, 0.45 * p.scale, 0, 1.0 * p.scale);
  // 포털은 막지 않음(통과·클릭 트리거). 내비에서는 열어 둔다.
  return list;
}
