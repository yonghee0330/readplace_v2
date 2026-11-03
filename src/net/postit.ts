// 가오픈 포스트잇: 타입·색·모양·로컬/Supabase 저장.

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

const SEED: Omit<PostitNote, 'id' | 'createdAt'>[] = [
  { text: '비북스-M 가오픈을 축하해요!', color: 'yellow', shape: 'square', x: 0.18, y: 0.22, rot: -4, nickname: '비북스' },
  { text: '창가에서 책 읽는 느낌이 좋아요', color: 'mint', shape: 'round', x: 0.62, y: 0.28, rot: 3, nickname: '비북스' },
  { text: '불편한 점·바람·인사를 남겨 주세요', color: 'sky', shape: 'tag', x: 0.38, y: 0.58, rot: -2, nickname: '비북스' },
];

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
  return {
    id: typeof n.id === 'string' && n.id ? n.id : newId(),
    text,
    color,
    shape,
    x: Math.min(0.92, Math.max(0.08, Number(n.x) || 0.5)),
    y: Math.min(0.92, Math.max(0.08, Number(n.y) || 0.5)),
    rot: Math.max(-12, Math.min(12, Number(n.rot) || 0)),
    nickname: String(n.nickname ?? '손님').slice(0, 20) || '손님',
    createdAt: Number(n.createdAt) || Date.now(),
  };
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

export class PostitStore {
  private notes: PostitNote[] = [];
  private listeners = new Set<PostitListener>();
  private ch: BroadcastChannel | null = null;
  private poll = 0;

  async init(): Promise<void> {
    let notes = readLocal();
    if (notes.length === 0) {
      notes = SEED.map((s) => clampNote({ ...s, id: newId(), createdAt: Date.now() })!);
      writeLocal(notes);
    }
    if (hasSupabaseConfig()) {
      const remote = await this.fetchRemote();
      if (remote && remote.length) {
        notes = this.merge(notes, remote);
        writeLocal(notes);
      } else if (notes.length) {
        // 원격이 비어 있으면 시드·로컬을 한 번 올려 둔다(실패해도 로컬 유지)
        for (const n of notes.slice(0, 8)) void this.pushRemote(n);
      }
    }
    this.notes = notes;
    this.emit();
    if (typeof BroadcastChannel !== 'undefined') {
      this.ch = new BroadcastChannel(CHANNEL);
      this.ch.onmessage = (e) => {
        const n = clampNote(e.data as PostitNote);
        if (!n) return;
        this.upsertLocal(n, false);
      };
    }
    if (hasSupabaseConfig()) {
      this.poll = window.setInterval(() => void this.refreshRemote(), 20000);
    }
  }

  dispose(): void {
    this.ch?.close();
    this.ch = null;
    clearInterval(this.poll);
  }

  list(): PostitNote[] {
    return [...this.notes];
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

  private upsertLocal(note: PostitNote, broadcast: boolean): void {
    const i = this.notes.findIndex((n) => n.id === note.id);
    if (i >= 0) this.notes[i] = note;
    else this.notes.push(note);
    if (this.notes.length > POSTIT_MAX_COUNT) this.notes = this.notes.slice(-POSTIT_MAX_COUNT);
    writeLocal(this.notes);
    this.emit();
    if (broadcast) {
      try {
        this.ch?.postMessage(note);
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
        .select('id,text,color,shape,x,y,rot,nickname,created_at')
        .order('created_at', { ascending: true })
        .limit(POSTIT_MAX_COUNT);
      if (error || !data) return null;
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
    if (!sb) return;
    try {
      await sb.from('bbooks_postits').upsert({
        id: note.id,
        text: note.text,
        color: note.color,
        shape: note.shape,
        x: note.x,
        y: note.y,
        rot: note.rot,
        nickname: note.nickname,
        created_at: new Date(note.createdAt).toISOString(),
      });
    } catch {
      /* 테이블 없으면 로컬만 */
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
