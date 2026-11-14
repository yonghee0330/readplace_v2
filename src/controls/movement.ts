// 내 아바타 이동: 바닥 클릭 → 경로 탐색 → 부드럽게 따라가기, 의자·소파 클릭 → 빈 자리로 가서 앉기,
// (설정에서 켜면) WASD·방향키 직접 이동.
import * as THREE from 'three';
import type { Actor } from '../avatar/crowd';
import { HIP_Y } from '../avatar/avatar';
import type { AvatarState } from '../net/presence';
import { SEATS, seatApproach, type Seat } from '../scene/layout';
import { NavGrid, type Pt } from './pathfinding';

const WALK_SPEED = 1.25;
const TURN_RATE = 10;

type Phase =
  | { kind: 'idle' }
  | { kind: 'path'; points: Pt[]; seat: Seat | null }
  | { kind: 'glide'; from: THREE.Vector3; to: THREE.Vector3; fromRy: number; toRy: number; t: number; dur: number; then: 'sit' | 'stand'; seat: Seat | null; next: Pt | null; nextSeat: Seat | null };

const angleLerp = (a: number, b: number, k: number) => {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * k;
};

export class Movement {
  grid = new NavGrid();
  private seats: Seat[] = [...SEATS];
  private phase: Phase = { kind: 'idle' };
  seat: Seat | null = null;
  reading = false;
  /** 키보드 입력(-1..1). 카메라 기준 방향. */
  keyInput = new THREE.Vector2();
  cameraYaw = 0;
  /** 클릭 경로마다 올라가는 번호(다른 사람에게 경로를 한 번만 보내려고 쓴다) */
  private routeSeq = 0;

  constructor(private me: Actor, private takenSeats: () => Set<string>, private onChange: () => void) {}

  /** 공간 전환 후 내비·좌석 목록을 교체한다. */
  setSpace(grid: NavGrid, seats: Seat[]): void {
    this.grid = grid;
    this.seats = seats;
    this.seat = null;
    this.phase = { kind: 'idle' };
    this.reading = false;
  }

  get state(): AvatarState {
    if (this.reading) return 'read';
    if (this.phase.kind === 'path' || this.phase.kind === 'glide' || this.keyInput.lengthSq() > 0.01) {
      return this.phase.kind === 'glide' && this.phase.then === 'sit' && this.phase.t > 0.6 ? 'sit' : 'walk';
    }
    return this.seat ? 'sit' : 'stand';
  }

  /** 앉아 있거나 앉으러 미끄러져 들어가는 중인 자리 */
  get seatId(): string | null {
    return this.seat?.id ?? (this.phase.kind === 'glide' && this.phase.then === 'sit' ? this.phase.seat?.id ?? null : null);
  }

  get moving(): boolean {
    return this.phase.kind !== 'idle' || this.keyInput.lengthSq() > 0.01;
  }

  /** 키보드로 직접 걷는 중(경로가 없어 위치를 계속 보내야 한다) */
  get steering(): boolean {
    return this.phase.kind === 'idle' && this.keyInput.lengthSq() > 0.01;
  }

  /** 클릭해서 걷는 중이면 남은 경로와 경로 번호 */
  get route(): { id: number; points: Pt[] } | null {
    return this.phase.kind === 'path' && this.phase.points.length ? { id: this.routeSeq, points: this.phase.points } : null;
  }

  /** 바닥의 한 점으로 걸어간다. */
  walkTo(p: Pt): Pt | null {
    this.reading = false;
    if (this.seat) return this.standThen(p, null);
    const from = { x: this.me.root.position.x, z: this.me.root.position.z };
    const path = this.grid.findPath(from, p);
    if (!path) return null;
    this.routeSeq++;
    this.phase = { kind: 'path', points: path.slice(1), seat: null };
    this.sync();
    return path[path.length - 1];
  }

  /** 클릭한 가구에서 가장 가까운 빈 자리로 가서 앉는다. 비어 있는 자리가 없으면 null. */
  sitNear(p: Pt, seatIds?: string[]): Seat | null {
    const taken = this.takenSeats();
    const candidates = this.seats.filter((s) => (!seatIds || seatIds.includes(s.id)) && !taken.has(s.id) && s.id !== this.seat?.id);
    if (!candidates.length) return null;
    candidates.sort((a, b) => (a.x - p.x) ** 2 + (a.z - p.z) ** 2 - ((b.x - p.x) ** 2 + (b.z - p.z) ** 2));
    const seat = candidates[0];
    return this.goSit(seat) ? seat : null;
  }

  /**
   * 빈 자리 중 마음에 드는 곳으로 알아서 가서 앉는다.
   * 가까운 자리·소파·세미나·계단석을 조금 더 선호하고, 약간의 무작위로 고른다.
   */
  sitPreferred(): Seat | null {
    const taken = this.takenSeats();
    const me = { x: this.me.root.position.x, z: this.me.root.position.z };
    const free = this.seats.filter((s) => !taken.has(s.id) && s.id !== this.seat?.id);
    if (!free.length) return null;
    const prefer = (id: string) => {
      if (id.startsWith('sofa-') || id.startsWith('seminar-') || id.startsWith('theater-') || id.startsWith('solo-')) return 0;
      if (id.startsWith('chair-') || id.startsWith('bench-')) return 0.4;
      if (id.startsWith('stage-')) return 2.2;
      return 0.8;
    };
    const ranked = free
      .map((s) => {
        const d = Math.hypot(s.x - me.x, s.z - me.z);
        return { s, score: d * 0.55 + prefer(s.id) + Math.random() * 1.8 };
      })
      .sort((a, b) => a.score - b.score);
    for (const { s } of ranked) {
      if (this.goSit(s)) return s;
    }
    return null;
  }

  goSit(seat: Seat): boolean {
    this.reading = false;
    const ap = seatApproach(seat);
    if (this.seat) {
      this.standThen(ap, seat);
      return true;
    }
    const from = { x: this.me.root.position.x, z: this.me.root.position.z };
    const path = this.grid.findPath(from, ap);
    if (!path) return false;
    this.routeSeq++;
    this.phase = { kind: 'path', points: path.slice(1), seat };
    this.sync();
    return true;
  }

  /** 앉아 있다가 일어나서 다음 목적지로. */
  private standThen(next: Pt | null, nextSeat: Seat | null): Pt | null {
    const seat = this.seat!;
    const ap = this.grid.nearestFree(seatApproach(seat)) ?? seatApproach(seat);
    const from = this.me.root.position.clone();
    this.seat = null;
    this.phase = {
      kind: 'glide', from, to: new THREE.Vector3(ap.x, 0, ap.z), fromRy: this.me.root.rotation.y, toRy: seat.ry,
      t: 0, dur: 0.45, then: 'stand', seat: null, next, nextSeat,
    };
    this.sync();
    return next;
  }

  /** 지금 자리에서 일어나기만 한다(책 펼치기 해제 등과 별개). */
  standUp(): void {
    if (this.seat) this.standThen(null, null);
  }

  toggleReading(): boolean {
    if (this.phase.kind !== 'idle') this.stop();
    this.reading = !this.reading;
    this.sync();
    return this.reading;
  }

  setReading(v: boolean): void {
    if (this.reading === v) return;
    if (v && this.phase.kind !== 'idle') this.stop();
    this.reading = v;
    this.sync();
  }

  stop(): void {
    if (this.phase.kind === 'glide') return; // 앉고 일어나는 동작은 끝까지
    this.phase = { kind: 'idle' };
    this.sync();
  }

  /** 시작 위치 지정(막힌 칸이면 가까운 통로로) */
  place(x: number, z: number, ry: number): void {
    const free = this.grid.nearestFree({ x, z }) ?? { x, z };
    this.me.root.position.set(free.x, 0, free.z);
    this.me.root.rotation.y = ry;
    this.seat = null;
    this.phase = { kind: 'idle' };
    this.sync();
  }

  sitImmediately(seat: Seat): void {
    this.me.root.position.set(seat.x, seat.y - HIP_Y, seat.z);
    this.me.root.rotation.y = seat.ry;
    this.seat = seat;
    this.phase = { kind: 'idle' };
    this.sync();
  }

  private sync(): void {
    this.me.setState(this.state, this.seatId);
    this.onChange();
  }

  update(dt: number): void {
    const root = this.me.root;
    const ph = this.phase;
    const before = this.state;

    if (ph.kind === 'path') {
      let remaining = WALK_SPEED * dt;
      while (remaining > 0 && ph.points.length) {
        const target = ph.points[0];
        const dx = target.x - root.position.x, dz = target.z - root.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 1e-3) { ph.points.shift(); continue; }
        const step = Math.min(d, remaining);
        root.position.x += (dx / d) * step;
        root.position.z += (dz / d) * step;
        remaining -= step;
        root.rotation.y = angleLerp(root.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-TURN_RATE * dt));
        if (step >= d) ph.points.shift();
      }
      if (!ph.points.length) {
        if (ph.seat) {
          const s = ph.seat;
          if (this.takenSeats().has(s.id)) {
            // 걸어가는 동안 누가 앉았으면 근처 다른 자리
            this.phase = { kind: 'idle' };
            this.sitNear({ x: s.x, z: s.z });
          } else {
            this.phase = {
              kind: 'glide', from: root.position.clone(), to: new THREE.Vector3(s.x, s.y - HIP_Y, s.z),
              fromRy: root.rotation.y, toRy: s.ry, t: 0, dur: 0.55, then: 'sit', seat: s, next: null, nextSeat: null,
            };
          }
        } else {
          this.phase = { kind: 'idle' };
        }
        this.sync();
      }
    } else if (ph.kind === 'glide') {
      ph.t += dt / ph.dur;
      const k = Math.min(1, ph.t);
      const e = k * k * (3 - 2 * k);
      root.position.lerpVectors(ph.from, ph.to, e);
      // 앉을 때는 먼저 돌아서고, 일어날 때는 나중에 돈다
      const rk = ph.then === 'sit' ? Math.min(1, k * 1.8) : Math.max(0, k * 1.5 - 0.5);
      root.rotation.y = angleLerp(ph.fromRy, ph.then === 'sit' ? ph.toRy : Math.atan2(ph.to.x - ph.from.x, ph.to.z - ph.from.z), rk);
      if (k >= 1) {
        if (ph.then === 'sit') {
          this.seat = ph.seat;
          this.phase = { kind: 'idle' };
          this.sync();
        } else {
          this.phase = { kind: 'idle' };
          if (ph.nextSeat) this.goSit(ph.nextSeat);
          else if (ph.next) this.walkTo(ph.next);
          else this.sync();
        }
      } else if (before !== this.state) {
        this.sync();
      }
    } else if (this.keyInput.lengthSq() > 0.01) {
      if (this.seat) {
        this.standUp();
      } else {
        this.reading = false;
        // 카메라 기준 앞뒤좌우
        const fx = -Math.sin(this.cameraYaw), fz = -Math.cos(this.cameraYaw);
        const rx = -fz, rz = fx;
        let vx = fx * this.keyInput.y + rx * this.keyInput.x;
        let vz = fz * this.keyInput.y + rz * this.keyInput.x;
        const len = Math.hypot(vx, vz) || 1;
        vx /= len; vz /= len;
        const nx = root.position.x + vx * WALK_SPEED * dt, nz = root.position.z + vz * WALK_SPEED * dt;
        // 막힌 칸이면 축별로 미끄러지기
        if (this.grid.free(...this.grid.cellOf({ x: nx, z: nz }))) root.position.set(nx, 0, nz);
        else if (this.grid.free(...this.grid.cellOf({ x: nx, z: root.position.z }))) root.position.x = nx;
        else if (this.grid.free(...this.grid.cellOf({ x: root.position.x, z: nz }))) root.position.z = nz;
        root.rotation.y = angleLerp(root.rotation.y, Math.atan2(vx, vz), 1 - Math.exp(-TURN_RATE * dt));
        if (before !== 'walk') this.sync();
      }
    } else if (before === 'walk' && ph.kind === 'idle') {
      this.sync();
    }
    this.me.updateSpeed(dt);
  }
}
