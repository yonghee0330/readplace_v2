// 영화감상실: 스크린 클릭 → 유튜브 재생. Esc·닫기로 끝냄.

const YT_ID = 'CH1PZxNQ8RU';
const YT_START = 0;

export class CinemaWatch {
  readonly el: HTMLElement;
  active = false;
  private frame: HTMLIFrameElement;
  private onExit: () => void;

  constructor(parent: HTMLElement, onExit: () => void) {
    this.onExit = onExit;
    this.el = document.createElement('div');
    this.el.className = 'cinema-watch';
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-label', '영화 감상');
    this.el.innerHTML = `
      <div class="cinema-watch-dim" aria-hidden="true"></div>
      <div class="cinema-watch-stage">
        <div class="cinema-watch-bezel">
          <iframe class="cinema-watch-frame" title="영화 감상" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
        </div>
        <button type="button" class="pill cinema-watch-exit" aria-label="감상 끝내고 돌아가기">돌아가기</button>
      </div>`;
    parent.appendChild(this.el);
    this.frame = this.el.querySelector('.cinema-watch-frame')!;
    this.el.querySelector('.cinema-watch-exit')!.addEventListener('click', () => this.onExit());
    this.el.querySelector('.cinema-watch-dim')!.addEventListener('click', () => this.onExit());
  }

  enter(): void {
    if (this.active) return;
    this.active = true;
    this.frame.src = `https://www.youtube.com/embed/${YT_ID}?start=${YT_START}&autoplay=1&rel=0&modestbranding=1&playsinline=1`;
    this.el.hidden = false;
    requestAnimationFrame(() => this.el.classList.add('is-in'));
    (this.el.querySelector('.cinema-watch-exit') as HTMLElement).focus();
  }

  exit(): void {
    if (!this.active) return;
    this.active = false;
    this.el.classList.remove('is-in');
    this.el.hidden = true;
    // iframe 제거로 재생·소리 즉시 중단
    this.frame.src = 'about:blank';
  }
}
