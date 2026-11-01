// e2e: 같은 방에 탭 2개 → 서로의 아바타·이름표·눈인사 알림·접속자 수 확인. Local(BroadcastChannel)과 ws 두 모드.
// 읽기 모드(키 3 → 타이머 → 함께 읽는 중 N명 → Esc)도 탭 2개로 확인한다.
// 모든 페이지의 콘솔 에러가 0개인지도 함께 확인한다.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

interface Debug {
  __BBOOKS_READY?: boolean;
  __BBOOKS: {
    me(): { id: string; nickname: string; state: string; seatId: string | null; position: number[] };
    peers(): { id: string; nickname: string; state: string; seatId: string | null }[];
    visiblePeerAvatars(): { id: string; nickname: string; nameplate: boolean }[];
    toasts(): string[];
    project(x: number, y: number, z: number): { x: number; y: number };
    seats(): { id: string; x: number; z: number; y: number }[];
  };
}

function watchErrors(page: Page, errors: string[]): void {
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${page.url()} ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`${page.url()} ${e.message}`));
}

async function open(page: Page, query: string): Promise<void> {
  await page.goto(`/?autostart=1&quality=low&npc=0&${query}`);
  await page.waitForFunction(() => (window as unknown as Debug).__BBOOKS_READY === true, null, { timeout: 180_000 });
}

/** 표지 조회 네트워크 없이 바로 확정되도록 샘플 책을 미리 넣는다. */
async function seedReadingBook(ctx: BrowserContext): Promise<void> {
  await ctx.addInitScript(() => {
    localStorage.setItem(
      'bbooks.book',
      JSON.stringify({
        title: '데미안',
        author: '헤르만 헤세',
        publisher: '민음사',
        coverUrl: 'https://covers.openlibrary.org/b/id/10521265-L.jpg',
      }),
    );
  });
}

/** 책 정보 시트가 열리면 저장된(또는 입력한) 책으로 확정한다. */
async function confirmBook(page: Page): Promise<void> {
  const sheet = page.locator('#book-sheet');
  await expect(sheet).toBeVisible();
  const title = page.locator('#book-title');
  if (!(await title.inputValue()).trim()) {
    await title.fill('데미안');
    await page.locator('#book-author').fill('헤르만 헤세');
    await page.locator('#book-publisher').fill('민음사');
  }
  await page.getByRole('button', { name: '이 책으로 읽기' }).click();
  await expect(sheet).toBeHidden({ timeout: 45_000 });
  await expect(page.locator('.book-card')).toBeVisible();
  await expect(page.locator('.book-card-title')).toHaveText(/./);
}

const me = (p: Page) => p.evaluate(() => (window as unknown as Debug).__BBOOKS.me());
/** 앱이 띄운 알림 기록에 문구가 나타날 때까지 기다린다(렌더링이 느려 4초짜리 토스트를 놓칠 수 있어서). */
const toastSeen = (p: Page, text: string) =>
  p.waitForFunction((t) => (window as unknown as Debug).__BBOOKS.toasts().some((x) => x.includes(t)), text, { timeout: 60_000 });

async function togetherFlow(a: Page, b: Page, query: string): Promise<void> {
  await open(a, query);
  await open(b, query);

  // 서로의 아바타와 이름표가 보인다
  await a.waitForFunction(() => (window as unknown as Debug).__BBOOKS.visiblePeerAvatars().some((p) => p.nameplate));
  await b.waitForFunction(() => (window as unknown as Debug).__BBOOKS.visiblePeerAvatars().some((p) => p.nameplate));
  const meA = await me(a);
  const meB = await me(b);
  expect(meA.id).not.toBe(meB.id);
  // 같은 브라우저라 저장된 닉네임이 같아도 한쪽이 이 탭에서만 다시 뽑아 겹치지 않는다
  await expect.poll(async () => (await me(a)).nickname !== (await me(b)).nickname).toBe(true);
  const peersOfA = await a.evaluate(() => (window as unknown as Debug).__BBOOKS.visiblePeerAvatars());
  expect(peersOfA.map((p) => p.id)).toContain(meB.id);

  // 접속자 수(NPC 제외)
  await expect(a.locator('.count-num')).toHaveText('2');
  await expect(b.locator('.count-num')).toHaveText('2');

  // 들어온 알림: 먼저 있던 A에게 B가 들어왔다고 뜬다
  const nickB = (await me(b)).nickname;
  await toastSeen(a, `${nickB}님이 들어왔어요`);

  // 눈인사: A가 누르면 B에게 알림
  const nickA = (await me(a)).nickname;
  await a.getByRole('button', { name: /눈인사/ }).click();
  await toastSeen(b, `${nickA}님이 눈인사했어요`);
  // 화면에 실제 토스트로도 뜬다(한 번은 DOM으로 확인)
  await expect(a.locator('.toast', { hasText: '눈인사를 건넸어요' })).toBeAttached();

  // 책 펼치기: 책 정보 확정 후 B의 상태가 A에게 "읽기"로 보인다
  await b.getByRole('button', { name: /책 펼치기/ }).click();
  await confirmBook(b);
  await a.waitForFunction((id) => (window as unknown as Debug).__BBOOKS.peers().find((p) => p.id === id)?.state === 'read', meB.id);

  // 나가기: B를 닫으면 A의 접속자 수가 1로, 나갔다는 알림
  await b.close();
  await expect(a.locator('.count-num')).toHaveText('1', { timeout: 30_000 });
  await toastSeen(a, `${nickB}님이 나갔어요`);
}

test.describe('함께 있기', () => {
  test('Local 모드: 같은 브라우저 탭 2개가 서로를 본다', async ({ browser }) => {
    const errors: string[] = [];
    const ctx = await browser.newContext();
    await seedReadingBook(ctx);
    const a = await ctx.newPage();
    const b = await ctx.newPage();
    watchErrors(a, errors);
    watchErrors(b, errors);
    await togetherFlow(a, b, `room=wonmi&instance=${100 + Math.floor(Math.random() * 800)}`);
    await ctx.close();
    expect(errors).toEqual([]);
  });

  test('ws 모드: 중계 서버로 다른 브라우저끼리 만난다', async ({ browser }) => {
    const errors: string[] = [];
    // 다른 기기처럼 저장소를 나누기 위해 컨텍스트를 따로 연다(BroadcastChannel로는 서로 못 봄)
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    await seedReadingBook(ctxA);
    await seedReadingBook(ctxB);
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();
    watchErrors(a, errors);
    watchErrors(b, errors);
    await togetherFlow(a, b, `presence=ws&ws=ws://localhost:8787&room=wonmi&instance=${100 + Math.floor(Math.random() * 800)}`);
    await ctxA.close();
    await ctxB.close();
    expect(errors).toEqual([]);
  });
});

test.describe('읽기 모드', () => {
  test('키 3으로 들어가 타이머가 오르고, 다른 탭과 함께 읽는 수가 맞고, Esc로 돌아온다', async ({ browser }) => {
    const errors: string[] = [];
    const ctx = await browser.newContext();
    await seedReadingBook(ctx);
    const a = await ctx.newPage();
    const b = await ctx.newPage();
    watchErrors(a, errors);
    watchErrors(b, errors);
    const room = `room=wonmi&instance=${100 + Math.floor(Math.random() * 800)}`;
    // A는 소파에 앉은 채로, B는 서서 시작한다(돌아올 때 sit/stand가 각각 복귀하는지 본다)
    await open(a, `${room}&seat=sofa-2`);
    await open(b, room);
    await expect(a.locator('.count-num')).toHaveText('2');
    expect((await me(a)).state).toBe('sit');
    expect((await me(b)).state).toBe('stand');

    // 진입: 키 3 → 책 정보 확정 → 집중 독서 화면, HUD 숨김, 상태 read
    await a.keyboard.press('3');
    await confirmBook(a);
    const focusA = a.locator('.focus');
    await expect(focusA).toBeVisible();
    await expect(a.locator('.hud')).toHaveClass(/is-hidden/);
    await expect.poll(async () => (await me(a)).state).toBe('read');
    await expect(a.locator('.focus-together')).toHaveText('함께 읽는 중 1명');
    await expect(a.locator('.book-card.is-focus .book-card-title')).toHaveText('데미안');

    // 타이머가 오른다
    const clock = a.locator('.focus-clock');
    const first = await clock.textContent();
    await expect.poll(async () => await clock.textContent(), { timeout: 15_000 }).not.toBe(first);
    await expect(clock).toHaveText(/^00:0\d:\d\d$/);

    // 다른 탭도 읽기 모드로 → 양쪽에 "함께 읽는 중 2명"
    await b.keyboard.press('3');
    await confirmBook(b);
    await expect(b.locator('.focus-together')).toHaveText('함께 읽는 중 2명');
    await expect(a.locator('.focus-together')).toHaveText('함께 읽는 중 2명');
    // A에게 B가 읽는 모습으로 보인다
    const idB = (await me(b)).id;
    await a.waitForFunction((id) => (window as unknown as Debug).__BBOOKS.peers().find((p) => p.id === id)?.state === 'read', idB);

    // Esc로 돌아가기 → A는 다시 앉은 자세, HUD 복귀, B의 수는 1명
    await a.keyboard.press('Escape');
    await expect(focusA).toBeHidden();
    await expect(a.locator('.hud')).not.toHaveClass(/is-hidden/);
    await expect.poll(async () => (await me(a)).state).toBe('sit');
    await expect(b.locator('.focus-together')).toHaveText('함께 읽는 중 1명');
    // 오늘 읽은 시간이 저장됐다
    const saved = await a.evaluate(() => JSON.parse(localStorage.getItem('bbooks.reading') ?? 'null'));
    expect(saved?.todaySec ?? 0).toBeGreaterThan(0);

    // B는 "돌아가기" 버튼으로 → 서 있는 자세로 복귀
    await b.getByRole('button', { name: /돌아가기/ }).click();
    await expect.poll(async () => (await me(b)).state).toBe('stand');

    await ctx.close();
    expect(errors).toEqual([]);
  });
});

test.describe('접근성·소리·PWA', () => {
  test('키보드로 들어가 둘러보고, 소리를 켜고, 걷고·앉고, 읽기 모드를 오간다', async ({ browser }) => {
    const errors: string[] = [];
    // 시스템 "동작 줄이기"를 켠 상태로 연다
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    await seedReadingBook(ctx);
    // 키보드 이동은 설정에서 켜는 기능이라 미리 켜 둔다(첫 안내도 이미 본 것으로)
    await ctx.addInitScript(() => {
      if (!localStorage.getItem('bbooks.settings')) localStorage.setItem('bbooks.settings', JSON.stringify({ keyboardMove: true, introDismissed: true }));
    });
    const page = await ctx.newPage();
    watchErrors(page, errors);
    await page.goto(`/?quality=low&npc=0&room=wonmi&instance=${100 + Math.floor(Math.random() * 800)}`);

    // 캔버스 설명
    const canvas = page.locator('#scene');
    await expect(canvas).toHaveAttribute('role', 'img');
    await expect(canvas).toHaveAttribute('aria-label', /서점/);

    // 시작 화면: Tab으로 "들어가기"에 가서 Enter
    await page.keyboard.press('Tab');
    await expect(page.locator('#start-enter')).toBeFocused();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => (window as unknown as Debug).__BBOOKS_READY === true, null, { timeout: 180_000 });
    await expect(page.locator('html')).toHaveClass(/reduce-motion/);

    // Tab 순회: 모든 정지점이 이름(aria-label 또는 글자)을 갖고, 포커스 링이 보인다
    const stops: string[] = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const name = el.getAttribute('aria-label') || el.textContent?.trim() || '';
        const target = el.closest('.pill-select') ?? el;
        const ring = getComputedStyle(target).outlineStyle !== 'none' && parseFloat(getComputedStyle(target).outlineWidth) > 0;
        return { name, ring };
      });
      if (!info) continue;
      expect(info.name, 'Tab 정지점에 이름이 있다').not.toBe('');
      expect(info.ring, `${info.name}에 포커스 링이 보인다`).toBe(true);
      stops.push(info.name);
    }
    for (const want of ['서점에서 나가기', '서점 소리 켜기', '설정 열기', '눈인사 (단축키 1)']) expect(stops).toContain(want);
    await expect(page.locator('.pill-room')).toHaveText('원미서가');
    await expect(page.locator('.count-cap')).toHaveText('/20');

    // 설정 시트: 키보드로 열고 Esc로 닫으면 포커스가 버튼으로 돌아온다
    const settingsBtn = page.getByRole('button', { name: '설정 열기' });
    await settingsBtn.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#settings')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#settings')).toBeHidden();
    await expect(settingsBtn).toBeFocused();

    // 소리: 키보드로 켜면 AudioContext가 돌고 1.5초 동안 커진다, 끄면 다시 0으로
    const soundBtn = page.getByRole('button', { name: '서점 소리 켜기' });
    await soundBtn.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: '서점 소리 끄기' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __BBOOKS: { sound(): { state: string } } }).__BBOOKS.sound().state)).toBe('running');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __BBOOKS: { sound(): { gain: number } } }).__BBOOKS.sound().gain)).toBeGreaterThan(0.7);
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __BBOOKS: { sound(): { gain: number } } }).__BBOOKS.sound().gain)).toBeLessThan(0.01);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    // 바닥 클릭 → 그 자리로 걸어간다(시작 자리에서 보이는 빈 바닥, 드래그와 구분되는 짧은 클릭)
    const target = { tx: 1.95, tz: -0.35 };
    const spot = await page.evaluate(([x, z]) => (window as unknown as Debug).__BBOOKS.project(x, 0, z), [target.tx, target.tz]);
    expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, [spot.x, spot.y])).toBe('scene');
    await page.mouse.click(spot.x, spot.y);
    await expect.poll(async () => {
      const p = (await me(page)).position;
      return Math.hypot(p[0] - target.tx, p[2] - target.tz);
    }, { timeout: 60_000 }).toBeLessThan(0.3);

    // WASD로 걷기
    const before = await me(page);
    await page.keyboard.down('w');
    await expect.poll(async () => {
      const p = (await me(page)).position;
      return Math.hypot(p[0] - before.position[0], p[2] - before.position[2]);
    }, { timeout: 30_000 }).toBeGreaterThan(0.05);
    await page.keyboard.up('w');

    // 의자·벤치 클릭 → 가장 가까운 빈 자리로 걸어가 앉는다(지금 화면에 보이는 자리 중 하나)
    const seat = await page.evaluate(() => {
      const b = (window as unknown as Debug).__BBOOKS;
      for (const st of b.seats()) {
        const q = b.project(st.x, st.y + 0.1, st.z);
        if (q.x > 40 && q.y > 80 && q.x < innerWidth - 40 && q.y < innerHeight - 120 && document.elementFromPoint(q.x, q.y)?.id === 'scene') return { id: st.id, ...q };
      }
      return null;
    });
    expect(seat, '화면에 보이는 앉을 자리가 있다').not.toBeNull();
    await page.mouse.click(seat!.x, seat!.y);
    await expect.poll(async () => (await me(page)).state, { timeout: 90_000 }).toBe('sit');
    expect((await me(page)).seatId).not.toBeNull();

    // 1: 눈인사, 3: 읽기 모드(HUD는 Tab으로도 닿지 않음), Esc: 돌아가기
    await page.keyboard.press('1');
    await toastSeen(page, '눈인사를 건넸어요');
    await page.keyboard.press('3');
    await confirmBook(page);
    await expect(page.locator('.focus')).toBeVisible();
    await expect(page.getByRole('button', { name: /돌아가기/ })).toBeFocused();
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('.hud'))).toBe(false);
    }
    await page.keyboard.press('Escape');
    await expect(page.locator('.focus')).toBeHidden();
    await expect.poll(async () => (await me(page)).state).toBe('sit');

    // PWA: manifest와 서비스워커(빌드 결과물에서만 등록)
    const manifest = await page.evaluate(async () => {
      const href = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href;
      return (await fetch(href)).json();
    });
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(scope).toBe('http://localhost:4173/');

    await ctx.close();
    expect(errors).toEqual([]);
  });
});
