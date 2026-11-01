// 읽기 모드(집중 독서 화면, SPEC v3.1): 각자 자기 책을 읽는 동안 서점을 배경으로 두고
// "함께 읽는 중 N명", 누가 무슨 책을 읽는지, 이번 독서 타이머, 오늘 읽은 시간만 보여 준다.
// Esc·돌아가기로 나간다.
import type { SharedBook } from '../net/presence';
import { addReading, formatClock, formatMinutes, loadReading } from './storage';

export interface FocusReader {
  nickname: string;
  color: string;
  book: SharedBook | null;
  /** 나 자신이면 true(목록에서 "나"로 표시) */
  self?: boolean;
}

export class FocusMode {
  readonly el: HTMLElement;
  private together: HTMLElement;
  private readersEl: HTMLElement;
  private clock: HTMLElement;
  private todayEl: HTMLElement;
  private startedAt = 0;
  private savedSec = 0;
  private timer = 0;
  active = false;

  constructor(parent: HTMLElement, private onExit: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'focus';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="focus-top">
        <div class="focus-together-row" role="status" aria-live="polite"><span class="focus-dot"></span><span class="focus-together">함께 읽는 중 1명</span></div>
        <ul class="focus-readers" aria-label="함께 읽는 사람들의 책"></ul>
      </div>
      <div class="focus-bottom">
        <div class="focus-clock" aria-label="이번 독서 시간">00:00:00</div>
        <div class="focus-today">오늘 0분 읽었어요</div>
        <button type="button" class="pill focus-exit" aria-label="읽기 모드 끝내고 돌아가기">돌아가기</button>
      </div>`;
    parent.appendChild(this.el);
    this.together = this.el.querySelector('.focus-together')!;
    this.readersEl = this.el.querySelector('.focus-readers')!;
    this.clock = this.el.querySelector('.focus-clock')!;
    this.todayEl = this.el.querySelector('.focus-today')!;
    this.el.querySelector('.focus-exit')!.addEventListener('click', () => this.onExit());
  }

  enter(): void {
    if (this.active) return;
    this.active = true;
    this.startedAt = performance.now();
    this.savedSec = 0;
    this.el.hidden = false;
    requestAnimationFrame(() => this.el.classList.add('is-in'));
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 1000);
    (this.el.querySelector('.focus-exit') as HTMLElement).focus();
  }

  exit(): void {
    if (!this.active) return;
    this.flush();
    this.active = false;
    clearInterval(this.timer);
    this.el.classList.remove('is-in');
    this.el.hidden = true;
  }

  setTogether(n: number): void {
    this.together.textContent = `함께 읽는 중 ${n}명`;
  }

  /** 함께 읽는 사람과 책 제목을 갱신한다. self를 맨 앞에. */
  setReaders(list: FocusReader[]): void {
    this.readersEl.replaceChildren();
    if (list.length === 0) {
      this.readersEl.hidden = true;
      return;
    }
    this.readersEl.hidden = false;
    for (const r of list) {
      const li = document.createElement('li');
      li.className = 'focus-reader';
      if (r.self) li.classList.add('is-self');

      const cover = document.createElement('div');
      cover.className = 'focus-reader-cover';
      if (r.book?.coverUrl) {
        const img = document.createElement('img');
        img.src = r.book.coverUrl;
        img.alt = '';
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', () => {
          cover.replaceChildren();
          cover.textContent = '책';
          cover.classList.add('is-empty');
        });
        cover.appendChild(img);
      } else {
        cover.textContent = '책';
        cover.classList.add('is-empty');
      }

      const body = document.createElement('div');
      body.className = 'focus-reader-body';
      const who = document.createElement('div');
      who.className = 'focus-reader-who';
      const dot = document.createElement('span');
      dot.className = 'focus-reader-dot';
      dot.style.background = r.color;
      who.append(dot, document.createTextNode(r.self ? '나' : r.nickname));
      const title = document.createElement('div');
      title.className = 'focus-reader-title';
      title.textContent = r.book?.title || '책 읽는 중';
      const sub = document.createElement('div');
      sub.className = 'focus-reader-sub';
      const meta = [r.book?.author, r.book?.publisher].filter(Boolean).join(' · ');
      sub.textContent = meta;
      sub.hidden = !meta;
      body.append(who, title, sub);

      li.append(cover, body);
      this.readersEl.appendChild(li);
    }
  }

  private elapsed(): number {
    return (performance.now() - this.startedAt) / 1000;
  }

  /** 10초마다 저장해서 탭이 갑자기 닫혀도 대부분 남게 한다. */
  private flush(): void {
    const sec = Math.floor(this.elapsed()) - this.savedSec;
    if (sec > 0) {
      addReading(sec);
      this.savedSec += sec;
    }
  }

  private tick(): void {
    const e = this.elapsed();
    if (Math.floor(e) - this.savedSec >= 10) this.flush();
    this.clock.textContent = formatClock(e);
    const unsaved = Math.floor(e) - this.savedSec;
    this.todayEl.textContent = `오늘 ${formatMinutes(loadReading().todaySec + Math.max(0, unsaved))} 읽었어요`;
  }
}
