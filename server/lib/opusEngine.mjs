/**
 * Anthropic Tool Use 루프 — Pro 채팅·보유 진단 등 공통
 */
import Anthropic from '@anthropic-ai/sdk'
import { STOCK_TOOLS } from './aiTools.mjs'
import { createAnthropicMessage } from './anthropicTimed.mjs'
import { logChatStockViewFromTool } from './chatStockActivity.mjs'
import { executeTool } from './toolExecutor.mjs'
import { logApiUsage, mergeUsage } from './usageLogger.mjs'

export const OPUS_TOOL_MODEL = 'claude-opus-4-8'

/**
 * @typedef {object} OpusToolRunOptions
 * @property {Array<{ role: string, content: unknown }>} messages
 * @property {string} system
 * @property {string | null} [userId]
 * @property {number} [maxIterations]
 * @property {number} [maxTokens]
 * @property {number} [timeoutMs]
 * @property {typeof STOCK_TOOLS} [tools]
 * @property {string} [emptyText]
 * @property {{ userId: string, endpoint: string, model?: string }} [usageLog]
 * @property {boolean} [logChatStockViews] Pro 채팅 종목 도구 → view_stock (source: chat)
 */

/**
 * @param {OpusToolRunOptions} opts
 * @returns {Promise<{ text: string, toolCalls: Array<{ name: string, input: unknown, result: unknown }> }>}
 */
export async function runOpusWithTools(opts) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 가 설정되지 않았습니다')
  }

  const client = new Anthropic({ apiKey })
  const maxIterations = Math.min(12, Math.max(1, Number(opts.maxIterations) || 8))
  const maxTokens = Math.min(8000, Math.max(500, Number(opts.maxTokens) || 4000))
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 120_000
  const tools = opts.tools ?? STOCK_TOOLS
  const userId = opts.userId ?? null
  const emptyText =
    opts.emptyText ?? '도구 호출 한도에 도달했습니다. 질문을 나눠 다시 시도해 주세요.'

  /** @type {import('@anthropic-ai/sdk').MessageParam[]} */
  let conversationMessages = [...opts.messages]
  const toolCallsLog = []
  let finalText = ''
  /** @type {Set<string> | null} */
  const loggedChatStockCodes = opts.logChatStockViews && userId ? new Set() : null
  /** @type {{ input_tokens?: number, output_tokens?: number } | null} */
  let totalUsage = null

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const response = await createAnthropicMessage(
      client,
      {
        model: OPUS_TOOL_MODEL,
        max_tokens: maxTokens,
        system: opts.system,
        tools,
        messages: conversationMessages,
      },
      timeoutMs,
    )

    if (opts.usageLog && response.usage) {
      totalUsage = mergeUsage(totalUsage, response.usage)
    }

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
      const toolInput =
        toolUse.input && typeof toolUse.input === 'object' && !Array.isArray(toolUse.input)
          ? /** @type {Record<string, unknown>} */ (toolUse.input)
          : {}
      if (opts.logChatStockViews) {
        logChatStockViewFromTool(userId, toolUse.name, toolInput, loggedChatStockCodes)
      }
      const result = await executeTool(toolUse.name, toolInput, userId)
      toolCallsLog.push({ name: toolUse.name, input: toolInput, result })
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      })
    }

    conversationMessages.push({ role: 'user', content: toolResults })
  }

  if (!finalText) {
    finalText = emptyText
  }

  if (opts.usageLog && totalUsage) {
    void logApiUsage(
      opts.usageLog.userId,
      opts.usageLog.endpoint,
      opts.usageLog.model || OPUS_TOOL_MODEL,
      totalUsage,
    ).catch(() => {})
  }

  return { text: finalText, toolCalls: toolCallsLog }
}
