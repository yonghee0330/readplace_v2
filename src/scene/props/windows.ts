// 창틀(격자 창살, 창턱), 유리, 출입문.
import * as THREE from 'three';
import { Rng } from '../../core/rng';
import { MergeBucket, bevelBox, projectUV, trs } from '../geom';
import { BACK_OPENINGS, ROOM } from '../layout';

export interface WindowInfo { cx: number; w: number; y0: number; y1: number; sillTop: number; sillZ: number }

export function buildWindows(bucket: MergeBucket, rng: Rng): { windows: WindowInfo[]; glass: THREE.Mesh } {
  const r = rng.fork('windows');
  const zf = ROOM.z0 - 0.1; // 창틀 면
  const windows: WindowInfo[] = [];
  const glassGeoms: THREE.BufferGeometry[] = [];

  for (const o of BACK_OPENINGS.filter((o) => o.kind === 'window')) {
    const x0 = o.cx - o.w / 2, x1 = o.cx + o.w / 2, h = o.y1 - o.y0;
    const fw = 0.06, fd = 0.07;
    const wood = (g: THREE.BufferGeometry, grain: 'x' | 'y', m: THREE.Matrix4) => {
      projectUV(g, grain, { offset: [r.float(), r.float()] });
      bucket.add('paint', g, m);
    };
    // 바깥 틀
    wood(bevelBox(fw, h, fd, 0.006), 'y', trs(x0 + fw / 2, o.y0 + h / 2, zf));
    wood(bevelBox(fw, h, fd, 0.006), 'y', trs(x1 - fw / 2, o.y0 + h / 2, zf));
    wood(bevelBox(o.w, fw, fd, 0.006), 'x', trs(o.cx, o.y1 - fw / 2, zf));
    wood(bevelBox(o.w, fw, fd, 0.006), 'x', trs(o.cx, o.y0 + fw / 2, zf));
    // 격자 창살: 세로 2, 가로 1 → 3×2 칸
    const bar = 0.03;
    for (const t of [1 / 3, 2 / 3]) {
      wood(bevelBox(bar, h - 2 * fw, 0.045, 0.004), 'y', trs(x0 + o.w * t, o.y0 + h / 2, zf));
    }
    wood(bevelBox(o.w - 2 * fw, bar, 0.045, 0.004), 'x', trs(o.cx, o.y0 + fw + (h - 2 * fw) * 0.55, zf));
    // 창턱: 방 안쪽으로 튀어나온 꿀색 판
    const sillD = 0.3, sillT = 0.04;
    const sill = bevelBox(o.w + 0.16, sillT, sillD, 0.01, 2);
    projectUV(sill, 'x', { offset: [r.float(), r.float()] });
    const sillZ = ROOM.z0 - 0.2 + sillD / 2 + 0.02;
    bucket.add('honey', sill, trs(o.cx, o.y0 - sillT / 2 + 0.005, sillZ));
    const glass = new THREE.PlaneGeometry(o.w - 2 * fw, h - 2 * fw);
    glass.translate(o.cx, o.y0 + h / 2, zf - 0.005);
    glassGeoms.push(glass);
    windows.push({ cx: o.cx, w: o.w, y0: o.y0, y1: o.y1, sillTop: o.y0 + 0.005, sillZ });
  }

  // 출입문(허브=앞벽, 서브룸=뒤벽)
  const door = BACK_OPENINGS.find((o) => o.kind === 'door');
  if (door) {
    const hasWindows = BACK_OPENINGS.some((o) => o.kind === 'window');
    const doorZ = hasWindows ? ROOM.z1 - 0.02 : ROOM.z0 + 0.02;
    const leafZ = hasWindows ? ROOM.z1 + 0.06 : ROOM.z0 - 0.06;
    const dx0 = door.cx - door.w / 2, dx1 = door.cx + door.w / 2;
    const frameW = 0.07;
    const frame = (g: THREE.BufferGeometry, grain: 'x' | 'y', m: THREE.Matrix4) => {
      projectUV(g, grain, { offset: [r.float(), r.float()] });
      bucket.add('walnut', g, m);
    };
    frame(bevelBox(frameW, door.y1 + frameW, 0.05, 0.008), 'y', trs(dx0 - frameW / 2 + 0.01, (door.y1 + frameW) / 2, doorZ));
    frame(bevelBox(frameW, door.y1 + frameW, 0.05, 0.008), 'y', trs(dx1 + frameW / 2 - 0.01, (door.y1 + frameW) / 2, doorZ));
    frame(bevelBox(door.w + 2 * frameW - 0.02, frameW, 0.05, 0.008), 'x', trs(door.cx, door.y1 + frameW / 2, doorZ));
    const dw = door.w - 0.02, dh = door.y1 - 0.01, st = 0.1;
    frame(bevelBox(st, dh, 0.045, 0.006), 'y', trs(dx0 + 0.01 + st / 2, dh / 2, leafZ));
    frame(bevelBox(st, dh, 0.045, 0.006), 'y', trs(dx1 - 0.01 - st / 2, dh / 2, leafZ));
    for (const y of [0.08, 0.92, 1.3, dh - 0.06]) {
      frame(bevelBox(dw - 2 * st, y === 0.08 ? 0.16 : 0.1, 0.045, 0.006), 'x', trs(door.cx, y, leafZ));
    }
    const panel = bevelBox(dw - 2 * st, 0.68, 0.025, 0.012, 2);
    projectUV(panel, 'y', { offset: [r.float(), r.float()] });
    bucket.add('walnut', panel, trs(door.cx, 0.53, leafZ + (hasWindows ? 0.004 : -0.004)), 0xc9b8a6);
    if (dh > 1.5) {
      const dg = new THREE.PlaneGeometry(dw - 2 * st, Math.max(0.2, dh - 0.06 - 1.3 - 0.1));
      dg.translate(door.cx, (1.35 + dh - 0.11) / 2, leafZ);
      glassGeoms.push(dg);
    }
    const knob = new THREE.SphereGeometry(0.03, 12, 8);
    const kz = leafZ + (hasWindows ? -0.05 : 0.05);
    bucket.add('brass', knob, trs(dx0 + 0.13, 1.0, kz));
    const rose = new THREE.CylinderGeometry(0.035, 0.035, 0.012, 16);
    rose.rotateX(Math.PI / 2);
    bucket.add('brass', rose, trs(dx0 + 0.13, 1.0, leafZ + (hasWindows ? -0.027 : 0.027)));
  }

  const merged = new THREE.Mesh(glassGeoms.length ? mergeSimple(glassGeoms) : new THREE.BufferGeometry());
  merged.name = 'glass';
  return { windows, glass: merged };
}

function mergeSimple(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...(g.getAttribute('position').array as Float32Array));
    nor.push(...(g.getAttribute('normal').array as Float32Array));
    uv.push(...(g.getAttribute('uv').array as Float32Array));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}
