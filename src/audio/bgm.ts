// 서점 배경음악: YouTube 임베드(잔잔한 플레이리스트). 사용자 제스처 이후에만 재생.
// 화면에는 보이지 않고 소리만 쓴다. 끄면 iframe을 비워 즉시 멈춘다.

const YT_ID = 'xjOG0beBrgM';

export class BookstoreBgm {
  enabled = false;
  private host: HTMLDivElement | null = null;
  private frame: HTMLIFrameElement | null = null;
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

  status(): { enabled: boolean; playing: boolean } {
    return { enabled: this.enabled, playing: !!this.frame && this.enabled };
  }

  private ensureHost(): HTMLDivElement {
    if (this.host) return this.host;
    const el = document.createElement('div');
    el.id = 'bbooks-bgm';
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;top:0;overflow:hidden;opacity:0;pointer-events:none';
    document.body.appendChild(el);
    this.host = el;
    return el;
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
    this.frame = null;
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
        onStateChange: (e: { data: number; target: YtPlayer }) => {
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
    this.frame = frame;
    this.player = null;
  }

  private stop(): void {
    try {
      this.player?.pauseVideo();
    } catch {
      /* ignore */
    }
    if (this.host) {
      this.host.replaceChildren();
    }
    this.player = null;
    this.frame = null;
  }
}

interface YtPlayer {
  playVideo(): void;
  pauseVideo(): void;
  setVolume(n: number): void;
}
