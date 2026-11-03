// 매니저(어드민) 계정: 입장 코드로만 들어온다. 일반 방문객과 프로필·아바타를 분리한다.

export const MANAGER_NICKNAME = '서든리 매니저';
export const MANAGER_TITLE = '(대표)';
/** 분홍·모브 티셔츠 */
export const MANAGER_COLOR = '#d9a0a8';
export const MANAGER_SESSION_KEY = 'bbooks.manager';

/** 기본 코드. `VITE_MANAGER_CODE`로 덮어쓸 수 있다. */
const DEFAULT_CODE = 'suddenly2026';

export function managerCode(): string {
  const fromEnv = (import.meta.env.VITE_MANAGER_CODE as string | undefined)?.trim();
  return fromEnv || DEFAULT_CODE;
}

export function checkManagerCode(input: string): boolean {
  const a = input.trim().toLowerCase();
  const b = managerCode().trim().toLowerCase();
  return !!a && a === b;
}

export function loadManagerSession(): boolean {
  try {
    return sessionStorage.getItem(MANAGER_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveManagerSession(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(MANAGER_SESSION_KEY, '1');
    else sessionStorage.removeItem(MANAGER_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
