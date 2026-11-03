// 자동 닉네임: 동네(동) + 세계문학 고전 등장인물. 예: "망원동 안나"
// 동네는 접속 IP로 대략 추정하고, 실패하면 경인 지역 동 중에서 고른다.

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

/** 세계문학 고전 등장인물(짧게, 이름만) */
const LITERARY_NAMES = [
  '안나', '나타샤', '피에르', '이반', '레빈', '키티',
  '햄릿', '오필리아', '로미오', '줄리엣', '맥베스',
  '제인', '로체스터', '히스클리프', '캐시',
  '셜록', '왓슨', '도리안',
  '고리오', '에마', '팡틴', '코제트', '마리우스',
  '퀴지모도', '에스메랄다',
  '앤', '도로시', '알리체',
  '개츠비', '데이지',
  '허크', '톰',
  '아합', '이스마엘',
  '빅터', '에드몬',
  '돈키호테', '산초',
  '파우스트', '오디세우스', '페넬로페',
  '신드바드', '알라딘',
];

const DONG_CACHE_KEY = 'bbooks.hometownDong';

function pick<T>(list: readonly T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length) % list.length]!;
}

export function randomGyeonginDong(rand: () => number = Math.random): string {
  return pick(ALL_GYEONGIN, rand);
}

/** 이미 알아 둔 동네(동기). 없으면 null. */
export function peekHometownDong(): string | null {
  try {
    const v = sessionStorage.getItem(DONG_CACHE_KEY);
    return v && v.length >= 2 && v.length <= 12 ? v : null;
  } catch {
    return null;
  }
}

function rememberDong(dong: string): void {
  try {
    sessionStorage.setItem(DONG_CACHE_KEY, dong);
  } catch {
    /* ignore */
  }
}

/** 도시·지역 문자열을 경인 동 풀로 매핑. */
export function dongPoolForPlace(city: string, region: string): readonly string[] {
  const c = `${city} ${region}`.toLowerCase();
  if (/bucheon|부천/.test(c)) return BUCHEON_DONGS;
  if (/seoul|서울/.test(c)) return SEOUL_DONGS;
  if (/incheon|인천/.test(c)) return INCHEON_DONGS;
  if (
    /gyeonggi|경기|suwon|수원|seongnam|성남|goyang|고양|yongin|용인|anyang|안양|uijeongbu|의정부|namyangju|남양주|hwaseong|화성|gwangmyeong|광명|hanam|하남|gimpo|김포|paju|파주|siheung|시흥|gunpo|군포|uiwang|의왕|guri|구리/.test(c)
    || /수원|성남|고양|용인|안양|의정부|남양주|화성|광명|하남|김포|파주|시흥|군포|의왕|구리|과천|동두천|양주|포천|여주|이천|안성|평택|오산|광주/.test(city + region)
  ) {
    return GYEONGGI_DONGS;
  }
  return ALL_GYEONGIN;
}

async function fetchIpPlace(): Promise<{ city: string; region: string } | null> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 2500);
  try {
    // ipwho.is — CORS·HTTPS, 키 없음
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

let warming: Promise<string> | null = null;

/**
 * IP로 동네를 추정해 캐시한다. 실패하면 경인 동 랜덤.
 * 앱 시작 때 한 번 불러 두면 「다시 뽑기」에 반영된다.
 */
export function warmHometownDong(rand: () => number = Math.random): Promise<string> {
  const cached = peekHometownDong();
  if (cached) return Promise.resolve(cached);
  if (warming) return warming;
  warming = (async () => {
    const place = await fetchIpPlace();
    const pool = place ? dongPoolForPlace(place.city, place.region) : ALL_GYEONGIN;
    const dong = pick(pool, rand);
    rememberDong(dong);
    return dong;
  })();
  return warming;
}

/** 닉네임 하나 뽑기. dong을 주면 그걸 쓰고, 없으면 캐시→경인 랜덤. */
export function randomNickname(rand: () => number = Math.random, dong?: string): string {
  const place = (dong ?? peekHometownDong() ?? randomGyeonginDong(rand)).trim();
  const who = pick(LITERARY_NAMES, rand);
  return `${place} ${who}`;
}
