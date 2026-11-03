// 자동 닉네임: 동네(동) + 세계문학 고전 등장인물. 예: "망원동 안나"
// 동네는 IP로 지역만 살짝 참고하고, 경인 전체에서 넓게 고른다.

/** 서울 */
const SEOUL_DONGS = [
  '망원동', '합정동', '연남동', '성수동', '삼청동', '혜화동', '서교동', '상수동',
  '한남동', '이태원동', '성북동', '정릉동', '잠실동', '역삼동', '문래동', '당산동',
  '연희동', '불광동', '길동', '면목동', '상도동', '흑석동', '봉천동', '신림동',
  '사당동', '방배동', '반포동', '압구정동', '청담동', '대치동', '개포동', '수유동',
];

/** 부천(비북스 동네) */
const BUCHEON_DONGS = [
  '원미동', '심곡동', '중동', '상동', '소사동', '역곡동', '괴안동', '춘의동',
  '도당동', '여월동', '작동', '송내동', '옥길동', '대장동', '범박동', '옥산동',
];

/** 인천 */
const INCHEON_DONGS = [
  '송도동', '연수동', '부평동', '주안동', '동춘동', '청라동', '검단동', '구월동',
  '만수동', '간석동', '용현동', '학익동', '숭의동', '도화동', '석남동', '가좌동',
];

/** 경기(부천 외) */
const GYEONGGI_DONGS = [
  '정자동', '수내동', '서현동', '야탑동', '백현동', '판교동', '마두동', '장항동',
  '백석동', '화정동', '행신동', '금촌동', '산본동', '비산동', '평촌동', '호계동',
  '인계동', '매탄동', '영통동', '망포동', '병점동', '반송동', '교문동', '다산동',
  '별내동', '호평동', '진접읍', '풍무동', '장기동', '운정동',
];

const ALL_GYEONGIN = [...SEOUL_DONGS, ...BUCHEON_DONGS, ...INCHEON_DONGS, ...GYEONGGI_DONGS];

type RegionId = 'seoul' | 'bucheon' | 'incheon' | 'gyeonggi' | 'all';

const REGION_POOL: Record<RegionId, readonly string[]> = {
  seoul: SEOUL_DONGS,
  bucheon: BUCHEON_DONGS,
  incheon: INCHEON_DONGS,
  gyeonggi: GYEONGGI_DONGS,
  all: ALL_GYEONGIN,
};

/** 세계문학 고전 등장인물 + 한 줄 소개 */
const LITERARY = [
  { name: '안나', blurb: '톨스토이 『안나 카레니나』의 열정적인 여주인공' },
  { name: '나타샤', blurb: '『전쟁과 평화』의 생기 넘치는 나타샤 로스토바' },
  { name: '피에르', blurb: '『전쟁과 평화』의 사색가 피에르 베주호프' },
  { name: '이반', blurb: '도스토옙스키 『카라마조프가의 형제들』의 이반' },
  { name: '레빈', blurb: '『안나 카레니나』의 성실한 지주 레빈' },
  { name: '키티', blurb: '『안나 카레니나』의 맑고 따뜻한 키티' },
  { name: '햄릿', blurb: '셰익스피어 비극의 망설이는 덴마크 왕자' },
  { name: '오필리아', blurb: '『햄릿』의 가련하고 순수한 오필리아' },
  { name: '로미오', blurb: '『로미오와 줄리엣』의 열렬한 연인' },
  { name: '줄리엣', blurb: '『로미오와 줄리엣』의 대담한 여주인공' },
  { name: '맥베스', blurb: '야심에 사로잡힌 셰익스피어의 비극적 영웅' },
  { name: '제인', blurb: '브론테 『제인 에어』의 자주적인 가정교사' },
  { name: '로체스터', blurb: '『제인 에어』의 그늘진 매력의 에드워드 로체스터' },
  { name: '히스클리프', blurb: '『폭풍의 언덕』의 격정적인 히스클리프' },
  { name: '캐시', blurb: '『폭풍의 언덕』의 자유로운 캐서린 언쇼' },
  { name: '셜록', blurb: '코난 도일의 명탐정 셜록 홈즈' },
  { name: '왓슨', blurb: '홈즈의 벗이자 기록자 존 왓슨' },
  { name: '도리안', blurb: '와일드 『도리안 그레이의 초상』의 미소년' },
  { name: '고리오', blurb: '발자크 『고리오 영감』의 헌신적인 아버지' },
  { name: '에마', blurb: '플로베르 『보바리 부인』의 꿈꾸는 에마' },
  { name: '팡틴', blurb: '『레 미제라블』의 가녀린 어머니 팡틴' },
  { name: '코제트', blurb: '『레 미제라블』의 코제트' },
  { name: '마리우스', blurb: '『레 미제라블』의 이상주의자 마리우스' },
  { name: '퀴지모도', blurb: '『노트르담의 꼽추』의 종지기 퀴지모도' },
  { name: '에스메랄다', blurb: '『노트르담의 꼽추』의 집시 무희 에스메랄다' },
  { name: '앤', blurb: '『빨간 머리 앤』의 상상력 넘치는 앤 셜리' },
  { name: '도로시', blurb: '『오즈의 마법사』의 용감한 도로시' },
  { name: '알리체', blurb: '캐럴 『이상한 나라의 앨리스』의 호기심 많은 소녀' },
  { name: '개츠비', blurb: '피츠제럴드 『위대한 개츠비』의 꿈을 쫓는 남자' },
  { name: '데이지', blurb: '『위대한 개츠비』의 매혹적인 데이지 뷰캐넌' },
  { name: '허크', blurb: '트웨인 『허클베리 핀의 모험』의 자유로운 소년' },
  { name: '톰', blurb: '트웨인 『톰 소여의 모험』의 장난꾸러기 톰' },
  { name: '아합', blurb: '멜빌 『모비 딕』의 집념의 선장 아합' },
  { name: '이스마엘', blurb: '『모비 딕』의 이야기꾼 이스마엘' },
  { name: '빅터', blurb: '셸리 『프랑켄슈타인』의 과학자 빅터' },
  { name: '에드몬', blurb: '뒤마 『몽테크리스토 백작』의 에드몽 당테스' },
  { name: '돈키호테', blurb: '세르반테스의 이상에 빠진 기사 돈키호테' },
  { name: '산초', blurb: '돈키호테를 따르는 현실적인 산초 판사' },
  { name: '파우스트', blurb: '괴테 『파우스트』의 지식을 갈망하는 학자' },
  { name: '오디세우스', blurb: '호메로스 서사시의 지혜로운 여행자' },
  { name: '페넬로페', blurb: '『오디세이아』의 충실한 페넬로페' },
  { name: '신드바드', blurb: '『천일야화』의 모험가 선원 신드바드' },
  { name: '알라딘', blurb: '『천일야화』의 요술램프 소년 알라딘' },
] as const;

const LITERARY_BY_LEN = [...LITERARY].sort((a, b) => b.name.length - a.name.length);

const REGION_CACHE_KEY = 'bbooks.hometownRegion';

function pick<T>(list: readonly T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length) % list.length]!;
}

export function randomGyeonginDong(rand: () => number = Math.random): string {
  return pick(ALL_GYEONGIN, rand);
}

function peekRegion(): RegionId | null {
  try {
    const v = sessionStorage.getItem(REGION_CACHE_KEY);
    if (v === 'seoul' || v === 'bucheon' || v === 'incheon' || v === 'gyeonggi' || v === 'all') return v;
    return null;
  } catch {
    return null;
  }
}

function rememberRegion(id: RegionId): void {
  try {
    sessionStorage.setItem(REGION_CACHE_KEY, id);
  } catch {
    /* ignore */
  }
}

/** @deprecated 예전 단일 동 캐시. 호환용으로만 둔다. */
export function peekHometownDong(): string | null {
  return null;
}

/** 도시·지역 → 지역 id. */
export function regionForPlace(city: string, region: string): RegionId {
  const c = `${city} ${region}`.toLowerCase();
  if (/bucheon|부천/.test(c)) return 'bucheon';
  if (/seoul|서울/.test(c)) return 'seoul';
  if (/incheon|인천/.test(c)) return 'incheon';
  if (
    /gyeonggi|경기|suwon|수원|seongnam|성남|goyang|고양|yongin|용인|anyang|안양|uijeongbu|의정부|namyangju|남양주|hwaseong|화성|gwangmyeong|광명|hanam|하남|gimpo|김포|paju|파주|siheung|시흥|gunpo|군포|uiwang|의왕|guri|구리/.test(c)
    || /수원|성남|고양|용인|안양|의정부|남양주|화성|광명|하남|김포|파주|시흥|군포|의왕|구리|과천|동두천|양주|포천|여주|이천|안성|평택|오산|광주/.test(city + region)
  ) {
    return 'gyeonggi';
  }
  return 'all';
}

/** @deprecated dongPoolForPlace → regionForPlace */
export function dongPoolForPlace(city: string, region: string): readonly string[] {
  return REGION_POOL[regionForPlace(city, region)];
}

/**
 * IP를 참고하되 경인 전체에서 넓게 동네를 고른다.
 * 지역 풀을 2번 섞어 살짝 가중만 주고, 대부분은 전체에서 뽑는다.
 */
export function pickWideDong(rand: () => number = Math.random, region: RegionId | null = peekRegion()): string {
  const local = region && region !== 'all' ? REGION_POOL[region] : null;
  if (!local) return pick(ALL_GYEONGIN, rand);
  // ~1/3 확률로 접속 지역, 나머지는 경인 전체
  if (rand() < 0.34) return pick(local, rand);
  return pick(ALL_GYEONGIN, rand);
}

async function fetchIpPlace(): Promise<{ city: string; region: string } | null> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch('https://ipwho.is/', { signal: ctrl.signal });
    if (!res.ok) return null;
    const j = (await res.json()) as { success?: boolean; city?: string; region?: string; country_code?: string };
    if (!j?.success || j.country_code !== 'KR') return null;
    return { city: String(j.city ?? ''), region: String(j.region ?? '') };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let warming: Promise<RegionId> | null = null;

/**
 * IP로 지역만 캐시한다. 동네 문자열은 매번 넓게 다시 고른다.
 */
export function warmHometownDong(rand: () => number = Math.random): Promise<string> {
  const cached = peekRegion();
  if (cached) return Promise.resolve(pickWideDong(rand, cached));
  if (warming) {
    return warming.then((r) => pickWideDong(rand, r));
  }
  warming = (async () => {
    const place = await fetchIpPlace();
    const id = place ? regionForPlace(place.city, place.region) : 'all';
    rememberRegion(id);
    return id;
  })();
  return warming.then((r) => pickWideDong(rand, r));
}

export function pickLiterary(rand: () => number = Math.random): { name: string; blurb: string } {
  const c = pick(LITERARY, rand);
  return { name: c.name, blurb: c.blurb };
}

/** 닉네임에서 등장인물 한 줄 소개. */
export function characterBlurb(nickname: string): string {
  const nick = nickname.trim();
  for (const c of LITERARY_BY_LEN) {
    if (nick === c.name || nick.endsWith(` ${c.name}`)) return c.blurb;
  }
  return '세계문학 속 등장인물이에요.';
}

/** 닉네임 하나 뽑기. 동네는 IP 지역을 살짝 참고해 넓게 랜덤. */
export function randomNickname(rand: () => number = Math.random, dong?: string): string {
  const place = (dong ?? pickWideDong(rand)).trim();
  const who = pickLiterary(rand).name;
  return `${place} ${who}`;
}
