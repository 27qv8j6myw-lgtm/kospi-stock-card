/**
 * Anthropic Tool Use 루프 — Pro 채팅·보유 진단 등 공통
 */
import Anthropic from '@anthropic-ai/sdk'
import { STOCK_TOOLS } from './aiTools.mjs'
import { createAnthropicMessage } from './anthropicTimed.mjs'
import { logChatStockViewFromTool } from './chatStockActivity.mjs'
import { executeTool } from './toolExecutor.mjs'
import { logApiUsage, mergeUsage } from './usageLogger.mjs'

export const OPUS_TOOL_MODEL = 'claude-opus-5'

/** Pro 종목·보유·포트폴리오 AI 분석 — 응답 잘림 방지 */
export const PRO_ANALYSIS_MAX_TOKENS = 8000

/**
 * @typedef {object} OpusToolRunOptions
 * @property {Array<{ role: string, content: unknown }>} messages
 * @property {string} system
 * @property {string | null} [userId]
 * @property {string} [modelId] 사용자별 모델 ID (미지정 시 OPUS_TOOL_MODEL)
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
 * @returns {Promise<{ text: string, toolCalls: Array<{ name: string, input: unknown, result: unknown }>, model: string }>}
 */
export async function runOpusWithTools(opts) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 가 설정되지 않았습니다')
  }

  const client = new Anthropic({ apiKey })
  const maxIterations = Math.min(12, Math.max(1, Number(opts.maxIterations) || 8))
  const maxTokens = Math.min(16000, Math.max(500, Number(opts.maxTokens) || 4000))
  const modelId = opts.modelId?.trim() || OPUS_TOOL_MODEL
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
  // 실제 응답 모델(서버사이드 폴백 시 opus 등 실제 답변 모델)
  let answeredModel = modelId

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const response = await createAnthropicMessage(
      client,
      {
        model: modelId,
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
    if (response.model) {
      answeredModel = response.model
    }

    const toolUses = response.content.filter((c) => c.type === 'tool_use')

    if (toolUses.length === 0) {
      const chunk = response.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('\n')
        .trim()
      if (chunk) {
        finalText = finalText ? `${finalText}\n${chunk}` : chunk
      }
      if (response.stop_reason === 'max_tokens' && iteration < maxIterations - 1) {
        conversationMessages.push({ role: 'assistant', content: response.content })
        conversationMessages.push({
          role: 'user',
          content:
            '이전 응답이 중간에 끊겼습니다. 이미 쓴 내용은 반복하지 말고, 남은 섹션만 이어서 작성해 주세요.',
        })
        continue
      }
      break
    }

    conversationMessages.push({ role: 'assistant', content: response.content })

    // 같은 iteration 의 여러 도구는 병렬 실행 (직렬 I/O 누적 지연 제거)
    const executed = await Promise.all(
      toolUses.map(async (toolUse) => {
        const toolInput =
          toolUse.input && typeof toolUse.input === 'object' && !Array.isArray(toolUse.input)
            ? /** @type {Record<string, unknown>} */ (toolUse.input)
            : {}
        if (opts.logChatStockViews) {
          logChatStockViewFromTool(userId, toolUse.name, toolInput, loggedChatStockCodes)
        }
        const result = await executeTool(toolUse.name, toolInput, userId)
        return { toolUse, toolInput, result }
      }),
    )

    /** @type {import('@anthropic-ai/sdk').ToolResultBlockParam[]} */
    const toolResults = []
    for (const { toolUse, toolInput, result } of executed) {
      toolCallsLog.push({ name: toolUse.name, input: toolInput, result })
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      })
    }

    conversationMessages.push({ role: 'user', content: toolResults })
  }

  // 반복 한도 소진으로 최종 텍스트가 없으면, 도구 없이 1회 더 호출해
  // 지금까지 조회한 정보만으로 강제 합성한다(빈 응답 → 실패 메시지 방지).
  if (!finalText && conversationMessages.length > opts.messages.length) {
    try {
      const finalResponse = await createAnthropicMessage(
        client,
        {
          model: modelId,
          max_tokens: maxTokens,
          system: opts.system,
          messages: conversationMessages,
        },
        timeoutMs,
      )
      if (opts.usageLog && finalResponse.usage) {
        totalUsage = mergeUsage(totalUsage, finalResponse.usage)
      }
      if (finalResponse.model) {
        answeredModel = finalResponse.model
      }
      const chunk = finalResponse.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('\n')
        .trim()
      if (chunk) finalText = chunk
    } catch (e) {
      console.warn('[opusEngine] 최종 합성 폴백 실패:', e instanceof Error ? e.message : String(e))
    }
  }

  if (!finalText) {
    finalText = emptyText
  }

  if (opts.usageLog && totalUsage) {
    void logApiUsage(
      opts.usageLog.userId,
      opts.usageLog.endpoint,
      opts.usageLog.model || modelId,
      totalUsage,
    ).catch(() => {})
  }

  return { text: finalText, toolCalls: toolCallsLog, model: answeredModel }
}
