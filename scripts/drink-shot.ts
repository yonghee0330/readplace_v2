// 음료 마시기 포즈 확인용. 사용: tsx scripts/drink-shot.ts <출력폴더> [kind]  (정면에서 시간별 프레임)
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
type W = { __BBOOKS: Record<string, (...a: unknown[]) => unknown>; __BBOOKS_LOOP: { start(): void; stop(): void } };
(async () => {
  const out = resolve(process.argv[2] ?? '/tmp/x/drink');
  const kind = process.argv[3] ?? 'coffee';
  mkdirSync(out, { recursive: true });
  const server = await preview({ preview: { port: 4179, strictPort: false }, logLevel: 'warn' });
  const base = server.resolvedUrls?.local[0]?.replace(/\/$/, '') ?? '';
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 640, height: 520 } })).newPage();
  await page.goto(`${base}/?cam=avatar&seed=1&npc=0&quality=low&presence=local`);
  await page.waitForFunction(() => (window as unknown as { __BBOOKS_READY?: boolean }).__BBOOKS_READY === true, null, { timeout: 180_000 });
  await page.evaluate(() => { const w = window as unknown as W; w.__BBOOKS.teleport(1.2, 0.4, 0); w.__BBOOKS_LOOP.start(); });
  await page.waitForTimeout(800);
  const cam = process.env.CAM ? JSON.parse(process.env.CAM) : [0, 0.5, 0.85];
  await page.evaluate((c) => (window as unknown as W).__BBOOKS.meCam(c), cam);
  await page.evaluate((k) => (window as unknown as W).__BBOOKS.sipNow(k), kind);
  const times = [900, 900, 900, 900, 900, 900];
  let n = 0;
  for (const t of times) {
    await page.waitForTimeout(t);
    await page.screenshot({ path: `${out}/f${n++}.png` });
  }
  await browser.close(); await server.close();
})();
