// 큐레이션 매대(허브): 비북스 오프라인 매대처럼 짙은 원목 상판 + 검은 철제 다리.
// 책을 2단으로: 앞단은 낮은 경사 받침에 비스듬히, 뒷단은 높은 흰 단 위에 세워 둔다(13권: 뒷단 7 · 앞단 6).
// 앞에는 작은 추천 카드, 뒤에는 안내판, 위에는 둥근 종이 등.
// 프레임(나무·철·종이)은 병합 버킷으로, 책(표지)·안내판은 클릭할 수 있게 개별 메시로 만든다.
import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import { AWARD_SHELF, curationBannerUrl, curationCoverUrl } from '../../curation/awardShelf';
import { MergeBucket, bevelBox, projectUV, trs } from '../geom';
import { CURATION, ROOM, isPresent } from '../layout';

export interface CurationHit { mesh: THREE.Mesh; index: number }
export interface CurationProp { group: THREE.Group; hits: CurationHit[] }

/** 뒷단 권수(앞쪽 절반, 올림). 나머지는 앞단 */
const BACK_N = Math.ceil(AWARD_SHELF.books.length / 2);
const FRONT_N = AWARD_SHELF.books.length - BACK_N;
const BOOK_W = 0.2;
const BOOK_H = 0.27;
/** 앞단: 수직에서 뒤로 눕힌 각도(라디안). 손님 눈높이에서 표지가 잘 보이게 */
const FRONT_LEAN = 0.95;
/** 뒷단: 높은 흰 단 위에서 살짝만 기댐 */
const BACK_LEAN = 0.2;
const BACK_RISER = 0.17;
const BANNER_W = 1.18;
const BANNER_H = BANNER_W * (393 / 1200);

interface Slot { x: number; y: number; z: number; lean: number }

function colX(i: number, n: number, w: number): number {
  const step = (w - 0.2) / n;
  return (i - (n - 1) / 2) * step;
}

/** 책 아랫변 앞쪽 모서리가 (x, y, z)에 닿게 세울 때 책 중심 */
function leanCenter(x: number, y: number, z: number, lean: number): Slot {
  return { x, y: y + (BOOK_H / 2) * Math.cos(lean), z: z - (BOOK_H / 2) * Math.sin(lean), lean };
}

function slots(w: number, d: number, h: number): { front: Slot[]; back: Slot[]; topY: number } {
  const frontZ = d / 2 - 0.1;
  const backZ = -d / 2 + 0.26;
  const front = Array.from({ length: FRONT_N }, (_, i) => leanCenter(colX(i, FRONT_N, w), h + 0.03, frontZ, FRONT_LEAN));
  const back = Array.from({ length: BACK_N }, (_, i) => leanCenter(colX(i, BACK_N, w), h + BACK_RISER + 0.012, backZ, BACK_LEAN));
  const topY = h + BACK_RISER + BOOK_H * Math.cos(BACK_LEAN);
  return { front, back, topY };
}

function wood(bucket: MergeBucket, r: Rng, mat: string, g: THREE.BufferGeometry, grain: 'x' | 'y' | 'z', m: THREE.Matrix4, k = 1): void {
  projectUV(g, grain, { offset: [r.float(), r.float()] });
  bucket.add(mat, g, m, new THREE.Color(k, k, k));
}

function bannerCenterY(topY: number): number {
  return topY + 0.07 + BANNER_H / 2;
}

/** 매대 몸체·받침·카드·안내판 틀·종이 등(병합). */
export function buildCurationFrame(bucket: MergeBucket, rng: Rng): void {
  if (!isPresent(CURATION)) return;
  const r = rng.fork('curation');
  const { x, z, ry, w, d, h } = CURATION;
  const base = trs(x, 0, z, 0, ry);
  const at = (m: THREE.Matrix4) => base.clone().multiply(m);
  const topT = 0.035;
  const { front, back, topY } = slots(w, d, h);

  // 상판(짙은 원목) + 에이프런
  wood(bucket, r, 'walnut', bevelBox(w, topT, d, 0.012, 3), 'x', at(trs(0, h - topT / 2, 0)), 0.75);
  for (const sz of [-1, 1]) {
    wood(bucket, r, 'walnut', bevelBox(w - 0.12, 0.06, 0.02, 0.004), 'x', at(trs(0, h - topT - 0.03, sz * (d / 2 - 0.05))), 0.68);
  }
  // 검은 철제 사각 다리 + 아래 가로대·선반
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    bucket.add('iron', bevelBox(0.04, h - topT, 0.04, 0.006), at(trs(sx * (w / 2 - 0.05), (h - topT) / 2, sz * (d / 2 - 0.05))));
  }
  for (const sz of [-1, 1]) bucket.add('iron', bevelBox(w - 0.1, 0.025, 0.025, 0.004), at(trs(0, 0.16, sz * (d / 2 - 0.05))));
  wood(bucket, r, 'walnut', bevelBox(w - 0.14, 0.022, d - 0.14, 0.006), 'x', at(trs(0, 0.18, 0)), 0.7);

  // 앞단 경사 받침(흰 판 + 아래 턱)
  const fl = front[0].lean;
  const plateM = (s: Slot) => trs(0, s.y, s.z, -fl).multiply(trs(0, -0.01, -0.03));
  bucket.add('paint', bevelBox(w - 0.1, BOOK_H * 0.82, 0.012, 0.004), at(plateM(front[0])));
  bucket.add('paint', bevelBox(w - 0.1, 0.022, 0.03, 0.005), at(trs(0, h + 0.011, d / 2 - 0.1 + 0.008)));

  // 뒷단 흰 단 + 책 받침 턱
  const bz = back[0].z + (BOOK_H / 2) * Math.sin(BACK_LEAN);
  bucket.add('paint', bevelBox(w - 0.08, BACK_RISER, 0.3, 0.01, 2), at(trs(0, h + BACK_RISER / 2, bz - 0.08)));
  bucket.add('paint', bevelBox(w - 0.08, 0.026, 0.016, 0.004), at(trs(0, h + BACK_RISER + 0.013, bz + 0.012)));

  // 앞줄 추천 카드(흰 텐트형) — 책마다 하나
  for (let i = 0; i < FRONT_N; i++) {
    bucket.add('paper', bevelBox(0.15, 0.055, 0.003, 0.001, 1),
      at(trs(colX(i, FRONT_N, w) + r.range(-0.01, 0.01), h + 0.03, d / 2 - 0.035, -0.4, r.range(-0.05, 0.05))));
  }

  // 안내판 틀·기둥(흰색) — 뒷단 뒤
  const by = bannerCenterY(topY);
  const backEdge = -d / 2 + 0.05;
  for (const sx of [-1, 1]) {
    const top = by + BANNER_H / 2;
    bucket.add('paint', bevelBox(0.03, top - h, 0.03, 0.006), at(trs(sx * (BANNER_W / 2 - 0.1), h + (top - h) / 2, backEdge)));
  }
  bucket.add('paint', bevelBox(BANNER_W + 0.04, BANNER_H + 0.04, 0.02, 0.006), at(trs(0, by, backEdge + 0.02)));

  // 위에 매단 둥근 종이 등
  const lanternY = Math.min(ROOM.h - 0.5, by + BANNER_H / 2 + 0.5);
  const lantern = new THREE.SphereGeometry(0.21, 28, 18);
  lantern.scale(1, 0.92, 1);
  bucket.add('lampShade', lantern, at(trs(0, lanternY, 0.05)));
  for (let k = -3; k <= 3; k++) {
    const yy = (k / 4) * 0.19;
    const rr = Math.sqrt(Math.max(0.0001, 0.21 * 0.21 - (yy / 0.92) ** 2));
    bucket.add('paper', new THREE.TorusGeometry(rr + 0.002, 0.0025, 4, 40), at(trs(0, lanternY + yy, 0.05, Math.PI / 2)));
  }
  bucket.add('iron', new THREE.CylinderGeometry(0.004, 0.004, ROOM.h - lanternY - 0.19, 6),
    at(trs(0, (ROOM.h + lanternY + 0.19) / 2, 0.05)));
}

/** 책 + 안내판(클릭 대상). */
export function buildCurationBooks(): CurationProp | null {
  if (!isPresent(CURATION)) return null;
  const { x, z, ry, w, d, h } = CURATION;
  const group = new THREE.Group();
  group.name = 'curation-table';
  group.position.set(x, 0, z);
  group.rotation.y = ry;
  const loader = new THREE.TextureLoader();
  const load = (url: string) => {
    const t = loader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const pages = new THREE.MeshStandardMaterial({ color: 0xf1ebdd, roughness: 0.95 });
  const hits: CurationHit[] = [];
  const { front, back, topY } = slots(w, d, h);

  AWARD_SHELF.books.forEach((b, idx) => {
    const s = idx < BACK_N ? back[idx] : front[idx - BACK_N];
    const thick = 0.016 + ((idx * 7) % 5) * 0.003;
    const book = new THREE.Group();
    const block = new THREE.Mesh(new THREE.BoxGeometry(BOOK_W, BOOK_H, thick), pages);
    block.position.z = -thick / 2;
    block.castShadow = true;
    block.receiveShadow = true;
    const cover = new THREE.Mesh(
      new THREE.PlaneGeometry(BOOK_W, BOOK_H),
      new THREE.MeshStandardMaterial({ map: load(curationCoverUrl(b.no)), roughness: 0.6 }),
    );
    cover.position.z = 0.0008;
    cover.name = `curation-cover-${b.no}`;
    book.add(block, cover);
    book.position.set(s.x, s.y, s.z + 0.003);
    book.rotation.set(-s.lean, ((idx * 37) % 7 - 3) * 0.01, 0);
    group.add(book);
    hits.push({ mesh: cover, index: idx }, { mesh: block, index: idx });
  });

  // 안내판(운영자 제공 이미지)
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(BANNER_W, BANNER_H),
    new THREE.MeshStandardMaterial({ map: load(curationBannerUrl()), roughness: 0.8 }),
  );
  banner.position.set(0, bannerCenterY(topY), -d / 2 + 0.05 + 0.032);
  banner.name = 'curation-banner';
  group.add(banner);
  hits.push({ mesh: banner, index: 0 });

  return { group, hits };
}
