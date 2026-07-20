import Anthropic from '@anthropic-ai/sdk'
import { runOpusWithTools } from '../lib/opusEngine.mjs'
import { resolveAgenticModelId, resolveUserMaxTokens } from '../lib/userModel.mjs'
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
 * @returns {Promise<{ text: string, toolCalls: Array<{ name: string, input: unknown, result: unknown }>, model: string }>}
 */
export async function runProChat(messages, userId, supabaseService = null) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 가 설정되지 않았습니다')
  }

  const client = new Anthropic({ apiKey })
  const conversationMessages = await compressHistory(client, messages)

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''

  const system =
    supabaseService && userId
      ? await buildEnhancedSystemPrompt(supabaseService, userId, String(lastUserMessage))
      : SYSTEM_PROMPT

  // 도구 사용(에이전트형) 채팅은 opus 이상 고정 (sonnet 은 도구 순차 호출로 느림). 관리자는 fable. 작업량 배수는 유지.
  const maxTokens = await resolveUserMaxTokens(userId, 4000, 8000)
  const modelId = await resolveAgenticModelId(userId)

  return runOpusWithTools({
    messages: conversationMessages,
    system,
    userId: userId ?? null,
    modelId,
    maxIterations: MAX_ITERATIONS,
    maxTokens,
    timeoutMs: PRO_CHAT_TIMEOUT_MS,
    usageLog: userId ? { userId, endpoint: 'chat', model: modelId } : undefined,
    logChatStockViews: Boolean(userId),
  })
}
