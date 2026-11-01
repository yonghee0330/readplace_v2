// e2e: 같은 방에 탭 2개 → 서로의 아바타·이름표·눈인사 알림·접속자 수 확인. Local(BroadcastChannel)과 ws 두 모드.
// 모든 페이지의 콘솔 에러가 0개인지도 함께 확인한다.
import { expect, test, type Page } from '@playwright/test';

interface Debug {
  __BBOOKS_READY?: boolean;
  __BBOOKS: {
    me(): { id: string; nickname: string; state: string; seatId: string | null };
    peers(): { id: string; nickname: string; state: string; seatId: string | null }[];
    visiblePeerAvatars(): { id: string; nickname: string; nameplate: boolean }[];
    toasts(): string[];
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

  // 책 펼치기: B의 상태가 A에게 "읽기"로 보인다
  await b.getByRole('button', { name: /책 펼치기/ }).click();
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
