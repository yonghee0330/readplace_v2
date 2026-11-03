import '@fontsource/noto-serif-kr/500.css';
import '@fontsource/noto-serif-kr/700.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './style.css';

import { startApp } from './app';
import { readParams } from './core/params';
import { registerServiceWorker } from './pwa/register';
import { LoadingScreen } from './ui/loading';
import { fetchBucheonWeather, weatherAria } from './weather/bucheon';

declare global {
  interface Window {
    __BBOOKS_READY?: boolean;
  }
}

registerServiceWorker();

const params = readParams();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const startEl = document.getElementById('start')!;

// 캔버스 설명만 부천 날씨에 맞춘다(시작 문구는 고정)
void fetchBucheonWeather(params.weather).then((w) => {
  canvas.setAttribute('aria-label', weatherAria(w.kind));
});

let entered = false;

async function enter(): Promise<void> {
  if (entered) return;
  entered = true;
  const openMs = reducedMotion ? 0 : 950;
  if (openMs) {
    startEl.classList.add('is-opening');
    await new Promise((r) => setTimeout(r, openMs));
  }
  startEl.hidden = true;
  const loading = new LoadingScreen();
  loading.show();
  await startApp(params, canvas, loading, reducedMotion);
}

document.getElementById('start-enter')!.addEventListener('click', () => void enter());
if (params.autostart) void enter();
