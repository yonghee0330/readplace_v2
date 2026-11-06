# 인계 문서 — 역곡동 용서점 가상 공간 (비북스-M 코드 기반 새 프로젝트)

작성: 2026-11-06 / 작성자: Claude (비북스-M 가오픈 1~3일차 작업 담당)
받는 사람: ChatGPT Codex (Astra 6, high). 이 문서만 읽어도 시작할 수 있게 썼다.

---

## 0. 한 줄 요약
**비북스-M(3D 가상 서점) 코드를 복제해서, 2018년 오픈한 역곡동 용서점의 작은 가상 공간(운영자의 개인 작업실 겸 서점)을 만든다.**
공간은 딱 두 곳이다.

| 공간 | 설명 |
|---|---|
| ① 용서점 기본 공간 | 역곡동 용서점의 분위기를 옮긴 작은 서점 방. 입장하면 처음 도착하는 곳. |
| ② 작은 모임방 | 동그란 테이블에 5명 정도가 둘러앉는 방. |

두 공간은 문(포털)으로 오간다. 비북스-M의 허브·세미나실·영화관·강연장·1인실은 **모두 걷어낸다**.

---

## 1. 운영자가 정한 것 (바꾸지 말 것)

1. **별도 프로젝트로 만든다.** 비북스-M 저장소(`yonghee0330/readplace_v2`)를 건드리지 않는다. 새 저장소로 복제해서 시작한다(아래 3장).
2. 용서점은 **실제 존재한 가게**(2018년 오픈, 역곡동)다. 분위기는 운영자가 준 사진·설명(`docs/reference/`)을 따른다. **사진이 없는 부분을 지어내지 않는다.** 모르면 합리적 기본값으로 만들고 README "남은 이슈"에 "가정한 것"으로 적는다.
3. 운영자의 **작업실처럼** 쓴다: 방문자가 많이 몰리는 공간이 아니라 소수가 오가는 아늑한 공간. 인원 제한은 작게(권장: 용서점 8명, 모임방 6명 — 운영자 확인 필요).
4. 3D 품질이 최우선. 2D 페이지처럼 보이면 실패. 박스 하나로 때우지 말고 베벨·판재 두께·절차 텍스처·시드 랜덤 변화를 쓴다(기존 코드가 이미 이렇게 한다).
5. **외부 3D 에셋 다운로드 금지**, 산사(sansatemple.com)의 코드·에셋·문구 복사 금지. 모든 모델은 `three.js` 코드로 절차 생성한다.
6. 범위 밖: 로그인, 결제, 채팅, 트래킹, 개인정보 수집. (닉네임은 기존처럼 서버에 저장하지 않는 임시 값)
7. 콘솔 에러 0. 새 패키지는 꼭 필요할 때만, 추가하면 README에 이유를 적는다.
8. 한국어 UI·문구. 사용자와의 대화·커밋 메시지도 한국어.
9. 작업이 끝나면 **기본적으로 배포**한다(3.4). 배포하지 말라고 할 때만 생략.

---

## 2. 비북스-M 코드베이스 지도 (3D 서점 엔진)

기술: Vite + TypeScript + three.js 0.187, 번들 한 덩어리(`src/app.ts` 1,180줄이 총괄). 서버 없음(정적 호스팅) + 선택적으로 Supabase Realtime(접속자 표시).

### 2.1 공간을 정의하는 곳 — 가장 중요
**`src/scene/layout.ts`** (653줄) 가 모든 공간의 "데이터"다.
- `SpaceId = 'hub' | 'seminar' | 'cinema' | 'lecture' | 'solo'` → 새 프로젝트에선 `'shop' | 'circle'` 로 바꾼다.
- `SpaceLayout` 인터페이스: `room(w,d,h)`, `openings`(창·문 개구), `shelves`, `islands`(매대), `partitions`, `readingTable`, `chairs`, `sofa`, `coffeeTable`, `rug`, `floorLamps`, `pendants`, `floorPlants`, `seats`, `spawn(s)`, `portals`, `counter`, `barTable` … 필드가 비어 있으면(`null`/`[]`) 그 가구는 안 만들어진다.
- `makeHub()/makeSeminar()/makeCinema()/makeLecture()/makeSolo()` 가 공간별 레이아웃을 만든다. **가장 작은 예: `makeSolo()`(2.2×2.75m), `makeSeminar()`(8인 사각 테이블).** 새 공간은 이 함수들을 보고 `makeShop()`·`makeCircle()`을 쓴다.
- `SPACE_LAYOUTS`, `SPACE_ORDER`, `SPACE_CAPACITY`(공간별 정원), `spaceLabel()`.
- `applyLayout(id)`가 활성 공간의 값을 모듈 상수(`ROOM`, `SHELVES`, `SEATS`, `RUG` …)에 복사한다. 가구 빌더와 내비·클릭은 이 상수를 읽는다 → **새 가구 종류를 추가하려면** `SpaceLayout` 필드 + `applyLayout` + (필요하면) `colliders()` 3곳을 같이 고친다.
- 좌표: x 왼쪽(-)→오른쪽(+), z 창벽(-)→입구쪽(+), 단위 m, 바닥 y=0. 방 한 변이 4~7m 정도.
- **`colliders()`**: 걷기 막는 상자 + 클릭 히트 박스를 겸한다. `seats: string[]`가 있으면 "앉을 수 있는 상자"가 되어 길찾기에서 비워지고(`seatable`), 클릭하면 가장 가까운 좌석에 앉는다.

### 2.2 가구를 만드는 곳
- `src/scene/props/furniture.ts`: 의자·테이블·벤치·카운터·바 스툴 (`buildChairAt`, `buildReadingTable`, `buildCounter` …)
- `src/scene/props/zones.ts`: 세미나 테이블(`buildSeminar`), 1인 작업실(`buildSoloRoom`), 계단 객석(`buildTheater`), 윙백 의자(`buildWingbackArmchair`), 스크린
- `src/scene/props/sofa.ts`: 소파, **러그**(`buildRug`, `round: true`로 원형), `src/scene/props/shelf.ts`·`books.ts`: 서가와 책등(시드 랜덤), `lamps.ts`·`plants.ts`·`windows.ts`·`room.ts`(벽·바닥·몰딩·문 개구)·`wallDecor.ts`·`portals.ts`(나무 문)·`counterSign.ts`·`moimPoster.ts`(캔버스 텍스처 포스터 예제)·`eventBoard.ts`
- `src/scene/geom.ts`: `bevelBox`, `taperLeg`, `projectUV`, `trs`, `MergeBucket`(같은 재질 지오메트리를 합쳐 드로우콜을 줄임) — **새 가구는 이 헬퍼로 만든다.**
- `src/scene/materials.ts`·`textures.ts`: 절차 텍스처(원목, 패브릭, 벽지 …) — 재질을 추가하려면 여기.
- `src/scene/bookstore.ts`: `buildOneSpace(id)`가 위 빌더를 순서대로 호출. `NO_SHADOW` 집합에 든 이름은 그림자를 안 드린다.
- `src/scene/lighting.ts`: 공간별 분위기(`setSpaceMood`) — SpotLight 기반(PointLight 금지: 실내 그림자 비용).

### 2.3 사람·동작
- `src/avatar/*`: 절차 생성 아바타(정점 색), `animations.ts`(transform-only 애니메이션: 걷기·앉기·눈인사·음료·책), `cat.ts`(허브 전용 고양이 NPC), `npc.ts`·`crowd.ts`(NPC·접속자 관리), `bestsellers.ts`(NPC 책 목록).
- `src/controls/movement.ts`(걷기·앉기 상태기계: `goSit`, `sitNear`, `walkTo`), `pathfinding.ts`(NavGrid, `seatable` 상자는 통과 처리), `camera.ts`(3인칭 따라가기, 방 안 시선 가림 처리).
- `src/net/*`: 접속자 표시. `supabasePresence.ts`(Broadcast, 공간별 채널 `${room}-${space}`), `localPresence.ts`(같은 브라우저 탭끼리), `postit.ts`(오늘의 포스트잇 + Supabase 테이블).
- `src/ui/*`: HUD(상단 방 이름·접속자·소리·설정, 하단 액션), 시트들, 포스트잇 보드 UI.
- `src/audio/*`: 앰비언스·효과음·BGM(유튜브 임베드).

### 2.4 비북스-M 전용이라 **제거/교체**할 것
| 항목 | 위치 | 처리 |
|---|---|---|
| 비북스 이름·문구·URL | `index.html`, `src/core/params.ts`(`ROOM_NAME`, `roomLabel`), `moimPoster.ts` | 용서점으로 교체. `moimPoster.ts`의 `bbooks.co.kr` 링크는 삭제 |
| 11월 비모임·서귤·독서포인트 포스터 | `moimPoster.ts`, `bookstore.ts`(`poster`), `app.ts`(포스터 클릭·호버, `openPosterLink`) | 삭제(또는 용서점 소개 액자로 재사용) |
| 포스트잇 보드(창가 코르크 보드) | `eventBoard.ts`, `postit.ts`, `postitWall.ts`, `supabase/*.sql` | **운영자 확인 후 결정.** 기본값: 용서점 방명록 보드로 유지하되 새 Supabase 프로젝트·새 테이블 이름 사용, 어렵다면 로컬 저장만으로 단순화 |
| 매니저(대표) 로그인 코드 | `src/core/manager.ts`(`MANAGER_NICKNAME`, `managerCode()`) | **비북스의 코드값을 그대로 쓰지 말 것.** 새 값은 운영자가 정해서 환경변수/설정으로. 닉네임·직함도 교체 |
| 카운터 간판 '카운터' | `counterSign.ts` | 용서점 간판(운영자가 글씨 지정)으로 |
| 고양이 '치즈' | `cat.ts` | 운영자가 원하면 유지, 아니면 제거(`app.ts`의 `cat` 관련 코드와 소파 점프 포함) |
| 책 NPC·베스트셀러 | `npc.ts`, `bestsellers.ts` | 접속자가 적어 어색하지 않게 NPC 수를 줄이거나 끈다(`?npc=0` 동작 유지) |
| 영화·강연·세미나 전용 | `cinemaWatch.ts`, `zones.ts`의 스크린·객석·세미나, `app.ts` 영화 관련 | 삭제 |
| 날씨(부천 기상) | `src/weather/bucheon.ts` | 역곡동도 부천이라 유지 가능 |
| BGM 유튜브 ID | `src/audio/bgm.ts`(`YT_ID`) | 운영자가 정한 곡/리스트로 |
| localStorage 키 `bbooks.*`, SW 캐시 `bbooks-` | `storage.ts`, `sw.template.js` 등 | 새 접두어(`yongseojeom.`)로 바꿔 다른 사이트와 충돌 방지 |
| Supabase 채널 이름 | `core/params.ts` `ROOM_NAME`, `net/presence.ts` | 새 룸 이름. **비북스-M과 같은 Supabase 프로젝트를 쓰려면 채널 이름이 겹치지 않게**(권장: 별도 프로젝트) |
| 카카오 책 검색 Edge Function | `supabase/functions/kakao-search`, `src/reader/kakaoApi.ts`, `bookSheet.ts`, `bookPeek.ts` | "지금 읽는 책" 기능을 유지할지 운영자와 확인. 유지하면 새 Supabase 프로젝트에 함수를 다시 배포하고 `KAKAO_REST_API_KEY` 시크릿이 필요 |

> 지우는 작업은 기능 단위로 하나씩, 지울 때마다 `npm run typecheck`를 돌린다. `app.ts`가 크므로 한 번에 크게 지우지 말 것.

### 2.5 유지할 핵심 경험 (산사 구조)
시작 화면 → 로딩 → 공간 + 아바타 → 상단 HUD → 하단 액션(앉기·눈인사·음료·책 펼치기·읽기 모드) → 방 전체 알림 → 집중 모드. 모바일(터치·키보드·BGM 자동재생 제한)이 1급 시민이다.

---

## 3. 시작 방법

### 3.1 새 저장소로 복제
```bash
cd ~/Documents
git clone https://github.com/yonghee0330/readplace_v2.git yongseojeom
cd yongseojeom
rm -rf .git && git init -b main
# GitHub에 새 저장소(yongseojeom 등)를 만든 뒤
git remote add origin <새 저장소 URL>
npm ci
```
- 이 문서 폴더(`docs/yongseojeom/`)는 복제본에 이미 들어 있다.
- 기존 `HANDOFF.md`·`SPEC-v3.md`·`PROGRESS.md`·`PLAN.md`는 **비북스-M 이력**이다. 지우지 말고 `docs/bbooks-m-archive/`로 옮겨 참고용으로 남긴다. 새 `PROGRESS.md`를 시작한다.
- `CLAUDE.md`는 비북스 작업 원칙이다. 이 문서 1장 내용으로 새 `AGENTS.md`(Codex용)를 만들고 `CLAUDE.md`는 아카이브로 옮긴다.

### 3.2 로컬 실행
```bash
npm run dev            # 개발 서버
npm run typecheck && npm run build   # 매 단계 필수
npm run preview        # 빌드 결과 확인(포트 4173)
```
디버그 URL 파라미터: `?autostart=1`(시작 화면 건너뜀) `&cam=avatar`(고정 3인칭 카메라, 자동 읽기) `&npc=0` `&quality=low|medium` `&presence=local` `&seed=1`.

### 3.3 눈으로 확인하는 법 (중요 — 3D는 반드시 스크린샷으로 본다)
- Playwright(Chromium + SwiftShader)로 캡처한다. `scripts/*.ts`에 예제(`poster-shot.ts`, `drink-shot.ts`, `peek-shot.ts`)가 있다. 패턴:
  1. `chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] })`
  2. `vite preview`를 띄우고 `/?cam=avatar&seed=1&npc=0&quality=low&presence=local` 로 이동
  3. `window.__BBOOKS_READY === true` 를 기다린 뒤 `window.__BBOOKS`(디버그 훅) 사용
- `window.__BBOOKS` 훅(`src/app.ts` 끝부분): `enterSpace(id)`, `teleport(x,z,ry)`, `meCam([dx,dy,dz])`(아바타 기준 카메라 오프셋), `seats()`, `project(x,y,z)`(화면 좌표), `clickAt(px,py)`, `me()`, `toasts()`, `walkTo`, `sit(id)`, `placeAtSeat(id)`. 그리고 `window.__BBOOKS_LOOP.start()`로 렌더 루프를 돌린다.
- 카메라는 항상 아바타를 바라보므로, 특정 가구를 정면으로 찍으려면 아바타를 옆으로 비키고 `meCam`을 조정한다.
- **임시 스크립트는 작업 후 지운다**(`scripts/*-tmp.ts`는 커밋하지 않는다).
- 모든 단계 끝에 **이미지를 직접 열어** 판정하고 `docs/screens/REVIEW.md`에 기록한다(미통과면 고쳐 다시 찍기, 최대 3회).

### 3.4 배포 (기본 동작)
GitHub Pages. `.github/workflows/deploy.yml`이 `main` 푸시 때 `npm ci → typecheck → build → Pages 배포`를 한다.
1. 새 저장소 Settings → Pages → Source = "GitHub Actions"
2. (접속자 표시를 쓰면) Secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
3. 커스텀 도메인은 운영자가 정한다(`public/CNAME`). `vite.config.ts`의 `base: './'`라 하위 경로에서도 동작한다.
4. 푸시 후 `gh run list --limit 1`로 `completed success`를 확인한다. 가끔 GitHub 500이 나면 재시도.

---

## 4. 만들 공간 상세 (초안 — 운영자 확인 항목은 ★)

> 사진·실측이 오기 전에는 아래 크기·배치를 "임시 설계"로 만들고, 운영자가 주는 자료로 다듬는다.

### 4.1 공간 ① 용서점 (`id: 'shop'`)
- 크기(임시): 5.5 × 4.5m, 천장 2.8m. 비북스 허브(9×7)보다 훨씬 작고 아늑하게.
- 구성 아이디어: 한쪽 벽 가득 책장(헌책·독립서적 느낌의 서로 다른 책등 높이·색), 입구 쪽 작은 계산대(`counter`) + 스툴 1개, 중앙에 낮은 매대(`islands`, kind `stand`/`flat`), 창가 읽는 자리(안락의자 1~2 + 작은 사이드 테이블 + 플로어 램프), 바닥 러그 1개, 식물·벽 액자, 간판.
- 좌석(앉기 가능): 계산대 스툴 1, 안락의자 2, 작은 벤치/의자 2~3 → 총 5~6석.
- 포털: 모임방으로 가는 문 1개(`portals`). 밖으로 나가는 "출구"는 방 이동 UI가 아니라 HUD의 나가기가 담당(기존 동작 유지).
- ★ 간판 글씨(예: "용서점 · 2018~"), ★ 실제 가게에서 꼭 넣고 싶은 소품(책 종류, 간판, 가구 색감, 조명 색)
- 정원(임시): 8

### 4.2 공간 ② 작은 모임방 (`id: 'circle'`)
- 크기(임시): 4.2 × 4.2m(정사각에 가깝게), 천장 2.7m.
- **동그란 테이블**(지름 1.2~1.4m) 하나를 방 중앙에 놓고 **5개 의자**를 72° 간격으로 원형 배치(`seats` 5개, 각 의자는 테이블 중심을 향함 — `ry = atan2(cx - x, cz - z)`). 가운데 약간의 소품(찻잔·책·작은 화병). 새 가구 종류이므로 `SpaceLayout`에 `roundTable: {x,z,r,h} | null`을 추가하고 `buildRoundTable()`(상판 베벨 원판 + 가운데 기둥/세 다리, 원목 텍스처, `bevel` 테두리)을 `furniture.ts`에 새로 만든다. 콜라이더는 원을 감싸는 정사각 상자 + 의자별 상자(`seats: [id]`).
- 의자 5개는 기존 `buildChairAt`을 재사용하거나 둥근 등받이 변형을 만든다(전부 같은 의자 + `rng`로 미세한 각도 차이).
- 벽: 한쪽에 작은 책장, 한쪽에 칠판/액자, 천장 중앙에 펜던트 조명(`pendants`)으로 둥근 분위기.
- 포털: 용서점으로 돌아가는 문 1개.
- 정원: 6(5명이 앉고 1명 여유)  ★확인

### 4.3 공통
- 두 방 모두 허브처럼 **창밖 풍경(비·가로수)** 은 선택. 처음엔 창 없이 벽·조명 중심으로 시작해도 된다.
- 입구 표기(문 위 이름판): "용서점", "모임방" (`portals.ts`가 라벨 캔버스를 만든다).
- 시작 화면 문구, HUD 방 이름(`roomLabel()`)을 새 이름으로.
- 스폰 위치는 입구 문 앞(`spawn`, `spawns`).

---

## 5. 실행 계획 (단계마다: 구현 → typecheck+build → 캡처 확인 → PROGRESS.md 갱신 → 커밋)

1. **정리·골격**: 새 저장소 세팅, 공간을 `shop`/`circle` 2개로 줄이고(나머지 레이아웃·빌더·UI 참조 제거) 빈 방 두 개가 문으로 이어지게 한다. 이름·키·문구 교체. 빌드 통과 + 스크린샷.
2. **모임방 완성**: 둥근 테이블 + 의자 5 + 조명·소품. 5명이 앉는 것 e2e(좌석 클릭 → 앉기 5개 모두).
3. **용서점 완성**: 책장·매대·계산대·읽는 자리·간판. 책장은 시드 랜덤 책등으로 풍성하게.
4. **연결·생활감**: 문 이동 흐름, 정원/만석 안내, 조명 분위기, BGM·소리 버튼 안내(기본 꺼짐, 입장 후 버튼 깜빡임 — 이미 구현됨), 모바일 점검.
5. **마무리**: README(남은 이슈·가정한 것), `docs/screens/REVIEW.md`, e2e, 배포 확인.

각 단계 완료 시 운영자에게 스크린샷과 함께 짧게 보고한다(한국어, 확인한 것/못 한 것 구분).

---

## 6. 이미 겪은 함정 (같은 실수 반복 금지)

1. **좌석을 클릭으로 앉게 하려면** 좌석마다 개별 히트 박스가 필요하다. 한 큰 상자에 좌석 id를 몰아넣으면 클릭 지점에서 가장 가까운 좌석으로 앉아 엉뚱한 자리가 된다. 큰 상자는 낮게(걷기 통과용), 좌석 상자는 방석/의자 상단 높이까지만 만들면 뒷줄이 가려지지 않는다.
2. `seatable` 상자는 길찾기에서 **통과 가능**으로 취급된다(앉으러 걸어 들어가야 하므로). 이 때문에 좌석 상자 위에 서 있을 수 있다 — 의도된 동작.
3. 클릭 우선순위: 포털·보드·스크린·좌석 히트를 일반 가구 충돌보다 우선(`app.ts` `clickAt`의 `pick`). 문 히트 박스(높이 2.1)가 뒤의 의자를 가려 클릭을 가로채는 문제가 있었다 — 1인실은 "카메라가 문을 마주볼 때만 문 클릭"으로 풀었다. 작은 방에서 문과 좌석이 가까우면 같은 문제가 생기니 주의.
4. 카메라는 서가·벽에 가려지기 쉽다. 작은 방은 `follow.fitToSpace()`와 시선 가림 처리를 확인한다(`camera.ts`).
5. 두 구조물이 겹치면(예: ㄱ자 객석 두 날개) 방석·바닥판이 겹쳐 뭉개져 보인다. 배치 후 반드시 위에서 본 캡처로 겹침을 확인.
6. **모바일 키보드**: iOS는 키보드가 올라오면 visualViewport만 줄고 레이아웃이 안 줄어든다. 시트는 `src/ui/sheet.ts`가 visualViewport에 맞춰 배치한다(새 시트도 `Sheet` 클래스를 써라). 입력칸 글자 크기는 16px 이상(미만이면 iOS가 확대).
7. **BGM 자동재생**: 모바일은 사용자가 누른 순간에만 허용. 지금은 기본 꺼짐 + 소리 버튼 안내 방식(`app.ts` `setSoundOn`). 유튜브 임베드는 화면 안 모서리에 투명하게 둬야 모바일에서 안 멈춘다(`bgm.ts`).
8. 애니메이션은 transform-only(정점 변형 없음). 새 동작을 추가해도 이 원칙 유지.
9. 렌더 비용: 가구는 `MergeBucket`으로 합쳐 드로우콜을 줄인다. 새 재질 이름을 `NO_SHADOW`에 넣을지(바닥에 붙는 얇은 것) 결정.
10. `window.__BBOOKS` 훅은 테스트·캡처용이다. 새 기능을 만들면 필요한 훅을 같이 추가하되 운영 동작에 영향 주지 않게.
11. Playwright에서 `process.env`는 `page.evaluate` 안에서 못 읽는다 — 인자로 넘긴다.
12. 타입스크립트 `noUnusedLocals`가 켜져 있어 안 쓰는 import·필드가 빌드를 막는다(TS6133).

---

## 7. 운영자에게서 받아야 할 것 (없으면 ★ 가정으로 진행하고 README에 기록)
- 용서점 사진/스케치 → `docs/reference/` (책장 배치, 색감, 간판, 조명)
- 간판·입구 문구 (예: "용서점 · 역곡동 · 2018")
- 정원 숫자(용서점·모임방)
- 포스트잇 방명록 유지 여부, "지금 읽는 책"(카카오 검색) 유지 여부, 고양이 유지 여부
- 매니저(대표) 입장 코드·닉네임
- BGM 유튜브 링크, 커스텀 도메인
- 접속자 표시(Supabase) 사용 여부 — 안 쓰면 `presence=local` 전용으로 단순화 가능(혼자 쓰는 작업실이면 이쪽도 OK)

---

## 8. 완료 기준 (SPEC 7장 체크리스트 요약 + 이 프로젝트)
- [ ] 공간 2개, 문으로 왕복 가능, 정원·만석 안내 동작
- [ ] 모임방: 둥근 테이블 + 5석 모두 클릭해서 앉기, 서로 마주 보는 방향
- [ ] 용서점: 책장·계산대·읽는 자리·간판, 박스처럼 보이지 않음(베벨·재질 변화·책등 랜덤)
- [ ] 모바일(폭 420px)에서 시작→입장→앉기→책 고르기→소리 켜기가 끊김 없이 동작
- [ ] 콘솔 에러 0, `npm run typecheck && npm run build` 통과
- [ ] 비북스 상표·URL·코드값·포스터가 남아있지 않음 (`grep -ri "bbooks\|비북스\|서귤\|독서포인트\|sudden\|써든리"`)
- [ ] 스크린샷 REVIEW.md, README(남은 이슈·가정), PROGRESS.md 갱신
- [ ] main 푸시 + Pages Actions 성공
