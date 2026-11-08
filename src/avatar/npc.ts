// NPC 독자: 로컬 연출. 서가 앞에 서서 최근 베스트셀러를 읽고, 가끔 페이지를 넘긴다.
// 접속자 수·알림에서 빠진다. 머리 위 책 배지를 누르면 표지·소개를 볼 수 있다.
// 서점지기는 카운터에서 책을 읽다 손님이 앉으면 책을 내려놓고 응대한다.
// 한 시간에 한 번 1분간 서가를 돌며 챙긴 뒤 돌아온다.
import { Rng } from '../core/rng';
import { HAIR_STYLES, OUTFIT_COLORS } from '../core/storage';
import { randomNickname } from '../net/nickname';
import type { HairStyle } from '../net/presence';
import type { NavGrid, Pt } from '../controls/pathfinding';
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
  /** 서점지기: 앞치마·명찰 */
  keeper?: boolean;
  nickname?: string;
  color?: string;
  hair?: HairStyle;
}

/** 손님용 카운터 앞 하이체어 */
export const COUNTER_FRONT_SEAT = 'counter-1';

/** 기본: 1시간마다 1분 순회. debug면 더 짧게. */
export const KEEPER_PATROL_INTERVAL = 3600;
export const KEEPER_PATROL_DURATION = 60;
const KEEPER_WALK = 0.9;
const STAND_DUR = 0.5;
const SIT_DUR = 0.55;

/** 허브 서가 앞을 한 바퀴 도는 지점(시계 방향, 카운터 근처에서 시작). */
const HUB_SHELF_LOOP: Pt[] = [
  { x: -3.55, z: 2.5 },
  { x: -3.55, z: 0.4 },
  { x: -3.55, z: -1.6 },
  { x: -1.8, z: -2.45 },
  { x: 0.2, z: -2.45 },
  { x: 2.0, z: -2.45 },
  { x: 3.55, z: -1.6 },
  { x: 3.55, z: 0.4 },
  { x: 3.55, z: 2.35 },
  { x: 1.2, z: 2.7 },
  { x: -1.5, z: 2.95 },
];

type KeeperPhase = 'read' | 'stand' | 'patrol' | 'return' | 'sit';

/** 중앙 홀 독자 2 · 서점지기 1 · 세미나 1 · 계단식 강연 1 */
export const NPC_SPOTS: NpcSpot[] = [
  { id: 'npc-hub-a', space: 'hub', x: -3.55, z: -0.15, ry: -Math.PI / 2 },
  { id: 'npc-hub-b', space: 'hub', x: 3.55, z: 2.35, ry: Math.PI / 2 },
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
  { id: 'npc-sem-a', space: 'seminar', x: -2.35, z: -1.35, ry: -Math.PI / 2 },
  { id: 'npc-lec-a', space: 'lecture', x: 2.85, z: 1.15, ry: -Math.PI / 2 },
];

export interface NpcReader {
  actor: Actor;
  space: SpaceId;
  spotId: string;
  keeper?: boolean;
  homeRy?: number;
  faceUntil?: number;
  /** 순회 중에도 카운터 자리를 비우지 않음 */
  reserveSeatId?: string;
  homeSeat?: Seat;
  patrolPhase?: KeeperPhase;
  nextPatrolAt?: number;
  patrolUntil?: number;
  patrolPath?: Pt[];
  patrolLoopI?: number;
  phaseT?: number;
  phaseFrom?: { x: number; y: number; z: number; ry: number };
  phaseTo?: { x: number; y: number; z: number; ry: number };
  keeperBook?: { title: string; author: string; publisher: string; blurb: string };
  /** 카운터 앞 손님 응대 중(책 내려놓음) */
  attending?: boolean;
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

export function keeperAtDesk(npcs: NpcReader[]): boolean {
  const k = findKeeper(npcs);
  return !!k && (!k.patrolPhase || k.patrolPhase === 'read');
}

function seatApproach(seat: Seat): Pt {
  if (seat.from) return { x: seat.from.x, z: seat.from.z };
  const forward = seat.approach;
  return {
    x: seat.x + Math.sin(seat.ry) * 0.55 * forward,
    z: seat.z + Math.cos(seat.ry) * 0.55 * forward,
  };
}

function angleLerp(a: number, b: number, k: number): number {
  let d = b - a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return a + d * k;
}

function resumeReading(k: NpcReader): void {
  const seat = k.homeSeat!;
  placeAtSeat(k.actor, seat);
  k.patrolPhase = 'read';
  k.patrolPath = [];
  k.faceUntil = undefined;
  k.attending = false;
  k.actor.setState('read', seat.id);
  const b = k.keeperBook;
  if (b) {
    k.actor.setReadingBook(
      { title: b.title, author: b.author, publisher: b.publisher, coverUrl: null },
      b.blurb,
    );
  }
}

/** 책을 내려놓고 손님을 본다. */
function putBookDown(k: NpcReader): void {
  const seat = k.homeSeat!;
  k.attending = true;
  k.faceUntil = undefined;
  k.actor.setState('sit', seat.id);
}

function buildPath(grid: NavGrid, from: Pt, to: Pt): Pt[] {
  const path = grid.findPath(from, to);
  if (!path || path.length < 2) return [to];
  return path.slice(1);
}

function appendLoopSegment(k: NpcReader, grid: NavGrid): void {
  const loop = HUB_SHELF_LOOP;
  const i = k.patrolLoopI ?? 0;
  const from = { x: k.actor.root.position.x, z: k.actor.root.position.z };
  const to = loop[i % loop.length]!;
  k.patrolPath = [...(k.patrolPath ?? []), ...buildPath(grid, from, to)];
  k.patrolLoopI = (i + 1) % loop.length;
}

function followPath(k: NpcReader, dt: number): boolean {
  const path = k.patrolPath ?? [];
  let remaining = KEEPER_WALK * dt;
  const root = k.actor.root;
  while (remaining > 0 && path.length) {
    const target = path[0]!;
    const dx = target.x - root.position.x;
    const dz = target.z - root.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.04) {
      path.shift();
      continue;
    }
    const step = Math.min(d, remaining);
    root.position.x += (dx / d) * step;
    root.position.z += (dz / d) * step;
    root.position.y = 0;
    remaining -= step;
    root.rotation.y = angleLerp(root.rotation.y, Math.atan2(dx, dz), Math.min(1, 12 * dt));
    if (step >= d - 1e-4) path.shift();
  }
  k.patrolPath = path;
  k.actor.updateSpeed(dt);
  if (path.length) k.actor.setState('walk', null);
  else k.actor.setState('stand', null);
  return path.length === 0;
}

function startStand(k: NpcReader): void {
  const seat = k.homeSeat!;
  const ap = seatApproach(seat);
  const root = k.actor.root;
  k.phaseFrom = { x: root.position.x, y: root.position.y, z: root.position.z, ry: root.rotation.y };
  k.phaseTo = { x: ap.x, y: 0, z: ap.z, ry: Math.atan2(ap.x - root.position.x, ap.z - root.position.z) };
  k.phaseT = 0;
  k.patrolPhase = 'stand';
  k.faceUntil = undefined;
  k.actor.setReadingBook(null);
  k.actor.setState('stand', null);
}

function startSit(k: NpcReader): void {
  const seat = k.homeSeat!;
  const root = k.actor.root;
  k.phaseFrom = { x: root.position.x, y: 0, z: root.position.z, ry: root.rotation.y };
  k.phaseTo = { x: seat.x, y: seat.y - HIP_Y, z: seat.z, ry: seat.ry };
  k.phaseT = 0;
  k.patrolPhase = 'sit';
  k.actor.setState('sit', seat.id);
}

function lerpPhase(k: NpcReader, dt: number, dur: number): boolean {
  k.phaseT = (k.phaseT ?? 0) + dt / dur;
  const u = Math.min(1, k.phaseT);
  const e = u * u * (3 - 2 * u);
  const a = k.phaseFrom!;
  const b = k.phaseTo!;
  const root = k.actor.root;
  root.position.set(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e, a.z + (b.z - a.z) * e);
  root.rotation.y = angleLerp(a.ry, b.ry, Math.min(1, e * 1.6));
  k.actor.updateSpeed(dt);
  return u >= 1;
}

/** 시드로 고정 NPC를 두고, 독자·서점지기는 베스트셀러를 쥐게 한다. */
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
      const book = shelf[bookI++ % shelf.length]!;
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
        from: { x: -1.5, z: 3.05 },
      };
      placeAtSeat(actor, seat);
      actor.setState('read', seat.id);
      actor.setReadingBook(
        { title: book.title, author: book.author, publisher: book.publisher, coverUrl: null },
        book.blurb,
      );
      actor.root.visible = false;
      return {
        actor,
        space: spot.space,
        spotId: spot.id,
        keeper: true,
        homeRy: spot.ry,
        homeSeat: seat,
        reserveSeatId: seat.id,
        patrolPhase: 'read' as KeeperPhase,
        keeperBook: {
          title: book.title,
          author: book.author,
          publisher: book.publisher,
          blurb: book.blurb,
        },
      };
    }

    const book = shelf[bookI++ % shelf.length]!;
    const nick = randomNickname(() => r.float());
    const actor = crowd.add(`npc-${i}`, 'npc', nick, { color: r.pick(OUTFIT_COLORS), hair: r.pick(HAIR_STYLES) }, true);
    placeStanding(actor, spot);
    actor.setState('read', null);
    actor.setReadingBook(
      { title: book.title, author: book.author, publisher: book.publisher, coverUrl: null },
      book.blurb,
    );
    actor.root.visible = false;
    return { actor, space: spot.space, spotId: spot.id };
  });
}

/** 서점지기가 자리에 있을 때만 기본 방향 눈인사. */
export function keeperBowHome(npcs: NpcReader[]): boolean {
  const k = findKeeper(npcs);
  if (!k?.actor.root.visible || !keeperAtDesk(npcs)) return false;
  if (k.homeRy !== undefined) k.actor.root.rotation.y = k.homeRy;
  k.faceUntil = undefined;
  k.actor.avatar.anim.bow();
  return true;
}

/**
 * 카운터 앞 손님 응대: 책을 내려놓고 바라보며 답한다.
 * guest가 있으면 응대 유지, 없으면 다시 책을 든다.
 * 처음 말을 걸면 true(눈인사 1회).
 */
export function updateKeeperAttend(
  npcs: NpcReader[],
  guest: { x: number; z: number } | null,
  dt: number,
): boolean {
  const k = findKeeper(npcs);
  if (!k?.actor.root.visible || !k.homeSeat || !keeperAtDesk(npcs)) return false;

  if (guest) {
    const dx = guest.x - k.actor.root.position.x;
    const dz = guest.z - k.actor.root.position.z;
    const want = Math.hypot(dx, dz) > 0.02 ? Math.atan2(dx, dz) : k.actor.root.rotation.y;
    const first = !k.attending;
    if (first) {
      putBookDown(k);
      k.actor.root.rotation.y = want;
      k.actor.avatar.anim.bow();
      return true;
    }
    // 응대 중에는 손님을 계속 보고, 책은 내려둔 채
    if (k.actor.avatar.state === 'read') putBookDown(k);
    k.actor.root.rotation.y = angleLerp(k.actor.root.rotation.y, want, Math.min(1, 4 * dt));
    return false;
  }

  if (k.attending) resumeReading(k);
  return false;
}

/** 눈인사 후 기본 앉은 방향으로 되돌린다(응대 중이 아닐 때만). */
export function updateKeeperFacing(npcs: NpcReader[], t: number, dt: number): void {
  for (const n of npcs) {
    if (!n.keeper || n.homeRy === undefined || n.faceUntil === undefined) continue;
    if (n.attending) continue;
    if (n.patrolPhase && n.patrolPhase !== 'read') continue;
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

/**
 * 서점지기 순회: 평소 앉아 독서 → interval마다 duration 동안 서가 한 바퀴 → 자리 복귀.
 * intervalSec/durationSec로 테스트 시 짧게 줄일 수 있다.
 */
export function updateKeeperPatrol(
  npcs: NpcReader[],
  t: number,
  dt: number,
  grid: NavGrid,
  space: SpaceId,
  intervalSec = KEEPER_PATROL_INTERVAL,
  durationSec = KEEPER_PATROL_DURATION,
): void {
  const k = findKeeper(npcs);
  if (!k?.homeSeat) return;
  if (space !== 'hub' || !k.actor.root.visible) {
    if (k.patrolPhase && k.patrolPhase !== 'read') resumeReading(k);
    return;
  }

  if (k.nextPatrolAt === undefined) k.nextPatrolAt = t + intervalSec;
  const phase = k.patrolPhase ?? 'read';

  if (phase === 'read') {
    // 손님 응대 중에는 순회를 미룬다
    if (k.attending) {
      if (t >= k.nextPatrolAt) k.nextPatrolAt = t + 8;
      return;
    }
    if (t >= k.nextPatrolAt) {
      k.patrolUntil = t + durationSec;
      k.patrolLoopI = 0;
      k.patrolPath = [];
      startStand(k);
    }
    return;
  }

  if (phase === 'stand') {
    if (lerpPhase(k, dt, STAND_DUR)) {
      k.patrolPhase = 'patrol';
      appendLoopSegment(k, grid);
      k.actor.setState('walk', null);
    }
    return;
  }

  if (phase === 'patrol') {
    if (t >= (k.patrolUntil ?? 0)) {
      const ap = seatApproach(k.homeSeat);
      const from = { x: k.actor.root.position.x, z: k.actor.root.position.z };
      k.patrolPath = buildPath(grid, from, ap);
      k.patrolPhase = 'return';
      return;
    }
    if (followPath(k, dt)) appendLoopSegment(k, grid);
    return;
  }

  if (phase === 'return') {
    if (followPath(k, dt)) startSit(k);
    return;
  }

  if (phase === 'sit') {
    if (lerpPhase(k, dt, SIT_DUR)) {
      resumeReading(k);
      k.nextPatrolAt = t + intervalSec;
    }
  }
}

/** 현재 공간의 NPC만 보이게. enabled=false면 전부 숨김. */
export function syncNpcVisibility(npcs: NpcReader[], space: SpaceId, enabled: boolean): void {
  for (const n of npcs) {
    const show = enabled && n.space === space;
    if (n.keeper && !show && n.patrolPhase && n.patrolPhase !== 'read') resumeReading(n);
    n.actor.root.visible = show;
  }
}

/** @deprecated syncNpcVisibility 사용 */
export function setNpcsVisible(npcs: NpcReader[], visible: boolean): void {
  for (const n of npcs) n.actor.root.visible = visible && n.space === 'hub';
}
