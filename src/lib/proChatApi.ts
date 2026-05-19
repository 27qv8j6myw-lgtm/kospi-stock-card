import { fetchWithAuth } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'

export type ProConversation = {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export type ProMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  tool_calls?: Array<{ name: string; input?: unknown; result?: unknown }> | null
  created_at?: string
}

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

export async function fetchProMessages(conversationId: string): Promise<ProMessage[]> {
  const q = new URLSearchParams({ conversationId })
  const res = await fetchWithAuth(apiUrl(`/api/pro-messages?${q}`))
  const data = await parseJson<{ messages: ProMessage[] }>(res)
  return data.messages || []
}

export async function deleteProConversation(id: string): Promise<void> {
  const q = new URLSearchParams({ id })
  const res = await fetchWithAuth(apiUrl(`/api/pro-conversation?${q}`), { method: 'DELETE' })
  await parseJson<{ ok: boolean }>(res)
}

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
