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
