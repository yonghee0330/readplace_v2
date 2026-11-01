// public/icons/icon.svg → icon-192.png, icon-512.png. 새 패키지 없이 Playwright 크로미움으로 그린다.
// 사용: npx tsx scripts/icons.ts (아이콘 SVG를 고쳤을 때만)
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve('public/icons');
const svg = readFileSync(resolve(dir, 'icon.svg'), 'utf8');

const browser = await chromium.launch();
try {
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await page.screenshot({ path: resolve(dir, `icon-${size}.png`), omitBackground: false });
    await page.close();
    console.log(`  ✓ icon-${size}.png`);
  }
} finally {
  await browser.close();
}
