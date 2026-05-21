import { supabase } from '@/lib/supabase'

/**
 * 관리자가 사용자를 차단합니다. RLS 로 관리자만 호출 가능.
 * @param {string} userId
 * @param {string} [reason]
 */
export async function blockUser(userId: string, reason?: string): Promise<void> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user) throw new Error('로그인 필요')

  const { error } = await supabase.from('blocked_users').insert({
    user_id: userId,
    blocked_by: user.id,
    reason: reason ?? null,
  })

  if (error) throw new Error(error.message)
}

/**
 * 관리자가 차단을 해제합니다.
 * @param {string} userId
 */
export async function unblockUser(userId: string): Promise<void> {
  const { error } = await supabase.from('blocked_users').delete().eq('user_id', userId)

  if (error) throw new Error(error.message)
}
