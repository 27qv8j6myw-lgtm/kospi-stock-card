import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_URL : undefined)

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_ANON_KEY : undefined)

if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error('Supabase URL/anon key 누락')
}

/** SSR/빌드: env 없을 때 모듈 로드만 되도록 플레이스홀더 (브라우저는 위에서 throw) */
const urlForClient = supabaseUrl ?? 'https://build-placeholder.supabase.co'
const keyForClient = supabaseAnonKey ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.build-placeholder'

export const supabase: SupabaseClient = createClient(urlForClient, keyForClient, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    /** PKCE(`?code=`) 교환 없이 `#access_token` 프래그먼트로 세션 확립 — SPA 에서 안정적 */
    flowType: 'implicit',
  },
})

if (typeof window !== 'undefined') {
  ;(window as unknown as { supabase: SupabaseClient }).supabase = supabase
}
