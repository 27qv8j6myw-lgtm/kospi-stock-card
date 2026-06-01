import { useEffect, useRef } from 'react'
import { PRO_DATA_REFRESH_MIN_INTERVAL_MS } from '@/lib/proDataRefresh'

type Options = {
  enabled?: boolean
  minIntervalMs?: number
}

/**
 * 탭/앱 복귀 시 데이터 갱신 (마지막 갱신 후 minIntervalMs 이내는 스킵)
 */
export function useVisibilityDataRefresh(
  refetch: () => void | Promise<void>,
  options: Options = {},
) {
  const { enabled = true, minIntervalMs = PRO_DATA_REFRESH_MIN_INTERVAL_MS } = options
  const lastAtRef = useRef(0)
  const refetchRef = useRef(refetch)
  refetchRef.current = refetch

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (lastAtRef.current > 0 && now - lastAtRef.current < minIntervalMs) return
      lastAtRef.current = now
      void refetchRef.current()
    }

    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [enabled, minIntervalMs])
}
