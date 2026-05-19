import Anthropic from '@anthropic-ai/sdk'
import { STOCK_TOOLS } from '../lib/aiTools.mjs'
import { executeTool } from '../lib/toolExecutor.mjs'
import { createAnthropicMessage } from '../lib/anthropicTimed.mjs'

const PRO_CHAT_MODEL = 'claude-opus-4-7'
const TITLE_MODEL = 'claude-haiku-4-5-20251001'
const MAX_ITERATIONS = 5
const PRO_CHAT_TIMEOUT_MS = Number(process.env.PRO_CHAT_TIMEOUT_MS) || 120_000

const SYSTEM_PROMPT = `당신은 한국 주식 매매 어시스턴트입니다.
실시간 KIS 데이터를 도구로 조회 후 정중한 존댓말로 답변하세요.
학습 데이터의 옛 가격 사용 금지. 항상 도구로 실시간 데이터를 가져오세요.
사용자가 종목을 언급하면 searchStock 또는 getStockQuote 로 정확한 정보를 먼저 조회한 후 답변하세요.
투자 권유가 아닌 정보·분석 참고용임을 필요 시 한 줄로 밝히세요.`

/**
 * @param {Array<{ role: string, content: string }>} messages
 * @returns {Promise<{ text: string, toolCalls: Array<{ name: string, input: unknown, result: unknown }> }>}
 */
export async function runProChat(messages) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 가 설정되지 않았습니다')
  }

  const client = new Anthropic({ apiKey })
  /** @type {import('@anthropic-ai/sdk').MessageParam[]} */
  let conversationMessages = messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content ?? ''),
  }))

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
        system: SYSTEM_PROMPT,
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
      const result = await executeTool(toolUse.name, toolUse.input)
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

/**
 * @param {string} firstMessage
 * @returns {Promise<string>}
 */
export async function generateConversationTitle(firstMessage) {
  const fallback = String(firstMessage || '새 대화').trim().slice(0, 20) || '새 대화'
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return fallback

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: TITLE_MODEL,
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: `다음 질문의 짧은 제목 (15자 이내) 만 출력. 따옴표 X.\n\n질문: ${firstMessage}`,
        },
      ],
    })
    const text = response.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('')
      .trim()
      .replace(/^["'「]|["'」]$/g, '')
    return (text || fallback).slice(0, 20)
  } catch (e) {
    console.warn('[Pro Chat] title generation failed:', e instanceof Error ? e.message : e)
    return fallback
  }
}
