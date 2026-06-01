import Anthropic from '@anthropic-ai/sdk'
import { runOpusWithTools } from '../lib/opusEngine.mjs'
import {
  SYSTEM_PROMPT,
  buildEnhancedSystemPrompt,
  compressHistory,
  generateConversationTitle,
} from './proChatPrompt.mjs'

export { generateConversationTitle } from './proChatPrompt.mjs'

export { SYSTEM_PROMPT } from './proChatPrompt.mjs'

const MAX_ITERATIONS = 8
const PRO_CHAT_TIMEOUT_MS = Number(process.env.PRO_CHAT_TIMEOUT_MS) || 120_000

/**
 * @param {Array<{ role: string, content: string }>} messages
 * @param {string | null | undefined} [userId]
 * @param {import('@supabase/supabase-js').SupabaseClient | null} [supabaseService]
 * @returns {Promise<{ text: string, toolCalls: Array<{ name: string, input: unknown, result: unknown }> }>}
 */
export async function runProChat(messages, userId, supabaseService = null) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 가 설정되지 않았습니다')
  }

  const client = new Anthropic({ apiKey })
  const conversationMessages = await compressHistory(client, messages)

  const system =
    supabaseService && userId
      ? await buildEnhancedSystemPrompt(supabaseService, userId)
      : SYSTEM_PROMPT

  return runOpusWithTools({
    messages: conversationMessages,
    system,
    userId: userId ?? null,
    maxIterations: MAX_ITERATIONS,
    maxTokens: 4000,
    timeoutMs: PRO_CHAT_TIMEOUT_MS,
    usageLog: userId ? { userId, endpoint: 'chat' } : undefined,
    logChatStockViews: Boolean(userId),
  })
}
