// 서점 장면 조립. 로딩 화면의 각 단계가 실제 생성 작업에 대응한다.
import * as THREE from 'three';
import type { QualityProfile } from '../core/quality';
import { Rng } from '../core/rng';
import type { LoadingScreen } from '../ui/loading';
import { buildExterior, type Exterior } from './exterior';
import { MergeBucket, trs } from './geom';
import { COUNTER, FLOOR_PLANTS, ISLAND, READING_TABLE, SOFA, type Placement } from './layout';
import { buildLighting, type Lighting } from './lighting';
import { hasModel, loadOrFallback } from './loadOrFallback';
import { createMaterials } from './materials';
import { BookCollector, fillCompartment, stackBooks } from './props/books';
import { buildContactShadows } from './props/contactShadows';
import { buildBench, buildCoffeeTable, buildCounter, buildIsland, buildReadingTable } from './props/furniture';
import { buildLamps } from './props/lamps';
import { buildPlant } from './props/plants';
import { buildCeiling, buildFloor, buildWalls } from './props/room';
import { buildShelves } from './props/shelf';
import { buildRug, buildSofa } from './props/sofa';
import { buildWallDecor } from './props/wallDecor';
import { buildWindows } from './props/windows';

export interface Bookstore {
  root: THREE.Group;
  lighting: Lighting;
  exterior: Exterior;
  /** 클릭 이동·앉기 판정용 바닥 메시 */
  floor: THREE.Object3D;
  stats: { books: number; planks: number };
}

const NO_SHADOW = new Set(['contactShadow', 'bulb', 'lampShade', 'subfloor', 'rug', 'paper', 'sign', 'painting1', 'painting2']);

export async function buildBookstore(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  q: QualityProfile,
  rng: Rng,
  loading: LoadingScreen,
): Promise<Bookstore> {
  const root = new THREE.Group();
  root.name = 'bookstore';
  const bucket = new MergeBucket();
  const books = new BookCollector();

  await loading.begin('텍스처 생성');
  const mats = createMaterials(rng.fork('materials'));

  await loading.begin('바닥·벽');
  const planks = buildFloor(bucket, rng);
  buildWalls(bucket, rng);
  buildCeiling(bucket, rng);
  const { windows, glass } = buildWindows(bucket, rng);
  glass.material = mats.glass;
  glass.renderOrder = 2;
  root.add(glass);

  await loading.begin('서가');
  const comps = buildShelves(bucket, rng);

  await loading.begin('책');
  const br = rng.fork('books');
  comps.forEach((c, i) => fillCompartment(c, br.fork(`c${i}`), books, bucket));
  // 창턱: 책 더미 + 늘어지는 화분
  windows.forEach((w, i) => {
    const r = rng.fork(`sill-${i}`);
    stackBooks(trs(w.cx - w.w / 2 + 0.25, w.sillTop, w.sillZ, 0, r.range(-0.2, 0.2)), r, books, r.int(2, 4));
    buildPlant(bucket, r, trs(w.cx + w.w / 2 - 0.22, w.sillTop, w.sillZ), i === 0 ? 'trail' : 'bush', 1.1);
  });

  await loading.begin('가구');
  const glbProps: Promise<void>[] = [];
  const prop = (name: string, at: Placement, build: () => void) => {
    if (!hasModel(name)) return build();
    glbProps.push(
      loadOrFallback(name, () => new THREE.Group()).then((o) => {
        o.position.set(at.x, 0, at.z);
        o.rotation.y = at.ry;
        root.add(o);
      }),
    );
  };
  prop('island', ISLAND, () => buildIsland(bucket, rng, books));
  prop('reading-table', READING_TABLE, () => buildReadingTable(bucket, rng, books));
  prop('counter', COUNTER, () => buildCounter(bucket, rng, books));
  prop('sofa', SOFA, () => buildSofa(bucket, rng));
  buildBench(bucket, rng, books);
  buildCoffeeTable(bucket, rng, books);
  buildRug(bucket);
  buildContactShadows(bucket);
  const lamps = buildLamps(bucket);
  FLOOR_PLANTS.forEach((p, i) => buildPlant(bucket, rng.fork(`plant-${i}`), trs(p.x, 0, p.z, 0, i * 1.3), 'tall', p.scale));
  buildPlant(bucket, rng.fork('counter-plant'), trs(COUNTER.x + 0.1, COUNTER.h, COUNTER.z + 0.55), 'bush', 1.0);
  buildWallDecor(bucket, rng);
  await Promise.all(glbProps);

  root.add(bucket.build(mats, { castShadow: (n) => !NO_SHADOW.has(n) }));
  root.add(books.build(mats.bookCover as THREE.MeshStandardMaterial, mats.bookPages));
  const floor = root.getObjectByName('merged:floor')!;

  await loading.begin('조명·후처리');
  const lighting = buildLighting(renderer, scene, lamps, q);
  root.add(lighting.group);
  const exterior = buildExterior(rng, q.rainParticles);
  root.add(exterior.group);

  scene.add(root);
  renderer.shadowMap.needsUpdate = true;
  return { root, lighting, exterior, floor, stats: { books: books.items.length, planks } };
}
