// 경로 탐색: 바닥을 0.25m 격자로 나누고 가구(+0.3m 여유)를 막은 뒤 A*. 경로는 시야선으로 단순화한다.
import { ROOM, colliders, type Collider } from '../scene/layout';

export const CELL = 0.25;
const MARGIN = 0.3;
const WALL_MARGIN = 0.25;

export interface Pt { x: number; z: number }

export class NavGrid {
  readonly cols = Math.round(ROOM.w / CELL);
  readonly rows = Math.round(ROOM.d / CELL);
  readonly blocked: Uint8Array;

  constructor(list: Collider[] = colliders()) {
    this.blocked = new Uint8Array(this.cols * this.rows);
    for (let j = 0; j < this.rows; j++) {
      for (let i = 0; i < this.cols; i++) {
        const { x, z } = this.center(i, j);
        let b = x < ROOM.x0 + WALL_MARGIN || x > ROOM.x1 - WALL_MARGIN || z < ROOM.z0 + WALL_MARGIN || z > ROOM.z1 - WALL_MARGIN;
        if (!b) {
          for (const c of list) {
            if (x > c.x0 - MARGIN && x < c.x1 + MARGIN && z > c.z0 - MARGIN && z < c.z1 + MARGIN) {
              b = true;
              break;
            }
          }
        }
        this.blocked[j * this.cols + i] = b ? 1 : 0;
      }
    }
  }

  center(i: number, j: number): Pt {
    return { x: ROOM.x0 + (i + 0.5) * CELL, z: ROOM.z0 + (j + 0.5) * CELL };
  }

  cellOf(p: Pt): [number, number] {
    const i = Math.min(this.cols - 1, Math.max(0, Math.floor((p.x - ROOM.x0) / CELL)));
    const j = Math.min(this.rows - 1, Math.max(0, Math.floor((p.z - ROOM.z0) / CELL)));
    return [i, j];
  }

  free(i: number, j: number): boolean {
    return i >= 0 && j >= 0 && i < this.cols && j < this.rows && this.blocked[j * this.cols + i] === 0;
  }

  /** 막힌 칸이면 가장 가까운 빈 칸 중심을 돌려준다. */
  nearestFree(p: Pt): Pt | null {
    const [ci, cj] = this.cellOf(p);
    if (this.free(ci, cj)) return this.center(ci, cj);
    let best: Pt | null = null, bestD = Infinity;
    for (let r = 1; r < Math.max(this.cols, this.rows); r++) {
      for (let j = cj - r; j <= cj + r; j++) {
        for (let i = ci - r; i <= ci + r; i++) {
          if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r || !this.free(i, j)) continue;
          const c = this.center(i, j);
          const d = (c.x - p.x) ** 2 + (c.z - p.z) ** 2;
          if (d < bestD) { bestD = d; best = c; }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** 두 점 사이 직선이 빈 칸만 지나는지(반 칸 간격 표본). */
  lineFree(a: Pt, b: Pt): boolean {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(d / (CELL * 0.35)));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const [i, j] = this.cellOf({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
      if (!this.free(i, j)) return false;
    }
    return true;
  }

  /** A* (8방향, 모서리 끼어 지나가기 금지). 시작·끝이 막혀 있으면 가까운 빈 칸으로 옮긴다. */
  findPath(from: Pt, to: Pt): Pt[] | null {
    const start = this.free(...this.cellOf(from)) ? from : this.nearestFree(from);
    const goal = this.free(...this.cellOf(to)) ? to : this.nearestFree(to);
    if (!start || !goal) return null;
    const [si, sj] = this.cellOf(start);
    const [gi, gj] = this.cellOf(goal);
    const N = this.cols * this.rows;
    const g = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const open: number[] = [];
    const f = new Float32Array(N).fill(Infinity);
    const h = (i: number, j: number) => {
      const dx = Math.abs(i - gi), dz = Math.abs(j - gj);
      return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
    };
    const s = sj * this.cols + si;
    g[s] = 0;
    f[s] = h(si, sj);
    open.push(s);
    const goalIdx = gj * this.cols + gi;
    while (open.length) {
      // 열린 목록이 작아서(최대 768칸) 선형 탐색으로 충분하다.
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[bi]]) bi = k;
      const cur = open.splice(bi, 1)[0];
      if (cur === goalIdx) break;
      closed[cur] = 1;
      const ci = cur % this.cols, cj = (cur - ci) / this.cols;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di, nj = cj + dj;
          if (!this.free(ni, nj)) continue;
          if (di && dj && (!this.free(ci + di, cj) || !this.free(ci, cj + dj))) continue;
          const n = nj * this.cols + ni;
          if (closed[n]) continue;
          const ng = g[cur] + (di && dj ? Math.SQRT2 : 1);
          if (ng < g[n]) {
            g[n] = ng;
            f[n] = ng + h(ni, nj);
            came[n] = cur;
            if (!open.includes(n)) open.push(n);
          }
        }
      }
    }
    if (came[goalIdx] === -1 && goalIdx !== s) return null;
    const cells: Pt[] = [];
    for (let c = goalIdx; c !== -1; c = came[c]) {
      const ci = c % this.cols;
      cells.push(this.center(ci, (c - ci) / this.cols));
      if (c === s) break;
    }
    cells.reverse();
    cells[0] = start;
    cells[cells.length - 1] = goal;
    return this.simplify(cells);
  }

  /** 시야선이 통하는 한 중간 점을 건너뛴다. */
  simplify(path: Pt[]): Pt[] {
    if (path.length <= 2) return path;
    const out: Pt[] = [path[0]];
    let anchor = 0;
    for (let k = 2; k < path.length; k++) {
      if (!this.lineFree(path[anchor], path[k])) {
        out.push(path[k - 1]);
        anchor = k - 1;
      }
    }
    out.push(path[path.length - 1]);
    return out;
  }
}
