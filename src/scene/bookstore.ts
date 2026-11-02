// 서점 장면 조립. 허브 + 포털 서브룸을 각각 그룹으로 만들고, 활성 공간만 보이게 한다.
import * as THREE from 'three';
import type { QualityProfile } from '../core/quality';
import { Rng } from '../core/rng';
import type { LoadingScreen } from '../ui/loading';
import { buildExterior, type Exterior } from './exterior';
import { MergeBucket, trs } from './geom';
import {
  COUNTER, FLOOR_PLANTS, SPACE_ORDER, STORE_CHAIRS, applyLayout, type Placement, type SpaceId,
} from './layout';
import { buildLighting, type Lighting } from './lighting';
import { hasModel, loadOrFallback } from './loadOrFallback';
import { createMaterials } from './materials';
import { BookCollector, fillCompartment, stackBooks } from './props/books';
import { buildContactShadows } from './props/contactShadows';
import {
  buildBarTable, buildBench, buildChairAt, buildCoffeeTable, buildCounter, buildIslands, buildReadingTable,
} from './props/furniture';
import { buildLamps } from './props/lamps';
import { buildPlant } from './props/plants';
import { buildPortalGlow, buildPortals, type PortalGlow } from './props/portals';
import { buildCeiling, buildFloor, buildWalls } from './props/room';
import { buildShelves } from './props/shelf';
import { buildRug, buildSofa } from './props/sofa';
import { buildWallDecor } from './props/wallDecor';
import { buildWindows } from './props/windows';
import {
  buildPartitions, buildScreen, buildSeminar, buildSoloRoom, buildStoreTable, buildTheater,
} from './props/zones';
import { buildWindowRain, type WindowRain } from './windowRain';

export interface SpaceView {
  id: SpaceId;
  group: THREE.Group;
  floor: THREE.Object3D;
  portalGlow: PortalGlow;
}

export interface Bookstore {
  root: THREE.Group;
  lighting: Lighting;
  exterior: Exterior;
  windowRain: WindowRain;
  floor: THREE.Object3D;
  spaces: Record<SpaceId, SpaceView>;
  activeSpace: SpaceId;
  setActiveSpace: (id: SpaceId) => void;
  updatePortals: (t: number) => void;
  stats: { books: number; planks: number };
}

const NO_SHADOW = new Set(['contactShadow', 'bulb', 'lampShade', 'subfloor', 'rug', 'paper', 'sign', 'painting1', 'painting2']);

function buildOneSpace(
  id: SpaceId,
  mats: ReturnType<typeof createMaterials>,
  rng: Rng,
  sharedGlass: { mesh: THREE.Mesh | null },
): { view: SpaceView; books: number; planks: number; lamps: ReturnType<typeof buildLamps> } {
  applyLayout(id);
  const bucket = new MergeBucket();
  const books = new BookCollector();
  const group = new THREE.Group();
  group.name = `space:${id}`;
  const portalGlow = buildPortalGlow();

  const planks = buildFloor(bucket, rng.fork(`${id}-floor`));
  buildWalls(bucket, rng.fork(`${id}-walls`));
  buildPartitions(bucket, rng.fork(`${id}-part`));
  buildCeiling(bucket, rng.fork(`${id}-ceil`));
  const { windows, glass } = buildWindows(bucket, rng.fork(`${id}-win`));
  glass.material = mats.glass;
  glass.renderOrder = 2;
  group.add(glass);
  if (id === 'hub' && !sharedGlass.mesh) sharedGlass.mesh = glass;

  const comps = buildShelves(bucket, rng.fork(`${id}-shelf`));
  const br = rng.fork(`${id}-books`);
  comps.forEach((c, i) => {
    if (i % 2 === 1 && id === 'hub') return;
    if (i % 3 === 2 && id !== 'hub') return;
    fillCompartment(c, br.fork(`c${i}`), books, bucket);
  });
  windows.forEach((w, i) => {
    const r = rng.fork(`${id}-sill-${i}`);
    stackBooks(trs(w.cx - w.w / 2 + 0.25, w.sillTop, w.sillZ, 0, r.range(-0.2, 0.2)), r, books, r.int(2, 4));
    buildPlant(bucket, r, trs(w.cx + w.w / 2 - 0.22, w.sillTop, w.sillZ), i === 0 ? 'trail' : 'bush', 1.1);
  });

  buildIslands(bucket, rng, books);
  buildReadingTable(bucket, rng, books);
  buildBarTable(bucket, rng, books);
  if (!(id === 'hub' && hasModel('counter'))) buildCounter(bucket, rng, books);
  buildSofa(bucket, rng);
  buildBench(bucket, rng, books);
  buildCoffeeTable(bucket, rng, books);
  buildStoreTable(bucket, rng, books);
  buildSeminar(bucket, rng, books);
  buildSoloRoom(bucket, rng, books);
  STORE_CHAIRS.forEach((c, i) => buildChairAt(bucket, rng.fork(`extra-c-${i}`), trs(c.x, 0, c.z, 0, c.ry)));
  buildTheater(bucket, rng);
  buildScreen(bucket, rng);
  buildRug(bucket);
  buildPortals(bucket);
  buildContactShadows(bucket);
  const lamps = buildLamps(bucket);
  FLOOR_PLANTS.forEach((p, i) => buildPlant(bucket, rng.fork(`${id}-plant-${i}`), trs(p.x, 0, p.z, 0, i * 1.3), 'tall', p.scale));
  if (COUNTER.w > 0.1) {
    buildPlant(bucket, rng.fork(`${id}-cplant`), trs(COUNTER.x + 0.1, COUNTER.h, COUNTER.z - 0.1), 'bush', 1.0);
  }
  buildWallDecor(bucket, rng);

  group.add(bucket.build(mats, { castShadow: (n) => !NO_SHADOW.has(n) }));
  group.add(books.build(mats.bookCover as THREE.MeshStandardMaterial, mats.bookPages));
  group.add(portalGlow.group);
  const floor = group.getObjectByName('merged:floor')!;
  floor.name = `merged:floor:${id}`;
  return {
    view: { id, group, floor, portalGlow },
    books: books.items.length,
    planks,
    lamps,
  };
}

export async function buildBookstore(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  q: QualityProfile,
  rng: Rng,
  loading: LoadingScreen,
): Promise<Bookstore> {
  const root = new THREE.Group();
  root.name = 'bookstore';

  await loading.begin('텍스처 생성');
  const mats = createMaterials(rng.fork('materials'));

  const spaces = {} as Record<SpaceId, SpaceView>;
  let totalBooks = 0;
  let totalPlanks = 0;
  let hubLamps: ReturnType<typeof buildLamps> = [];
  const sharedGlass: { mesh: THREE.Mesh | null } = { mesh: null };

  await loading.begin('바닥·벽');
  for (const id of SPACE_ORDER) {
    if (id === 'seminar') await loading.begin('서가');
    if (id === 'cinema') await loading.begin('책');
    if (id === 'lecture') await loading.begin('가구');
    const built = buildOneSpace(id, mats, rng.fork(id), sharedGlass);
    spaces[id] = built.view;
    totalBooks += built.books;
    totalPlanks += built.planks;
    if (id === 'hub') hubLamps = built.lamps;
    built.view.group.visible = id === 'hub';
    root.add(built.view.group);
  }
  applyLayout('hub');

  // glb 카운터(있을 때만 허브에)
  if (hasModel('counter')) {
    const o = await loadOrFallback('counter', () => new THREE.Group());
    const at = { x: COUNTER.x, z: COUNTER.z, ry: COUNTER.ry } as Placement;
    o.position.set(at.x, 0, at.z);
    o.rotation.y = at.ry;
    spaces.hub.group.add(o);
  }

  const windowRain = buildWindowRain(sharedGlass.mesh?.geometry ?? new THREE.BufferGeometry());
  windowRain.set(q.windowRainShader, true);
  if (sharedGlass.mesh) spaces.hub.group.add(windowRain.mesh);

  await loading.begin('조명·후처리');
  const lighting = buildLighting(renderer, scene, hubLamps, q);
  root.add(lighting.group);
  const exterior = buildExterior(rng, q.rainParticles);
  root.add(exterior.group);

  scene.add(root);
  renderer.shadowMap.needsUpdate = true;

  let activeSpace: SpaceId = 'hub';
  const setActiveSpace = (id: SpaceId) => {
    if (id === activeSpace) return;
    spaces[activeSpace].group.visible = false;
    activeSpace = id;
    spaces[id].group.visible = true;
    applyLayout(id);
    // 창밖·비는 허브에만 의미 있음 — 서브룸에서는 꺼 둠
    exterior.group.visible = id === 'hub';
    windowRain.mesh.visible = id === 'hub' && q.windowRainShader;
    renderer.shadowMap.needsUpdate = true;
  };

  return {
    root,
    lighting,
    exterior,
    windowRain,
    floor: spaces.hub.floor,
    spaces,
    activeSpace,
    setActiveSpace,
    updatePortals: (t: number) => spaces[activeSpace]?.portalGlow.update(t),
    stats: { books: totalBooks, planks: totalPlanks },
  };
}
