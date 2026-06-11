import { useEffect, useRef } from 'react'
import { isKrxMarketOpen } from '@/lib/marketHours'
import { PRO_DATA_POLL_INTERVAL_MS } from '@/lib/proDataRefresh'

type Options = {
  enabled?: boolean
  intervalMs?: number
  /** true면 장중에만 interval 폴링 (마운트·탭 복귀 1회는 항상 실행) */
  onlyDuringMarketHours?: boolean
}

/**
 * 화면 표시 중 시세 폴링. 마운트·탭 복귀 시 1회는 장마감 후에도 실행(종가 표시).
 * interval 반복은 기본적으로 장중(09:00~15:30)만.
 */
export function useKrxDataPolling(refetch: () => void | Promise<void>, options: Options = {}) {
  const {
    enabled = true,
    intervalMs = PRO_DATA_POLL_INTERVAL_MS,
    onlyDuringMarketHours = true,
  } = options
  const refetchRef = useRef(refetch)
  refetchRef.current = refetch

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const run = (fromInterval: boolean) => {
      if (document.visibilityState !== 'visible') return
      if (fromInterval && onlyDuringMarketHours && !isKrxMarketOpen()) return
      void refetchRef.current()
    }

    run(false)
    const id = window.setInterval(() => run(true), intervalMs)

    const onVisible = () => {
      if (document.visibilityState === 'visible') run(false)
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, intervalMs, onlyDuringMarketHours])
}
