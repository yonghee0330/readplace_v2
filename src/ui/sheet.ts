// 페이지 안의 시트(확인 창·설정). 모바일은 아래에서 올라오고, 데스크톱은 가운데 카드.
// Esc·바깥 클릭으로 닫히고, 열려 있는 동안 포커스가 시트 안에서만 돈다.
// 모바일 키보드·주소창은 visualViewport로 높이를 맞춰 내용이 잘리지 않게 한다.

let openSheet: Sheet | null = null;

export class Sheet {
  readonly el: HTMLElement;
  readonly body: HTMLElement;
  private backdrop: HTMLElement;
  private returnFocus: HTMLElement | null = null;
  onClose: (() => void) | null = null;

  constructor(title: string, id: string) {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'sheet-backdrop';
    this.backdrop.hidden = true;
    this.el = document.createElement('section');
    this.el.className = 'sheet';
    this.el.id = id;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-labelledby', `${id}-title`);
    this.el.innerHTML = `<header class="sheet-head"><h2 class="sheet-title" id="${id}-title"></h2>
      <button type="button" class="sheet-close" aria-label="닫기">×</button></header><div class="sheet-body"></div>`;
    this.el.querySelector('.sheet-title')!.textContent = title;
    this.body = this.el.querySelector('.sheet-body')!;
    this.el.querySelector('.sheet-close')!.addEventListener('click', () => this.close());
    this.backdrop.addEventListener('click', () => this.close());
    this.backdrop.appendChild(this.el);
    this.el.addEventListener('click', (e) => e.stopPropagation());
    this.el.addEventListener('keydown', (e) => this.trap(e));
    // 입력 필드로 포커스가 가면 본문 안에서 보이게 스크롤
    this.body.addEventListener('focusin', (e) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) {
        requestAnimationFrame(() => t.scrollIntoView({ block: 'center', inline: 'nearest' }));
      }
    });
    document.getElementById('ui')!.appendChild(this.backdrop);
  }

  get isOpen(): boolean {
    return !this.backdrop.hidden;
  }

  open(): void {
    openSheet?.close();
    openSheet = this;
    this.returnFocus = document.activeElement as HTMLElement | null;
    this.backdrop.hidden = false;
    this.fitViewport();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', this.fitViewport);
    vv?.addEventListener('scroll', this.fitViewport);
    requestAnimationFrame(() => this.backdrop.classList.add('is-open'));
    const first = this.focusables()[0];
    first?.focus();
  }

  close(): void {
    if (!this.isOpen) return;
    const vv = window.visualViewport;
    vv?.removeEventListener('resize', this.fitViewport);
    vv?.removeEventListener('scroll', this.fitViewport);
    this.el.style.maxHeight = '';
    this.backdrop.removeAttribute('style');
    this.el.classList.remove('is-compact');
    this.backdrop.classList.remove('is-open');
    this.backdrop.hidden = true;
    if (openSheet === this) openSheet = null;
    this.returnFocus?.focus?.();
    this.onClose?.();
  }

  /**
   * 키보드·브라우저 UI가 가린 만큼 시트 영역을 줄인다.
   * iOS는 키보드가 올라오면 보이는 영역(visualViewport)만 줄고 위로 밀려 올라가므로,
   * 배경 레이어를 보이는 영역에 정확히 맞춰 시트(와 입력칸)가 늘 키보드 위에 보이게 한다.
   */
  private fitViewport = (): void => {
    if (!this.isOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const b = this.backdrop.style;
    b.inset = 'auto';
    b.left = `${vv.offsetLeft}px`;
    b.top = `${vv.offsetTop}px`;
    b.width = `${vv.width}px`;
    b.height = `${vv.height}px`;
    this.el.style.maxHeight = `${Math.max(180, vv.height - 8)}px`;
    // 키보드가 올라온 상태(보이는 높이가 레이아웃 높이보다 120px 넘게 작음)에선 안내 문구를 접는다
    this.el.classList.toggle('is-compact', window.innerHeight - vv.height > 120);
  };

  private focusables(): HTMLElement[] {
    return [...this.el.querySelectorAll<HTMLElement>('button, select, input, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter((e) => !e.hasAttribute('disabled') && !(e as HTMLButtonElement).disabled);
  }

  private trap(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.close();
      return;
    }
    if (e.key !== 'Tab') return;
    const f = this.focusables();
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

export function anySheetOpen(): boolean {
  return openSheet !== null;
}

export function closeOpenSheet(): void {
  openSheet?.close();
}
