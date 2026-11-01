// 장면 속 모든 아바타(나, 다른 방문객, NPC)를 관리한다.
// 이름표·책 아이콘 빌보드, 발밑 그림자(InstancedMesh 1콜), 다른 방문객의 위치 보간(100ms 지연).
import * as THREE from 'three';
import type { AvatarState, HairStyle, PlayerState } from '../net/presence';
import { Avatar } from './avatar';
import { Nameplate, OVERLAY_LAYER, bookIconTexture } from './nameplate';

export type ActorKind = 'me' | 'peer' | 'npc';

interface Snapshot { at: number; x: number; y: number; z: number; ry: number }

export class Actor {
  readonly avatar: Avatar;
  nameplate: Nameplate | null = null;
  nickname: string;
  /** 이름표 점 색(옷 색) */
  accent: string;
  /** 읽기 중이면 이름표에 보이는 책 제목 */
  bookTitle: string | null = null;
  seatId: string | null = null;
  /** 읽기 모드에서 내 이름표·아이콘 숨기기 */
  hideLabel = false;
  /** 다른 방문객의 위치 기록(받은 시각 기준) */
  snapshots: Snapshot[] = [];
  private lastPos = new THREE.Vector3();

  constructor(readonly id: string, readonly kind: ActorKind, nickname: string, look: { color: string; hair: HairStyle }) {
    this.nickname = nickname;
    this.accent = look.color;
    this.avatar = new Avatar(look);
    this.avatar.root.userData.actorId = id;
  }

  get root(): THREE.Group {
    return this.avatar.root;
  }

  setState(state: AvatarState, seatId: string | null): void {
    this.seatId = seatId;
    this.avatar.anim.setState(state, seatId !== null);
    if (state !== 'read') this.bookTitle = null;
    this.refreshNameplate();
  }

  setBookTitle(title: string | null): void {
    const next = title?.trim() || null;
    if (this.bookTitle === next) return;
    this.bookTitle = next;
    this.refreshNameplate();
  }

  private refreshNameplate(): void {
    const sub = this.avatar.state === 'read' && this.bookTitle ? this.bookTitle : '';
    this.nameplate?.set(this.nickname, this.accent, sub);
  }

  /** 다른 방문객: 받은 상태를 기록해 둔다. */
  pushRemote(s: PlayerState, now: number): void {
    this.snapshots.push({ at: now, x: s.position[0], y: s.position[1], z: s.position[2], ry: s.rotationY });
    if (this.snapshots.length > 30) this.snapshots.shift();
    this.nickname = s.nickname;
    this.accent = s.color;
    this.bookTitle = s.state === 'read' ? (s.book?.title ?? null) : null;
    this.setState(s.state, s.seatId);
    this.avatar.setLook({ color: s.color, hair: s.hair });
    this.refreshNameplate();
  }

  /** 100ms 늦게 재생해 두 기록 사이를 보간한다. */
  interpolate(now: number, dt: number): void {
    const renderAt = now - 100;
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

  add(id: string, kind: ActorKind, nickname: string, look: { color: string; hair: HairStyle }, withNameplate: boolean): Actor {
    this.remove(id);
    const a = new Actor(id, kind, nickname, look);
    if (withNameplate) {
      a.nameplate = new Nameplate(nickname, look.color);
      this.overlay.add(a.nameplate.mesh);
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
    this.actors.delete(id);
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
      if (a.avatar.state === 'read' && !a.hideLabel && ni < MAX) {
        // 책 제목이 있으면 이름표가 두 줄이라 아이콘을 조금 더 올린다
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
