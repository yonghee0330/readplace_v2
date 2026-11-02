// 다른 사람·NPC 머리 위 책을 눌렀을 때: 표지·제목·저자·짧은 소개.
import { blurbForTitle } from '../avatar/bestsellers';
import type { SharedBook } from '../net/presence';
import { fetchKakaoBook } from '../reader/kakaoApi';
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
  private blurbEl: HTMLElement;
  private status: HTMLElement;
  private pending: AbortController | null = null;

  constructor() {
    const b = this.sheet.body;
    b.innerHTML = `
      <p class="book-peek-who" data-who></p>
      <div class="book-peek">
        <div class="book-peek-cover" data-cover></div>
        <div class="book-peek-meta">
          <div class="book-peek-title" data-title></div>
          <div class="book-peek-sub" data-sub></div>
        </div>
      </div>
      <p class="book-peek-blurb" data-blurb></p>
      <p class="field-note" data-status aria-live="polite"></p>
      <div class="sheet-actions">
        <button type="button" class="btn btn-primary" data-act="close">닫기</button>
      </div>`;
    this.whoEl = b.querySelector('[data-who]')!;
    this.cover = b.querySelector('[data-cover]')!;
    this.titleEl = b.querySelector('[data-title]')!;
    this.subEl = b.querySelector('[data-sub]')!;
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
    this.whoEl.textContent = `${nickname}님이 읽고 있어요`;
    this.titleEl.textContent = book.title;
    this.subEl.textContent = [book.author, book.publisher].filter(Boolean).join(' · ');
    const localBlurb = reader.blurb?.trim() || blurbForTitle(book.title);
    this.blurbEl.textContent = localBlurb || '소개를 불러오는 중…';
    this.status.textContent = '';
    this.renderCover(book.coverUrl, book.title);
    this.sheet.open();
    void this.enrich(book, localBlurb, this.pending.signal);
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

  /** 표지·소개가 비어 있으면 카카오 검색으로 보강한다. */
  private async enrich(book: SharedBook, haveBlurb: string | null, signal: AbortSignal): Promise<void> {
    if (book.coverUrl?.startsWith('http') && haveBlurb) return;
    this.status.textContent = '책 정보를 찾는 중…';
    try {
      const data = await fetchKakaoBook(book.title, book.author, book.publisher, signal);
      if (signal.aborted) return;
      if (!data.ok || !data.item) {
        if (!haveBlurb) {
          this.blurbEl.textContent = [
            book.author && `${book.author}의 작품`,
            book.publisher && `${book.publisher}에서 펴냄`,
            '서점에서 함께 읽고 있는 책이에요.',
          ].filter(Boolean).join('. ');
        }
        this.status.textContent = '';
        return;
      }
      const item = data.item;
      if (!book.author && item.author) this.subEl.textContent = [item.author, item.publisher || book.publisher].filter(Boolean).join(' · ');
      else if (item.publisher && !book.publisher) this.subEl.textContent = [book.author, item.publisher].filter(Boolean).join(' · ');
      if (!book.coverUrl && item.coverUrl?.startsWith('http')) this.renderCover(item.coverUrl, book.title);
      if (!haveBlurb) {
        this.blurbEl.textContent = item.blurb?.trim()
          || [item.author && `${item.author}의 작품`, '서점에서 함께 읽고 있는 책이에요.'].filter(Boolean).join('. ');
      }
      this.status.textContent = '';
    } catch {
      if (signal.aborted) return;
      if (!haveBlurb) {
        this.blurbEl.textContent = '서점에서 함께 읽고 있는 책이에요.';
      }
      this.status.textContent = '';
    }
  }
}
