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
  const page = await (await browser.newContext({ viewport: { width: 1000, height: 640 }, deviceScaleFactor: Number(process.env.DSF ?? 1) })).newPage();
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  if (process.env.HEARTS) {
    await page.addInitScript(() => {
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const texts = ['원미동북클럽 다음 읽을 책은 <손절회> 기대된다! 정말정말 기다려져요 ㅎㅎ', '서귤 북토크 기대됩니다!!', '힐링공간 만들어주셔서 감사합니다! 자주 올게요 꼭이요', '가호 읽고 계신 분 있나요?'];
      const pos = [[0.22, 0.4], [0.72, 0.4], [0.3, 0.75], [0.74, 0.76]];
      const notes = texts.map((text, i) => ({ id: `h${i}`, text, color: 'pink', shape: 'heart', x: pos[i][0], y: pos[i][1], rot: i % 2 ? 4 : -3, nickname: '테스트', day, createdAt: Date.now() + i }));
      localStorage.setItem('bbooks.postits', JSON.stringify(notes));
    });
  }
  await page.goto(`${base}/?cam=avatar&seed=1&npc=0&quality=medium&presence=local`);
  await page.waitForFunction(() => (window as unknown as { __BBOOKS_READY?: boolean }).__BBOOKS_READY === true, null, { timeout: 180_000 });
  await page.evaluate(() => (window as unknown as Win).__BBOOKS.enterSpace('hub'));
  await page.waitForTimeout(1500);
  await page.evaluate((tx) => { const w = window as unknown as Win; w.__BBOOKS.teleport(tx, 0.4, 0); w.__BBOOKS_LOOP.start(); }, Number(process.env.TX ?? 1.2));
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
    await page.mouse.click(472, Number(process.env.CY ?? 120));
    await page.waitForTimeout(300);
    console.log('opened:', await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened));
  }
  await page.screenshot({ path: out, timeout: 120_000 });
  console.log('space:', await page.evaluate(() => (window as unknown as Win).__BBOOKS.space()), 'errors:', errors.length ? errors : 'none');
  await browser.close();
  await server.close();
}
void main();
