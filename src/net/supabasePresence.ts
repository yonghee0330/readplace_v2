// SupabasePresence: Realtime Presence(명단·정원) + Broadcast(위치·눈인사).
// 위치는 초당 여러 번이라 Presence track 대신 Broadcast를 쓴다(공식 권장).
import type { RealtimeChannel } from '@supabase/supabase-js';
import { ROOM_CAPACITY } from '../core/params';
import { getSupabase } from './supabaseClient';
import {
  HEARTBEAT_MS, PeerTracker, STATE_INTERVAL_MS, channelName, fitsCapacity, isPlayerState,
  type ActionEvent, type Presence, type PlayerState,
} from './presence';

type PresenceMeta = PlayerState & { joinedAt: number };

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

  constructor(capacity = ROOM_CAPACITY) {
    super();
    this.capacity = capacity;
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
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') resolve('fail');
      });
      window.setTimeout(() => resolve('fail'), 8000);
    });
    if (gen !== this.generation) return 'full';
    if (subStatus !== 'ok') {
      this.disconnect();
      // 연결 실패 시 혼자라도 입장(로컬 폴백과 비슷)
      this.admitted = true;
      this.setStatus('connected');
      return 'ok';
    }

    // 첫 sync가 올 시간을 잠깐 준 뒤 정원 판단
    await new Promise((r) => setTimeout(r, 400));
    if (gen !== this.generation) return 'full';
    if (!this.fitsFromPresence(me.id, this.joinedAt)) {
      this.disconnect();
      return 'full';
    }

    await ch.track(this.meta(me));
    // track 직후 다시 세어, 동시 입장으로 넘치면 늦게 온 쪽이 나간다
    await new Promise((r) => setTimeout(r, 350));
    if (gen !== this.generation) return 'full';
    if (!this.fitsFromPresence(me.id, this.joinedAt)) {
      await ch.untrack().catch(() => {});
      this.disconnect();
      return 'full';
    }

    this.admitted = true;
    this.setStatus('connected');
    this.broadcastState(me);
    this.heartbeat = window.setInterval(() => {
      if (!this.me || !this.ch) return;
      void this.ch.track(this.meta({ ...this.me, t: Date.now() }));
    }, HEARTBEAT_MS);
    addEventListener('pagehide', this.onHide);
    return 'ok';
  }

  disconnect(): void {
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
