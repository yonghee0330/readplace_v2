// WsPresence: server/index.ts 중계 서버에 붙어 다른 기기와도 함께 있기(?presence=ws&ws=ws://...).
// 끊기면 1·2·4·8·최대 15초 간격으로 다시 연결한다.
import { ROOM_CAPACITY } from '../core/params';
import {
  HEARTBEAT_MS, PeerTracker, STATE_INTERVAL_MS, isPlayerState,
  type ActionEvent, type Presence, type PlayerState,
} from './presence';

const BACKOFF = [1000, 2000, 4000, 8000, 15000];

type ServerMsg =
  | { type: 'welcome'; peers: PlayerState[] }
  | { type: 'state'; state: PlayerState }
  | { type: 'action'; action: ActionEvent }
  | { type: 'leave'; id: string }
  | { type: 'full'; limit?: number };

export class WsPresence extends PeerTracker implements Presence {
  private ws: WebSocket | null = null;
  private room = '';
  private instance = 0;
  private me: PlayerState | null = null;
  private attempt = 0;
  private retry = 0;
  private heartbeat = 0;
  private closedByUser = false;
  private lastSent = 0;
  private pending = 0;
  private settle: ((r: 'ok' | 'full') => void) | null = null;
  private settleTimer = 0;

  /** 탭을 닫을 때 서버의 하트비트 정리(최대 20초)를 기다리지 않고 바로 나갔다고 알린다 */
  private onHide = () => this.disconnect();

  private capacity = ROOM_CAPACITY;

  constructor(private url: string) {
    super();
  }

  setCapacity(n: number): void {
    this.capacity = Math.max(1, Math.min(ROOM_CAPACITY, Math.round(n)));
  }

  connect(room: string, instance: number, me: PlayerState): Promise<'ok' | 'full'> {
    this.disconnect();
    this.closedByUser = false;
    this.room = room;
    this.instance = instance;
    this.me = me;
    this.selfId = me.id;
    this.attempt = 0;
    this.setStatus('connecting');
    addEventListener('pagehide', this.onHide);
    return new Promise((resolve) => {
      this.settle = resolve;
      this.open();
      // 서버가 응답하지 않으면 혼자 있는 것으로 들어간다(재연결은 계속)
      this.settleTimer = window.setTimeout(() => this.done('ok'), 4000);
    });
  }

  private open(): void {
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.scheduleRetry();
      this.done('ok');
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.attempt = 0;
      // 다시 연결할 때 받은 목록은 조용히 반영(이미 알던 사람들)
      this.quietUntil = Date.now() + 1500;
      this.send({ type: 'join', room: this.room, instance: this.instance, state: this.me, cap: this.capacity });
      clearInterval(this.heartbeat);
      this.heartbeat = window.setInterval(() => this.me && this.send({ type: 'state', state: { ...this.me, t: Date.now() } }), HEARTBEAT_MS);
    };
    ws.onmessage = (e) => {
      let m: ServerMsg;
      try {
        m = JSON.parse(String(e.data));
      } catch {
        return;
      }
      this.handle(m);
    };
    ws.onclose = () => {
      clearInterval(this.heartbeat);
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.closedByUser) return;
      this.scheduleRetry();
      // 서버가 꺼져 있으면 혼자 들어가고, 붙으면 다시 만난다
      this.done('ok');
    };
    // 오류는 onclose에서 함께 처리한다(콘솔 에러를 남기지 않게 기본 동작만).
    ws.onerror = () => {};
  }

  private scheduleRetry(): void {
    this.setStatus('reconnecting');
    const wait = BACKOFF[Math.min(this.attempt, BACKOFF.length - 1)];
    this.attempt++;
    clearTimeout(this.retry);
    this.retry = window.setTimeout(() => this.open(), wait);
  }

  disconnect(): void {
    removeEventListener('pagehide', this.onHide);
    this.closedByUser = true;
    clearTimeout(this.retry);
    clearTimeout(this.settleTimer);
    this.settle = null;
    clearInterval(this.heartbeat);
    clearTimeout(this.pending);
    this.pending = 0;
    if (this.ws) {
      this.send({ type: 'leave' });
      this.ws.close();
      this.ws = null;
    }
    this.clear();
  }

  sendState(s: PlayerState): void {
    this.me = s;
    const now = Date.now();
    const wait = STATE_INTERVAL_MS - (now - this.lastSent);
    if (wait <= 0) {
      this.lastSent = now;
      this.send({ type: 'state', state: s });
    } else if (!this.pending) {
      this.pending = window.setTimeout(() => {
        this.pending = 0;
        this.lastSent = Date.now();
        if (this.me) this.send({ type: 'state', state: this.me });
      }, wait);
    }
  }

  sendAction(a: ActionEvent): void {
    this.send({ type: 'action', action: a });
  }

  private send(m: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  private done(r: 'ok' | 'full'): void {
    clearTimeout(this.settleTimer);
    const settle = this.settle;
    if (!settle) return;
    this.settle = null;
    // 서버가 꺼져 재연결 중이면 '연결됨'으로 덮지 않는다
    if (r === 'ok' && this.status !== 'reconnecting') this.setStatus('connected');
    settle(r);
  }

  /** 정원이 차 거절되면 재연결하지 않고 입장을 멈춘다. */
  private rejectFull(): void {
    this.closedByUser = true;
    clearTimeout(this.retry);
    clearInterval(this.heartbeat);
    this.done('full');
    this.ws?.close();
    this.ws = null;
  }

  private handle(m: ServerMsg): void {
    if (!m || typeof m !== 'object') return;
    if (m.type === 'full') {
      this.rejectFull();
    } else if (m.type === 'welcome' && Array.isArray(m.peers)) {
      const peers = m.peers.filter(isPlayerState);
      // 서버가 이미 정원을 채운 목록을 주면 들어가지 않는다
      if (peers.length >= this.capacity) {
        this.rejectFull();
        return;
      }
      this.setStatus('connected');
      // 다시 연결: 서버 목록에 없는 피어는 조용히 지운다
      const ids = new Set(peers.map((p) => p.id));
      for (const id of [...this.peers.keys()]) if (!ids.has(id)) this.remove(id, true);
      for (const p of peers) this.upsert(p, true);
      this.done('ok');
    } else if (m.type === 'state' && isPlayerState(m.state)) {
      this.upsert(m.state);
    } else if (
      m.type === 'action'
      && (m.action?.type === 'nod' || m.action?.type === 'drink')
      && typeof m.action.from === 'string'
    ) {
      if (m.action.from !== this.selfId) this.emitAction({ ...m.action, nickname: String(m.action.nickname).slice(0, 40) });
    } else if (m.type === 'leave' && typeof m.id === 'string') {
      this.remove(m.id);
    }
  }
}
