import Anthropic from '@anthropic-ai/sdk'
import { STOCK_TOOLS } from '../lib/aiTools.mjs'
import { logActivity } from '../lib/activityLogger.mjs'
import { logChatStockViewFromTool } from '../lib/chatStockActivity.mjs'
import { executeTool } from '../lib/toolExecutor.mjs'
import { createAnthropicStream } from '../lib/anthropicTimed.mjs'
import { logApiUsage, mergeUsage } from '../lib/usageLogger.mjs'
import { resolveAgenticModelId, resolveUserMaxTokens } from '../lib/userModel.mjs'
import { buildEnhancedSystemPrompt, compressHistory } from './proChatPrompt.mjs'
import { generateConversationTitle } from './proChatPrompt.mjs'
import {
  extractMemoriesFromConversation,
  fetchUserMemories,
  saveMemories,
} from '../lib/proUserMemory.mjs'

const MAX_STREAM_ITERATIONS = 8
const STREAM_MAX_TOKENS = 16000
/** 자동 추출 주기(메시지 N개마다) */
const MEMORY_AUTO_EVERY = 6
/** 명시적 "기억해줘" 트리거 */
const MEMORY_TRIGGER = /기억(해|해줘|해둬|할게|하자)|원칙으로|메모(해|리)|잊지\s*마/

/**
 * 대화에서 매매 원칙/선호를 best-effort 로 추출해 저장. 실패해도 채팅 무영향.
 * @param {{
 *   client: Anthropic,
 *   supabaseService: import('@supabase/supabase-js').SupabaseClient,
 *   userId: string,
 *   conversationId: string,
 *   message: string,
 *   recentMessages: Array<{ role: string, content: string }>,
 *   messageCount: number,
 * }} opts
 */
async function captureMemories({
  client,
  supabaseService,
  userId,
  conversationId,
  message,
  recentMessages,
  messageCount,
}) {
  try {
    const explicit = MEMORY_TRIGGER.test(message || '')
    const auto = messageCount > 0 && messageCount % MEMORY_AUTO_EVERY === 0
    if (!explicit && !auto) return

    const existingRows = await fetchUserMemories(supabaseService, userId, 50)
    const existingMemories = existingRows.map((r) => r.content)
    const extracted = await extractMemoriesFromConversation(client, {
      recentMessages,
      existingMemories,
    })
    if (extracted.length === 0) return
    await saveMemories(supabaseService, userId, extracted, conversationId)
  } catch (e) {
    console.warn('[proChatStream] captureMemories', e instanceof Error ? e.message : String(e))
  }
}

/**
 * @typedef {(event: string, data: unknown) => void} ProStreamSend
 */

/**
 * @param {{
 *   supabaseService: import('@supabase/supabase-js').SupabaseClient,
 *   conversationId: string,
 *   message: string,
 *   userId: string,
 *   send: ProStreamSend,
 *   isRetry?: boolean,
 * }} opts
 */
export async function runProChatStream({
  supabaseService,
  conversationId,
  message,
  userId,
  send,
  isRetry = false,
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 가 설정되지 않았습니다')
  }

  const client = new Anthropic({ apiKey })

  const { data: conv, error: convErr } = await supabaseService
    .from('pro_conversations')
    .select('id, title, user_id')
    .eq('id', conversationId)
    .single()

  if (convErr || !conv) {
    throw new Error('대화를 찾을 수 없습니다')
  }
  if (conv.user_id !== userId) {
    throw new Error('권한 없음')
  }

  if (!isRetry) {
    await supabaseService.from('pro_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: message,
    })
    void logActivity(userId, 'chat', { conversationId }, true)
  }

  const { data: history } = await supabaseService
    .from('pro_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at')

  const rawHistory = (history || []).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content ?? ''),
  }))

  /** @type {import('@anthropic-ai/sdk').MessageParam[]} */
  let conversationMessages = await compressHistory(client, rawHistory)

  const systemPrompt = await buildEnhancedSystemPrompt(supabaseService, userId, message)

  // 도구 사용(에이전트형) 채팅은 opus 이상 고정 (sonnet 은 도구 순차 호출로 느림). 관리자는 fable. 작업량 배수는 유지.
  const streamMaxTokens = await resolveUserMaxTokens(userId, STREAM_MAX_TOKENS, 32000)
  const chatModel = await resolveAgenticModelId(userId)

  let fullText = ''
  const allToolCalls = []
  let iteration = 0
  /** @type {Set<string>} */
  const loggedChatStockCodes = new Set()
  /** @type {{ input_tokens?: number, output_tokens?: number } | null} */
  let totalUsage = null
  // 실제 응답 모델(폴백 시 opus 등 실제 답변 모델). 최종 라운드 값 우선.
  let answeredModel = chatModel

  while (iteration < MAX_STREAM_ITERATIONS) {
    iteration += 1

    const stream = await createAnthropicStream(client, {
      model: chatModel,
      max_tokens: streamMaxTokens,
      system: systemPrompt,
      tools: STOCK_TOOLS,
      messages: conversationMessages,
    })

    /** @type {import('@anthropic-ai/sdk').ContentBlock[]} */
    const collectedContent = []
    /** @type {import('@anthropic-ai/sdk').ToolUseBlock[]} */
    const toolUseBlocks = []
    let currentText = ''
    /** @type {{ type: 'tool_use', id: string, name: string, input: string } | null} */
    let currentToolUse = null

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          currentToolUse = {
            type: 'tool_use',
            id: event.content_block.id,
            name: event.content_block.name,
            input: '',
          }
          send('tool_start', { name: currentToolUse.name })
        } else {
          currentText = ''
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          currentText += event.delta.text
          fullText += event.delta.text
          send('text', { delta: event.delta.text })
        } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
          currentToolUse.input += event.delta.partial_json
        }
      } else if (event.type === 'content_block_stop') {
        if (currentToolUse) {
          let parsedInput = {}
          try {
            parsedInput = JSON.parse(currentToolUse.input || '{}')
          } catch {
            parsedInput = {}
          }
          const block = {
            type: 'tool_use',
            id: currentToolUse.id,
            name: currentToolUse.name,
            input: parsedInput,
          }
          toolUseBlocks.push(block)
          collectedContent.push(block)
          currentToolUse = null
        } else if (currentText) {
          collectedContent.push({ type: 'text', text: currentText })
          currentText = ''
        }
      }
    }

    const final = await stream.finalMessage()

    if (final.usage) {
      totalUsage = mergeUsage(totalUsage, final.usage)
    }
    if (final.model) {
      answeredModel = final.model
    }

    if (toolUseBlocks.length === 0) {
      if (final.stop_reason === 'max_tokens') {
        const tail = '\n\n---\n*응답이 길어 여기서 잘렸을 수 있습니다. 「이어서」라고 입력하시면 이어서 작성합니다.*'
        fullText += tail
        send('text', { delta: tail })
      }
      break
    }

    conversationMessages.push({ role: 'assistant', content: collectedContent })

    for (const toolUse of toolUseBlocks) {
      send('tool_executing', { name: toolUse.name, input: toolUse.input })
    }

    // 여러 도구는 병렬 실행 (직렬 I/O 누적 지연 제거)
    const executed = await Promise.all(
      toolUseBlocks.map(async (toolUse) => {
        const toolInput =
          toolUse.input && typeof toolUse.input === 'object' && !Array.isArray(toolUse.input)
            ? /** @type {Record<string, unknown>} */ (toolUse.input)
            : {}
        logChatStockViewFromTool(userId, toolUse.name, toolInput, loggedChatStockCodes)
        const result = await executeTool(toolUse.name, toolInput, userId)
        return { toolUse, result }
      }),
    )

    /** @type {import('@anthropic-ai/sdk').ToolResultBlockParam[]} */
    const toolResults = []
    for (const { toolUse, result } of executed) {
      allToolCalls.push({ name: toolUse.name, input: toolUse.input, result })
      send('tool_result', { name: toolUse.name, result })
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      })
    }

    conversationMessages.push({ role: 'user', content: toolResults })
  }

  if (totalUsage) {
    void logApiUsage(userId, 'chat-stream', chatModel, totalUsage).catch(() => {})
  }

  if (!fullText.trim()) {
    fullText = '응답을 생성하지 못했습니다. 다시 질문해 주세요.'
  }

  await supabaseService.from('pro_messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content: fullText,
    tool_calls: allToolCalls.length > 0 ? allToolCalls : null,
    model: answeredModel,
  })

  let newTitle = conv.title
  if (conv.title === '새 대화') {
    newTitle = await generateConversationTitle(message)
  }

  const now = new Date().toISOString()
  const updatePayload = { updated_at: now }
  if (newTitle !== conv.title) {
    updatePayload.title = newTitle
  }

  await supabaseService.from('pro_conversations').update(updatePayload).eq('id', conversationId)

  send('done', { title: newTitle, model: answeredModel })

  // 메모리 캡처는 응답 완료(done) 이후 best-effort 로 수행 (스트림 지연 없음)
  void captureMemories({
    client,
    supabaseService,
    userId,
    conversationId,
    message,
    recentMessages: [...rawHistory.slice(-8), { role: 'assistant', content: fullText }],
    messageCount: rawHistory.length + 1,
  })
}
