// 서점 배경음악: YouTube 임베드(잔잔한 플레이리스트). 사용자 제스처 이후에만 재생.
// 화면에는 보이지 않고 소리만 쓴다. 끄면 iframe을 비워 즉시 멈춘다.

const YT_ID = 'xjOG0beBrgM';

export class BookstoreBgm {
  enabled = false;
  private host: HTMLDivElement | null = null;
  /** 모바일(특히 iOS)이 자동재생을 막았을 때 화면을 한 번 누르게 안내하는 콜백 */
  onBlocked: (() => void) | null = null;
  private blockedTimer = 0;
  private retryArmed = false;
  private player: YtPlayer | null = null;
  private apiReady: Promise<void> | null = null;
  /** 0~100 */
  private volume = 42;

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (on) void this.play();
    else this.stop();
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(100, Math.round(v)));
    try {
      this.player?.setVolume(this.volume);
    } catch {
      /* player 준비 전 */
    }
  }

  status(): { enabled: boolean; playing: boolean; state: number | null } {
    let state: number | null = null;
    try {
      state = this.player?.getPlayerState?.() ?? null;
    } catch {
      state = null;
    }
    // YT.PlayerState: 1 재생 중, 3 버퍼링, -1 시작 전, 5 큐됨(막히면 여기 머문다)
    return { enabled: this.enabled, playing: state === 1 || state === 3, state };
  }

  private ensureHost(): HTMLDivElement {
    if (this.host) return this.host;
    const el = document.createElement('div');
    el.id = 'bbooks-bgm';
    el.setAttribute('aria-hidden', 'true');
    // 화면 밖(-9999px)에 두면 모바일 브라우저가 재생을 막거나 멈출 수 있어, 화면 안 모서리에 투명하게 둔다
    el.style.cssText = 'position:fixed;width:2px;height:2px;left:0;bottom:0;overflow:hidden;opacity:0.01;pointer-events:none;z-index:-1';
    document.body.appendChild(el);
    this.host = el;
    return el;
  }

  /** 유튜브 API를 미리 받아 둔다(탭 직후에 바로 플레이어를 만들 수 있게). */
  warm(): void {
    void this.loadApi();
  }

  private loadApi(): Promise<void> {
    if (this.apiReady) return this.apiReady;
    this.apiReady = new Promise((resolve) => {
      const w = window as unknown as { YT?: { Player: new (el: HTMLElement | string, opts: unknown) => YtPlayer }; onYouTubeIframeAPIReady?: () => void };
      if (w.YT?.Player) {
        resolve();
        return;
      }
      const prev = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
      if (!document.querySelector('script[data-bbooks-yt]')) {
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        s.async = true;
        s.dataset.bbooksYt = '1';
        document.head.appendChild(s);
      }
      // API 콜백이 이미 지났을 수 있어 폴링
      const poll = window.setInterval(() => {
        if (w.YT?.Player) {
          clearInterval(poll);
          resolve();
        }
      }, 200);
      window.setTimeout(() => {
        clearInterval(poll);
        resolve();
      }, 8000);
    });
    return this.apiReady;
  }

  private async play(): Promise<void> {
    if (!this.enabled) return;
    const host = this.ensureHost();
    await this.loadApi();
    if (!this.enabled) return;
    const YT = (window as unknown as { YT?: { Player: new (el: HTMLElement | string, opts: unknown) => YtPlayer } }).YT;
    if (!YT?.Player) {
      // API 실패 시 단순 iframe 폴백
      this.fallbackIframe(host);
      return;
    }
    if (this.player) {
      try {
        this.player.playVideo();
        this.player.setVolume(this.volume);
      } catch {
        this.rebuildPlayer(host, YT);
      }
      return;
    }
    this.rebuildPlayer(host, YT);
  }

  private rebuildPlayer(host: HTMLDivElement, YT: { Player: new (el: HTMLElement | string, opts: unknown) => YtPlayer }): void {
    host.replaceChildren();
    const mount = document.createElement('div');
    host.appendChild(mount);
    this.watchStart();
    this.player = new YT.Player(mount, {
      videoId: YT_ID,
      width: 1,
      height: 1,
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        loop: 1,
        playlist: YT_ID,
        origin: location.origin,
      },
      events: {
        onReady: (e: { target: YtPlayer }) => {
          this.player = e.target;
          try {
            e.target.setVolume(this.volume);
            if (this.enabled) e.target.playVideo();
            else e.target.pauseVideo();
          } catch {
            /* ignore */
          }
        },
        onAutoplayBlocked: () => this.handleBlocked(),
        onStateChange: (e: { data: number; target: YtPlayer }) => {
          if (e.data === 1) this.clearBlocked();
          // 끝났을 때 다시(루프 보강). YT.PlayerState.ENDED = 0
          if (e.data === 0 && this.enabled) {
            try {
              e.target.playVideo();
            } catch {
              /* ignore */
            }
          }
        },
      },
    });
  }

  private fallbackIframe(host: HTMLDivElement): void {
    host.replaceChildren();
    const frame = document.createElement('iframe');
    frame.title = '서점 배경음악';
    frame.allow = 'autoplay; encrypted-media';
    frame.src = `https://www.youtube.com/embed/${YT_ID}?autoplay=1&loop=1&playlist=${YT_ID}&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&rel=0`;
    host.appendChild(frame);
    this.player = null;
  }

  /** 3.5초 안에 재생이 시작되지 않으면 막힌 것으로 보고, 다음 터치에서 다시 재생을 시도한다. */
  private watchStart(): void {
    window.clearTimeout(this.blockedTimer);
    this.blockedTimer = window.setTimeout(() => {
      if (this.enabled && !this.status().playing) this.handleBlocked();
    }, 3500);
  }

  private handleBlocked(): void {
    if (!this.enabled || this.retryArmed) return;
    this.retryArmed = true;
    this.onBlocked?.();
    // 사용자 터치 안에서 다시 재생을 요청한다(iOS 사파리·인앱 브라우저는 이래야 소리가 난다)
    const retry = () => {
      try {
        const p = this.player;
        if (p && this.enabled) {
          p.unMute?.();
          p.setVolume(this.volume);
          p.playVideo();
        }
      } catch {
        /* ignore */
      }
      window.setTimeout(() => {
        if (this.status().playing) this.clearBlocked();
      }, 800);
    };
    this.retryFn = retry;
    addEventListener('pointerup', retry, true);
    addEventListener('touchend', retry, true);
  }

  private retryFn: (() => void) | null = null;

  private clearBlocked(): void {
    window.clearTimeout(this.blockedTimer);
    if (this.retryFn) {
      removeEventListener('pointerup', this.retryFn, true);
      removeEventListener('touchend', this.retryFn, true);
      this.retryFn = null;
    }
    this.retryArmed = false;
  }

  private stop(): void {
    this.clearBlocked();
    try {
      this.player?.pauseVideo();
    } catch {
      /* ignore */
    }
    if (this.host) {
      this.host.replaceChildren();
    }
    this.player = null;
  }
}

interface YtPlayer {
  playVideo(): void;
  pauseVideo(): void;
  setVolume(n: number): void;
  getPlayerState?(): number;
  unMute?(): void;
}
