// 책 펼치기·읽기 모드 직전: 제목으로 카카오 검색 → 목록에서 고른 뒤 확정.
// 모바일: 키보드 검색, 큰 탭 영역, 시트 본문 한 줄 스크롤(결과 중첩 스크롤 없음).
import { loadBook, saveBook, type ReadingBook } from '../reader/book';
import { searchKakaoBooks, type KakaoBookItem } from '../reader/kakaoApi';
import { Sheet } from './sheet';

export class BookSheet {
  readonly sheet = new Sheet('지금 읽는 책', 'book-sheet');
  private titleIn: HTMLInputElement;
  private searchBtn: HTMLButtonElement;
  private results: HTMLElement;
  private status: HTMLElement;
  private confirmBtn: HTMLButtonElement;
  private manualBtn: HTMLButtonElement;
  private typingTimer: number | null = null;
  private composing = false;
  private pending: AbortController | null = null;
  private onPick: ((book: ReadingBook) => void) | null = null;
  private items: KakaoBookItem[] = [];
  private selected = -1;
  private lastQuery = '';

  constructor() {
    this.sheet.el.classList.add('book-sheet');
    const b = this.sheet.body;
    b.innerHTML = `
      <p class="sheet-text">책 제목을 적으면 목록이 나와요. 눌러서 고르면 돼요.</p>
      <form class="book-search-form" data-search-form>
        <label class="field-label" for="book-title">제목</label>
        <div class="book-search-row">
          <input id="book-title" class="field-input" name="title" type="search" enterkeyhint="search" maxlength="120" required autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" placeholder="예: 데미안" />
          <button type="submit" class="btn btn-primary book-search-btn" data-act="search">검색</button>
        </div>
      </form>
      <div class="book-results" data-results role="listbox" aria-label="검색 결과" hidden></div>
      <p class="field-note" data-status aria-live="polite"></p>
      <button type="button" class="book-manual" data-act="manual" hidden></button>
      <div class="sheet-actions">
        <button type="button" class="btn" data-act="cancel">취소</button>
        <button type="button" class="btn btn-primary" data-act="confirm" disabled>이 책으로 읽기</button>
      </div>`;
    this.titleIn = b.querySelector('#book-title')!;
    this.searchBtn = b.querySelector('[data-act="search"]')!;
    this.results = b.querySelector('[data-results]')!;
    this.status = b.querySelector('[data-status]')!;
    this.confirmBtn = b.querySelector('[data-act="confirm"]')!;
    this.manualBtn = b.querySelector('[data-act="manual"]')!;
    b.querySelector('[data-act="cancel"]')!.addEventListener('click', () => this.sheet.close());
    b.querySelector('[data-search-form]')!.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.search();
    });
    this.confirmBtn.addEventListener('click', () => this.confirm());
    this.manualBtn.addEventListener('click', () => this.confirmManual());
    // 한글 조합 중에는 검색하지 않고, 조합이 끝나면 잠깐 뒤 자동 검색(검색 버튼 없이도 목록이 나온다)
    this.titleIn.addEventListener('compositionstart', () => { this.composing = true; });
    this.titleIn.addEventListener('compositionend', () => {
      this.composing = false;
      this.scheduleSearch();
    });
    this.titleIn.addEventListener('input', () => {
      if (!this.composing) this.scheduleSearch();
    });
    this.sheet.onClose = () => {
      if (this.typingTimer != null) window.clearTimeout(this.typingTimer);
      this.typingTimer = null;
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
    this.lastQuery = '';
    this.clearResults('');
    this.setBusy(false);
    this.sheet.open();
    // 시트 기본 포커스(닫기) 다음에 제목으로 — 모바일에서 바로 입력
    requestAnimationFrame(() => {
      this.titleIn.focus({ preventScroll: true });
      // 터치 기기에서는 전체 선택 핸들이 떠서 오히려 방해라 선택하지 않는다
      if (this.titleIn.value && !window.matchMedia('(pointer: coarse)').matches) this.titleIn.select();
    });
  }

  private clearResults(note: string): void {
    this.items = [];
    this.selected = -1;
    this.results.hidden = true;
    this.results.replaceChildren();
    this.confirmBtn.disabled = true;
    this.manualBtn.hidden = true;
    this.status.textContent = note;
  }

  private setBusy(on: boolean): void {
    // 입력칸은 잠그지 않는다(잠그면 모바일 키보드가 내려가고 한글 조합이 끊긴다)
    this.searchBtn.disabled = on;
    this.searchBtn.textContent = on ? '찾는 중…' : '검색';
  }

  private scheduleSearch(): void {
    if (this.typingTimer != null) window.clearTimeout(this.typingTimer);
    const q = this.titleIn.value.trim();
    if (q === this.lastQuery) return;
    if ([...q].length < 2) {
      this.pending?.abort();
      this.clearResults('');
      this.lastQuery = '';
      return;
    }
    this.typingTimer = window.setTimeout(() => void this.search(true), 650);
  }

  private async search(auto = false): Promise<void> {
    if (this.typingTimer != null) window.clearTimeout(this.typingTimer);
    this.typingTimer = null;
    const title = this.titleIn.value.trim();
    if (!title) {
      this.status.textContent = '제목을 적어 주세요.';
      this.titleIn.focus();
      return;
    }
    this.pending?.abort();
    this.pending = new AbortController();
    const signal = this.pending.signal;
    this.lastQuery = title;
    this.setBusy(true);
    this.clearResults('찾는 중…');
    // 직접 검색 버튼을 눌렀을 때만 키보드를 내려 결과가 보이게. 자동 검색은 계속 입력할 수 있게 둔다.
    if (!auto) this.titleIn.blur();
    try {
      const data = await searchKakaoBooks(title, signal);
      if (signal.aborted) return;
      if (!data.ok) {
        this.status.textContent = data.message || '검색에 실패했어요. 아래 버튼으로 이 제목 그대로 읽을 수 있어요.';
        this.showManual(title);
        this.setBusy(false);
        return;
      }
      if (!data.items.length) {
        this.status.textContent = '검색 결과가 없어요. 제목을 조금 바꿔 보거나, 아래 버튼으로 이 제목 그대로 읽을 수 있어요.';
        this.showManual(title);
        this.setBusy(false);
        return;
      }
      this.items = data.items;
      this.renderResults();
      this.status.textContent = `${data.items.length}권을 찾았어요. 눌러서 골라 주세요.`;
      this.showManual(title);
      this.setBusy(false);
      // 자동 검색 중엔 입력창 위치를 유지하고, 직접 검색일 때만 결과로 스크롤
      if (!auto) {
        requestAnimationFrame(() => {
          this.results.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
      }
    } catch (e) {
      if (signal.aborted) return;
      this.status.textContent = e instanceof Error ? e.message : '검색에 실패했어요.';
      this.showManual(title);
      this.setBusy(false);
    }
  }

  /** 검색으로 못 찾거나 실패했을 때, 적은 제목 그대로 읽을 수 있는 길. */
  private showManual(title: string): void {
    this.manualBtn.hidden = false;
    this.manualBtn.textContent = `검색 없이 「${title.length > 24 ? `${title.slice(0, 24)}…` : title}」(으)로 읽기`;
  }

  private confirmManual(): void {
    const title = this.titleIn.value.trim();
    if (!title) return;
    this.finish({ title, author: '', publisher: '', coverUrl: null });
  }

  private renderResults(): void {
    this.results.replaceChildren();
    this.results.hidden = false;
    this.items.forEach((item, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'book-result';
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', 'false');

      const cover = document.createElement('div');
      cover.className = 'book-result-cover';
      if (item.coverUrl) {
        const img = document.createElement('img');
        img.src = item.coverUrl;
        img.alt = '';
        img.decoding = 'async';
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.draggable = false;
        img.addEventListener('error', () => {
          cover.textContent = '표지';
          cover.classList.add('is-empty');
          img.remove();
        });
        cover.appendChild(img);
      } else {
        cover.textContent = '표지';
        cover.classList.add('is-empty');
      }

      const meta = document.createElement('div');
      meta.className = 'book-result-meta';
      const t = document.createElement('div');
      t.className = 'book-result-title';
      t.textContent = item.title;
      const s = document.createElement('div');
      s.className = 'book-result-sub';
      s.textContent = [item.author, item.publisher].filter(Boolean).join(' · ') || '저자 정보 없음';
      meta.append(t, s);

      btn.append(cover, meta);
      btn.addEventListener('click', () => this.select(i));
      this.results.appendChild(btn);
    });
  }

  private select(index: number): void {
    this.selected = index;
    [...this.results.children].forEach((el, i) => {
      const btn = el as HTMLButtonElement;
      const on = i === index;
      btn.classList.toggle('is-selected', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    this.confirmBtn.disabled = false;
    this.status.textContent = '골랐어요. 아래에서 「이 책으로 읽기」를 눌러 주세요.';
    // 모바일에서 포커스 이동으로 스크롤이 튀지 않게, 버튼만 보이게
    requestAnimationFrame(() => {
      this.confirmBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  private confirm(): void {
    const item = this.items[this.selected];
    if (!item) {
      this.status.textContent = '목록에서 책을 골라 주세요.';
      return;
    }
    this.finish({
      title: item.title,
      author: item.author,
      publisher: item.publisher,
      coverUrl: item.coverUrl || null,
    });
  }

  private finish(book: ReadingBook): void {
    saveBook(book);
    const cb = this.onPick;
    this.onPick = null;
    this.sheet.close();
    cb?.(book);
  }
}
