/**
 * 요청 Authorization → Supabase 사용자 UUID
 */
import { createClient } from '@supabase/supabase-js'

function cleanEnvSecret(v) {
  if (v == null || typeof v !== 'string') return ''
  let s = v.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim()
  }
  return s
}

/**
 * @param {import('express').Request} req
 * @returns {Promise<string | null>}
 */
export async function getUserIdFromRequest(req) {
  const raw = req.headers.authorization ?? req.headers.Authorization
  const authHeader = Array.isArray(raw) ? raw[0] : raw
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  if (!token) return null
  const url = cleanEnvSecret(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const anon = cleanEnvSecret(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  if (!url || !anon) return null
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)
    if (error || !user?.id) return null
    return user.id
  } catch {
    return null
  }
}
