// 실시간 알림 토스트: 동시에 최대 3개, 기본 4초. 스크린리더에도 읽힌다.

export interface ToastOptions {
  duration?: number;
  action?: { label: string; onClick: () => void };
  kind?: 'info' | 'guide';
}

export class Toasts {
  private el: HTMLElement;
  private max = 3;
  /** 띄운 알림 문구 기록(최근 50개). 테스트가 짧게 떴다 사라진 알림도 확인할 수 있게 한다. */
  readonly log: string[] = [];

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'toasts';
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    parent.appendChild(this.el);
  }

  show(text: string, opts: ToastOptions = {}): HTMLElement {
    this.log.push(text);
    if (this.log.length > 50) this.log.shift();
    while (this.el.children.length >= this.max) this.el.firstElementChild?.remove();
    const t = document.createElement('div');
    t.className = `toast ${opts.kind === 'guide' ? 'toast-guide' : ''}`;
    const span = document.createElement('span');
    span.textContent = text;
    t.appendChild(span);
    if (opts.action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'toast-action';
      b.textContent = opts.action.label;
      b.setAttribute('aria-label', opts.action.label);
      b.addEventListener('click', () => {
        opts.action!.onClick();
        dismiss();
      });
      t.appendChild(b);
    }
    this.el.appendChild(t);
    requestAnimationFrame(() => t.classList.add('is-in'));
    let gone = false;
    const dismiss = () => {
      if (gone) return;
      gone = true;
      t.classList.remove('is-in');
      setTimeout(() => t.remove(), 250);
    };
    setTimeout(dismiss, opts.duration ?? 4000);
    return t;
  }
}
