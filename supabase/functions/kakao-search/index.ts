// Supabase Edge Function: 카카오 책 검색 프록시.
// 시크릿: supabase secrets set KAKAO_REST_API_KEY=...
// 배포: supabase functions deploy kakao-search --no-verify-jwt  (anon 키로 호출)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const KAKAO_BOOK_URL = "https://dapi.kakao.com/v3/search/book";

function cors(res: Response): Response {
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  h.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  return new Response(res.body, { status: res.status, headers: h });
}

function json(status: number, body: unknown): Response {
  return cors(Response.json(body, { status }));
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

function httpsUrl(u: string | undefined | null): string | null {
  if (!u) return null;
  const s = u.replace(/^http:\/\//i, "https://").trim();
  return s.startsWith("https://") ? s : null;
}

function enlargeThumbnail(url: string): string {
  return url.replace(/\/thumb\/R\d+x\d+\./, "/thumb/R300x400.");
}

type Hit = {
  title: string;
  author: string;
  publisher: string;
  coverUrl: string;
  blurb: string | null;
  link: string | null;
};

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
): Hit | null {
  const cover = httpsUrl(doc.thumbnail);
  const blurbRaw = stripHtml(doc.contents ?? "");
  const blurb = blurbRaw ? blurbRaw.slice(0, 280) : null;
  if (!cover && !blurb) return null;
  return {
    title: stripHtml(doc.title ?? fallbackTitle),
    author: (doc.authors ?? []).map(stripHtml).filter(Boolean).join(", "),
    publisher: stripHtml(doc.publisher ?? ""),
    coverUrl: cover ? enlargeThumbnail(cover) : "",
    blurb,
    link: httpsUrl(doc.url),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
  if (req.method !== "GET") return json(405, { ok: false, error: "method", message: "GET만 지원합니다." });

  const url = new URL(req.url);
  const title = (url.searchParams.get("title") ?? "").trim().slice(0, 120);
  if (!title) return json(400, { ok: false, error: "empty", message: "title이 필요합니다." });

  const key = (Deno.env.get("KAKAO_REST_API_KEY") ?? "").trim();
  if (!key) return json(503, { ok: false, error: "no_key", message: "KAKAO_REST_API_KEY 시크릿이 없습니다." });

  try {
    const params = new URLSearchParams({
      query: title,
      size: "15",
      sort: "accuracy",
      target: "title",
    });
    const res = await fetch(`${KAKAO_BOOK_URL}?${params}`, {
      headers: { Authorization: `KakaoAK ${key}`, Accept: "application/json" },
    });
    if (res.status === 401 || res.status === 403) {
      return json(401, { ok: false, error: "forbidden", message: "카카오 REST API 키가 거부되었습니다." });
    }
    if (!res.ok) {
      return json(502, { ok: false, error: "upstream", message: `카카오 응답 ${res.status}` });
    }
    const data = await res.json() as {
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
    const items: Hit[] = [];
    for (const doc of data.documents ?? []) {
      const hit = toHit(doc, title);
      if (!hit) continue;
      const id = `${hit.title}|${hit.author}|${hit.publisher}`.toLowerCase();
      if (seen.has(id)) continue;
      seen.add(id);
      items.push(hit);
    }
    if (!items.length) {
      return json(502, { ok: false, error: "upstream", message: "검색 결과가 없어요. 제목을 조금 바꿔 보세요." });
    }
    return json(200, { ok: true, items, item: items[0], source: "kakao" });
  } catch (e) {
    return json(502, {
      ok: false,
      error: "upstream",
      message: e instanceof Error ? e.message : "카카오 요청 실패",
    });
  }
});
