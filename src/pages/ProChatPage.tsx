import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Database, Loader2, Menu, Plus, Send, Sparkles, Trash2 } from 'lucide-react'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import {
  createProConversation,
  deleteProConversation,
  fetchProConversations,
  fetchProMessages,
  sendProChatMessage,
  type ProConversation,
  type ProMessage,
} from '@/lib/proChatApi'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
    if (!conversationId) {
      setMessages([])
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

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
        replace(`/pro/chat/${cId}`)
      }

      const userMsg: ProMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: text,
      }
      setMessages((prev) => [...prev, userMsg])
      setInput('')
      setLoading(true)

      const data = await sendProChatMessage(cId, text)

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.text,
          tool_calls: data.toolCalls ?? undefined,
        },
      ])

      const updatedAt = new Date().toISOString()
      setConversations((prev) =>
        sortConversations(
          prev.map((c) =>
            c.id === cId
              ? {
                  ...c,
                  ...(data.title ? { title: data.title } : {}),
                  updated_at: updatedAt,
                }
              : c,
          ),
        ),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [conversationId, input, loading, replace])

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

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 md:hidden">
          <button type="button" onClick={() => setSidebarOpen(true)} className="p-1.5" aria-label="메뉴">
            <Menu size={18} />
          </button>
          <div className="text-[13px] font-semibold">매매 어시스턴트</div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
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
                      <div className="mb-2 space-y-1">
                        {msg.tool_calls.map((tc, i) => (
                          <div
                            key={`${tc.name}-${i}`}
                            className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] text-amber-800"
                          >
                            <Database size={10} />
                            <span className="font-mono">{tc.name}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="whitespace-pre-wrap rounded-2xl rounded-tl-md bg-gray-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-gray-900">
                      {msg.content}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading ? (
              <div className="flex items-center gap-2 px-3 text-[12px] text-gray-500">
                <Loader2 size={14} className="animate-spin" />
                <span>데이터 조회 중...</span>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>
        </div>

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
