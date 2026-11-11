// 동시 접속 부하 테스트: 봇 N명이 같은 방에 들어와 돌아다니게 하고
// 서로 보이는지, 정원 초과가 막히는지, 초당 메시지가 얼마나 오가는지, 콘솔 에러가 없는지 잰다.
//
// 사용:
//   npm run loadtest                                 # 기본: Supabase, 봇 6명, 30초, 테스트 전용 방
//   npm run loadtest -- --bots=10 --seconds=40
//   npm run loadtest -- --bots=5 --cap=4             # 정원 4명: 5번째 봇은 "자리가 다 찼어요"여야 한다
//   npm run loadtest -- --presence=local             # 네트워크 없이(같은 브라우저 탭끼리)
//   npx tsx scripts/loadtest.ts --url=https://meta.bbooks.co.kr   # 배포본으로 재기(전후 비교용)
//
// Supabase 모드는 실제 프로젝트의 무료 메시지 한도를 조금 쓴다(봇 6명·30초 ≈ 수천 건, 월 200만 건 중).
// 방 이름은 항상 loadtest-로 시작해 실제 방문객 방과 겹치지 않는다.
// 봇이 한 컴퓨터의 GPU를 나눠 쓰므로 fps는 참고용이다. 결과는 docs/loadtest.json에 쌓인다.
import { chromium, type Page } from 'playwright';
import { preview } from 'vite';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const arg = (name: string, def: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? def;
const BOTS = Math.max(2, Number(arg('bots', '6')));
const SECONDS = Math.max(10, Number(arg('seconds', '30')));
const PRESENCE = arg('presence', 'supabase');
const CAP = Number(arg('cap', '0')) || 0;
const ROOM = `loadtest-${Date.now().toString(36)}`;
const URL_ARG = arg('url', '').replace(/\/$/, '');

interface Counters { sent: number; recv: number }
interface Bot { page: Page; errors: string[]; ws: Counters; full: boolean }

const server = URL_ARG ? null : await preview({ preview: { port: 4175, strictPort: false }, logLevel: 'warn' });
const base = URL_ARG || (server?.resolvedUrls?.local[0]?.replace(/\/$/, '') ?? 'http://localhost:4175');
// 기본은 이 컴퓨터의 GPU(새 헤드리스). SwiftShader는 봇 5~6명부터 입장 하나에 몇 분씩 걸려 쓰기 어렵다.
const browser = process.argv.includes('--swiftshader')
  ? await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  : await chromium.launch({ channel: 'chromium', args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 480, height: 320 } });
// tsx가 함수 이름을 지키려고 넣는 __name 도우미가 페이지 안에는 없어서 미리 둔다
await ctx.addInitScript({ content: 'window.__name = (f) => f;' });
// 같은 브라우저 탭끼리(local 모드) 보낸 메시지 수
await ctx.addInitScript(() => {
  const w = window as unknown as { __LT: { bc: number } };
  w.__LT = { bc: 0 };
  const post = BroadcastChannel.prototype.postMessage;
  BroadcastChannel.prototype.postMessage = function (m: unknown) {
    w.__LT.bc++;
    return post.call(this, m);
  };
});

const query = [
  'autostart=1', 'quality=low', 'npc=0', `room=${ROOM}`, `presence=${PRESENCE}`,
  CAP ? `cap=${CAP}` : '',
].filter(Boolean).join('&');

const bots: Bot[] = [];
const t0 = Date.now();
let measureFrom = 0;
try {
  // 한 명씩 들어온다(동시에 몰리면 SwiftShader가 버거워 타임아웃이 난다)
  for (let i = 0; i < BOTS; i++) {
    const page = await ctx.newPage();
    const bot: Bot = { page, errors: [], ws: { sent: 0, recv: 0 }, full: false };
    page.on('console', (m) => m.type() === 'error' && bot.errors.push(m.text()));
    page.on('pageerror', (e) => bot.errors.push(e.message));
    // 이 방의 broadcast 프레임만 센다(연결 유지 heartbeat·presence 명단은 뺀다).
    // supabase-js는 broadcast를 바이너리 프레임으로, 옛 방식은 "broadcast" 이벤트 JSON으로 보낸다.
    const isBroadcast = (p: string | Buffer) => (typeof p === 'string'
      ? p.includes('"broadcast"') && p.includes(ROOM)
      : p.toString('latin1').includes(`:${ROOM}:`));
    page.on('websocket', (ws) => {
      ws.on('framesent', (f) => { if (measureFrom && isBroadcast(f.payload)) bot.ws.sent++; });
      ws.on('framereceived', (f) => { if (measureFrom && isBroadcast(f.payload)) bot.ws.recv++; });
    });
    await page.goto(`${base}/?${query}`);
    await page.waitForFunction(
      () => (window as unknown as { __BBOOKS_READY?: boolean }).__BBOOKS_READY === true
        || !(document.getElementById('full')?.hidden ?? true),
      null,
      { timeout: 240_000 },
    );
    bot.full = await page.evaluate(() => !(document.getElementById('full')?.hidden ?? true));
    bots.push(bot);
    console.log(`봇 ${i + 1}/${BOTS} ${bot.full ? '정원 초과로 못 들어옴' : '입장'} (${Math.round((Date.now() - t0) / 1000)}초)`);
  }

  const inside = bots.filter((b) => !b.full);
  // 측정 시작: 들어온 봇들이 자리 근처를 오가며 걷는다
  await Promise.all(inside.map((b) => b.page.evaluate(() => { (window as unknown as { __LT: { bc: number } }).__LT.bc = 0; })));
  measureFrom = Date.now();
  await Promise.all(inside.map((b, i) => b.page.evaluate(({ seconds, seed }) => {
    const api = (window as unknown as { __BBOOKS: { seats(): { x: number; z: number }[]; walkTo(x: number, z: number): unknown } }).__BBOOKS;
    const spots = api.seats();
    let k = seed;
    const until = performance.now() + seconds * 1000;
    // 봇의 1/3쯤은 늘 걷고 나머지는 가끔 걷는다(실제 방문객처럼)
    const busy = seed % 3 === 0;
    const step = () => {
      if (performance.now() > until || !spots.length) return;
      const s = spots[(k = (k * 7 + 3) % spots.length)];
      api.walkTo(s.x + 0.6, s.z + 0.6);
      setTimeout(step, busy ? 2500 : 6000 + (k % 5) * 1000);
    };
    step();
    // fps(참고용)
    const w = window as unknown as { __LT: { frames: number } };
    w.__LT.frames = 0;
    const tick = () => { w.__LT.frames++; if (performance.now() < until) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }, { seconds: SECONDS, seed: i + 1 })));
  await new Promise((r) => setTimeout(r, SECONDS * 1000 + 1500));
  const elapsed = (Date.now() - measureFrom) / 1000;

  const rows = await Promise.all(inside.map(async (b) => {
    const r = await b.page.evaluate(() => {
      const w = window as unknown as { __LT: { bc: number; frames: number }; __BBOOKS: { peers(): unknown[] } };
      return { peers: w.__BBOOKS.peers().length, bc: w.__LT.bc, frames: w.__LT.frames };
    });
    return { ...r, wsSent: b.ws.sent, wsRecv: b.ws.recv, errors: b.errors };
  }));

  const expectPeers = inside.length - 1;
  const sent = PRESENCE === 'local' ? rows.reduce((s, r) => s + r.bc, 0) : rows.reduce((s, r) => s + r.wsSent, 0);
  const recv = PRESENCE === 'local' ? sent * expectPeers : rows.reduce((s, r) => s + r.wsRecv, 0);
  const billable = (sent + recv) / elapsed;
  const errors = [...rows.flatMap((r) => r.errors), ...bots.filter((b) => b.full).flatMap((b) => b.errors)];
  const result = {
    at: new Date().toISOString(),
    target: URL_ARG || 'local build',
    presence: PRESENCE,
    room: ROOM,
    bots: BOTS,
    cap: CAP || null,
    admitted: inside.length,
    rejected: bots.length - inside.length,
    seconds: Math.round(elapsed),
    peersSeen: rows.map((r) => r.peers),
    allSeeEachOther: rows.every((r) => r.peers === expectPeers),
    sentPerSec: +(sent / elapsed).toFixed(1),
    receivedPerSec: +(recv / elapsed).toFixed(1),
    /** Supabase 과금 기준(보낸 1건 + 받은 사람 수). 무료 플랜 한도 초당 100건 */
    billablePerSec: +billable.toFixed(1),
    /** 이 상태가 하루 8시간 이어질 때 한 달(30일) 메시지 수. 무료 한도 200만 건 */
    monthlyIf8hPerDay: Math.round(billable * 3600 * 8 * 30),
    fpsAvg: +(rows.reduce((s, r) => s + r.frames, 0) / rows.length / elapsed).toFixed(1),
    consoleErrors: errors.length,
  };
  console.log(result);
  if (errors.length) console.log('콘솔 에러:', errors.slice(0, 10));

  const out = resolve('docs/loadtest.json');
  const prev = existsSync(out) ? (JSON.parse(readFileSync(out, 'utf8')) as unknown[]) : [];
  writeFileSync(out, `${JSON.stringify([...prev, result], null, 2)}\n`);

  const okCap = CAP ? result.admitted === Math.min(CAP, BOTS) : result.rejected === 0;
  const pass = result.allSeeEachOther && okCap && errors.length === 0 && (PRESENCE !== 'supabase' || billable < 100);
  console.log(pass ? '통과' : '미통과');
  process.exitCode = pass ? 0 : 1;
} finally {
  await browser.close();
  if (server) await new Promise<void>((r) => server.httpServer.close(() => r()));
}
