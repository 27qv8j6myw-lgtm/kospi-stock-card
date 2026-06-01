import { createClient } from '@supabase/supabase-js'

/**
 * @param {string | undefined} raw
 */
function cleanEnvSecret(raw) {
  if (raw == null) return ''
  let s = String(raw).trim()
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim()
  }
  return s
}

/** @returns {import('@supabase/supabase-js').SupabaseClient | null} */
export function getSupabaseService() {
  const url = cleanEnvSecret(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = cleanEnvSecret(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
