// 가오픈 포스트잇: 타입·색·모양·로컬 캐시 + Supabase 공유(Realtime).

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
export const POSTIT_MAX_COUNT = 120;

const LOCAL_KEY = 'bbooks.postits';
const CHANNEL = 'bbooks:postits';

/** 예전 데모용 샘플(로컬에 남아 있으면 한 번 걷어낸다) */
const LEGACY_SAMPLES = new Set([
  '비북스-M 가오픈을 축하해요!',
  '창가에서 책 읽는 느낌이 좋아요',
  '불편한 점·바람·인사를 남겨 주세요',
]);

function newId(): string {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

function clampNote(n: Partial<PostitNote> & { text?: string }): PostitNote | null {
  const text = String(n.text ?? '').trim().slice(0, POSTIT_MAX_LEN);
  if (!text) return null;
  const color = POSTIT_COLORS.some((c) => c.id === n.color) ? (n.color as PostitColor) : 'yellow';
  const shape = POSTIT_SHAPES.some((s) => s.id === n.shape) ? (n.shape as PostitShape) : 'square';
  const authorId = typeof n.authorId === 'string' && n.authorId.length >= 8
    ? n.authorId.slice(0, 40)
    : undefined;
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
    createdAt: Number(n.createdAt) || Date.now(),
  };
}

/** 이 브라우저가 쓴 노트인지. authorId가 있으면 그걸 우선, 없으면 닉네임. */
export function isPostitMine(n: PostitNote, authorId: string, nickname: string): boolean {
  if (n.authorId) return n.authorId === authorId;
  return n.nickname === nickname;
}

function readLocal(): PostitNote[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.map((n) => clampNote(n as PostitNote)).filter(Boolean) as PostitNote[];
  } catch {
    return [];
  }
}

function writeLocal(notes: PostitNote[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(notes.slice(-POSTIT_MAX_COUNT)));
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
        if (remote.length === 0 && notes.length) {
          for (const n of notes.slice(0, 8)) void this.pushRemote(n);
        }
      }
    }
    this.notes = notes;
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
          const n = clampNote({
            id: String(row.id ?? ''),
            text: String(row.text ?? ''),
            color: row.color as PostitColor,
            shape: row.shape as PostitShape,
            x: Number(row.x),
            y: Number(row.y),
            rot: Number(row.rot),
            nickname: String(row.nickname ?? '손님'),
            authorId: row.author_id ? String(row.author_id) : undefined,
            createdAt: row.created_at ? Date.parse(String(row.created_at)) : Date.now(),
          });
          if (n) this.upsertLocal(n, false);
        },
      )
      .subscribe();
  }

  list(): PostitNote[] {
    return [...this.notes];
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
  }): Promise<PostitNote | null> {
    if (this.notes.length >= POSTIT_MAX_COUNT) return null;
    const note = clampNote({
      ...input,
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
    const note = clampNote({
      ...cur,
      text: patch.text ?? cur.text,
      color: patch.color ?? cur.color,
      shape: patch.shape ?? cur.shape,
      authorId: cur.authorId ?? who.authorId,
      nickname: cur.nickname,
    });
    if (!note) return null;
    this.upsertLocal(note, true);
    void this.pushRemote(note);
    return note;
  }

  async remove(id: string, who: { authorId: string; nickname: string }): Promise<boolean> {
    const cur = this.notes.find((n) => n.id === id);
    if (!cur || !isPostitMine(cur, who.authorId, who.nickname)) return false;
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
    if (this.notes.length > POSTIT_MAX_COUNT) this.notes = this.notes.slice(-POSTIT_MAX_COUNT);
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
    const snap = this.list();
    for (const cb of this.listeners) cb(snap);
  }

  private merge(a: PostitNote[], b: PostitNote[]): PostitNote[] {
    const map = new Map<string, PostitNote>();
    for (const n of [...a, ...b]) map.set(n.id, n);
    return [...map.values()].sort((x, y) => x.createdAt - y.createdAt).slice(-POSTIT_MAX_COUNT);
  }

  private async fetchRemote(): Promise<PostitNote[] | null> {
    const sb = getSupabase();
    if (!sb) return null;
    try {
      const { data, error } = await sb
        .from('bbooks_postits')
        .select('id,text,color,shape,x,y,rot,nickname,author_id,created_at')
        .order('created_at', { ascending: true })
        .limit(POSTIT_MAX_COUNT);
      if (error || !data) {
        // author_id 컬럼이 아직 없으면 예전 스키마로 재시도
        if (error) {
          const fallback = await sb
            .from('bbooks_postits')
            .select('id,text,color,shape,x,y,rot,nickname,created_at')
            .order('created_at', { ascending: true })
            .limit(POSTIT_MAX_COUNT);
          if (fallback.error || !fallback.data) return null;
          return fallback.data
            .map((row) =>
              clampNote({
                id: row.id,
                text: row.text,
                color: row.color,
                shape: row.shape,
                x: row.x,
                y: row.y,
                rot: row.rot,
                nickname: row.nickname,
                createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
              }),
            )
            .filter(Boolean) as PostitNote[];
        }
        return null;
      }
      return data
        .map((row) =>
          clampNote({
            id: row.id,
            text: row.text,
            color: row.color,
            shape: row.shape,
            x: row.x,
            y: row.y,
            rot: row.rot,
            nickname: row.nickname,
            authorId: (row as { author_id?: string }).author_id,
            createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
          }),
        )
        .filter(Boolean) as PostitNote[];
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
        created_at: new Date(note.createdAt).toISOString(),
      };
      if (note.authorId) row.author_id = note.authorId;
      const { error } = await sb.from('bbooks_postits').upsert(row);
      if (error) {
        // author_id 미적용 DB면 컬럼 빼고 재시도
        if (note.authorId) {
          delete row.author_id;
          const retry = await sb.from('bbooks_postits').upsert(row);
          if (retry.error) console.warn('[bbooks] postit upsert', retry.error.message);
        } else {
          console.warn('[bbooks] postit upsert', error.message);
        }
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

export function colorHex(c: PostitColor): string {
  return POSTIT_COLORS.find((x) => x.id === c)?.hex ?? '#ffe566';
}
