// 스크린샷 자동화. 빌드 결과물을 미리보기 서버로 띄우고 docs/screens/에 저장한다.
// 사용: npm run capture            (전체)
//       npm run capture -- overview (이름으로 골라 찍기)
import { chromium, type Browser, type Page } from 'playwright';
import { preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve('docs/screens');
const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
} as const;

interface Shot {
  name: string;
  query: string;
  /** 같은 방에 먼저 열어 둘 탭 수(함께 있기 캡처용) */
  companions?: number;
  companionQuery?: string;
}

const SHOTS: Shot[] = [
  { name: 'overview', query: '?cam=overview&seed=1&npc=1&quality=medium' },
  // 동행 탭은 창가 독서 테이블 의자에 앉혀 두고, 캡처하는 탭은 아바타 시점
  { name: 'with-visitors', query: '?cam=avatar&seed=1&npc=1&quality=medium&room=wonmi&instance=86', companions: 1, companionQuery: '?autostart=1&seed=1&npc=1&quality=low&room=wonmi&instance=86&seat=chair-2' },
  { name: 'reader', query: '?autoread=1&seed=1&npc=1&quality=medium&seat=sofa-2' },
];

async function waitReady(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __BBOOKS_READY?: boolean }).__BBOOKS_READY === true, null, { timeout: 180_000 });
  // 소프트웨어 렌더링이라 후처리 몇 프레임이 더 돌도록 기다린 뒤, 루프를 멈춰 스크린샷이 프레임을 기다리지 않게 한다.
  await page.waitForTimeout(2500);
  await page.evaluate(() => (window as unknown as { __BBOOKS_LOOP?: { stop(): void } }).__BBOOKS_LOOP?.stop());
  await page.waitForTimeout(300);
}

async function capture(browser: Browser, base: string, shot: Shot, vpName: keyof typeof VIEWPORTS, errors: string[]): Promise<Record<string, unknown>> {
  const ctx = await browser.newContext({ viewport: { width: VIEWPORTS[vpName].width, height: VIEWPORTS[vpName].height }, ...VIEWPORTS[vpName], reducedMotion: 'no-preference' });
  const companions: Page[] = [];
  for (let i = 0; i < (shot.companions ?? 0); i++) {
    const p = await ctx.newPage();
    await p.goto(`${base}/${shot.companionQuery ?? shot.query}`);
    await waitReady(p);
    companions.push(p);
  }
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${shot.name}/${vpName}] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[${shot.name}/${vpName}] ${e.message}`));
  await page.goto(`${base}/${shot.query}`);
  await waitReady(page);
  // 함께 있기 캡처: 동행 탭의 아바타가 실제로 보일 때까지 기다린다
  if (companions.length) {
    await page.waitForFunction(() => (window as unknown as { __BBOOKS: { visiblePeerAvatars(): unknown[] } }).__BBOOKS.visiblePeerAvatars().length > 0, null, { timeout: 120_000 });
    await page.evaluate(() => (window as unknown as { __BBOOKS_LOOP?: { start(): void } }).__BBOOKS_LOOP?.start());
    await page.waitForTimeout(2500);
    await page.evaluate(() => (window as unknown as { __BBOOKS_LOOP?: { stop(): void } }).__BBOOKS_LOOP?.stop());
  }
  const file = vpName === 'desktop' ? `${shot.name}.png` : `${shot.name}-mobile.png`;
  await page.screenshot({ path: resolve(OUT, file), timeout: 120_000 });
  const stats = await page.evaluate(() => (window as unknown as { __BBOOKS_STATS?: unknown }).__BBOOKS_STATS);
  await ctx.close();
  console.log(`  ✓ ${file}`, stats ?? '');
  return { file, stats };
}

async function main(): Promise<void> {
  const only = process.argv.slice(2);
  const shots = only.length ? SHOTS.filter((s) => only.includes(s.name)) : SHOTS;
  mkdirSync(OUT, { recursive: true });

  const server = await preview({ preview: { port: 4173, strictPort: false }, logLevel: 'warn' });
  const base = server.resolvedUrls?.local[0]?.replace(/\/$/, '') ?? 'http://localhost:4173';
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const errors: string[] = [];
  const results: Record<string, unknown>[] = [];
  try {
    for (const shot of shots) {
      for (const vp of Object.keys(VIEWPORTS) as (keyof typeof VIEWPORTS)[]) {
        results.push(await capture(browser, base, shot, vp, errors));
      }
    }
  } finally {
    await browser.close();
    await new Promise<void>((r) => server.httpServer.close(() => r()));
  }
  writeFileSync(resolve(OUT, 'capture-log.json'), JSON.stringify({ at: new Date().toISOString(), results, errors }, null, 2));
  if (errors.length) {
    console.error(`콘솔 에러 ${errors.length}개:\n${errors.join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log('콘솔 에러 0개');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
