import { supabase } from './supabase'

/**
 * Supabase 세션 토큰을 붙여 API 호출 (Express `getUserIdFromRequest` 와 짝).
 */
export async function fetchWithAuth(input: RequestInfo | URL, options: RequestInit = {}): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  const headers = new Headers(options.headers)
  const body = options.body
  if (body != null && typeof body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...options, headers })
}
