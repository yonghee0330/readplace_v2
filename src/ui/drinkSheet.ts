// 음료 고르기 시트: 물·커피·차.
import { DRINK_OPTIONS, type DrinkKind } from '../net/drink';
import { Sheet } from './sheet';

export class DrinkSheet {
  readonly sheet = new Sheet('무엇을 마실까요?', 'drink-sheet');

  constructor(onPick: (kind: DrinkKind) => void) {
    this.sheet.body.innerHTML = `
      <p class="sheet-text">잔을 들고 천천히 한 모금 마셔요.</p>
      <div class="drink-choices" role="list">
        ${DRINK_OPTIONS.map((d) => `
          <button type="button" class="drink-choice" data-drink="${d.id}" role="listitem" style="--drink:${d.color}">
            <span class="drink-swatch" aria-hidden="true"></span>
            <span class="drink-copy">
              <span class="drink-name">${d.label}</span>
              <span class="drink-hint">${d.hint}</span>
            </span>
          </button>`).join('')}
      </div>`;
    this.sheet.body.querySelectorAll<HTMLButtonElement>('[data-drink]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kind = btn.dataset.drink as DrinkKind;
        this.sheet.close();
        onPick(kind);
      });
    });
  }

  open(): void {
    this.sheet.open();
  }
}
