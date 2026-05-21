import Anthropic from '@anthropic-ai/sdk'
import { STOCK_TOOLS } from '../lib/aiTools.mjs'
import { executeTool } from '../lib/toolExecutor.mjs'
import { buildEnhancedSystemPrompt, compressHistory } from './proChatPrompt.mjs'
import { generateConversationTitle } from './proChatPrompt.mjs'

const PRO_CHAT_MODEL = 'claude-opus-4-7'
const MAX_STREAM_ITERATIONS = 8
const STREAM_MAX_TOKENS = 16000

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
 * }} opts
 */
export async function runProChatStream({ supabaseService, conversationId, message, userId, send }) {
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

  await supabaseService.from('pro_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: message,
  })

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

  const systemPrompt = await buildEnhancedSystemPrompt(supabaseService, userId)

  let fullText = ''
  const allToolCalls = []
  let iteration = 0

  while (iteration < MAX_STREAM_ITERATIONS) {
    iteration += 1

    const stream = client.messages.stream({
      model: PRO_CHAT_MODEL,
      max_tokens: STREAM_MAX_TOKENS,
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

    if (toolUseBlocks.length === 0) {
      if (final.stop_reason === 'max_tokens') {
        const tail = '\n\n---\n*응답이 길어 여기서 잘렸을 수 있습니다. 「이어서」라고 입력하시면 이어서 작성합니다.*'
        fullText += tail
        send('text', { delta: tail })
      }
      break
    }

    conversationMessages.push({ role: 'assistant', content: collectedContent })

    /** @type {import('@anthropic-ai/sdk').ToolResultBlockParam[]} */
    const toolResults = []
    for (const toolUse of toolUseBlocks) {
      send('tool_executing', { name: toolUse.name, input: toolUse.input })
      const result = await executeTool(toolUse.name, toolUse.input, userId)
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

  if (!fullText.trim()) {
    fullText = '응답을 생성하지 못했습니다. 다시 질문해 주세요.'
  }

  await supabaseService.from('pro_messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content: fullText,
    tool_calls: allToolCalls.length > 0 ? allToolCalls : null,
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

  send('done', { title: newTitle })
}
