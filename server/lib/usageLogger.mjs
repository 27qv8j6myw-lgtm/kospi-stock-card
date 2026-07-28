import { getSupabaseService } from './supabaseService.mjs'

export { calcCost, calcOpusCostUsd, MODEL_PRICE, OPUS_INPUT_USD_PER_M, OPUS_OUTPUT_USD_PER_M } from './pricing.mjs'

/**
 * @param {{ input_tokens?: number, output_tokens?: number } | null | undefined} usage
 * @param {{ input_tokens?: number, output_tokens?: number } | null | undefined} acc
 */
export function mergeUsage(acc, usage) {
  if (!usage) return acc || { input_tokens: 0, output_tokens: 0 }
  const base = acc || { input_tokens: 0, output_tokens: 0 }
  return {
    input_tokens: (base.input_tokens || 0) + (usage.input_tokens || 0),
    output_tokens: (base.output_tokens || 0) + (usage.output_tokens || 0),
  }
}

/**
 * @param {string} userId
 * @param {string} endpoint
 * @param {string} model
 * @param {{ input_tokens?: number, output_tokens?: number } | null | undefined} usage
 */
export async function logApiUsage(userId, endpoint, model, usage) {
  if (!userId || !endpoint || !usage) return

  const input = Number(usage.input_tokens) || 0
  const output = Number(usage.output_tokens) || 0
  if (input === 0 && output === 0) return

  const supabaseService = getSupabaseService()
  if (!supabaseService) return

  try {
    const { error } = await supabaseService.from('pro_api_usage').insert({
      user_id: userId,
      endpoint,
      model: model || 'claude-opus-5',
      input_tokens: input,
      output_tokens: output,
    })
    if (error) console.warn('[Usage]', error.message)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.warn('[Usage]', message)
  }
}
