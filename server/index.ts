// 실시간 중계 서버(ws). 방·인스턴스별 피어 목록, 상태 중계, 액션(눈인사) 브로드캐스트.
// 실행: npm run server  (PORT 환경 변수, 기본 8787)
// 저장하는 것은 접속 중인 아바타 상태(닉네임·색·위치)뿐이고, 연결이 끊기면 바로 지운다.
import { WebSocketServer, WebSocket } from 'ws';
import { isPlayerState, type PlayerState } from '../src/net/presence';

const PORT = Number(process.env.PORT ?? 8787);
const PING_MS = 10_000;

interface Client { ws: WebSocket; key: string | null; state: PlayerState | null; alive: boolean; tokens: number }

const rooms = new Map<string, Set<Client>>();
const wss = new WebSocketServer({ port: PORT, maxPayload: 4 * 1024 });

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

wss.on('connection', (ws) => {
  const c: Client = { ws, key: null, state: null, alive: true, tokens: 40 };
  ws.on('pong', () => (c.alive = true));
  ws.on('message', (raw) => {
    // 아주 단순한 속도 제한: 초당 약 20개
    if (c.tokens <= 0) return;
    c.tokens--;
    let m: { type?: string; room?: unknown; instance?: unknown; state?: unknown; action?: { type?: unknown; nickname?: unknown } };
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
      c.key = `${room}:${inst}`;
      c.state = m.state;
      const set = rooms.get(c.key) ?? new Set<Client>();
      rooms.set(c.key, set);
      send(c, { type: 'welcome', peers: [...set].map((o) => o.state).filter(Boolean) });
      set.add(c);
      broadcast(c.key, { type: 'state', state: c.state }, c);
    } else if (m.type === 'state' && c.key && isPlayerState(m.state) && m.state.id === c.state?.id) {
      c.state = m.state;
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

console.log(`[bbooks] 중계 서버 ws://localhost:${PORT}`);
