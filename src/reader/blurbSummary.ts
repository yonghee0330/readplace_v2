// 책 소개 요약: 카카오 소개는 중간이 잘리거나 판매·수상 홍보 문장이 많다.
// 완결된 문장만 골라(잘린 앞뒤 조각·홍보 문장 제외) 칸에 들어갈 길이로 줄인다. 외부 API 없이 클라이언트에서 동작.

/** 소개 칸에 보여 줄 최대 글자 수 */
export const BLURB_MAX = 120;

const PROMO = /(밀리언|베스트셀러|돌파|부수|기념|증정|한정|개정|이벤트|수상|선정|추천사|만\s?부|판매|출간|발간|시리즈|전\s?\d+권|초판|특별판|양장본|완전판|\d{3,}\s?(쪽|부|만|년))/;
const CONNECT = /^(그리고|그러나|하지만|그런데|또한|또|이는|이로|이에|그는|그녀는|이 부수|이 책은 또)/;

function clean(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[※★☆▶▷◆◇■□●○◎]+[^.!?。]*?(?=[.!?。]|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。…])["'”’」』]?\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isComplete(s: string): boolean {
  if (!/[.!?。…]["'”’」』]?$/.test(s)) return false; // 끝이 잘림
  if (s.length < 14) return false;
  const first = s.split(' ')[0] ?? '';
  if (first.length <= 4 && /,$/.test(first)) return false; // "만에," 처럼 앞이 잘린 조각
  if (CONNECT.test(s)) return false; // 앞 문맥이 필요한 문장
  return true;
}

function score(s: string, idx: number): number {
  let v = 10 - idx * 0.8;
  if (PROMO.test(s)) v -= 6;
  const digits = (s.match(/\d/g) ?? []).length;
  v -= Math.min(4, digits * 0.5);
  if (s.length > BLURB_MAX) v -= 8;
  if (/[「『《“"].{2,}[」』》”"]/.test(s)) v += 0.5;
  return v;
}

/** raw가 비면 null. 쓸 만한 문장이 없으면 null(호출 쪽이 대체 문구를 쓴다). */
export function summarizeBlurb(raw: string | null | undefined, max = BLURB_MAX): string | null {
  if (!raw) return null;
  const sentences = splitSentences(clean(raw));
  const cands = sentences
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => isComplete(s))
    .map(({ s, i }) => ({ s, i, v: score(s, i) }))
    .filter(({ s }) => s.length <= max);
  if (!cands.length) return null;
  const ranked = [...cands].sort((a, b) => b.v - a.v);
  const picked: typeof cands = [];
  let len = 0;
  for (const c of ranked) {
    if (c.v < 0 && picked.length) continue;
    const add = c.s.length + (picked.length ? 1 : 0);
    if (len + add > max) continue;
    picked.push(c);
    len += add;
    if (picked.length >= 3) break;
  }
  if (!picked.length) return null;
  // 고른 문장이 전부 판매·수상 홍보면 소개로 쓸 수 없다
  if (picked.every((c) => PROMO.test(c.s))) return null;
  picked.sort((a, b) => a.i - b.i);
  return picked.map((c) => c.s).join(' ');
}

/** 직접 다듬은 소개(제목에 키워드가 들어 있으면 사용). 카카오 소개가 홍보 문구뿐인 유명 도서용. */
const CURATED: { key: RegExp; blurb: string }[] = [
  {
    key: /코스모스/,
    blurb: '칼 세이건이 우주의 탄생부터 별과 생명, 인류 문명까지를 한 편의 여행처럼 풀어낸 과학 교양의 고전. 어려운 과학을 시처럼 아름다운 문장으로 들려줘 밤하늘을 보는 눈이 달라집니다.',
  },
];

export function curatedBlurb(title: string): string | null {
  return CURATED.find((c) => c.key.test(title))?.blurb ?? null;
}

/** 소개를 못 구했을 때, 아는 정보만으로 만든 한두 문장. */
export function fallbackBlurb(title: string, author: string, publisher: string): string {
  const who = author ? `${author}의 《${title}》` : `《${title}》`;
  const pub = publisher ? ` ${publisher}에서 펴냈어요.` : '';
  return `${who}.${pub} 서점에서 지금 누군가 펼쳐 읽고 있는 책이에요. 표지를 한 번 넘겨 보면 어떨까요?`;
}
