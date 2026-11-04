// 세미나실 모임 포스터 확인용 캡처. 사용: tsx scripts/poster-shot.ts <출력.png>
import { chromium } from 'playwright';
import { preview } from 'vite';
import { resolve } from 'node:path';

type Win = { __BBOOKS: Record<string, (...a: unknown[]) => unknown>; __BBOOKS_LOOP: { start(): void; stop(): void } };
async function main(): Promise<void> {
  const out = resolve(process.argv[2] ?? 'docs/screens/poster.png');
  const server = await preview({ preview: { port: 4175, strictPort: false }, logLevel: 'warn' });
  const base = server.resolvedUrls?.local[0]?.replace(/\/$/, '') ?? 'http://localhost:4175';
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1000, height: 640 } })).newPage();
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/?cam=avatar&seed=1&npc=0&quality=medium&presence=local`);
  await page.waitForFunction(() => (window as unknown as { __BBOOKS_READY?: boolean }).__BBOOKS_READY === true, null, { timeout: 180_000 });
  await page.evaluate(() => (window as unknown as Win).__BBOOKS.enterSpace('seminar'));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const w = window as unknown as Win; w.__BBOOKS.teleport(-1.4, 0.9, Math.PI); w.__BBOOKS_LOOP.start(); });
  await page.waitForTimeout(800);
  const d = Number(process.env.DRAG ?? 524);
  await page.mouse.move(d < 0 ? 800 : 200, 300);
  await page.mouse.down();
  await page.mouse.move((d < 0 ? 800 : 200) + d, 300 + Number(process.env.DRAGY ?? 0), { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(2500);
  await page.evaluate(() => (window as unknown as Win).__BBOOKS_LOOP.stop());
  if (process.env.CLICK) {
    await page.evaluate(() => { (window as unknown as { __opened: string[] }).__opened = []; window.open = ((u: string) => { (window as unknown as { __opened: string[] }).__opened.push(u); return null; }) as typeof window.open; });
    await page.mouse.click(635, 130);
    await page.waitForTimeout(300);
    console.log('opened:', await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened));
  }
  await page.screenshot({ path: out, timeout: 120_000 });
  console.log('space:', await page.evaluate(() => (window as unknown as Win).__BBOOKS.space()), 'errors:', errors.length ? errors : 'none');
  await browser.close();
  await server.close();
}
void main();
