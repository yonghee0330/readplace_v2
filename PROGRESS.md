# PROGRESS — 비북스 3D 서점

세션 간 인수인계 문서. 단계마다 "한 일 / 확인 방법 / 남은 일"을 적는다.
기준: SPEC-v3.md 13장. 계획 상세는 PLAN.md.

현재 상태: **세션 3 완료 — 단계 1~8 모두 통과** (저장소 yonghee0330/readplace_v2, 브랜치 session-3-finish. PR #1·#2는 main에 병합, GitHub Pages 배포 중)

### 운영자 수정 (2026-11-04) — 계단식 강연장 ㄱ자 공연장화
- 한 일: 둘레 서가 유지, 가운데 원형 카페트 + 회색 윙백·마이크, ㄱ자 객석. 3인칭 카메라가 서가·높은 가구에 가리면 거리를 줄여 등 뒤가 시야를 막지 않게 함.
- 확인 방법: `npm run typecheck && npm run build`. 강연장 가운데 윙백 자리에서 시선을 돌려 서가에 카메라가 끼지 않는지.

### 운영자 수정 (2026-11-04) — 책 미리보기(연도·목차·긴 소개) + NPC 베스트셀러
- 한 일: `bookPeek`에 출간연도(`2022(2017)`), 표지 우측 목차, 긴 추천 소개. 카카오 `year`·소개 보강(`BLURB_MAX` 900). NPC 후보에서 자기계발(역행자 등) 제외, 소설·에세이·인문·논픽션 위주 + 목차·연도·소개.
- 확인 방법: `npm run typecheck && npm run build`. NPC 책 배지 → 연도·목차·소개가 채워지는지. Pages는 Edge `kakao-search` 재배포 후 연도 필드 반영.
- 남은 일: 배포 요청 시 Pages + Edge `kakao-search` 함께.

### 운영자 수정 (2026-11-01) — 입장 한 곳, 20명
- 한 일: 방 선택(원미서가 1~8)을 없애고 입장을 원미서가 한 곳으로 고정. 한 방 20명(NPC 제외). 시작 화면에 "한 번에 20명까지", HUD 접속자 수는 `n/20`. 로컬은 먼저 온 순으로, ws 서버는 21번째 `full` 거절. 가득 차면 "자리가 가득 찼어요" 화면. 계산대 앞 서는 자리 20곳으로 늘림.
- 확인 방법: `npm run typecheck && npm run build`. 시작 화면·HUD에 방 선택이 없고 `1/20`이 보이는지, `?cap=1` 탭을 하나 더 열면 두 번째가 입장 거절되는지, ws로 21명째가 `full`인지.
- SPEC과 달라진 점: v3.2. 3-4 방 선택 드롭다운 삭제, 정원 20.

### 운영자 수정 (2026-11-01) — 전체 조망 줌·서점 음악
- 한 일: 카메라 줌 최대 7m→14m, 피치 상한 78°, 멀리 당기면 벽 밖으로 나가 서점 전체 조망·시야 확대. 빗소리·공기음은 weather 버스로 작게, 잔잔한 패드+느린 멜로디를 본 음악으로. 이후 부천 Open-Meteo 실시간 날씨(비·눈·맑음) 연동으로 갱신.
- 확인 방법: `npm run typecheck && npm run build`. 휠로 멀리 당겨 서가·소파·계산대가 한 화면에 들어오는지, 소리 켜면 음악이 들리고 비는 작게 깔리는지.

### 운영자 수정 (2026-11-01) — 읽는 책 표지
- 한 일: 책 펼치기·읽기 모드 전에 제목·저자·출판사 시트. Google Books→Open Library로 표지 조회, 카드로 표시. localStorage에 마지막 책 저장. 본문은 없음(SPEC v3.3).
- 확인 방법: `npm run typecheck && npm run build`. 책 펼치기에서 제목 입력→표지 카드, 읽기 모드에서도 표지·메타가 보이는지. 표지를 못 찾아도 읽기 진행되는지.

### 운영자 수정 (2026-11-02) — 알라딘 표지 프록시
- 한 일: (이후 카카오로 교체됨) 알라딘 OpenAPI 종료로 실제 표지 조회 불가였음.

### 운영자 수정 (2026-11-02) — 카카오 책 표지
- 한 일: 알라딘 제거. `server/kakao.ts` + `GET /api/kakao/search`, Vite `/api/kakao` 프록시. 표지 순서 카카오→Google→Open Library. `KAKAO_REST_API_KEY`·`.env.example` 갱신.
- 확인 방법: `.env`에 REST 키 넣고 `npm run server` → `/health`의 `kakaoKey: true` → 책 펼치기로 한국어 표지 확인. 키 없이도 typecheck·build·폴백 동작.

### 운영자 수정 (2026-11-02) — 비북스 실제 구역 레이아웃 + 이동 가능
- 한 일: 1F 14×10m 구역(세미나·개인·서가 A/B/C·극장·소파·스토어)으로 장면 재배치. 칸막이 문 구멍 콜라이더, 통로·스폰 재조정, NavGrid MARGIN 0.2. SPAWN·SPAWNS 전부 빈 칸, 좌석 32/32 경로 도달. `Movement.place`가 막힌 칸이면 가까운 통로로 스냅.
- 확인 방법: `npm run typecheck && npm run build`. preview에서 입장 후 구역 클릭 이동·소파 앉기. 내비 스크립트: SPAWN free, seats 32/32, zone paths ok.
- SPEC과 달라진 점: 공간 크기·가구 배치가 기존 8×6 단일 방에서 실제 비북스 구역 레이아웃으로 확장(운영자 요청).

### 운영자 수정 (2026-11-02) — 허브 + 포털 분리 공간
- 한 일: 한 방에 모두 넣던 구성을 **중앙 허브(9×7)** + 포털 4개로 분리. 허브는 중앙 테이블·서가·창가 바테이블·매대·소파만. 포털로 세미나실 / 영화감상실 / 계단식 강연 / 1인 작업실 입장. 공간마다 내비·좌석·presence 채널(`room` / `room-seminar` …) 분리. 빛나는 문·문턱·상단 공간 이름 간판. 클릭/근접 시 확인 후 입장. HUD 우측 「공간」메뉴로도 이동. 포털 간 직접 연결 없음(허브↔각 방만). 카카오 표지 `fetchKakaoBook` 공통 경로로 정리.
- 확인 방법: `npm run typecheck && npm run build`. `npm run server` 후 `/health`의 `kakaoKey: true`, 책 펼치기 표지. preview에서 포털 이름·공간 메뉴·확인 입장.
- SPEC과 달라진 점: 단일 연속 공간 → 허브+서브룸 포털 구조(운영자 요청).

### 운영자 수정 (2026-11-02) — Supabase Realtime·카카오 Edge
- 한 일: `@supabase/supabase-js` + `SupabasePresence`(Presence 명단 + Broadcast 위치/눈인사). env 있으면 기본 supabase 모드. `supabase/functions/kakao-search` Edge Function 스캐폴드. Pages 빌드에 `VITE_SUPABASE_*` Secrets 주입.
- 확인 방법: `.env`에 URL·키 → `?presence=supabase`로 탭/기기 2개. Edge 배포 후 책 펼치기 표지. `npm run typecheck && npm run build`.
- 새 패키지: `@supabase/supabase-js` 2.118.0 — Pages에서 다른 기기 함께 있기·표지 프록시용.

### 운영자 수정 (2026-11-03) — 시작 화면 빈티지 서점 문
- 한 일: 시작 화면을 일러스트 서점 문(`src/assets/start-door.jpg`)으로. 문구는 「부천 원미동 비북스」「서점 한 켠에서 각자의 책을 함께 읽어요」「책방 입장하기」만. 입장 시 문 좌우 열림 후 로딩.
- 확인 방법: `npm run typecheck && npm run build`. `npm run dev`에서 문·문구·열림 애니메이션 확인.

### 운영자 수정 (2026-11-03) — 매니저(써든리) 계정
- 한 일: 시작 화면 「비북스-M」의 M에 숨긴 매니저 코드 입장. 써든리 매니저(대표) 고정 닉·분홍 티·커튼 헤어·금테 안경·소금후추 수염 아바타. presence `role: manager`로 다른 사람에게도 보임. 설정에서 닉·외형 잠금.
- 확인 방법: 제목 M → 코드 `sudden2026` 입장. 이름표에 (대표). 일반 입장과 프로필 분리.

### 운영자 수정 (2026-11-03) — 가오픈 포스트잇 월
- 한 일: 허브 창가에 코르크 이벤트 보드. 클릭 시 확대 UI에서 색·모양·40자 메시지 후 보드에 붙이기. localStorage(+탭 Broadcast) 기본, Supabase `bbooks_postits` 있으면 공유(`supabase/postits.sql`).
- 확인 방법: `npm run typecheck && npm run build`. 창가 보드 클릭 → 포스트잇 작성·부착. 모바일에서도 동일.

### 운영자 수정 (2026-11-03) — 비북스-M 이름·가오픈 인사·8인 테이블·벽면 포털
- 한 일: 공간 이름 `비북스-M`. 시작 화면에 가오픈 환영 문구. 허브 포털을 측벽에 문처럼 붙임. 중앙 독서 테이블을 8인(긴 변 3+양끝 1)으로 확장.
- 확인 방법: `npm run typecheck && npm run build`. 시작 화면·HUD 이름, 벽면 문형 포털, 중앙 8석 테이블.

### 운영자 수정 (2026-11-03) — NPC 서서 읽기 · 1인실 1명 · 서점 BGM
- 한 일: NPC 4명 고정(중앙 홀 2·세미나 1·계단식 강연 서가 앞 1) — 앉지 않고 서서 책 읽기. 1인실 presence 정원 1, 이용 중이면 「현재 이용 중입니다. 기다려주세요.」 후 허브로. 배경음악 YouTube(`xjOG0beBrgM`) 기본, 설정에서 음악 on/off·볼륨(0–100). 자연소리는 제거. 영화 감상 중에는 BGM·앰비언트 잠시 끔.
- 확인 방법: `npm run typecheck && npm run build`. 허브·세미나·강연에서 NPC 서서 읽기. 탭 2개로 1인실 동시 입장 시 두 번째 거절. 소리 켜면 BGM, 설정에서 볼륨 조절.

### 운영자 수정 (2026-11-03) — BGM만 · 볼륨 슬라이더
- 한 일: 자연소리 UI·재생 제거. 설정에 배경음악 볼륨(0–100) 슬라이더 추가, localStorage 유지.
- 확인 방법: `npm run typecheck && npm run build`. 소리 켠 뒤 설정에서 볼륨 드래그 시 BGM 크기 변함.

### 운영자 수정 (2026-11-03) — 포스트잇 작성·자리 고르기
- 한 일: 창가 보드 클릭 → 작성 UI(입력 포커스) → 「붙이기」 → 보드에서 자리 클릭. 고스트 미리보기·압정·취소. localStorage(+탭 Broadcast) 유지, Supabase `bbooks_postits` 있으면 공유. 보드 근처 안내 토스트.
- 확인 방법: `npm run typecheck && npm run build`. 허브 창가 보드 클릭 → 메시지 작성 → 붙이기 → 자리 선택 → 새로고침 후에도 남음.

### 운영자 수정 (2026-11-03) — 포스트잇 Supabase 반영
- 한 일: `bbooks-meta`에 `bbooks_postits` 테이블·RLS·Realtime publication 적용. 클라이언트에 postgres_changes 구독 추가(폴링 보조).
- 확인 방법: 기기/탭 2개에서 보드에 붙이면 상대에게도 나타남. `npm run typecheck && npm run build`.

### 운영자 수정 (2026-11-03) — 닉네임: 동네 + 고전 인물
- 한 일: `망원동 안나` 형식. 동네는 IP(ipwho.is)로 서울·부천·인천·경기 풀 매핑, 실패 시 경인 동 랜덤. 등장인물은 세계문학 고전 짧은 이름.
- 확인 방법: 설정에서 다시 뽑기 → `○○동 ○○`. `npm run typecheck && npm run build`.
- SPEC과 달라진 점: NPC는 앉기→서가 앞 서서 읽기(운영자 요청). 서점 음악은 Web Audio 패드 대신 YouTube 임베드(운영자 지정 곡).

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

## 서점 고양이 "치즈" (세션 4)
- `src/avatar/cat.ts`: 절차 모델 치즈 태비(드로우콜 약 15) + 상태머신. 앉기·그루밍·식빵·낮잠(러그/소파)·기지개·야옹·꼬리 쫓기·덮치기·걷기·우다다·소파 점프·인사하러 오기·쓰다듬기(클릭). 허브 전용, NPC 설정과 함께 켜고 끔, 접속자 수에 안 셈.
- `Sfx`에 `meow` 합성음 추가. `scripts/cat-poses.ts`로 동작별 점검 캡처(소파 위 높이 0.4m 확인).
- 디버그 창구 `__BBOOKS.cat/catForce/catDo/catCam/teleport`.

---

## 기록
- 세션 1: 폴더 준비, PLAN.md 작성. 환경 확인 결과 — npm 열림, Playwright 1.63 + 크로미움 설치됨, ko.wikisource.org·gongu.copyright.or.kr 차단, GitHub 저장소 미연결.
- 세션 1: 단계 1·2 완료, 커밋·푸시.
- 세션 2: 단계 3~5 완료 + 단계 6 대부분, 브랜치 `session-2-avatar-hud-presence`에 커밋·푸시, 초안 PR.
- PR #1(세션 2)·PR #2(GitHub Pages 자동 배포) main에 병합. https://meta.bbooks.co.kr/
- 세션 3(Claude Code 데스크톱, Mac): `session-3-finish` 브랜치. Playwright 크로미움(headless shell 1243) 설치.
- 결정(운영자): 실제 책 본문 없음 → 9장 삭제, 3-9는 집중 독서 화면. 실내 그림자 광원은 SpotLight. 기본 구조는 산사와 같게.

## 중앙 홀 11월 비모임 포스터
- 중앙 홀 포스트잇 보드 오른쪽(창 유리)에 캔버스 텍스처 포스터(`src/scene/props/moimPoster.ts`). 11월 비모임 안내를 크게 표시.
- 포스터를 클릭하면 https://bbooks.co.kr/moim/ 을 새 탭으로 연다(`openMoimPage`, app.ts). 마우스 올리면 포인터 커서.
- 다음 달 문구는 `moimPoster.ts`의 `paint()`에서 월·부제만 바꾸면 된다. 점검 캡처: `npx tsx scripts/poster-shot.ts out.png`.
- 포스트잇 보드 양쪽 벽에 포스터 1장씩(왼쪽: 11월 비모임 → /moim/, 오른쪽: 서귤 《채달금전》 북토크 → /moim/m/btalk-seogyul-2611/). 표지 이미지는 `public/posters/chaedalgeumjeon.jpg`.
- 포스트잇 하트: 3D 보드의 하트를 124×116으로 키우고 박스를 꽉 채우는 모양으로 다시 그림. 글자는 영역에 들어갈 때까지 크기를 줄여 가며 줄바꿈(`fitText`). 읽기용 DOM 하트도 약간 키움. 점검: `HEARTS=1 npx tsx scripts/poster-shot.ts out.png`.
- 읽고 있는 책 시트: 목차 제거, 표지 확대. 책 소개는 카카오 원문을 그대로 쓰지 않고 `src/reader/blurbSummary.ts`가 완결 문장만 골라 120자 안팎으로 요약(잘린 조각·판매/수상 홍보 문장 제외). 쓸 문장이 없으면 직접 쓴 소개(코스모스 등 `CURATED`) 또는 제목·저자 기반 기본 문구. 점검: `npx tsx scripts/peek-shot.ts out.png [제목] [저자] [출판사]`.
- 카운터: 손님 쪽(방 안, -z)에 높은 바 스툴 1개(좌석 `counter-1`, 앉기 확인) + 카운터 앞면에 '카운터' 간판(`src/scene/props/counterSign.ts`).
- 모바일 책 제목 입력 개선(`src/ui/bookSheet.ts`): 한글 조합이 끝나면 0.65초 뒤 자동 검색(검색 버튼 없이도 목록), 입력칸을 잠그지 않음(키보드·조합 유지), 터치 기기는 저장된 제목 전체 선택 안 함, 포커스 테두리 잘림 수정, 검색 실패·결과 없음일 때 「검색 없이 이 제목으로 읽기」. 참고: tests/e2e.spec.ts의 confirmBook은 예전 입력칸(#book-author 등)을 가정해 이미 맞지 않음.
- 카운터 안쪽(뒤 서가 오른쪽 빈 곳)에 매니저용 높은 바 스툴 1개(좌석 `counter-2`, 카운터를 보고 앉음, 오른쪽에서 진입). `Seat.from`으로 다가가는 지점 직접 지정.
- 음료 마시기: 모금 구간에서 팔을 앞·위로 들어 잔을 얼굴 한가운데 아래쪽(입 위치)까지 가져가고, 마실 땐 입 쪽으로 기울임. 고개는 살짝 숙였다가 잔을 기울일 때 젖힘. 점검: `npx tsx scripts/drink-shot.ts out [coffee|tea|water]`(정면 프레임).
- 공간별 정원(`SPACE_CAPACITY`, layout.ts): 서점 중앙 20 · 세미나실 8 · 영화감상실 8 · 계단식 강연장 20 · 1인 작업실 1. 차면 "○○ 자리가 다 찼어요" 알림 후 서점 중앙으로 돌아옴(처음 입장은 안내 화면). 상단 인원 표시는 공간 정원을 따라 /20·/8·/1로 바뀌고, 공간 목록에도 최대 인원 표시. 표기: 비북스-M 입장 공간 → '서점 중앙', 계단식 강연 → '계단식 강연장'(문 간판 포함). 접속 채널 이름(ROOM_NAME)은 그대로.
- 모바일 배경음악(YouTube): 안드로이드 크롬 에뮬레이션에서는 소리 켜기 탭 후 재생됨(state 1). iOS 사파리·인앱 브라우저는 자동재생을 막을 수 있어, 첫 터치에서 API를 미리 받고, 3.5초 안에 재생이 안 되면 "음악이 안 나오면 화면을 한 번 눌러 주세요" 안내 후 다음 터치에서 재생 재시도(unMute+playVideo). 숨김 플레이어를 화면 밖(-9999px)에서 화면 안 모서리(투명 2px)로 옮김. 디버그: `__BBOOKS.bgm()`이 실제 재생 상태를 돌려줌. 실제 iOS 기기에서는 아직 못 확인.
- 포스트잇 이동: 오늘 보드의 쪽지는 작성자와 상관없이 누구나 끌어서 옮길 수 있음(`PostitStore.move`, 놓은 자리 저장·실시간 반영). 겹친 쪽지를 옆으로 치워 아래 것을 볼 수 있다. 지난 보드는 보기만. (참고: 수정·삭제 버튼은 현재 보드 화면에 없고 스토어 함수만 있음.)

## 계단식 강연장 정리(카페트·의자·방석)
- 원형 카페트+윙백(76% 축소)을 객석 모서리 앞 열린 바닥(0.35,-1.3)으로 옮김. 의자는 모서리를 바라봄.
- 두 객석 윙이 모서리에서 겹쳐 방석이 뭉개지던 문제: 북쪽 윙을 x=0.25로, 서쪽 윙을 3단·z=-0.8로 조정(겹침 없음).
- 모든 방석이 개별 클릭 히트 박스를 가짐(걷기용 큰 박스는 낮게). 전 좌석(30석) 클릭→앉기 e2e 확인.

## 독서포인트 포스터(카운터 뒤 앞벽)
- 출입문과 서가 사이 빈 벽(x=-1.45, 높이 1.75)에 기존 포스터와 같은 크기(폭 0.5)로 부착. 클릭 시 https://bbooks.co.kr/point 이동.
- 사이트 캡처(public/posters/point-capture.png)의 마감 알약·안내 문구를 그대로 쓰고, 메인 카피 '독서포인트 사용 마감 임박'을 크게 그림.
