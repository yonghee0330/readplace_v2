// 책 펼치기·읽기 모드 직전: 제목·저자·출판사를 받고 표지를 찾아 보여 준 뒤 확정한다.
import { lookupCover, loadBook, sameBookMeta, saveBook, type ReadingBook } from '../reader/book';
import { Sheet } from './sheet';

export class BookSheet {
  readonly sheet = new Sheet('지금 읽는 책', 'book-sheet');
  private titleIn: HTMLInputElement;
  private authorIn: HTMLInputElement;
  private pubIn: HTMLInputElement;
  private preview: HTMLElement;
  private status: HTMLElement;
  private confirmBtn: HTMLButtonElement;
  private pending: AbortController | null = null;
  private onPick: ((book: ReadingBook) => void) | null = null;

  constructor() {
    const b = this.sheet.body;
    b.innerHTML = `
      <p class="sheet-text">제목·저자·출판사를 넣으면 카카오 책 검색으로 표지를 찾아 보여 줘요. 책 본문은 다루지 않아요.</p>
      <label class="field">
        <span class="field-label">제목</span>
        <input id="book-title" class="field-input" type="text" maxlength="120" required autocomplete="off" placeholder="예: 데미안" />
      </label>
      <label class="field">
        <span class="field-label">저자</span>
        <input id="book-author" class="field-input" type="text" maxlength="80" autocomplete="off" placeholder="예: 헤르만 헤세" />
      </label>
      <label class="field">
        <span class="field-label">출판사</span>
        <input id="book-publisher" class="field-input" type="text" maxlength="80" autocomplete="off" placeholder="예: 민음사" />
      </label>
      <div class="book-preview" data-preview hidden>
        <div class="book-preview-cover" data-cover></div>
        <div class="book-preview-meta">
          <div class="book-preview-title" data-ptitle></div>
          <div class="book-preview-sub" data-psub></div>
        </div>
      </div>
      <p class="field-note" data-status aria-live="polite"></p>
      <div class="sheet-actions">
        <button type="button" class="btn" data-act="cancel">취소</button>
        <button type="button" class="btn btn-primary" data-act="confirm">이 책으로 읽기</button>
      </div>`;
    this.titleIn = b.querySelector('#book-title')!;
    this.authorIn = b.querySelector('#book-author')!;
    this.pubIn = b.querySelector('#book-publisher')!;
    this.preview = b.querySelector('[data-preview]')!;
    this.status = b.querySelector('[data-status]')!;
    this.confirmBtn = b.querySelector('[data-act="confirm"]')!;
    b.querySelector('[data-act="cancel"]')!.addEventListener('click', () => this.sheet.close());
    this.confirmBtn.addEventListener('click', () => void this.confirm());
    for (const el of [this.titleIn, this.authorIn, this.pubIn]) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          void this.confirm();
        }
      });
    }
    this.sheet.onClose = () => {
      this.pending?.abort();
      this.pending = null;
      this.onPick = null;
      this.setBusy(false);
    };
  }

  /** 시트를 열고, 확정되면 onPick을 한 번 부른다. */
  open(onPick: (book: ReadingBook) => void): void {
    this.onPick = onPick;
    const saved = loadBook();
    this.titleIn.value = saved?.title ?? '';
    this.authorIn.value = saved?.author ?? '';
    this.pubIn.value = saved?.publisher ?? '';
    this.status.textContent = '';
    this.renderPreview(saved);
    this.setBusy(false);
    this.sheet.open();
    this.titleIn.focus();
    this.titleIn.select();
  }

  private renderPreview(book: ReadingBook | null): void {
    if (!book?.title) {
      this.preview.hidden = true;
      return;
    }
    this.preview.hidden = false;
    const cover = this.preview.querySelector<HTMLElement>('[data-cover]')!;
    const title = this.preview.querySelector('[data-ptitle]')!;
    const sub = this.preview.querySelector('[data-psub]')!;
    title.textContent = book.title;
    sub.textContent = [book.author, book.publisher].filter(Boolean).join(' · ');
    cover.replaceChildren();
    if (book.coverUrl) {
      const img = document.createElement('img');
      img.src = book.coverUrl;
      img.alt = `${book.title} 표지`;
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => {
        cover.textContent = '표지';
        cover.classList.add('is-empty');
      });
      cover.classList.remove('is-empty');
      cover.appendChild(img);
    } else {
      cover.textContent = '표지';
      cover.classList.add('is-empty');
    }
  }

  private setBusy(on: boolean): void {
    this.confirmBtn.disabled = on;
    this.titleIn.disabled = on;
    this.authorIn.disabled = on;
    this.pubIn.disabled = on;
    this.confirmBtn.textContent = on ? '표지 찾는 중…' : '이 책으로 읽기';
  }

  private async confirm(): Promise<void> {
    const title = this.titleIn.value.trim();
    if (!title) {
      this.status.textContent = '제목을 적어 주세요.';
      this.titleIn.focus();
      return;
    }
    const draft: ReadingBook = {
      title,
      author: this.authorIn.value.trim(),
      publisher: this.pubIn.value.trim(),
      coverUrl: null,
    };
    const saved = loadBook();
    // 같은 책이고 온라인 표지(http)가 있을 때만 재검색 생략. data: 임시 표지는 다시 찾는다.
    if (saved && sameBookMeta(saved, draft) && saved.coverUrl?.startsWith('http')) {
      this.finish(saved);
      return;
    }
    this.pending?.abort();
    this.pending = new AbortController();
    const signal = this.pending.signal;
    this.setBusy(true);
    this.status.textContent = '온라인 서점에서 표지를 찾는 중…';
    let cover: string | null = null;
    try {
      cover = await lookupCover(draft.title, draft.author, draft.publisher, signal);
    } catch {
      cover = null;
    }
    if (signal.aborted) return;
    draft.coverUrl = cover;
    this.renderPreview(draft);
    this.status.textContent = cover?.startsWith('http')
      ? '표지를 찾았어요.'
      : '서점에서 표지를 못 찾아 제목으로 표지를 만들었어요.';
    this.setBusy(false);
    this.finish(draft);
  }

  private finish(book: ReadingBook): void {
    saveBook(book);
    const cb = this.onPick;
    this.onPick = null;
    this.sheet.close();
    cb?.(book);
  }
}
