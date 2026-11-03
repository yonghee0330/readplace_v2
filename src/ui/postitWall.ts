// 가오픈 포스트잇 보드 확대 UI: 색·모양 고르고 짧게 써 보드에 붙인다.
import {
  POSTIT_COLORS, POSTIT_MAX_LEN, POSTIT_SHAPES, colorHex,
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
  private store: PostitStore;
  private nickname: string;
  private color: PostitColor = 'yellow';
  private shape: PostitShape = 'square';
  private placing = false;
  private onExit: () => void;
  private unsub: (() => void) | null = null;
  private getNickname: () => string;

  constructor(parent: HTMLElement, store: PostitStore, nickname: () => string, onExit: () => void) {
    this.store = store;
    this.getNickname = nickname;
    this.nickname = nickname();
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
            <p class="postit-wall-lead">인사 · 바람 · 제보를 남겨 두면 보드에 남아요</p>
          </div>
          <button type="button" class="pill postit-wall-exit" aria-label="보드에서 돌아가기">돌아가기</button>
        </header>
        <div class="postit-board" data-board tabindex="0" aria-label="포스트잇 보드. 붙이기를 누른 뒤 원하는 곳을 눌러 붙입니다.">
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

    this.el.querySelector('.postit-wall-exit')!.addEventListener('click', () => this.onExit());
    this.el.querySelector('.postit-wall-dim')!.addEventListener('click', () => this.onExit());

    this.el.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((btn) =>
      btn.addEventListener('click', () => {
        this.color = btn.dataset.color as PostitColor;
        this.syncPicks();
        this.syncGhostStyle();
      }),
    );
    this.el.querySelectorAll<HTMLButtonElement>('[data-shape]').forEach((btn) =>
      btn.addEventListener('click', () => {
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
      const t = this.input.value.trim();
      if (!t) {
        this.hint.textContent = '메시지를 먼저 적어 주세요';
        this.input.focus();
        return;
      }
      this.nickname = this.getNickname();
      this.setPlacing(true);
    });
    this.cancelBtn.addEventListener('click', () => this.setPlacing(false));
    this.board.addEventListener('pointerdown', (e) => {
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
      if (!this.placing) return;
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

  enter(): void {
    if (this.active) return;
    this.active = true;
    this.el.hidden = false;
    this.nickname = this.getNickname();
    this.renderNotes(this.store.list());
    this.unsub = this.store.onChange((notes) => {
      if (this.active) this.renderNotes(notes);
    });
    this.setPlacing(false);
    this.hint.textContent = '색·모양을 고르고 메시지를 적은 뒤, 「붙이기」를 누르세요';
    requestAnimationFrame(() => {
      this.el.classList.add('is-in');
      this.input.focus();
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

  private async stick(x: number, y: number): Promise<void> {
    const text = this.input.value.trim().slice(0, POSTIT_MAX_LEN);
    if (!text) return;
    this.readyBtn.disabled = true;
    const note = await this.store.add({
      text,
      color: this.color,
      shape: this.shape,
      x,
      y,
      nickname: this.nickname,
    });
    this.readyBtn.disabled = false;
    if (!note) {
      this.hint.textContent = '보드가 가득 찼어요. 조금만 기다려 주세요';
      this.setPlacing(false);
      return;
    }
    this.input.value = '';
    this.countEl.textContent = '0';
    this.setPlacing(false);
    this.hint.textContent = '붙였어요! 기록은 이 보드에 남아요. 또 남기려면 다시 적어 주세요';
    this.input.focus();
  }

  private setPlacing(on: boolean): void {
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
    } else {
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
    // 고스트는 유지하고 노트만 갈아끼운다
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
