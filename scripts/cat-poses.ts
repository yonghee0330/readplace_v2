// 고양이 자세 점검용: 동작마다 가까이서 한 장씩 찍는다. 사용: tsx scripts/cat-poses.ts <출력폴더> [동작...]
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve(process.argv[2] ?? 'docs/screens/cat');
const only = process.argv.slice(3);
const MODES = ['stand', 'walk', 'sit', 'groom', 'loaf', 'sleep', 'stretch', 'meow', 'crouch', 'happy', 'chase', 'run'];
type Win = { __BBOOKS: Record<string, (...a: unknown[]) => unknown>; __BBOOKS_LOOP: { start(): void; stop(): void } };

async function main(): Promise<void> {
  mkdirSync(out, { recursive: true });
  const server = await preview({ preview: { port: 4174, strictPort: false }, logLevel: 'warn' });
  const base = server.resolvedUrls?.local[0]?.replace(/\/$/, '') ?? 'http://localhost:4174';
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 720, height: 520 } })).newPage();
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/?cam=avatar&seed=1&npc=1&quality=medium&presence=local`);
  await page.waitForFunction(() => (window as unknown as { __BBOOKS_READY?: boolean }).__BBOOKS_READY === true, null, { timeout: 180_000 });
  for (const mode of MODES.filter((m) => !only.length || only.includes(m))) {
    for (const [tag, cam] of [['a', [0.75, 0.4, 0.95]], ['b', [-0.9, 0.25, 0.7]]] as const) {
      await page.evaluate(([m, c]) => {
        const w = window as unknown as Win;
        w.__BBOOKS.catCam(c);
        w.__BBOOKS.catForce(m, 60);
        w.__BBOOKS_LOOP.start();
      }, [mode, cam] as const);
      await page.waitForTimeout(mode === 'stretch' ? 3500 : 2800);
      await page.evaluate(() => (window as unknown as Win).__BBOOKS_LOOP.stop());
      await page.waitForTimeout(200);
      await page.screenshot({ path: resolve(out, `${mode}-${tag}.png`), timeout: 120_000 });
      if (mode === 'walk' || mode === 'run') break;
    }
    console.log('  ✓', mode);
  }
  console.log('console errors:', errors.length ? errors : 'none');
  await browser.close();
  await server.close();
}
void main();
