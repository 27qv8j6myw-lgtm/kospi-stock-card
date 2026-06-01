import { getSupabaseService } from './supabaseService.mjs'

/**
 * @param {string} userId
 * @param {string} action
 * @param {Record<string, unknown>} [metadata]
 * @param {boolean} [isPro]
 */
export async function logActivity(userId, action, metadata = {}, isPro = true) {
  if (!userId || !action) return

  const supabaseService = getSupabaseService()
  if (!supabaseService) return

  try {
    const { error } = await supabaseService.from('activity_logs').insert({
      user_id: userId,
      action,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
      is_pro: isPro,
    })
    if (error) console.warn('[Activity log]', error.message)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.warn('[Activity log]', message)
  }
}
