// 가오픈 포스트잇 보드 확대 UI: 색·모양 고르고 짧게 써 보드에 붙인다. 내 글은 수정·삭제.
import {
  POSTIT_COLORS, POSTIT_MAX_LEN, POSTIT_SHAPES, colorHex, isPostitMine,
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
  private color: PostitColor = 'yellow';
  private shape: PostitShape = 'square';
  private placing = false;
  private editingId: string | null = null;
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
            <p class="postit-wall-lead">인사 · 바람 · 제보를 남겨 두면 보드에 남아요. 내가 붙인 쪽지는 눌러 고칠 수 있어요.</p>
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
      if (this.editingId) {
        void this.saveEdit();
        return;
      }
      this.setPlacing(true);
    });
    this.cancelBtn.addEventListener('click', () => {
      if (this.editingId) this.cancelEdit();
      else this.setPlacing(false);
    });
    this.board.addEventListener('pointerdown', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-note-act]')) return;
      if (target.closest('.postit-note:not(.postit-ghost)')) return;
      if (!this.placing) {
        if (this.editingId) return;
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
    this.renderNotes(this.store.list());
    this.unsub = this.store.onChange((notes) => {
      if (this.active) this.renderNotes(notes);
    });
    this.cancelEdit();
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
    this.cancelEdit();
    this.setPlacing(false);
    this.el.classList.remove('is-in');
    this.el.hidden = true;
    this.unsub?.();
    this.unsub = null;
  }

  private who() {
    return { authorId: this.getAuthorId(), nickname: this.getNickname() };
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
      nickname: this.getNickname(),
      authorId: this.getAuthorId(),
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
    this.hint.textContent = '붙였어요! 내 쪽지는 눌러서 고치거나 지울 수 있어요.';
    this.input.focus();
  }

  private beginEdit(note: PostitNote): void {
    this.setPlacing(false);
    this.editingId = note.id;
    this.color = note.color;
    this.shape = note.shape;
    this.input.value = note.text;
    this.countEl.textContent = String(note.text.length);
    this.syncPicks();
    this.syncGhostStyle();
    this.cancelBtn.hidden = false;
    this.readyBtn.hidden = false;
    this.readyBtn.textContent = '수정 저장';
    this.hint.textContent = '내용을 고친 뒤 「수정 저장」을 누르세요. 취소를 누르면 되돌립니다.';
    this.composer.classList.add('is-editing');
    this.input.focus();
  }

  private cancelEdit(): void {
    if (!this.editingId) return;
    this.editingId = null;
    this.composer.classList.remove('is-editing');
    this.readyBtn.textContent = '붙이기';
    this.cancelBtn.hidden = true;
    this.input.value = '';
    this.countEl.textContent = '0';
    this.hint.textContent = '색·모양을 고르고 메시지를 적은 뒤, 「붙이기」를 누르세요';
  }

  private async saveEdit(): Promise<void> {
    const id = this.editingId;
    if (!id) return;
    const text = this.input.value.trim().slice(0, POSTIT_MAX_LEN);
    if (!text) {
      this.hint.textContent = '메시지를 비울 수 없어요. 지우려면 삭제하세요.';
      return;
    }
    this.readyBtn.disabled = true;
    const note = await this.store.update(id, { text, color: this.color, shape: this.shape }, this.who());
    this.readyBtn.disabled = false;
    if (!note) {
      this.hint.textContent = '이 쪽지는 더 이상 고칠 수 없어요';
      this.cancelEdit();
      return;
    }
    this.cancelEdit();
    this.hint.textContent = '수정했어요';
    this.input.focus();
  }

  private async deleteNote(id: string): Promise<void> {
    if (!window.confirm('이 쪽지를 지울까요?')) return;
    const ok = await this.store.remove(id, this.who());
    if (!ok) {
      this.hint.textContent = '이 쪽지는 지울 수 없어요';
      return;
    }
    if (this.editingId === id) this.cancelEdit();
    this.hint.textContent = '쪽지를 지웠어요';
  }

  private setPlacing(on: boolean): void {
    if (on) this.cancelEdit();
    this.placing = on;
    this.board.classList.toggle('is-placing', on);
    this.composer.classList.toggle('is-placing', on);
    this.cancelBtn.hidden = !on && !this.editingId;
    this.readyBtn.hidden = on;
    if (!this.editingId) this.readyBtn.textContent = '붙이기';
    this.ghost.hidden = true;
    if (on) {
      this.syncGhostStyle();
      this.hint.textContent = '보드에서 붙이고 싶은 곳을 눌러 주세요';
      this.board.focus({ preventScroll: true });
    } else if (!this.editingId) {
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
    const who = this.who();
    for (const n of notes) {
      const mine = isPostitMine(n, who.authorId, who.nickname);
      const el = document.createElement('article');
      el.className = `postit-note shape-${n.shape}${mine ? ' is-mine' : ''}${this.editingId === n.id ? ' is-editing' : ''}`;
      el.style.setProperty('--c', colorHex(n.color));
      el.style.left = `${n.x * 100}%`;
      el.style.top = `${n.y * 100}%`;
      el.style.transform = `translate(-50%, -50%) rotate(${n.rot}deg)`;
      el.dataset.id = n.id;
      el.innerHTML = `
        <span class="postit-pin" aria-hidden="true"></span>
        <p class="postit-note-text"></p>
        <span class="postit-note-nick"></span>
        ${mine ? `<div class="postit-note-acts">
          <button type="button" class="postit-note-act" data-note-act="edit" aria-label="쪽지 수정">수정</button>
          <button type="button" class="postit-note-act" data-note-act="del" aria-label="쪽지 삭제">삭제</button>
        </div>` : ''}`;
      el.querySelector('.postit-note-text')!.textContent = n.text;
      el.querySelector('.postit-note-nick')!.textContent = mine ? `${n.nickname} · 나` : n.nickname;
      if (mine) {
        el.querySelector('[data-note-act="edit"]')!.addEventListener('click', (e) => {
          e.stopPropagation();
          this.beginEdit(n);
        });
        el.querySelector('[data-note-act="del"]')!.addEventListener('click', (e) => {
          e.stopPropagation();
          void this.deleteNote(n.id);
        });
        el.addEventListener('click', (e) => {
          if ((e.target as HTMLElement).closest('[data-note-act]')) return;
          if (this.placing) return;
          this.beginEdit(n);
        });
      }
      this.board.appendChild(el);
    }
  }
}
