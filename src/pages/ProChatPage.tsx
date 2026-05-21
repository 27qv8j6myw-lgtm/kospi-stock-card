import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Database, Loader2, Menu, Plus, Send, Sparkles, Trash2 } from 'lucide-react'
import { MarkdownMessage } from '@/components/chat/MarkdownMessage'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import {
  createProConversation,
  deleteProConversation,
  fetchProConversations,
  fetchProMessages,
  streamProChatMessage,
  type ProConversation,
  type ProMessage,
  type ProStreamEvent,
  type ProToolCallUi,
} from '@/lib/proChatApi'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type StockMention = { name: string; code: string }

function detectStockMentions(text: string): StockMention[] {
  const mentions: StockMention[] = []
  const seen = new Set<string>()

  const pattern1 = /([가-힣A-Za-z][가-힣A-Za-z0-9\s]{0,20})\s*\(?(\d{6})\)?/g
  let match: RegExpExecArray | null
  while ((match = pattern1.exec(text)) !== null) {
    const code = match[2]
    if (seen.has(code)) continue
    seen.add(code)
    mentions.push({ name: match[1].trim(), code })
  }

  const bareCodes = text.match(/\b(\d{6})\b/g)
  if (bareCodes) {
    for (const code of bareCodes) {
      if (seen.has(code)) continue
      seen.add(code)
      mentions.push({ name: code, code })
    }
  }

  return mentions
}

function parseConversationId(pathname: string): string | undefined {
  const m = pathname.match(/^\/pro\/chat\/([0-9a-f-]{36})\/?$/i)
  const id = m?.[1]
  return id && UUID_RE.test(id) ? id : undefined
}

function sortConversations(list: ProConversation[]): ProConversation[] {
  return [...list].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )
}

function groupToolCalls(toolCalls: ProToolCallUi[]) {
  const grouped: { name: string; count: number }[] = []
  for (const tc of toolCalls) {
    const existing = grouped.find((g) => g.name === tc.name)
    if (existing) existing.count += 1
    else grouped.push({ name: tc.name, count: 1 })
  }
  return grouped
}

function ToolCallsPanel({
  msgId,
  toolCalls,
  expanded,
  onToggle,
}: {
  msgId: string
  toolCalls: ProToolCallUi[]
  expanded: boolean
  onToggle: (id: string) => void
}) {
  const executing = toolCalls.some((tc) => tc.status === 'executing')
  const label = executing ? '데이터 조회 중' : '데이터 조회 완료'

  return (
    <div className="mb-2 overflow-hidden rounded-xl border border-amber-200 bg-amber-50">
      <button
        type="button"
        onClick={() => onToggle(msgId)}
        className="flex w-full items-center justify-between px-3 py-2 transition-colors hover:bg-amber-100"
      >
        <div className="flex items-center gap-2">
          {executing ? (
            <Loader2 size={11} className="animate-spin text-amber-700" />
          ) : (
            <Database size={11} className="text-amber-700" />
          )}
          <span className="text-[11px] font-semibold text-amber-800">{label}</span>
          <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
            {toolCalls.length}
          </span>
        </div>
        <span className="text-[10px] text-amber-700">{expanded ? '접기 ▲' : '자세히 ▼'}</span>
      </button>

      {expanded ? (
        <div className="space-y-1 border-t border-amber-200 px-2 pb-2">
          {groupToolCalls(toolCalls).map((group) => (
            <div
              key={group.name}
              className="flex items-center gap-2 rounded bg-white px-2 py-1"
            >
              <div className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full bg-green-500">
                {executing && toolCalls.some((t) => t.name === group.name && t.status === 'executing') ? (
                  <Loader2 size={9} className="animate-spin text-white" />
                ) : (
                  <Check size={9} className="text-white" strokeWidth={3} />
                )}
              </div>
              <span className="flex-1 font-mono text-[10px] font-semibold text-gray-900">
                {group.name}
                {group.count > 1 ? ` × ${group.count}` : ''}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function ProChatPage() {
  const { pathname, navigate, replace } = useAppNavigation()
  const conversationId = useMemo(() => parseConversationId(pathname), [pathname])

  const [conversations, setConversations] = useState<ProConversation[]>([])
  const [messages, setMessages] = useState<ProMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const suppressFetchRef = useRef<string | null>(null)
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({})

  const toggleTools = useCallback((msgId: string) => {
    setExpandedTools((prev) => ({ ...prev, [msgId]: !prev[msgId] }))
  }, [])

  const loadConversations = useCallback(async () => {
    try {
      const list = await fetchProConversations()
      setConversations(sortConversations(list))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stock = new URLSearchParams(window.location.search).get('stock')
    if (stock && /^\d{6}$/.test(stock)) {
      setInput((prev) => (prev.trim() ? prev : `${stock} 종합 분석`))
    }
  }, [pathname])

  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      return
    }

    if (suppressFetchRef.current === conversationId) {
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const list = await fetchProMessages(conversationId)
        if (!cancelled) setMessages(list)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [conversationId])

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
    setAutoScroll(atBottom)
  }, [])

  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, autoScroll])

  const newConversation = useCallback(async () => {
    setError(null)
    try {
      const conv = await createProConversation()
      setConversations((prev) => sortConversations([conv, ...prev]))
      navigate(`/pro/chat/${conv.id}`)
      setSidebarOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [navigate])

  const deleteConv = useCallback(
    async (id: string) => {
      if (!confirm('이 대화를 삭제하시겠습니까?')) return
      setError(null)
      try {
        await deleteProConversation(id)
        setConversations((prev) => prev.filter((c) => c.id !== id))
        if (conversationId === id) {
          navigate('/pro/chat')
          setMessages([])
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [conversationId, navigate],
  )

  const handleStreamEvent = useCallback(
    (aiMsgId: string, cId: string, ev: ProStreamEvent) => {
      if (ev.event === 'text') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, content: m.content + ev.data.delta } : m,
          ),
        )
      } else if (ev.event === 'tool_start') {
        setExpandedTools((prev) => ({ ...prev, [aiMsgId]: true }))
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== aiMsgId) return m
            const existing = m.tool_calls || []
            return {
              ...m,
              tool_calls: [...existing, { name: ev.data.name, status: 'executing' as const }],
            }
          }),
        )
      } else if (ev.event === 'tool_result') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  tool_calls: (m.tool_calls || []).map((tc) =>
                    tc.name === ev.data.name && tc.status === 'executing'
                      ? { ...tc, status: 'done' as const, result: ev.data.result }
                      : tc,
                  ),
                }
              : m,
          ),
        )
      } else if (ev.event === 'done') {
        setExpandedTools((prev) => ({ ...prev, [aiMsgId]: false }))
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, streaming: false } : m)),
        )
        if (ev.data.title) {
          const updatedAt = new Date().toISOString()
          setConversations((prev) =>
            sortConversations(
              prev.map((c) =>
                c.id === cId ? { ...c, title: ev.data.title!, updated_at: updatedAt } : c,
              ),
            ),
          )
        }
      }
    },
    [],
  )

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    setError(null)
    let cId = conversationId

    try {
      if (!cId) {
        const conv = await createProConversation()
        cId = conv.id
        setConversations((prev) => sortConversations([conv, ...prev]))
        suppressFetchRef.current = cId
        replace(`/pro/chat/${cId}`)
      } else {
        suppressFetchRef.current = cId
      }

      const messageText = text
      setInput('')
      setLoading(true)
      setAutoScroll(true)

      const userMsg: ProMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: messageText,
      }
      const aiMsgId = `ai-${Date.now()}`

      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: aiMsgId,
          role: 'assistant',
          content: '',
          tool_calls: [],
          streaming: true,
        },
      ])

      await streamProChatMessage(cId, messageText, (ev) =>
        handleStreamEvent(aiMsgId, cId!, ev),
      )

      const list = await fetchProMessages(cId)
      setMessages(list)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setMessages((prev) =>
        prev.map((m) =>
          m.streaming
            ? { ...m, content: `${m.content}\n\n[오류: ${msg}]`, streaming: false }
            : m,
        ),
      )
    } finally {
      suppressFetchRef.current = null
      setLoading(false)
      setMessages((prev) => prev.map((m) => ({ ...m, streaming: false })))
    }
  }, [conversationId, handleStreamEvent, input, loading, replace])

  return (
    <div className="fixed inset-x-0 bottom-0 top-[56px] z-10 flex bg-white">
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } fixed z-20 h-full w-64 overflow-y-auto border-r border-gray-200 bg-gray-50 p-3 transition-transform md:relative md:w-60`}
      >
        <button
          type="button"
          onClick={() => void newConversation()}
          className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-[12px] font-semibold text-white hover:bg-gray-800"
        >
          <Plus size={12} strokeWidth={2.5} />
          <span>새 대화</span>
        </button>

        {listLoading ? (
          <div className="flex justify-center py-6 text-gray-400">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-0.5">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  navigate(`/pro/chat/${conv.id}`)
                  setSidebarOpen(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/pro/chat/${conv.id}`)
                    setSidebarOpen(false)
                  }
                }}
                className={`group flex cursor-pointer items-start justify-between gap-2 rounded-lg px-3 py-2 ${
                  conversationId === conv.id
                    ? 'bg-amber-100 text-gray-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium">{conv.title}</div>
                  <div className="mt-0.5 text-[10px] text-gray-400">
                    {new Date(conv.updated_at).toLocaleDateString('ko-KR')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void deleteConv(conv.id)
                  }}
                  className="text-gray-400 opacity-0 hover:text-red-500 group-hover:opacity-100"
                  aria-label="대화 삭제"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            {conversations.length === 0 && (
              <div className="py-8 text-center text-[11px] text-gray-400">대화가 없습니다</div>
            )}
          </div>
        )}
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 md:hidden">
          <button type="button" onClick={() => setSidebarOpen(true)} className="p-1.5" aria-label="메뉴">
            <Menu size={18} />
          </button>
          <div className="text-[13px] font-semibold">매매 어시스턴트</div>
        </div>

        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-4"
        >
          {messages.length === 0 && !loading && (
            <div className="py-16 text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600">
                <Sparkles size={20} className="text-white" />
              </div>
              <div className="mb-2 text-[14px] font-semibold text-gray-900">매매 어시스턴트</div>
              <div className="text-[12px] leading-relaxed text-gray-500">
                실시간 KIS 데이터로 분석
                <br />
                무엇이든 물어보세요
              </div>
            </div>
          )}

          <div className="mx-auto max-w-[700px] space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : ''}>
                {msg.role === 'user' ? (
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gray-900 px-3.5 py-2 text-[13px] leading-relaxed text-white">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[90%]">
                    {msg.tool_calls && msg.tool_calls.length > 0 ? (
                      <ToolCallsPanel
                        msgId={msg.id}
                        toolCalls={msg.tool_calls}
                        expanded={Boolean(expandedTools[msg.id])}
                        onToggle={toggleTools}
                      />
                    ) : null}
                    <div className="rounded-2xl rounded-tl-md bg-gray-50 px-3.5 py-2.5">
                      <MarkdownMessage content={msg.content} />
                      {msg.streaming ? (
                        <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-gray-900 align-middle" />
                      ) : null}
                      {!msg.streaming && detectStockMentions(msg.content).length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {detectStockMentions(msg.content)
                            .slice(0, 3)
                            .map((m) => (
                              <button
                                key={m.code}
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/pro/stock/${m.code}?name=${encodeURIComponent(m.name)}`,
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 py-1 text-[10px] font-semibold text-amber-800 hover:border-amber-500"
                              >
                                <span>{m.name}</span>
                                <span className="text-gray-500">({m.code})</span>
                                <ArrowRight size={11} />
                              </button>
                            ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && !messages.some((m) => m.streaming) ? (
              <div className="flex items-center gap-2 px-3 text-[12px] text-gray-500">
                <Loader2 size={14} className="animate-spin" />
                <span>연결 중...</span>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {!autoScroll ? (
          <button
            type="button"
            onClick={() => {
              setAutoScroll(true)
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="absolute bottom-20 right-4 z-10 flex size-9 items-center justify-center rounded-full bg-gray-900 text-sm text-white shadow-lg"
            aria-label="최신 메시지로"
          >
            ↓
          </button>
        ) : null}

        {error ? (
          <p className="shrink-0 px-4 pb-1 text-[12px] text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="border-t border-gray-200 p-3">
          <form
            className="mx-auto flex max-w-[700px] items-center gap-2 rounded-2xl border border-gray-300 bg-white px-2 py-1"
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="질문하세요..."
              className="flex-1 px-2 py-2 text-[13px] outline-none"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex size-8 items-center justify-center rounded-xl bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40"
              aria-label="전송"
            >
              <Send size={13} strokeWidth={2} />
            </button>
          </form>
        </div>
      </main>

      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-10 bg-black/40 md:hidden"
          aria-label="사이드바 닫기"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
    </div>
  )
}
