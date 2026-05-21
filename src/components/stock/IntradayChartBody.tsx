import { useEffect, useId, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { apiUrl } from '@/lib/apiBase'
import type { IntradayChartApiResponse, IntradaySeriesPoint } from '@/types/intradayChart'
import type { IntradayInterval } from '@/hooks/useKisChart'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { formatKrwPrice, formatPercentDiff } from '@/components/PriceChart'

const X_SESSION_MAX = 390
const UP_HEX = '#DC2626'
const DOWN_HEX = '#2563EB'
const POLL_MS = 60_000
const EMPTY_SERIES: IntradaySeriesPoint[] = []

function seriesSignature(series: IntradaySeriesPoint[]): string {
  if (!series.length) return 'empty'
  const last = series[series.length - 1]
  return `${series.length}:${last?.x ?? ''}:${last?.time ?? ''}:${last?.value ?? ''}`
}

function exchangeSuffixFromMarket(market?: string | null): 'KS' | 'KQ' {
  const m = String(market ?? '').toUpperCase()
  if (m.includes('KOSDAQ') || m.includes('코스닥')) return 'KQ'
  return 'KS'
}

function IntradayChartTooltip({
  active,
  payload,
  openPrice,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: IntradaySeriesPoint }>
  openPrice: number
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row || row.value == null || !Number.isFinite(row.value)) return null
  const pct = openPrice > 0 ? ((row.value - openPrice) / openPrice) * 100 : 0
  const diffCls =
    Math.abs(pct) < 1e-9 ? 'text-gray-500' : pct > 0 ? 'text-red-600' : 'text-blue-600'

  return (
    <div className="relative min-w-[120px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] shadow-lg">
      <p className="text-gray-500">{row.time}</p>
      <p className="mt-0.5 font-bold tabular-nums text-gray-900">{formatKrwPrice(row.value)}</p>
      <p className={`mt-0.5 text-[10px] font-semibold tabular-nums ${diffCls}`}>
        {formatPercentDiff(pct)} <span className="font-normal text-gray-400">(시가 대비)</span>
      </p>
    </div>
  )
}

function useProgressiveSeries(series: IntradaySeriesPoint[]) {
  const [count, setCount] = useState(0)
  const key = useMemo(() => `${series.length}:${series[series.length - 1]?.x ?? 0}`, [series])

  useEffect(() => {
    if (!series.length) {
      setCount(0)
      return
    }
    setCount(0)
    const duration = 800
    const start = performance.now()
    let raf = 0
    const step = (t: number) => {
      const p = Math.min((t - start) / duration, 1)
      setCount(Math.max(1, Math.ceil(series.length * p)))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [key, series.length])

  return useMemo(() => {
    if (count >= series.length) return series
    return series.slice(0, count)
  }, [series, count])
}

export type IntradayChartBodyProps = {
  code: string
  market?: string | null
  currentPrice?: number
  interval?: IntradayInterval
  className?: string
  /** Pro: 외부 ChartIndexLabels용 시계열 */
  onSeriesChange?: (series: IntradaySeriesPoint[]) => void
}

/** Pro 듀얼 차트용 — 차트 영역만, 부모 `h-[160px]` 에 맞춤 */
export function IntradayChartBody({
  code,
  market,
  currentPrice,
  interval = '5m',
  className = '',
  onSeriesChange,
}: IntradayChartBodyProps) {
  const uid = useId()
  const gradId = `intraday-body-grad-${uid.replace(/:/g, '')}`
  const suffix = exchangeSuffixFromMarket(market)

  const normalizedCode = useMemo(
    () => String(code).replace(/\D/g, '').padStart(6, '0'),
    [code],
  )

  const url = useMemo(() => {
    const base = apiUrl('/api/intraday-chart')
    return `${base}?code=${encodeURIComponent(normalizedCode)}&interval=${encodeURIComponent(interval)}&suffix=${encodeURIComponent(suffix)}`
  }, [normalizedCode, interval, suffix])

  const { data: intraday, isFetching, error } = useAutoRefresh<IntradayChartApiResponse>(url, {
    intervalMs: POLL_MS,
    enabled: Boolean(normalizedCode),
  })

  const series = intraday?.series ?? EMPTY_SERIES
  const seriesSig = useMemo(() => seriesSignature(series), [series])
  const openPx = intraday?.openPrice ?? 0
  const mkt = intraday?.marketStatus ?? 'pre_open'
  const displaySeries = useProgressiveSeries(series)

  const isUp =
    currentPrice != null && openPx > 0
      ? currentPrice >= openPx
      : (() => {
          for (let i = series.length - 1; i >= 0; i--) {
            const v = series[i].value
            if (v != null && openPx > 0) return v >= openPx
          }
          return true
        })()
  const lineColor = isUp ? UP_HEX : DOWN_HEX

  const domain = useMemo(() => {
    const vals = series.map((s) => s.value).filter((v): v is number => v != null && Number.isFinite(v))
    const fb =
      typeof currentPrice === 'number' && currentPrice > 0 ? currentPrice : 50_000
    if (!vals.length) return [fb * 0.998, fb * 1.002] as [number, number]
    const lo = Math.min(...vals)
    const hi = Math.max(...vals)
    if (hi === lo) return [lo - 1, hi + 1] as [number, number]
    return [lo * 0.998, hi * 1.002] as [number, number]
  }, [series, currentPrice])

  const last = useMemo(() => {
    for (let i = displaySeries.length - 1; i >= 0; i--) {
      if (displaySeries[i].value != null && Number.isFinite(displaySeries[i].value as number)) {
        return displaySeries[i]
      }
    }
    return null
  }, [displaySeries])

  const loading = isFetching && !intraday
  const showPreOpen = mkt === 'pre_open' && intraday && !loading && !error

  useEffect(() => {
    if (!onSeriesChange) return
    onSeriesChange(series)
  }, [seriesSig, onSeriesChange])

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

      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={displaySeries} margin={{ top: 4, right: 6, left: 2, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.08} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#F3F4F6" strokeWidth={0.5} vertical={false} />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, X_SESSION_MAX]}
            hide
            allowDecimals={false}
          />
          <YAxis orientation="right" domain={domain} hide />
          {openPx > 0 ? (
            <ReferenceLine
              y={openPx}
              stroke="#9CA3AF"
              strokeDasharray="4 4"
              strokeWidth={1}
              ifOverflow="extendDomain"
            />
          ) : null}
          <Tooltip
            content={(tp) => (
              <IntradayChartTooltip
                active={tp.active}
                payload={tp.payload as never}
                openPrice={openPx}
              />
            )}
            cursor={{ stroke: lineColor, strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={1.5}
            fill={`url(#${gradId})`}
            connectNulls={false}
            isAnimationActive={false}
          />
          {last && last.value != null ? (
            <ReferenceDot
              x={last.x}
              y={last.value}
              r={4}
              fill={lineColor}
              stroke="#fff"
              strokeWidth={2}
              ifOverflow="visible"
            />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
