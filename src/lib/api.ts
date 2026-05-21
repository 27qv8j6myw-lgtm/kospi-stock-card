import { supabase } from './supabase'

/**
 * Supabase 세션 Bearer + `credentials: 'include'` 로 API 호출.
 * Express `getUserIdFromRequest` 는 Authorization 헤더만 사용합니다.
 */
export async function fetchWithAuth(
  input: RequestInfo | URL,
  options: RequestInit = {},
): Promise<Response> {
  let {
    data: { session },
  } = await supabase.auth.getSession()

  let token = session?.access_token
  if (!token) {
    const { data: refreshed } = await supabase.auth.refreshSession()
    token = refreshed.session?.access_token
  }

  const headers = new Headers(options.headers)
  const body = options.body
  if (body != null && typeof body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(input, {
    ...options,
    credentials: options.credentials ?? 'include',
    headers,
  })
}

/** `fetchWithAuth` 별칭 — Pro·인증 API 호출 시 동일 동작 */
export const authFetch = fetchWithAuth
