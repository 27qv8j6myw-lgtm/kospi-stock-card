import { useCallback, useEffect, useRef, useState } from 'react'

export type UseAutoRefreshOptions = {
  intervalMs: number
  enabled?: boolean
}

export type UseAutoRefreshResult<T> = {
  data: T | null
  lastUpdated: Date | null
  isFetching: boolean
  error: string | null
  refetch: () => void
}

/**
 * URL을 주기적으로 fetch. 탭 비활성 시 정지, 복귀 시 즉시 1회 + 폴링 재개.
 * React #300 방지: cleanup + cancelled, 의존성은 원시값만, 에러 시 기존 data 유지.
 */
export function useAutoRefresh<T>(
  url: string,
  opts: UseAutoRefreshOptions,
): UseAutoRefreshResult<T> {
  const intervalMs = opts.intervalMs
  const enabled = opts.enabled !== false

  const [data, setData] = useState<T | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const timerRef = useRef<number | null>(null)
  const inFlightRef = useRef(false)
  const prevUrlRef = useRef<string | null>(null)

  const refetch = useCallback(() => {
    setReloadKey((k) => k + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    if (prevUrlRef.current !== url) {
      prevUrlRef.current = url
      setData(null)
      setLastUpdated(null)
      setError(null)
    }

    const stopPolling = () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    const fetchOnce = async () => {
      if (cancelled || inFlightRef.current) return
      inFlightRef.current = true
      if (!cancelled) setIsFetching(true)
      try {
        const res = await fetch(url)
        const text = await res.text()
        let json: unknown = null
        try {
          json = text ? JSON.parse(text) : null
        } catch {
          json = null
        }
        if (!res.ok) {
          const msg =
            json && typeof json === 'object' && json !== null && 'error' in json
              ? String((json as { error: unknown }).error)
              : `HTTP ${res.status}`
          throw new Error(msg)
        }
        if (cancelled) return
        setData(json as T)
        setLastUpdated(new Date())
        setError(null)
      } catch (e) {
        if (cancelled) return
        console.error('[useAutoRefresh]', url, e)
        setError(e instanceof Error ? e.message : 'fetch failed')
      } finally {
        inFlightRef.current = false
        if (!cancelled) setIsFetching(false)
      }
    }

    const startPolling = () => {
      stopPolling()
      if (intervalMs > 0 && enabled) {
        timerRef.current = window.setInterval(() => {
          void fetchOnce()
        }, intervalMs)
      }
    }

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        void fetchOnce()
        startPolling()
      }
    }

    if (!enabled) {
      return () => {
        cancelled = true
        stopPolling()
      }
    }

    if (!cancelled) setIsFetching(true)
    void fetchOnce()
    startPolling()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [url, intervalMs, enabled, reloadKey])

  return { data, lastUpdated, isFetching, error, refetch }
}
