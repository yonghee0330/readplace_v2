// URL 파라미터. 캡처·테스트가 화면을 고정할 수 있게 한곳에서 읽는다.

export type QualityLevel = 'low' | 'medium' | 'high';
export type CamPreset = 'overview' | 'avatar' | 'window';

export interface Params {
  seed: number;
  quality: QualityLevel | null;
  cam: CamPreset | null;
  debug: boolean;
  npc: boolean;
  room: string;
  instance: number;
  presence: 'local' | 'ws';
  ws: string;
  autoread: boolean;
  autostart: boolean;
  /** 캡처·테스트용: 이 자리에 앉은 채로 시작(예: sofa-2) */
  seat: string | null;
  /** 입장 상한. 기본 20, `?cap=`은 테스트용으로 1~20만 허용 */
  cap: number;
  /** 카카오 표지 프록시 등 HTTP API origin. 없으면 ws 주소에서 추론하거나 같은 출처 */
  api: string;
}

export const DEFAULT_SEED = 86;

/** 입장 장소는 한 곳. 번호로 방을 나누지 않는다. */
export const ROOM_NAME = '원미서가';

/** 한 서점에 함께 있을 수 있는 사람 수. NPC는 세지 않는다. */
export const ROOM_CAPACITY = 20;

export function readParams(search = location.search): Params {
  const q = new URLSearchParams(search);
  const num = (k: string, d: number) => {
    const v = Number(q.get(k));
    return q.has(k) && Number.isFinite(v) ? v : d;
  };
  const quality = q.get('quality');
  const cam = q.get('cam');
  const instance = Math.min(999, Math.max(1, Math.round(num('instance', 86))));
  const cap = Math.min(ROOM_CAPACITY, Math.max(1, Math.round(num('cap', ROOM_CAPACITY))));
  const autoread = q.has('autoread') && q.get('autoread') !== '0';
  return {
    seed: Math.floor(num('seed', DEFAULT_SEED)),
    quality: quality === 'low' || quality === 'medium' || quality === 'high' ? quality : null,
    cam: cam === 'overview' || cam === 'avatar' || cam === 'window' ? cam : null,
    debug: q.get('debug') === '1',
    npc: q.get('npc') !== '0',
    room: q.get('room') || 'wonmi',
    instance,
    presence: q.get('presence') === 'ws' ? 'ws' : 'local',
    ws: q.get('ws') || 'ws://localhost:8787',
    autoread,
    // 캡처·테스트용: 시작 화면을 건너뛰고 바로 들어간다.
    autostart: q.get('autostart') === '1' || cam !== null || autoread,
    seat: q.get('seat'),
    cap,
    api: (q.get('api') || '').replace(/\/$/, ''),
  };
}

/** ws URL에서 표지 프록시 HTTP origin을 뽑는다. */
export function apiBaseFromWs(ws: string): string {
  try {
    const u = new URL(ws);
    u.protocol = u.protocol === 'wss:' ? 'https:' : 'http:';
    u.pathname = '';
    u.search = '';
    u.hash = '';
    return u.origin;
  } catch {
    return '';
  }
}

/** 입장 장소 이름. 방 번호는 붙이지 않는다. */
export function roomLabel(): string {
  return ROOM_NAME;
}
