import { createUserSupabaseFromRequest } from './auth.mjs'

/**
 * 관리자 전용 게이트 — Supabase `is_admin()` RPC (DB·RLS 일치) 기준.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {(req: import('express').Request) => Promise<string | null>} getUserIdFromRequest
 * @returns {Promise<string | null>} userId or null (response already sent)
 */
export async function requireAdmin(req, res, getUserIdFromRequest) {
  try {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      res.status(401).json({ error: '인증 필요' })
      return null
    }

    const userSupabase = createUserSupabaseFromRequest(req)
    if (!userSupabase) {
      res.status(401).json({ error: '토큰 없음' })
      return null
    }

    const { data: isAdmin, error } = await userSupabase.rpc('is_admin')
    if (error || !isAdmin) {
      console.log('[Pro Access] is_admin 결과:', isAdmin, 'error:', error?.message)
      res.status(403).json({ error: '관리자 권한 필요' })
      return null
    }

    return userId
  } catch (e) {
    console.error('[Pro Access] requireAdmin', e)
    res.status(500).json({ error: '권한 확인 실패' })
    return null
  }
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseService
 * @param {(req: import('express').Request) => Promise<string | null>} getUserIdFromRequest
 * @returns {Promise<string | null>} userId or null (response already sent)
 */
export async function requireProUser(req, res, supabaseService, getUserIdFromRequest) {
  try {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      res.status(401).json({ error: '인증 필요' })
      return null
    }

    const { data, error } = await supabaseService
      .from('user_settings')
      .select('pro_enabled')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('[Pro Access] user_settings', error)
      res.status(500).json({ error: '권한 확인 실패' })
      return null
    }

    if (!data?.pro_enabled) {
      res.status(403).json({ error: 'Pro 모드 권한이 없습니다' })
      return null
    }

    return userId
  } catch (e) {
    console.error('[Pro Access]', e)
    res.status(500).json({ error: '권한 확인 실패' })
    return null
  }
}

/**
 * 스크리너 접근 게이트 — 관리자(`is_admin()`)이거나 `user_settings.screener_enabled`가 켜진 사용자만 통과.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseService
 * @param {(req: import('express').Request) => Promise<string | null>} getUserIdFromRequest
 * @returns {Promise<string | null>} userId or null (response already sent)
 */
export async function requireScreenerAccess(req, res, supabaseService, getUserIdFromRequest) {
  try {
    const userId = await getUserIdFromRequest(req)
    if (!userId) {
      res.status(401).json({ error: '인증 필요' })
      return null
    }

    // 관리자는 토글과 무관하게 통과
    const userSupabase = createUserSupabaseFromRequest(req)
    if (userSupabase) {
      const { data: isAdmin } = await userSupabase.rpc('is_admin')
      if (isAdmin) return userId
    }

    const { data, error } = await supabaseService
      .from('user_settings')
      .select('screener_enabled')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('[Pro Access] screener user_settings', error)
      res.status(500).json({ error: '권한 확인 실패' })
      return null
    }

    if (!data?.screener_enabled) {
      res.status(403).json({ error: '스크리너 권한이 없습니다' })
      return null
    }

    return userId
  } catch (e) {
    console.error('[Pro Access] requireScreenerAccess', e)
    res.status(500).json({ error: '권한 확인 실패' })
    return null
  }
}
