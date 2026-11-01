# PROGRESS — 비북스 3D 서점

세션 간 인수인계 문서. 단계마다 "한 일 / 확인 방법 / 남은 일"을 적는다.
기준: SPEC-v3.md 13장. 계획 상세는 PLAN.md.

현재 상태: **세션 3 완료 — 단계 1~8 모두 통과** (저장소 yonghee0330/readplace_v2, 브랜치 session-3-finish. PR #1·#2는 main에 병합, GitHub Pages 배포 중)

---

## 단계 1 — 스캐폴딩, 시드 난수, 품질 설정, 로딩 화면, 빈 장면
- [x] Vite + TS + three(버전 고정) 스캐폴딩, npm 스크립트(dev/build/preview/typecheck/capture/server/test:e2e)
- [x] `core/rng.ts` mulberry32 + 하위 시드, `?seed=`
- [x] `core/params.ts` URL 파라미터 전부
- [x] `core/quality.ts` 낮음/보통/높음 + 기기 자동 판별
- [x] `core/loop.ts` 루프 + `?debug=1` FPS 표시
- [x] `ui/loading.ts` 베이지 + Noto Serif KR "서점 문을 여는 중" + 실제 진행률 + 0.6초 페이드(모션 줄이기면 즉시)
- [x] 글꼴 로컬 번들(@fontsource/noto-serif-kr, pretendard)
- [x] 빈 방 렌더 + `window.__BBOOKS_READY = true`
- 통과 조건: 로딩 진행률이 실제로 오르고 빈 방이 렌더됨 / typecheck·build 통과

## 단계 2 — 텍스처, 공간, 소품 전부, 조명, 후처리, 창밖, 캡처 스크립트
- [x] `textures.ts` 나뭇결 3종, 마루(+거칠기), 회벽, 징두리, 패브릭, 러그
- [x] 공간 8×6×2.8m, 창 2, 문 1, 징두리, 천장 보
- [x] 소품: 서가 5, 책 400~700(InstancedMesh), 평대, 테이블+의자 2, 소파(쿠션·담요), 스탠드 2, 펜던트 3, 계산대, 창틀 2, 화분 3~4, 러그, 벽 장식 2~3
- [x] `seat` 앵커 데이터
- [x] 조명: 키라이트(그림자), 실내 전구(그림자 1), 반구광, 창빛 패치, 노출 조정
- [x] 후처리: GTAO/SAO → Bloom → Output, 품질별
- [x] 창밖: 하늘, 건물 3겹, 가로등, 나무 — (높음) 창유리 빗방울 셰이더는 미구현, 단계 7 성능 튜닝 때 추가 검토
- [x] `loadOrFallback`
- [x] `scripts/capture.ts` + `?cam=overview|avatar|window`
- [x] overview.png 데스크톱·모바일 캡처 → REVIEW.md에 7장 1~9 판정
- 통과 조건: 체크리스트 1~9 통과 → **통과** (docs/screens/REVIEW.md)

### 단계 1·2 결과 (세션 1)
- 한 일: Vite 8 + TS + three 0.187.0 스캐폴딩, 시작 화면 → 로딩(실제 7단계 진행률) → 서점 장면. 절차 텍스처 9종, 소품 전부(서가 5·책 530~700·평대·독서 테이블·의자 2·소파·러그·낮은 테이블·창가 벤치·스탠드 2·펜던트 3·계산대·창틀 2·출입문·화분 6·액자 3·안내판·벽시계), 조명(키라이트 + SpotLight 그림자, 전구 PointLight, 반구광, 창빛 패치, 약한 환경 반사), 후처리(SAO/GTAO → Bloom → Output), 창밖(하늘·건물 3겹·나무·가로등·빗줄기), loadOrFallback, 캡처 스크립트.
- 확인 방법: `npm run typecheck && npm run build` 통과. `npm run capture -- overview` → 콘솔 에러 0개. 로딩 진행률 0→14→29→43→57→71→86→100% 확인(Playwright로 aria-valuenow 관찰).
- 성능(헤드리스, 보통 품질, 프레임 전체 기준): 드로우콜 113, 삼각형 37.8만 → 예산(150 / 60만) 안. 높음 품질 110콜 / 39만.
- SPEC과 달라진 점:
  - three r187에서 `PCFSoftShadowMap`이 없어져 `PCFShadowMap` + `shadow.radius` 사용.
  - 실내 그림자 광원은 SpotLight(운영자 승인).
  - `?autostart=1`(또는 `cam`·`autoread` 파라미터)이면 시작 화면을 건너뜀 — 캡처·테스트용.
  - 단계 3 전 임시로 OrbitControls 둘러보기(`cam` 파라미터 없을 때). 단계 3에서 아바타 3인칭 카메라로 교체.
  - 진단용 파라미터: `?fx=noao,nobloom`, `?campos=x,y,z&camtgt=x,y,z`.
- 남은 일(단계 2 관련): 높음 품질 창유리 빗방울 셰이더, 마루 결 차분하게.

### 세션 2 시작할 때 알아둘 것
- 헤드리스 SwiftShader는 한 프레임이 수 초 걸린다. 캡처 스크립트는 준비 완료 후 `window.__BBOOKS_LOOP.stop()`으로 루프를 멈추고 찍는다. e2e 테스트도 같은 방식이 필요할 수 있다.
- 법선(normal) 없는 지오메트리를 장면에 넣으면 AO 패스에서 NaN → Bloom이 화면 전체를 검게 만든다. 새 메시는 반드시 법선 포함.
- 바닥 클릭 판정용 메시: `store.floor`(merged:floor). 앉을 자리·충돌 박스: `src/scene/layout.ts`의 `SEATS`, `colliders()`.

## 단계 3 — 아바타, 애니메이션, 경로 탐색 이동, 카메라, 앉기, NPC
- [x] 절차 아바타(큰 머리, 옷 8색, 머리 3종)
- [x] 애니메이션: idle, 걷기, 앉기, 읽기, 눈인사, 깜빡임, 머리 위 책 아이콘
- [x] 0.25m 격자 A* + 경로 단순화 + 부드럽게 따라가기, 클릭/드래그 6px 구분, 목적지 링
- [x] 의자·소파 클릭 → 빈 seat로 걸어가 앉기
- [x] 3인칭 오빗 카메라(1.5~7m, 15°~70°), 벽 충돌 당김
- [x] NPC 2~4명
- 통과 조건: 클릭 이동·장애물 회피·앉기, 체크리스트 10 통과

## 단계 4 — HUD, 하단 액션, 토스트, 설정, 첫 진입 안내
- [x] 상단 좌측: 나가기(확인 시트), 방 선택 1~8
- [x] 상단 우측: 접속자 수, 소리 토글(켜기/끄기 상태만 — 실제 소리는 단계 7), 설정 시트(품질·닉네임·색·머리·모션·NPC·키보드 이동), localStorage
- [x] 하단: 눈인사 / 책 펼치기 / 읽기 모드, 연결 전 비활성
- [x] 토스트 최대 3개·4초, 첫 진입 안내 6초 + 다시 보지 않기
- 통과 조건: 모든 버튼 동작, 모바일 폭에서 겹침 없음

## 단계 5 — LocalPresence → WsPresence, 재연결
- [x] Presence 인터페이스, 닉네임 생성
- [x] LocalPresence(BroadcastChannel, 하트비트 2초, 6초 타임아웃)
- [x] 원격 아바타·이름표, 10Hz + 100ms 보간
- [x] server/index.ts + WsPresence, 지수 백오프 재연결, "다시 연결하고 있어요" 필
- [x] e2e: 탭 2개 동기화(Local, ws)
- 통과 조건: 탭 2개에서 아바타·이름표·눈인사·접속자 수 동기화, ws 동일

## 단계 6 — 읽기 모드(집중 독서 화면, SPEC v3.1)
- [x] 진입(버튼·키 3) → 읽기 자세 + 카메라 0.8초 전환, HUD 숨김 (세션 2에서 먼저 구현)
- [x] "함께 읽는 중 N명", 이번 독서 타이머, 오늘 읽은 시간
- [x] localStorage 누적·오늘 시간(날짜 바뀌면 초기화, 10초마다 저장)
- [x] Esc·돌아가기 → 원래 시점, presence 상태 read ↔ stand/sit
- [x] e2e: 읽기 모드 진입 → 타이머 → 돌아가기, 다른 탭에서 "함께 읽는 중 2명"
- 통과 조건: 읽기 모드 진입 → 타이머 동작 → 돌아가기, 다른 탭에서 읽는 모습 보임 → **통과**

### 단계 6 결과 (세션 3)
- 한 일: `tests/e2e.spec.ts`에 "읽기 모드" 테스트 추가 — A(소파에 앉은 채)·B(선 채) 탭 2개, A가 키 3 → 집중 화면·HUD 숨김·상태 read·"함께 읽는 중 1명" → 타이머가 오름 → B도 키 3 → 양쪽 "함께 읽는 중 2명", A에게 B가 read로 보임 → A는 Esc로 나와 sit 복귀·오늘 읽은 시간 저장 확인, B는 "돌아가기" 버튼으로 stand 복귀. 콘솔 에러 0 확인.
- 고친 버그: `app.ts`에서 `wired = true`가 소리 버튼 핸들러 안에 잘못 들어가 있어, 소리 버튼을 누르기 전까지 이동·앉기 상태 변화가 즉시 전송되지 않던 문제.
- 확인 방법: `npx playwright test -g "읽기 모드"` → 1 passed(약 2분, Mac 로컬).

## 단계 7 — 소리, PWA, 접근성, 성능 튜닝
- [x] Web Audio 합성(비, 공기음, 패드, 넘김 소리), 1.5초 페이드
- [x] manifest, 아이콘, 서비스워커(빌드만)
- [x] aria-label, 포커스 링, 키보드(WASD, Tab, Esc, 1/2/3), 모션 줄이기
- [x] 성능 예산 측정 기록
- 통과 조건: 키보드만으로 주요 흐름, 성능 예산 내 → **통과**

### 단계 7 결과 (세션 3)
- 소리(`src/audio/ambience.ts`, `sfx.ts`): 빗소리(화이트 노이즈 → 밴드패스 1.1~1.8kHz + 로우패스, 2.5초마다 진폭·대역 랜덤 변조, 낮은 웅웅거림, 0.25~1.65초 간격 물방울 = 짧은 사인 + 지수 감쇠 + 좌우 위치), 실내 공기음(핑크 노이즈 → 로우패스 260Hz), 패드(음마다 사인 + ±디튠 삼각파 2개, 로우패스 900Hz + 느린 LFO, Fmaj9→Em7→Dm9→Cmaj7 4마디 19.2초 루프, 1.5초 앞서 예약). 효과음: 페이지 넘김(노이즈 2번 + 하이패스 700→5200Hz 스윕) — 책 펼치기·읽기 모드, 눈인사 종소리(보낼 때·받을 때), 나가기·설정 버튼 똑. 기본 꺼짐, 켜고 끌 때 1.5초 페이드, 꺼진 뒤 AudioContext suspend. AudioContext는 소리 버튼을 누를 때(또는 지난번에 켜 두었으면 첫 클릭·키 입력 때) 처음 만든다.
- PWA: `public/manifest.webmanifest`(상대 경로 start_url·scope), `public/icons/icon.svg` + 192·512 PNG(`npm run icons` = Playwright로 SVG→PNG, 새 패키지 없음), `vite.config.ts`의 `bbooks-pwa` 플러그인이 빌드 때만 `dist/sw.js`를 만든다(템플릿 `src/pwa/sw.template.js`에 html·js·css·manifest·아이콘 목록과 버전 해시를 채움). 등록은 `src/pwa/register.ts`(PROD에서만, `./sw.js`, scope `./`). 등록 직후 페이지가 이미 받은 같은 출처 파일(글꼴 등)도 넘겨 캐시. 페이지 이동은 네트워크 우선 → 오프라인이면 캐시한 index.html, 나머지는 캐시 우선.
  - 하위 경로 확인: dist를 `/readplace_v2/` 아래에 두고 띄워 scope `http://localhost:4999/readplace_v2/`, 캐시 9개, 오프라인 새로고침 시 시작 화면 정상·콘솔 에러 0.
- 접근성: HUD를 숨긴 읽기 모드에서는 `inert`라 Tab으로 닿지 않음, Esc는 포커스가 어디 있든 열린 시트부터 닫음, 밝은 바탕(시작 화면·시트)에서는 포커스 링을 짙은 꿀색으로, 방 선택 필은 `:focus-within` 링, 설정의 "모션 줄이기"도 `html.reduce-motion`으로 CSS 전환을 끔(이전엔 시스템 설정만 반영). 캔버스 `role="img"` + 장면 설명 aria-label은 기존.
- 높음 품질 창유리 빗방울 셰이더(`src/scene/windowRain.ts`): 유리 2mm 안쪽 판 하나(드로우콜 1)에 맺힌 물방울 2겹 + 흘러내리는 물줄기. 오버레이 레이어(AO 제외). 모션 줄이기면 물줄기가 멈춘다. 단계 2부터 남아 있던 항목 해결.
- 성능(`npm run perf` → `docs/perf.json`, `npm run perf -- --gpu` → `docs/perf-gpu.json`, 1440×900, seed 86, NPC 포함):

| 품질 | 시점 | 메인 패스 콜 / 삼각형 | 프레임 전체 콜 / 삼각형 | 텍스처 최대 | fps(Mac GPU) |
|---|---|---|---|---|---|
| 낮음 | 아바타 / 전체 | 70 / 21.0만 · 82 / 21.4만 | 71 / 21.0만 · 83 / 21.4만 | 1024 | 60 / 60 |
| 보통 | 아바타 / 전체 | 71 / 21.0만 · 83 / 21.5만 | 155 / 41.8만 · 179 / 42.9만 | 1024 | 60 / 60 |
| 높음 | 아바타 / 전체 | 72 / 20.8만 · 84 / 21.4만 | 155 / 41.6만 · 179 / 42.6만 | 1024 | 60 / 60 |

  메인 패스는 예산(150콜·60만) 안. 프레임 전체는 AO가 깊이·법선을 얻으려고 장면을 한 번 더 그려 150을 조금 넘는다(README 남은 이슈에 기록). 헤드리스 SwiftShader에서는 10~15fps(참고). 높음 품질은 창유리 빗방울 판 1콜 포함.
- e2e 추가: "접근성·소리·PWA" — 동작 줄이기 켠 상태로 Tab→Enter로 입장, Tab 정지점마다 이름·포커스 링 확인, 설정 시트 Enter/Esc + 포커스 복귀, 소리 Enter → AudioContext running·게인 0.7 이상 → 다시 Enter → 0, W로 걷기, 1 눈인사, 3 읽기 모드(HUD에 Tab이 닿지 않음), Esc 복귀, manifest 아이콘·서비스워커 ready.
- 확인 방법: `npm run typecheck && npm run build` 통과, `npx playwright test -g "키보드만으로"` 통과.

## 단계 8 — e2e, 최종 캡처, README
- [x] npm run test:e2e 전체 통과 + 콘솔 에러 0
- [x] overview / with-visitors / reader × 데스크톱·모바일
- [x] REVIEW.md 7장 전체 재판정
- [x] README 완성
- 통과 조건: SPEC 14장 전부 → **통과**

### 단계 8 결과 (세션 3)
- e2e 4개(`npm run test:e2e`, Mac 약 5분) 전부 통과, 모든 페이지 콘솔 에러 0: 함께 있기 Local / 함께 있기 ws / 읽기 모드 / 키보드·클릭·소리·PWA. 마지막 테스트에 바닥 클릭 이동과 의자·벤치 클릭 앉기를 넣어 14장 흐름(로딩 → 서점 → 클릭 이동·앉기 → 눈인사·책 펼치기 → 읽기 모드 → 돌아가기)을 모두 자동으로 확인.
- 고친 것:
  - ws 모드에서 탭을 닫아도 서버 하트비트 정리(최대 20초)까지 남아 있어 e2e가 가끔 실패 → `WsPresence`도 `pagehide`에서 바로 leave를 보냄.
  - 앉으러 미끄러져 들어가는 동안 상태는 sit인데 seatId가 null로 전송되던 문제 → `Movement.seatId` 하나로 통일.
  - 기본 아바타 시점이 너무 내려다봐 마루가 화면을 많이 차지 → 각도 22°, 시선 높이 0.9m(세로 1.25m).
- 캡처 6장 다시 찍고 SPEC 7장 1~10 전체 재판정 → 모두 통과(`docs/screens/REVIEW.md` 단계 8 절).
- README: 사용법(읽기 모드·소리·키보드·설치), 실행·명령표·e2e 범위, 배포(하위 경로·다른 정적 호스팅·서비스워커), 서가 책 바꾸기(책 본문 없음 안내), glb 교체, Supabase/Durable Objects 전환, 성능 표, 알려진 한계, 남은 이슈.

---

## 기록
- 세션 1: 폴더 준비, PLAN.md 작성. 환경 확인 결과 — npm 열림, Playwright 1.63 + 크로미움 설치됨, ko.wikisource.org·gongu.copyright.or.kr 차단, GitHub 저장소 미연결.
- 세션 1: 단계 1·2 완료, 커밋·푸시.
- 세션 2: 단계 3~5 완료 + 단계 6 대부분, 브랜치 `session-2-avatar-hud-presence`에 커밋·푸시, 초안 PR.
- PR #1(세션 2)·PR #2(GitHub Pages 자동 배포) main에 병합. https://yonghee0330.github.io/readplace_v2/
- 세션 3(Claude Code 데스크톱, Mac): `session-3-finish` 브랜치. Playwright 크로미움(headless shell 1243) 설치.
- 결정(운영자): 실제 책 본문 없음 → 9장 삭제, 3-9는 집중 독서 화면. 실내 그림자 광원은 SpotLight. 기본 구조는 산사와 같게.
