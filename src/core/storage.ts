// localStorage 래퍼. 사생활 보호 모드 등에서 저장소가 막혀도 앱이 멈추지 않게 한다.
import type { QualityLevel } from './params';
import type { HairStyle } from '../net/presence';
import { randomNickname } from '../net/nickname';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 못 해도 진행 */
  }
}

export const OUTFIT_COLORS = ['#c9583e', '#e0a53b', '#5b8a5a', '#3f6e8c', '#8a5a9e', '#d98a9b', '#e8dcc4', '#6b7b3a'] as const;
export const HAIR_STYLES: HairStyle[] = ['bangs', 'bob', 'short'];

export interface Profile { nickname: string; color: string; hair: HairStyle }

export interface Settings {
  quality: QualityLevel | 'auto';
  reducedMotion: boolean;
  npc: boolean;
  sound: boolean;
  /** 유튜브 서점 BGM(기본 켜짐) */
  music: boolean;
  /** BGM 볼륨 0~100 */
  musicVolume: number;
  keyboardMove: boolean;
  introDismissed: boolean;
}

export const DEFAULT_MUSIC_VOLUME = 45;

const PROFILE_KEY = 'bbooks.profile';
const SETTINGS_KEY = 'bbooks.settings';

export function loadProfile(): Profile {
  const p = read<Profile>(PROFILE_KEY, {
    nickname: randomNickname(),
    color: OUTFIT_COLORS[Math.floor(Math.random() * OUTFIT_COLORS.length)],
    hair: HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)],
  });
  write(PROFILE_KEY, p);
  return p;
}
export function saveProfile(p: Profile): void {
  write(PROFILE_KEY, p);
}

export function loadSettings(): Settings {
  const s = read<Settings>(SETTINGS_KEY, {
    quality: 'auto',
    reducedMotion: false,
    npc: true,
    sound: false,
    music: true,
    musicVolume: DEFAULT_MUSIC_VOLUME,
    keyboardMove: false,
    introDismissed: false,
  });
  if (s.music === undefined) s.music = true;
  if (!Number.isFinite(s.musicVolume)) s.musicVolume = DEFAULT_MUSIC_VOLUME;
  s.musicVolume = Math.max(0, Math.min(100, Math.round(s.musicVolume)));
  return s;
}
export function saveSettings(s: Settings): void {
  write(SETTINGS_KEY, s);
}
