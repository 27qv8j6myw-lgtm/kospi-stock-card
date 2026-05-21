import { fetchWithAuth } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'

export type ProConversation = {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export type ProToolCallUi = {
  name: string
  status?: 'executing' | 'done'
  input?: unknown
  result?: unknown
  /** 서버 저장 레코드 호환 */
  [key: string]: unknown
}

export type ProMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  tool_calls?: ProToolCallUi[] | null
  created_at?: string
  streaming?: boolean
}

export type ProStreamEvent =
  | { event: 'text'; data: { delta: string } }
  | { event: 'tool_start'; data: { name: string } }
  | { event: 'tool_executing'; data: { name: string; input?: unknown } }
  | { event: 'tool_result'; data: { name: string; result: unknown } }
  | { event: 'done'; data: { title?: string } }
  | { event: 'error'; data: { message: string } }

async function parseJson<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || ''
  if (!res.ok) {
    let errMsg = `요청 실패 (${res.status})`
    if (contentType.includes('application/json')) {
      const body = (await res.json()) as { error?: string }
      if (body?.error) errMsg = body.error
    }
    throw new Error(errMsg)
  }
  return res.json() as Promise<T>
}

export async function fetchProConversations(): Promise<ProConversation[]> {
  const res = await fetchWithAuth(apiUrl('/api/pro-conversations'))
  const data = await parseJson<{ conversations: ProConversation[] }>(res)
  return data.conversations || []
}

export async function createProConversation(): Promise<ProConversation> {
  const res = await fetchWithAuth(apiUrl('/api/pro-conversations'), { method: 'POST' })
  const data = await parseJson<{ conversation: ProConversation }>(res)
  return data.conversation
}

/** 서버 tool_calls → UI 형식 (status: done) */
export function normalizeProMessages(messages: ProMessage[]): ProMessage[] {
  return messages.map((m) => ({
    ...m,
    streaming: false,
    tool_calls: m.tool_calls?.length
      ? m.tool_calls.map((tc) => ({
          name: tc.name,
          status: (tc.status ?? 'done') as 'executing' | 'done',
          input: tc.input,
          result: tc.result,
        }))
      : m.tool_calls,
  }))
}

export async function fetchProMessages(conversationId: string): Promise<ProMessage[]> {
  const q = new URLSearchParams({ conversationId })
  const res = await fetchWithAuth(apiUrl(`/api/pro-messages?${q}`))
  const data = await parseJson<{ messages: ProMessage[] }>(res)
  return normalizeProMessages(data.messages || [])
}

export async function deleteProConversation(id: string): Promise<void> {
  const q = new URLSearchParams({ id })
  const res = await fetchWithAuth(apiUrl(`/api/pro-conversation?${q}`), { method: 'DELETE' })
  await parseJson<{ ok: boolean }>(res)
}

/** 레거시 비스트리밍 (유지) */
export async function sendProChatMessage(
  conversationId: string,
  message: string,
): Promise<{ text: string; toolCalls: ProMessage['tool_calls']; title?: string }> {
  const res = await fetchWithAuth(apiUrl('/api/pro-chat'), {
    method: 'POST',
    body: JSON.stringify({ conversationId, message }),
  })
  return parseJson(res)
}

function parseSseBlock(block: string): ProStreamEvent | null {
  if (!block.trim()) return null
  const lines = block.split('\n')
  let eventName = ''
  let data = ''
  for (const line of lines) {
    if (line.startsWith('event: ')) eventName = line.slice(7).trim()
    if (line.startsWith('data: ')) data = line.slice(6)
  }
  if (!eventName || !data) return null
  try {
    const parsed = JSON.parse(data) as unknown
    return { event: eventName, data: parsed } as ProStreamEvent
  } catch {
    return null
  }
}

/**
 * SSE 스트리밍 채팅
 */
export async function streamProChatMessage(
  conversationId: string,
  message: string,
  onEvent: (ev: ProStreamEvent) => void,
): Promise<void> {
  const res = await fetchWithAuth(apiUrl('/api/pro-chat-stream'), {
    method: 'POST',
    body: JSON.stringify({ conversationId, message }),
  })

  const contentType = res.headers.get('content-type') || ''
  if (!res.ok) {
    if (contentType.includes('application/json')) {
      const body = (await res.json()) as { error?: string }
      throw new Error(body?.error || `요청 실패 (${res.status})`)
    }
    throw new Error(`요청 실패 (${res.status})`)
  }

  if (!res.body) {
    throw new Error('스트림 응답 없음')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      let readResult
      try {
        readResult = await reader.read()
      } catch (e) {
        console.error('[ProChat Stream] read error:', e)
        break
      }

      const { done, value } = readResult
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''

      for (const part of parts) {
        const ev = parseSseBlock(part)
        if (ev) onEvent(ev)
        if (ev?.event === 'error') {
          throw new Error(String((ev.data as { message?: string }).message || '스트림 오류'))
        }
      }
    }
  } finally {
    if (buffer.trim()) {
      const ev = parseSseBlock(buffer)
      if (ev) onEvent(ev)
    }
  }
}
