'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, RefreshCw, Send } from 'lucide-react'
import { ProProfileSetupHint } from '@/components/pro/ProProfileSetupHint'
import { scheduleProChatLayoutReset } from '@/hooks/useProChatViewportHeight'
import type { ProChatErrorType } from '@/lib/friendlyAnthropicError'

type ChatErrorState = {
  type: ProChatErrorType
  lastMessage: string
}

type Props = {
  loading: boolean
  chatError: ChatErrorState | null
  seedQuery?: string | null
  onSend: (text: string) => void | Promise<void>
  onRetry: (message: string) => void | Promise<void>
}

export const ProChatComposer = memo(function ProChatComposer({
  loading,
  chatError,
  seedQuery = null,
  onSend,
  onRetry,
}: Props) {
  const [input, setInput] = useState('')
  const barRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  const syncComposerHeight = useCallback(() => {
    const bar = barRef.current
    if (!bar) return
    document.documentElement.style.setProperty('--pro-chat-composer-height', `${bar.offsetHeight}px`)
  }, [])

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const ro = new ResizeObserver(() => syncComposerHeight())
    ro.observe(bar)
    syncComposerHeight()
    return () => ro.disconnect()
  }, [syncComposerHeight, chatError])

  useEffect(() => {
    if (!seedQuery) return
    setInput((prev) => (prev.trim() ? prev : seedQuery))
  }, [seedQuery])

  const submit = useCallback(() => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    if (fieldRef.current) {
      fieldRef.current.style.height = 'auto'
    }
    fieldRef.current?.blur()
    scheduleProChatLayoutReset()
    void onSend(text)
  }, [input, loading, onSend])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }, [])

  return (
    <div
      ref={barRef}
      className="pro-chat-composer-bar flex-shrink-0 border-t border-gray-200 bg-white px-3 pt-1.5 md:px-3 md:py-1.5 md:pb-1.5"
    >
      {chatError ? (
        <div
          className="mx-auto mb-3 max-w-[700px] rounded-xl border border-red-100 bg-red-50 p-4"
          role="alert"
        >
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-400" />
            <div className="flex-1">
              <div className="text-[13px] text-gray-700">
                {chatError.type === 'overloaded'
                  ? 'AI 서버가 일시적으로 혼잡합니다.'
                  : '응답 중 오류가 발생했습니다.'}
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => void onRetry(chatError.lastMessage)}
                className="mt-2 flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-gray-800 disabled:opacity-50"
              >
                <RefreshCw size={12} />
                다시 시도
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ProProfileSetupHint className="mx-auto mb-2 max-w-[700px]" />

      <div
        className="mx-auto flex max-w-[700px] items-end gap-2 rounded-2xl border border-gray-300 bg-white px-2 py-1 md:py-0.5"
        role="group"
        aria-label="메시지 입력"
      >
        <textarea
          ref={fieldRef}
          rows={1}
          value={input}
          onChange={handleChange}
          onBlur={() => scheduleProChatLayoutReset()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="질문하세요..."
          enterKeyHint="send"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          name="signai-pro-chat-message"
          id="signai-pro-chat-message"
          data-1p-ignore="true"
          data-lpignore="true"
          data-form-type="other"
          className="max-h-[120px] min-h-[2.5rem] flex-1 resize-none px-2 py-2 text-base leading-snug outline-none md:min-h-0 md:py-1.5 md:text-[13px]"
          disabled={loading}
        />
        <button
          type="button"
          disabled={loading || !input.trim()}
          onClick={submit}
          className="mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40"
          aria-label="전송"
        >
          <Send size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
})
