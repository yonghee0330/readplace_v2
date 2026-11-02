import '@fontsource/noto-serif-kr/500.css';
import '@fontsource/noto-serif-kr/700.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './style.css';

import { startApp } from './app';
import { ROOM_CAPACITY, readParams, roomLabel } from './core/params';
import { registerServiceWorker } from './pwa/register';
import { LoadingScreen } from './ui/loading';
import { fetchBucheonWeather, weatherAria, weatherCopy } from './weather/bucheon';

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
document.getElementById('start-room')!.textContent = roomLabel();
document.getElementById('start-note')!.textContent = `한 번에 ${ROOM_CAPACITY}명까지`;

// 시작 화면 문구를 부천 날씨에 맞춘다(실패해도 비 문구)
void fetchBucheonWeather(params.weather).then((w) => {
  const copy = document.querySelector('.start-copy');
  if (copy) copy.innerHTML = weatherCopy(w.kind);
  canvas.setAttribute('aria-label', weatherAria(w.kind));
});

let entered = false;

async function enter(): Promise<void> {
  if (entered) return;
  entered = true;
  startEl.hidden = true;
  const loading = new LoadingScreen();
  loading.show();
  await startApp(params, canvas, loading, reducedMotion);
}

document.getElementById('start-enter')!.addEventListener('click', () => void enter());
if (params.autostart) void enter();
