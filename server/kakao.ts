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
  | { ok: true; item: KakaoBookHit | null; source: 'kakao' }
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

function scoreDoc(
  doc: { title?: string; authors?: string[]; publisher?: string; thumbnail?: string },
  title: string,
  author: string,
  publisher: string,
): number {
  let score = 0;
  const vt = stripHtml(doc.title ?? '').toLowerCase();
  const tl = title.toLowerCase();
  if (vt.includes(tl) || tl.includes(vt)) score += 3;
  if (author && (doc.authors ?? []).some((a) => a.includes(author) || author.includes(a))) score += 2;
  if (publisher && (doc.publisher ?? '').includes(publisher)) score += 1;
  if (doc.thumbnail) score += 1;
  return score;
}

/** 카카오 책 검색. 키는 환경 변수 KAKAO_REST_API_KEY. */
export async function searchKakaoBooks(
  title: string,
  author: string,
  publisher: string,
  signal?: AbortSignal,
): Promise<KakaoSearchResult> {
  const key = (process.env.KAKAO_REST_API_KEY ?? '').trim();
  if (!key) {
    return { ok: false, error: 'no_key', message: 'KAKAO_REST_API_KEY 환경 변수가 없습니다.' };
  }
  if (!title.trim()) return { ok: false, error: 'empty', message: '검색어가 비었습니다.' };

  const attempts: { query: string; target?: string }[] = [
    { query: title.trim(), target: 'title' },
    { query: [title, author].filter(Boolean).join(' ').trim() },
  ];
  if (publisher.trim()) attempts.push({ query: publisher.trim(), target: 'publisher' });

  let lastMessage = '카카오 책 검색 결과가 없습니다.';
  for (const attempt of attempts) {
    try {
      const params = new URLSearchParams({
        query: attempt.query,
        size: '10',
        sort: 'accuracy',
      });
      if (attempt.target) params.set('target', attempt.target);
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
        lastMessage = `카카오 응답 ${res.status}`;
        continue;
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
      const ranked = (data.documents ?? [])
        .map((doc) => {
          const cover = httpsUrl(doc.thumbnail);
          const blurbRaw = stripHtml(doc.contents ?? '');
          const blurb = blurbRaw ? blurbRaw.slice(0, 280) : null;
          // 표지 또는 소개 중 하나라도 있으면 채택(머리 위 책 미리보기용)
          if (!cover && !blurb) return null;
          return {
            hit: {
              title: stripHtml(doc.title ?? title),
              author: (doc.authors ?? []).map(stripHtml).filter(Boolean).join(', ') || author,
              publisher: stripHtml(doc.publisher ?? publisher),
              coverUrl: cover ? enlargeThumbnail(cover) : '',
              blurb,
              link: httpsUrl(doc.url),
            } satisfies KakaoBookHit,
            score: scoreDoc(doc, title, author, publisher) + (cover ? 0 : -1),
          };
        })
        .filter((x): x is { hit: KakaoBookHit; score: number } => !!x)
        .sort((a, b) => b.score - a.score);

      // publisher-only 검색은 제목 점수가 있는 것만 채택
      const best = attempt.target === 'publisher'
        ? ranked.find((r) => r.score >= 4)
        : ranked[0];
      if (best) return { ok: true, item: best.hit, source: 'kakao' };
      lastMessage = '표지가 있는 결과가 없습니다.';
    } catch (e) {
      if (signal?.aborted) throw e;
      lastMessage = e instanceof Error ? e.message : '카카오 요청 실패';
    }
  }
  return { ok: false, error: 'upstream', message: lastMessage };
}
