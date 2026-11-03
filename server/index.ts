// 실시간 중계(ws) + 카카오 책 표지 검색 프록시(HTTP).
// 한 방은 20명까지. 넘치면 full을 보내고 넣지 않는다.
// 실행: npm run server  (PORT, KAKAO_REST_API_KEY 환경 변수 또는 .env)
// 저장하는 것은 접속 중인 아바타 상태뿐이고, 연결이 끊기면 바로 지운다.
import http from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { ROOM_CAPACITY } from '../src/core/params';
import { isPlayerState, sanitizePlayerState, type PlayerState } from '../src/net/presence';
import { searchKakaoBooks } from './kakao';

/** 패키지 없이 .env만 읽는다(이미 있는 환경 변수는 덮지 않음). */
function loadEnvFile(): void {
  const path = resolve(process.cwd(), '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnvFile();

const PORT = Number(process.env.PORT ?? 8787);
const PING_MS = 10_000;

interface Client { ws: WebSocket; key: string | null; state: PlayerState | null; alive: boolean; tokens: number }

const rooms = new Map<string, Set<Client>>();

const send = (c: Client, m: unknown) => {
  if (c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(m));
};
const broadcast = (key: string, m: unknown, except?: Client) => {
  for (const c of rooms.get(key) ?? []) if (c !== except) send(c, m);
};

function leave(c: Client): void {
  if (!c.key) return;
  const set = rooms.get(c.key);
  set?.delete(c);
  if (c.state) broadcast(c.key, { type: 'leave', id: c.state.id });
  if (set && set.size === 0) rooms.delete(c.key);
  c.key = null;
  c.state = null;
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(raw),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  res.end(raw);
}

async function handleHttp(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const host = req.headers.host ?? `localhost:${PORT}`;
  const url = new URL(req.url ?? '/', `http://${host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/api/kakao/search' || url.pathname === '/api/kakao' || url.pathname === '/api/book/search')) {
    const title = (url.searchParams.get('title') ?? '').trim().slice(0, 120);
    const author = (url.searchParams.get('author') ?? '').trim().slice(0, 80);
    const publisher = (url.searchParams.get('publisher') ?? '').trim().slice(0, 80);
    if (!title) {
      json(res, 400, { ok: false, error: 'empty', message: 'title이 필요합니다.' });
      return;
    }
    try {
      const result = await searchKakaoBooks(title, author, publisher);
      const status = result.ok ? 200 : result.error === 'no_key' ? 503 : result.error === 'forbidden' ? 401 : 502;
      json(res, status, result);
    } catch (e) {
      json(res, 502, { ok: false, error: 'upstream', message: e instanceof Error ? e.message : '카카오 요청 실패' });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    json(res, 200, {
      ok: true,
      kakaoKey: Boolean((process.env.KAKAO_REST_API_KEY ?? '').trim()),
      rooms: rooms.size,
    });
    return;
  }

  json(res, 404, { ok: false, error: 'not_found', message: '없는 경로입니다.' });
}

const server = http.createServer((req, res) => {
  void handleHttp(req, res);
});

const wss = new WebSocketServer({ server, maxPayload: 4 * 1024 });

wss.on('connection', (ws) => {
  const c: Client = { ws, key: null, state: null, alive: true, tokens: 40 };
  ws.on('pong', () => (c.alive = true));
  ws.on('message', (raw) => {
    // 아주 단순한 속도 제한: 초당 약 20개
    if (c.tokens <= 0) return;
    c.tokens--;
    let m: { type?: string; room?: unknown; instance?: unknown; state?: unknown; cap?: unknown; action?: { type?: unknown; nickname?: unknown } };
    try {
      m = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (m.type === 'join') {
      const room = typeof m.room === 'string' && /^[a-z0-9-]{1,32}$/.test(m.room) ? m.room : null;
      const inst = Number(m.instance);
      if (!room || !Number.isInteger(inst) || inst < 1 || inst > 999 || !isPlayerState(m.state)) return;
      leave(c);
      const key = `${room}:${inst}`;
      const set = rooms.get(key) ?? new Set<Client>();
      // 클라이언트 cap(1인실=1 등). 없으면 기본 20. 서버 상한은 ROOM_CAPACITY.
      const rawCap = Number(m.cap);
      const cap = Number.isFinite(rawCap)
        ? Math.max(1, Math.min(ROOM_CAPACITY, Math.round(rawCap)))
        : room.endsWith('-solo') ? 1 : ROOM_CAPACITY;
      if (set.size >= cap) {
        send(c, { type: 'full', limit: cap });
        return;
      }
      c.key = key;
      c.state = sanitizePlayerState(m.state);
      rooms.set(c.key, set);
      send(c, { type: 'welcome', peers: [...set].map((o) => o.state).filter(Boolean) });
      set.add(c);
      broadcast(c.key, { type: 'state', state: c.state }, c);
    } else if (m.type === 'state' && c.key && isPlayerState(m.state) && m.state.id === c.state?.id) {
      c.state = sanitizePlayerState(m.state);
      broadcast(c.key, { type: 'state', state: c.state }, c);
    } else if (m.type === 'action' && c.key && c.state && m.action?.type === 'nod') {
      broadcast(c.key, { type: 'action', action: { type: 'nod', from: c.state.id, nickname: c.state.nickname, t: Date.now() } }, c);
    } else if (m.type === 'leave') {
      leave(c);
    }
  });
  ws.on('close', () => leave(c));
  ws.on('error', () => leave(c));
  (ws as unknown as { _client: Client })._client = c;
});

// 하트비트: 응답 없는 연결 정리 + 속도 제한 토큰 채우기
setInterval(() => {
  for (const ws of wss.clients) {
    const c = (ws as unknown as { _client: Client })._client;
    if (!c.alive) {
      leave(c);
      ws.terminate();
      continue;
    }
    c.alive = false;
    ws.ping();
  }
}, PING_MS);
setInterval(() => {
  for (const ws of wss.clients) {
    const c = (ws as unknown as { _client: Client })._client;
    c.tokens = Math.min(40, c.tokens + 20);
  }
}, 1000);

server.listen(PORT, () => {
  const hasKey = Boolean((process.env.KAKAO_REST_API_KEY ?? '').trim());
  console.log(`[bbooks] 중계·표지 서버 http://localhost:${PORT}  (ws 동일 포트)`);
  console.log(`[bbooks] 카카오 키: ${hasKey ? '설정됨' : '없음(KAKAO_REST_API_KEY)'}`);
});
