import { supabase } from '@/lib/supabase'

export type ActivityAction =
  | 'login'
  | 'view_stock'
  | 'add_holding'
  | 'update_holding'
  | 'remove_holding'
  | 'portfolio_add'
  | 'portfolio_update'
  | 'portfolio_remove'

/**
 * 활동 로그 기록 (실패해도 호출부는 중단하지 않음).
 * @param {ActivityAction | string} action
 * @param {Record<string, unknown>} [metadata]
 */
export async function logActivity(action: ActivityAction | string, metadata?: Record<string, unknown>): Promise<void> {
  try {
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData.user?.id) return

    const row: Record<string, unknown> = {
      user_id: userData.user.id,
      action,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    }

    const { error } = await supabase.from('activity_logs').insert(row)
    if (error) console.error('[activityLog]', error.message)
  } catch (e) {
    console.error('[activityLog]', e instanceof Error ? e.message : String(e))
  }
}
