// 로딩 화면. 진행률은 장면 생성의 실제 단계에 연결된다.

export const LOAD_STEPS = [
  '텍스처 생성',
  '바닥·벽',
  '서가',
  '책',
  '가구',
  '조명·후처리',
  '연결',
] as const;
export type LoadStep = (typeof LOAD_STEPS)[number];

const STEP_LABEL: Record<LoadStep, string> = {
  '텍스처 생성': '나뭇결과 종이를 고르는 중',
  '바닥·벽': '마루를 깔고 벽을 바르는 중',
  '서가': '서가를 세우는 중',
  '책': '책을 꽂는 중',
  '가구': '소파와 테이블을 놓는 중',
  '조명·후처리': '불을 켜는 중',
  '연결': '다른 손님을 찾는 중',
};

/** 다음 프레임까지 기다린다. 무거운 생성 사이에 화면이 진행률을 그릴 틈을 준다. */
export const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

export class LoadingScreen {
  private el = document.getElementById('loading')!;
  private fill = document.getElementById('loading-fill')!;
  private bar = this.el.querySelector('.loading-bar')!;
  private stepEl = document.getElementById('loading-step')!;
  private done = 0;

  show(): void {
    this.done = 0;
    this.set(0, '준비하는 중');
    this.el.hidden = false;
    this.el.classList.remove('is-leaving');
  }

  /** 단계를 시작할 때 부른다. 이전 단계까지 완료로 표시하고 화면을 한 번 그리게 한다. */
  async begin(step: LoadStep): Promise<void> {
    const i = LOAD_STEPS.indexOf(step);
    this.done = Math.max(this.done, i);
    this.set(this.done / LOAD_STEPS.length, STEP_LABEL[step]);
    await nextFrame();
  }

  async finish(reducedMotion: boolean): Promise<void> {
    this.set(1, '문이 열렸어요');
    await nextFrame();
    if (reducedMotion) {
      this.el.hidden = true;
      return;
    }
    this.el.classList.add('is-leaving');
    await new Promise((r) => setTimeout(r, 600));
    this.el.hidden = true;
  }

  private set(ratio: number, label: string): void {
    const pct = Math.round(ratio * 100);
    this.fill.style.transform = `scaleX(${ratio})`;
    this.bar.setAttribute('aria-valuenow', String(pct));
    this.stepEl.textContent = `${label} · ${pct}%`;
  }
}
