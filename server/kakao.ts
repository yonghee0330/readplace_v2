// 카카오 책 검색 API 프록시.
// 브라우저에서 REST 키를 노출하지 않도록 서버에서 Authorization 헤더를 붙여 호출한다.
// 문서: https://developers.kakao.com/docs/latest/ko/daum-search/dev-guide#search-book

export interface KakaoBookHit {
  title: string;
  author: string;
  publisher: string;
  coverUrl: string;
  /** 카카오 책 소개 요약(본문 아님) */
  blurb: string | null;
  link: string | null;
}

export type KakaoSearchResult =
  | { ok: true; items: KakaoBookHit[]; item: KakaoBookHit | null; source: 'kakao' }
  | { ok: false; error: 'no_key' | 'upstream' | 'empty' | 'forbidden'; message: string };

const KAKAO_BOOK_URL = 'https://dapi.kakao.com/v3/search/book';

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function httpsUrl(u: string | undefined | null): string | null {
  if (!u) return null;
  const s = u.replace(/^http:\/\//i, 'https://').trim();
  return s.startsWith('https://') ? s : null;
}

/** 카카오 CDN 썸네일을 조금 더 큰 크기로 바꾼다(실패해도 원본 URL 사용). */
function enlargeThumbnail(url: string): string {
  return url.replace(/\/thumb\/R\d+x\d+\./, '/thumb/R300x400.');
}

function toHit(
  doc: {
    title?: string;
    authors?: string[];
    publisher?: string;
    thumbnail?: string;
    contents?: string;
    url?: string;
  },
  fallbackTitle: string,
): KakaoBookHit | null {
  const cover = httpsUrl(doc.thumbnail);
  const blurbRaw = stripHtml(doc.contents ?? '');
  const blurb = blurbRaw ? blurbRaw.slice(0, 280) : null;
  if (!cover && !blurb) return null;
  return {
    title: stripHtml(doc.title ?? fallbackTitle),
    author: (doc.authors ?? []).map(stripHtml).filter(Boolean).join(', '),
    publisher: stripHtml(doc.publisher ?? ''),
    coverUrl: cover ? enlargeThumbnail(cover) : '',
    blurb,
    link: httpsUrl(doc.url),
  };
}

/** 카카오 책 검색. 키는 환경 변수 KAKAO_REST_API_KEY. 제목 기준 목록을 돌려준다. */
export async function searchKakaoBooks(
  title: string,
  _author = '',
  _publisher = '',
  signal?: AbortSignal,
): Promise<KakaoSearchResult> {
  const key = (process.env.KAKAO_REST_API_KEY ?? '').trim();
  if (!key) {
    return { ok: false, error: 'no_key', message: 'KAKAO_REST_API_KEY 환경 변수가 없습니다.' };
  }
  const q = title.trim();
  if (!q) return { ok: false, error: 'empty', message: '검색어가 비었습니다.' };

  try {
    const params = new URLSearchParams({
      query: q,
      size: '15',
      sort: 'accuracy',
      target: 'title',
    });
    const res = await fetch(`${KAKAO_BOOK_URL}?${params}`, {
      signal,
      headers: {
        Authorization: `KakaoAK ${key}`,
        Accept: 'application/json',
      },
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: 'forbidden', message: '카카오 REST API 키가 거부되었습니다.' };
    }
    if (!res.ok) {
      return { ok: false, error: 'upstream', message: `카카오 응답 ${res.status}` };
    }
    const data = (await res.json()) as {
      documents?: {
        title?: string;
        authors?: string[];
        publisher?: string;
        thumbnail?: string;
        contents?: string;
        url?: string;
      }[];
    };
    const seen = new Set<string>();
    const items: KakaoBookHit[] = [];
    for (const doc of data.documents ?? []) {
      const hit = toHit(doc, q);
      if (!hit) continue;
      const keyId = `${hit.title}|${hit.author}|${hit.publisher}`.toLowerCase();
      if (seen.has(keyId)) continue;
      seen.add(keyId);
      items.push(hit);
    }
    if (!items.length) {
      return { ok: false, error: 'upstream', message: '검색 결과가 없어요. 제목을 조금 바꿔 보세요.' };
    }
    return { ok: true, items, item: items[0] ?? null, source: 'kakao' };
  } catch (e) {
    if (signal?.aborted) throw e;
    return { ok: false, error: 'upstream', message: e instanceof Error ? e.message : '카카오 요청 실패' };
  }
}
