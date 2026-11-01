# 인계 문서 — 클라우드 세션 → Claude Code 데스크톱

마지막 갱신: 2026-11-01 (세션 2 종료 시점)
새 세션의 Claude는 이 문서를 먼저 읽고, 다음 순서로 읽는다: `CLAUDE.md` → `SPEC-v3.md`(맨 위 v3.1 변경 포함) → `PROGRESS.md` → `docs/screens/REVIEW.md`

---

## 1. 지금 상태 한눈에

| 항목 | 상태 |
|---|---|
| 저장소 | https://github.com/yonghee0330/readplace_v2 |
| `main` 브랜치 | 단계 1~5 + 읽기 모드. PR #1(세션 2)·PR #2(GitHub Pages 자동 배포) **병합 완료** |
| 배포 | https://yonghee0330.github.io/readplace_v2/ — `main`에 올라가면 자동 재배포 |
| `session-3-finish` 브랜치 | 세션 3(단계 6 마무리·7·8) 작업 브랜치 |
| 통과한 단계 | 1, 2, 3, 4, 5 (단계 6은 e2e 하나만 남음) |
| 남은 단계 | 6 마무리, 7(소리·PWA·접근성·성능), 8(e2e 전체·최종 캡처·README 완성) |
| 마지막 검증 | `npm run typecheck`·`npm run build` 통과, `npm run test:e2e` 2개 통과(Local·ws), `npm run capture` 콘솔 에러 0 |

### 운영자가 정한 것(바꾸지 말 것)
- **실제 책 본문은 다루지 않는다**(SPEC v3.1). 9장 책 데이터·page-flip·페이지 분할은 없음. 읽기 모드 = 각자 자기 책을 읽는 집중 독서 화면(함께 읽는 중 N명, 독서 타이머, 오늘 읽은 시간).
- **기본 구조와 경험은 산사(sansatemple.com)와 같게**: 시작 화면 → 로딩 → 공간 + 아바타 → 상단 HUD → 하단 액션 3개 → 방 전체 알림 → 집중 모드. 코드·에셋·문구 복사는 금지.
- 실내 그림자 광원은 PointLight 대신 SpotLight.
- 작업은 브랜치 + 초안 PR로 올린다.

---

## 2. 데스크톱에서 처음 한 번 준비

Mac 기준(폴더는 `~/Documents` 아래). Windows는 아래 "환경 차이" 참고.

1) 저장소 받기
```bash
cd ~/Documents && git clone https://github.com/yonghee0330/readplace_v2.git
```

2) `main`을 최신으로 받는다(PR #1·#2는 이미 병합됨):
```bash
cd ~/Documents/readplace_v2 && git checkout main && git pull
```

3) 패키지 설치(Node 20 이상, 클라우드에서는 Node 22로 확인)
```bash
npm install
```

4) Playwright용 크로미움 설치(클라우드에는 미리 깔려 있었지만 내 컴퓨터에는 따로 필요)
```bash
npx playwright install chromium
```

5) 실행 확인
```bash
npm run dev
```
브라우저에서 `http://localhost:5173` → "들어가기". 탭 2개를 열면 서로의 아바타가 보이면 정상.

6) Claude Code 데스크톱에서 `~/Documents/readplace_v2` 폴더를 열고, 아래 "세션 3 시작 프롬프트"를 붙여넣는다.

---

## 3. 세션 3 시작 프롬프트 (복사해서 붙여넣기)

```
HANDOFF.md, CLAUDE.md, SPEC-v3.md(맨 위 v3.1 변경 포함), PROGRESS.md를 읽고 이어서 진행해.
실제 책 본문은 다루지 않는다(SPEC v3.1). 세션 3 원래 프롬프트의 "책 데이터" 부분은 무시한다.

작업 브랜치: main을 최신으로 받은 뒤 session-3-finish 브랜치를 새로 만들어 진행하고, 끝나면 푸시 후 초안 PR.

단계 6 마무리:
- tests/e2e.spec.ts에 읽기 모드 테스트 추가: 진입(키 3) → 타이머가 오름 → 다른 탭에 "함께 읽는 중 2명" → Esc로 돌아가기 → 상태가 sit/stand로 복귀.

단계 7:
- 서점 소리(SPEC 3-10): Web Audio로 빗소리·실내 공기음·패드(4마디 루프)·눈인사/버튼 효과음 합성, 기본 꺼짐, 토글 시 1.5초 페이드, 첫 클릭 이후에만 AudioContext 시작. 지금 소리 버튼은 상태만 저장하므로 실제 소리로 연결.
- PWA(3-12): manifest, SVG 아이콘 + 192·512 PNG, 서비스워커(빌드에서만 등록).
- 접근성(3-13) 점검: Tab 순회, 포커스 링, Esc, 1/2/3, 모션 줄이기, 캔버스 aria-label.
- 성능: ?debug=1로 메인 패스·프레임 전체 드로우콜과 삼각형을 품질별로 기록.

단계 8:
- npm run test:e2e 전체 통과(콘솔 에러 0)
- npm run capture로 overview / with-visitors / reader(데스크톱·모바일) 다시 찍고, 이미지를 직접 보고 SPEC 7장 1~10 전체 재판정 → REVIEW.md 갱신
- README 완성(14장 항목 전부)

단계마다 typecheck·build → 확인 → PROGRESS.md 갱신 → 커밋.
마지막에 한국어로 짧게: 실행 방법 / SPEC 3장 기능별 완료·부분·미완 표 / 스크린샷 경로 / 남은 이슈.
```

---

## 4. 명령 모음

| 명령 | 하는 일 | 걸리는 시간(참고) |
|---|---|---|
| `npm run dev` | 개발 서버(5173) | 즉시 |
| `npm run typecheck` | 타입 검사 | 수 초 |
| `npm run build` | 빌드(`dist/`) | 수 초 |
| `npm run preview` | 빌드 결과 미리보기(4173) | 즉시 |
| `npm run server` | ws 중계 서버(8787) | 즉시 |
| `npm run capture` | 빌드 + 캡처 6장 → `docs/screens/` | 클라우드 약 12분, 내 컴퓨터는 더 빠를 수 있음 |
| `npm run capture -- overview` | 이름으로 골라 찍기 | |
| `npm run test:e2e` | 빌드·미리보기·서버를 띄우고 e2e | 클라우드 약 6분 |

자주 쓰는 URL 파라미터: `?debug=1`(FPS·드로우콜), `?quality=low|medium|high`, `?cam=overview|window|avatar`, `?autostart=1`, `?npc=0`, `?seat=sofa-2`, `?autoread=1`, `?presence=ws&ws=ws://localhost:8787`, `?seed=86`, `?fx=noao,nobloom`(진단), `?campos=x,y,z&camtgt=x,y,z`(구도 조정)

---

## 5. 코드 지도

| 위치 | 내용 |
|---|---|
| `src/main.ts` | 시작 화면 → 로딩 → `startApp` |
| `src/app.ts` | 전체 조립: 렌더러·장면, 아바타·NPC, 이동·카메라, HUD·설정·시트, presence, 읽기 모드, 디버그 창구 `window.__BBOOKS` |
| `src/scene/` | 서점 장면(절차 모델·텍스처·조명·후처리·창밖). `layout.ts`에 배치·앉을 자리(SEATS)·시작 자리(SPAWNS)·충돌 박스 |
| `src/avatar/` | 아바타 모델(`avatar.ts`), 애니메이션, 이름표, NPC, 여러 아바타 관리(`crowd.ts`, 원격 100ms 보간) |
| `src/controls/` | 3인칭 카메라(`camera.ts`), A* 경로 탐색, 이동·앉기(`movement.ts`), 입력 |
| `src/net/` | `Presence` 인터페이스 + `PeerTracker`, LocalPresence(BroadcastChannel), WsPresence(재연결), 닉네임 |
| `src/reader/` | 읽기 모드 화면(`focus.ts`), 읽은 시간 저장 |
| `src/ui/` | 로딩, HUD, 토스트(기록 `log` 포함), 시트, 설정 |
| `src/audio/` | **비어 있음** — 단계 7에서 `ambience.ts`, `sfx.ts` |
| `public/` | **아이콘·manifest·sw.js 없음** — 단계 7 |
| `server/index.ts` | ws 중계 서버 |
| `scripts/capture.ts` | 캡처 자동화 |
| `tests/e2e.spec.ts` | 탭 2개 동기화(Local·ws) |

---

## 6. 꼭 알아야 할 함정(세션 1·2에서 겪은 것)

1. **법선(normal) 없는 지오메트리를 장면에 넣지 말 것.** AO 법선 패스에서 NaN이 생기고 Bloom이 화면 전체를 검게 번지게 한다. 선·점·직접 만든 BufferGeometry에는 법선을 넣는다.
2. **투명 판(이름표·아이콘·발밑 그림자)은 오버레이 레이어(1)에 둔다.** AO는 레이어 0만 보는 카메라로 계산한다(`postfx.ts`). 반대로 아바타 몸은 레이어 0에 둔다. AO에서 빼면 뒤 가구의 AO 자국이 얼굴에 찍힌다.
3. **헤드리스 렌더링은 아주 느리다**(SwiftShader, 한 프레임 수 초). 캡처·테스트는 준비 완료(`__BBOOKS_READY`) 뒤 `window.__BBOOKS_LOOP.stop()`으로 루프를 멈추고 찍는다. 짧게 떴다 사라지는 토스트는 `__BBOOKS.toasts()` 기록으로 확인한다.
4. **드로우콜 예산은 메인 장면 패스 기준**(`__BBOOKS_STATS.mainCalls`, 현재 75~78)으로 보고, 프레임 전체(`calls`, 현재 163~168)도 함께 적는다.
5. three r187에는 `PCFSoftShadowMap`이 없다 → `PCFShadowMap` + `shadow.radius`.
6. 그림자는 `shadowMap.autoUpdate=false`. 정적 장면이 바뀌면 `renderer.shadowMap.needsUpdate = true`.
7. ws 서버가 꺼져 있으면 브라우저가 연결 실패를 콘솔에 직접 찍는다(코드로 막을 수 없음, README 알려진 한계에 기록). e2e는 서버를 띄운 상태라 0개.
8. 같은 브라우저 탭끼리는 저장된 닉네임이 같으므로, id가 큰 쪽 탭이 그 탭에서만 닉네임을 다시 뽑는다(`app.ts` `syncPeers`).

---

## 7. 환경 차이(Mac / Windows / 클라우드)

- **Mac(Mac Mini·MacBook)**: 위 순서 그대로. 실제 GPU가 있어 `npm run dev`는 부드럽게 돈다. 캡처·테스트는 `playwright.config.ts`·`scripts/capture.ts`가 SwiftShader(소프트웨어 렌더링)를 강제하므로 클라우드와 비슷하게 느릴 수 있다. 결과를 클라우드 캡처와 같은 조건으로 비교하려면 그대로 둔다.
- **Windows**: 명령은 같다. PowerShell에서 `cd ~/Documents` 대신 `cd $HOME\Documents`. 포트를 비울 때 `fuser`는 없으니 작업 관리자나 `npx kill-port 4173`을 쓴다.
- **iPhone**: 같은 와이파이에서 `npm run dev -- --host`로 띄운 뒤 `http://<Mac IP>:5173`으로 확인. 탭 2개 함께 있기는 같은 브라우저 안에서만 되므로, 기기끼리 보려면 `npm run server` + `?presence=ws&ws=ws://<Mac IP>:8787`.
- 클라우드 세션에서 막혀 있던 사이트(위키문헌 등)는 이제 필요 없다(책 본문 없음).

---

## 8. 열려 있는 것

- PR #1(세션 2)·PR #2(GitHub Pages 자동 배포): `main`에 병합 완료. https://yonghee0330.github.io/readplace_v2/ 에 배포됨
- 세션 3 작업은 `session-3-finish` 브랜치 → 초안 PR
- 클라우드 세션에 걸어 둔 PR 점검 예약 1건(2026-11-01 13:40 UTC)은 변화가 없으면 아무것도 하지 않는다. 데스크톱 작업과 충돌하지 않는다.
