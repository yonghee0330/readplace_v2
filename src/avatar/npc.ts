// NPC 독자: 로컬 연출. 자리에 앉아 최근 베스트셀러를 읽고, 가끔 페이지를 넘긴다.
// 접속자 수·알림에서 빠진다. 머리 위 책 배지를 누르면 표지·소개를 볼 수 있다.
import { Rng } from '../core/rng';
import { HAIR_STYLES, OUTFIT_COLORS } from '../core/storage';
import { randomNickname } from '../net/nickname';
import { SEATS, type Seat } from '../scene/layout';
import { HIP_Y } from './avatar';
import { BESTSELLERS } from './bestsellers';
import type { Actor, Crowd } from './crowd';

export function placeAtSeat(actor: Actor, seat: Seat): void {
  actor.root.position.set(seat.x, seat.y - HIP_Y, seat.z);
  actor.root.rotation.y = seat.ry;
}

/** 시드로 2~4명을 고른 자리에 앉히고, 서로 다른 베스트셀러를 쥐게 한다. */
export function spawnNpcs(crowd: Crowd, rng: Rng): Actor[] {
  const r = rng.fork('npc');
  const count = r.int(2, 4);
  // 창가 자리를 먼저(서점 분위기), 나머지는 섞어서
  const seats = [...SEATS].sort((a, b) => (a.id.startsWith('sofa') ? 1 : 0) - (b.id.startsWith('sofa') ? 1 : 0) || r.float() - 0.5);
  const picked: Seat[] = [];
  for (const s of seats) {
    if (picked.length >= count) break;
    // 바로 옆자리에 붙어 앉지 않게 한 자리씩 띄운다(소파 가운데는 비워 둠)
    if (s.id === 'sofa-2' || (s.id === 'chair-2' && picked.some((p) => p.id === 'chair-1'))) continue;
    if (r.chance(0.8)) picked.push(s);
  }

  // 같은 책이 겹치지 않게 후보를 섞은 뒤 앞에서부터 쓴다
  const shelf = [...BESTSELLERS];
  for (let i = shelf.length - 1; i > 0; i--) {
    const j = Math.floor(r.float() * (i + 1));
    [shelf[i], shelf[j]] = [shelf[j], shelf[i]];
  }

  return picked.map((seat, i) => {
    const book = shelf[i % shelf.length]!;
    const nick = randomNickname(() => r.float());
    const a = crowd.add(`npc-${i}`, 'npc', nick, { color: r.pick(OUTFIT_COLORS), hair: r.pick(HAIR_STYLES) }, true);
    placeAtSeat(a, seat);
    a.setState('read', seat.id);
    a.setReadingBook(
      { title: book.title, author: book.author, publisher: book.publisher, coverUrl: null },
      book.blurb,
    );
    return a;
  });
}

export function setNpcsVisible(npcs: Actor[], visible: boolean): void {
  for (const a of npcs) a.root.visible = visible;
}
