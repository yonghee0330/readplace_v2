# 세션 1 계획 (승인 대기)

기준: SPEC-v3.md / CLAUDE.md. three.js 0.187.0(현재 npm 최신)을 고정할 예정.

---

## 1. 파일 계획 (SPEC 12장)

| 경로 | 역할 | 만드는 단계 |
|---|---|---|
| `index.html` | 캔버스, UI 루트, 로딩 화면 마크업, 시작 화면 | 1 |
| `vite.config.ts` | 빌드 설정, `three` 청크 분리 | 1 |
| `package.json` | 스크립트: dev / build / preview / typecheck / capture / server / test:e2e | 1 |
| `tsconfig.json` | strict 모드 | 1 |
| `playwright.config.ts` | 크로미움 + swiftshader 인자, 데스크톱·모바일 프로젝트 | 2(캡처) / 8 |
| `src/main.ts` | 부팅 순서: 파라미터 → 품질 → 로딩 → 장면 생성(단계별 진행률) → 루프 → `__BBOOKS_READY` | 1 |
| `src/core/rng.ts` | `mulberry32`, `rng.range / pick / chance / gauss`, 하위 시드 파생(`fork('books')`) | 1 |
| `src/core/params.ts` | URL 파라미터 파싱: seed, quality, cam, debug, npc, room, instance, presence, ws, autoread | 1 |
| `src/core/quality.ts` | 낮음/보통/높음 표(SPEC 3-14), 기기 자동 판별(GPU 문자열·코어 수·화면 폭) | 1 |
| `src/core/loop.ts` | rAF 루프, dt 클램프, 업데이트 콜백 등록, `?debug=1` FPS·드로우콜·삼각형 표시 | 1 |
| `src/scene/bookstore.ts` | 장면 조립 진입점. 단계별 `await progress(...)` | 1(빈 방) / 2 |
| `src/scene/layout.ts` | 방 치수, 소품 배치 좌표, 콜라이더 박스 목록, `seat` 앵커 데이터 | 2 |
| `src/scene/textures.ts` | Canvas 절차 텍스처(나뭇결 3종, 마루, 회벽, 징두리, 패브릭, 러그, 종이, 하늘) | 2 |
| `src/scene/lighting.ts` | 키라이트·실내 전구·반구광·창빛 패치, 그림자 1회 갱신 | 2 |
| `src/scene/postfx.ts` | EffectComposer → RenderPass → GTAO/SAO → Bloom → OutputPass, 품질별 on/off | 2 |
| `src/scene/exterior.ts` | 창밖 하늘·건물 실루엣 3겹·가로등·나무, 비 파티클 | 2 |
| `src/scene/geom.ts` | 공용 지오메트리 헬퍼(베벨 판재, 테이퍼 다리, 잎 곡면, 병합 버킷) | 2 |
| `src/scene/props/*.ts` | shelf, bookInstances, island, readingTable, chair, sofa, floorLamp, pendant, counter, windowFrame, plant, rug, wallDecor | 2 |
| `src/scene/loadOrFallback.ts` | `assets/models/{name}.glb` 있으면 GLTF, 없으면 절차 모델 | 2 |
| `src/avatar/*` | avatar, animations, nameplate, npc | 3 |
| `src/controls/*` | camera, movement, pathfinding, input | 3 |
| `src/ui/*` | loading(1), hud, toast, settings, sheet | 1 / 4 |
| `src/net/*` | presence 인터페이스, local, ws, nickname | 5 |
| `src/reader/*` | reader, paginate, pageflip, storage, catalog, bookOpenFx | 6 |
| `src/audio/*` | ambience, sfx | 7 |
| `public/*` | books, manifest, icons, sw.js | 6 / 7 |
| `server/index.ts` | ws 중계 서버 | 5 |
| `scripts/capture.ts` | 미리보기 서버 띄우고 캡처 6장 | 2(overview) / 8(전체) |
| `tests/e2e.spec.ts` | 흐름 + 콘솔 에러 0 | 5 / 8 |

---

## 2. 단계 2 소품별 모델링 방법

공통 원칙
- 판재는 `RoundedBoxGeometry`(three/examples) 또는 자체 `bevelBox(w,h,d,r,seg)`. 베벨 반지름 단위는 m.
- 같은 재질끼리 `mergeGeometries`로 병합 → 재질 하나당 드로우콜 1.
- 시드 난수로 위치 ±1~2cm, 회전 ±1~3°, 색조 ±5% 변화(정점 색 사용).
- 텍스처는 최대 1024px, 반복은 UV 스케일로.

| 소품 | 지오메트리 | 텍스처·재질 | 베벨 | 비고 |
|---|---|---|---|---|
| 방 바닥 | 평면 8×6m | 마루(널 폭 12cm, 널마다 색조 ±5%, 이음매 선) + 거칠기 맵 | – | 바닥 가장자리 걸레받이(베벨 박스) |
| 벽 | 평면 + 창·문 구멍(Shape + 구멍 → ShapeGeometry) | 회벽 미세 노이즈 | – | 아래 1m 징두리 판: 세로 판재 띠 + 상단 몰딩 |
| 천장 | 평면 + 보 3개 | 회벽 / 짙은 월넛 | 보 1cm | 펜던트 매다는 위치 |
| 벽 서가 ×5 | 측판 2 + 선반 6(바닥 포함) + 상판 + 받침 + 뒤판, 판재 두께 2cm | 중간 갈색 나뭇결 / 뒤판은 짙은 월넛 | 0.4cm | 폭 0.9~1.2m, 높이 2.1m, 선반 5단 |
| 책 400~700권 | 책 1권 = 표지 박스(베벨 0.2cm) + 안쪽 페이지 블록(살짝 들어감). 그룹 2개 → InstancedMesh 1개, 재질 2개 | 표지: 인스턴스 색(12색 팔레트) + 책등 띠 텍스처(밝은 선 2줄), 페이지: 종이색 | 0.2cm | 높이 18~26cm, 두께 1~4cm, 선반마다 빈틈 1~3곳, 기울어진 책 5~10%, 끝에 북엔드(L자 금속판) |
| 아일랜드 평대 | 상판 + 받침 박스 + 굽 | 꿀색 나뭇결 | 1cm | 눕힌 책 더미 3~4개, 세운 추천 책 + 작은 받침대 |
| 독서 테이블 | 상판(베벨 1.2cm) + 테이퍼 다리 4개(위 4cm → 아래 2.5cm, CylinderGeometry 4면) + 에이프런 | 꿀색 | 1.2cm | 창가 |
| 의자 ×2 | 좌판 + 테이퍼 다리 4 + 뒷다리 연장 + 등받이 살 5개 + 등받이 상단 | 꿀색 | 0.5cm | `seat` 앵커 2개 |
| 소파 | 받침 + 등받이 + 팔걸이 2 + 좌석 쿠션 3 + 등 쿠션 3(RoundedBox seg 4) + 짧은 다리 4 | 패브릭(짜임 패턴), 짙은 녹색 계열 | 쿠션 5cm, 프레임 3cm | 담요: 세분된 평면을 사인 변형해 쿠션 위에 걸침. `seat` 3개 |
| 스탠드 조명 ×2 | 받침 원판 + 기둥 실린더 + 갓(열린 원뿔, DoubleSide) | 금속(어두운 황동) / 갓 반투명 + emissive | – | 아래 PointLight(그림자 없음) |
| 펜던트 ×3 | 전선 실린더 + 소켓 + 금속 갓(LatheGeometry) + 전구 구 | 전구 emissive 강하게(Bloom 대상) | – | PointLight 1개는 그림자 담당 → 비용 때문에 SpotLight(아래 방향)로 대체 예정 |
| 계산대 | 카운터 몸통(세로 판재 띠) + 상판(베벨) | 짙은 월넛 + 꿀색 상판 | 1cm | 작은 화분, 종이봉투(구겨진 윗단: 정점 노이즈), 영수증 꽂이(가는 실린더 + 종이 평면) |
| 창틀 ×2 | 바깥 틀 + 격자 창살(가로 1·세로 2) + 창턱 | 꿀색 + 페인트 크림색 | 0.5cm | 창턱에 화분·책 2~3권 |
| 출입문 | 문틀 + 문짝(패널 모양 홈) + 손잡이 | 짙은 월넛 | 0.5cm | 유리창 상단 |
| 화분 ×4 | 화분: LatheGeometry(테두리 말림) / 잎: 곡면 판 12~20장(평면을 휘고 접은 지오메트리, 시드로 회전) | 테라코타 + 잎 초록 2톤(정점 색) | – | 잎 DoubleSide |
| 러그 | 얇은 RoundedBox | 러그 텍스처(테두리 무늬 + 바탕 짜임) | 0.5cm | 소파 앞 |
| 벽 장식 | 액자 2(틀 + 캔버스 추상 그림, 절차 생성) + 안내판 "비북스"(나무판 + 캔버스 손글씨 느낌 글자) | – | 0.5cm | 손글씨는 시스템 손글씨 서체 없이 Noto Serif KR + 획 떨림 효과로 그림 |
| 창밖 | 하늘 그라디언트 평면, 건물 실루엣 3겹(뒤로 갈수록 옅게, 창 불빛 점), 가로등, 나무 실루엣 | Canvas 텍스처 | – | 높음 품질만 빗방울 셰이더 |
| 창빛 패치 | 바닥 위 1mm 평면, 창 격자 모양 알파 텍스처, 가산 혼합 | – | – | 키라이트 방향으로 비스듬히 늘림 |

---

## 3. 성능 예산 추정 (높음 품질, 단계 2 기준)

| 그룹 | 드로우콜 | 삼각형 |
|---|---|---|
| 방(바닥·벽·징두리·천장·보·걸레받이) | 7 | 3천 |
| 서가 5개(재질 2개로 병합) | 2 | 1만 |
| 책 InstancedMesh(재질 2) + 북엔드 | 3 | 600권 × 약 140 = 8.4만 |
| 가구(꿀색·월넛·패브릭·러그·금속·도자기·종이 등 재질별 병합) | 약 12 | 6만 |
| 화분 잎 | 1 | 1.5만 |
| 조명 갓·전구(emissive) | 3 | 1만 |
| 창밖 + 유리 + 창빛 패치 | 7 | 1천 |
| 비 파티클 | 1 | 800점 |
| **소계(메인 패스)** | **약 36** | **약 18만** |

- 예산: 드로우콜 150 이하, 삼각형 60만 이하 → 단계 2 기준 여유 충분.
- GTAO는 법선 패스로 장면을 한 번 더 그림(드로우콜 약 2배). 렌더러 info 기준으로는 메인 패스만 셀지, 프레임 전체를 셀지 README에 명시할 예정.
- 그림자: `autoUpdate=false`, 정적 장면이라 시작 시 1회 + 품질 변경 시 갱신.
- **위험 요소 — 아바타(단계 3)**: 아바타 1명이 부위 약 10개라 메시가 많다. NPC 4 + 접속자 6이면 +100 드로우콜. 그래서 아바타 재질을 공유하고 부위를 6~8개로 줄인다(눈·볼은 머리 메시에 병합). 예상 합계: 36 + 10명 × 8 = 약 116.

---

## 4. 확인한 환경 문제 (승인 전에 결정 필요)

1. **작업물 보존**: 이 클라우드 세션에는 GitHub 저장소가 연결되어 있지 않다. 세션이 끝나면 컨테이너와 함께 파일이 사라진다.
2. **책 원문(단계 6)**: 이 환경의 네트워크 정책이 `ko.wikisource.org`, `gongu.copyright.or.kr`를 막고 있다. npm 레지스트리는 열려 있다. 이대로면 단계 6에서 책을 가져올 수 없어 SPEC대로 "샘플 책"만 남는다.
3. 사소한 것: SPEC 0장의 "9장의 완료 기준"은 14장을 가리키는 것으로 해석한다.
