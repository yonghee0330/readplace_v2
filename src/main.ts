import '@fontsource/noto-serif-kr/500.css';
import '@fontsource/noto-serif-kr/700.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './style.css';

import { startApp } from './app';
import { readParams, roomLabel } from './core/params';
import { LoadingScreen } from './ui/loading';

declare global {
  interface Window {
    __BBOOKS_READY?: boolean;
  }
}

const params = readParams();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const startEl = document.getElementById('start')!;
document.getElementById('start-room')!.textContent = roomLabel(params.instance);

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
