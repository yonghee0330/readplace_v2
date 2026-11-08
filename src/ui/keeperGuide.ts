// 서점지기 안내: 머리 위 구름 말풍선. 인사(최초 1회)+질문 버튼 → 답 전체 + 닫기.

export const BBOOKS_URL = 'https://bbooks.co.kr/';
export const MOIM_URL = 'https://moim.bbooks.co.kr/';
export const INSTAGRAM_URL = 'https://www.instagram.com/b_books2026';
export const MAP_URL =
  'https://map.naver.com/v5/search/%EA%B2%BD%EA%B8%B0%EB%8F%84%20%EB%B6%80%EC%B2%9C%EC%8B%9C%20%EC%9B%90%EB%AF%B8%EA%B5%AC%20%EB%B6%80%EC%B2%9C%EB%A1%9C136%EB%B2%88%EA%B8%B8%2024';
export const PHONE_TEL = 'tel:050713534850';
export const PHONE_LABEL = '0507-1353-4850';

/** 처음 열 때만 하나씩 고르는 짧은 인사 */
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
  '잘 오셨어요.',
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
      '11–12월 모임·행사예요. 신청·변경은 비모임에서 확인해 주세요.\n\n글크크 - 매주 금 15:30–17:30 (11–12월)\n그림책 읽어주는 이모 - 11/14(토) 10:30\n클래식 음악 감상 모임 - 11/14·21(토) 12:00\n크래프트모임 - 11/15(일) 14:30–16:00\n다온글방 - 11/19(목) 19:00\n서귤 작가 북토크 - 11/28(토) 16:00–18:00\n써든리 모임 - 11/30(월) 13:00–14:30\n부천 AI 특공대 1기 - 매주 토 14:00',
    actions: [{ label: '모임 자세히 보기', url: MOIM_URL, toast: '비모임 안내를 열어요' }],
  },
  {
    id: 'way',
    label: '찾아오는 길',
    question: '비북스에는 어떻게 가나요?',
    answer:
      '경기도 부천시 원미구 부천로136번길 24, 지하 B02호 · 원미구청 맞은편이에요. 지도에서 출발지를 넣으면 길을 확인할 수 있어요.',
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

export class KeeperGuide {
  readonly el: HTMLElement;
  private anchor: HTMLElement;
  private cloud: HTMLElement;
  private greetI = Math.floor(Math.random() * KEEPER_GREETINGS.length);
  /** 이 세션에서 인사를 이미 했는지 */
  private greeted = false;
  private boxW = 300;
  private boxH = 160;
  private lastActAt = 0;
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
    this.anchor.appendChild(this.cloud);
    this.el.appendChild(this.anchor);
    root.appendChild(this.el);

    // 버블 단계에서만 막고, 버튼 클릭은 받도록 한다(capture stop은 클릭을 삼킴).
    const stopBubble = (e: Event) => e.stopPropagation();
    this.anchor.addEventListener('pointerdown', stopBubble);
    this.anchor.addEventListener('touchstart', stopBubble, { passive: true });
    // pointerup으로 동작(모바일 클릭 지연·누락 대비). 이어지는 click은 무시.
    this.cloud.addEventListener('pointerup', (e) => this.onAct(e));
    this.cloud.addEventListener('click', (e) => {
      if (performance.now() - this.lastActAt < 450) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      this.onAct(e);
    });
  }

  get active(): boolean {
    return !this.el.hidden;
  }

  /** 머리 클릭: 닫혀 있으면 열고, 열려 있으면 닫지 않고 메뉴로(닫기는 버튼으로). */
  open(): void {
    this.showMenu(!this.greeted);
    const was = !this.el.hidden;
    this.el.hidden = false;
    if (!was) this.onActiveChange?.(true);
    this.measure();
  }

  toggle(): void {
    if (this.active) this.close();
    else this.open();
  }

  close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.cloud.innerHTML = '';
    this.onActiveChange?.(false);
  }

  /**
   * 머리 위 화면 좌표. visible=false여도 안내가 열려 있으면 위치만 유지하고
   * 클릭은 계속 받게 한다(머리가 잠깐 가려져도 버튼이 죽지 않게).
   */
  setScreenPos(x: number, y: number, viewW: number, viewH: number, visible: boolean): void {
    if (this.el.hidden) {
      this.anchor.style.opacity = '0';
      this.anchor.style.pointerEvents = 'none';
      return;
    }
    if (!visible) {
      // 마지막 자리 유지, 입력은 살림
      this.anchor.style.opacity = '1';
      this.anchor.style.pointerEvents = 'auto';
      return;
    }
    this.measure();
    const pad = 10;
    const width = Math.min(Math.max(this.boxW, 280), viewW - pad * 2);
    const half = width / 2;
    const left = Math.min(viewW - half - pad, Math.max(half + pad, x));
    // 머리 높이에서 시작해 아래로 늘어나 서점지기를 걸쳐 보이게 한다
    const maxH = Math.min(this.boxH, viewH - pad * 2);
    const top = Math.max(pad, Math.min(y - 36, viewH - pad - Math.min(maxH, viewH * 0.72)));
    this.anchor.style.opacity = '1';
    this.anchor.style.pointerEvents = 'auto';
    this.anchor.style.width = `${width}px`;
    this.anchor.style.transform = `translate(${left}px, ${top}px) translate(-50%, 0)`;
    this.anchor.dataset.side = 'over';
  }

  update(_dt: number): void {
    /* 즉시 표시라 타이머 없음 */
  }

  private measure(): void {
    const w = this.anchor.offsetWidth;
    const h = this.anchor.offsetHeight;
    if (w > 40) this.boxW = w;
    if (h > 40) this.boxH = h;
  }

  private pickGreeting(): string {
    const n = KEEPER_GREETINGS.length;
    this.greetI = (this.greetI + 1 + Math.floor(Math.random() * (n - 1))) % n;
    return KEEPER_GREETINGS[this.greetI]!;
  }

  private showMenu(withGreet: boolean): void {
    const greet = withGreet ? this.pickGreeting() : '';
    if (withGreet) this.greeted = true;
    this.cloud.innerHTML = `
      ${greet ? `<p class="keeper-line keeper-greet">${escapeHtml(greet)}</p>` : ''}
      <div class="keeper-topics" role="list">
        ${GUIDE_TOPICS.map((t) => `
          <button type="button" class="keeper-topic" data-kg="topic" data-id="${t.id}" role="listitem">${escapeHtml(t.label)}</button>
        `).join('')}
      </div>
      <div class="keeper-actions">
        <button type="button" class="keeper-action keeper-action-ghost" data-kg="close">닫기</button>
      </div>`;
    requestAnimationFrame(() => this.measure());
  }

  private showAnswer(topic: GuideTopic): void {
    this.cloud.innerHTML = `
      <p class="keeper-line keeper-answer">${escapeHtml(topic.answer).replace(/\n/g, '<br>')}</p>
      <div class="keeper-actions">
        ${topic.actions.map((a) => `
          <button type="button" class="keeper-action" data-kg="link" data-url="${escapeAttr(a.url)}" data-toast="${escapeAttr(a.toast)}">${escapeHtml(a.label)}</button>
        `).join('')}
        <button type="button" class="keeper-action keeper-action-ghost" data-kg="back">다른 질문</button>
        <button type="button" class="keeper-action keeper-action-ghost" data-kg="close">닫기</button>
      </div>`;
    requestAnimationFrame(() => this.measure());
  }

  private onAct(e: Event): void {
    const t = (e.target as HTMLElement | null)?.closest('[data-kg]') as HTMLElement | null;
    if (!t || !this.cloud.contains(t)) return;
    e.preventDefault();
    e.stopPropagation();
    this.lastActAt = performance.now();
    const act = t.dataset.kg;
    if (act === 'topic') {
      const topic = GUIDE_TOPICS.find((x) => x.id === t.dataset.id);
      if (topic) this.showAnswer(topic);
      return;
    }
    if (act === 'back') {
      this.showMenu(false);
      return;
    }
    if (act === 'close') {
      this.close();
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
