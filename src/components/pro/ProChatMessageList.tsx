'use client'

import { memo, type RefObject } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { ProChatMessageItem } from '@/components/pro/ProChatMessageItem'
import type { ProMessage } from '@/lib/proChatApi'

type Props = {
  messages: ProMessage[]
  loading: boolean
  expandedTools: Record<string, boolean>
  onToggleTools: (id: string) => void
  messagesEndRef: RefObject<HTMLDivElement | null>
  showModel?: boolean
}

export const ProChatMessageList = memo(function ProChatMessageList({
  messages,
  loading,
  expandedTools,
  onToggleTools,
  messagesEndRef,
  showModel = false,
}: Props) {
  return (
    <>
      {messages.length === 0 && !loading ? (
        <div className="shrink-0 pt-10 pb-4 text-center md:py-16">
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
      ) : null}

      <div
        className={`mx-auto w-full min-w-0 max-w-[700px] space-y-4 ${
          messages.length > 0 ? 'mt-auto' : ''
        }`}
      >
        {messages.map((msg) => (
          <ProChatMessageItem
            key={msg.id}
            msg={msg}
            expandedTools={Boolean(expandedTools[msg.id])}
            onToggleTools={onToggleTools}
            showModel={showModel}
          />
        ))}

        {loading && !messages.some((m) => m.streaming) ? (
          <div className="flex items-center gap-2 px-3 text-[12px] text-gray-500">
            <Loader2 size={14} className="animate-spin" />
            <span>연결 중...</span>
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>
    </>
  )
})
