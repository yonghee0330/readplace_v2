// 카카오 책 검색 클라이언트. REST 키는 서버/Edge에만 두고 프록시를 친다.
import { supabaseConfig } from '../net/supabaseClient';

export interface KakaoBookItem {
  title: string;
  author: string;
  publisher: string;
  coverUrl: string;
  blurb: string | null;
  datetime: string | null;
  year: number | null;
  link: string | null;
}

export type KakaoClientResult =
  | { ok: true; item: KakaoBookItem | null; items: KakaoBookItem[] }
  | { ok: false; error: string; message?: string };

let apiBase = '';

/** 표지·미리보기 공통 origin. 비어 있으면 같은 출처 `/api/kakao/...`만 시도. */
export function setKakaoApiBase(base: string): void {
  apiBase = (base || '').replace(/\/$/, '');
}

export function getKakaoApiBase(): string {
  return apiBase;
}

function endpoints(): string[] {
  const list: string[] = ['/api/kakao/search'];
  if (apiBase) {
    if (apiBase.includes('/functions/v1')) {
      list.unshift(apiBase.endsWith('kakao-search') ? apiBase : `${apiBase}/kakao-search`);
    } else {
      list.unshift(`${apiBase}/api/kakao/search`);
    }
  }
  return [...new Set(list)];
}

function authHeaders(url: string): HeadersInit | undefined {
  if (!url.includes('/functions/v1/')) return undefined;
  const cfg = supabaseConfig();
  if (!cfg) return undefined;
  return {
    Authorization: `Bearer ${cfg.key}`,
    apikey: cfg.key,
  };
}

function yearFromDatetime(dt: string | null | undefined): number | null {
  if (!dt) return null;
  const m = /^(\d{4})/.exec(dt.trim());
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1000 && y <= 2100 ? y : null;
}

function normalizeItem(raw: Partial<KakaoBookItem> & { datetime?: string | null } | null | undefined): KakaoBookItem | null {
  if (!raw?.title?.trim()) return null;
  const cover = raw.coverUrl && raw.coverUrl.startsWith('http') ? raw.coverUrl : '';
  const datetime = raw.datetime ?? null;
  const year = typeof raw.year === 'number' ? raw.year : yearFromDatetime(datetime);
  return {
    title: raw.title.trim(),
    author: (raw.author ?? '').trim(),
    publisher: (raw.publisher ?? '').trim(),
    coverUrl: cover,
    blurb: raw.blurb ?? null,
    datetime,
    year,
    link: raw.link ?? null,
  };
}

/** 제목으로 카카오 책 목록을 찾는다. */
export async function searchKakaoBooks(
  title: string,
  signal?: AbortSignal,
): Promise<KakaoClientResult> {
  const t = title.trim();
  if (!t) return { ok: false, error: 'empty', message: '제목을 적어 주세요.' };
  const q = new URLSearchParams({ title: t });
  let last: KakaoClientResult = { ok: false, error: 'upstream', message: '카카오 프록시에 연결하지 못했어요.' };
  for (const base of endpoints()) {
    try {
      const res = await fetch(`${base}?${q}`, { signal, headers: authHeaders(base) });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        item?: KakaoBookItem | null;
        items?: KakaoBookItem[];
        error?: string;
        message?: string;
      } | null;
      if (!res.ok) {
        last = {
          ok: false,
          error: data?.error || `http_${res.status}`,
          message: data?.message || `검색 서버 응답 ${res.status}`,
        };
        continue;
      }
      if (data?.ok) {
        const fromList = (data.items ?? []).map(normalizeItem).filter((x): x is KakaoBookItem => !!x);
        const single = normalizeItem(data.item ?? null);
        const items = fromList.length ? fromList : single ? [single] : [];
        return { ok: true, items, item: items[0] ?? null };
      }
      last = { ok: false, error: data?.error || 'upstream', message: data?.message };
    } catch (e) {
      if (signal?.aborted) throw e;
      last = { ok: false, error: 'network', message: e instanceof Error ? e.message : '네트워크 오류' };
    }
  }
  return last;
}

/** 제목으로 카카오 책 1건을 찾는다(미리보기·표지용). */
export async function fetchKakaoBook(
  title: string,
  _author = '',
  _publisher = '',
  signal?: AbortSignal,
): Promise<KakaoClientResult> {
  return searchKakaoBooks(title, signal);
}

/** 표시용 출간연도. 원서가 있으면 2026(2019) 형식. */
export function formatPublishYears(year: number | null | undefined, originalYear?: number | null): string {
  if (!year && !originalYear) return '';
  if (year && originalYear && originalYear !== year) return `${year}(${originalYear})`;
  if (year) return String(year);
  return String(originalYear);
}
