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
  presence: 'local' | 'ws' | 'supabase';
  ws: string;
  autoread: boolean;
  autostart: boolean;
  /** 캡처·테스트용: 이 자리에 앉은 채로 시작(예: sofa-2) */
  seat: string | null;
  /** 입장 상한. 기본 20, `?cap=`은 테스트용으로 1~20만 허용 */
  cap: number;
  /** 카카오 표지 프록시 등 HTTP API origin. 없으면 ws 주소에서 추론하거나 같은 출처 */
  api: string;
  /** 캡처·테스트용 날씨 고정. 없으면 부천 실시간 */
  weather: 'rain' | 'snow' | 'clear' | null;
}

export const DEFAULT_SEED = 86;

/** 입장 장소는 한 곳. 번호로 방을 나누지 않는다. */
export const ROOM_NAME = '비북스-M';

/** 서점 중앙(허브) 기본 정원. NPC는 세지 않는다. */
export const ROOM_CAPACITY = 20;
/** 공간별 정원 상한(강연장 등). presence·ws 클램프에 쓴다. */
export const MAX_SPACE_CAPACITY = 40;

export function readParams(search = location.search): Params {
  const q = new URLSearchParams(search);
  const num = (k: string, d: number) => {
    const v = Number(q.get(k));
    return q.has(k) && Number.isFinite(v) ? v : d;
  };
  const quality = q.get('quality');
  const cam = q.get('cam');
  const instance = Math.min(999, Math.max(1, Math.round(num('instance', 86))));
  const cap = Math.min(MAX_SPACE_CAPACITY, Math.max(1, Math.round(num('cap', ROOM_CAPACITY))));
  const autoread = q.has('autoread') && q.get('autoread') !== '0';
  const weatherRaw = q.get('weather');
  const weather = weatherRaw === 'rain' || weatherRaw === 'snow' || weatherRaw === 'clear' ? weatherRaw : null;
  const presenceRaw = q.get('presence');
  const presence: Params['presence'] =
    presenceRaw === 'ws' || presenceRaw === 'supabase' || presenceRaw === 'local'
      ? presenceRaw
      : 'local';
  return {
    seed: Math.floor(num('seed', DEFAULT_SEED)),
    quality: quality === 'low' || quality === 'medium' || quality === 'high' ? quality : null,
    cam: cam === 'overview' || cam === 'avatar' || cam === 'window' ? cam : null,
    debug: q.get('debug') === '1',
    npc: q.get('npc') !== '0',
    room: q.get('room') || 'wonmi',
    instance,
    presence,
    ws: q.get('ws') || 'ws://localhost:8787',
    autoread,
    // 캡처·테스트용: 시작 화면을 건너뛰고 바로 들어간다.
    autostart: q.get('autostart') === '1' || cam !== null || autoread,
    seat: q.get('seat'),
    cap,
    api: (q.get('api') || '').replace(/\/$/, ''),
    weather,
  };
}

/** URL에 `presence=`가 없고 Supabase env가 있으면 supabase 모드. */
export function resolvePresence(
  raw: Params['presence'],
  search = location.search,
  hasSupabase: boolean,
): Params['presence'] {
  const q = new URLSearchParams(search);
  if (q.has('presence')) return raw;
  if (hasSupabase) return 'supabase';
  return raw;
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

/** 입장 장소의 화면 표기. 방 번호는 붙이지 않는다. */
export function roomLabel(): string {
  // 화면에 보이는 이름. ROOM_NAME(비북스-M)은 접속 채널 이름이라 바꾸지 않는다.
  return '서점 중앙';
}
