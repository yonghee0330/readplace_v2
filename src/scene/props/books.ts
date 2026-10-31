// 책: InstancedMesh 두 개(표지·책등 / 페이지 블록). 높이·두께·색은 시드 난수.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng } from '../../core/rng';
import { MergeBucket, bevelBox, trs } from '../geom';
import type { Compartment } from './shelf';

export const BOOK_PALETTE = [
  '#8c2f2a', '#b5562f', '#c99a3d', '#3f5f4a', '#2d4a5e', '#6b3a4f',
  '#d9cfb8', '#2a2926', '#7a8a5a', '#9fb3bd', '#5a3d2b', '#e2b49a',
];

/** 단위 책. x: 두께 [-0.5,0.5], y: 높이 [0,1], z: 깊이 [-0.5,0.5], 책등은 +z. */
function unitBookGeometries(): { cover: THREE.BufferGeometry; pages: THREE.BufferGeometry } {
  const CU = 0.15, CV = 0.22; // 아틀라스에서 흰 부분(표지용)
  const flatUV = (g: THREE.BufferGeometry) => {
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, CU, CV);
    return g;
  };
  const ct = 0.09; // 표지 두께(책 두께 대비)
  const front = flatUV(new THREE.BoxGeometry(ct, 1, 1).translate(0.5 - ct / 2, 0.5, 0));
  const back = flatUV(new THREE.BoxGeometry(ct, 1, 1).translate(-0.5 + ct / 2, 0.5, 0));
  const spineSlab = flatUV(new THREE.BoxGeometry(1, 1, 0.05).translate(0, 0.5, 0.475));
  const spineFace = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0.5005);
  const parts = [front, back, spineSlab, spineFace].map((g) => g.toNonIndexed());
  const cover = mergeGeometries(parts)!;
  const pages = new THREE.BoxGeometry(1 - 2 * ct, 0.96, 0.94).translate(0, 0.5, -0.03).toNonIndexed();
  return { cover, pages };
}

interface BookInstance { m: THREE.Matrix4; color: THREE.Color; variant: number }

export class BookCollector {
  readonly items: BookInstance[] = [];
  add(m: THREE.Matrix4, color: THREE.Color, variant: number): void {
    this.items.push({ m, color, variant });
  }

  build(coverMat: THREE.MeshStandardMaterial, pageMat: THREE.Material): THREE.Group {
    const { cover, pages } = unitBookGeometries();
    const n = this.items.length;
    const variants = new Float32Array(n);
    this.items.forEach((b, i) => (variants[i] = b.variant));
    cover.setAttribute('aVariant', new THREE.InstancedBufferAttribute(variants, 1));

    // 아틀라스 4칸 중 인스턴스별 칸을 고른다.
    coverMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aVariant;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv.x = (vMapUv.x + aVariant) * 0.25;\n#endif');
    };
    coverMat.customProgramCacheKey = () => 'book-atlas';

    const covers = new THREE.InstancedMesh(cover, coverMat, n);
    const pageMesh = new THREE.InstancedMesh(pages, pageMat, n);
    this.items.forEach((b, i) => {
      covers.setMatrixAt(i, b.m);
      covers.setColorAt(i, b.color);
      pageMesh.setMatrixAt(i, b.m);
    });
    covers.instanceMatrix.needsUpdate = true;
    if (covers.instanceColor) covers.instanceColor.needsUpdate = true;
    for (const mesh of [covers, pageMesh]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      mesh.matrixAutoUpdate = false;
    }
    covers.name = 'books:covers';
    pageMesh.name = 'books:pages';
    const g = new THREE.Group();
    g.add(covers, pageMesh);
    return g;
  }
}

function bookColor(r: Rng, base?: string): THREE.Color {
  const c = new THREE.Color(base ?? r.pick(BOOK_PALETTE));
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h + r.range(-0.015, 0.015), hsl.s * r.range(0.85, 1.05), hsl.l * r.range(0.88, 1.1));
  return c;
}

const _rot = new THREE.Matrix4();
const _scl = new THREE.Matrix4();

/** 칸 하나를 책으로 채운다. 빈틈, 기울어진 책, 눕힌 더미, 시리즈 묶음, 북엔드. */
export function fillCompartment(comp: Compartment, r: Rng, books: BookCollector, bucket: MergeBucket): void {
  const maxH = comp.height - 0.025;
  let x = r.range(0, 0.03);
  let series: { left: number; color: string; h: number; t: number; variant: number } | null = null;
  // 칸마다 성격: 꽉 참 / 보통 / 듬성
  const density = r.pick([0.04, 0.09, 0.16]);
  let placed = 0;

  while (x < comp.width - 0.012) {
    const room = comp.width - x;
    // 빈틈
    if (placed > 3 && r.chance(density) && room > 0.12) {
      x += r.range(0.04, 0.12);
      continue;
    }
    // 눕힌 더미
    if (r.chance(0.035) && room > 0.27) {
      const n = r.int(3, 5);
      let y = 0;
      const wMax = r.range(0.2, 0.25);
      for (let i = 0; i < n; i++) {
        const t = r.range(0.018, 0.04);
        const h = Math.min(wMax - r.range(0, 0.03), maxH);
        const d = r.range(0.13, 0.17);
        const m = comp.matrix.clone()
          .multiply(trs(x + h + r.range(-0.006, 0.006), y + t / 2, comp.depth / 2 - d / 2 - 0.01, 0, r.range(-0.04, 0.04), Math.PI / 2))
          .multiply(_scl.makeScale(t, h, d));
        books.add(m, bookColor(r), r.int(0, 3));
        y += t;
      }
      x += wMax + 0.015;
      placed += n;
      continue;
    }

    // 시리즈 묶음(같은 색·높이 3~6권)
    if (!series && r.chance(0.06)) {
      series = { left: r.int(3, 6), color: r.pick(BOOK_PALETTE), h: Math.min(r.range(0.19, 0.245), maxH), t: r.range(0.022, 0.034), variant: r.int(0, 3) };
    }
    let t: number, h: number, color: THREE.Color, variant: number;
    if (series) {
      t = series.t; h = series.h; color = bookColor(r, series.color); variant = series.variant;
      if (--series.left <= 0) series = null;
    } else {
      t = Math.min(0.045, Math.max(0.01, 0.026 + r.gauss() * 0.008));
      h = Math.min(maxH, r.range(0.18, 0.26));
      color = bookColor(r);
      variant = r.int(0, 3);
    }
    const d = Math.min(comp.depth - 0.02, h * r.range(0.62, 0.72));
    if (t > room) break;
    const zFront = comp.depth / 2 - d / 2 - r.range(0.005, 0.03);

    // 기울어진 책: 오른쪽 자리가 비어야 한다
    if (placed > 2 && !series && r.chance(0.05) && room > 0.12) {
      const a = r.range(0.12, 0.3);
      // 왼쪽 아래 모서리를 축으로 오른쪽으로 기울어짐(앞 책에 기댄다)
      const foot = t * Math.cos(a) + h * Math.sin(a);
      const m = comp.matrix.clone()
        .multiply(trs(x + foot - (t / 2) * Math.cos(a), (t / 2) * Math.sin(a), zFront, 0, 0, a))
        .multiply(_scl.makeScale(t, h, d));
      books.add(m, color, variant);
      x += foot + r.range(0.0, 0.01);
      placed++;
      // 기운 책 뒤는 대개 비워 둔다
      if (r.chance(0.6)) break;
      continue;
    }

    const lean = r.range(-0.012, 0.012);
    const m = comp.matrix.clone()
      .multiply(trs(x + t / 2, 0, zFront, 0, r.range(-0.02, 0.02), lean))
      .multiply(_rot.identity())
      .multiply(_scl.makeScale(t, h, d));
    books.add(m, color, variant);
    x += t + r.range(0.0005, 0.003);
    placed++;
  }

  // 남은 자리가 넉넉하면 북엔드
  if (comp.width - x > 0.06 && r.chance(0.7)) {
    const plate = bevelBox(0.004, 0.14, 0.11, 0.001, 1);
    const foot = bevelBox(0.1, 0.004, 0.11, 0.001, 1);
    bucket.add('bookend', plate, comp.matrix.clone().multiply(trs(x + 0.004, 0.07, comp.depth / 2 - 0.08)));
    bucket.add('bookend', foot, comp.matrix.clone().multiply(trs(x + 0.056, 0.002, comp.depth / 2 - 0.08)));
  }
}

/** 평대·창턱에 눕혀 쌓은 책 더미. m은 더미 바닥 중앙. */
export function stackBooks(m: THREE.Matrix4, r: Rng, books: BookCollector, count: number): number {
  let y = 0;
  for (let i = 0; i < count; i++) {
    const t = r.range(0.015, 0.035);
    const h = r.range(0.19, 0.25);
    const d = h * r.range(0.64, 0.72);
    // 눕힌 책: 높이 축이 -x, 두께 축이 +y
    const mm = m.clone()
      .multiply(trs(h / 2, y + t / 2, 0, 0, r.range(-0.12, 0.12), Math.PI / 2))
      .multiply(_scl.makeScale(t, h, d));
    books.add(mm, bookColor(r), r.int(0, 3));
    y += t;
  }
  return y;
}

/** 표지가 보이게 세워 둔 추천 책. 받침대 포함. m은 받침 바닥 중앙, +z가 앞. */
export function displayBook(m: THREE.Matrix4, r: Rng, books: BookCollector, bucket: MergeBucket): void {
  const h = r.range(0.21, 0.25), w = h * 0.68, t = 0.022;
  // 책 단위 지오메트리를 옆으로 돌려 표지가 +z를 보게 한다(책등은 왼쪽).
  const tilt = -0.22;
  const mm = m.clone()
    .multiply(trs(0, 0.012, 0, tilt, 0, 0))
    .multiply(trs(0, 0, 0, 0, -Math.PI / 2, 0))
    .multiply(_scl.makeScale(t, h, w));
  books.add(mm, bookColor(r), r.int(0, 3));
  // 받침: 아크릴 대신 나무 받침
  bucket.add('walnut', bevelBox(w * 0.9, 0.012, 0.06, 0.003, 1), m.clone().multiply(trs(0, 0.006, 0.02)));
  bucket.add('walnut', bevelBox(w * 0.5, 0.12, 0.012, 0.003, 1), m.clone().multiply(trs(0, 0.06, -0.06, tilt)));
}
