// 서점지기 안내 말풍선: 카운터 근처에서 질문 버튼 → 말풍선 안 답변.

export const BBOOKS_URL = 'https://bbooks.co.kr/';
export const MOIM_URL = 'https://bbooks.co.kr/moim/';
export const INSTAGRAM_URL = 'https://www.instagram.com/b_books2026';
export const MAP_URL =
  'https://map.naver.com/v5/search/%EA%B2%BD%EA%B8%B0%EB%8F%84%20%EB%B6%80%EC%B2%9C%EC%8B%9C%20%EC%9B%90%EB%AF%B8%EA%B5%AC%20%EB%B6%80%EC%B2%9C%EB%A1%9C136%EB%B2%88%EA%B8%B8%2024';
export const PHONE_TEL = 'tel:050713534850';
export const PHONE_LABEL = '0507-1353-4850';

/** 열릴 때마다(또는 목록으로 돌아올 때마다) 하나씩 고르는 인사 */
export const KEEPER_GREETINGS = [
  '어서 오세요, 비북스예요. 책등의 제목만 천천히 읽어도 만나고 싶은 책이 보일 때가 있어요.',
  '반가워요, 오늘도 카운터를 지키고 있어요. 같은 책도 다시 펼치면 전에 지나쳤던 문장이 눈에 들어오곤 해요.',
  '잘 오셨어요, 편하게 둘러보세요. 책을 고르기 어렵다면 첫 문장을 몇 개 읽어보는 것도 좋은 시작이에요.',
  '안녕하세요, 서가 사이에 들러주셨네요. 짧은 목차에도 그 책이 품은 질문이 조금씩 담겨 있어요.',
  '어서 오세요, 잠깐 구경만 하셔도 반가워요. 읽다 멈춘 책도 나중에 다시 만나면 다른 이야기를 건넬 수 있어요.',
  '반가워요, 비북스 서점지기예요. 누군가 고른 책들을 나란히 보면 그 사람의 취향이 조금 보이기도 해요.',
  '들러주셔서 고마워요. 책 한 권을 다 읽지 않아도, 마음에 남는 한 문장으로 이야기가 시작될 수 있어요.',
  '어서 오세요, 어떤 이야기가 궁금하세요? 소설 속 낯선 동네를 읽다 보면 아는 골목이 떠오르기도 해요.',
  '안녕하세요, 오늘은 어느 서가부터 볼까요? 좋아하는 책 옆에서 뜻밖의 책을 발견하는 재미도 있어요.',
  '반가워요, 서점지기에게 궁금한 걸 물어보세요. 책을 읽다가 생긴 질문은 다음 책을 고르는 힌트가 되기도 해요.',
  '잘 오셨어요. 시집은 처음부터 차례로 읽지 않고, 눈에 들어온 제목부터 펼쳐봐도 좋아요.',
  '어서 오세요, 이곳은 비북스예요. 그림책 한 장에도 글로 다 말하지 않은 이야기가 숨어 있어요.',
  '안녕하세요, 천천히 둘러보세요. 에세이는 나와 다른 하루를 잠깐 따라가 보는 재미가 있어요.',
  '반가워요, 다시 만나도 반가운 곳이면 좋겠어요. 좋아하는 책을 다시 읽는 일도 새로운 독서가 될 수 있어요.',
  '잘 오셨어요, 책 이야기도 환영해요. 같은 장면을 읽고도 서로 다른 대목을 기억한다는 게 재미있어요.',
  '어서 오세요. 책 속 음식 이야기를 읽다 보면 이야기가 잠깐 식탁처럼 느껴질 때가 있어요.',
  '안녕하세요, 서가 구경 중이신가요? 책 제목과 표지가 어떤 사이인지 살펴보는 것도 작은 재미예요.',
  '들러주셔서 반가워요. 여행책은 가볼 곳을 고를 때도, 아직 떠날 계획이 없을 때도 펼칠 수 있어요.',
  '어서 오세요, 궁금한 건 아래에서 골라 주세요. 책표 맨 뒤 작가의 말에서 이야기의 시작을 발견하기도 해요.',
  '반가워요, 비북스 카운터예요. 책을 덮고 나서야 떠오르는 질문도 있으니, 감상을 바로 정하지 않아도 괜찮아요.',
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
      '2026년 11월\n· 글크크 — 금 15:30–17:30 · 파일럿 무료 · 노트북 필수\n· 그림책 읽어주는 이모 — 11/14(토) 10:30\n· 클래식 음악 감상 — 11/14·21(토) 12:00\n· 부천 AI 특공대 1기 — 토 14:00 · 조건은 모임 안내 확인\n\n2026년 12월\n· 글크크 — 11–12월 파일럿으로 금 15:30–17:30 예정\n· 그 외 일정은 확정되면 이곳에 더할게요\n\n시간은 KST예요. 자리·변경은 신청 전에 확인해 주세요.',
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
    id: 'shelf',
    label: '0.1평 서점',
    question: '0.1평 서점이 뭔가요?',
    answer:
      '큰 책방 안 서가 한 칸을 나눠 맡는 작은 서점이에요. 칸마다 주인·취향이 달라 옮겨 다니며 다른 추천을 만날 수 있어요. 운영을 원하면 모집 여부를 문의해 주세요.',
    actions: [{ label: '서가 운영 문의', url: INSTAGRAM_URL, toast: '인스타그램으로 문의할 수 있어요' }],
  },
  {
    id: 'youth',
    label: '청소년 책사줄게',
    question: '‘청소년 책사줄게’는 어떤 캠페인이에요?',
    answer:
      '어른이 책값을 건네고, 부천 청소년이 스스로 책 한 권을 고르는 캠페인이에요. 비북스에서는 익명 0.1평 점주가 맡긴 씨앗 후원으로 시작해요. 후원·고르는 방법은 캠페인 안내를 확인해 주세요.',
    actions: [{ label: '청소년 책사줄게', url: INSTAGRAM_URL, toast: '캠페인 안내를 열어요' }],
  },
  {
    id: 'join',
    label: '모임 참여',
    question: '모임에 참여하려면 어떻게 하나요?',
    answer:
      '비모임 안내에서 관심 모임을 골라 참여 방법을 확인해 주세요. 참가비·준비물은 모임마다 달라요. 글크크는 노트북이 필요하고, 목요일까지 밴드에 글을 공유해요. 처음이면 밴드 입장도 함께 문의해 주세요.',
    actions: [{ label: '참여할 모임 고르기', url: MOIM_URL, toast: '비모임 안내를 열어요' }],
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

type View = 'menu' | 'answer';

export class KeeperGuide {
  readonly el: HTMLElement;
  private bubble: HTMLElement;
  private greetI = Math.floor(Math.random() * KEEPER_GREETINGS.length);
  private view: View = 'menu';
  private topic: GuideTopic | null = null;
  private near = false;
  onOpenLink: ((url: string, toast: string) => void) | null = null;
  /** 말풍선이 열리거나 닫힐 때(응대 연출용) */
  onActiveChange: ((active: boolean) => void) | null = null;

  constructor(root: HTMLElement) {
    this.el = document.createElement('aside');
    this.el.className = 'keeper-guide';
    this.el.hidden = true;
    this.el.setAttribute('aria-live', 'polite');
    this.bubble = document.createElement('div');
    this.bubble.className = 'keeper-bubble';
    this.bubble.setAttribute('role', 'dialog');
    this.bubble.setAttribute('aria-label', '서점지기 안내');
    this.el.appendChild(this.bubble);
    root.appendChild(this.el);
    this.bubble.addEventListener('click', (e) => this.onClick(e));
  }

  get active(): boolean {
    return !this.el.hidden;
  }

  /** 카운터 근처에 들어오면 열고, 멀어지면 닫는다. */
  setNear(near: boolean): void {
    if (near === this.near) return;
    this.near = near;
    if (near) this.openMenu(true);
    else this.close();
  }

  openMenu(freshGreet: boolean): void {
    if (freshGreet) this.pickGreeting();
    this.view = 'menu';
    this.topic = null;
    this.render();
    const was = !this.el.hidden;
    this.el.hidden = false;
    if (!was) this.onActiveChange?.(true);
  }

  close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.view = 'menu';
    this.topic = null;
    this.onActiveChange?.(false);
  }

  private pickGreeting(): void {
    const n = KEEPER_GREETINGS.length;
    this.greetI = (this.greetI + 1 + Math.floor(Math.random() * (n - 1))) % n;
  }

  private onClick(e: Event): void {
    const t = (e.target as HTMLElement | null)?.closest('[data-kg]') as HTMLElement | null;
    if (!t) return;
    const act = t.dataset.kg;
    if (act === 'topic') {
      const id = t.dataset.id;
      const topic = GUIDE_TOPICS.find((x) => x.id === id);
      if (!topic) return;
      this.topic = topic;
      this.view = 'answer';
      this.render();
      return;
    }
    if (act === 'back') {
      this.openMenu(true);
      return;
    }
    if (act === 'link') {
      const url = t.dataset.url;
      const toast = t.dataset.toast || '';
      if (url) this.onOpenLink?.(url, toast);
      return;
    }
    if (act === 'close') this.close();
  }

  private render(): void {
    if (this.view === 'answer' && this.topic) {
      const t = this.topic;
      this.bubble.innerHTML = `
        <header class="keeper-bubble-head">
          <button type="button" class="keeper-back" data-kg="back" aria-label="목록으로">←</button>
          <span class="keeper-bubble-who">서점지기 · 안내</span>
          <button type="button" class="keeper-x" data-kg="close" aria-label="닫기">×</button>
        </header>
        <p class="keeper-q">${escapeHtml(t.question)}</p>
        <p class="keeper-a">${escapeHtml(t.answer).replace(/\n/g, '<br>')}</p>
        <div class="keeper-actions">
          ${t.actions.map((a) => `
            <button type="button" class="keeper-action" data-kg="link" data-url="${escapeAttr(a.url)}" data-toast="${escapeAttr(a.toast)}">${escapeHtml(a.label)}</button>
          `).join('')}
        </div>`;
      return;
    }

    const greet = KEEPER_GREETINGS[this.greetI]!;
    this.bubble.innerHTML = `
      <header class="keeper-bubble-head">
        <span class="keeper-bubble-who">서점지기 · 안내</span>
        <button type="button" class="keeper-x" data-kg="close" aria-label="닫기">×</button>
      </header>
      <p class="keeper-greet">${escapeHtml(greet)}</p>
      <p class="keeper-prompt">비북스에 대해 궁금한 게 있나요?<br>아래에서 골라 주세요.</p>
      <div class="keeper-topics" role="list">
        ${GUIDE_TOPICS.map((t) => `
          <button type="button" class="keeper-topic" data-kg="topic" data-id="${t.id}" role="listitem">${escapeHtml(t.label)}</button>
        `).join('')}
      </div>`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
