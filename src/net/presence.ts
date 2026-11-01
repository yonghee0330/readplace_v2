// 실시간 함께 있기 인터페이스. 구현은 LocalPresence(BroadcastChannel)와 WsPresence(중계 서버).
// Supabase Realtime·Cloudflare Durable Objects로 바꿀 때도 이 인터페이스만 새로 구현하면 된다.

export type AvatarState = 'stand' | 'walk' | 'sit' | 'read';
export type HairStyle = 'bangs' | 'bob' | 'short';

export interface PlayerState {
  id: string;
  nickname: string;
  color: string;
  hair: HairStyle;
  position: [number, number, number];
  rotationY: number;
  state: AvatarState;
  /** 앉아 있으면 자리 id. 읽기 상태에서도 앉아 있으면 유지된다. */
  seatId: string | null;
  t: number;
}

export type ActionType = 'nod' | 'join' | 'leave';
export interface ActionEvent {
  type: ActionType;
  from: string;
  nickname: string;
  t: number;
}

export type PresenceStatus = 'connecting' | 'connected' | 'reconnecting';

export interface Presence {
  connect(room: string, instance: number, me: PlayerState): Promise<void>;
  disconnect(): void;
  /** 10Hz 이하로 부른다(구현이 한 번 더 걸러 준다). */
  sendState(s: PlayerState): void;
  sendAction(a: ActionEvent): void;
  onPeers(cb: (peers: Map<string, PlayerState>) => void): void;
  onAction(cb: (a: ActionEvent) => void): void;
  onStatus(cb: (s: PresenceStatus) => void): void;
}

export const STATE_INTERVAL_MS = 100; // 10Hz
export const HEARTBEAT_MS = 2000;
export const PEER_TIMEOUT_MS = 6000;

export function channelName(room: string, instance: number): string {
  return `bbooks:${room}:${instance}`;
}

export function newId(): string {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** 받은 데이터가 PlayerState 모양인지 확인한다(다른 탭·서버에서 온 값은 믿지 않는다). */
export function isPlayerState(v: unknown): v is PlayerState {
  const s = v as PlayerState;
  return !!s && typeof s.id === 'string' && typeof s.nickname === 'string' && typeof s.color === 'string'
    && Array.isArray(s.position) && s.position.length === 3 && s.position.every(Number.isFinite)
    && Number.isFinite(s.rotationY) && ['stand', 'walk', 'sit', 'read'].includes(s.state)
    && ['bangs', 'bob', 'short'].includes(s.hair) && s.nickname.length <= 40;
}

/**
 * 피어 목록 공통 처리: 처음 보는 피어 → 'join' 알림, 사라진 피어 → 'leave' 알림.
 * Local·Ws 구현이 함께 쓴다.
 */
export class PeerTracker {
  readonly peers = new Map<string, PlayerState>();
  private seen = new Map<string, number>();
  private peerCbs: ((p: Map<string, PlayerState>) => void)[] = [];
  private actionCbs: ((a: ActionEvent) => void)[] = [];
  private statusCbs: ((s: PresenceStatus) => void)[] = [];
  status: PresenceStatus = 'connecting';
  selfId = '';
  /** 들어온 직후 이미 있던 사람들 목록을 받는 동안은 "들어왔어요" 알림을 띄우지 않는다. */
  quietUntil = 0;

  onPeers(cb: (p: Map<string, PlayerState>) => void): void {
    this.peerCbs.push(cb);
  }
  onAction(cb: (a: ActionEvent) => void): void {
    this.actionCbs.push(cb);
  }
  onStatus(cb: (s: PresenceStatus) => void): void {
    this.statusCbs.push(cb);
    cb(this.status);
  }

  setStatus(s: PresenceStatus): void {
    if (this.status === s) return;
    this.status = s;
    for (const cb of this.statusCbs) cb(s);
  }

  emitAction(a: ActionEvent): void {
    for (const cb of this.actionCbs) cb(a);
  }

  /** silent: 다시 연결하며 받은 목록처럼 알림을 띄우지 않을 때 */
  upsert(s: PlayerState, silent = Date.now() < this.quietUntil): void {
    if (s.id === this.selfId) return;
    const isNew = !this.peers.has(s.id);
    this.peers.set(s.id, s);
    this.seen.set(s.id, Date.now());
    if (isNew && !silent) this.emitAction({ type: 'join', from: s.id, nickname: s.nickname, t: Date.now() });
    this.emitPeers();
  }

  touch(id: string): void {
    if (this.peers.has(id)) this.seen.set(id, Date.now());
  }

  remove(id: string, silent = false): void {
    const s = this.peers.get(id);
    if (!s) return;
    this.peers.delete(id);
    this.seen.delete(id);
    if (!silent) this.emitAction({ type: 'leave', from: id, nickname: s.nickname, t: Date.now() });
    this.emitPeers();
  }

  /** 오래 소식 없는 피어 정리(탭이 갑자기 닫힌 경우) */
  sweep(timeout = PEER_TIMEOUT_MS): void {
    const now = Date.now();
    for (const [id, at] of this.seen) if (now - at > timeout) this.remove(id);
  }

  clear(): void {
    this.peers.clear();
    this.seen.clear();
    this.emitPeers();
  }

  private emitPeers(): void {
    for (const cb of this.peerCbs) cb(this.peers);
  }
}
