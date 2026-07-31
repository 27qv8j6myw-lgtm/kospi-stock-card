import { useMemo } from 'react'
import { IntradayChartView } from '@/components/stock/chart/IntradayChartView'
import { apiUrl } from '@/lib/apiBase'
import type { IntradayChartApiResponse, IntradaySeriesPoint } from '@/types/intradayChart'
import type { IntradayInterval } from '@/hooks/useKisChart'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'

const POLL_MS = 60_000
const EMPTY_SERIES: IntradaySeriesPoint[] = []

function exchangeSuffixFromMarket(market?: string | null): 'KS' | 'KQ' {
  const m = String(market ?? '').toUpperCase()
  if (m.includes('KOSDAQ') || m.includes('코스닥')) return 'KQ'
  return 'KS'
}

export type IntradayChartBodyProps = {
  code: string
  market?: string | null
  interval?: IntradayInterval
  className?: string
  compact?: boolean
}

/** Pro 차트 탭의 "당일" — 데이터만 물어오고 그림은 IntradayChartView 가 그린다 */
export function IntradayChartBody({
  code,
  market,
  interval = '5m',
  className = '',
  compact = false,
}: IntradayChartBodyProps) {
  const suffix = exchangeSuffixFromMarket(market)

  const normalizedCode = useMemo(() => String(code).replace(/\D/g, '').padStart(6, '0'), [code])

  const url = useMemo(() => {
    const base = apiUrl('/api/intraday-chart')
    return `${base}?code=${encodeURIComponent(normalizedCode)}&interval=${encodeURIComponent(interval)}&suffix=${encodeURIComponent(suffix)}`
  }, [normalizedCode, interval, suffix])

  const {
    data: intraday,
    isFetching,
    error,
  } = useAutoRefresh<IntradayChartApiResponse>(url, {
    intervalMs: POLL_MS,
    enabled: Boolean(normalizedCode),
  })

  const series = intraday?.series ?? EMPTY_SERIES
  const hasValue = useMemo(() => series.some((p) => p.value != null), [series])
  const mkt = intraday?.marketStatus ?? 'pre_open'
  const loading = isFetching && !intraday
  // 프리마켓 체결이 있으면 차트를 가리지 않는다
  const showPreOpen = mkt === 'pre_open' && Boolean(intraday) && !loading && !error && !hasValue

  const prevClose = useMemo(() => {
    if (intraday?.prevClose != null && intraday.prevClose > 0) return intraday.prevClose
    return null
  }, [intraday?.prevClose])

  return (
    <div className={`relative h-full min-h-0 w-full ${className}`.trim()}>
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
          <div className="size-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
        </div>
      ) : null}
      {error && !intraday ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-2 text-center text-[11px] text-amber-700">
          {error}
        </div>
      ) : null}
      {showPreOpen ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-[12px] font-medium text-gray-600">
          장 시작 대기
        </div>
      ) : null}

      <IntradayChartView
        series={series}
        prevClose={prevClose}
        xMin={intraday?.xMin}
        xMax={intraday?.xMax}
        extended={intraday?.extended ?? null}
        compact={compact}
      />
    </div>
  )
}
