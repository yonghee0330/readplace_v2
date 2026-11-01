// LocalPresence: BroadcastChannel로 같은 브라우저의 탭끼리 함께 있기.
// 2초마다 하트비트, 6초 동안 소식 없는 피어는 제거(탭이 닫힌 경우 대비).
import {
  HEARTBEAT_MS, PeerTracker, STATE_INTERVAL_MS, channelName, isPlayerState,
  type ActionEvent, type Presence, type PlayerState,
} from './presence';

type Msg =
  | { type: 'hello'; state: PlayerState }
  | { type: 'state'; state: PlayerState }
  | { type: 'action'; action: ActionEvent }
  | { type: 'bye'; id: string };

export class LocalPresence extends PeerTracker implements Presence {
  private ch: BroadcastChannel | null = null;
  private me: PlayerState | null = null;
  private timers: number[] = [];
  private lastSent = 0;
  private pending = 0;

  async connect(room: string, instance: number, me: PlayerState): Promise<void> {
    this.disconnect();
    this.me = me;
    this.selfId = me.id;
    this.quietUntil = Date.now() + 1500;
    this.setStatus('connecting');
    if (typeof BroadcastChannel === 'undefined') {
      // 아주 오래된 브라우저: 혼자 있는 것으로 동작
      this.setStatus('connected');
      return;
    }
    this.ch = new BroadcastChannel(channelName(room, instance));
    this.ch.onmessage = (e) => this.handle(e.data as Msg);
    this.post({ type: 'hello', state: me });
    this.timers.push(window.setInterval(() => this.me && this.post({ type: 'state', state: { ...this.me, t: Date.now() } }), HEARTBEAT_MS));
    this.timers.push(window.setInterval(() => this.sweep(), 1000));
    addEventListener('pagehide', this.onHide);
    this.setStatus('connected');
  }

  disconnect(): void {
    if (this.ch && this.me) this.post({ type: 'bye', id: this.me.id });
    this.ch?.close();
    this.ch = null;
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    clearTimeout(this.pending);
    removeEventListener('pagehide', this.onHide);
    this.clear();
  }

  sendState(s: PlayerState): void {
    this.me = s;
    const now = Date.now();
    const wait = STATE_INTERVAL_MS - (now - this.lastSent);
    if (wait <= 0) {
      this.lastSent = now;
      this.post({ type: 'state', state: s });
    } else if (!this.pending) {
      // 10Hz로 걸러 마지막 상태는 꼭 보낸다
      this.pending = window.setTimeout(() => {
        this.pending = 0;
        this.lastSent = Date.now();
        if (this.me) this.post({ type: 'state', state: this.me });
      }, wait);
    }
  }

  sendAction(a: ActionEvent): void {
    this.post({ type: 'action', action: a });
  }

  private onHide = () => {
    if (this.ch && this.me) this.post({ type: 'bye', id: this.me.id });
  };

  private post(m: Msg): void {
    try {
      this.ch?.postMessage(m);
    } catch {
      /* 채널이 닫힌 직후 */
    }
  }

  private handle(m: Msg): void {
    if (!m || typeof m !== 'object') return;
    if (m.type === 'hello' && isPlayerState(m.state)) {
      this.upsert(m.state);
      // 새로 온 탭이 나를 바로 알 수 있게 응답
      if (this.me) this.post({ type: 'state', state: { ...this.me, t: Date.now() } });
    } else if (m.type === 'state' && isPlayerState(m.state)) {
      this.upsert(m.state);
    } else if (m.type === 'action' && m.action && typeof m.action.from === 'string' && m.action.type === 'nod') {
      if (m.action.from !== this.selfId) {
        this.touch(m.action.from);
        this.emitAction({ ...m.action, nickname: String(m.action.nickname).slice(0, 40) });
      }
    } else if (m.type === 'bye' && typeof m.id === 'string') {
      this.remove(m.id);
    }
  }
}
