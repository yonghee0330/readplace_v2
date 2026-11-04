// 책 미리보기 시트 확인용 캡처. 사용: tsx scripts/peek-shot.ts <출력.png> [제목] [저자] [출판사]
import { chromium } from 'playwright';
import { preview } from 'vite';
import { resolve } from 'node:path';

async function main(): Promise<void> {
  const [out, title = '코스모스(100만부 기념판)', author = '칼 세이건', publisher = '사이언스북스'] = process.argv.slice(2);
  const server = await preview({ preview: { port: 4176, strictPort: false }, logLevel: 'warn' });
  const base = server.resolvedUrls?.local[0]?.replace(/\/$/, '') ?? 'http://localhost:4176';
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 430, height: 860 } })).newPage();
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}/?cam=avatar&seed=1&npc=0&quality=low&presence=local`);
  await page.waitForFunction(() => (window as unknown as { __BBOOKS_READY?: boolean }).__BBOOKS_READY === true, null, { timeout: 180_000 });
  await page.evaluate(([t, a, p]) => (window as unknown as { __BBOOKS: { peekBook(...x: string[]): void } }).__BBOOKS.peekBook(t, a, p), [title, author, publisher]);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: resolve(out ?? 'peek.png'), timeout: 120_000 });
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
  await server.close();
}
void main();
