// 장면 속 모든 아바타(나, 다른 방문객, NPC)를 관리한다.
// 이름표·책 배지·책 아이콘 빌보드, 발밑 그림자(InstancedMesh 1콜), 다른 방문객의 위치 보간(100ms 지연).
import * as THREE from 'three';
import { MANAGER_TITLE } from '../core/manager';
import type { AvatarState, PlayerState, SharedBook } from '../net/presence';
import { Avatar, type AvatarLook } from './avatar';
import { blurbForTitle } from './bestsellers';
import { BookBadge } from './bookBadge';
import { Nameplate, OVERLAY_LAYER, bookIconTexture } from './nameplate';

export type ActorKind = 'me' | 'peer' | 'npc';

interface Snapshot { at: number; x: number; y: number; z: number; ry: number }

export class Actor {
  readonly avatar: Avatar;
  nameplate: Nameplate | null = null;
  /** 다른 사람·NPC 전용. 읽는 책 제목을 머리 위에 띄우고 클릭할 수 있다. */
  bookBadge: BookBadge | null = null;
  nickname: string;
  /** 이름표 점 색(옷 색) */
  accent: string;
  /** 매니저(써든리 매니저) */
  isManager = false;
  /** 읽기 중이면 이름표(나) 또는 배지(타인)에 보이는 책 제목 */
  bookTitle: string | null = null;
  /** 지금 읽는 책 메타(표지·저자 등). 읽기 중이 아니면 null */
  book: SharedBook | null = null;
  /** 로컬 소개문(NPC 베스트셀러 등). 네트워크로는 보내지 않는다. */
  bookBlurb: string | null = null;
  seatId: string | null = null;
  /** 읽기 모드에서 내 이름표·아이콘 숨기기 */
  hideLabel = false;
  /** 다른 방문객의 위치 기록(받은 시각 기준) */
  snapshots: Snapshot[] = [];
  /** 마지막으로 기록한 상태의 보낸 시각(같은 상태를 두 번 기록하지 않도록) */
  private lastRemoteT = -1;
  /** 위치 기록이 도착하는 평균 간격(ms). 보내는 쪽이 사람 수에 따라 간격을 늘리므로 따라 맞춘다. */
  private remoteGap = 100;
  /** 다른 방문객이 보낸 걷기 경로. 있으면 위치 기록 대신 이 길을 같은 속도로 따라 걷는다. */
  private route: { id: number; points: { x: number; z: number }[]; rush: boolean; since: number } | null = null;
  private lastRouteId = -1;
  private lastPos = new THREE.Vector3();

  constructor(readonly id: string, readonly kind: ActorKind, nickname: string, look: AvatarLook) {
    this.nickname = nickname;
    this.accent = look.color;
    this.isManager = !!look.manager;
    this.avatar = new Avatar(look);
    this.avatar.root.userData.actorId = id;
  }

  get root(): THREE.Group {
    return this.avatar.root;
  }

  setState(state: AvatarState, seatId: string | null): void {
    this.seatId = seatId;
    this.avatar.anim.setState(state, seatId !== null);
    if (state !== 'read') {
      this.bookTitle = null;
      this.book = null;
      this.bookBlurb = null;
    }
    this.refreshLabels();
  }

  setBookTitle(title: string | null): void {
    this.setReadingBook(title ? { title, author: '', publisher: '', coverUrl: null } : null, this.bookBlurb);
  }

  /** 읽는 책 메타·소개를 갱신한다. */
  setReadingBook(book: SharedBook | null, blurb: string | null = null): void {
    this.book = book?.title ? book : null;
    this.bookTitle = this.book?.title ?? null;
    this.bookBlurb = blurb?.trim() || null;
    this.refreshLabels();
  }

  private refreshLabels(): void {
    const reading = this.avatar.state === 'read' && !!this.bookTitle;
    // 나는 읽기 중 책 제목, 매니저는 (대표), 그 외 부제 없음
    let sub = '';
    if (this.kind === 'me' && reading) sub = this.bookTitle!;
    else if (this.isManager) sub = MANAGER_TITLE;
    this.nameplate?.set(this.nickname, this.accent, sub);
    if (this.bookBadge) {
      const show = this.kind !== 'me' && reading;
      this.bookBadge.set(this.id, show ? this.bookTitle : null);
      if (this.hideLabel) this.bookBadge.root.visible = false;
    }
  }

  /** 다른 방문객: 받은 상태를 기록해 둔다. */
  pushRemote(s: PlayerState, now: number): void {
    // 피어 목록은 누가 움직여도 통째로 다시 오므로, 이 사람의 새 상태일 때만 위치를 기록한다
    if (s.t !== this.lastRemoteT && s.path?.length && s.pathId != null) {
      this.lastRemoteT = s.t;
      // 같은 경로를 다시 받은 것(하트비트 등)이면 걷던 대로 둔다
      if (s.pathId !== this.lastRouteId || !this.route) {
        this.lastRouteId = s.pathId;
        const cur = this.root.position;
        const start = { x: s.position[0], z: s.position[2] };
        // 내가 그리고 있는 위치가 보낸 쪽 위치와 가까우면 바로 경로로, 멀면 먼저 그 위치로 간다
        const near = Math.hypot(cur.x - start.x, cur.z - start.z) < 0.25;
        this.route = { id: s.pathId, points: [...(near ? [] : [start]), ...s.path.map(([x, z]) => ({ x, z }))], rush: false, since: now };
        cur.y = 0;
      }
    } else if (s.t !== this.lastRemoteT && this.route) {
      // 경로가 끝났거나 바뀌었다. 끝 지점 근처에 도착한 소식이면 남은 길을 서둘러 마저 걷고,
      // 중간에 멈춘 것이면 경로를 버리고 받은 위치로 간다.
      const end = this.route.points[this.route.points.length - 1];
      const arrived = end && Math.hypot(s.position[0] - end.x, s.position[2] - end.z) < 0.5;
      if (arrived) this.route.rush = true;
      else this.endRoute(now);
    }
    if (s.t !== this.lastRemoteT) {
      const last = this.snapshots[this.snapshots.length - 1];
      const gap = last ? now - last.at : 0;
      // 멈춰 있다가 다시 걷는 긴 공백은 평균에 넣지 않는다
      if (gap > 0 && gap < 1500) this.remoteGap = this.remoteGap * 0.7 + gap * 0.3;
      this.lastRemoteT = s.t;
      this.snapshots.push({ at: now, x: s.position[0], y: s.position[1], z: s.position[2], ry: s.rotationY });
      if (this.snapshots.length > 30) this.snapshots.shift();
    }
    this.nickname = s.nickname;
    this.accent = s.color;
    this.isManager = s.role === 'manager';
    this.setState(s.state, s.seatId);
    this.avatar.setLook({
      color: s.color,
      hair: s.role === 'manager' ? 'curtain' : s.hair,
      manager: s.role === 'manager',
    });
    if (s.state === 'read' && s.book?.title) {
      this.setReadingBook(s.book, blurbForTitle(s.book.title));
    } else {
      this.setReadingBook(null, null);
    }
  }

  /** 경로 걷기를 끝내고, 지금 보이는 위치에서 위치 기록 보간으로 자연스럽게 넘어간다 */
  private endRoute(now: number): void {
    const since = this.route?.since ?? now;
    this.route = null;
    this.remoteGap = 100;
    const p = this.root.position;
    // 경로를 걷는 동안 도착한 기록(도착·앉기)만 남기고, 지금 보이는 위치에서 이어 간다
    const keep = this.snapshots.filter((x) => x.at > since);
    const shift = keep.length ? now - keep[0].at : 0;
    this.snapshots = [
      { at: now - 130, x: p.x, y: p.y, z: p.z, ry: this.root.rotation.y },
      ...keep.map((x) => ({ ...x, at: x.at + shift })),
    ];
  }

  /** 받은 경로를 보낸 사람과 같은 속도로 따라 걷는다. 끝나면 false. */
  private followRoute(now: number, dt: number): boolean {
    const route = this.route;
    if (!route) return false;
    const r = this.root;
    // 전송 지연만큼 늦게 출발하므로 조금 빠르게, 도착 소식이 먼저 왔으면 더 서두른다
    let remaining = REMOTE_WALK_SPEED * (route.rush ? 2.5 : 1.08) * dt;
    while (remaining > 0 && route.points.length) {
      const target = route.points[0];
      const dx = target.x - r.position.x, dz = target.z - r.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 1e-3) { route.points.shift(); continue; }
      const step = Math.min(d, remaining);
      r.position.x += (dx / d) * step;
      r.position.z += (dz / d) * step;
      remaining -= step;
      const turn = Math.atan2(Math.sin(Math.atan2(dx, dz) - r.rotation.y), Math.cos(Math.atan2(dx, dz) - r.rotation.y));
      r.rotation.y += turn * (1 - Math.exp(-10 * dt));
      if (step >= d) route.points.shift();
    }
    if (!route.points.length) this.endRoute(now);
    return true;
  }

  /** 도착 간격보다 조금 늦게(100~700ms) 재생해 두 기록 사이를 보간한다. */
  interpolate(now: number, dt: number): void {
    if (this.followRoute(now, dt)) {
      this.updateSpeed(dt);
      return;
    }
    const renderAt = now - THREE.MathUtils.clamp(this.remoteGap * 1.3, 100, 700);
    const s = this.snapshots;
    if (!s.length) return;
    let a = s[0], b = s[s.length - 1];
    for (let i = 0; i < s.length - 1; i++) {
      if (s[i].at <= renderAt && s[i + 1].at >= renderAt) {
        a = s[i];
        b = s[i + 1];
        break;
      }
    }
    const span = b.at - a.at;
    const k = span > 0 ? THREE.MathUtils.clamp((renderAt - a.at) / span, 0, 1) : 1;
    const r = this.root;
    r.position.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);
    let d = b.ry - a.ry;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    r.rotation.y = a.ry + d * k;
    this.updateSpeed(dt);
  }

  updateSpeed(dt: number): void {
    const p = this.root.position;
    const v = dt > 0 ? Math.hypot(p.x - this.lastPos.x, p.z - this.lastPos.z) / dt : 0;
    this.avatar.anim.speed = Math.min(2, v);
    this.lastPos.copy(p);
  }
}

/** 다른 방문객이 경로를 따라 걷는 속도(controls/movement.ts의 WALK_SPEED와 같게) */
const REMOTE_WALK_SPEED = 1.25;

const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const MAX = 32;

export class Crowd {
  readonly group = new THREE.Group();
  readonly overlay = new THREE.Group();
  private actors = new Map<string, Actor>();
  private shadows: THREE.InstancedMesh;
  private icons: THREE.InstancedMesh;

  constructor() {
    this.group.name = 'crowd';
    this.overlay.name = 'crowd-overlay';
    // 발밑 그림자
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const geo = new THREE.PlaneGeometry(0.5, 0.5);
    geo.rotateX(-Math.PI / 2);
    this.shadows = new THREE.InstancedMesh(
      geo,
      new THREE.MeshBasicMaterial({ color: 0x140c06, alphaMap: new THREE.CanvasTexture(c), transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }),
      MAX,
    );
    this.shadows.count = 0;
    this.shadows.frustumCulled = false;
    this.shadows.layers.set(OVERLAY_LAYER);
    this.group.add(this.shadows);
    // 읽기 중 책 아이콘
    this.icons = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.13, 0.13),
      new THREE.MeshBasicMaterial({ map: bookIconTexture(), transparent: true, depthTest: false, depthWrite: false }),
      MAX,
    );
    this.icons.count = 0;
    this.icons.frustumCulled = false;
    this.icons.renderOrder = 21;
    this.icons.layers.set(OVERLAY_LAYER);
    this.overlay.add(this.icons);
  }

  add(id: string, kind: ActorKind, nickname: string, look: AvatarLook, withNameplate: boolean): Actor {
    this.remove(id);
    const a = new Actor(id, kind, nickname, look);
    if (withNameplate) {
      a.nameplate = new Nameplate(nickname, look.color);
      if (look.manager) a.nameplate.set(nickname, look.color, MANAGER_TITLE);
      this.overlay.add(a.nameplate.mesh);
    }
    if (kind === 'peer' || kind === 'npc') {
      a.bookBadge = new BookBadge();
      this.overlay.add(a.bookBadge.root);
    }
    this.group.add(a.root);
    this.actors.set(id, a);
    return a;
  }

  remove(id: string): void {
    const a = this.actors.get(id);
    if (!a) return;
    a.avatar.dispose();
    if (a.nameplate) {
      a.nameplate.mesh.removeFromParent();
      a.nameplate.dispose();
    }
    if (a.bookBadge) {
      a.bookBadge.root.removeFromParent();
      a.bookBadge.dispose();
    }
    this.actors.delete(id);
  }

  /**
   * 화면 좌표로 머리 위 책 배지를 고른다(레이캐스트 없음).
   * 여러 개면 포인터에 더 가까운 것.
   */
  pickBookBadge(clientX: number, clientY: number, camera: THREE.Camera, rect: DOMRectReadOnly): Actor | null {
    let best: Actor | null = null;
    let bestDist = Infinity;
    for (const a of this.actors.values()) {
      if (!a.root.visible || !a.bookBadge?.root.visible) continue;
      const d = a.bookBadge.hitDistance(clientX, clientY, camera, rect);
      if (d !== null && d < bestDist) {
        bestDist = d;
        best = a;
      }
    }
    return best;
  }

  get(id: string): Actor | undefined {
    return this.actors.get(id);
  }

  list(kind?: ActorKind): Actor[] {
    const all = [...this.actors.values()];
    return kind ? all.filter((a) => a.kind === kind) : all;
  }

  /** 다른 사람(방문객·NPC)이 앉아 있는 자리 */
  takenSeats(exceptId?: string): Set<string> {
    const s = new Set<string>();
    for (const a of this.actors.values()) if (a.id !== exceptId && a.seatId && a.root.visible) s.add(a.seatId);
    return s;
  }

  update(dt: number, t: number, camera: THREE.Camera): void {
    const now = performance.now();
    let n = 0, ni = 0;
    for (const a of this.actors.values()) {
      if (a.kind === 'peer') a.interpolate(now, dt);
      a.avatar.update(dt, t);
      if (!a.root.visible) {
        if (a.nameplate) a.nameplate.mesh.visible = false;
        if (a.bookBadge) a.bookBadge.root.visible = false;
        continue;
      }
      const p = a.root.position;
      const seated = a.avatar.anim.seated;
      // 발밑 그림자(앉아 있으면 의자가 그림자를 대신하므로 옅게 작게)
      if (n < MAX) {
        const sc = seated ? 0.6 : 1;
        _m.compose(_v.set(p.x, 0.006, p.z), _q.identity(), _s.set(sc, 1, sc));
        this.shadows.setMatrixAt(n++, _m);
      }
      const top = p.y + (seated ? 0.86 : 1.02);
      if (a.nameplate) {
        a.nameplate.mesh.visible = !a.hideLabel;
        a.nameplate.update(_v.set(p.x, top + 0.06, p.z), camera);
      }
      const badgeOn = !!a.bookBadge && a.kind !== 'me' && a.avatar.state === 'read' && !!a.bookTitle && !a.hideLabel;
      if (a.bookBadge) {
        if (!badgeOn) a.bookBadge.root.visible = false;
        else {
          a.bookBadge.set(a.id, a.bookTitle);
          const nameH = a.nameplate ? 0.14 * a.nameplate.mesh.scale.x : 0.08;
          a.bookBadge.update(_v.set(p.x, top + 0.06 + nameH, p.z), camera);
        }
      }
      // 나는 작은 책 아이콘, 타인·NPC는 배지가 대신하므로 아이콘은 나에게만
      if (a.kind === 'me' && a.avatar.state === 'read' && !a.hideLabel && ni < MAX) {
        const lift = a.nameplate ? (a.bookTitle ? 0.24 : 0.17) * a.nameplate.mesh.scale.x : 0.06;
        const sc = a.nameplate ? a.nameplate.mesh.scale.x : 1;
        _m.compose(_v.set(p.x, top + 0.06 + lift, p.z), camera.quaternion, _s.set(sc, sc, sc));
        this.icons.setMatrixAt(ni++, _m);
      }
    }
    this.shadows.count = n;
    this.shadows.instanceMatrix.needsUpdate = true;
    this.icons.count = ni;
    this.icons.instanceMatrix.needsUpdate = true;
  }
}
