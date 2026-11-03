// 음료 마시기: 물·커피·차. 타이밍은 animations.ts와 공유한다.

export type DrinkKind = 'water' | 'coffee' | 'tea';

export const DRINK_OPTIONS: { id: DrinkKind; label: string; hint: string; color: string }[] = [
  { id: 'water', label: '물 마시기', hint: '컵을 입에 대고 벌컥벌컥', color: '#9ec9e0' },
  { id: 'coffee', label: '커피 마시기', hint: '여유롭게 다섯 모금', color: '#5a3820' },
  { id: 'tea', label: '차 마시기', hint: '천천히 열 모금', color: '#c9b26a' },
];

/** 마시기 모션 타이밍(초). */
export const DRINK_TIMING = {
  waterRaise: 0.38,
  waterGulp: 2.9,
  waterLower: 0.42,
  raise: 0.42,
  lower: 0.45,
  sipUp: 0.28,
  sipTip: 0.42,
  sipDown: 0.3,
  coffeePause: 0.72,
  teaPause: 0.48,
  coffeeSips: 5,
  teaSips: 10,
} as const;

function multiSipDuration(sips: number, pause: number): number {
  const { raise, lower, sipUp, sipTip, sipDown } = DRINK_TIMING;
  const cycle = sipUp + sipTip + sipDown + pause;
  return raise + sips * cycle - pause + lower;
}

/** 해당 음료 마시기 모션이 끝날 때까지의 시간(초). */
export function drinkAnimDuration(kind: DrinkKind): number {
  const t = DRINK_TIMING;
  if (kind === 'water') return t.waterRaise + t.waterGulp + t.waterLower;
  if (kind === 'coffee') return multiSipDuration(t.coffeeSips, t.coffeePause);
  return multiSipDuration(t.teaSips, t.teaPause);
}

/** UI 쿨다운(ms). 모션이 끝난 뒤 잠시 여유. */
export function drinkCooldownMs(kind: DrinkKind): number {
  return Math.ceil(drinkAnimDuration(kind) * 1000) + 400;
}

export function drinkLabel(kind: DrinkKind): string {
  return DRINK_OPTIONS.find((d) => d.id === kind)?.label ?? '음료 마시기';
}

export function drinkToast(kind: DrinkKind): string {
  if (kind === 'water') return '물을 벌컥벌컥 마셨어요';
  if (kind === 'coffee') return '커피를 천천히 마셨어요';
  return '차를 천천히 마셨어요';
}

export function isDrinkKind(v: unknown): v is DrinkKind {
  return v === 'water' || v === 'coffee' || v === 'tea';
}
