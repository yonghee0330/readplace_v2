// LocalPresence: BroadcastChannel로 같은 브라우저의 탭끼리 함께 있기.
// 2초마다 하트비트, 6초 동안 소식 없는 피어는 제거(탭이 닫힌 경우 대비).
// 입장 직후 잠깐 다른 탭의 소식을 모은 뒤, 정원을 넘기면 들어오지 않는다.
import { ROOM_CAPACITY } from '../core/params';
import {
  HEARTBEAT_MS, PeerTracker, STATE_INTERVAL_MS, channelName, fitsCapacity, isPlayerState,
  type ActionEvent, type Presence, type PlayerState,
} from './presence';

type Msg =
  | { type: 'hello'; state: PlayerState; joinedAt: number; pending?: boolean }
  | { type: 'state'; state: PlayerState; joinedAt?: number; pending?: boolean }
  | { type: 'action'; action: ActionEvent }
  | { type: 'bye'; id: string };

const JOIN_WAIT_MS = 350;
const PENDING_MS = 2000;

export class LocalPresence extends PeerTracker implements Presence {
  private ch: BroadcastChannel | null = null;
  private me: PlayerState | null = null;
  private timers: number[] = [];
  private lastSent = 0;
  private pending = 0;
  private generation = 0;
  private admitted = false;
  private selfJoined = 0;
  /** id → 들어온 시각. 피어로 올리기 전의 입장 시도도 정원 계산에 넣는다. */
  private heard = new Map<string, { at: number; heard: number }>();

  constructor(private capacity = ROOM_CAPACITY) {
    super();
  }

  async connect(room: string, instance: number, me: PlayerState): Promise<'ok' | 'full'> {
    this.disconnect();
    const gen = this.generation;
    this.me = me;
    this.selfId = me.id;
    this.selfJoined = Date.now();
    this.admitted = false;
    this.quietUntil = Date.now() + 1500;
    this.setStatus('connecting');
    if (typeof BroadcastChannel === 'undefined') {
      this.admitted = true;
      this.setStatus('connected');
      return 'ok';
    }
    this.ch = new BroadcastChannel(channelName(room, instance));
    this.ch.onmessage = (e) => this.handle(e.data as Msg);
    this.post({ type: 'hello', state: me, joinedAt: this.selfJoined, pending: true });
    addEventListener('pagehide', this.onHide);
    await new Promise((r) => setTimeout(r, JOIN_WAIT_MS));
    if (gen !== this.generation) return 'full';
    if (!this.fits()) {
      this.disconnect();
      return 'full';
    }
    this.admitted = true;
    this.postState(me);
    this.timers.push(window.setInterval(() => this.me && this.postState(this.me), HEARTBEAT_MS));
    this.timers.push(window.setInterval(() => {
      this.sweep();
      this.sweepPending();
    }, 1000));
    this.setStatus('connected');
    return 'ok';
  }

  disconnect(): void {
    this.generation++;
    this.admitted = false;
    if (this.ch && this.me) this.post({ type: 'bye', id: this.me.id });
    this.ch?.close();
    this.ch = null;
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    clearTimeout(this.pending);
    this.pending = 0;
    this.heard.clear();
    removeEventListener('pagehide', this.onHide);
    this.clear();
  }

  sendState(s: PlayerState): void {
    this.me = s;
    const now = Date.now();
    const wait = STATE_INTERVAL_MS - (now - this.lastSent);
    if (wait <= 0) {
      this.lastSent = now;
      this.postState(s);
    } else if (!this.pending) {
      // 10Hz로 걸러 마지막 상태는 꼭 보낸다
      this.pending = window.setTimeout(() => {
        this.pending = 0;
        this.lastSent = Date.now();
        if (this.me) this.postState(this.me);
      }, wait);
    }
  }

  sendAction(a: ActionEvent): void {
    if (!this.admitted) return;
    this.post({ type: 'action', action: a });
  }

  private onHide = () => {
    if (this.ch && this.me) this.post({ type: 'bye', id: this.me.id });
  };

  private postState(s: PlayerState): void {
    this.post({ type: 'state', state: s, joinedAt: this.selfJoined, pending: !this.admitted });
  }

  private post(m: Msg): void {
    try {
      this.ch?.postMessage(m);
    } catch {
      /* 채널이 닫힌 직후 */
    }
  }

  private note(id: string, at: number): void {
    if (id === this.selfId || !Number.isFinite(at)) return;
    const prev = this.heard.get(id);
    this.heard.set(id, { at, heard: prev?.heard ?? Date.now() });
  }

  /** 먼저 온 사람부터 세어 내가 정원 안인지 */
  private fits(): boolean {
    const others: [string, number][] = [];
    const seen = new Set<string>();
    for (const id of this.peers.keys()) {
      seen.add(id);
      others.push([id, this.heard.get(id)?.at ?? 0]);
    }
    for (const [id, h] of this.heard) if (!seen.has(id)) others.push([id, h.at]);
    return fitsCapacity(this.selfId, this.selfJoined, others, this.capacity);
  }

  private sweepPending(): void {
    const now = Date.now();
    for (const [id, h] of this.heard) {
      if (!this.peers.has(id) && now - h.heard > PENDING_MS) this.heard.delete(id);
    }
  }

  private handle(m: Msg): void {
    if (!m || typeof m !== 'object') return;
    if (m.type === 'hello' && isPlayerState(m.state) && Number.isFinite(m.joinedAt)) {
      this.note(m.state.id, m.joinedAt);
      // 아직 입장 확인 전인 사람은 알림·아바타로 올리지 않는다
      if (!m.pending) this.upsert(m.state);
      if (this.me) this.postState({ ...this.me, t: Date.now() });
    } else if (m.type === 'state' && isPlayerState(m.state)) {
      if (Number.isFinite(m.joinedAt)) this.note(m.state.id, m.joinedAt!);
      if (!m.pending) this.upsert(m.state);
    } else if (m.type === 'action' && m.action && typeof m.action.from === 'string' && m.action.type === 'nod') {
      if (m.action.from !== this.selfId) {
        this.touch(m.action.from);
        this.emitAction({ ...m.action, nickname: String(m.action.nickname).slice(0, 40) });
      }
    } else if (m.type === 'bye' && typeof m.id === 'string') {
      this.heard.delete(m.id);
      this.remove(m.id);
    }
  }
}
