// HUD: 상단 좌측(나가기·서점 이름), 상단 우측(접속자 수·소리·설정), 하단 액션 3개(눈인사·책 펼치기·읽기 모드),
// 연결 상태 필. 모든 버튼에 aria-label, 하단 액션은 연결 전 비활성 + "연결 중" 툴팁.
import { ROOM_CAPACITY, roomLabel } from '../core/params';

const ICON = {
  back: '<path d="M15 5l-7 7 7 7" />',
  people: '<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="16.5" cy="8" r="2.4"/><path d="M15.5 13.4c2.6-.3 4.6 1.4 5 4.6"/>',
  soundOn: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/>',
  soundOff: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4L18 18M6 18l1.6-1.6M16.4 7.6L18 6"/>',
  nod: '<circle cx="12" cy="8.5" r="4"/><path d="M5.5 20c.8-3.6 3.4-5.6 6.5-5.6s5.7 2 6.5 5.6"/><path d="M9.6 8.6c.7.6 1.6.6 2.4 0M12.6 8.6c.7.6 1.6.6 2.4 0" />',
  book: '<path d="M12 6.5c-2-1.4-4.6-1.8-7.5-1.3v12.5c2.9-.5 5.5-.1 7.5 1.3 2-1.4 4.6-1.8 7.5-1.3V5.2c-2.9-.5-5.5-.1-7.5 1.3z"/><path d="M12 6.5V19"/>',
  focus: '<path d="M4 8V5.5A1.5 1.5 0 015.5 4H8M16 4h2.5A1.5 1.5 0 0120 5.5V8M20 16v2.5a1.5 1.5 0 01-1.5 1.5H16M8 20H5.5A1.5 1.5 0 014 18.5V16"/><path d="M12 9c-1.2-.8-2.6-1-4-.7v6.4c1.4-.3 2.8-.1 4 .7 1.2-.8 2.6-1 4-.7V8.3c-1.4-.3-2.8-.1-4 .7z"/>',
} as const;

export const icon = (name: keyof typeof ICON) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;

export interface HudHandlers {
  exit(): void;
  sound(): void;
  settings(): void;
  nod(): void;
  book(): void;
  focus(): void;
}

export class Hud {
  readonly root: HTMLElement;
  private count: HTMLElement;
  private soundBtn: HTMLButtonElement;
  private actions: HTMLButtonElement[];
  private bookBtn: HTMLButtonElement;
  private pill: HTMLElement;
  private weatherEl: HTMLElement;

  constructor(parent: HTMLElement, h: HudHandlers) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud-top hud-left">
        <button type="button" class="pill pill-icon" data-act="exit" aria-label="서점에서 나가기">${icon('back')}<span class="pill-text">나가기</span></button>
        <div class="pill pill-room" role="status">${roomLabel()}</div>
        <div class="pill pill-weather" role="status" data-weather hidden>부천</div>
      </div>
      <div class="hud-top hud-right">
        <div class="pill pill-count" role="status" aria-live="polite">${icon('people')}<span class="count-num">1</span><span class="count-cap">/${ROOM_CAPACITY}</span></div>
        <button type="button" class="pill pill-icon" data-act="sound" aria-label="서점 소리 켜기" aria-pressed="false">${icon('soundOff')}</button>
        <button type="button" class="pill pill-icon" data-act="settings" aria-label="설정 열기" aria-haspopup="dialog">${icon('gear')}</button>
      </div>
      <div class="hud-status" hidden><span class="dot"></span><span class="status-text">다시 연결하고 있어요</span></div>
      <nav class="hud-actions" aria-label="동작">
        <button type="button" class="action" data-act="nod" aria-label="눈인사 (단축키 1)" data-tip="연결 중">${icon('nod')}<span>눈인사</span></button>
        <button type="button" class="action" data-act="book" aria-label="책 펼치기 (단축키 2)" aria-pressed="false" data-tip="연결 중">${icon('book')}<span>책 펼치기</span></button>
        <button type="button" class="action" data-act="focus" aria-label="읽기 모드 (단축키 3)" data-tip="연결 중">${icon('focus')}<span>읽기 모드</span></button>
      </nav>`;
    parent.appendChild(this.root);
    const q = <T extends HTMLElement>(s: string) => this.root.querySelector<T>(s)!;
    this.count = q('.count-num');
    this.soundBtn = q<HTMLButtonElement>('[data-act="sound"]');
    this.bookBtn = q<HTMLButtonElement>('[data-act="book"]');
    this.pill = q('.hud-status');
    this.weatherEl = q('[data-weather]');
    this.actions = [...this.root.querySelectorAll<HTMLButtonElement>('.action')];

    q('[data-act="exit"]').addEventListener('click', () => h.exit());
    this.soundBtn.addEventListener('click', () => h.sound());
    q('[data-act="settings"]').addEventListener('click', () => h.settings());
    const guard = (fn: () => void) => (e: Event) => {
      if ((e.currentTarget as HTMLElement).getAttribute('aria-disabled') === 'true') return;
      fn();
    };
    q('[data-act="nod"]').addEventListener('click', guard(h.nod));
    this.bookBtn.addEventListener('click', guard(h.book));
    q('[data-act="focus"]').addEventListener('click', guard(h.focus));
    this.setCount(1);
    this.setConnected(false);
  }

  setCount(n: number): void {
    this.count.textContent = String(n);
    this.count.parentElement!.setAttribute('aria-label', `지금 함께 있는 사람 ${n}명, 최대 ${ROOM_CAPACITY}명`);
  }

  setWeather(label: string): void {
    this.weatherEl.hidden = !label;
    this.weatherEl.textContent = label;
    this.weatherEl.setAttribute('aria-label', label ? `지금 날씨 ${label}` : '');
  }

  setSound(on: boolean): void {
    this.soundBtn.innerHTML = icon(on ? 'soundOn' : 'soundOff');
    this.soundBtn.setAttribute('aria-pressed', String(on));
    this.soundBtn.setAttribute('aria-label', on ? '서점 소리 끄기' : '서점 소리 켜기');
  }

  setReading(on: boolean): void {
    this.bookBtn.setAttribute('aria-pressed', String(on));
    this.bookBtn.querySelector('span')!.textContent = on ? '책 덮기' : '책 펼치기';
    this.bookBtn.setAttribute('aria-label', `${on ? '책 덮기' : '책 펼치기'} (단축키 2)`);
  }

  /** 연결 전에는 하단 액션을 막고 "연결 중" 툴팁을 보여 준다. 끊겼다 다시 붙는 중이면 상단 필. */
  setConnected(connected: boolean, reconnecting = false): void {
    for (const b of this.actions) {
      b.setAttribute('aria-disabled', String(!connected));
      b.classList.toggle('is-disabled', !connected);
      if (connected) b.removeAttribute('title');
      else b.title = '연결 중';
    }
    this.pill.hidden = !reconnecting;
  }

  /** 읽기 모드에서는 HUD를 옅게 숨긴다. */
  setHidden(hidden: boolean): void {
    this.root.classList.toggle('is-hidden', hidden);
    // 숨긴 동안에는 Tab으로도 닿지 않게 한다
    this.root.inert = hidden;
  }

  cooldown(act: 'nod', ms: number): void {
    const b = this.root.querySelector<HTMLButtonElement>(`[data-act="${act}"]`)!;
    b.classList.add('is-cooling');
    b.setAttribute('aria-disabled', 'true');
    setTimeout(() => {
      b.classList.remove('is-cooling');
      if (!b.classList.contains('is-disabled')) b.setAttribute('aria-disabled', 'false');
    }, ms);
  }
}
