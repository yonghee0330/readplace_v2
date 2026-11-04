// 우측 상단 「공간」— 허브·서브룸을 고르고 확인 후 이동.
import { SPACE_ORDER, currentSpaceId, spaceCapacity, spaceLabel, type SpaceId } from '../scene/layout';
import { Sheet } from './sheet';

export class SpaceSheet {
  readonly sheet = new Sheet('공간 이동하기', 'space-sheet');
  private list: HTMLElement;
  private onPick: ((id: SpaceId) => void) | null = null;

  constructor() {
    this.sheet.body.innerHTML = `
      <p class="sheet-text">가고 싶은 공간을 고르세요. 포털로 걸어가도 같은 확인이 열려요.</p>
      <div class="space-list" data-list role="list"></div>`;
    this.list = this.sheet.body.querySelector('[data-list]')!;
    this.sheet.onClose = () => {
      this.onPick = null;
    };
  }

  open(onPick: (id: SpaceId) => void): void {
    this.onPick = onPick;
    const here = currentSpaceId();
    this.list.replaceChildren();
    for (const id of SPACE_ORDER) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'space-item';
      btn.setAttribute('role', 'listitem');
      const current = id === here;
      btn.disabled = current;
      btn.setAttribute('aria-current', current ? 'true' : 'false');
      btn.innerHTML = `<span class="space-item-name">${spaceLabel(id)}</span>
        <span class="space-item-meta">${current ? '지금 여기 · ' : ''}최대 ${spaceCapacity(id)}명</span>`;
      if (!current) {
        btn.addEventListener('click', () => {
          const pick = this.onPick;
          this.sheet.close();
          pick?.(id);
        });
      }
      this.list.appendChild(btn);
    }
    this.sheet.open();
  }
}
