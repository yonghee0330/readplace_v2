// 성능 기록: 품질(낮음·보통·높음)마다 ?debug=1로 열어 메인 장면 패스와 프레임 전체의 드로우콜·삼각형,
// 텍스처 최대 크기, 좌하단 디버그 표시를 docs/perf.json에 남긴다.
// 사용: npm run perf            (헤드리스 + SwiftShader, 캡처와 같은 조건 — fps는 참고만)
//       npm run perf -- --gpu   (이 컴퓨터의 GPU로 띄워 fps까지 본다)
import { chromium, type Page } from 'playwright';
import { preview } from 'vite';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const gpu = process.argv.includes('--gpu');
const LEVELS = ['low', 'medium', 'high'] as const;
const VIEWS = [
  { name: '아바타 시점', query: 'autostart=1' },
  { name: '전체 시점', query: 'cam=overview' },
];

async function measure(page: Page, base: string, level: string, query: string) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}/?debug=1&quality=${level}&seed=86&npc=1&${query}`);
  await page.waitForFunction(() => (window as unknown as { __BBOOKS_READY?: boolean }).__BBOOKS_READY === true, null, { timeout: 240_000 });
  // fps 표시가 몇 번 갱신되도록 기다린다
  await page.waitForTimeout(gpu ? 4000 : 6000);
  return page.evaluate((errs) => {
    const w = window as unknown as {
      __BBOOKS_STATS: { calls: number; triangles: number; mainCalls: number; mainTriangles: number };
      __BBOOKS: { maxTextureSize(): number };
    };
    return { ...w.__BBOOKS_STATS, maxTexture: w.__BBOOKS.maxTextureSize(), hud: document.querySelector('.debug-fps')?.textContent ?? '', errors: errs };
  }, errors);
}

const server = await preview({ preview: { port: 4174, strictPort: false }, logLevel: 'warn' });
const base = server.resolvedUrls?.local[0]?.replace(/\/$/, '') ?? 'http://localhost:4174';
const browser = await chromium.launch(gpu ? { headless: false, args: ['--ignore-gpu-blocklist'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const rows: Record<string, unknown>[] = [];
try {
  for (const level of LEVELS) {
    for (const v of VIEWS) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const r = await measure(page, base, level, v.query);
      await page.close();
      rows.push({ level, view: v.name, ...r });
      console.log(`${level.padEnd(6)} ${v.name}: 메인 ${r.mainCalls}콜 / ${Math.round(r.mainTriangles / 1000)}k, 전체 ${r.calls}콜 / ${Math.round(r.triangles / 1000)}k, 텍스처 최대 ${r.maxTexture}px · ${r.hud}`);
    }
  }
} finally {
  await browser.close();
  await new Promise<void>((r) => server.httpServer.close(() => r()));
}
writeFileSync(resolve(gpu ? 'docs/perf-gpu.json' : 'docs/perf.json'), JSON.stringify({ at: new Date().toISOString(), renderer: gpu ? 'GPU(headed)' : 'SwiftShader(headless)', viewport: '1440x900', rows }, null, 2));
