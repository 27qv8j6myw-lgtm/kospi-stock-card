'use client'

import { memo } from 'react'
import { Check, Cpu, Database, Loader2 } from 'lucide-react'
import { MarkdownMessage } from '@/components/chat/MarkdownMessage'
import { ProChatStockLinks } from '@/components/pro/ProChatStockLinks'
import { formatModelLabel } from '@/lib/claudeModelDisplay'
import type { ProMessage, ProToolCallUi } from '@/lib/proChatApi'

function groupToolCalls(toolCalls: ProToolCallUi[]) {
  const grouped: { name: string; count: number }[] = []
  for (const tc of toolCalls) {
    const existing = grouped.find((g) => g.name === tc.name)
    if (existing) existing.count += 1
    else grouped.push({ name: tc.name, count: 1 })
  }
  return grouped
}

const ToolCallsPanel = memo(function ToolCallsPanel({
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
                {executing &&
                toolCalls.some((t) => t.name === group.name && t.status === 'executing') ? (
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
})

function toolCallsEqual(
  a: ProToolCallUi[] | null | undefined,
  b: ProToolCallUi[] | null | undefined,
): boolean {
  if (a === b) return true
  const aa = a ?? []
  const bb = b ?? []
  if (aa.length !== bb.length) return false
  for (let i = 0; i < aa.length; i++) {
    if (aa[i].name !== bb[i].name || aa[i].status !== bb[i].status) return false
    if (aa[i].result !== bb[i].result) return false
  }
  return true
}

type Props = {
  msg: ProMessage
  expandedTools: boolean
  onToggleTools: (id: string) => void
  showModel?: boolean
}

export const ProChatMessageItem = memo(
  function ProChatMessageItem({ msg, expandedTools, onToggleTools, showModel = false }: Props) {
    if (
      msg.role === 'assistant' &&
      !msg.streaming &&
      !msg.content.trim() &&
      !(msg.tool_calls && msg.tool_calls.length > 0)
    ) {
      return null
    }

    if (msg.role === 'user') {
      return (
        <div className="flex justify-end">
          <div className="max-w-[80%] min-w-0 break-words whitespace-pre-wrap rounded-2xl rounded-br-md bg-gray-900 px-3.5 py-2 text-[13px] leading-relaxed text-white">
            {msg.content}
          </div>
        </div>
      )
    }

    return (
      <div className="max-w-[90%] min-w-0">
        {msg.tool_calls && msg.tool_calls.length > 0 ? (
          <ToolCallsPanel
            msgId={msg.id}
            toolCalls={msg.tool_calls}
            expanded={expandedTools}
            onToggle={onToggleTools}
          />
        ) : null}
        <div className="min-w-0 overflow-hidden rounded-2xl rounded-tl-md bg-gray-50 px-3.5 py-2.5">
          <MarkdownMessage content={msg.content} />
          {msg.streaming ? (
            <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-gray-900 align-middle" />
          ) : null}
          {!msg.streaming ? <ProChatStockLinks toolCalls={msg.tool_calls} /> : null}
        </div>
        {showModel && !msg.streaming && msg.model ? (
          <div className="mt-1 flex items-center gap-1 pl-1 text-[10px] text-gray-400">
            <Cpu size={10} className="text-gray-400" />
            <span className="font-medium">{formatModelLabel(msg.model)}</span>
          </div>
        ) : null}
      </div>
    )
  },
  (prev, next) =>
    prev.msg.id === next.msg.id &&
    prev.msg.role === next.msg.role &&
    prev.msg.content === next.msg.content &&
    prev.msg.streaming === next.msg.streaming &&
    prev.msg.model === next.msg.model &&
    prev.showModel === next.showModel &&
    prev.expandedTools === next.expandedTools &&
    toolCallsEqual(prev.msg.tool_calls, next.msg.tool_calls),
)
