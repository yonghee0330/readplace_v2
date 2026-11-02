// 카카오 책 검색 클라이언트. REST 키는 서버/Edge에만 두고 프록시를 친다.
import { supabaseConfig } from '../net/supabaseClient';

export interface KakaoBookItem {
  title: string;
  author: string;
  publisher: string;
  coverUrl: string;
  blurb: string | null;
  link: string | null;
}

export type KakaoClientResult =
  | { ok: true; item: KakaoBookItem | null }
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

/** 제목으로 카카오 책 1건을 찾는다. 프록시가 없으면 ok:false. */
export async function fetchKakaoBook(
  title: string,
  author = '',
  publisher = '',
  signal?: AbortSignal,
): Promise<KakaoClientResult> {
  const t = title.trim();
  if (!t) return { ok: false, error: 'empty', message: '제목이 필요합니다.' };
  const q = new URLSearchParams({ title: t, author: author.trim(), publisher: publisher.trim() });
  let last: KakaoClientResult = { ok: false, error: 'upstream', message: '카카오 프록시에 연결하지 못했어요.' };
  for (const base of endpoints()) {
    try {
      const res = await fetch(`${base}?${q}`, { signal, headers: authHeaders(base) });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        item?: KakaoBookItem | null;
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
        const item = data.item ?? null;
        if (item && item.coverUrl && !item.coverUrl.startsWith('http')) item.coverUrl = '';
        return { ok: true, item };
      }
      last = { ok: false, error: data?.error || 'upstream', message: data?.message };
    } catch (e) {
      if (signal?.aborted) throw e;
      last = { ok: false, error: 'network', message: e instanceof Error ? e.message : '네트워크 오류' };
    }
  }
  return last;
}
