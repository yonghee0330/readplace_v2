// 서비스워커(빌드에서만 등록). 빌드할 때 vite.config.ts의 pwa 플러그인이 아래 두 값을 채워 dist/sw.js로 낸다.
// - 앱 껍데기(html·js·css·manifest·아이콘)는 설치할 때 미리 캐시한다.
// - 글꼴처럼 많은 파일은 처음 쓸 때 캐시한다(캐시 우선).
// - 페이지 이동은 네트워크 우선, 오프라인이면 캐시한 index.html을 준다.
// GitHub Pages 하위 경로(/readplace_v2/)에서도 동작하도록 모든 경로는 sw.js 위치 기준 상대 경로다.
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `bbooks-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE.map((p) => new URL(p, self.registration.scope).href)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('bbooks-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 페이지가 서비스워커가 붙기 전에 받은 같은 출처 파일 목록을 보내면 캐시에 담는다(실패는 무시)
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'cache' || !Array.isArray(data.urls)) return;
  const urls = data.urls.filter((u) => typeof u === 'string' && new URL(u).origin === self.location.origin);
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(urls.map((u) => c.match(u, { ignoreSearch: true }).then((hit) => hit || c.add(u).catch(() => undefined)))),
    ),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          if (res.ok) void caches.open(CACHE).then((c) => c.put(new URL('index.html', self.registration.scope).href, copy));
          return res;
        })
        .catch(() => caches.match(new URL('index.html', self.registration.scope).href).then((r) => r ?? Response.error())),
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            void caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
