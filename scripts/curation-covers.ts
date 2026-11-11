// 큐레이션 매대 표지 받기: 카카오 책 검색(Edge Function kakao-search) → public/curation/award/cNN.webp
// 사용: npx tsx scripts/curation-covers.ts   (.env의 VITE_SUPABASE_URL·VITE_SUPABASE_PUBLISHABLE_KEY 사용)
// 표지 이미지 서버가 CORS를 주지 않아 3D 텍스처로 바로 못 쓰므로, 빌드 전에 받아 정적 파일로 둔다.
import { readFileSync, writeFileSync } from 'node:fs';
import { AWARD_SHELF } from '../src/curation/awardShelf';

function env(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const norm = (s: string) => s.replace(/[\s:,.()]/g, '').toLowerCase();

async function main(): Promise<void> {
  const e = { ...env(), ...process.env } as Record<string, string>;
  const base = `${e.VITE_SUPABASE_URL}/functions/v1/kakao-search`;
  const key = e.VITE_SUPABASE_PUBLISHABLE_KEY || e.VITE_SUPABASE_ANON_KEY;
  let bad = 0;
  for (const b of AWARD_SHELF.books) {
    const res = await fetch(`${base}?${new URLSearchParams({ title: b.title })}`, { headers: { Authorization: `Bearer ${key}`, apikey: key } });
    const data = (await res.json()) as { items?: { title: string; author: string; publisher: string; coverUrl: string }[] };
    const items = (data.items ?? []).filter((i) => i.coverUrl);
    const pick = items.find((i) => norm(i.author).includes(norm(b.author)) && norm(i.title).includes(norm(b.title).slice(0, 4)))
      ?? items.find((i) => norm(i.title).startsWith(norm(b.title).slice(0, 6)));
    const file = `public/curation/award/c${String(b.no).padStart(2, '0')}.webp`;
    if (!pick) {
      bad++;
      console.log(`✗ ${b.no} ${b.title} — 맞는 표지 없음 (${items.map((i) => `${i.title}/${i.author}`).join('; ')})`);
      continue;
    }
    const img = await fetch(pick.coverUrl);
    writeFileSync(file, Buffer.from(await img.arrayBuffer()));
    console.log(`✓ ${b.no} ${b.title} ← ${pick.title} / ${pick.author} / ${pick.publisher}`);
  }
  if (bad) process.exitCode = 1;
}
void main();
