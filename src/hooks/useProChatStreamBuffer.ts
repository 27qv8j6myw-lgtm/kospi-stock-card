import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react'
import type { ProMessage } from '@/lib/proChatApi'

/**
 * 스트리밍 텍스트 델타를 rAF 단위로 묶어 setState 빈도 감소
 */
export function useProChatStreamBuffer(setMessages: Dispatch<SetStateAction<ProMessage[]>>) {
  const pendingRef = useRef<Map<string, string>>(new Map())
  const rafRef = useRef<number | null>(null)

  const flush = useCallback(() => {
    rafRef.current = null
    const pending = pendingRef.current
    if (pending.size === 0) return
    const batch = new Map(pending)
    pending.clear()
    setMessages((prev) =>
      prev.map((m) => {
        const delta = batch.get(m.id)
        if (!delta) return m
        return { ...m, content: m.content + delta }
      }),
    )
  }, [setMessages])

  const scheduleFlush = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(flush)
  }, [flush])

  const appendTextDelta = useCallback(
    (msgId: string, delta: string) => {
      if (!delta) return
      pendingRef.current.set(msgId, (pendingRef.current.get(msgId) || '') + delta)
      scheduleFlush()
    },
    [scheduleFlush],
  )

  const flushNow = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    flush()
  }, [flush])

  return { appendTextDelta, flushNow }
}
