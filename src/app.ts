// 앱 조립: 장면 + 아바타 + 이동·카메라 + HUD + 함께 있기(presence) + 읽기 모드.
import * as THREE from 'three';
import { Crowd, type Actor } from './avatar/crowd';
import { OVERLAY_LAYER } from './avatar/nameplate';
import { placeAtSeat, setNpcsVisible, spawnNpcs } from './avatar/npc';
import { CAM_PRESETS, FollowCamera, applyPreset, createCamera } from './controls/camera';
import { CanvasInput, isTyping } from './controls/input';
import { Movement } from './controls/movement';
import { Loop } from './core/loop';
import type { Params, QualityLevel } from './core/params';
import { detectQuality, profileFor, type QualityProfile } from './core/quality';
import { Rng } from './core/rng';
import { loadProfile, loadSettings, saveSettings, type Profile, type Settings } from './core/storage';
import { LocalPresence } from './net/localPresence';
import { randomNickname } from './net/nickname';
import { newId, type ActionEvent, type Presence, type PlayerState } from './net/presence';
import { WsPresence } from './net/wsPresence';
import { FocusMode } from './reader/focus';
import { buildBookstore, type Bookstore } from './scene/bookstore';
import { SEATS, SPAWN, SPAWNS, colliders } from './scene/layout';
import { buildPostFx, type PostFx } from './scene/postfx';
import { Hud } from './ui/hud';
import type { LoadingScreen } from './ui/loading';
import { SettingsSheet } from './ui/settings';
import { Sheet, anySheetOpen } from './ui/sheet';
import { Toasts } from './ui/toast';

const NOD_COOLDOWN = 3000;

export async function startApp(params: Params, canvas: HTMLCanvasElement, loading: LoadingScreen, systemReducedMotion: boolean): Promise<void> {
  const settings: Settings = loadSettings();
  if (systemReducedMotion) settings.reducedMotion = settings.reducedMotion || systemReducedMotion;
  const profile: Profile = loadProfile();
  const reducedMotion = () => settings.reducedMotion;

  // ---------- 렌더러 ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  // three r187에서 PCFSoftShadowMap이 없어져 PCFShadowMap + shadow.radius로 부드러운 그림자를 낸다.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.info.autoReset = false;

  const autoLevel = detectQuality(renderer.getContext());
  const levelFor = (s: Settings['quality']): QualityLevel => params.quality ?? (s === 'auto' ? autoLevel : s);
  let q: QualityProfile = profileFor(levelFor(settings.quality));
  renderer.setPixelRatio(q.pixelRatio);
  renderer.setSize(innerWidth, innerHeight, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1d1c19);
  const camera = createCamera(innerWidth / innerHeight);
  camera.layers.enable(OVERLAY_LAYER);
  const rng = new Rng(params.seed);

  const store: Bookstore = await buildBookstore(renderer, scene, q, rng, loading);
  let fx: PostFx = buildPostFx(renderer, scene, camera, q);
  const rain = () => (reducedMotion() ? 0 : q.rainParticles);
  store.exterior.setRain(rain());

  // ---------- 아바타 ----------
  const crowd = new Crowd();
  scene.add(crowd.group, crowd.overlay);
  const myId = newId();
  // 탭마다 닉네임이 겹치면 이 탭에서만 다시 뽑는다(저장된 프로필은 그대로)
  let sessionNick = profile.nickname;
  const me: Actor = crowd.add(myId, 'me', sessionNick, profile, true);
  const npcs = spawnNpcs(crowd, rng);
  setNpcsVisible(npcs, params.npc && settings.npc);

  let lastSentAt = 0;
  // HUD·presence가 만들어지기 전에 이동 상태가 바뀌어도 보내지 않게 한다.
  let wired = false;
  const movement = new Movement(me, () => crowd.takenSeats(myId), () => wired && pushState(true));
  // 첫 번째 사람은 기본 자리, 그 뒤는 id에 따라 다른 자리(연결 후 피어가 있으면 다시 고른다)
  movement.place(SPAWN.x, SPAWN.z, SPAWN.ry);
  const startSeat = params.seat ? SEATS.find((s) => s.id === params.seat) : undefined;
  if (startSeat) movement.sitImmediately(startSeat);

  const follow = new FollowCamera(camera, SPAWN.ry + Math.PI);
  follow.reducedMotion = reducedMotion();
  const fitLook = () => (follow.lookHeight = camera.aspect < 0.8 ? 1.05 : 0.62);
  fitLook();
  follow.follow(me.root.position, true);
  const fixedCam = params.cam && params.cam !== 'avatar' ? params.cam : null;
  if (fixedCam) applyPreset(camera, fixedCam);

  // ---------- UI ----------
  const ui = document.getElementById('ui')!;
  const toasts = new Toasts(ui);
  const focus = new FocusMode(ui, () => setFocus(false));

  let presence: Presence = params.presence === 'ws' ? new WsPresence(params.ws) : new LocalPresence();
  let instance = params.instance;
  let connected = false;
  let peers = new Map<string, PlayerState>();

  const hud = new Hud(ui, instance, {
    exit: () => exitSheet.open(),
    room: (n) => void switchRoom(n),
    sound: () => {
      settings.sound = !settings.sound;
      saveSettings(settings);
      hud.setSound(settings.sound);
  wired = true;
    },
    settings: () => settingsSheet.open(),
    nod: () => nod(),
    book: () => toggleBook(),
    focus: () => setFocus(!focus.active),
  });
  hud.setSound(settings.sound);

  const exitSheet = new Sheet('서점을 나갈까요?', 'exit-sheet');
  exitSheet.body.innerHTML = `<p class="sheet-text">나가면 첫 화면으로 돌아가요. 언제든 다시 들어올 수 있어요.</p>
    <div class="sheet-actions"><button type="button" class="btn" data-act="stay">계속 머물기</button>
    <button type="button" class="btn btn-primary" data-act="leave">나가기</button></div>`;
  exitSheet.body.querySelector('[data-act="stay"]')!.addEventListener('click', () => exitSheet.close());
  exitSheet.body.querySelector('[data-act="leave"]')!.addEventListener('click', () => {
    presence.disconnect();
    const u = new URLSearchParams({ room: params.room, instance: String(instance) });
    location.assign(`${location.pathname}?${u}`);
  });

  const settingsSheet = new SettingsSheet(settings, profile, {
    quality: (s) => applyQuality(levelFor(s)),
    profile: (p) => {
      sessionNick = p.nickname;
      me.avatar.setLook(p);
      me.nickname = p.nickname;
      me.nameplate?.set(p.nickname, p.color);
      pushState(true);
    },
    reducedMotion: (v) => {
      follow.reducedMotion = v;
      store.exterior.setRain(rain());
    },
    npc: (v) => setNpcsVisible(npcs, params.npc && v),
    keyboardMove: () => {},
  }, autoLevel);

  // 첫 진입 안내
  if (!settings.introDismissed && !params.cam && !params.autoread) {
    toasts.show('바닥을 눌러 걷기 · 드래그로 둘러보기 · 휠·핀치로 확대', {
      duration: 6000,
      kind: 'guide',
      action: {
        label: '다시 보지 않기',
        onClick: () => {
          settings.introDismissed = true;
          saveSettings(settings);
        },
      },
    });
  }

  // ---------- 상태 보내기 ----------
  function myState(): PlayerState {
    const p = me.root.position;
    return {
      id: myId, nickname: sessionNick, color: profile.color, hair: profile.hair,
      position: [round(p.x), round(p.y), round(p.z)], rotationY: round(me.root.rotation.y),
      state: movement.state, seatId: movement.seat?.id ?? null, t: Date.now(),
    };
  }
  function pushState(force = false): void {
    const now = performance.now();
    if (!force && now - lastSentAt < 100) return;
    lastSentAt = now;
    presence.sendState(myState());
    hud.setReading(movement.reading);
  }

  // ---------- 함께 있기 ----------
  function wirePresence(p: Presence): void {
    p.onStatus((s) => {
      connected = s === 'connected';
      hud.setConnected(connected, s === 'reconnecting');
    });
    p.onPeers((map) => {
      peers = new Map(map);
      syncPeers();
    });
    p.onAction((a) => onAction(a));
  }

  function syncPeers(): void {
    const now = performance.now();
    for (const a of crowd.list('peer')) if (!peers.has(a.id)) crowd.remove(a.id);
    for (const s of peers.values()) {
      let a = crowd.get(s.id);
      if (!a) {
        a = crowd.add(s.id, 'peer', s.nickname, { color: s.color, hair: s.hair }, true);
        a.root.position.set(...s.position);
        a.root.rotation.y = s.rotationY;
      }
      a.pushRemote(s, now);
      // 닉네임이 겹치면 id가 큰 쪽이 이 탭에서만 다시 뽑는다
      if (s.nickname === sessionNick && myId > s.id) {
        sessionNick = randomNickname();
        me.nickname = sessionNick;
        me.nameplate?.set(sessionNick, profile.color);
        pushState(true);
      }
    }
    // NPC가 앉은 자리에 다른 사람이 앉으면 NPC는 잠시 비켜 준다(겹침 방지)
    const peerSeats = new Set([...peers.values()].map((s) => s.seatId).filter(Boolean));
    if (movement.seat) peerSeats.add(movement.seat.id);
    for (const n of npcs) n.root.visible = params.npc && settings.npc && !peerSeats.has(n.seatId);
    const count = peers.size + 1;
    hud.setCount(count);
    focus.setTogether([...peers.values()].filter((s) => s.state === 'read').length + (movement.reading ? 1 : 0));
  }

  function onAction(a: ActionEvent): void {
    if (a.type === 'join') toasts.show(`${a.nickname}님이 들어왔어요`);
    else if (a.type === 'leave') toasts.show(`${a.nickname}님이 나갔어요`);
    else if (a.type === 'nod') {
      toasts.show(`${a.nickname}님이 눈인사했어요`);
      crowd.get(a.from)?.avatar.anim.bow();
    }
  }

  async function connect(): Promise<void> {
    await presence.connect(params.room, instance, myState());
    syncPeers();
  }

  async function switchRoom(n: number): Promise<void> {
    if (n === instance) return;
    presence.disconnect();
    for (const a of crowd.list('peer')) crowd.remove(a.id);
    peers.clear();
    instance = n;
    const u = new URL(location.href);
    u.searchParams.set('room', params.room);
    u.searchParams.set('instance', String(n));
    history.replaceState(null, '', u);
    hud.setRoom(n);
    await connect();
    toasts.show(`원미서가 ${n}에 들어왔어요`);
  }

  // ---------- 액션 ----------
  let lastNod = -Infinity;
  function nod(): void {
    if (!connected) return;
    const now = performance.now();
    if (now - lastNod < NOD_COOLDOWN) return;
    lastNod = now;
    me.avatar.anim.bow();
    presence.sendAction({ type: 'nod', from: myId, nickname: sessionNick, t: Date.now() });
    toasts.show('눈인사를 건넸어요');
    hud.cooldown('nod', NOD_COOLDOWN);
  }

  function toggleBook(): void {
    if (!connected) return;
    if (focus.active) {
      setFocus(false);
      return;
    }
    movement.toggleReading();
    pushState(true);
  }

  function setFocus(on: boolean): void {
    if (on === focus.active) return;
    if (on) {
      if (!connected) return;
      movement.setReading(true);
      follow.setFocus(focusPose());
      me.hideLabel = true;
      focus.enter();
      hud.setHidden(true);
    } else {
      focus.exit();
      movement.setReading(false);
      follow.setFocus(null);
      me.hideLabel = false;
      hud.setHidden(false);
    }
    pushState(true);
    syncPeers();
  }

  /** 읽기 모드 구도: 책 읽는 내 아바타를 앞쪽 비스듬한 위에서 본다(머리가 큰 아바타라 어깨 너머로는 책이 가려짐). */
  function focusPose() {
    const p = me.root.position, ry = me.root.rotation.y;
    const f = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
    const side = new THREE.Vector3(f.z, 0, -f.x);
    const head = p.y + 0.69;
    // 세로 화면은 시야가 좁아 조금 더 떨어진다
    const k = camera.aspect < 0.8 ? 1.55 : 1;
    const pos = p.clone().addScaledVector(f, 1.05 * k).addScaledVector(side, 0.7 * k);
    pos.y = head + 0.32 * k;
    const look = p.clone().addScaledVector(f, 0.12).addScaledVector(side, 0.05);
    look.y = p.y + 0.5;
    return { pos, look };
  }

  // ---------- 클릭 이동·앉기 ----------
  const hitGroup = new THREE.Group();
  for (const c of colliders()) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(c.x1 - c.x0, c.h, c.z1 - c.z0), new THREE.MeshBasicMaterial({ visible: false }));
    box.position.set((c.x0 + c.x1) / 2, c.h / 2, (c.z0 + c.z1) / 2);
    box.userData.seats = c.seats ?? null;
    hitGroup.add(box);
  }
  hitGroup.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const ring = makeRing();
  scene.add(ring.mesh);

  function clickAt(clientX: number, clientY: number): void {
    if (focus.active) return;
    const ndc = new THREE.Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([...hitGroup.children, store.floor], false);
    const hit = hits[0];
    if (!hit) return;
    const seats = hit.object.userData.seats as string[] | null | undefined;
    if (seats) {
      const seat = movement.sitNear({ x: hit.point.x, z: hit.point.z }, seats) ?? movement.sitNear({ x: hit.point.x, z: hit.point.z });
      if (!seat) toasts.show('빈 자리가 없어요');
      else ring.show(seat.x, seat.z);
    } else {
      const dest = movement.walkTo({ x: hit.point.x, z: hit.point.z });
      if (dest) ring.show(dest.x, dest.z);
    }
    pushState(true);
  }

  const input = new CanvasInput(canvas, {
    click: clickAt,
    drag: (dx, dy) => {
      if (!fixedCam) follow.rotate(dx, dy);
    },
    zoom: (f) => {
      if (!fixedCam && !follow.focused) follow.zoom(f);
    },
  });

  addEventListener('keydown', (e) => {
    if (isTyping(e) || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Escape') {
      if (focus.active && !anySheetOpen()) setFocus(false);
      return;
    }
    if (anySheetOpen()) return;
    if (e.key === '1') nod();
    else if (e.key === '2') toggleBook();
    else if (e.key === '3') setFocus(!focus.active);
  });

  // ---------- 품질 ----------
  function applyQuality(level: QualityLevel): void {
    q = profileFor(level);
    renderer.setPixelRatio(q.pixelRatio);
    renderer.setSize(innerWidth, innerHeight, false);
    store.lighting.applyQuality(q);
    store.exterior.setRain(rain());
    fx.dispose();
    fx = buildPostFx(renderer, scene, camera, q);
    fx.setSize(innerWidth, innerHeight);
  }

  const onResize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    if (fixedCam) applyPreset(camera, fixedCam);
    else camera.updateProjectionMatrix();
    fitLook();
    fx.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', onResize);
  fx.setSize(innerWidth, innerHeight);

  // ---------- 연결 ----------
  await loading.begin('연결');
  wirePresence(presence);
  await connect();
  // 먼저 온 사람이 서 있는 자리와 겹치지 않는 시작 자리로
  if (!startSeat && peers.size) {
    const taken = [...peers.values()].map((p) => p.position);
    const free = SPAWNS.find((sp) => taken.every(([x, , z]) => Math.hypot(x - sp.x, z - sp.z) > 0.6)) ?? SPAWNS[parseInt(myId.slice(0, 4), 16) % SPAWNS.length];
    movement.place(free.x, free.z, free.ry);
    follow.yaw = free.ry + Math.PI;
    follow.follow(me.root.position, true);
    pushState(true);
  }

  // ---------- 루프 ----------
  const loop = new Loop(() => fx.render(), renderer, params.debug);
  loop.add((dt, t) => {
    store.exterior.update(dt);
    if (settings.keyboardMove && !anySheetOpen() && !focus.active) {
      const ax = input.moveAxis();
      movement.keyInput.set(ax.x, ax.y);
    } else {
      movement.keyInput.set(0, 0);
    }
    movement.cameraYaw = follow.viewYaw;
    movement.update(dt);
    if (movement.moving) pushState();
    if (!fixedCam) {
      follow.follow(me.root.position);
      follow.update(dt);
    }
    crowd.update(dt, t, camera);
    ring.update(dt);
  });
  loop.start();

  if (params.autoread) setFocus(true);

  // 테스트·디버그용 조회 창구(상태 읽기와 간단한 조작만)
  (window as unknown as { __BBOOKS: unknown }).__BBOOKS = {
    me: () => myState(),
    toasts: () => [...toasts.log],
    peers: () => [...peers.values()].map((p) => ({ id: p.id, nickname: p.nickname, state: p.state, seatId: p.seatId })),
    visiblePeerAvatars: () => crowd.list('peer').filter((a) => a.root.visible && a.root.parent).map((a) => ({ id: a.id, nickname: a.nickname, nameplate: !!a.nameplate?.mesh.visible })),
    npcCount: () => npcs.filter((n) => n.root.visible).length,
    walkTo: (x: number, z: number) => movement.walkTo({ x, z }),
    sit: (id: string) => {
      const s = SEATS.find((x) => x.id === id);
      return s ? movement.goSit(s) : false;
    },
    clickAt,
    project: (x: number, y: number, z: number) => {
      const v = new THREE.Vector3(x, y, z).project(camera);
      return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
    },
    camPresets: CAM_PRESETS,
    placeAtSeat: (id: string) => {
      const s = SEATS.find((x) => x.id === id);
      if (s) {
        movement.sitImmediately(s);
        placeAtSeat(me, s);
      }
    },
  };

  // 첫 프레임(그림자 포함)이 그려진 뒤 로딩을 걷고 준비 완료 표시
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  await loading.finish(reducedMotion());
  window.__BBOOKS_READY = true;
  console.info(`[bbooks] 품질 ${q.level}, 책 ${store.stats.books}권, NPC ${npcs.length}명, ${params.presence} 모드`);
}

const round = (v: number) => Math.round(v * 1000) / 1000;

/** 목적지 표시: 바닥에 작은 링이 0.5초간 퍼진다. */
function makeRing() {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.13, 40).rotateX(-Math.PI / 2), mat);
  mesh.layers.set(OVERLAY_LAYER);
  mesh.renderOrder = 5;
  let t = 1;
  return {
    mesh,
    show(x: number, z: number) {
      mesh.position.set(x, 0.01, z);
      t = 0;
    },
    update(dt: number) {
      if (t >= 1) {
        mat.opacity = 0;
        return;
      }
      t = Math.min(1, t + dt / 0.5);
      mesh.scale.setScalar(1 + t * 1.6);
      mat.opacity = 0.9 * (1 - t);
    },
  };
}
