// 큐레이션 매대의 표지를 눌렀을 때: 큰 표지 + 제목·저자·0.1평 칸 + 큐레이터 한마디 + 책 소개.
// 이전/다음(또는 ←/→ 키)으로 매대의 책을 차례로 둘러본다.
import { AWARD_SHELF, curationCoverUrl } from '../curation/awardShelf';
import { Sheet } from './sheet';

export class CurationSheet {
  readonly sheet = new Sheet(AWARD_SHELF.title, 'curation-sheet');
  private index = 0;
  private img: HTMLImageElement;
  private countEl: HTMLElement;
  private titleEl: HTMLElement;
  private subEl: HTMLElement;
  private shelfEl: HTMLElement;
  private pickEl: HTMLElement;
  private introEl: HTMLElement;
  private extraEl: HTMLElement;
  private tagsEl: HTMLElement;
  private linksEl: HTMLElement;

  constructor() {
    this.sheet.el.classList.add('curation-sheet');
    const b = this.sheet.body;
    b.innerHTML = `
      <div class="curation-book">
        <div class="curation-cover"><img alt="" decoding="async" data-img /></div>
        <div class="curation-meta">
          <p class="curation-count" data-count></p>
          <h3 class="curation-title" data-title></h3>
          <p class="curation-sub" data-sub></p>
          <p class="curation-shelf" data-shelf></p>
        </div>
      </div>
      <div class="curation-memo">
        <p class="curation-memo-label">큐레이터 한마디</p>
        <p class="curation-pick" data-pick></p>
      </div>
      <p class="curation-intro" data-intro></p>
      <p class="curation-extra" data-extra hidden></p>
      <div class="curation-links" data-links hidden></div>
      <p class="curation-tags" data-tags></p>
      <p class="curation-note">${AWARD_SHELF.note}</p>
      <div class="sheet-actions curation-nav">
        <button type="button" class="btn" data-act="prev" aria-label="이전 책">‹ 이전</button>
        <button type="button" class="btn" data-act="next" aria-label="다음 책">다음 ›</button>
      </div>`;
    this.img = b.querySelector('[data-img]')!;
    this.countEl = b.querySelector('[data-count]')!;
    this.titleEl = b.querySelector('[data-title]')!;
    this.subEl = b.querySelector('[data-sub]')!;
    this.shelfEl = b.querySelector('[data-shelf]')!;
    this.pickEl = b.querySelector('[data-pick]')!;
    this.introEl = b.querySelector('[data-intro]')!;
    this.extraEl = b.querySelector('[data-extra]')!;
    this.tagsEl = b.querySelector('[data-tags]')!;
    this.linksEl = b.querySelector('[data-links]')!;
    b.querySelector('[data-act="prev"]')!.addEventListener('click', () => this.show(this.index - 1));
    b.querySelector('[data-act="next"]')!.addEventListener('click', () => this.show(this.index + 1));
    this.sheet.el.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.show(this.index - 1);
      if (e.key === 'ArrowRight') this.show(this.index + 1);
    });
  }

  get isOpen(): boolean {
    return this.sheet.isOpen;
  }

  open(index: number): void {
    this.show(index);
    this.sheet.open();
  }

  private show(i: number): void {
    const n = AWARD_SHELF.books.length;
    this.index = ((i % n) + n) % n;
    const b = AWARD_SHELF.books[this.index];
    this.img.src = curationCoverUrl(b.no);
    this.img.alt = `${b.title} 표지`;
    this.countEl.textContent = `후보작 ${this.index + 1} / ${n}`;
    this.titleEl.textContent = b.title;
    this.subEl.textContent = b.author;
    // 0.1평 칸 번호(A-14 등)가 있을 때만 '0.1평서점'을 붙인다
    this.shelfEl.textContent = /^[A-Z]-\d/.test(b.shelf) ? `0.1평서점 ${b.shelf}` : b.shelf;
    this.pickEl.textContent = b.pick;
    this.introEl.textContent = b.intro;
    this.extraEl.hidden = !b.extra;
    this.extraEl.textContent = b.extra ?? '';
    this.tagsEl.textContent = b.tags.map((t) => `#${t}`).join(' ');
    // 점주·작가 인스타그램 버튼(새 창). 계정이 없으면 숨김
    this.linksEl.replaceChildren(...(b.instagram ?? []).map((l) => {
      const a = document.createElement('a');
      a.className = 'curation-ig';
      a.href = l.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = `인스타그램 @${l.handle} ↗`;
      a.setAttribute('aria-label', `${b.title} 점주·작가 인스타그램 @${l.handle} 열기`);
      return a;
    }));
    this.linksEl.hidden = !b.instagram?.length;
    this.sheet.body.scrollTop = 0;
  }
}
