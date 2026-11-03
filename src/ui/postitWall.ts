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
  private store: PostitStore;
  private nickname: string;
  private color: PostitColor = 'yellow';
  private shape: PostitShape = 'square';
  private placing = false;
  private onExit: () => void;
  private unsub: (() => void) | null = null;

  constructor(parent: HTMLElement, store: PostitStore, nickname: () => string, onExit: () => void) {
    this.store = store;
    this.nickname = nickname();
    this.onExit = onExit;
    this.el = document.createElement('div');
    this.el.className = 'postit-wall';
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-label', '가오픈 포스트잇 보드');
    this.el.innerHTML = `
      <div class="postit-wall-dim" aria-hidden="true"></div>
      <div class="postit-wall-stage">
        <header class="postit-wall-head">
          <div>
            <p class="postit-wall-kicker">비북스-M 가오픈</p>
            <h2 class="postit-wall-title">포스트잇 월</h2>
            <p class="postit-wall-lead">인사 · 바람 · 버그 제보를 짧게 남겨 주세요</p>
          </div>
          <button type="button" class="pill postit-wall-exit" aria-label="보드에서 돌아가기">돌아가기</button>
        </header>
        <div class="postit-board" data-board tabindex="0" aria-label="포스트잇 보드. 작성 후 원하는 곳을 눌러 붙입니다."></div>
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
            <p class="postit-hint" data-hint>색·모양을 고르고 메시지를 적은 뒤, 보드를 눌러 붙이세요</p>
            <button type="button" class="btn btn-primary" data-act="ready">붙일 준비</button>
          </div>
        </div>
      </div>`;
    parent.appendChild(this.el);
    this.board = this.el.querySelector('[data-board]')!;
    this.composer = this.el.querySelector('.postit-composer')!;
    this.input = this.el.querySelector('.postit-input')!;
    this.countEl = this.el.querySelector('[data-count]')!;
    this.hint = this.el.querySelector('[data-hint]')!;

    this.el.querySelector('.postit-wall-exit')!.addEventListener('click', () => this.onExit());
    this.el.querySelector('.postit-wall-dim')!.addEventListener('click', () => this.onExit());

    this.el.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((btn) =>
      btn.addEventListener('click', () => {
        this.color = btn.dataset.color as PostitColor;
        this.syncPicks();
      }),
    );
    this.el.querySelectorAll<HTMLButtonElement>('[data-shape]').forEach((btn) =>
      btn.addEventListener('click', () => {
        this.shape = btn.dataset.shape as PostitShape;
        this.syncPicks();
      }),
    );
    this.input.addEventListener('input', () => {
      this.countEl.textContent = String(this.input.value.length);
      if (this.placing && !this.input.value.trim()) this.setPlacing(false);
    });
    this.el.querySelector('[data-act="ready"]')!.addEventListener('click', () => {
      const t = this.input.value.trim();
      if (!t) {
        this.hint.textContent = '메시지를 먼저 적어 주세요';
        this.input.focus();
        return;
      }
      this.nickname = nickname();
      this.setPlacing(true);
    });
    this.board.addEventListener('pointerdown', (e) => {
      if (!this.placing) return;
      e.preventDefault();
      const rect = this.board.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      void this.stick(x, y);
    });
    this.syncPicks();
  }

  enter(): void {
    if (this.active) return;
    this.active = true;
    this.el.hidden = false;
    this.renderNotes(this.store.list());
    this.unsub = this.store.onChange((notes) => {
      if (this.active) this.renderNotes(notes);
    });
    requestAnimationFrame(() => this.el.classList.add('is-in'));
    (this.el.querySelector('.postit-wall-exit') as HTMLElement).focus();
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
    const note = await this.store.add({
      text,
      color: this.color,
      shape: this.shape,
      x,
      y,
      nickname: this.nickname,
    });
    if (!note) {
      this.hint.textContent = '보드가 가득 찼어요. 조금만 기다려 주세요';
      this.setPlacing(false);
      return;
    }
    this.input.value = '';
    this.countEl.textContent = '0';
    this.setPlacing(false);
    this.hint.textContent = '붙였어요! 또 남기고 싶으면 다시 적어 주세요';
  }

  private setPlacing(on: boolean): void {
    this.placing = on;
    this.board.classList.toggle('is-placing', on);
    this.composer.classList.toggle('is-placing', on);
    this.hint.textContent = on
      ? '보드에서 붙이고 싶은 곳을 눌러 주세요'
      : '색·모양을 고르고 메시지를 적은 뒤, 보드를 눌러 붙이세요';
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
    this.board.replaceChildren();
    for (const n of notes) {
      const el = document.createElement('article');
      el.className = `postit-note shape-${n.shape}`;
      el.style.setProperty('--c', colorHex(n.color));
      el.style.left = `${n.x * 100}%`;
      el.style.top = `${n.y * 100}%`;
      el.style.transform = `translate(-50%, -50%) rotate(${n.rot}deg)`;
      el.innerHTML = `<p class="postit-note-text"></p><span class="postit-note-nick"></span>`;
      el.querySelector('.postit-note-text')!.textContent = n.text;
      el.querySelector('.postit-note-nick')!.textContent = n.nickname;
      this.board.appendChild(el);
    }
  }
}
