/** Pro 딥링크 — 새로고침·인증 대기 중 URL 복원용 (세션) */
const STORAGE_KEY = 'pro:restore-path'

export function saveProDeepLink(pathname: string): void {
  if (typeof window === 'undefined') return
  if (!pathname.startsWith('/pro/') || pathname === '/pro') return
  try {
    sessionStorage.setItem(STORAGE_KEY, pathname)
  } catch {
    // ignore
  }
}

export function peekProDeepLink(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const p = sessionStorage.getItem(STORAGE_KEY)
    return p && p.startsWith('/pro/') && p !== '/pro' ? p : null
  } catch {
    return null
  }
}

export function consumeProDeepLink(): string | null {
  const p = peekProDeepLink()
  if (!p) return null
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  return p
}

/** Pro 홈(`/pro`)으로 나갈 때 저장된 채팅 경로 복원 방지 */
export function clearProDeepLink(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
