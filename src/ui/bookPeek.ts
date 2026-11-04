// 다른 사람·NPC 머리 위 책을 눌렀을 때: 표지·제목·저자·출판사·연도·목차·추천 소개.
import { blurbForTitle, findBestseller, tocForTitle } from '../avatar/bestsellers';
import type { SharedBook } from '../net/presence';
import { fetchKakaoBook, formatPublishYears } from '../reader/kakaoApi';
import { Sheet } from './sheet';

export interface PeekReader {
  nickname: string;
  book: SharedBook;
  blurb?: string | null;
}

export class BookPeekSheet {
  readonly sheet = new Sheet('읽고 있는 책', 'book-peek');
  private cover: HTMLElement;
  private titleEl: HTMLElement;
  private subEl: HTMLElement;
  private whoEl: HTMLElement;
  private tocEl: HTMLElement;
  private tocList: HTMLElement;
  private blurbEl: HTMLElement;
  private status: HTMLElement;
  private pending: AbortController | null = null;

  constructor() {
    this.sheet.el.classList.add('book-peek-sheet');
    const b = this.sheet.body;
    b.innerHTML = `
      <p class="book-peek-who" data-who></p>
      <div class="book-peek">
        <div class="book-peek-cover" data-cover></div>
        <div class="book-peek-meta">
          <div class="book-peek-title" data-title></div>
          <div class="book-peek-sub" data-sub></div>
          <div class="book-peek-toc" data-toc hidden>
            <p class="book-peek-toc-label">목차</p>
            <ul class="book-peek-toc-list" data-toc-list></ul>
          </div>
        </div>
      </div>
      <div class="book-peek-intro">
        <p class="book-peek-intro-label">책 소개</p>
        <p class="book-peek-blurb" data-blurb></p>
      </div>
      <p class="field-note" data-status aria-live="polite"></p>
      <div class="sheet-actions">
        <button type="button" class="btn btn-primary" data-act="close">닫기</button>
      </div>`;
    this.whoEl = b.querySelector('[data-who]')!;
    this.cover = b.querySelector('[data-cover]')!;
    this.titleEl = b.querySelector('[data-title]')!;
    this.subEl = b.querySelector('[data-sub]')!;
    this.tocEl = b.querySelector('[data-toc]')!;
    this.tocList = b.querySelector('[data-toc-list]')!;
    this.blurbEl = b.querySelector('[data-blurb]')!;
    this.status = b.querySelector('[data-status]')!;
    b.querySelector('[data-act="close"]')!.addEventListener('click', () => this.sheet.close());
    this.sheet.onClose = () => {
      this.pending?.abort();
      this.pending = null;
    };
  }

  open(reader: PeekReader): void {
    this.pending?.abort();
    this.pending = new AbortController();
    const { book, nickname } = reader;
    const local = findBestseller(book.title);
    this.whoEl.textContent = `${nickname}님이 읽고 있어요`;
    this.titleEl.textContent = book.title;
    this.setSub(book.author, book.publisher, local?.year ?? null, local?.originalYear ?? null);
    this.setToc(tocForTitle(book.title));
    const localBlurb = reader.blurb?.trim() || blurbForTitle(book.title);
    this.blurbEl.textContent = localBlurb || '소개를 불러오는 중…';
    this.status.textContent = '';
    this.renderCover(book.coverUrl, book.title);
    this.sheet.open();
    void this.enrich(
      book,
      localBlurb,
      local?.year ?? null,
      local?.originalYear ?? null,
      this.pending.signal,
    );
  }

  private setSub(
    author: string,
    publisher: string,
    year: number | null,
    originalYear: number | null,
  ): void {
    const years = formatPublishYears(year, originalYear);
    const parts = [author, publisher, years].filter(Boolean);
    this.subEl.textContent = parts.join(' · ') || '정보 없음';
  }

  private setToc(items: string[]): void {
    this.tocList.replaceChildren();
    if (!items.length) {
      this.tocEl.hidden = true;
      return;
    }
    this.tocEl.hidden = false;
    for (const line of items.slice(0, 6)) {
      const li = document.createElement('li');
      li.textContent = line;
      this.tocList.appendChild(li);
    }
  }

  private renderCover(url: string | null, title: string): void {
    this.cover.replaceChildren();
    this.cover.classList.remove('is-empty');
    if (url?.startsWith('http')) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = `${title} 표지`;
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => {
        this.cover.replaceChildren();
        this.cover.textContent = '표지';
        this.cover.classList.add('is-empty');
      });
      this.cover.appendChild(img);
    } else {
      this.cover.textContent = '표지';
      this.cover.classList.add('is-empty');
    }
  }

  /** 카카오로 표지·출간연도·긴 소개를 보강. 목차는 로컬 베스트셀러 데이터를 유지. */
  private async enrich(
    book: SharedBook,
    haveBlurb: string | null,
    localYear: number | null,
    originalYear: number | null,
    signal: AbortSignal,
  ): Promise<void> {
    this.status.textContent = '책 정보를 찾는 중…';
    try {
      const data = await fetchKakaoBook(book.title, book.author, book.publisher, signal);
      if (signal.aborted) return;
      if (!data.ok || !data.item) {
        if (!haveBlurb) {
          this.blurbEl.textContent = [
            book.author && `${book.author}의 작품`,
            book.publisher && `${book.publisher}에서 펴냄`,
            '서점에서 함께 읽고 있는 책이에요. 표지를 눌러 본 순간부터, 이미 그 책으로 하루가 조금 달라집니다.',
          ].filter(Boolean).join(' ');
        }
        this.status.textContent = '';
        return;
      }
      const item = data.item;
      const author = book.author || item.author;
      const publisher = book.publisher || item.publisher;
      this.setSub(author, publisher, item.year ?? localYear, originalYear);
      if (!book.coverUrl && item.coverUrl?.startsWith('http')) this.renderCover(item.coverUrl, book.title);
      const kakaoBlurb = item.blurb?.trim() || '';
      // 카카오 소개가 더 길면 우선, 아니면 로컬 추천문을 유지
      if (kakaoBlurb && (!haveBlurb || kakaoBlurb.length >= haveBlurb.length * 0.8)) {
        this.blurbEl.textContent = kakaoBlurb;
      } else if (!haveBlurb) {
        this.blurbEl.textContent = [
          item.author && `${item.author}의 작품`,
          '서점에서 함께 읽고 있는 책이에요. 한 장만 넘겨 봐도, 오늘의 공기가 조금 달라질 거예요.',
        ].filter(Boolean).join('. ');
      }
      this.status.textContent = '';
    } catch {
      if (signal.aborted) return;
      if (!haveBlurb) {
        this.blurbEl.textContent = '서점에서 함께 읽고 있는 책이에요. 표지 너머의 이야기가 당신을 기다립니다.';
      }
      this.status.textContent = '';
    }
  }
}
