// 읽은 시간 기록(이 브라우저에만): 누적 시간, 오늘 읽은 시간(날짜가 바뀌면 0부터).

const KEY = 'bbooks.reading';

interface ReadingStats { totalSec: number; todaySec: number; date: string }

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export function loadReading(): ReadingStats {
  let s: ReadingStats = { totalSec: 0, todaySec: 0, date: today() };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) s = { ...s, ...JSON.parse(raw) };
  } catch {
    /* 기본값 */
  }
  if (s.date !== today()) s = { ...s, todaySec: 0, date: today() };
  return s;
}

export function addReading(sec: number): ReadingStats {
  const s = loadReading();
  s.totalSec += sec;
  s.todaySec += sec;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 저장 못 해도 진행 */
  }
  return s;
}

export function formatClock(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export function formatMinutes(sec: number): string {
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}분`;
  return `${Math.floor(m / 60)}시간 ${m % 60}분`;
}
