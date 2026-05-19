const PRO_USERS = ['joongsuc@me.com']

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

    const { data } = await supabaseService.auth.admin.getUserById(userId)
    const email = data?.user?.email?.toLowerCase().trim()

    if (!email || !PRO_USERS.includes(email)) {
      res.status(403).json({ error: 'Pro 기능은 권한이 필요합니다' })
      return null
    }

    return userId
  } catch (e) {
    console.error('[Pro Access]', e)
    res.status(500).json({ error: '권한 확인 실패' })
    return null
  }
}
