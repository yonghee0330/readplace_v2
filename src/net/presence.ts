// 실시간 함께 있기 인터페이스.
// 구현: LocalPresence(BroadcastChannel), WsPresence(중계 서버), SupabasePresence(Realtime).

export type AvatarState = 'stand' | 'walk' | 'sit' | 'read';
export type HairStyle = 'bangs' | 'bob' | 'short' | 'curtain';
/** 매니저(어드민). 없으면 일반 방문객. */
export type PlayerRole = 'manager';

/** 다른 사람에게 보이는 "지금 읽는 책"(본문 없음). coverUrl은 https만, data:는 보내지 않는다. */
export interface SharedBook {
  title: string;
  author: string;
  publisher: string;
  coverUrl: string | null;
}

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
  /** 읽기 중일 때만 채운다. 아니면 null. */
  book: SharedBook | null;
  /** 매니저면 'manager'. 옛 클라이언트는 필드 없음. */
  role?: PlayerRole | null;
  t: number;
}

export type ActionType = 'nod' | 'join' | 'leave' | 'drink';
export interface ActionEvent {
  type: ActionType;
  from: string;
  nickname: string;
  t: number;
  /** type==='drink'일 때 물·커피·차 */
  drink?: 'water' | 'coffee' | 'tea';
}

export type PresenceStatus = 'connecting' | 'connected' | 'reconnecting';

export interface Presence {
  /** 'full'이면 정원이 차서 들어오지 못한 것이다. 구현이 연결을 정리한 뒤 반환한다. */
  connect(room: string, instance: number, me: PlayerState): Promise<'ok' | 'full'>;
  disconnect(): void;
  /** 공간별 정원(예: 1인실=1). 다음 connect에 적용. */
  setCapacity(n: number): void;
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

/**
 * 먼저 들어온 사람이 남는다. 같은 시각이면 id가 앞선 쪽이 남는다.
 * self가 정원 안이면 true.
 */
export function fitsCapacity(
  selfId: string,
  selfAt: number,
  others: Iterable<[string, number]>,
  capacity: number,
): boolean {
  const roster = [{ id: selfId, at: selfAt }];
  for (const [id, at] of others) if (id !== selfId) roster.push({ id, at });
  roster.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return roster.findIndex((r) => r.id === selfId) < capacity;
}

export function newId(): string {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** 네트워크로 온 책 메타를 잘라 안전한 SharedBook으로 만든다. */
export function sanitizeSharedBook(v: unknown): SharedBook | null {
  if (!v || typeof v !== 'object') return null;
  const b = v as Record<string, unknown>;
  if (typeof b.title !== 'string' || !b.title.trim()) return null;
  const rawCover = typeof b.coverUrl === 'string' ? b.coverUrl.trim() : '';
  // 표지는 https만(짧은 CDN URL). data:·거대 문자열은 중계 한도를 넘기므로 버린다.
  const coverUrl = rawCover.startsWith('https://') && rawCover.length <= 500 ? rawCover : null;
  return {
    title: b.title.trim().slice(0, 120),
    author: String(b.author ?? '').trim().slice(0, 80),
    publisher: String(b.publisher ?? '').trim().slice(0, 80),
    coverUrl,
  };
}

/** 받은 상태의 book 필드를 정리한다(옛 클라이언트는 book이 없을 수 있다). */
export function sanitizePlayerState(s: PlayerState): PlayerState {
  const book = s.state === 'read' ? sanitizeSharedBook(s.book) : null;
  const role = s.role === 'manager' ? 'manager' : null;
  // 예전 버전 브라우저가 아직 보내는 옛 표기(서든리)를 받는 쪽에서 바로잡는다
  const nickname = s.nickname.replace(/서든리/g, '써든리');
  return { ...s, nickname, book, role };
}

/** 받은 데이터가 PlayerState 모양인지 확인한다(다른 탭·서버에서 온 값은 믿지 않는다). */
export function isPlayerState(v: unknown): v is PlayerState {
  const s = v as PlayerState;
  if (!s || typeof s.id !== 'string' || typeof s.nickname !== 'string' || typeof s.color !== 'string') return false;
  if (!Array.isArray(s.position) || s.position.length !== 3 || !s.position.every(Number.isFinite)) return false;
  if (!Number.isFinite(s.rotationY) || !['stand', 'walk', 'sit', 'read'].includes(s.state)) return false;
  if (!['bangs', 'bob', 'short', 'curtain'].includes(s.hair) || s.nickname.length > 40) return false;
  if (s.role != null && s.role !== 'manager') return false;
  // book은 없거나 null이거나 객체. 내용은 sanitizeSharedBook에서 다시 검사한다.
  if (s.book != null && typeof s.book !== 'object') return false;
  return true;
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
    const clean = sanitizePlayerState(s);
    const isNew = !this.peers.has(clean.id);
    this.peers.set(clean.id, clean);
    this.seen.set(clean.id, Date.now());
    if (isNew && !silent) this.emitAction({ type: 'join', from: clean.id, nickname: clean.nickname, t: Date.now() });
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
