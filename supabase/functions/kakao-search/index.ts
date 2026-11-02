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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
  if (req.method !== "GET") return json(405, { ok: false, error: "method", message: "GET만 지원합니다." });

  const url = new URL(req.url);
  const title = (url.searchParams.get("title") ?? "").trim().slice(0, 120);
  const author = (url.searchParams.get("author") ?? "").trim().slice(0, 80);
  const publisher = (url.searchParams.get("publisher") ?? "").trim().slice(0, 80);
  if (!title) return json(400, { ok: false, error: "empty", message: "title이 필요합니다." });

  const key = (Deno.env.get("KAKAO_REST_API_KEY") ?? "").trim();
  if (!key) return json(503, { ok: false, error: "no_key", message: "KAKAO_REST_API_KEY 시크릿이 없습니다." });

  const attempts: { query: string; target?: string }[] = [
    { query: title, target: "title" },
    { query: [title, author].filter(Boolean).join(" ").trim() },
  ];
  if (publisher) attempts.push({ query: publisher, target: "publisher" });

  let lastMessage = "카카오 책 검색 결과가 없습니다.";
  for (const attempt of attempts) {
    try {
      const params = new URLSearchParams({ query: attempt.query, size: "10", sort: "accuracy" });
      if (attempt.target) params.set("target", attempt.target);
      const res = await fetch(`${KAKAO_BOOK_URL}?${params}`, {
        headers: { Authorization: `KakaoAK ${key}`, Accept: "application/json" },
      });
      if (res.status === 401 || res.status === 403) {
        return json(401, { ok: false, error: "forbidden", message: "카카오 REST API 키가 거부되었습니다." });
      }
      if (!res.ok) {
        lastMessage = `카카오 응답 ${res.status}`;
        continue;
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
      const ranked = (data.documents ?? [])
        .map((doc) => {
          const cover = httpsUrl(doc.thumbnail);
          const blurbRaw = stripHtml(doc.contents ?? "");
          const blurb = blurbRaw ? blurbRaw.slice(0, 280) : null;
          if (!cover && !blurb) return null;
          const vt = stripHtml(doc.title ?? "").toLowerCase();
          const tl = title.toLowerCase();
          let score = 0;
          if (vt.includes(tl) || tl.includes(vt)) score += 3;
          if (author && (doc.authors ?? []).some((a) => a.includes(author) || author.includes(a))) score += 2;
          if (publisher && (doc.publisher ?? "").includes(publisher)) score += 1;
          if (cover) score += 1;
          return {
            hit: {
              title: stripHtml(doc.title ?? title),
              author: (doc.authors ?? []).map(stripHtml).filter(Boolean).join(", ") || author,
              publisher: stripHtml(doc.publisher ?? publisher),
              coverUrl: cover ? enlargeThumbnail(cover) : "",
              blurb,
              link: httpsUrl(doc.url),
            },
            score: score + (cover ? 0 : -1),
          };
        })
        .filter((x): x is NonNullable<typeof x> => !!x)
        .sort((a, b) => b.score - a.score);

      const best = attempt.target === "publisher"
        ? ranked.find((r) => r.score >= 4)
        : ranked[0];
      if (best) return json(200, { ok: true, item: best.hit, source: "kakao" });
      lastMessage = "표지가 있는 결과가 없습니다.";
    } catch (e) {
      lastMessage = e instanceof Error ? e.message : "카카오 요청 실패";
    }
  }
  return json(502, { ok: false, error: "upstream", message: lastMessage });
});
