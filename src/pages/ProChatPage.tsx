import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Loader2, Menu, Plus, Trash2 } from 'lucide-react'
import { ProChatComposer } from '@/components/pro/ProChatComposer'
import { ProChatMessageList } from '@/components/pro/ProChatMessageList'
import { UserMenu } from '@/components/portfolio/UserMenu'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { useProChatStreamBuffer } from '@/hooks/useProChatStreamBuffer'
import { useProChatViewportHeight } from '@/hooks/useProChatViewportHeight'
import { classifyProChatError, type ProChatErrorType } from '@/lib/friendlyAnthropicError'
import {
  createProConversation,
  deleteProConversation,
  fetchProConversations,
  fetchProMessages,
  streamProChatMessage,
  type ProConversation,
  type ProMessage,
  type ProStreamEvent,
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

type ChatErrorState = {
  type: ProChatErrorType
  lastMessage: string
}

export default function ProChatPage() {
  const { pathname, navigate, replace } = useAppNavigation()
  const conversationId = useMemo(() => parseConversationId(pathname), [pathname])

  useProChatViewportHeight(true)

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.classList.add('pro-chat-active')
    return () => {
      document.documentElement.classList.remove('pro-chat-active')
      document.documentElement.classList.remove('pro-chat-kb-open')
      document.documentElement.style.removeProperty('--pro-chat-kb-bottom')
      document.documentElement.style.removeProperty('--pro-chat-app-height')
      document.documentElement.style.removeProperty('--pro-chat-composer-height')
    }
  }, [])

  const goBack = useCallback(() => {
    replace('/pro')
  }, [replace])

  const [conversations, setConversations] = useState<ProConversation[]>([])
  const [messages, setMessages] = useState<ProMessage[]>([])
  const [loading, setLoading] = useState(false)
  const { appendTextDelta, flushNow } = useProChatStreamBuffer(setMessages)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [chatError, setChatError] = useState<ChatErrorState | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const suppressFetchRef = useRef<string | null>(null)
  const scrollRafRef = useRef<number | null>(null)
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({})

  const toggleTools = useCallback((msgId: string) => {
    setExpandedTools((prev) => ({ ...prev, [msgId]: !prev[msgId] }))
  }, [])

  const loadConversations = useCallback(async () => {
    try {
      const list = await fetchProConversations()
      setConversations(sortConversations(list))
    } catch (e) {
      setPageError(e instanceof Error ? e.message : String(e))
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  const seedQuery = useMemo(() => {
    if (typeof window === 'undefined') return null
    const stock = new URLSearchParams(window.location.search).get('stock')
    return stock && /^\d{6}$/.test(stock) ? `${stock} 종합 분석` : null
  }, [pathname])

  useEffect(() => {
    setChatError(null)
  }, [conversationId])

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
        if (!cancelled) setPageError(e instanceof Error ? e.message : String(e))
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

  const scrollTick = useMemo(() => {
    const last = messages[messages.length - 1]
    return `${messages.length}:${last?.id ?? ''}:${last?.content?.length ?? 0}:${Boolean(last?.streaming)}`
  }, [messages])

  useEffect(() => {
    if (!autoScroll) return
    const container = messagesContainerRef.current
    if (!container) return
    if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current)
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null
      container.scrollTop = container.scrollHeight
    })
    return () => {
      if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current)
    }
  }, [scrollTick, autoScroll])

  const newConversation = useCallback(async () => {
    setPageError(null)
    setChatError(null)
    try {
      const conv = await createProConversation()
      setConversations((prev) => sortConversations([conv, ...prev]))
      navigate(`/pro/chat/${conv.id}`)
      setSidebarOpen(false)
    } catch (e) {
      setPageError(e instanceof Error ? e.message : String(e))
    }
  }, [navigate])

  const deleteConv = useCallback(
    async (id: string) => {
      if (!confirm('이 대화를 삭제하시겠습니까?')) return
      setPageError(null)
      try {
        await deleteProConversation(id)
        setConversations((prev) => prev.filter((c) => c.id !== id))
        if (conversationId === id) {
          navigate('/pro/chat')
          setMessages([])
          setChatError(null)
        }
      } catch (e) {
        setPageError(e instanceof Error ? e.message : String(e))
      }
    },
    [conversationId, navigate],
  )

  const handleStreamEvent = useCallback(
    (aiMsgId: string, cId: string, ev: ProStreamEvent) => {
      if (ev.event === 'text') {
        appendTextDelta(aiMsgId, ev.data.delta)
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
      } else if (ev.event === 'tool_executing') {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== aiMsgId) return m
            let matched = false
            return {
              ...m,
              tool_calls: (m.tool_calls || []).map((tc) => {
                if (
                  !matched &&
                  tc.name === ev.data.name &&
                  tc.status === 'executing' &&
                  !tc.input
                ) {
                  matched = true
                  return { ...tc, input: ev.data.input }
                }
                return tc
              }),
            }
          }),
        )
      } else if (ev.event === 'tool_result') {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== aiMsgId) return m
            let matched = false
            return {
              ...m,
              tool_calls: (m.tool_calls || []).map((tc) => {
                if (!matched && tc.name === ev.data.name && tc.status === 'executing') {
                  matched = true
                  return { ...tc, status: 'done' as const, result: ev.data.result }
                }
                return tc
              }),
            }
          }),
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
    [appendTextDelta],
  )

  const sendMessage = useCallback(
    async (messageText: string, options?: { isRetry?: boolean }) => {
      const text = messageText.trim()
      if (!text || loading) return

      setChatError(null)
      let cId = conversationId
      const isRetry = options?.isRetry === true
      const aiMsgId = `ai-${Date.now()}`

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

        setLoading(true)
        setAutoScroll(true)

        if (!isRetry) {
          const userMsg: ProMessage = {
            id: `temp-${Date.now()}`,
            role: 'user',
            content: text,
          }
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
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: aiMsgId,
              role: 'assistant',
              content: '',
              tool_calls: [],
              streaming: true,
            },
          ])
        }

        await streamProChatMessage(
          cId,
          text,
          (ev) => handleStreamEvent(aiMsgId, cId!, ev),
          { isRetry },
        )

        flushNow()
        const list = await fetchProMessages(cId)
        setMessages(list)
      } catch (e) {
        flushNow()
        const raw = e instanceof Error ? e.message : String(e)
        setChatError({
          type: classifyProChatError(raw),
          lastMessage: text,
        })
        setMessages((prev) => prev.filter((m) => m.id !== aiMsgId))
      } finally {
        suppressFetchRef.current = null
        setLoading(false)
        setMessages((prev) => prev.map((m) => ({ ...m, streaming: false })))
      }
    },
    [conversationId, flushNow, handleStreamEvent, loading, replace],
  )

  const retryLastMessage = useCallback(
    async (message: string) => {
      setChatError(null)
      await sendMessage(message, { isRetry: true })
    },
    [sendMessage],
  )

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white md:bg-gray-50">
      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-[1200px] flex-1 overflow-hidden">
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full max-md:pointer-events-none md:translate-x-0'
        } absolute inset-y-0 left-0 z-30 w-64 overflow-y-auto border-r border-gray-200 bg-gray-50 px-3 pb-3 pt-3 transition-transform max-md:pt-[calc(0.75rem+env(safe-area-inset-top,0px))] md:relative md:z-auto md:w-60 md:p-3`}
      >
        <div className="mb-3 flex items-center gap-2 border-b border-gray-200 pb-3">
          <button
            type="button"
            onClick={goBack}
            className="rounded-lg p-1.5 hover:bg-gray-200"
            aria-label="Pro 홈"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <span className="text-[14px] font-bold text-gray-900">AI 채팅</span>
        </div>

        <button
          type="button"
          onClick={() => void newConversation()}
          className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-[12px] font-semibold text-white hover:bg-gray-800"
        >
          <Plus size={12} strokeWidth={2.5} />
          <span>새 대화</span>
        </button>

        {pageError ? (
          <p className="mb-3 px-1 text-[11px] text-red-600" role="alert">
            {pageError}
          </p>
        ) : null}

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

      <main className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 pb-1.5 pt-[max(0.25rem,env(safe-area-inset-top))] md:hidden">
          <button
            type="button"
            onClick={goBack}
            className="rounded-lg p-1.5 hover:bg-gray-100"
            aria-label="Pro 홈"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <button type="button" onClick={() => setSidebarOpen(true)} className="p-1.5" aria-label="메뉴">
            <Menu size={18} />
          </button>
          <div className="min-w-0 flex-1 truncate text-[13px] font-semibold text-gray-900">
            AI 채팅
          </div>
          <UserMenu />
        </div>

        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="pro-chat-messages-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-gray-50 px-4 py-2 md:py-3"
        >
          <ProChatMessageList
            messages={messages}
            loading={loading}
            expandedTools={expandedTools}
            onToggleTools={toggleTools}
            messagesEndRef={messagesEndRef}
          />
        </div>

        {!autoScroll ? (
          <button
            type="button"
            onClick={() => {
              setAutoScroll(true)
              const el = messagesContainerRef.current
              if (el) el.scrollTop = el.scrollHeight
            }}
            className="absolute left-4 z-10 flex size-9 items-center justify-center rounded-full bg-gray-900 text-sm text-white shadow-lg max-md:bottom-[calc(var(--pro-chat-composer-height,5rem)+var(--pro-chat-kb-offset,0px)+0.75rem)] md:bottom-20"
            aria-label="최신 메시지로"
          >
            ↓
          </button>
        ) : null}

        <ProChatComposer
          loading={loading}
          chatError={chatError}
          seedQuery={seedQuery}
          onSend={sendMessage}
          onRetry={retryLastMessage}
        />
      </main>

      {sidebarOpen ? (
        <button
          type="button"
          className="absolute inset-0 z-20 bg-black/40 md:hidden"
          aria-label="사이드바 닫기"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      </div>
    </div>
  )
}
