// 가오픈 포스트잇: 하루 단위 보드 + 로컬 캐시 + Supabase 공유(Realtime).

import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase, hasSupabaseConfig } from './supabaseClient';

export type PostitColor = 'yellow' | 'pink' | 'mint' | 'sky' | 'lavender' | 'peach';
export type PostitShape = 'square' | 'round' | 'tag' | 'heart';

export interface PostitNote {
  id: string;
  text: string;
  color: PostitColor;
  shape: PostitShape;
  /** 보드 위 정규화 좌표 0~1 (왼쪽·위 기준) */
  x: number;
  y: number;
  rot: number;
  nickname: string;
  /** 작성 브라우저 id. 없으면 예전 노트(닉네임으로만 판별). */
  authorId?: string;
  /** 보드 날짜 YYYY-MM-DD (Asia/Seoul) */
  day: string;
  createdAt: number;
}

export const POSTIT_COLORS: { id: PostitColor; hex: string; label: string }[] = [
  { id: 'yellow', hex: '#ffe566', label: '노랑' },
  { id: 'pink', hex: '#ffb3c6', label: '분홍' },
  { id: 'mint', hex: '#b8f0d4', label: '민트' },
  { id: 'sky', hex: '#b8d9ff', label: '하늘' },
  { id: 'lavender', hex: '#d7c4ff', label: '라벤더' },
  { id: 'peach', hex: '#ffc9a3', label: '복숭아' },
];

export const POSTIT_SHAPES: { id: PostitShape; label: string }[] = [
  { id: 'square', label: '네모' },
  { id: 'round', label: '둥근' },
  { id: 'tag', label: '태그' },
  { id: 'heart', label: '하트' },
];

export const POSTIT_MAX_LEN = 40;
/** 하루 보드당 최대 */
export const POSTIT_MAX_PER_DAY = 80;
/** 로컬·원격에서 유지할 최근 일수 */
export const POSTIT_KEEP_DAYS = 45;

const LOCAL_KEY = 'bbooks.postits';
const CHANNEL = 'bbooks:postits';
const TZ = 'Asia/Seoul';

/** 예전 데모용 샘플(로컬에 남아 있으면 한 번 걷어낸다) */
const LEGACY_SAMPLES = new Set([
  '비북스-M 가오픈을 축하해요!',
  '창가에서 책 읽는 느낌이 좋아요',
  '불편한 점·바람·인사를 남겨 주세요',
]);

const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const labelFmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: TZ,
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
});

/** Asia/Seoul 기준 YYYY-MM-DD */
export function boardDayKey(ms: number = Date.now()): string {
  return dayFmt.format(new Date(ms));
}

export function todayBoardDay(): string {
  return boardDayKey();
}

export function formatBoardDayLabel(day: string): string {
  // day는 YYYY-MM-DD — 정오 UTC로 파싱해 타임존 흔들림을 줄인다
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return day;
  const approx = Date.UTC(y, m - 1, d, 12, 0, 0);
  return labelFmt.format(new Date(approx));
}

/** day ± n일 */
export function shiftBoardDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return boardDayKey(dt.getTime());
}

function newId(): string {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

function isDayKey(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function clampNote(n: Partial<PostitNote> & { text?: string; board_day?: string }): PostitNote | null {
  const text = String(n.text ?? '').trim().slice(0, POSTIT_MAX_LEN);
  if (!text) return null;
  const color = POSTIT_COLORS.some((c) => c.id === n.color) ? (n.color as PostitColor) : 'yellow';
  const shape = POSTIT_SHAPES.some((s) => s.id === n.shape) ? (n.shape as PostitShape) : 'square';
  const authorId = typeof n.authorId === 'string' && n.authorId.length >= 8
    ? n.authorId.slice(0, 40)
    : undefined;
  const createdAt = Number(n.createdAt) || Date.now();
  const day = isDayKey(n.day) ? n.day : isDayKey(n.board_day) ? n.board_day : boardDayKey(createdAt);
  return {
    id: typeof n.id === 'string' && n.id ? n.id : newId(),
    text,
    color,
    shape,
    x: Math.min(0.92, Math.max(0.08, Number(n.x) || 0.5)),
    y: Math.min(0.92, Math.max(0.08, Number(n.y) || 0.5)),
    rot: Math.max(-12, Math.min(12, Number(n.rot) || 0)),
    nickname: String(n.nickname ?? '손님').slice(0, 40) || '손님',
    authorId,
    day,
    createdAt,
  };
}

/** 이 브라우저가 쓴 노트인지. authorId가 있으면 그걸 우선, 없으면 닉네임. */
export function isPostitMine(n: PostitNote, authorId: string, nickname: string): boolean {
  if (n.authorId) return n.authorId === authorId;
  return n.nickname === nickname;
}

function pruneByDays(notes: PostitNote[]): PostitNote[] {
  const today = todayBoardDay();
  const oldest = shiftBoardDay(today, -(POSTIT_KEEP_DAYS - 1));
  const byDay = new Map<string, PostitNote[]>();
  for (const n of notes) {
    if (n.day < oldest) continue;
    const list = byDay.get(n.day) ?? [];
    list.push(n);
    byDay.set(n.day, list);
  }
  const out: PostitNote[] = [];
  for (const [, list] of byDay) {
    list.sort((a, b) => a.createdAt - b.createdAt);
    out.push(...list.slice(-POSTIT_MAX_PER_DAY));
  }
  return out.sort((a, b) => a.createdAt - b.createdAt);
}

function readLocal(): PostitNote[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return pruneByDays(arr.map((n) => clampNote(n as PostitNote)).filter(Boolean) as PostitNote[]);
  } catch {
    return [];
  }
}

function writeLocal(notes: PostitNote[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(pruneByDays(notes)));
  } catch {
    /* ignore */
  }
}

export type PostitListener = (notes: PostitNote[]) => void;

type BcPayload =
  | { op: 'upsert'; note: PostitNote }
  | { op: 'delete'; id: string }
  | PostitNote;

export class PostitStore {
  private notes: PostitNote[] = [];
  private listeners = new Set<PostitListener>();
  private ch: BroadcastChannel | null = null;
  private poll = 0;
  private rt: RealtimeChannel | null = null;
  /** Supabase 테이블이 준비됐는지(없으면 로컬만) */
  remoteReady = false;

  async init(): Promise<void> {
    const local = readLocal();
    let notes = local.filter((n) => !(n.nickname === '비북스' && LEGACY_SAMPLES.has(n.text)));
    if (notes.length !== local.length) writeLocal(notes);
    if (hasSupabaseConfig()) {
      const remote = await this.fetchRemote();
      if (remote) {
        this.remoteReady = true;
        notes = this.merge(
          notes,
          remote.filter((n) => !(n.nickname === '비북스' && LEGACY_SAMPLES.has(n.text))),
        );
        writeLocal(notes);
        const today = todayBoardDay();
        const todayLocal = notes.filter((n) => n.day === today);
        const todayRemote = remote.filter((n) => n.day === today);
        if (todayRemote.length === 0 && todayLocal.length) {
          for (const n of todayLocal.slice(0, 8)) void this.pushRemote(n);
        }
      }
    }
    this.notes = pruneByDays(notes);
    this.emit();
    if (typeof BroadcastChannel !== 'undefined') {
      this.ch = new BroadcastChannel(CHANNEL);
      this.ch.onmessage = (e) => {
        const data = e.data as BcPayload;
        if (data && typeof data === 'object' && 'op' in data) {
          if (data.op === 'delete') {
            this.removeLocal(data.id, false);
            return;
          }
          if (data.op === 'upsert') {
            const n = clampNote(data.note);
            if (n) this.upsertLocal(n, false);
            return;
          }
        }
        const n = clampNote(data as PostitNote);
        if (!n) return;
        this.upsertLocal(n, false);
      };
    }
    if (this.remoteReady) {
      this.subscribeRealtime();
      this.poll = window.setInterval(() => void this.refreshRemote(), 30000);
    }
  }

  dispose(): void {
    this.ch?.close();
    this.ch = null;
    clearInterval(this.poll);
    const sb = getSupabase();
    if (this.rt && sb) {
      void sb.removeChannel(this.rt);
      this.rt = null;
    }
  }

  private subscribeRealtime(): void {
    const sb = getSupabase();
    if (!sb || this.rt) return;
    this.rt = sb
      .channel('bbooks_postits')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bbooks_postits' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id?: string } | null)?.id;
            if (!id) return;
            this.removeLocal(id, false);
            return;
          }
          const row = payload.new as Record<string, unknown> | null;
          if (!row) return;
          const n = rowToNote(row);
          if (n) this.upsertLocal(n, false);
        },
      )
      .subscribe();
  }

  /** 전체(보관 기간 안). */
  listAll(): PostitNote[] {
    return [...this.notes];
  }

  /** 해당 날짜 보드. day 생략 시 오늘. */
  list(day: string = todayBoardDay()): PostitNote[] {
    return this.notes.filter((n) => n.day === day).sort((a, b) => a.createdAt - b.createdAt);
  }

  /** 쪽지가 있는 날짜 + 오늘(비어 있어도). 최신순. */
  listDays(): string[] {
    const set = new Set<string>([todayBoardDay()]);
    for (const n of this.notes) set.add(n.day);
    return [...set].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  }

  get(id: string): PostitNote | undefined {
    return this.notes.find((n) => n.id === id);
  }

  onChange(cb: PostitListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async add(input: {
    text: string;
    color: PostitColor;
    shape: PostitShape;
    x: number;
    y: number;
    nickname: string;
    authorId: string;
    day?: string;
  }): Promise<PostitNote | null> {
    const day = input.day && isDayKey(input.day) ? input.day : todayBoardDay();
    if (day !== todayBoardDay()) return null; // 지난 보드에는 붙이지 않음
    if (this.list(day).length >= POSTIT_MAX_PER_DAY) return null;
    const note = clampNote({
      ...input,
      day,
      id: newId(),
      rot: (Math.random() * 10 - 5),
      createdAt: Date.now(),
    });
    if (!note) return null;
    this.upsertLocal(note, true);
    void this.pushRemote(note);
    return note;
  }

  async update(
    id: string,
    patch: { text?: string; color?: PostitColor; shape?: PostitShape },
    who: { authorId: string; nickname: string },
  ): Promise<PostitNote | null> {
    const cur = this.notes.find((n) => n.id === id);
    if (!cur || !isPostitMine(cur, who.authorId, who.nickname)) return null;
    if (cur.day !== todayBoardDay()) return null;
    const note = clampNote({
      ...cur,
      text: patch.text ?? cur.text,
      color: patch.color ?? cur.color,
      shape: patch.shape ?? cur.shape,
      authorId: cur.authorId ?? who.authorId,
      nickname: cur.nickname,
      day: cur.day,
    });
    if (!note) return null;
    this.upsertLocal(note, true);
    void this.pushRemote(note);
    return note;
  }

  async remove(id: string, who: { authorId: string; nickname: string }): Promise<boolean> {
    const cur = this.notes.find((n) => n.id === id);
    if (!cur || !isPostitMine(cur, who.authorId, who.nickname)) return false;
    if (cur.day !== todayBoardDay()) return false;
    this.removeLocal(id, true);
    void this.deleteRemote(id);
    return true;
  }

  private removeLocal(id: string, broadcast: boolean): void {
    const next = this.notes.filter((n) => n.id !== id);
    if (next.length === this.notes.length) return;
    this.notes = next;
    writeLocal(this.notes);
    this.emit();
    if (broadcast) {
      try {
        this.ch?.postMessage({ op: 'delete', id } satisfies BcPayload);
      } catch {
        /* ignore */
      }
    }
  }

  private upsertLocal(note: PostitNote, broadcast: boolean): void {
    const i = this.notes.findIndex((n) => n.id === note.id);
    if (i >= 0) this.notes[i] = note;
    else this.notes.push(note);
    this.notes = pruneByDays(this.notes);
    writeLocal(this.notes);
    this.emit();
    if (broadcast) {
      try {
        this.ch?.postMessage({ op: 'upsert', note } satisfies BcPayload);
      } catch {
        /* ignore */
      }
    }
  }

  private emit(): void {
    const snap = this.listAll();
    for (const cb of this.listeners) cb(snap);
  }

  private merge(a: PostitNote[], b: PostitNote[]): PostitNote[] {
    const map = new Map<string, PostitNote>();
    for (const n of [...a, ...b]) map.set(n.id, n);
    return pruneByDays([...map.values()]);
  }

  private async fetchRemote(): Promise<PostitNote[] | null> {
    const sb = getSupabase();
    if (!sb) return null;
    const oldest = shiftBoardDay(todayBoardDay(), -(POSTIT_KEEP_DAYS - 1));
    const limit = POSTIT_MAX_PER_DAY * POSTIT_KEEP_DAYS;
    try {
      let q = sb
        .from('bbooks_postits')
        .select('id,text,color,shape,x,y,rot,nickname,author_id,board_day,created_at')
        .gte('created_at', `${oldest}T00:00:00+09:00`)
        .order('created_at', { ascending: true })
        .limit(limit);
      let { data, error } = await q;
      if (error) {
        // board_day / author_id 없는 예전 스키마
        const fallback = await sb
          .from('bbooks_postits')
          .select('id,text,color,shape,x,y,rot,nickname,created_at')
          .order('created_at', { ascending: true })
          .limit(limit);
        if (fallback.error || !fallback.data) return null;
        data = fallback.data as typeof data;
        error = null;
      }
      if (error || !data) return null;
      return pruneByDays(data.map((row) => rowToNote(row as Record<string, unknown>)).filter(Boolean) as PostitNote[]);
    } catch {
      return null;
    }
  }

  private async pushRemote(note: PostitNote): Promise<void> {
    const sb = getSupabase();
    if (!sb || !this.remoteReady) return;
    try {
      const row: Record<string, unknown> = {
        id: note.id,
        text: note.text,
        color: note.color,
        shape: note.shape,
        x: note.x,
        y: note.y,
        rot: note.rot,
        nickname: note.nickname,
        board_day: note.day,
        created_at: new Date(note.createdAt).toISOString(),
      };
      if (note.authorId) row.author_id = note.authorId;
      const { error } = await sb.from('bbooks_postits').upsert(row);
      if (error) {
        delete row.board_day;
        if (note.authorId) delete row.author_id;
        const retry = await sb.from('bbooks_postits').upsert(row);
        if (retry.error) console.warn('[bbooks] postit upsert', retry.error.message);
      }
    } catch {
      /* 오프라인이면 로컬만 */
    }
  }

  private async deleteRemote(id: string): Promise<void> {
    const sb = getSupabase();
    if (!sb || !this.remoteReady) return;
    try {
      const { error } = await sb.from('bbooks_postits').delete().eq('id', id);
      if (error) console.warn('[bbooks] postit delete', error.message);
    } catch {
      /* ignore */
    }
  }

  private async refreshRemote(): Promise<void> {
    const remote = await this.fetchRemote();
    if (!remote) return;
    this.notes = this.merge(this.notes, remote);
    writeLocal(this.notes);
    this.emit();
  }
}

function rowToNote(row: Record<string, unknown>): PostitNote | null {
  const createdAt = row.created_at ? Date.parse(String(row.created_at)) : Date.now();
  return clampNote({
    id: String(row.id ?? ''),
    text: String(row.text ?? ''),
    color: row.color as PostitColor,
    shape: row.shape as PostitShape,
    x: Number(row.x),
    y: Number(row.y),
    rot: Number(row.rot),
    nickname: String(row.nickname ?? '손님'),
    authorId: row.author_id ? String(row.author_id) : undefined,
    day: row.board_day ? String(row.board_day) : undefined,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
  });
}

export function colorHex(c: PostitColor): string {
  return POSTIT_COLORS.find((x) => x.id === c)?.hex ?? '#ffe566';
}
