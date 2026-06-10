import { useEffect, useRef } from 'react'
import { isKrxMarketOpen } from '@/lib/marketHours'
import { PRO_DATA_POLL_INTERVAL_MS } from '@/lib/proDataRefresh'

type Options = {
  enabled?: boolean
  intervalMs?: number
}

/**
 * 장중·화면 표시 중에만 KIS 시세 폴링 (화면 unmount 시 자동 중지)
 */
export function useKrxDataPolling(refetch: () => void | Promise<void>, options: Options = {}) {
  const { enabled = true, intervalMs = PRO_DATA_POLL_INTERVAL_MS } = options
  const refetchRef = useRef(refetch)
  refetchRef.current = refetch

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const tick = () => {
      if (document.visibilityState !== 'visible') return
      if (!isKrxMarketOpen()) return
      void refetchRef.current()
    }

    tick()
    const id = window.setInterval(tick, intervalMs)
    return () => window.clearInterval(id)
  }, [enabled, intervalMs])
}
