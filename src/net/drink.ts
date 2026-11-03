// 음료 마시기: 물·커피·차.

export type DrinkKind = 'water' | 'coffee' | 'tea';

export const DRINK_OPTIONS: { id: DrinkKind; label: string; hint: string; color: string }[] = [
  { id: 'water', label: '물 마시기', hint: '시원하게 한 모금', color: '#9ec9e0' },
  { id: 'coffee', label: '커피 마시기', hint: '진한 아메리카노', color: '#5a3820' },
  { id: 'tea', label: '차 마시기', hint: '따뜻한 찻잔', color: '#c9b26a' },
];

export function drinkLabel(kind: DrinkKind): string {
  return DRINK_OPTIONS.find((d) => d.id === kind)?.label ?? '음료 마시기';
}

export function drinkToast(kind: DrinkKind): string {
  if (kind === 'water') return '물을 마셨어요';
  if (kind === 'coffee') return '커피를 마셨어요';
  return '차를 마셨어요';
}

export function isDrinkKind(v: unknown): v is DrinkKind {
  return v === 'water' || v === 'coffee' || v === 'tea';
}
