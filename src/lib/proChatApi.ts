import { fetchWithAuth } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { friendlyProChatError } from '@/lib/friendlyAnthropicError'

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
  /** 실제 응답 모델 ID (관리자에게만 배지 표시) */
  model?: string | null
}

export type ProStockLink = { name: string; code: string }

const STOCK_CODE_TOOLS = new Set([
  'getStockQuote',
  'get52Week',
  'getInvestorTrend',
  'getValuation',
  'getDailyChart',
  'getDisclosures',
  'getAnalystReports',
])

function normalizeStockCode6(raw: unknown): string {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length !== 6) return ''
  return digits
}

const NAME_KEYS = ['name', 'name_kr', 'nameKr', 'stockName', 'hts_kor_isnm'] as const

function isValidStockLinkName(name: string, code: string): boolean {
  const s = name.trim()
  if (!s || s === code) return false
  const compact = s.replace(/\s/g, '')
  if (/^[0-9A-Z]{6}$/i.test(compact)) return false
  if (/[가-힣]/.test(s)) return true
  return /^[A-Za-z0-9][A-Za-z0-9.\-&+ ]*$/.test(s) && compact.length >= 2
}

function pickNameFromRow(row: Record<string, unknown>, code: string): string | undefined {
  for (const key of NAME_KEYS) {
    const v = String(row[key] ?? '').trim()
    if (isValidStockLinkName(v, code)) return v
  }
  return undefined
}

/**
 * 채팅 종목 링크 — Tool Use 의 code/name 만 사용 (AI 본문 파싱 X)
 * @param {ProToolCallUi[] | null | undefined} toolCalls
 */
export function extractStocksFromToolCalls(toolCalls?: ProToolCallUi[] | null): ProStockLink[] {
  if (!toolCalls?.length) return []

  /** @type {Map<string, string>} */
  const byCode = new Map<string, string>()

  const merge = (codeRaw: unknown, nameRaw?: unknown) => {
    const code = normalizeStockCode6(codeRaw)
    if (!code) return
    const candidate = String(nameRaw ?? '').trim()
    const prev = byCode.get(code)
    if (isValidStockLinkName(candidate, code)) {
      byCode.set(code, candidate)
      return
    }
    if (!prev) byCode.set(code, code)
  }

  const mergeFromObject = (row: Record<string, unknown>) => {
    const code = normalizeStockCode6(row.code)
    if (!code || row.error) return
    merge(code, pickNameFromRow(row, code))
  }

  /** 이름 품질이 높은 도구부터 */
  for (const tc of toolCalls) {
    const result = tc.result
    if (tc.name === 'searchStock' && Array.isArray(result)) {
      for (const item of result) {
        if (!item || typeof item !== 'object') continue
        mergeFromObject(item as Record<string, unknown>)
      }
    }
    if (
      (tc.name === 'getStockQuote' || tc.name === 'getValuation') &&
      result &&
      typeof result === 'object' &&
      !Array.isArray(result)
    ) {
      mergeFromObject(result as Record<string, unknown>)
    }
  }

  for (const tc of toolCalls) {
    const result = tc.result

    if (result && typeof result === 'object' && !Array.isArray(result)) {
      mergeFromObject(result as Record<string, unknown>)
    }

    if (STOCK_CODE_TOOLS.has(tc.name) && tc.input && typeof tc.input === 'object') {
      const input = tc.input as { code?: unknown }
      const code = normalizeStockCode6(input.code)
      if (!code) continue
      if (
        result &&
        typeof result === 'object' &&
        !Array.isArray(result) &&
        !(result as { error?: unknown }).error
      ) {
        merge(code, pickNameFromRow(result as Record<string, unknown>, code))
      } else {
        merge(code)
      }
    }
  }

  return Array.from(byCode.entries()).map(([code, name]) => ({
    code,
    name: isValidStockLinkName(name, code) ? name : code,
  }))
}

/** 링크용 표시명 — 이름이 코드와 같으면 API로 보강 */
export async function enrichStockLinkNames(links: ProStockLink[]): Promise<ProStockLink[]> {
  const needs = links.filter((l) => !isValidStockLinkName(l.name, l.code))
  if (!needs.length) return links

  const { fetchStockSearch } = await import('@/lib/proStockSearch')
  const resolved = new Map<string, string>()

  await Promise.all(
    needs.map(async (l) => {
      try {
        const rows = await fetchStockSearch(l.code)
        const hit = rows.find((r) => r.code === l.code)
        if (hit?.name && isValidStockLinkName(hit.name, l.code)) {
          resolved.set(l.code, hit.name)
        }
      } catch {
        /* ignore */
      }
    }),
  )

  return links.map((l) => ({
    code: l.code,
    name: resolved.get(l.code) || l.name,
  }))
}

export type ProStreamEvent =
  | { event: 'text'; data: { delta: string } }
  | { event: 'tool_start'; data: { name: string } }
  | { event: 'tool_executing'; data: { name: string; input?: unknown } }
  | { event: 'tool_result'; data: { name: string; result: unknown } }
  | { event: 'done'; data: { title?: string; model?: string } }
  | { event: 'error'; data: { message: string } }

async function parseJson<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || ''
  if (!res.ok) {
    let errMsg = `요청 실패 (${res.status})`
    if (contentType.includes('application/json')) {
      const body = (await res.json()) as { error?: string }
      if (body?.error) errMsg = friendlyProChatError(body.error)
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

export type ProMemory = {
  id: string
  content: string
  created_at: string
}

export async function fetchProMemories(): Promise<ProMemory[]> {
  const res = await fetchWithAuth(apiUrl('/api/pro-memory'))
  const data = await parseJson<{ items: ProMemory[] }>(res)
  return data.items || []
}

export async function addProMemory(content: string): Promise<ProMemory | null> {
  const res = await fetchWithAuth(apiUrl('/api/pro-memory'), {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
  const data = await parseJson<{ ok: boolean; item: ProMemory | null }>(res)
  return data.item
}

export async function deleteProMemory(id: string): Promise<void> {
  const q = new URLSearchParams({ id })
  const res = await fetchWithAuth(apiUrl(`/api/pro-memory?${q}`), { method: 'DELETE' })
  await parseJson<{ ok: boolean }>(res)
}

/** 레거시 비스트리밍 (유지) */
export async function sendProChatMessage(
  conversationId: string,
  message: string,
): Promise<{ text: string; toolCalls: ProMessage['tool_calls']; title?: string; model?: string }> {
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
  options?: { isRetry?: boolean },
): Promise<void> {
  const res = await fetchWithAuth(apiUrl('/api/pro-chat-stream'), {
    method: 'POST',
    body: JSON.stringify({
      conversationId,
      message,
      isRetry: options?.isRetry === true,
    }),
  })

  const contentType = res.headers.get('content-type') || ''
  if (!res.ok) {
    if (contentType.includes('application/json')) {
      const body = (await res.json()) as { error?: string }
      throw new Error(friendlyProChatError(body?.error || `요청 실패 (${res.status})`))
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
          throw new Error(
            friendlyProChatError(String((ev.data as { message?: string }).message || '스트림 오류')),
          )
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
