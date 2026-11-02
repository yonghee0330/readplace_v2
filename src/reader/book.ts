// 지금 읽는 책 메타데이터(제목·저자·출판사)와 표지 URL.
// 본문은 다루지 않는다. 표지: 카카오 책(서버 프록시) → Google Books → Open Library → 제목 카드.
import { fetchKakaoBook, setKakaoApiBase } from './kakaoApi';

export interface ReadingBook {
  title: string;
  author: string;
  publisher: string;
  /** 표지 이미지 URL(https 또는 data URL). 없으면 null */
  coverUrl: string | null;
}

const KEY = 'bbooks.book';

export function loadBook(): ReadingBook | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const b = JSON.parse(raw) as ReadingBook;
    if (!b || typeof b.title !== 'string' || !b.title.trim()) return null;
    const cover = typeof b.coverUrl === 'string' ? b.coverUrl : null;
    return {
      title: b.title.trim().slice(0, 120),
      author: String(b.author ?? '').trim().slice(0, 80),
      publisher: String(b.publisher ?? '').trim().slice(0, 80),
      coverUrl: cover && (cover.startsWith('http') || cover.startsWith('data:')) ? cover : null,
    };
  } catch {
    return null;
  }
}

export function saveBook(book: ReadingBook): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(book));
  } catch {
    /* 저장 못 해도 진행 */
  }
}

export function sameBookMeta(a: ReadingBook, b: ReadingBook): boolean {
  return a.title === b.title && a.author === b.author && a.publisher === b.publisher;
}

function httpsUrl(u: string | undefined | null): string | null {
  if (!u) return null;
  const s = u.replace(/^http:\/\//i, 'https://');
  return s.startsWith('https://') ? s : null;
}

/** @deprecated setKakaoApiBase와 동일 */
export const setCoverApiBase = setKakaoApiBase;

/**
 * 제목·저자·출판사로 온라인 서점에서 표지를 찾는다.
 * 카카오 책(중계 서버 프록시) → Google Books → Open Library → 제목 data URL.
 */
export async function lookupCover(
  title: string,
  author: string,
  publisher: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const t = title.trim();
  if (!t) return null;
  const kakao = await fetchKakaoBook(t, author, publisher, signal);
  if (kakao.ok && kakao.item?.coverUrl?.startsWith('http')) return kakao.item.coverUrl;
  const fromGoogle = await searchGoogleBooks(t, author, publisher, signal);
  if (fromGoogle) return fromGoogle;
  const fromOl = await searchOpenLibrary(t, author, publisher, signal);
  if (fromOl) return fromOl;
  return drawCoverCard(t, author, publisher);
}

async function searchGoogleBooks(
  title: string,
  author: string,
  publisher: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const queries = [
    ['intitle:' + title, author && `inauthor:${author}`, publisher && `inpublisher:${publisher}`].filter(Boolean).join(' '),
    [title, author, publisher].filter(Boolean).join(' '),
  ];
  for (const q of queries) {
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=10`, { signal });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        items?: {
          volumeInfo?: {
            title?: string;
            authors?: string[];
            publisher?: string;
            imageLinks?: { thumbnail?: string; smallThumbnail?: string };
          };
        }[];
      };
      const scored = (data.items ?? [])
        .map((it) => {
          const v = it.volumeInfo ?? {};
          const cover = httpsUrl(v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail);
          if (!cover) return null;
          let score = 0;
          const vt = (v.title ?? '').toLowerCase();
          const tl = title.toLowerCase();
          if (vt.includes(tl) || tl.includes(vt)) score += 3;
          if (author && (v.authors ?? []).some((a) => a.includes(author) || author.includes(a))) score += 2;
          if (publisher && (v.publisher ?? '').includes(publisher)) score += 1;
          return { cover: cover.replace(/zoom=\d/, 'zoom=2'), score };
        })
        .filter((x): x is { cover: string; score: number } => !!x)
        .sort((a, b) => b.score - a.score);
      if (scored[0]) return scored[0].cover;
    } catch {
      /* 다음 후보 */
    }
  }
  return null;
}

async function searchOpenLibrary(
  title: string,
  author: string,
  publisher: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const q = [title, author, publisher].filter(Boolean).join(' ');
  try {
    const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=12`, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      docs?: { cover_i?: number; title?: string; author_name?: string[]; publisher?: string[] }[];
    };
    const scored = (data.docs ?? [])
      .map((d) => {
        if (!d.cover_i) return null;
        let score = 0;
        const vt = (d.title ?? '').toLowerCase();
        const tl = title.toLowerCase();
        if (vt.includes(tl) || tl.includes(vt)) score += 3;
        if (author && (d.author_name ?? []).some((a) => a.includes(author) || author.includes(a))) score += 2;
        if (publisher && (d.publisher ?? []).some((p) => p.includes(publisher))) score += 1;
        return { id: d.cover_i, score };
      })
      .filter((x): x is { id: number; score: number } => !!x)
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    return best ? `https://covers.openlibrary.org/b/id/${best.id}-L.jpg` : null;
  } catch {
    return null;
  }
}

/** 온라인 표지를 못 찾을 때 쓰는 간단한 표지 카드(data URL). */
function drawCoverCard(title: string, author: string, publisher: string): string {
  const w = 240, h = 360;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const hue = [...title].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 40;
  g.fillStyle = `hsl(${28 + hue} 32% 28%)`;
  g.fillRect(0, 0, w, h);
  g.fillStyle = `hsl(${28 + hue} 28% 22%)`;
  g.fillRect(14, 14, w - 28, h - 28);
  g.strokeStyle = 'rgba(255,236,210,0.35)';
  g.lineWidth = 2;
  g.strokeRect(22, 22, w - 44, h - 44);
  g.fillStyle = '#f3e6d2';
  g.font = '700 22px "Noto Serif KR", serif';
  g.textAlign = 'center';
  wrapText(g, title, w / 2, h * 0.38, w - 56, 28);
  g.font = '500 14px Pretendard, sans-serif';
  g.fillStyle = 'rgba(243,230,210,0.85)';
  const sub = [author, publisher].filter(Boolean).join(' · ');
  if (sub) wrapText(g, sub, w / 2, h * 0.72, w - 56, 20);
  return c.toDataURL('image/jpeg', 0.88);
}

function wrapText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number): void {
  const chars = [...text];
  const lines: string[] = [];
  let line = '';
  for (const ch of chars) {
    const next = line + ch;
    if (g.measureText(next).width > maxW && line) {
      lines.push(line);
      line = ch;
    } else line = next;
  }
  if (line) lines.push(line);
  const start = y - ((Math.min(lines.length, 5) - 1) * lh) / 2;
  lines.slice(0, 5).forEach((ln, i) => g.fillText(ln, x, start + i * lh));
}
