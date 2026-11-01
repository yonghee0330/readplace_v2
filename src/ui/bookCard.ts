// 지금 읽는 책 표지·제목·저자·출판사 카드. 책 펼치기·읽기 모드에서 보인다.
import type { ReadingBook } from '../reader/book';

export class BookCard {
  readonly el: HTMLElement;
  private cover: HTMLElement;
  private title: HTMLElement;
  private meta: HTMLElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('aside');
    this.el.className = 'book-card';
    this.el.hidden = true;
    this.el.setAttribute('aria-label', '지금 읽는 책');
    this.el.innerHTML = `
      <div class="book-card-cover" data-cover></div>
      <div class="book-card-body">
        <div class="book-card-title" data-title></div>
        <div class="book-card-meta" data-meta></div>
      </div>`;
    parent.appendChild(this.el);
    this.cover = this.el.querySelector('[data-cover]')!;
    this.title = this.el.querySelector('[data-title]')!;
    this.meta = this.el.querySelector('[data-meta]')!;
  }

  show(book: ReadingBook, focus = false): void {
    this.el.classList.toggle('is-focus', focus);
    this.title.textContent = book.title;
    this.meta.textContent = [book.author, book.publisher].filter(Boolean).join(' · ') || '지금 읽는 중';
    this.cover.replaceChildren();
    this.cover.classList.remove('is-empty');
    if (book.coverUrl) {
      const img = document.createElement('img');
      img.src = book.coverUrl;
      img.alt = `${book.title} 표지`;
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => this.placeholder());
      this.cover.appendChild(img);
    } else {
      this.placeholder();
    }
    this.el.hidden = false;
  }

  hide(): void {
    this.el.hidden = true;
    this.el.classList.remove('is-focus');
  }

  private placeholder(): void {
    this.cover.replaceChildren();
    this.cover.classList.add('is-empty');
    this.cover.textContent = '책';
  }
}
