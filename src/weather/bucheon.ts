// 부천(원미동 근처) 실시간 날씨 → 서점 연출 3종.
// Open-Meteo(키 없음, CORS 허용). 실패·타임아웃 시 비 오는 오후로 둔다.

export type WeatherKind = 'rain' | 'snow' | 'clear';

export interface WeatherInfo {
  kind: WeatherKind;
  /** HUD·안내 문구 */
  label: string;
  /** Open-Meteo WMO 코드. 실패 시 null */
  code: number | null;
  /** API에서 왔으면 true, 폴백이면 false */
  live: boolean;
}

/** 부천시청 근처 좌표(원미동) */
const LAT = 37.5034;
const LON = 126.766;

const CACHE_KEY = 'bbooks.weather';
const CACHE_MS = 20 * 60 * 1000;

export function weatherLabel(kind: WeatherKind): string {
  if (kind === 'rain') return '부천 · 비';
  if (kind === 'snow') return '부천 · 눈';
  return '부천 · 맑음';
}

export function weatherCopy(kind: WeatherKind): string {
  if (kind === 'rain') return '비 오는 오후, 서점 한쪽에 앉아<br />각자의 책을 함께 읽어요.';
  if (kind === 'snow') return '눈 내리는 오후, 서점 한쪽에 앉아<br />각자의 책을 함께 읽어요.';
  return '맑은 오후, 서점 한쪽에 앉아<br />각자의 책을 함께 읽어요.';
}

export function weatherAria(kind: WeatherKind): string {
  if (kind === 'rain') return '비 오는 오후의 작은 동네 서점 비북스 실내. 벽마다 책이 꽂힌 나무 서가, 창가 독서 테이블, 소파와 스탠드 조명이 있다.';
  if (kind === 'snow') return '눈 내리는 오후의 작은 동네 서점 비북스 실내. 벽마다 책이 꽂힌 나무 서가, 창가 독서 테이블, 소파와 스탠드 조명이 있다.';
  return '맑은 오후의 작은 동네 서점 비북스 실내. 벽마다 책이 꽂힌 나무 서가, 창가 독서 테이블, 소파와 스탠드 조명이 있다.';
}

/** WMO weather code → 서점 연출 */
export function kindFromCode(code: number): WeatherKind {
  // 눈·진눈깨비
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  // 이슬비·비·소나기·뇌우
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) return 'rain';
  // 맑음·구름·안개 등은 맑은 날 분위기(새소리·화이트노이즈)
  return 'clear';
}

function parseForced(raw: string | null | undefined): WeatherKind | null {
  if (raw === 'rain' || raw === 'snow' || raw === 'clear') return raw;
  return null;
}

function readCache(): WeatherInfo | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { at?: number; kind?: WeatherKind; code?: number | null };
    if (!j?.at || Date.now() - j.at > CACHE_MS) return null;
    if (j.kind !== 'rain' && j.kind !== 'snow' && j.kind !== 'clear') return null;
    return { kind: j.kind, label: weatherLabel(j.kind), code: j.code ?? null, live: true };
  } catch {
    return null;
  }
}

function writeCache(info: WeatherInfo): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), kind: info.kind, code: info.code }));
  } catch {
    /* ignore */
  }
}

const FALLBACK: WeatherInfo = { kind: 'rain', label: weatherLabel('rain'), code: null, live: false };

/**
 * 부천 현재 날씨를 가져온다.
 * `forced`가 있으면 API 없이 그 값을 쓴다(?weather=).
 */
export async function fetchBucheonWeather(forced?: string | null): Promise<WeatherInfo> {
  const fix = parseForced(forced);
  if (fix) return { kind: fix, label: weatherLabel(fix), code: null, live: false };

  const cached = readCache();
  if (cached) return cached;

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&current=weather_code,precipitation,snowfall&timezone=Asia%2FSeoul`;

  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return FALLBACK;
    const data = (await res.json()) as {
      current?: { weather_code?: number; precipitation?: number; snowfall?: number };
    };
    const code = Number(data.current?.weather_code);
    if (!Number.isFinite(code)) return FALLBACK;
    let kind = kindFromCode(code);
    // 코드가 애매해도 적설량이 있으면 눈
    if ((data.current?.snowfall ?? 0) > 0) kind = 'snow';
    else if (kind === 'clear' && (data.current?.precipitation ?? 0) > 0.2) kind = 'rain';
    const info: WeatherInfo = { kind, label: weatherLabel(kind), code, live: true };
    writeCache(info);
    return info;
  } catch {
    return FALLBACK;
  } finally {
    clearTimeout(timer);
  }
}
