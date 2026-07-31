import { useEffect, useMemo, useState } from 'react'
import { DailyCandleChartView, type DailyBar } from '@/components/stock/chart/DailyCandleChartView'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'

export type ChartPeriod = '1W' | '1M' | '3M' | '1Y'

function num(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function maybeNum(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** API 일봉 → 차트 좌→우 (과거 → 현재) */
function formatBars(raw: Array<Record<string, unknown>>): DailyBar[] {
  return raw
    .map((c) => {
      const close = num(c.close ?? c.stck_clpr)
      return {
        date: String(c.date ?? c.stck_bsop_date ?? ''),
        close,
        open: num(c.open, close),
        high: num(c.high, close),
        low: num(c.low, close),
        volume: maybeNum(c.volume),
        ma5: maybeNum(c.ma5),
        ma20: maybeNum(c.ma20),
      }
    })
    .filter((c) => c.close > 0 && c.date)
    .sort((a, b) => a.date.localeCompare(b.date))
}

type Props = {
  code: string
  variant?: 'default' | 'pro'
  /** pro 레이아웃: 부모에서 탭·기간 제어 */
  period?: ChartPeriod
  compact?: boolean
}

const EMPTY_BARS: DailyBar[] = []

export function StockChart({ code, variant = 'default', period: periodProp, compact }: Props) {
  const isBare = variant === 'pro'
  const [internalPeriod, setInternalPeriod] = useState<ChartPeriod>('1M')
  const period = periodProp ?? internalPeriod
  // 요청 키를 함께 들고 있어 종목·기간을 바꾼 직후 이전 데이터를 그리지 않는다
  const [loaded, setLoaded] = useState<{ key: string; rows: DailyBar[] } | null>(null)
  const key = `${code}:${period}`

  useEffect(() => {
    let cancelled = false

    void authFetch(apiUrl(`/api/pro-stock-chart?code=${code}&period=${period}`))
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d: { data?: Array<Record<string, unknown>> }) => {
        if (!cancelled) setLoaded({ key, rows: formatBars(d.data || []) })
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key, rows: [] })
      })

    return () => {
      cancelled = true
    }
  }, [code, period, key])

  const data = loaded?.key === key ? loaded.rows : EMPTY_BARS
  const loading = loaded?.key !== key
  const isCompact = compact ?? isBare

  const chartBody = useMemo(() => {
    if (loading) {
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div className="size-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
        </div>
      )
    }

    if (!data.length) {
      return (
        <div className="flex h-full w-full items-center justify-center text-[12px] text-gray-400">
          차트 데이터 없음
        </div>
      )
    }

    return <DailyCandleChartView rows={data} longRange={period === '1Y'} compact={isCompact} />
  }, [data, loading, period, isCompact])

  if (isBare) {
    return <div className="h-full min-h-0 w-full">{chartBody}</div>
  }

  return (
    <div>
      <div className="mb-3 flex gap-1">
        {(['1W', '1M', '3M', '1Y'] as ChartPeriod[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setInternalPeriod(p)}
            className={`rounded-md px-3 py-1 text-[11px] font-semibold transition-colors ${
              period === p
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="h-52 rounded-lg bg-white p-2">{chartBody}</div>
    </div>
  )
}
