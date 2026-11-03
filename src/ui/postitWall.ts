// 가오픈 포스트잇 보드: 하루 단위. 오늘은 붙이기, 지난 보드는 보기만.
import {
  POSTIT_COLORS, POSTIT_MAX_LEN, POSTIT_SHAPES, colorHex, formatBoardDayLabel,
  shiftBoardDay, todayBoardDay,
  type PostitColor, type PostitNote, type PostitShape, type PostitStore,
} from '../net/postit';

export class PostitWall {
  readonly el: HTMLElement;
  active = false;
  private board: HTMLElement;
  private composer: HTMLElement;
  private input: HTMLTextAreaElement;
  private countEl: HTMLElement;
  private hint: HTMLElement;
  private readyBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;
  private ghost: HTMLElement;
  private dayLabel: HTMLElement;
  private prevDayBtn: HTMLButtonElement;
  private nextDayBtn: HTMLButtonElement;
  private lead: HTMLElement;
  private store: PostitStore;
  private color: PostitColor = 'yellow';
  private shape: PostitShape = 'square';
  private placing = false;
  private viewDay = todayBoardDay();
  private onExit: () => void;
  private unsub: (() => void) | null = null;
  private getNickname: () => string;
  private getAuthorId: () => string;

  constructor(
    parent: HTMLElement,
    store: PostitStore,
    nickname: () => string,
    authorId: () => string,
    onExit: () => void,
  ) {
    this.store = store;
    this.getNickname = nickname;
    this.getAuthorId = authorId;
    this.onExit = onExit;
    this.el = document.createElement('div');
    this.el.className = 'postit-wall';
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-label', 'b.books-M 포스트잇 보드');
    this.el.innerHTML = `
      <div class="postit-wall-dim" aria-hidden="true"></div>
      <div class="postit-wall-stage">
        <header class="postit-wall-head">
          <div>
            <p class="postit-wall-kicker">비북스-M</p>
            <h2 class="postit-wall-title">b.books-M 공간이 생겼어요!</h2>
            <p class="postit-wall-lead" data-lead>하루마다 새 보드에 인사 · 바람 · 제보를 남겨 보세요.</p>
            <div class="postit-day-nav" role="group" aria-label="보드 날짜">
              <button type="button" class="pill postit-day-btn" data-day-prev aria-label="이전 날 보드">‹</button>
              <p class="postit-day-label" data-day-label></p>
              <button type="button" class="pill postit-day-btn" data-day-next aria-label="다음 날 보드">›</button>
            </div>
          </div>
          <button type="button" class="pill postit-wall-exit" aria-label="보드에서 돌아가기">돌아가기</button>
        </header>
        <div class="postit-board" data-board tabindex="0" aria-label="포스트잇 보드">
          <div class="postit-ghost" data-ghost hidden aria-hidden="true"></div>
        </div>
        <div class="postit-composer">
          <div class="postit-swatches" role="radiogroup" aria-label="포스트잇 색">
            ${POSTIT_COLORS.map((c) => `<button type="button" class="postit-swatch" role="radio" data-color="${c.id}" style="--c:${c.hex}" aria-label="${c.label}" aria-checked="false"></button>`).join('')}
          </div>
          <div class="postit-shapes" role="radiogroup" aria-label="포스트잇 모양">
            ${POSTIT_SHAPES.map((s) => `<button type="button" class="postit-shape" role="radio" data-shape="${s.id}" aria-checked="false">${s.label}</button>`).join('')}
          </div>
          <label class="postit-input-wrap">
            <span class="visually-hidden">메시지</span>
            <textarea class="postit-input" maxlength="${POSTIT_MAX_LEN}" rows="2" placeholder="예) 창가 자리가 참 좋아요 / 모바일에서 ○○가 불편해요"></textarea>
            <span class="postit-count"><span data-count>0</span>/${POSTIT_MAX_LEN}</span>
          </label>
          <div class="postit-composer-actions">
            <p class="postit-hint" data-hint>색·모양을 고르고 메시지를 적은 뒤, 「붙이기」를 누르세요</p>
            <button type="button" class="btn" data-act="cancel" hidden>취소</button>
            <button type="button" class="btn btn-primary" data-act="ready">붙이기</button>
          </div>
        </div>
      </div>`;
    parent.appendChild(this.el);
    this.board = this.el.querySelector('[data-board]')!;
    this.composer = this.el.querySelector('.postit-composer')!;
    this.input = this.el.querySelector('.postit-input')!;
    this.countEl = this.el.querySelector('[data-count]')!;
    this.hint = this.el.querySelector('[data-hint]')!;
    this.readyBtn = this.el.querySelector('[data-act="ready"]')!;
    this.cancelBtn = this.el.querySelector('[data-act="cancel"]')!;
    this.ghost = this.el.querySelector('[data-ghost]')!;
    this.dayLabel = this.el.querySelector('[data-day-label]')!;
    this.prevDayBtn = this.el.querySelector('[data-day-prev]')!;
    this.nextDayBtn = this.el.querySelector('[data-day-next]')!;
    this.lead = this.el.querySelector('[data-lead]')!;

    this.el.querySelector('.postit-wall-exit')!.addEventListener('click', () => this.onExit());
    this.el.querySelector('.postit-wall-dim')!.addEventListener('click', () => this.onExit());
    this.prevDayBtn.addEventListener('click', () => this.shiftDay(-1));
    this.nextDayBtn.addEventListener('click', () => this.shiftDay(1));

    this.el.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((btn) =>
      btn.addEventListener('click', () => {
        if (!this.isToday()) return;
        this.color = btn.dataset.color as PostitColor;
        this.syncPicks();
        this.syncGhostStyle();
      }),
    );
    this.el.querySelectorAll<HTMLButtonElement>('[data-shape]').forEach((btn) =>
      btn.addEventListener('click', () => {
        if (!this.isToday()) return;
        this.shape = btn.dataset.shape as PostitShape;
        this.syncPicks();
        this.syncGhostStyle();
      }),
    );
    this.input.addEventListener('input', () => {
      this.countEl.textContent = String(this.input.value.length);
      if (this.placing && !this.input.value.trim()) this.setPlacing(false);
      this.syncGhostStyle();
    });
    this.readyBtn.addEventListener('click', () => {
      if (!this.isToday()) return;
      const t = this.input.value.trim();
      if (!t) {
        this.hint.textContent = '메시지를 먼저 적어 주세요';
        this.input.focus();
        return;
      }
      this.setPlacing(true);
    });
    this.cancelBtn.addEventListener('click', () => this.setPlacing(false));
    this.board.addEventListener('pointerdown', (e) => {
      if (!this.isToday()) return;
      const target = e.target as HTMLElement;
      if (target.closest('.postit-note:not(.postit-ghost)')) return;
      if (!this.placing) {
        this.hint.textContent = '아래 「붙이기」를 누른 뒤, 보드에서 자리를 골라 주세요';
        this.readyBtn.focus();
        return;
      }
      e.preventDefault();
      const rect = this.board.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      void this.stick(x, y);
    });
    this.board.addEventListener('pointermove', (e) => {
      if (!this.placing || !this.isToday()) return;
      const rect = this.board.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      this.ghost.style.left = `${x}%`;
      this.ghost.style.top = `${y}%`;
      this.ghost.hidden = false;
    });
    this.board.addEventListener('pointerleave', () => {
      if (this.placing) this.ghost.hidden = true;
    });
    this.syncPicks();
  }

  private isToday(): boolean {
    return this.viewDay === todayBoardDay();
  }

  enter(): void {
    if (this.active) return;
    this.active = true;
    this.viewDay = todayBoardDay();
    this.el.hidden = false;
    this.setPlacing(false);
    this.refreshView();
    this.unsub = this.store.onChange(() => {
      if (this.active) this.refreshView();
    });
    requestAnimationFrame(() => {
      this.el.classList.add('is-in');
      if (this.isToday()) this.input.focus();
    });
  }

  exit(): void {
    if (!this.active) return;
    this.active = false;
    this.setPlacing(false);
    this.el.classList.remove('is-in');
    this.el.hidden = true;
    this.unsub?.();
    this.unsub = null;
  }

  private shiftDay(delta: number): void {
    const today = todayBoardDay();
    const next = shiftBoardDay(this.viewDay, delta);
    const floor = shiftBoardDay(today, -44);
    if (next > today || next < floor) return;
    this.setPlacing(false);
    this.viewDay = next;
    this.refreshView();
  }

  private refreshView(): void {
    const today = todayBoardDay();
    if (this.viewDay > today) this.viewDay = today;
    const notes = this.store.list(this.viewDay);
    const todayView = this.isToday();
    const label = formatBoardDayLabel(this.viewDay);
    this.dayLabel.textContent = todayView ? `${label} · 오늘` : `${label} · 지난 보드`;
    this.nextDayBtn.disabled = todayView;
    this.prevDayBtn.disabled = this.viewDay <= shiftBoardDay(today, -44);
    this.composer.hidden = !todayView;
    this.el.classList.toggle('is-archive', !todayView);
    this.lead.textContent = todayView
      ? '하루마다 새 보드에 인사 · 바람 · 제보를 남겨 보세요. 지난 보드는 ‹ › 로 볼 수 있어요.'
      : '지난 보드예요. 보기만 할 수 있어요. 오늘 보드로 돌아가 쪽지를 남겨 보세요.';
    this.hint.textContent = todayView
      ? '색·모양을 고르고 메시지를 적은 뒤, 「붙이기」를 누르세요'
      : '지난 보드는 보기만 할 수 있어요';
    this.renderNotes(notes);
  }

  private async stick(x: number, y: number): Promise<void> {
    if (!this.isToday()) return;
    const text = this.input.value.trim().slice(0, POSTIT_MAX_LEN);
    if (!text) return;
    this.readyBtn.disabled = true;
    const note = await this.store.add({
      text,
      color: this.color,
      shape: this.shape,
      x,
      y,
      nickname: this.getNickname(),
      authorId: this.getAuthorId(),
      day: this.viewDay,
    });
    this.readyBtn.disabled = false;
    if (!note) {
      this.hint.textContent = '오늘 보드가 가득 찼어요. 조금만 기다려 주세요';
      this.setPlacing(false);
      return;
    }
    this.input.value = '';
    this.countEl.textContent = '0';
    this.setPlacing(false);
    this.hint.textContent = '붙였어요! 또 남기려면 다시 적어 주세요.';
    this.input.focus();
  }

  private setPlacing(on: boolean): void {
    if (on && !this.isToday()) return;
    this.placing = on;
    this.board.classList.toggle('is-placing', on);
    this.composer.classList.toggle('is-placing', on);
    this.cancelBtn.hidden = !on;
    this.readyBtn.hidden = on;
    this.ghost.hidden = true;
    if (on) {
      this.syncGhostStyle();
      this.hint.textContent = '보드에서 붙이고 싶은 곳을 눌러 주세요';
      this.board.focus({ preventScroll: true });
    } else if (this.isToday()) {
      this.hint.textContent = '색·모양을 고르고 메시지를 적은 뒤, 「붙이기」를 누르세요';
    }
  }

  private syncGhostStyle(): void {
    const text = this.input.value.trim() || '여기에 붙여요';
    this.ghost.className = `postit-ghost postit-note shape-${this.shape}`;
    this.ghost.style.setProperty('--c', colorHex(this.color));
    this.ghost.innerHTML = `<span class="postit-pin" aria-hidden="true"></span><p class="postit-note-text"></p>`;
    this.ghost.querySelector('.postit-note-text')!.textContent = text.slice(0, POSTIT_MAX_LEN);
  }

  private syncPicks(): void {
    this.el.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.color === this.color)),
    );
    this.el.querySelectorAll<HTMLButtonElement>('[data-shape]').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.shape === this.shape)),
    );
  }

  private renderNotes(notes: PostitNote[]): void {
    const keep = this.ghost;
    this.board.replaceChildren();
    this.board.appendChild(keep);
    for (const n of notes) {
      const el = document.createElement('article');
      el.className = `postit-note shape-${n.shape}`;
      el.style.setProperty('--c', colorHex(n.color));
      el.style.left = `${n.x * 100}%`;
      el.style.top = `${n.y * 100}%`;
      el.style.transform = `translate(-50%, -50%) rotate(${n.rot}deg)`;
      el.innerHTML = `<span class="postit-pin" aria-hidden="true"></span><p class="postit-note-text"></p><span class="postit-note-nick"></span>`;
      el.querySelector('.postit-note-text')!.textContent = n.text;
      el.querySelector('.postit-note-nick')!.textContent = n.nickname;
      this.board.appendChild(el);
    }
  }
}
