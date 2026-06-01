import { useCallback, useRef, useState } from 'react'
import {
  PRO_PULL_REFRESH_MAX_PX,
  PRO_PULL_REFRESH_THRESHOLD_PX,
} from '@/lib/proDataRefresh'

type Options = {
  onRefresh: () => void | Promise<void>
  getScrollTop: () => number
  enabled?: boolean
}

export function usePullToRefresh({ onRefresh, getScrollTop, enabled = true }: Options) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startYRef = useRef(-1)
  const pullDistanceRef = useRef(0)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return
      if (getScrollTop() > 0) {
        startYRef.current = -1
        return
      }
      startYRef.current = e.touches[0]?.clientY ?? -1
    },
    [enabled, getScrollTop],
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || startYRef.current < 0) return
      const y = e.touches[0]?.clientY ?? startYRef.current
      const dy = y - startYRef.current
      if (dy > 0) {
        const next = Math.min(dy, PRO_PULL_REFRESH_MAX_PX)
        pullDistanceRef.current = next
        setPullDistance(next)
      }
    },
    [enabled],
  )

  const onTouchEnd = useCallback(async () => {
    if (!enabled || startYRef.current < 0) return
    const distance = pullDistanceRef.current
    startYRef.current = -1

    if (distance > PRO_PULL_REFRESH_THRESHOLD_PX) {
      setRefreshing(true)
      try {
        await onRefreshRef.current()
      } finally {
        setRefreshing(false)
      }
    }
    pullDistanceRef.current = 0
    setPullDistance(0)
  }, [enabled])

  const onTouchCancel = useCallback(() => {
    startYRef.current = -1
    pullDistanceRef.current = 0
    setPullDistance(0)
  }, [])

  return {
    pullDistance,
    refreshing,
    touchHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel,
    },
  }
}
