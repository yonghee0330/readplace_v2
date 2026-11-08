// NPC 독자: 로컬 연출. 서가 앞에 서서 최근 베스트셀러를 읽고, 가끔 페이지를 넘긴다.
// 접속자 수·알림에서 빠진다. 머리 위 책 배지를 누르면 표지·소개를 볼 수 있다.
// 서점지기는 카운터 안쪽 하이체어에 앉아 손님을 맞이한다(앞치마·안내 명찰).
import { Rng } from '../core/rng';
import { HAIR_STYLES, OUTFIT_COLORS } from '../core/storage';
import { randomNickname } from '../net/nickname';
import type { HairStyle } from '../net/presence';
import type { Seat, SpaceId } from '../scene/layout';
import { HIP_Y } from './avatar';
import { BESTSELLERS } from './bestsellers';
import type { Actor, Crowd } from './crowd';

/** 서서 읽는 자리(서가 앞) 또는 앉아 맞이하는 자리. */
export interface NpcSpot {
  id: string;
  space: SpaceId;
  x: number;
  z: number;
  ry: number;
  /** 있으면 이 좌석에 앉는다 */
  seatId?: string;
  y?: number;
  /** 서점지기: 앞치마·명찰, 책 없이 앉아 손님 맞이 */
  keeper?: boolean;
  nickname?: string;
  color?: string;
  hair?: HairStyle;
}

/** 손님용 카운터 앞 하이체어 */
export const COUNTER_FRONT_SEAT = 'counter-1';

/** 중앙 홀 독자 2 · 서점지기 1 · 세미나 1 · 계단식 강연 1 */
export const NPC_SPOTS: NpcSpot[] = [
  // 허브 왼쪽 서가 통로
  { id: 'npc-hub-a', space: 'hub', x: -3.55, z: -0.15, ry: -Math.PI / 2 },
  // 허브 오른쪽 서가 통로
  { id: 'npc-hub-b', space: 'hub', x: 3.55, z: 2.35, ry: Math.PI / 2 },
  // 카운터 안쪽 하이체어 — 손님을 맞이하는 서점지기
  {
    id: 'npc-hub-keeper',
    space: 'hub',
    x: -2.1,
    z: 3.1,
    ry: Math.PI + 0.15,
    y: 0.72,
    seatId: 'counter-2',
    keeper: true,
    nickname: '서점지기',
    color: '#c4b5a5',
    hair: 'bob',
  },
  // 세미나실 왼쪽 서가
  { id: 'npc-sem-a', space: 'seminar', x: -2.35, z: -1.35, ry: -Math.PI / 2 },
  // 계단식 강연 — 오른쪽 둘레 서가 앞(객석·카페트를 봄)
  { id: 'npc-lec-a', space: 'lecture', x: 2.85, z: 1.15, ry: -Math.PI / 2 },
];

export interface NpcReader {
  actor: Actor;
  space: SpaceId;
  spotId: string;
  /** 서점지기 */
  keeper?: boolean;
  /** 기본 앉은 방향(좌석 ry) */
  homeRy?: number;
  /** 이 시각(초) 이후 기본 방향으로 되돌림 */
  faceUntil?: number;
}

export function placeAtSeat(actor: Actor, seat: Seat): void {
  actor.root.position.set(seat.x, seat.y - HIP_Y, seat.z);
  actor.root.rotation.y = seat.ry;
}

function placeStanding(actor: Actor, spot: NpcSpot): void {
  actor.root.position.set(spot.x, 0, spot.z);
  actor.root.rotation.y = spot.ry;
}

export function findKeeper(npcs: NpcReader[]): NpcReader | undefined {
  return npcs.find((n) => n.keeper);
}

/** 시드로 고정 NPC를 두고, 독자는 서로 다른 베스트셀러를 쥐게 한다. */
export function spawnNpcs(crowd: Crowd, rng: Rng): NpcReader[] {
  const r = rng.fork('npc');
  const shelf = [...BESTSELLERS];
  for (let i = shelf.length - 1; i > 0; i--) {
    const j = Math.floor(r.float() * (i + 1));
    [shelf[i], shelf[j]] = [shelf[j], shelf[i]];
  }

  let bookI = 0;
  return NPC_SPOTS.map((spot, i) => {
    if (spot.keeper) {
      const actor = crowd.add(
        `npc-${i}`,
        'npc',
        spot.nickname || '서점지기',
        {
          color: spot.color || '#c4b5a5',
          hair: spot.hair || 'bob',
          apron: true,
          badge: '안내',
        },
        true,
      );
      const seat: Seat = {
        id: spot.seatId || `keeper-${i}`,
        x: spot.x,
        z: spot.z,
        ry: spot.ry,
        y: spot.y ?? 0.72,
        approach: 1,
      };
      placeAtSeat(actor, seat);
      actor.setState('sit', seat.id);
      actor.root.visible = false;
      return {
        actor,
        space: spot.space,
        spotId: spot.id,
        keeper: true,
        homeRy: spot.ry,
      };
    }

    const book = shelf[bookI++ % shelf.length]!;
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

/** 서점지기가 기본 방향을 본 채 눈인사. 성공하면 true. */
export function keeperBowHome(npcs: NpcReader[]): boolean {
  const k = findKeeper(npcs);
  if (!k?.actor.root.visible) return false;
  if (k.homeRy !== undefined) k.actor.root.rotation.y = k.homeRy;
  k.faceUntil = undefined;
  k.actor.avatar.anim.bow();
  return true;
}

/** 서점지기가 대상을 보고 눈인사(알림 없음). t는 경과 초. */
export function keeperBowToward(npcs: NpcReader[], x: number, z: number, t: number): boolean {
  const k = findKeeper(npcs);
  if (!k?.actor.root.visible) return false;
  const dx = x - k.actor.root.position.x;
  const dz = z - k.actor.root.position.z;
  if (Math.hypot(dx, dz) > 0.02) k.actor.root.rotation.y = Math.atan2(dx, dz);
  k.actor.avatar.anim.bow();
  k.faceUntil = t + 1.0;
  return true;
}

/** 눈인사 후 기본 앉은 방향으로 되돌린다. */
export function updateKeeperFacing(npcs: NpcReader[], t: number, dt: number): void {
  for (const n of npcs) {
    if (!n.keeper || n.homeRy === undefined || n.faceUntil === undefined) continue;
    if (t < n.faceUntil) continue;
    const cur = n.actor.root.rotation.y;
    let d = n.homeRy - cur;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) < 0.02) {
      n.actor.root.rotation.y = n.homeRy;
      n.faceUntil = undefined;
    } else {
      n.actor.root.rotation.y = cur + d * Math.min(1, 5 * dt);
    }
  }
}

/** 현재 공간의 NPC만 보이게. enabled=false면 전부 숨김. */
export function syncNpcVisibility(npcs: NpcReader[], space: SpaceId, enabled: boolean): void {
  for (const n of npcs) n.actor.root.visible = enabled && n.space === space;
}

/** @deprecated syncNpcVisibility 사용 */
export function setNpcsVisible(npcs: NpcReader[], visible: boolean): void {
  for (const n of npcs) n.actor.root.visible = visible && n.space === 'hub';
}
