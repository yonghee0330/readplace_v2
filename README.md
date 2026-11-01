# 비북스 · 원미서가 (readplace v2)

부천 원미동 동네 서점 **비북스**를 옮긴 3D 온라인 공간입니다. 방문객이 아바타로 들어와 비 오는 오후의 서점에 앉아, 각자 자기 책을 함께 읽습니다. 실제 책 본문은 보여주지 않습니다.

> 진행 상황: **단계 1~5 완료**(서점 장면, 아바타·이동, HUD, 함께 있기) + 읽기 모드. 소리·PWA·최종 마무리는 다음 세션입니다. 자세한 내용은 `PROGRESS.md`에 있습니다.

![함께 있는 서점](docs/screens/with-visitors.png)

## 사용법

- **걷기**: 바닥을 누르면 걸어갑니다(가구는 돌아갑니다). 설정에서 켜면 WASD·방향키로도 걸을 수 있습니다.
- **앉기**: 의자·소파·창가 벤치를 누르면 가장 가까운 빈 자리로 가서 앉습니다.
- **둘러보기**: 드래그로 돌리고, 휠·핀치로 확대·축소합니다.
- **하단 버튼**(연결된 뒤 사용 가능): 눈인사(1) · 책 펼치기(2) · 읽기 모드(3). 읽기 모드에서는 Esc 또는 "돌아가기"로 나옵니다.
- **상단**: 나가기, 방 선택(원미서가 1~8), 지금 함께 있는 사람 수, 소리, 설정(품질·닉네임·아바타 색·머리 모양·모션 줄이기·NPC 독자·키보드 이동)

## 실행

```bash
npm install
```

```bash
npm run dev
```

브라우저에서 `http://localhost:5173`을 열고 "들어가기"를 누릅니다.

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 정적 파일 빌드(`dist/`) |
| `npm run preview` | 빌드 결과 미리보기(4173 포트) |
| `npm run typecheck` | 타입 검사 |
| `npm run capture` | 빌드 후 헤드리스 크로미움으로 `docs/screens/`에 스크린샷 저장. `npm run capture -- overview`처럼 이름을 골라 찍을 수도 있음 |
| `npm run server` | 실시간 중계 서버(ws, 기본 8787 포트, `PORT`로 변경) |
| `npm run test:e2e` | e2e 테스트(빌드·미리보기·중계 서버를 알아서 띄움. 소프트웨어 렌더링이라 약 6분) |

### 다른 기기끼리 함께 있기(ws 모드)

```bash
npm run server
```

그다음 `http://localhost:5173/?presence=ws&ws=ws://localhost:8787` 처럼 엽니다. 같은 와이파이의 다른 기기에서는 `localhost` 대신 이 컴퓨터의 IP를 씁니다.

### URL 파라미터

| 파라미터 | 뜻 |
|---|---|
| `seed=86` | 서점 배치 시드. 같은 시드면 항상 같은 서점 |
| `quality=low\|medium\|high` | 그래픽 품질(없으면 기기 자동 판별) |
| `cam=overview\|window\|avatar` | 고정 시점(캡처용). 지정하면 시작 화면을 건너뜀 |
| `autostart=1` | 시작 화면 건너뛰기 |
| `debug=1` | 좌하단에 FPS·드로우콜·삼각형 수 표시 |
| `room=wonmi&instance=86` | 방(원미서가 86) |
| `presence=ws&ws=ws://…` | 중계 서버로 연결(기본은 같은 브라우저 탭끼리) |
| `npc=0` | NPC 독자 숨기기 |
| `autoread=1` | 바로 읽기 모드 |
| `seat=sofa-2` | 앉은 채로 시작(캡처·테스트용) |
| `fx=noao,nobloom` | 진단용: 후처리 패스 끄기 |

## 기술 스택과 패키지

- three **0.187.0**(고정), Vite 8, TypeScript. React는 쓰지 않습니다.
- 후처리: EffectComposer → RenderPass → GTAO(높음) / SAO(보통) → UnrealBloom → OutputPass. ACES 톤매핑, sRGB 출력.
- 글꼴: `@fontsource/noto-serif-kr`(제목), `pretendard`(본문). 로컬 번들이라 오프라인에서도 보입니다.
- 실시간: `ws`(중계 서버). 개발용: `@playwright/test`(캡처·테스트), `tsx`(스크립트·서버 실행), `@types/three`, `@types/node`, `@types/ws`(타입 검사).
- SPEC에 없는 패키지는 추가하지 않았습니다.

## 구조

```
src/core/      시드 난수, URL 파라미터, 품질 단계, 렌더 루프
src/scene/     장면 조립(bookstore), 배치(layout), 재질·절차 텍스처, 조명, 후처리, 창밖, props/*
src/app.ts     앱 조립(장면·아바타·이동·HUD·함께 있기·읽기 모드)
src/avatar/    아바타 모델·애니메이션·이름표·NPC·여러 아바타 관리(crowd)
src/controls/  3인칭 카메라, 경로 탐색(A*), 이동·앉기, 포인터·키보드 입력
src/net/       Presence 인터페이스, Local(BroadcastChannel)·Ws 구현, 닉네임
src/reader/    읽기 모드(집중 독서 화면)와 읽은 시간 기록
src/ui/        로딩, HUD, 토스트, 시트, 설정
server/        ws 중계 서버
tests/         e2e(Playwright)
scripts/       캡처 스크립트
docs/screens/  스크린샷과 시각 품질 판정(REVIEW.md)
assets/models/ 외부 glb 교체용(비어 있음)
```

## 배포(GitHub Pages)

`main`에 올라오면 `.github/workflows/deploy.yml`이 빌드해서 https://yonghee0330.github.io/readplace_v2/ 에 배포합니다. 처음 한 번은 저장소 Settings → Pages → Source를 **GitHub Actions**로 바꿔야 합니다. 정적 호스팅이라 Local 모드(같은 브라우저 탭끼리)로 동작하고, 다른 기기끼리 만나는 ws 모드는 중계 서버를 따로 띄워야 합니다.

## 외부 모델(glb)로 바꾸기

`assets/models/{이름}.glb`를 넣고 다시 빌드하면, 해당 소품은 절차 모델 대신 glb를 씁니다. 지금 지원하는 이름은 `island`, `reading-table`, `counter`, `sofa`입니다. 모델 원점은 바닥 중앙, 정면은 +z 기준입니다. 어떤 파일이 있는지는 빌드할 때 확인하므로, 없는 파일을 요청해 404가 나지는 않습니다.

## 실시간 백엔드 바꾸기(Supabase Realtime·Cloudflare Durable Objects)

`src/net/presence.ts`의 `Presence` 인터페이스(connect·disconnect·sendState·sendAction·onPeers·onAction·onStatus)만 새로 구현하면 됩니다. 피어 목록·들어옴/나감 알림은 `PeerTracker`를 상속하면 그대로 씁니다. `src/app.ts`에서 `?presence=` 값에 따라 구현을 고르는 한 줄만 추가하세요.

- Supabase Realtime: 채널 이름을 `channelName(room, instance)`로, `presence.track(state)` + `broadcast`(눈인사) 사용
- Durable Objects: 방·인스턴스마다 객체 하나, `server/index.ts`의 메시지 형식(join·state·action·leave / welcome·state·action·leave)을 그대로 옮기면 클라이언트는 `WsPresence`를 그대로 씀

## 성능 (보통 품질, 헤드리스 측정, 아바타 3~4명)

- 메인 장면 패스: 드로우콜 75~78, 삼각형 약 21만 → 예산(드로우콜 150, 삼각형 60만) 안
- 프레임 전체(AO 깊이·법선, Bloom 단계, 출력 패스 포함): 드로우콜 163~168
- `?debug=1`이면 좌하단에 FPS와 두 수치가 함께 표시됩니다.
- 정적 소품은 재질별로 병합합니다(재질 하나 = 드로우콜 하나). 책은 InstancedMesh 2개(표지·페이지)를 씁니다.
- 그림자는 시작할 때와 품질을 바꿀 때만 다시 그립니다(`shadowMap.autoUpdate = false`).

## 알려진 한계

- Local 모드는 **같은 브라우저의 탭끼리만** 함께 있는 것처럼 보입니다. 다른 기기끼리 만나려면 ws 서버나 Realtime 서비스가 필요합니다(단계 5).
- 헤드리스 캡처는 소프트웨어 렌더링이라 실제 화면보다 그림자·AO 품질이 낮게 나올 수 있습니다.
- ws 모드에서 서버가 꺼져 있으면, 재연결을 시도할 때마다 브라우저가 `WebSocket connection ... failed`를 콘솔에 직접 남깁니다(앱이 막을 수 없는 브라우저 메시지). 연결된 동안에는 콘솔 에러가 없습니다.
- 닉네임·아바타 색은 이 브라우저(localStorage)에만 저장됩니다. 같은 브라우저 탭끼리 닉네임이 겹치면 나중 탭이 그 탭에서만 다른 닉네임을 씁니다.

## 남은 이슈

- three r187에서 `PCFSoftShadowMap`이 없어져 `PCFShadowMap` + `shadow.radius`로 부드러운 그림자를 냅니다.
- 실내 그림자 광원은 PointLight 대신 SpotLight입니다. PointLight 그림자는 6방향을 그려 비용이 6배이기 때문입니다(운영자 승인).
- 높음 품질의 창유리 빗방울 셰이더는 아직 없습니다.
- 이름표는 Sprite 대신 법선이 있는 평면 빌보드입니다. 이름표·책 아이콘·발밑 그림자는 오버레이 레이어에 두고 AO 계산에서 뺍니다(투명 판이 AO에 사각형 자국을 남기지 않게).
- 소리 토글은 아직 상태만 저장합니다(Web Audio 합성은 단계 7).
- 읽기 모드 카메라는 어깨 너머 대신 앞쪽 비스듬한 위에서 책 읽는 내 아바타를 봅니다(머리가 큰 아바타라 어깨 너머로는 책이 가려짐).
