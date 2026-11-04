// NPC 독자: 로컬 연출. 서가 앞에 서서 최근 베스트셀러를 읽고, 가끔 페이지를 넘긴다.
// 접속자 수·알림에서 빠진다. 머리 위 책 배지를 누르면 표지·소개를 볼 수 있다.
import { Rng } from '../core/rng';
import { HAIR_STYLES, OUTFIT_COLORS } from '../core/storage';
import { randomNickname } from '../net/nickname';
import type { Seat, SpaceId } from '../scene/layout';
import { HIP_Y } from './avatar';
import { BESTSELLERS } from './bestsellers';
import type { Actor, Crowd } from './crowd';

/** 서서 읽는 자리(서가 앞). 앉지 않는다. */
export interface NpcSpot {
  id: string;
  space: SpaceId;
  x: number;
  z: number;
  ry: number;
}

/** 중앙 홀 2 · 세미나 1 · 계단식 강연(서가 옆) 1 */
export const NPC_SPOTS: NpcSpot[] = [
  // 허브 왼쪽 서가 통로
  { id: 'npc-hub-a', space: 'hub', x: -3.55, z: -0.15, ry: -Math.PI / 2 },
  // 허브 오른쪽 서가 통로
  { id: 'npc-hub-b', space: 'hub', x: 3.55, z: 2.35, ry: Math.PI / 2 },
  // 세미나실 왼쪽 서가
  { id: 'npc-sem-a', space: 'seminar', x: -2.35, z: -1.35, ry: -Math.PI / 2 },
  // 계단식 강연 — 오른쪽 둘레 서가 앞(객석·카페트를 봄)
  { id: 'npc-lec-a', space: 'lecture', x: 2.85, z: 1.15, ry: -Math.PI / 2 },
];

export interface NpcReader {
  actor: Actor;
  space: SpaceId;
  spotId: string;
}

export function placeAtSeat(actor: Actor, seat: Seat): void {
  actor.root.position.set(seat.x, seat.y - HIP_Y, seat.z);
  actor.root.rotation.y = seat.ry;
}

function placeStanding(actor: Actor, spot: NpcSpot): void {
  actor.root.position.set(spot.x, 0, spot.z);
  actor.root.rotation.y = spot.ry;
}

/** 시드로 고정 4명(공간별)을 서가 앞에 세우고, 서로 다른 베스트셀러를 쥐게 한다. */
export function spawnNpcs(crowd: Crowd, rng: Rng): NpcReader[] {
  const r = rng.fork('npc');
  const shelf = [...BESTSELLERS];
  for (let i = shelf.length - 1; i > 0; i--) {
    const j = Math.floor(r.float() * (i + 1));
    [shelf[i], shelf[j]] = [shelf[j], shelf[i]];
  }

  return NPC_SPOTS.map((spot, i) => {
    const book = shelf[i % shelf.length]!;
    const nick = randomNickname(() => r.float());
    const actor = crowd.add(`npc-${i}`, 'npc', nick, { color: r.pick(OUTFIT_COLORS), hair: r.pick(HAIR_STYLES) }, true);
    placeStanding(actor, spot);
    // seatId null → 서서 읽기
    actor.setState('read', null);
    actor.setReadingBook(
      { title: book.title, author: book.author, publisher: book.publisher, coverUrl: null },
      book.blurb,
    );
    actor.root.visible = false;
    return { actor, space: spot.space, spotId: spot.id };
  });
}

/** 현재 공간의 NPC만 보이게. enabled=false면 전부 숨김. */
export function syncNpcVisibility(npcs: NpcReader[], space: SpaceId, enabled: boolean): void {
  for (const n of npcs) n.actor.root.visible = enabled && n.space === space;
}

/** @deprecated syncNpcVisibility 사용 */
export function setNpcsVisible(npcs: NpcReader[], visible: boolean): void {
  for (const n of npcs) n.actor.root.visible = visible && n.space === 'hub';
}
