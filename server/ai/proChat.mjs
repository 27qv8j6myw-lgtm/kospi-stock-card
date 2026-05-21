import Anthropic from '@anthropic-ai/sdk'
import { STOCK_TOOLS } from '../lib/aiTools.mjs'
import { executeTool } from '../lib/toolExecutor.mjs'
import { createAnthropicMessage } from '../lib/anthropicTimed.mjs'
import {
  SYSTEM_PROMPT,
  buildEnhancedSystemPrompt,
  compressHistory,
  generateConversationTitle,
} from './proChatPrompt.mjs'

export { generateConversationTitle } from './proChatPrompt.mjs'

export { SYSTEM_PROMPT } from './proChatPrompt.mjs'

const PRO_CHAT_MODEL = 'claude-opus-4-7'
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

  let conversationMessages = await compressHistory(client, messages)

  const system =
    supabaseService && userId
      ? await buildEnhancedSystemPrompt(supabaseService, userId)
      : SYSTEM_PROMPT

  const toolCallsLog = []
  let finalText = ''
  let iteration = 0

  while (iteration < MAX_ITERATIONS) {
    iteration += 1

    const response = await createAnthropicMessage(
      client,
      {
        model: PRO_CHAT_MODEL,
        max_tokens: 4000,
        system,
        tools: STOCK_TOOLS,
        messages: conversationMessages,
      },
      PRO_CHAT_TIMEOUT_MS,
    )

    const toolUses = response.content.filter((c) => c.type === 'tool_use')

    if (toolUses.length === 0) {
      finalText = response.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('\n')
        .trim()
      break
    }

    conversationMessages.push({ role: 'assistant', content: response.content })

    /** @type {import('@anthropic-ai/sdk').ToolResultBlockParam[]} */
    const toolResults = []
    for (const toolUse of toolUses) {
      const result = await executeTool(toolUse.name, toolUse.input, userId)
      toolCallsLog.push({ name: toolUse.name, input: toolUse.input, result })
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      })
    }

    conversationMessages.push({ role: 'user', content: toolResults })
  }

  if (!finalText) {
    finalText = '도구 호출 한도에 도달했습니다. 질문을 나눠 다시 시도해 주세요.'
  }

  return { text: finalText, toolCalls: toolCallsLog }
}
