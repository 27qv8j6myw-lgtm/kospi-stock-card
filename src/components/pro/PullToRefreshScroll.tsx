'use client'

import { useRef, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import {
  PRO_PULL_REFRESH_THRESHOLD_PX,
} from '@/lib/proDataRefresh'

type Props = {
  children: ReactNode
  onRefresh: () => void | Promise<void>
  className?: string
}

export function PullToRefreshScroll({
  children,
  onRefresh,
  className = '',
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const { pullDistance, refreshing, touchHandlers } = usePullToRefresh({
    onRefresh,
    getScrollTop: () => scrollRef.current?.scrollTop ?? 0,
    enabled: true,
  })

  return (
    <div
      ref={scrollRef}
      className={`overscroll-y-contain ${className}`}
      {...touchHandlers}
    >
      <div
        className="flex items-center justify-center overflow-hidden text-[11px] text-gray-400 transition-[height]"
        style={{ height: pullDistance > 0 || refreshing ? Math.max(pullDistance, refreshing ? 32 : 0) : 0 }}
        aria-live="polite"
      >
        {refreshing ? (
          <Loader2 className="size-5 animate-spin text-amber-500" aria-hidden />
        ) : pullDistance > PRO_PULL_REFRESH_THRESHOLD_PX ? (
          '놓으면 새로고침'
        ) : pullDistance > 8 ? (
          '당겨서 새로고침'
        ) : null}
      </div>
      {children}
    </div>
  )
}
