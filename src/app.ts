// 앱 조립: 장면 + 아바타 + 이동·카메라 + HUD + 함께 있기(presence) + 읽기 모드.
import * as THREE from 'three';
import { Ambience } from './audio/ambience';
import { BookstoreBgm } from './audio/bgm';
import { Sfx } from './audio/sfx';
import { Crowd, type Actor } from './avatar/crowd';
import { OVERLAY_LAYER } from './avatar/nameplate';
import { Cat } from './avatar/cat';
import { placeAtSeat, spawnNpcs, syncNpcVisibility } from './avatar/npc';
import { CAM_PRESETS, FollowCamera, applyPreset, createCamera } from './controls/camera';
import { CanvasInput, isTyping } from './controls/input';
import { Movement } from './controls/movement';
import { Loop } from './core/loop';
import { apiBaseFromWs, resolvePresence, type Params, type QualityLevel } from './core/params';
import { detectQuality, profileFor, type QualityProfile } from './core/quality';
import { Rng } from './core/rng';
import { MANAGER_COLOR, MANAGER_NICKNAME } from './core/manager';
import { loadAuthorId, loadProfile, loadSettings, saveSettings, type Profile, type Settings } from './core/storage';
import { LocalPresence } from './net/localPresence';
import { randomNickname } from './net/nickname';
import { newId, sanitizeSharedBook, type ActionEvent, type Presence, type PlayerState, type SharedBook } from './net/presence';
import { hasSupabaseConfig, supabaseKakaoApiBase } from './net/supabaseClient';
import { SupabasePresence } from './net/supabasePresence';
import { WsPresence } from './net/wsPresence';
import { loadBook, setCoverApiBase, type ReadingBook } from './reader/book';
import { FocusMode, type FocusReader } from './reader/focus';
import { buildBookstore, type Bookstore } from './scene/bookstore';
import { facingPortal } from './scene/props/portals';
import { BookCard } from './ui/bookCard';
import { BookBadgeHits } from './ui/bookBadgeHits';
import { BookPeekSheet } from './ui/bookPeek';
import { BookSheet } from './ui/bookSheet';
import { CinemaWatch } from './ui/cinemaWatch';
import { DrinkSheet } from './ui/drinkSheet';
import { PostitWall } from './ui/postitWall';
import { drinkCooldownMs, drinkToast, isDrinkKind, type DrinkKind } from './net/drink';
import { PostitStore } from './net/postit';
import {
  EVENT_BOARD, PORTALS, SCREEN, SEATS, SPAWN, SPAWNS, applyLayout, colliders, currentSpaceId, isPresent, spaceCapacity, spaceLabel,
  type PortalDef, type SpaceId,
} from './scene/layout';
import { buildPostFx, type PostFx } from './scene/postfx';
import { NavGrid } from './controls/pathfinding';
import { Hud } from './ui/hud';
import type { LoadingScreen } from './ui/loading';
import { SettingsSheet } from './ui/settings';
import { Sheet, anySheetOpen, closeOpenSheet } from './ui/sheet';
import { SpaceSheet } from './ui/spaceSheet';
import { Toasts } from './ui/toast';
import { fetchBucheonWeather, weatherAria, type WeatherInfo } from './weather/bucheon';

const NOD_COOLDOWN = 3000;

export async function startApp(
  params: Params,
  canvas: HTMLCanvasElement,
  loading: LoadingScreen,
  systemReducedMotion: boolean,
  opts: { manager?: boolean } = {},
): Promise<void> {
  const isManager = !!opts.manager;
  const settings: Settings = loadSettings();
  if (systemReducedMotion) settings.reducedMotion = settings.reducedMotion || systemReducedMotion;
  const profile: Profile = loadProfile();
  if (isManager) {
    // 매니저 계정은 고정 닉·외형(일반 프로필과 분리)
    profile.nickname = MANAGER_NICKNAME;
    profile.color = MANAGER_COLOR;
    profile.hair = 'curtain';
  }
  const reducedMotion = () => settings.reducedMotion;
  const applyMotionClass = () => document.documentElement.classList.toggle('reduce-motion', settings.reducedMotion);
  applyMotionClass();

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

  // 부천 실시간 날씨(실패 시 비). ?weather= 으로 고정 가능.
  let weather: WeatherInfo = await fetchBucheonWeather(params.weather);
  const particles = () => (reducedMotion() ? 0 : q.rainParticles);

  // ---------- 아바타 ----------
  const crowd = new Crowd();
  scene.add(crowd.group, crowd.overlay);
  const myId = newId();
  // 탭마다 닉네임이 겹치면 이 탭에서만 다시 뽑는다(저장된 프로필은 그대로)
  let sessionNick = isManager ? MANAGER_NICKNAME : profile.nickname;
  const meLook = isManager
    ? { color: MANAGER_COLOR, hair: 'curtain' as const, manager: true }
    : { color: profile.color, hair: profile.hair };
  const me: Actor = crowd.add(myId, 'me', sessionNick, meLook, true);
  if (isManager) {
    me.isManager = true;
    me.accent = MANAGER_COLOR;
  }
  const npcs = spawnNpcs(crowd, rng);
  let cat: Cat | null = null;
  /** 디버그: 고양이 가까이 보는 카메라 오프셋 */
  let catCam: [number, number, number] | null = null;
  /** 디버그: 내 아바타를 가까이서 보는 카메라 오프셋 */
  let meCam: [number, number, number] | null = null;
  const refreshNpcs = () => {
    const on = params.npc && settings.npc;
    syncNpcVisibility(npcs, currentSpaceId(), on);
    cat?.setVisible(on && currentSpaceId() === 'hub');
  };
  refreshNpcs();

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
  const fitLook = () => (follow.lookHeight = camera.aspect < 0.8 ? 1.25 : 0.9);
  fitLook();
  follow.follow(me.root.position, true);
  const fixedCam = params.cam && params.cam !== 'avatar' ? params.cam : null;
  if (fixedCam) applyPreset(camera, fixedCam);

  // ---------- UI ----------
  const ui = document.getElementById('ui')!;
  const toasts = new Toasts(ui);
  const focus = new FocusMode(ui, () => setFocus(false));
  const cinemaWatch = new CinemaWatch(ui, () => setCinemaWatch(false));
  const authorId = loadAuthorId();
  const postitStore = new PostitStore();
  const postitWall = new PostitWall(ui, postitStore, () => sessionNick, () => authorId, () => setPostitWall(false));
  void postitStore.init().then(() => {
    const syncBoard = () => store.eventBoard?.setNotes(postitStore.list());
    syncBoard();
    postitStore.onChange(() => syncBoard());
  });
  const bookCard = new BookCard(ui);
  const bookSheet = new BookSheet();
  const bookPeek = new BookPeekSheet();
  let currentBook: ReadingBook | null = loadBook();
  // 카카오 표지: 명시 api → Supabase Edge → 로컬 ws 서버 → Vite 프록시
  const presenceMode = resolvePresence(params.presence, location.search, hasSupabaseConfig());
  setCoverApiBase(
    params.api
    || (presenceMode === 'supabase' ? supabaseKakaoApiBase() : '')
    || apiBaseFromWs(params.ws)
    || (import.meta.env.VITE_API_BASE as string | undefined)
    || '',
  );

  let presence: Presence =
    presenceMode === 'ws' ? new WsPresence(params.ws)
      : presenceMode === 'supabase' ? new SupabasePresence(params.cap)
        : new LocalPresence(params.cap);
  let instance = params.instance;
  let connected = false;
  let peers = new Map<string, PlayerState>();

  // ---------- 소리 ----------
  // AudioContext는 사용자가 처음 누른 뒤에만 만든다. 지난번에 켜 두었으면 첫 클릭·키 입력에서 다시 켠다.
  const amb = new Ambience();
  const bgm = new BookstoreBgm();
  const sfx = new Sfx(amb);
  // 서점 고양이 치즈(허브 전용 NPC)
  cat = new Cat(rng.fork('cat'), {
    player: () => ({ x: me.root.position.x, z: me.root.position.z }),
    seatTaken: (id) => crowd.takenSeats().has(id),
    grid: () => movement.grid,
    labelsHidden: () => me.hideLabel,
    onMeow: () => sfx.play('meow'),
  });
  scene.add(cat.root, cat.overlay);
  refreshNpcs();
  amb.setMusicSynth(false);
  amb.setNatureLevel(0);
  function applySoundLayers(): void {
    const on = settings.sound;
    amb.setEnabled(on);
    amb.setNatureLevel(0);
    bgm.setVolume(settings.musicVolume);
    bgm.setEnabled(on && settings.music);
  }
  if (settings.sound) {
    const resume = () => {
      removeEventListener('pointerdown', resume, true);
      removeEventListener('keydown', resume, true);
      if (settings.sound) applySoundLayers();
    };
    addEventListener('pointerdown', resume, true);
    addEventListener('keydown', resume, true);
  }

  const spaceSheet = new SpaceSheet();
  const hud = new Hud(ui, {
    exit: () => {
      sfx.play('tap');
      exitSheet.open();
    },
    sound: () => {
      settings.sound = !settings.sound;
      saveSettings(settings);
      hud.setSound(settings.sound);
      applySoundLayers();
    },
    settings: () => {
      sfx.play('tap');
      settingsSheet.open();
    },
    spaces: () => {
      sfx.play('tap');
      // 메뉴 이동은 시선·근접 제한 없이 확인만 (1인실 등에서도 항상 가능)
      spaceSheet.open((id) => askEnterPortal(
        { to: id, x: 0, z: 0, ry: 0, label: spaceLabel(id), w: 1, d: 1 },
        { fromMenu: true },
      ));
    },
    sit: () => sitDown(),
    nod: () => nod(),
    drink: () => openDrink(),
    book: () => toggleBook(),
    focus: () => setFocus(!focus.active),
  });
  hud.setSound(settings.sound);
  wired = true;

  const applyWeather = () => {
    const kind = weather.kind;
    store.exterior.setWeather(kind, particles());
    store.windowRain.set(kind === 'rain' && q.windowRainShader, !reducedMotion());
    store.lighting.setWeather(kind);
    amb.setWeather(kind);
    hud.setWeather(weather.label);
    document.getElementById('scene')?.setAttribute('aria-label', weatherAria(kind));
  };
  applyWeather();

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
      if (isManager) return;
      sessionNick = p.nickname;
      me.avatar.setLook(p);
      me.nickname = p.nickname;
      me.accent = p.color;
      pushState(true);
    },
    reducedMotion: (v) => {
      applyMotionClass();
      follow.reducedMotion = v;
      applyWeather();
    },
    npc: () => refreshNpcs(),
    keyboardMove: () => {},
    music: (v) => {
      settings.music = v;
      if (settings.sound) bgm.setEnabled(v);
    },
    musicVolume: (v) => {
      settings.musicVolume = v;
      bgm.setVolume(v);
    },
  }, autoLevel, { manager: isManager });

  // 첫 진입 안내
  if (!settings.introDismissed && !params.cam && !params.autoread) {
    toasts.show('창가 보드에 인사·바람·제보를 남겨 주세요', {
      duration: 8000,
      kind: 'guide',
      action: {
        label: '보드 열기',
        onClick: () => {
          settings.introDismissed = true;
          saveSettings(settings);
          if (currentSpaceId() === 'hub') setPostitWall(true);
        },
      },
    });
  }

  // ---------- 상태 보내기 ----------
  /** 읽기 중일 때만 책 메타를 실어 보낸다(표지는 https만). */
  function sharedBook(): SharedBook | null {
    if (!movement.reading || !currentBook?.title) return null;
    return sanitizeSharedBook({
      title: currentBook.title,
      author: currentBook.author,
      publisher: currentBook.publisher,
      coverUrl: currentBook.coverUrl?.startsWith('https://') ? currentBook.coverUrl : null,
    });
  }
  function myState(): PlayerState {
    const p = me.root.position;
    return {
      id: myId,
      nickname: sessionNick,
      color: isManager ? MANAGER_COLOR : profile.color,
      hair: isManager ? 'curtain' : profile.hair,
      position: [round(p.x), round(p.y), round(p.z)],
      rotationY: round(me.root.rotation.y),
      state: movement.state,
      seatId: movement.seatId,
      book: sharedBook(),
      role: isManager ? 'manager' : null,
      t: Date.now(),
    };
  }
  function pushState(force = false): void {
    const now = performance.now();
    if (!force && now - lastSentAt < 100) return;
    lastSentAt = now;
    if (!movement.reading) me.setReadingBook(null);
    else if (currentBook) {
      me.setReadingBook({
        title: currentBook.title,
        author: currentBook.author,
        publisher: currentBook.publisher,
        coverUrl: currentBook.coverUrl?.startsWith('https://') ? currentBook.coverUrl : null,
      });
    }
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
        a = crowd.add(s.id, 'peer', s.nickname, {
          color: s.color,
          hair: s.role === 'manager' ? 'curtain' : s.hair,
          manager: s.role === 'manager',
        }, true);
        a.root.position.set(...s.position);
        a.root.rotation.y = s.rotationY;
      }
      a.pushRemote(s, now);
      // 닉네임이 겹치면 id가 큰 쪽이 이 탭에서만 다시 뽑는다(매니저는 고정)
      if (!isManager && s.nickname === sessionNick && myId > s.id) {
        sessionNick = randomNickname();
        me.nickname = sessionNick;
        pushState(true);
      }
    }
    refreshNpcs();
    const count = peers.size + 1;
    hud.setCount(count);
    const readers: FocusReader[] = [];
    if (movement.reading) {
      readers.push({
        nickname: sessionNick,
        color: profile.color,
        book: sharedBook(),
        self: true,
      });
    }
    for (const s of peers.values()) {
      if (s.state !== 'read') continue;
      readers.push({ nickname: s.nickname, color: s.color, book: s.book });
    }
    focus.setTogether(readers.length);
    focus.setReaders(readers);
  }

  function onAction(a: ActionEvent): void {
    if (a.type === 'join') toasts.show(`${a.nickname}님이 들어왔어요`);
    else if (a.type === 'leave') toasts.show(`${a.nickname}님이 나갔어요`);
    else if (a.type === 'nod') {
      toasts.show(`${a.nickname}님이 눈인사했어요`);
      crowd.get(a.from)?.avatar.anim.bow();
      sfx.play('nod');
    } else if (a.type === 'drink' && isDrinkKind(a.drink)) {
      const what = a.drink === 'water' ? '물' : a.drink === 'coffee' ? '커피' : '차';
      toasts.show(`${a.nickname}님이 ${what}을 마셨어요`);
      crowd.get(a.from)?.avatar.anim.sip(a.drink);
      sfx.play('tap');
    }
  }

  function presenceRoom(): string {
    const space = currentSpaceId();
    return space === 'hub' ? params.room : `${params.room}-${space}`;
  }

  function capacityForSpace(space: SpaceId): number {
    // ?cap=은 테스트용 상한이라 공간 정원과 둘 중 작은 쪽을 쓴다
    return Math.min(params.cap, spaceCapacity(space));
  }

  async function connect(): Promise<'ok' | 'full'> {
    presence.setCapacity(capacityForSpace(currentSpaceId()));
    hud.setCapacity(capacityForSpace(currentSpaceId()));
    const result = await presence.connect(presenceRoom(), instance, myState());
    if (result === 'ok') syncPeers();
    return result;
  }

  // ---------- 액션 ----------
  let lastNod = -Infinity;
  let lastDrink = -Infinity;
  let lastDrinkCd = 2500;
  const drinkSheet = new DrinkSheet((kind) => sipDrink(kind));

  function sitDown(): void {
    if (focus.active) return;
    sfx.play('tap');
    const seat = movement.sitPreferred();
    if (!seat) {
      toasts.show('지금은 빈자리가 없어요');
      return;
    }
    toasts.show('빈자리를 찾아 앉으러 가요');
  }

  function nod(): void {
    if (!connected) return;
    const now = performance.now();
    if (now - lastNod < NOD_COOLDOWN) return;
    lastNod = now;
    me.avatar.anim.bow();
    sfx.play('nod');
    presence.sendAction({ type: 'nod', from: myId, nickname: sessionNick, t: Date.now() });
    toasts.show('눈인사를 건넸어요');
    hud.cooldown('nod', NOD_COOLDOWN);
  }

  function openDrink(): void {
    if (!connected || focus.active) return;
    if (performance.now() - lastDrink < lastDrinkCd) return;
    sfx.play('tap');
    drinkSheet.open();
  }

  function sipDrink(kind: DrinkKind): void {
    if (!connected) return;
    const now = performance.now();
    if (now - lastDrink < lastDrinkCd) return;
    const cd = drinkCooldownMs(kind);
    lastDrink = now;
    lastDrinkCd = cd;
    me.avatar.anim.sip(kind);
    sfx.play('tap');
    presence.sendAction({ type: 'drink', drink: kind, from: myId, nickname: sessionNick, t: Date.now() });
    toasts.show(drinkToast(kind));
    hud.cooldown('drink', cd);
  }

  function applyBook(book: ReadingBook, focusMode: boolean): void {
    currentBook = book;
    bookCard.show(book, focusMode);
    // 이름표 부제는 state===read일 때만 그려진다. 책 확정 직후·읽기 전환 전에 미리 넣어 둔다.
    me.setReadingBook({
      title: book.title,
      author: book.author,
      publisher: book.publisher,
      coverUrl: book.coverUrl?.startsWith('https://') ? book.coverUrl : null,
    });
  }

  /** 캡처·테스트용: 시트 없이 저장된 책(또는 안내용 기본값)으로 바로 읽기 */
  function bookForAuto(): ReadingBook {
    return currentBook ?? loadBook() ?? {
      title: '지금 읽는 책',
      author: '',
      publisher: '',
      coverUrl: null,
    };
  }

  function askBookThen(next: (book: ReadingBook) => void): void {
    // 고정 시점·자동 읽기는 시트를 건너뛴다
    if (params.autoread || params.cam) {
      next(bookForAuto());
      return;
    }
    bookSheet.open(next);
  }

  function enterFocusWith(book: ReadingBook): void {
    applyBook(book, true);
    sfx.play('page');
    movement.setReading(true);
    follow.setFocus(focusPose());
    me.hideLabel = true;
    focus.enter();
    hud.setHidden(true);
    pushState(true);
    syncPeers();
  }

  function toggleBook(): void {
    if (!connected) return;
    if (focus.active) {
      setFocus(false);
      return;
    }
    if (movement.reading) {
      movement.setReading(false);
      bookCard.hide();
      pushState(true);
      return;
    }
    askBookThen((book) => {
      applyBook(book, false);
      movement.setReading(true);
      sfx.play('page');
      pushState(true);
    });
  }

  function setFocus(on: boolean): void {
    if (on === focus.active) return;
    if (on) {
      if (!connected) return;
      if (cinemaWatch.active) setCinemaWatch(false);
      if (postitWall.active) setPostitWall(false);
      // 이미 책을 펼친 상태면 같은 책으로 바로 집중 모드
      if (movement.reading && currentBook) {
        enterFocusWith(currentBook);
        return;
      }
      askBookThen((book) => enterFocusWith(book));
      return;
    }
    focus.exit();
    movement.setReading(false);
    follow.setFocus(null);
    me.hideLabel = false;
    hud.setHidden(false);
    bookCard.hide();
    pushState(true);
    syncPeers();
  }

  function setCinemaWatch(on: boolean): void {
    if (on === cinemaWatch.active) return;
    if (on) {
      if (focus.active) setFocus(false);
      if (postitWall.active) setPostitWall(false);
      // 영화 소리와 겹치지 않게 서점 BGM·앰비언트 잠시 끔
      amb.setEnabled(false);
      bgm.setEnabled(false);
      cinemaWatch.enter();
      store.lighting.setCinemaPlaying(true);
      hud.setHidden(true);
      me.hideLabel = true;
      return;
    }
    cinemaWatch.exit();
    store.lighting.setCinemaPlaying(false);
    hud.setHidden(false);
    me.hideLabel = false;
    if (settings.sound) applySoundLayers();
  }

  function setPostitWall(on: boolean): void {
    if (on === postitWall.active) return;
    if (on) {
      if (focus.active) setFocus(false);
      if (cinemaWatch.active) setCinemaWatch(false);
      postitWall.enter();
      hud.setHidden(true);
      me.hideLabel = true;
      return;
    }
    postitWall.exit();
    hud.setHidden(false);
    me.hideLabel = false;
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

  // ---------- 클릭 이동·앉기·포털 ----------
  const hitGroup = new THREE.Group();
  scene.add(hitGroup);
  /** 포털 확인을 거절·닫은 뒤 같은 문 앞에서 바로 다시 뜨지 않게 */
  let portalPromptIgnoreUntil = 0;
  let portalPromptFor: SpaceId | null = null;
  let boardHintShown = false;

  /** 한글 조사: 받침 없거나 ㄹ이면 '로', 있으면 '으로' */
  function particleRo(word: string): string {
    const ch = word[word.length - 1];
    if (!ch) return '로';
    const code = ch.charCodeAt(0);
    if (code < 0xac00 || code > 0xd7a3) return '로';
    const jong = (code - 0xac00) % 28;
    return jong === 0 || jong === 8 ? '로' : '으로';
  }

  const portalSheet = new Sheet('공간 이동', 'portal-sheet');
  let portalPending: PortalDef | null = null;
  portalSheet.body.innerHTML = `<p class="sheet-text" data-portal-copy></p>
    <div class="sheet-actions">
      <button type="button" class="btn" data-act="cancel">여기에 머물기</button>
      <button type="button" class="btn btn-primary" data-act="enter">들어가기</button>
    </div>`;
  const portalCopy = portalSheet.body.querySelector('[data-portal-copy]') as HTMLElement;
  portalSheet.body.querySelector('[data-act="cancel"]')!.addEventListener('click', () => {
    portalSheet.close();
  });
  portalSheet.body.querySelector('[data-act="enter"]')!.addEventListener('click', () => {
    const p = portalPending;
    portalSheet.close();
    if (p) void enterSpace(p.to, p);
  });
  portalSheet.onClose = () => {
    portalPending = null;
    portalPromptIgnoreUntil = performance.now() + 2500;
    portalPromptFor = null;
  };

  /** 3인칭 카메라가 아바타 너머로 바라보는 수평 방향(모바일 드래그 시선 포함). */
  function lookYaw(): number {
    return follow.viewYaw + Math.PI;
  }

  function portalUsable(portal: PortalDef): boolean {
    // 1인실 출구 문: 가까이 있거나, 카메라/시선이 문 쪽일 때만
    if (currentSpaceId() !== 'solo') return true;
    const p = me.root.position;
    const dist = Math.hypot(p.x - portal.x, p.z - portal.z);
    if (dist < 0.85) return true;
    return facingPortal(portal, { x: p.x, z: p.z, ry: lookYaw() }, 0.15);
  }

  function askEnterPortal(portal: PortalDef, opts?: { fromMenu?: boolean }): void {
    if (switchingSpace || focus.active || cinemaWatch.active || postitWall.active || anySheetOpen()) return;
    if (portal.to === currentSpaceId()) return;
    if (!opts?.fromMenu && !portalUsable(portal)) return;
    const name = spaceLabel(portal.to);
    portalPending = portal;
    portalPromptFor = portal.to;
    portalSheet.el.querySelector('.sheet-title')!.textContent = name;
    portalCopy.textContent = `${name}${particleRo(name)} 들어가시겠습니까?`;
    portalSheet.open();
  }

  function rebuildHits(): void {
    while (hitGroup.children.length) hitGroup.remove(hitGroup.children[0]);
    for (const c of colliders()) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(c.x1 - c.x0, c.h, c.z1 - c.z0), new THREE.MeshBasicMaterial({ visible: false }));
      box.position.set((c.x0 + c.x1) / 2, c.h / 2, (c.z0 + c.z1) / 2);
      box.userData.seats = c.seats ?? null;
      if (c.eventBoard) box.userData.eventBoard = true;
      hitGroup.add(box);
    }
    for (const p of PORTALS) {
      // 모바일 탭이 쉬운 두꺼운 히트 박스
      const box = new THREE.Mesh(new THREE.BoxGeometry(p.w + 0.15, 2.2, Math.max(0.75, p.d + 0.55)), new THREE.MeshBasicMaterial({ visible: false }));
      box.position.set(p.x, 1.1, p.z);
      box.rotation.y = p.ry;
      box.userData.portal = p;
      hitGroup.add(box);
    }
    if (isPresent(SCREEN) && SCREEN.w > 0.1) {
      const y = 0.55 + SCREEN.h / 2;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, SCREEN.h + 0.12, SCREEN.w + 0.12),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      box.position.set(SCREEN.x, y, SCREEN.z);
      box.rotation.y = SCREEN.ry;
      box.userData.screen = true;
      hitGroup.add(box);
    }
    hitGroup.updateMatrixWorld(true);
  }
  rebuildHits();

  let switchingSpace = false;
  async function enterSpace(to: SpaceId, via?: PortalDef): Promise<void> {
    if (switchingSpace || to === currentSpaceId() || focus.active) return;
    if (cinemaWatch.active) setCinemaWatch(false);
    if (postitWall.active) setPostitWall(false);
    switchingSpace = true;
    if (movement.reading) {
      movement.setReading(false);
      me.setReadingBook(null);
    }
    movement.stop();
    store.setActiveSpace(to);
    applyLayout(to);
    store.floor = store.spaces[to].floor;
    movement.setSpace(new NavGrid(), [...SEATS]);
    rebuildHits();
    const spawn = SPAWN;
    movement.place(spawn.x, spawn.z, spawn.ry);
    follow.yaw = spawn.ry + Math.PI;
    follow.fitToSpace(true);
    follow.follow(me.root.position, true);
    refreshNpcs();
    hud.setRoomName(spaceLabel(to));
    portalPromptIgnoreUntil = performance.now() + 2000;
    portalPromptFor = null;
    // 공간마다 presence 채널을 나눠 다른 방 사람과 겹치지 않게
    presence.disconnect();
    for (const a of crowd.list('peer')) crowd.remove(a.id);
    peers = new Map();
    hud.setCount(1);
    try {
      const admission = await connect();
      if (admission === 'full') {
        toasts.show(`${spaceLabel(to)} 자리가 다 찼어요. 잠시 뒤에 다시 와 주세요`);
        switchingSpace = false;
        if (to !== 'hub') await enterSpace('hub');
        return;
      }
      toasts.show(to === 'hub' ? `${spaceLabel(to)}으로 돌아왔어요` : `${spaceLabel(to)}에 들어왔어요`);
      if (to === 'cinema') toasts.show('스크린을 누르면 영화가 시작돼요');
      pushState(true);
      syncPeers();
    } finally {
      switchingSpace = false;
      void via;
    }
  }

  const ray = new THREE.Raycaster();
  const ring = makeRing();
  scene.add(ring.mesh);

  function openBookPeek(actor: Actor): boolean {
    const book = actor.book?.title
      ? actor.book
      : actor.bookTitle
        ? { title: actor.bookTitle, author: '', publisher: '', coverUrl: null }
        : null;
    if (!book) return false;
    bookPeek.open({
      nickname: actor.nickname || '독자',
      book,
      blurb: actor.bookBlurb,
    });
    return true;
  }

  const badgeHits = new BookBadgeHits(ui, (actorId) => {
    if (focus.active || anySheetOpen()) return;
    const actor = crowd.get(actorId);
    if (actor) openBookPeek(actor);
  });

  function openPosterLink(url: string, msg: string): void {
    toasts.show(msg);
    window.open(url, '_blank', 'noopener');
  }

  function clickAt(clientX: number, clientY: number): void {
    if (focus.active || cinemaWatch.active || postitWall.active || anySheetOpen()) return;
    const rect = canvas.getBoundingClientRect();
    // 머리 위 책 배지: 화면 좌표 히트(오버레이 레이어·빌보드 뒷면 문제 없음)
    const badgeActor = crowd.pickBookBadge(clientX, clientY, camera, rect);
    if (badgeActor && openBookPeek(badgeActor)) return;
    if (cat?.hit(clientX, clientY, camera, rect)) {
      cat.pet();
      return;
    }

    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    ray.setFromCamera(ndc, camera);
    const posterHits = currentSpaceId() === 'hub' ? store.spaces.hub.poster?.hits : undefined;
    const posterPick = posterHits?.find((h) => ray.intersectObject(h.mesh, false).length);
    if (posterPick) {
      openPosterLink(posterPick.url, posterPick.toast);
      return;
    }
    const boardMesh = store.eventBoard?.hitMesh;
    const targets = boardMesh && currentSpaceId() === 'hub'
      ? [boardMesh, ...hitGroup.children, store.floor]
      : [...hitGroup.children, store.floor];
    const hits = ray.intersectObjects(targets, false);
    if (!hits.length) return;
    // 보드·스크린·문·의자처럼 상호작용 가능한 히트를 일반 가구 충돌보다 우선
    const pick = hits.find((h) => {
      const u = h.object.userData;
      return !!(u.eventBoard || u.screen || u.portal || (u.seats && (u.seats as string[]).length));
    }) ?? hits[0];
    if (pick.object.userData.screen) {
      setCinemaWatch(true);
      return;
    }
    if (pick.object.userData.eventBoard) {
      setPostitWall(true);
      return;
    }
    const portal = pick.object.userData.portal as PortalDef | undefined;
    if (portal) {
      askEnterPortal(portal);
      return;
    }
    const seats = pick.object.userData.seats as string[] | null | undefined;
    if (seats) {
      const seat = movement.sitNear({ x: pick.point.x, z: pick.point.z }, seats) ?? movement.sitNear({ x: pick.point.x, z: pick.point.z });
      if (!seat) toasts.show('빈 자리가 없어요');
      else ring.show(seat.x, seat.z);
    } else {
      const dest = movement.walkTo({ x: pick.point.x, z: pick.point.z });
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

  // 책 배지·보드·스크린 위에 올리면 포인터로 클릭 가능함을 알린다
  canvas.addEventListener('pointermove', (e) => {
    if (focus.active || cinemaWatch.active || postitWall.active || anySheetOpen()) {
      canvas.style.cursor = '';
      return;
    }
    const rect = canvas.getBoundingClientRect();
    if (crowd.pickBookBadge(e.clientX, e.clientY, camera, rect)) {
      canvas.style.cursor = 'pointer';
      return;
    }
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    ray.setFromCamera(ndc, camera);
    const posterMeshes = currentSpaceId() === 'hub' ? store.spaces.hub.poster?.hits.map((h) => h.mesh) : undefined;
    if (posterMeshes) {
      const ph = ray.intersectObjects([...posterMeshes, ...hitGroup.children], false);
      if (ph[0] && posterMeshes.includes(ph[0].object as THREE.Mesh)) {
        canvas.style.cursor = 'pointer';
        return;
      }
    }
    if (currentSpaceId() === 'hub') {
      const board = store.eventBoard?.hitMesh;
      const boardTargets = board ? [board, ...hitGroup.children] : hitGroup.children;
      const bh = ray.intersectObjects(boardTargets, false);
      if (bh.some((h) => h.object.userData.eventBoard)) {
        canvas.style.cursor = 'pointer';
        return;
      }
    }
    if (isPresent(SCREEN) && SCREEN.w > 0.1) {
      const hits = ray.intersectObjects(hitGroup.children, false);
      if (hits[0]?.object.userData.screen) {
        canvas.style.cursor = 'pointer';
        return;
      }
    }
    canvas.style.cursor = '';
  });
  canvas.addEventListener('pointerleave', () => {
    canvas.style.cursor = '';
  });

  addEventListener('keydown', (e) => {
    if (isTyping(e) || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Escape') {
      // 시트가 열려 있으면 시트를 먼저 닫는다(포커스가 시트 밖에 있어도)
      if (anySheetOpen()) closeOpenSheet();
      else if (postitWall.active) setPostitWall(false);
      else if (cinemaWatch.active) setCinemaWatch(false);
      else if (focus.active) setFocus(false);
      return;
    }
    if (anySheetOpen() || cinemaWatch.active || postitWall.active) return;
    if (e.key === '1') nod();
    else if (e.key === '2') toggleBook();
    else if (e.key === '3') setFocus(!focus.active);
    else if (e.key === '4') sitDown();
    else if (e.key === '5') openDrink();
  });

  // ---------- 품질 ----------
  function applyQuality(level: QualityLevel): void {
    q = profileFor(level);
    renderer.setPixelRatio(q.pixelRatio);
    renderer.setSize(innerWidth, innerHeight, false);
    store.lighting.applyQuality(q);
    applyWeather();
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
  const admission = await connect();
  if (admission === 'full') {
    hud.root.hidden = true;
    const full = document.getElementById('full')!;
    const limit = capacityForSpace(currentSpaceId());
    document.getElementById('full-copy')!.innerHTML = `지금은 ${limit}명이 모두 모였어요.<br />누군가 나가면 다시 들어올 수 있어요.`;
    full.hidden = false;
    const back = document.getElementById('full-back')!;
    back.addEventListener('click', () => location.assign(location.pathname));
    await loading.finish(reducedMotion());
    back.focus();
    return;
  }
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
    store.windowRain.update(dt);
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
    cat?.update(dt, t, camera);
    if (catCam && cat) {
      const p = cat.root.position;
      camera.position.set(p.x + catCam[0], p.y + catCam[1], p.z + catCam[2]);
      camera.lookAt(p.x, p.y + 0.16, p.z);
    }
    if (meCam) {
      const p = me.root.position;
      camera.position.set(p.x + meCam[0], p.y + meCam[1], p.z + meCam[2]);
      camera.lookAt(p.x, p.y + 0.55, p.z);
    }
    badgeHits.sync(crowd, camera, canvas, !focus.active && !cinemaWatch.active && !postitWall.active && !anySheetOpen());
    ring.update(dt);
    {
      const p = me.root.position;
      store.updatePortals(t, { x: p.x, z: p.z, ry: lookYaw(), space: currentSpaceId() });
    }
    // 포털 문 앞에 서면 확인만 띄움(자동 전환 없음). 포털끼리 직접 연결하지 않음.
    if (!focus.active && !cinemaWatch.active && !postitWall.active && !anySheetOpen() && performance.now() > portalPromptIgnoreUntil) {
      const p = me.root.position;
      for (const portal of PORTALS) {
        if (!portalUsable(portal)) continue;
        // 작은 방(1인실)은 문까지 발걸음이 짧아 탐지 거리를 조금 넓힘
        const reach = currentSpaceId() === 'solo' ? 1.05 : 0.75;
        if (Math.hypot(p.x - portal.x, p.z - portal.z) < reach) {
          if (portalPromptFor !== portal.to) askEnterPortal(portal);
          break;
        }
      }
    }
    // 창가 포스트잇 보드 근처면 한 번 안내
    if (
      currentSpaceId() === 'hub'
      && store.eventBoard
      && !focus.active
      && !cinemaWatch.active
      && !postitWall.active
      && !anySheetOpen()
      && !boardHintShown
      && isPresent(EVENT_BOARD)
    ) {
      const p = me.root.position;
      if (Math.hypot(p.x - EVENT_BOARD.x, p.z - EVENT_BOARD.z) < 1.6) {
        boardHintShown = true;
        toasts.show('보드를 누르면 포스트잇을 남길 수 있어요', {
          duration: 5000,
          kind: 'guide',
          action: { label: '열기', onClick: () => setPostitWall(true) },
        });
      }
    }
  });
  loop.start();

  if (params.autoread) setFocus(true);

  // 테스트·디버그용 조회 창구(상태 읽기와 간단한 조작만)
  (window as unknown as { __BBOOKS: unknown }).__BBOOKS = {
    me: () => myState(),
    toasts: () => [...toasts.log],
    peers: () => [...peers.values()].map((p) => ({ id: p.id, nickname: p.nickname, state: p.state, seatId: p.seatId, book: p.book })),
    visiblePeerAvatars: () => crowd.list('peer').filter((a) => a.root.visible && a.root.parent).map((a) => ({ id: a.id, nickname: a.nickname, nameplate: !!a.nameplate?.mesh.visible })),
    cat: () => (cat ? { mode: cat.mood, x: cat.root.position.x, y: cat.root.position.y, z: cat.root.position.z, visible: cat.root.visible } : null),
    teleport: (x: number, z: number, ry = 0) => movement.place(x, z, ry),
    catCam: (o: [number, number, number] | null) => { catCam = o; me.root.visible = !o; if (me.nameplate) me.nameplate.mesh.visible = !o; },
    meCam: (o: [number, number, number] | null) => { meCam = o; },
    catDo: (kind: string) => cat?.perform(kind),
    catForce: (mode: Parameters<Cat['force']>[0], dur?: number) => cat?.force(mode, dur),
    npcCount: () => npcs.filter((n) => n.actor.root.visible).length,
    sound: () => amb.status(),
    weather: () => weather,
    /** 장면이 쓰는 텍스처 중 가장 큰 변의 길이(성능 예산: 1024px 이하) */
    maxTextureSize: () => {
      let max = 0;
      scene.traverse((o) => {
        const mats = (o as THREE.Mesh).material;
        for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) {
          for (const v of Object.values(m)) {
            const img = v instanceof THREE.Texture ? (v.image as { width?: number; height?: number } | null) : null;
            if (img?.width) max = Math.max(max, img.width, img.height ?? 0);
          }
        }
      });
      return max;
    },
    peekBook: (title: string, author: string, publisher: string) => bookPeek.open({ nickname: '써든리 매니저', book: { title, author, publisher, coverUrl: null } as never }),
    sipNow: (kind: Parameters<typeof me.avatar.anim.sip>[0]) => me.avatar.anim.sip(kind),
    walkTo: (x: number, z: number) => movement.walkTo({ x, z }),
    space: () => currentSpaceId(),
    enterSpace: (id: SpaceId) => enterSpace(id),
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
    seats: () => SEATS.map((s) => ({ id: s.id, x: s.x, z: s.z, y: s.y })),
    placeAtSeat: (id: string) => {
      const s = SEATS.find((x) => x.id === id);
      if (s) {
        movement.sitImmediately(s);
        placeAtSeat(me, s);
      }
    },
    postits: () => postitStore.list(),
    openPostitWall: () => setPostitWall(true),
  };

  // 첫 프레임(그림자 포함)이 그려진 뒤 로딩을 걷고 준비 완료 표시
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  await loading.finish(reducedMotion());
  window.__BBOOKS_READY = true;
  console.info(`[bbooks] 품질 ${q.level}, 책 ${store.stats.books}권, NPC ${npcs.length}명, ${presenceMode} 모드`);
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
