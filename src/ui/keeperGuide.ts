// 서점지기 안내: 머리 위 구름 말풍선. 한 문장씩(약 1초) 말하고, 버튼으로 고른다.

export const BBOOKS_URL = 'https://bbooks.co.kr/';
export const MOIM_URL = 'https://bbooks.co.kr/moim/';
export const INSTAGRAM_URL = 'https://www.instagram.com/b_books2026';
export const MAP_URL =
  'https://map.naver.com/v5/search/%EA%B2%BD%EA%B8%B0%EB%8F%84%20%EB%B6%80%EC%B2%9C%EC%8B%9C%20%EC%9B%90%EB%AF%B8%EA%B5%AC%20%EB%B6%80%EC%B2%9C%EB%A1%9C136%EB%B2%88%EA%B8%B8%2024';
export const PHONE_TEL = 'tel:050713534850';
export const PHONE_LABEL = '0507-1353-4850';

const LINE_GAP = 1.0;

/** 열릴 때마다 하나씩 고르는 짧은 인사(한 줄) */
export const KEEPER_GREETINGS = [
  '어서 오세요, 비북스예요.',
  '반가워요, 오늘도 카운터를 지키고 있어요.',
  '잘 오셨어요, 편하게 둘러보세요.',
  '안녕하세요, 서가 사이에 들러주셨네요.',
  '어서 오세요, 잠깐 구경만 하셔도 반가워요.',
  '반가워요, 비북스 서점지기예요.',
  '들러주셔서 고마워요.',
  '어서 오세요, 어떤 이야기가 궁금하세요?',
  '안녕하세요, 오늘은 어느 서가부터 볼까요?',
  '반가워요, 궁금한 걸 물어보세요.',
  '잘 오셨어요. 시집은 눈에 들어온 제목부터 펼쳐봐도 좋아요.',
  '어서 오세요, 이곳은 비북스예요.',
  '안녕하세요, 천천히 둘러보세요.',
  '반가워요, 다시 만나도 반가운 곳이면 좋겠어요.',
  '잘 오셨어요, 책 이야기도 환영해요.',
  '어서 오세요.',
  '안녕하세요, 서가 구경 중이신가요?',
  '들러주셔서 반가워요.',
  '어서 오세요, 궁금한 건 골라 주세요.',
  '반가워요, 비북스 카운터예요.',
] as const;

export type GuideAction = { label: string; url: string; toast: string };

export interface GuideTopic {
  id: string;
  label: string;
  question: string;
  answer: string;
  actions: GuideAction[];
}

export const GUIDE_TOPICS: GuideTopic[] = [
  {
    id: 'about',
    label: '비북스 소개',
    question: '비북스는 어떤 곳이에요?',
    answer:
      '부천 원미동 동네책방이자 문화공간이에요. 여러 점주가 0.1평씩 서가를 맡아 취향으로 책을 소개하고, 모임·북토크로 이웃을 만나요.',
    actions: [{ label: '비북스 더 알아보기', url: BBOOKS_URL, toast: '비북스 홈페이지를 열어요' }],
  },
  {
    id: 'hours',
    label: '운영 시간',
    question: '실제 책방은 몇 시에 문을 열어요?',
    answer:
      '매장은 오전 10시–오후 6시예요. 야간 행사는 따로 안내해요. 요일·휴무·임시 휴무는 방문 전 공지를 확인해 주세요.',
    actions: [{ label: '방문 전 공지 확인', url: INSTAGRAM_URL, toast: '인스타그램 공지를 열어요' }],
  },
  {
    id: 'moim',
    label: '11·12월 모임',
    question: '이번 달과 다음 달에는 어떤 모임이 있나요?',
    answer:
      '2026년 11월이에요.\n· 글크크 — 금 15:30–17:30 · 파일럿 무료 · 노트북 필수\n· 그림책 읽어주는 이모 — 11/14(토) 10:30\n· 클래식 음악 감상 — 11/14·21(토) 12:00\n· 부천 AI 특공대 1기 — 토 14:00\n2026년 12월에는 글크크 파일럿이 이어져요.\n시간은 KST이고, 자리·변경은 신청 전에 확인해 주세요.',
    actions: [{ label: '모임 자세히 보기', url: MOIM_URL, toast: '비모임 안내를 열어요' }],
  },
  {
    id: 'way',
    label: '찾아오는 길',
    question: '비북스에는 어떻게 가나요?',
    answer:
      '경기도 부천시 원미구 부천로136번길 24, 지하 B02호예요. 원미구청 맞은편이에요. 지도에서 출발지를 넣으면 길을 확인할 수 있어요.',
    actions: [{ label: '지도에서 길 찾기', url: MAP_URL, toast: '네이버 지도를 열어요' }],
  },
  {
    id: 'ask',
    label: '직접 문의',
    question: '서점지기에게 직접 물어보고 싶어요.',
    answer:
      '제가 안내하지 못한 내용은 실제 비북스에 물어봐 주세요. 방문, 서가 운영, 대관·협업도 문의할 수 있어요.',
    actions: [
      { label: '인스타그램 문의', url: INSTAGRAM_URL, toast: '인스타그램을 열어요' },
      { label: `전화 ${PHONE_LABEL}`, url: PHONE_TEL, toast: '전화를 걸어요' },
    ],
  },
];

type Phase = 'idle' | 'greet' | 'menu' | 'answer' | 'actions';

/** 답을 한 마디씩 나눈다. */
export function splitUtterances(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('·') || /^(20\d{2}|시간은)/.test(line)) {
      out.push(line);
      continue;
    }
    const chunks = line.split(/(?<=[.?!]|요\.|다\.|죠\.|까요\?)\s+/).map((s) => s.trim()).filter(Boolean);
    out.push(...(chunks.length ? chunks : [line]));
  }
  return out;
}

export class KeeperGuide {
  readonly el: HTMLElement;
  private anchor: HTMLElement;
  private cloud: HTMLElement;
  private topicsEl: HTMLElement;
  private greetI = Math.floor(Math.random() * KEEPER_GREETINGS.length);
  private phase: Phase = 'idle';
  private topic: GuideTopic | null = null;
  private lines: string[] = [];
  private lineI = 0;
  private lineT = 0;
  onOpenLink: ((url: string, toast: string) => void) | null = null;
  onActiveChange: ((active: boolean) => void) | null = null;

  constructor(root: HTMLElement) {
    this.el = document.createElement('aside');
    this.el.className = 'keeper-guide';
    this.el.hidden = true;
    this.el.setAttribute('aria-live', 'polite');
    this.anchor = document.createElement('div');
    this.anchor.className = 'keeper-anchor';
    this.cloud = document.createElement('div');
    this.cloud.className = 'keeper-cloud';
    this.cloud.setAttribute('role', 'dialog');
    this.cloud.setAttribute('aria-label', '서점지기 안내');
    this.topicsEl = document.createElement('div');
    this.topicsEl.className = 'keeper-topics';
    this.topicsEl.hidden = true;
    this.anchor.append(this.cloud, this.topicsEl);
    this.el.appendChild(this.anchor);
    root.appendChild(this.el);
    this.anchor.addEventListener('click', (e) => this.onClick(e));
  }

  get active(): boolean {
    return !this.el.hidden;
  }

  open(): void {
    this.pickGreeting();
    this.topic = null;
    this.topicsEl.hidden = true;
    this.phase = 'greet';
    this.lines = [KEEPER_GREETINGS[this.greetI]!];
    this.lineI = 0;
    this.lineT = 0;
    this.showCloud(this.lines[0]!);
    const was = !this.el.hidden;
    this.el.hidden = false;
    if (!was) this.onActiveChange?.(true);
  }

  toggle(): void {
    if (this.active) this.close();
    else this.open();
  }

  close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.phase = 'idle';
    this.topic = null;
    this.lines = [];
    this.topicsEl.hidden = true;
    this.topicsEl.innerHTML = '';
    this.onActiveChange?.(false);
  }

  /** 머리 위 화면 좌표(컨테이너 기준 px). */
  setScreenPos(x: number, y: number, visible: boolean): void {
    if (!visible || this.el.hidden) {
      this.anchor.style.opacity = '0';
      this.anchor.style.pointerEvents = 'none';
      return;
    }
    this.anchor.style.opacity = '1';
    this.anchor.style.pointerEvents = 'auto';
    this.anchor.style.transform = `translate(${x}px, ${y}px) translate(-50%, calc(-100% - 10px))`;
  }

  update(dt: number): void {
    if (this.el.hidden) return;
    if (this.phase !== 'greet' && this.phase !== 'answer') return;
    if (this.lines.length <= 1 && this.phase === 'greet') {
      // 인사 한 줄 → 잠깐 두고 주제 버튼
      this.lineT += dt;
      if (this.lineT >= LINE_GAP * 0.85) this.showMenu();
      return;
    }
    if (this.lineI >= this.lines.length - 1) {
      this.lineT += dt;
      if (this.lineT >= LINE_GAP * 0.7) {
        if (this.phase === 'answer') this.showActions();
      }
      return;
    }
    this.lineT += dt;
    if (this.lineT < LINE_GAP) return;
    this.lineT = 0;
    this.lineI += 1;
    this.showCloud(this.lines[this.lineI]!);
  }

  private pickGreeting(): void {
    const n = KEEPER_GREETINGS.length;
    this.greetI = (this.greetI + 1 + Math.floor(Math.random() * (n - 1))) % n;
  }

  private showCloud(text: string): void {
    this.cloud.innerHTML = `<p class="keeper-line">${escapeHtml(text)}</p>`;
  }

  private showMenu(): void {
    this.phase = 'menu';
    this.showCloud('비북스에 대해 궁금한 게 있나요?');
    this.topicsEl.hidden = false;
    this.topicsEl.innerHTML = GUIDE_TOPICS.map((t) => `
      <button type="button" class="keeper-topic" data-kg="topic" data-id="${t.id}">${escapeHtml(t.label)}</button>
    `).join('');
  }

  private showActions(): void {
    if (!this.topic) return;
    this.phase = 'actions';
    const t = this.topic;
    this.cloud.innerHTML = `
      <p class="keeper-line">${escapeHtml(this.lines[this.lines.length - 1] ?? '')}</p>
      <div class="keeper-actions">
        ${t.actions.map((a) => `
          <button type="button" class="keeper-action" data-kg="link" data-url="${escapeAttr(a.url)}" data-toast="${escapeAttr(a.toast)}">${escapeHtml(a.label)}</button>
        `).join('')}
        <button type="button" class="keeper-action keeper-action-ghost" data-kg="back">다른 질문</button>
      </div>`;
  }

  private startAnswer(topic: GuideTopic): void {
    this.topic = topic;
    this.topicsEl.hidden = true;
    this.topicsEl.innerHTML = '';
    this.phase = 'answer';
    this.lines = [topic.question, ...splitUtterances(topic.answer)];
    this.lineI = 0;
    this.lineT = 0;
    this.showCloud(this.lines[0]!);
  }

  private onClick(e: Event): void {
    const t = (e.target as HTMLElement | null)?.closest('[data-kg]') as HTMLElement | null;
    if (!t) return;
    e.stopPropagation();
    const act = t.dataset.kg;
    if (act === 'topic') {
      const topic = GUIDE_TOPICS.find((x) => x.id === t.dataset.id);
      if (topic) this.startAnswer(topic);
      return;
    }
    if (act === 'back') {
      this.open();
      return;
    }
    if (act === 'link') {
      const url = t.dataset.url;
      const toast = t.dataset.toast || '';
      if (url) this.onOpenLink?.(url, toast);
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
