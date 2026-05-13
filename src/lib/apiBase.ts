/**
 * 브라우저 fetch용 API 절대/상대 URL.
 * Next: `NEXT_PUBLIC_API_BASE_URL` — 개발 시 기본은 동일 출처 + rewrites 로 Express 프록시.
 */
export function apiUrl(path: string): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL
  const base = typeof raw === 'string' ? raw.trim().replace(/\/$/, '') : ''
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}

/** Raw `HTTP 404` 등을 UI에 노출하지 않을 때 사용 */
export function userVisibleApiError(status: number): string {
  if (status === 404 || status === 405) {
    return 'AI 요약을 불러올 수 없습니다. API 서버가 실행 중인지 확인한 뒤 잠시 후 다시 시도해 주세요.'
  }
  if (status === 502 || status === 504) {
    return 'AI 요약을 일시적으로 가져올 수 없습니다. 잠시 후 다시 시도해 주세요.'
  }
  if (status === 503) {
    return 'AI 서비스가 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.'
  }
  return 'AI 요약을 일시적으로 가져올 수 없습니다. 잠시 후 다시 시도해 주세요.'
}
