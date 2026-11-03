// SupabasePresence: Realtime Presence(명단·정원) + Broadcast(위치·눈인사·하트비트).
// 위치는 초당 여러 번이라 Presence track 대신 Broadcast를 쓴다(공식 권장).
// track은 입장할 때와 닉네임·색·머리·책이 바뀔 때만, 5초에 한 번 이하로 보낸다.
// (track을 자주 보내면 서버가 "Client presence rate limit exceeded"로 채널을 닫는다.)
// 채널이 닫히거나 끊기면 1·2·4·8·15초 간격으로 다시 붙는다.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { ROOM_CAPACITY } from '../core/params';
import { getSupabase } from './supabaseClient';
import {
  HEARTBEAT_MS, PeerTracker, STATE_INTERVAL_MS, channelName, fitsCapacity, isPlayerState,
  type ActionEvent, type Presence, type PlayerState,
} from './presence';

type PresenceMeta = PlayerState & { joinedAt: number };

const TRACK_MIN_MS = 5000;
const BACKOFF = [1000, 2000, 4000, 8000, 15000];

/** presence에 실어 둘 만큼 자주 안 바뀌는 값들(위치 제외) */
const identity = (s: PlayerState) => JSON.stringify([s.nickname, s.color, s.hair, s.book ?? null]);

export class SupabasePresence extends PeerTracker implements Presence {
  private ch: RealtimeChannel | null = null;
  private me: PlayerState | null = null;
  private joinedAt = 0;
  private admitted = false;
  private lastSent = 0;
  private pending = 0;
  private heartbeat = 0;
  private generation = 0;
  private capacity: number;
  private room = '';
  private instance = 0;
  private trackedIdentity = '';
  private lastTrack = 0;
  private trackTimer = 0;
  private retry = 0;
  private attempt = 0;

  constructor(capacity = ROOM_CAPACITY) {
    super();
    this.capacity = capacity;
  }

  setCapacity(n: number): void {
    this.capacity = Math.max(1, Math.min(ROOM_CAPACITY, Math.round(n)));
  }

  async connect(room: string, instance: number, me: PlayerState): Promise<'ok' | 'full'> {
    this.disconnect();
    const supabase = getSupabase();
    if (!supabase) {
      this.setStatus('connected');
      this.admitted = true;
      return 'ok';
    }
    const gen = this.generation;
    this.room = room;
    this.instance = instance;
    this.me = me;
    this.selfId = me.id;
    this.joinedAt = Date.now();
    this.admitted = false;
    this.quietUntil = Date.now() + 1500;
    this.setStatus('connecting');

    const topic = channelName(room, instance);
    const ch = supabase.channel(topic, {
      config: {
        presence: { key: me.id },
        broadcast: { self: false },
      },
    });
    this.ch = ch;

    ch.on('presence', { event: 'sync' }, () => this.onPresenceSync());
    // 새로 온 사람은 presence에서 내 입장 당시 위치만 알므로, 지금 상태를 바로 알려 준다
    ch.on('presence', { event: 'join' }, ({ key }) => {
      if (key !== this.selfId && this.admitted && this.me) this.broadcastState(this.me);
    });
    ch.on('presence', { event: 'leave' }, ({ key }) => {
      if (typeof key === 'string') this.remove(key);
    });
    ch.on('broadcast', { event: 'state' }, ({ payload }) => {
      if (isPlayerState(payload)) this.upsert(payload);
    });
    ch.on('broadcast', { event: 'action' }, ({ payload }) => {
      const a = payload as ActionEvent;
      if (a && typeof a.from === 'string' && a.type === 'nod' && a.from !== this.selfId) {
        this.touch(a.from);
        this.emitAction({ ...a, nickname: String(a.nickname ?? '').slice(0, 40) });
      }
    });

    const subStatus = await new Promise<'ok' | 'fail'>((resolve) => {
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve('ok');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          resolve('fail');
          // 입장한 뒤 서버가 채널을 닫거나 끊기면 다시 붙는다
          if (gen === this.generation && this.admitted) this.scheduleRetry();
        }
      });
      window.setTimeout(() => resolve('fail'), 8000);
    });
    if (gen !== this.generation) return 'full';
    if (subStatus !== 'ok') {
      // 연결 실패: 혼자라도 서점에는 들어가고, 뒤에서 다시 붙어 본다
      this.scheduleRetry();
      return 'ok';
    }

    // 첫 sync가 올 시간을 잠깐 준 뒤 정원 판단
    await new Promise((r) => setTimeout(r, 400));
    if (gen !== this.generation) return 'full';
    if (!this.fitsFromPresence(me.id, this.joinedAt)) {
      this.disconnect();
      return 'full';
    }

    await this.trackNow(me);
    // track 직후 다시 세어, 동시 입장으로 넘치면 늦게 온 쪽이 나간다
    await new Promise((r) => setTimeout(r, 350));
    if (gen !== this.generation) return 'full';
    if (!this.fitsFromPresence(me.id, this.joinedAt)) {
      await ch.untrack().catch(() => {});
      this.disconnect();
      return 'full';
    }

    this.admitted = true;
    this.attempt = 0;
    this.setStatus('connected');
    this.broadcastState(me);
    // 하트비트는 broadcast로(멈춰 있는 사람의 위치도 늦게 온 사람에게 전해지게)
    this.heartbeat = window.setInterval(() => {
      if (this.me && this.ch) this.broadcastState({ ...this.me, t: Date.now() });
    }, HEARTBEAT_MS);
    addEventListener('pagehide', this.onHide);
    return 'ok';
  }

  disconnect(): void {
    clearTimeout(this.retry);
    clearTimeout(this.trackTimer);
    this.trackTimer = 0;
    this.generation++;
    this.admitted = false;
    removeEventListener('pagehide', this.onHide);
    clearInterval(this.heartbeat);
    this.heartbeat = 0;
    clearTimeout(this.pending);
    this.pending = 0;
    const ch = this.ch;
    this.ch = null;
    if (ch) {
      void ch.untrack().catch(() => {});
      const sb = getSupabase();
      if (sb) void sb.removeChannel(ch);
    }
    this.clear();
    this.setStatus('connecting');
  }

  sendState(s: PlayerState): void {
    this.me = s;
    if (!this.admitted || !this.ch) return;
    if (identity(s) !== this.trackedIdentity) this.scheduleTrack();
    const now = performance.now();
    const wait = STATE_INTERVAL_MS - (now - this.lastSent);
    if (wait <= 0) {
      this.lastSent = now;
      this.broadcastState(s);
    } else if (!this.pending) {
      this.pending = window.setTimeout(() => {
        this.pending = 0;
        this.lastSent = performance.now();
        if (this.me) this.broadcastState(this.me);
      }, wait);
    }
  }

  sendAction(a: ActionEvent): void {
    if (!this.admitted || !this.ch) return;
    void this.ch.send({ type: 'broadcast', event: 'action', payload: a });
  }

  private onHide = () => this.disconnect();

  /** 끊긴 뒤 다시 붙기. 그동안은 혼자 있는 것처럼 보이고 상단에 "다시 연결하고 있어요". */
  private scheduleRetry(): void {
    const { room, instance, me } = this;
    if (!me) return;
    this.disconnect();
    this.me = me;
    this.admitted = true;
    this.setStatus('reconnecting');
    const wait = BACKOFF[Math.min(this.attempt, BACKOFF.length - 1)];
    this.attempt++;
    // 성공하면 connect가 attempt를 0으로 되돌리고, 또 실패하면 connect가 다시 여기로 온다
    this.retry = window.setTimeout(() => void this.connect(room, instance, this.me ?? me), wait);
  }

  private async trackNow(s: PlayerState): Promise<void> {
    if (!this.ch) return;
    this.lastTrack = Date.now();
    this.trackedIdentity = identity(s);
    await this.ch.track(this.meta(s)).catch(() => undefined);
  }

  /** 닉네임·색·책이 바뀌면 presence도 고친다(5초에 한 번 이하) */
  private scheduleTrack(): void {
    if (this.trackTimer) return;
    const wait = Math.max(0, TRACK_MIN_MS - (Date.now() - this.lastTrack));
    this.trackTimer = window.setTimeout(() => {
      this.trackTimer = 0;
      if (this.me && this.admitted) void this.trackNow(this.me);
    }, wait);
  }

  private meta(s: PlayerState): PresenceMeta {
    return { ...s, joinedAt: this.joinedAt };
  }

  private broadcastState(s: PlayerState): void {
    void this.ch?.send({ type: 'broadcast', event: 'state', payload: s });
  }

  private presenceRoster(): { id: string; joinedAt: number; state: PlayerState | null }[] {
    const state = this.ch?.presenceState() ?? {};
    const out: { id: string; joinedAt: number; state: PlayerState | null }[] = [];
    for (const [key, rows] of Object.entries(state)) {
      const row = (rows as unknown as PresenceMeta[])[0];
      if (!row) {
        out.push({ id: key, joinedAt: 0, state: null });
        continue;
      }
      const joinedAt = Number.isFinite(row.joinedAt) ? row.joinedAt : 0;
      const player = isPlayerState(row) ? row : null;
      out.push({ id: key, joinedAt, state: player });
    }
    return out;
  }

  private fitsFromPresence(selfId: string, selfAt: number): boolean {
    const others: [string, number][] = this.presenceRoster()
      .filter((r) => r.id !== selfId)
      .map((r) => [r.id, r.joinedAt]);
    return fitsCapacity(selfId, selfAt, others, this.capacity);
  }

  private onPresenceSync(): void {
    const roster = this.presenceRoster();
    const ids = new Set(roster.map((r) => r.id));
    for (const id of [...this.peers.keys()]) if (!ids.has(id)) this.remove(id);
    for (const r of roster) {
      if (r.id === this.selfId) continue;
      if (r.state) this.upsert(r.state, true);
      else this.touch(r.id);
    }
  }
}
