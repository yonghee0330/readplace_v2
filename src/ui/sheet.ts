// 페이지 안의 시트(확인 창·설정). 모바일은 아래에서 올라오고, 데스크톱은 가운데 카드.
// Esc·바깥 클릭으로 닫히고, 열려 있는 동안 포커스가 시트 안에서만 돈다.

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
    requestAnimationFrame(() => this.backdrop.classList.add('is-open'));
    const first = this.focusables()[0];
    first?.focus();
  }

  close(): void {
    if (!this.isOpen) return;
    this.backdrop.classList.remove('is-open');
    this.backdrop.hidden = true;
    if (openSheet === this) openSheet = null;
    this.returnFocus?.focus?.();
    this.onClose?.();
  }

  private focusables(): HTMLElement[] {
    return [...this.el.querySelectorAll<HTMLElement>('button, select, input, [tabindex]:not([tabindex="-1"])')].filter((e) => !e.hasAttribute('disabled'));
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
