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
}

export const DEFAULT_SEED = 86;

export function readParams(search = location.search): Params {
  const q = new URLSearchParams(search);
  const num = (k: string, d: number) => {
    const v = Number(q.get(k));
    return q.has(k) && Number.isFinite(v) ? v : d;
  };
  const quality = q.get('quality');
  const cam = q.get('cam');
  const instance = Math.min(999, Math.max(1, Math.round(num('instance', 86))));
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
  };
}

/** 방 표시 이름. 기본은 "원미서가 86", 드롭다운은 1~8. */
export function roomLabel(instance: number): string {
  return `원미서가 ${instance}`;
}
