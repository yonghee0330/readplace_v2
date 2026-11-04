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
export interface Seat {
  id: string; x: number; z: number; ry: number; y: number; approach: 1 | -1;
  /** 좁은 곳의 좌석: 다가가는 지점을 직접 지정(없으면 앞/뒤 0.5m) */
  from?: { x: number; z: number };
}
export interface Collider {
  x0: number; x1: number; z0: number; z1: number; h: number;
  seatable: boolean;
  seats?: string[];
  /** 클릭 시 포스트잇 보드 열기 */
  eventBoard?: boolean;
}
export interface PortalDef {
  /** 이 포털이 보내는 곳(허브의 포털은 서브룸, 서브룸은 보통 hub) */
  to: SpaceId;
  x: number; z: number; ry: number;
  label: string;
  /** 클릭/트리거 박스 크기 */
  w: number; d: number;
  /** true면 문짝 없이 문틀만(1인실처럼 등 뒤가 뚫려 보이게) */
  open?: boolean;
}

export interface PartitionWall {
  x: number; z: number; ry: number; len: number; h: number;
  door?: { cx: number; w: number; h: number };
}

/** 계단식 객석 한 윙. 원점은 맨 뒤(높은 단) 중앙, localZ가 무대(앞) 쪽 */
export interface TheaterBlock {
  x: number; z: number; ry: number;
  rows: number; cols: number; rowDepth: number; seatW: number; rise: number; firstY: number;
  /** 오름 계단 쪽. -1=로컬 -x(기본), +1=로컬 +x */
  stairSide?: 1 | -1;
  /** 좌석 id 접두(기본 theater). 윙이 여럿일 때 구분 */
  idPrefix?: string;
}

/** THREE Y회전과 같은 로컬→월드(객석·콜라이더 공통) */
export function theaterWorld(
  originX: number, originZ: number, ry: number, localX: number, localZ: number,
): { x: number; z: number } {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  return {
    x: originX + localX * c + localZ * s,
    z: originZ - localX * s + localZ * c,
  };
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
  /** w·d는 사각형 크기. round면 지름 w(또는 min(w,d))인 원형 카페트 */
  rug: { x: number; z: number; w: number; d: number; round?: boolean } | null;
  screen: { x: number; z: number; ry: number; w: number; h: number } | null;
  /** 계단식 객석 윙(여러 개면 ㄱ자 등). localZ가 무대 쪽, 관객은 ry 방향으로 봄 */
  theaters: TheaterBlock[];
  /** @deprecated theaters[0] 사용. 호환용 단일 윙 */
  theater: TheaterBlock | null;
  stage: { x: number; z: number; w: number; d: number; h: number } | null;
  bench: (Placement & { w: number; d: number; h: number }) | null;
  /** 창가 바테이블(높은 테이블) */
  barTable: (Placement & { w: number; d: number; h: number }) | null;
  /** 가오픈 포스트잇 이벤트 보드(허브 창가) */
  eventBoard: { x: number; z: number; ry: number; w: number; h: number } | null;
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

/** 계단 좌석: 뒤(벽·localZ≈0)가 높고 앞(무대)이 낮음. 관객은 무대를 봄. 열마다 cols석. */
function theaterSeats(t: TheaterBlock): Seat[] {
  const out: Seat[] = [];
  const { x, z, ry, rows, cols, rowDepth, seatW, rise, firstY } = t;
  const prefix = t.idPrefix ?? 'theater';
  for (let i = 0; i < rows; i++) {
    // i=0 맨 뒤(높음), i=rows-1 맨 앞(낮음)
    const localZ = i * rowDepth + rowDepth * 0.45;
    const y = firstY + (rows - 1 - i) * rise + 0.07;
    for (let col = 0; col < cols; col++) {
      const localX = (col - (cols - 1) / 2) * seatW;
      const w = theaterWorld(x, z, ry, localX, localZ);
      out.push({
        id: `${prefix}-${i + 1}-${col + 1}`,
        x: w.x, z: w.z, ry, y, approach: 1,
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
    theaters: [], theater: null, stage: null, bench: null, barTable: null, eventBoard: null, counter: null,
  };
}

/** 중앙 허브 — 테이블·서가·창가 바·매대·소파만 */
function makeHub(): SpaceLayout {
  const room = roomOf(9, 7);
  // 8인 중앙 테이블(긴 변 3석 + 양끝 1석)
  const tableW = 2.45;
  const tableD = 1.12;
  const seatOff = 0.5;
  const along = 0.78;
  const chairs: Placement[] = [
    { x: -along, z: -(tableD / 2 + seatOff), ry: 0 },
    { x: 0, z: -(tableD / 2 + seatOff), ry: 0 },
    { x: along, z: -(tableD / 2 + seatOff), ry: 0 },
    { x: -along, z: tableD / 2 + seatOff, ry: Math.PI },
    { x: 0, z: tableD / 2 + seatOff, ry: Math.PI },
    { x: along, z: tableD / 2 + seatOff, ry: Math.PI },
    { x: -(tableW / 2 + seatOff), z: 0, ry: Math.PI / 2 },
    { x: tableW / 2 + seatOff, z: 0, ry: -Math.PI / 2 },
  ];
  const sofa = { x: 3.05, z: 2.05, ry: -Math.PI / 2, w: 1.85, d: 0.85 };
  const spawn = { x: 0.2, z: 2.55, ry: Math.PI };
  // 측벽(+서가가 비는 칸)에 붙인 문형 포털. 벽면 x≈±4.5
  const doorX = 4.32;
  const portals: PortalDef[] = [
    { to: 'seminar', x: -doorX, z: -2.45, ry: Math.PI / 2, label: '세미나실', w: 0.82, d: 0.2 },
    { to: 'cinema', x: doorX, z: -2.45, ry: -Math.PI / 2, label: '영화감상실', w: 0.82, d: 0.2 },
    { to: 'lecture', x: -doorX, z: 1.2, ry: Math.PI / 2, label: '계단식 강연장', w: 0.82, d: 0.2 },
    { to: 'solo', x: doorX, z: 1.2, ry: -Math.PI / 2, label: '1인 작업실', w: 0.82, d: 0.2 },
  ];
  return {
    ...emptyBase('hub', '서점 중앙', room),
    openings: [
      { cx: -2.2, w: 1.55, y0: 1.0, y1: 2.5, kind: 'window' },
      { cx: 0.15, w: 1.7, y0: 1.0, y1: 2.5, kind: 'window' },
      { cx: 2.5, w: 1.55, y0: 1.0, y1: 2.5, kind: 'window' },
      // 앞벽 출입문(로컬 x는 앞벽에서도 월드 x)
      { cx: 0, w: 1.05, y0: 0, y1: 2.2, kind: 'door' },
    ],
    shelves: [
      { x: -4.28, z: -0.1, ry: Math.PI / 2, w: 1.35, wing: 'A' },
      { x: -4.28, z: 2.55, ry: Math.PI / 2, w: 1.0, wing: 'A' },
      { x: 4.28, z: -0.1, ry: -Math.PI / 2, w: 1.35, wing: 'C' },
      { x: 4.28, z: 2.55, ry: -Math.PI / 2, w: 1.0, wing: 'C' },
      { x: -3.0, z: 3.28, ry: Math.PI, w: 1.2, wing: 'A' },
      { x: 3.0, z: 3.28, ry: Math.PI, w: 1.2, wing: 'C' },
    ],
    islands: [
      { x: -2.35, z: 0.15, ry: 0.08, w: 1.05, d: 0.68, h: 0.78, kind: 'flat' },
    ],
    readingTable: { x: 0, z: 0, ry: 0, w: tableW, d: tableD, h: 0.74 },
    chairs,
    barTable: { x: 0.15, z: -3.05, ry: 0, w: 2.4, d: 0.42, h: 1.05 },
    // 창가 바테이블 중심 뒤 벽 — 포스트잇 코르크 보드
    eventBoard: { x: 0.15, z: -3.42, ry: 0, w: 1.55, h: 1.4 },
    counter: { x: -2.55, z: 2.55, ry: 0.15, w: 1.35, d: 0.52, h: 0.98 },
    sofa,
    coffeeTable: { x: 1.85, z: 2.05, ry: Math.PI / 2, w: 0.75, d: 0.42, h: 0.4 },
    rug: { x: 2.45, z: 2.05, w: 2.0, d: 2.0 },
    floorLamps: [{ x: 3.65, z: 2.85, ry: 0 }],
    pendants: [
      { x: 0, z: 0, drop: 0.95 },
      { x: -2.35, z: 0.15, drop: 0.9 },
      { x: 2.45, z: 2.05, drop: 1.0 },
    ],
    floorPlants: [
      { x: -3.7, z: -3.0, scale: 1.0 },
      { x: 3.7, z: -3.0, scale: 0.9 },
      { x: 1.2, z: 3.0, scale: 0.85 },
    ],
    seats: [
      ...chairs.map((p, i) => chairSeat(`chair-${i + 1}`, p, 0.46, Math.abs(p.ry) < 0.1 ? 1 : -1)),
      { id: 'sofa-1', x: sofa.x - 0.08, z: sofa.z - 0.48, ry: sofa.ry, y: 0.44, approach: 1 },
      { id: 'sofa-2', x: sofa.x - 0.08, z: sofa.z, ry: sofa.ry, y: 0.44, approach: 1 },
      { id: 'sofa-3', x: sofa.x - 0.08, z: sofa.z + 0.48, ry: sofa.ry, y: 0.44, approach: 1 },
      { id: 'bar-1', x: -0.7, z: -2.7, ry: Math.PI, y: 0.72, approach: 1 },
      { id: 'bar-2', x: 0.15, z: -2.7, ry: Math.PI, y: 0.72, approach: 1 },
      { id: 'bar-3', x: 1.0, z: -2.7, ry: Math.PI, y: 0.72, approach: 1 },
      // 카운터 손님 쪽(방 안, -z) 높은 바 스툴 — 카운터를 바라보고 앉는다
      { id: 'counter-1', x: -2.93, z: 2.04, ry: 0.15, y: 0.72, approach: -1 },
      // 카운터 안쪽(매니저 자리): 뒤 서가 오른쪽 빈 곳, 카운터를 바라보고 앉는다. 오른쪽(+x)에서 들어간다.
      { id: 'counter-2', x: -2.1, z: 3.1, ry: Math.PI + 0.15, y: 0.72, approach: 1, from: { x: -1.5, z: 3.05 } },
    ],
    spawn,
    spawns: [
      spawn,
      { x: 0.8, z: 2.3, ry: Math.PI },
      { x: -0.6, z: 2.2, ry: Math.PI },
      { x: 2.0, z: 1.0, ry: -2.2 },
      { x: -2.0, z: 1.0, ry: 2.2 },
      { x: 0.0, z: 1.85, ry: Math.PI },
      { x: 2.1, z: -0.4, ry: -1.2 },
      { x: -2.1, z: -0.4, ry: 1.2 },
    ],
    portals,
  };
}

function makeSeminar(): SpaceLayout {
  const room = roomOf(6.5, 5.5);
  const table = { x: 0, z: -0.15, ry: 0, w: 2.4, d: 0.95, h: 0.74 };
  // 의자는 테이블을 바라봄(+z 로컬). 뒤쪽(z 작은 쪽) ry=0, 앞쪽 ry=π.
  const chairs: Placement[] = [
    { x: -0.75, z: -0.75, ry: 0 },
    { x: 0, z: -0.75, ry: 0 },
    { x: 0.75, z: -0.75, ry: 0 },
    { x: -0.75, z: 0.45, ry: Math.PI },
    { x: 0, z: 0.45, ry: Math.PI },
    { x: 0.75, z: 0.45, ry: Math.PI },
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
    // 문 맞은편(+z) 벽을 넓게 채움. 문 쪽 벽은 비움. 스탠드 TV 없음.
    whiteboard: { x: 0, z: 2.58, ry: Math.PI, w: 5.9, h: 1.65 },
    seminarMonitor: null,
    floorLamps: [],
    pendants: [{ x: 0, z: -0.15, drop: 1.0 }],
    floorPlants: [{ x: -2.6, z: 2.1, scale: 0.9 }],
    seats: chairs.map((p, i) => chairSeat(`seminar-${i + 1}`, p, 0.48)),
    spawn,
    spawns: [spawn, { x: -0.7, z: 1.7, ry: Math.PI }, { x: 0.7, z: 1.7, ry: Math.PI }],
    // 출입문은 뒤벽(창·문 개구) — 포털도 같은 쪽
    portals: [{ to: 'hub', x: 0, z: -2.45, ry: Math.PI, label: '서점 중앙', w: 0.88, d: 0.22 }],
  };
}

function makeCinema(): SpaceLayout {
  const room = roomOf(6, 5);
  // 소파(+z 방향) ↔ 맞은편 스크린. 문은 -z.
  const sofa = { x: 0, z: -0.85, ry: 0, w: 2.15, d: 0.9 };
  const spawn = { x: 1.8, z: -1.5, ry: -0.4 };
  return {
    ...emptyBase('cinema', '영화감상실', room),
    openings: [{ cx: 0, w: 0.95, y0: 0, y1: 2.15, kind: 'door' }],
    shelves: [
      { x: -2.75, z: -0.3, ry: Math.PI / 2, w: 1.0, wing: 'A' },
      { x: 2.75, z: -0.3, ry: -Math.PI / 2, w: 1.0, wing: 'C' },
    ],
    islands: [],
    chairs: [],
    sofa,
    coffeeTable: { x: 0, z: 0.35, ry: 0, w: 1.0, d: 0.5, h: 0.38 },
    rug: { x: 0, z: -0.15, w: 2.6, d: 2.4 },
    // 스크린 면(+로컬 x)이 방 안(-z)을 향함
    screen: { x: 0, z: 2.28, ry: Math.PI / 2, w: 2.6, h: 1.45 },
    floorLamps: [{ x: -1.55, z: -1.35, ry: 0.3 }, { x: 1.55, z: -1.35, ry: -0.3 }],
    pendants: [],
    floorPlants: [{ x: -2.4, z: 1.6, scale: 0.8 }],
    seats: [
      { id: 'sofa-1', x: sofa.x - 0.58, z: sofa.z + 0.1, ry: sofa.ry, y: 0.44, approach: 1 },
      { id: 'sofa-2', x: sofa.x, z: sofa.z + 0.1, ry: sofa.ry, y: 0.44, approach: 1 },
      { id: 'sofa-3', x: sofa.x + 0.58, z: sofa.z + 0.1, ry: sofa.ry, y: 0.44, approach: 1 },
    ],
    spawn,
    spawns: [spawn, { x: -1.6, z: -1.4, ry: 0.5 }],
    portals: [{ to: 'hub', x: 0, z: -2.2, ry: Math.PI, label: '서점 중앙', w: 0.88, d: 0.22 }],
  };
}

function makeLecture(): SpaceLayout {
  const room = roomOf(7, 6);
  // ㄱ자 객석: (+z) 윙 + (-x) 윙이 북서쪽 코너에서 만남. 열린 바닥(+x,-z)에 원형 카페트.
  const north: TheaterBlock = {
    x: -0.25, z: 2.32, ry: Math.PI,
    rows: 4, cols: 5, rowDepth: 0.6, seatW: 0.5, rise: 0.2, firstY: 0.11,
    stairSide: -1, idPrefix: 'th-n',
  };
  const west: TheaterBlock = {
    x: -3.05, z: -0.45, ry: Math.PI / 2,
    rows: 4, cols: 4, rowDepth: 0.6, seatW: 0.5, rise: 0.2, firstY: 0.11,
    stairSide: 1, idPrefix: 'th-w',
  };
  const theaters = [north, west];
  // 강사·연주자: 열린 바닥 중간(문·객석 사이) 원형 카페트 + 작은 1인 윙백
  const rug = { x: 2.45, z: -0.55, w: 1.45, d: 1.45, round: true };
  // 객석(북·서)을 바라봄
  const performerRy = Math.atan2(-1.0 - rug.x, 0.7 - rug.z);
  const spawn = { x: 2.2, z: -1.95, ry: -1.8 };
  const seats = [
    ...theaters.flatMap(theaterSeats),
    { id: 'stage-1', x: rug.x, z: rug.z, ry: performerRy, y: 0.4, approach: 1 as const },
  ];
  return {
    ...emptyBase('lecture', '계단식 강연장', room),
    openings: [{ cx: 2.5, w: 0.95, y0: 0, y1: 2.15, kind: 'door' }],
    shelves: [
      // 둘레 서가(문 개구만 비움)
      { x: -1.85, z: 2.82, ry: Math.PI, w: 2.5, wing: 'A' },
      { x: 1.35, z: 2.82, ry: Math.PI, w: 2.4, wing: 'B' },
      { x: -3.28, z: 1.35, ry: Math.PI / 2, w: 2.15, wing: 'A' },
      { x: -3.28, z: -1.15, ry: Math.PI / 2, w: 2.15, wing: 'A' },
      { x: 3.28, z: 1.25, ry: -Math.PI / 2, w: 2.1, wing: 'C' },
      { x: 3.28, z: -0.85, ry: -Math.PI / 2, w: 1.9, wing: 'C' },
      { x: -1.55, z: -2.82, ry: 0, w: 2.7, wing: 'A' },
      { x: 0.55, z: -2.82, ry: 0, w: 1.25, wing: 'B' },
    ],
    islands: [],
    chairs: [],
    theaters,
    theater: north,
    stage: null,
    rug,
    floorLamps: [{ x: 2.55, z: 1.95, ry: -0.5 }],
    pendants: [{ x: rug.x, z: rug.z, drop: 1.0 }],
    floorPlants: [{ x: 2.75, z: 2.35, scale: 0.8 }],
    seats,
    spawn,
    spawns: [spawn, { x: 2.55, z: -1.55, ry: -1.8 }, { x: 1.55, z: -2.15, ry: -0.4 }],
    portals: [{ to: 'hub', x: 2.5, z: -2.7, ry: Math.PI, label: '서점 중앙', w: 0.88, d: 0.22 }],
  };
}

function makeSolo(): SpaceLayout {
  // 아주 좁은 1인 노크: 책상 폭 정도, 문 앞 한 발짝만
  const room = roomOf(2.2, 2.75, 2.6);
  // 문(-z) 맞은편(+z)에 벽면 붙박이 책상. 의자는 책상을 봄(ry=0).
  const desk = { x: 0, z: 1.02, ry: 0, w: 2.05, d: 0.46, h: 0.72 };
  const chair = { x: 0, z: 0.32, ry: 0 };
  const spawn = { x: 0, z: -0.75, ry: 0 };
  return {
    ...emptyBase('solo', '1인 작업실', room),
    openings: [{ cx: 0, w: 0.82, y0: 0, y1: 2.05, kind: 'door' }],
    shelves: [],
    islands: [],
    chairs: [],
    soloDesk: desk,
    soloChair: chair,
    rug: { x: 0, z: 0.35, w: 1.35, d: 1.15 },
    floorLamps: [],
    pendants: [],
    floorPlants: [],
    seats: [chairSeat('solo-1', chair, 0.42, -1)],
    spawn,
    spawns: [spawn],
    // 문 안쪽으로 들여 내비·근접 탐지가 막히지 않게. open: 문짝 없이 등 뒤가 보임
    portals: [{ to: 'hub', x: 0, z: -0.95, ry: Math.PI, label: '서점 중앙', w: 0.72, d: 0.2, open: true }],
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

/** 공간별 최대 인원. 차면 들어올 수 없다. */
export const SPACE_CAPACITY: Record<SpaceId, number> = {
  hub: 20,
  seminar: 8,
  cinema: 8,
  lecture: 20,
  solo: 1,
};

export function spaceCapacity(id: SpaceId = activeId): number {
  return SPACE_CAPACITY[id];
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
  const theaterList = L.theaters?.length ? L.theaters : (L.theater ? [L.theater] : []);
  THEATERS.splice(0, THEATERS.length, ...theaterList);
  assignOrClear(THEATER, theaterList[0] ?? null);
  assignOrClear(STAGE, L.stage);
  assignOrClear(BENCH, L.bench);
  assignOrClear(BAR_TABLE, L.barTable);
  assignOrClear(EVENT_BOARD, L.eventBoard);
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
  // 이전 공간에만 있던 옵션(round 등)이 남지 않게 지움
  for (const k of Object.keys(target) as string[]) {
    if (!(k in src)) delete (target as Record<string, unknown>)[k];
  }
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
export const THEATERS: TheaterBlock[] = [];
export const THEATER: TheaterBlock = {
  x: 0, z: 0, ry: 0, rows: 0, cols: 0, rowDepth: 0, seatW: 0, rise: 0, firstY: 0, _empty: true,
} as never;
export const STAGE: { x: number; z: number; w: number; d: number; h: number } = { x: 0, z: 0, w: 0, d: 0, h: 0, _empty: true } as never;
export const BENCH: Placement & { w: number; d: number; h: number } = { x: 0, z: 0, ry: 0, w: 0, d: 0, h: 0, _empty: true } as never;
export const BAR_TABLE: Placement & { w: number; d: number; h: number } = { ...(HUB.barTable!) };
export const EVENT_BOARD: { x: number; z: number; ry: number; w: number; h: number } = {
  ...(HUB.eventBoard!),
};
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
  if (s.from) return s.from;
  return { x: s.x + Math.sin(s.ry) * dist * s.approach, z: s.z + Math.cos(s.ry) * dist * s.approach };
}

export function colliders(): Collider[] {
  const list: Collider[] = [];
  const rect = (
    cx: number, cz: number, w: number, d: number, ry: number, h: number,
    seats?: string[],
    flags?: { eventBoard?: boolean },
  ) => {
    if (w <= 0.01 || d <= 0.01) return;
    const rot = Math.abs(Math.sin(ry)) > 0.5;
    const hw = (rot ? d : w) / 2, hd = (rot ? w : d) / 2;
    list.push({
      x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd, h,
      seatable: !!seats, seats,
      eventBoard: flags?.eventBoard,
    });
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
  if (isPresent(SOLO_CHAIR)) rect(SOLO_CHAIR.x, SOLO_CHAIR.z, 0.52, 0.55, 0, 0.9, ['solo-1']);
  if (isPresent(READING_TABLE)) {
    rect(READING_TABLE.x, READING_TABLE.z, READING_TABLE.w, READING_TABLE.d, 0, READING_TABLE.h);
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
    rect(BAR_TABLE.x, BAR_TABLE.z, BAR_TABLE.w, BAR_TABLE.d, 0, BAR_TABLE.h);
    // 바 스툴은 따로(앉기 히트)
    for (const s of SEATS.filter((seat) => seat.id.startsWith('bar-') || seat.id.startsWith('counter-'))) {
      rect(s.x, s.z, 0.4, 0.4, 0, 0.95, [s.id]);
    }
  }
  if (isPresent(EVENT_BOARD)) {
    // 클릭으로 포스트잇 UI를 열 수 있게 표시(걷기는 막고, 클릭은 보드로 처리)
    rect(EVENT_BOARD.x, EVENT_BOARD.z, EVENT_BOARD.w, 0.28, EVENT_BOARD.ry, EVENT_BOARD.h + 1.0, undefined, { eventBoard: true });
  }
  if (isPresent(COFFEE_TABLE)) rect(COFFEE_TABLE.x, COFFEE_TABLE.z, COFFEE_TABLE.w, COFFEE_TABLE.d, COFFEE_TABLE.ry, COFFEE_TABLE.h);
  if (isPresent(SCREEN)) rect(SCREEN.x, SCREEN.z, 0.08, SCREEN.w, SCREEN.ry, SCREEN.h + 0.6);
  if (isPresent(STAGE)) {
    const stageIds = SEATS.filter((s) => s.id.startsWith('stage-')).map((s) => s.id);
    rect(STAGE.x, STAGE.z, STAGE.w, STAGE.d, 0, STAGE.h + 0.05, stageIds.length ? stageIds : undefined);
  } else {
    for (const s of SEATS.filter((seat) => seat.id.startsWith('stage-'))) {
      // 작은 1인 윙백
      rect(s.x, s.z, 0.55, 0.58, s.ry, 1.0, [s.id]);
    }
  }
  for (const th of THEATERS) {
    if (th.rows < 1) continue;
    const tw = th.cols * th.seatW + 0.55;
    const td = th.rows * th.rowDepth + 0.2;
    const prefix = th.idPrefix ?? 'theater';
    const theaterIds = SEATS.filter((s) => s.id.startsWith(`${prefix}-`)).map((s) => s.id);
    const mid = theaterWorld(th.x, th.z, th.ry, 0, td * 0.45);
    rect(mid.x, mid.z, tw, td, th.ry, 1.2, theaterIds);
    const side = th.stairSide ?? -1;
    const stairLocalX = side * (tw / 2 + 0.35);
    const stair = theaterWorld(th.x, th.z, th.ry, stairLocalX, td * 0.45);
    rect(stair.x, stair.z, 0.7, td, th.ry, 1.0);
  }
  for (const l of FLOOR_LAMPS) rect(l.x, l.z, 0.34, 0.34, 0, 1.5);
  for (const p of FLOOR_PLANTS) rect(p.x, p.z, 0.45 * p.scale, 0.45 * p.scale, 0, 1.0 * p.scale);
  // 포털은 막지 않음(통과·클릭 트리거). 내비에서는 열어 둔다.
  return list;
}
