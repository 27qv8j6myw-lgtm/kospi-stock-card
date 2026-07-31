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
import {
  REGULAR_SESSION_MAX,
  intradayXDomain,
  intradayXTicks,
  offsetMinutesToClock,
} from '@/lib/intradayAxis'
import type { IntradayChartApiResponse, IntradaySeriesPoint } from '@/types/intradayChart'
import type { IntradayInterval } from '@/hooks/useKisChart'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { formatKrwPrice, formatPercentDiff } from '@/components/PriceChart'
import { ChartMountShell } from '@/components/chart/ChartMountShell'

const INTRADAY_IV_OPTS: IntradayInterval[] = ['1m', '5m', '15m']
const UP_HEX = '#DC2626'
const DOWN_HEX = '#2563EB'
const POLL_MS = 60_000
const EMPTY_SERIES: IntradaySeriesPoint[] = []

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

function useNarrowChart() {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const fn = () => setNarrow(mq.matches)
    fn()
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return narrow
}

/** 좌→우 progressive reveal (가운데 펼침 방지) */
function useProgressiveSeries(series: IntradaySeriesPoint[], enabled: boolean) {
  const [count, setCount] = useState(0)
  const key = useMemo(() => `${series.length}:${series[series.length - 1]?.x ?? 0}`, [series])

  useEffect(() => {
    if (!enabled || !series.length) {
      setCount(series.length)
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
  }, [key, enabled, series.length])

  return useMemo(() => {
    if (!enabled || count >= series.length) return series
    return series.slice(0, count)
  }, [series, count, enabled])
}

export type IntradayChartProps = {
  code: string
  market?: string | null
  currentPrice?: number
  height?: number
  /** Pro: 간단 레이아웃·좌→우 애니메이션 */
  variant?: 'default' | 'pro'
  interval?: IntradayInterval
  onIntervalChange?: (iv: IntradayInterval) => void
  showIntervalControls?: boolean
}

export function IntradayChart({
  code,
  market,
  currentPrice,
  height = 280,
  variant = 'default',
  interval: intervalProp,
  onIntervalChange,
  showIntervalControls = variant === 'default',
}: IntradayChartProps) {
  const uid = useId()
  const gradId = `intraday-grad-${uid.replace(/:/g, '')}`
  const narrow = useNarrowChart()
  const [internalIv, setInternalIv] = useState<IntradayInterval>('5m')
  const interval = intervalProp ?? internalIv
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

  const series = useMemo(() => intraday?.series ?? EMPTY_SERIES, [intraday])
  const openPx = intraday?.openPrice ?? 0
  const mkt = intraday?.marketStatus ?? 'pre_open'
  const animatePro = variant === 'pro'
  const displaySeries = useProgressiveSeries(series, animatePro)

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

  const xDomain = useMemo(() => intradayXDomain(intraday), [intraday])
  const xTicks = useMemo(() => intradayXTicks(xDomain, narrow), [xDomain, narrow])
  const hasValue = useMemo(() => series.some((p) => p.value != null), [series])
  const sessionEndX = intraday?.extended?.sessionEndX ?? REGULAR_SESSION_MAX
  const showSessionEnd = Boolean(intraday?.extended?.after) && xDomain[1] > sessionEndX

  const loading = isFetching && !intraday
  // 프리마켓 체결이 있으면 차트를 보여준다
  const showPreOpen = mkt === 'pre_open' && intraday && !loading && !hasValue

  const setInterval = (iv: IntradayInterval) => {
    onIntervalChange?.(iv)
    if (!intervalProp) setInternalIv(iv)
  }

  return (
    <div className="flex w-full min-w-0 flex-col">
      {showIntervalControls ? (
        <div className="mb-2 flex flex-wrap justify-end gap-1">
          {INTRADAY_IV_OPTS.map((iv) => (
            <button
              key={iv}
              type="button"
              onClick={() => setInterval(iv)}
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                interval === iv
                  ? 'bg-gray-100 font-semibold text-gray-900 ring-1 ring-gray-200'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {iv}
            </button>
          ))}
        </div>
      ) : null}

      {showPreOpen ? (
        <p className="mb-2 text-[12px] font-medium text-gray-600">장 시작 대기</p>
      ) : null}

      <ChartMountShell height={height}>
        <ResponsiveContainer width="100%" height={height} minHeight={height} minWidth={0}>
          <AreaChart data={displaySeries} margin={{ top: 6, right: 8, left: 4, bottom: 2 }}>
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
              domain={xDomain}
              ticks={xTicks}
              tickFormatter={(v) => offsetMinutesToClock(Number(v))}
              tick={{ fill: '#9CA3AF', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              allowDecimals={false}
            />
            <YAxis orientation="right" domain={domain} hide />
            {showSessionEnd ? (
              <ReferenceLine
                x={sessionEndX}
                stroke="#D1D5DB"
                strokeDasharray="2 3"
                strokeWidth={1}
                label={{
                  value: '정규장 마감',
                  position: 'insideTopRight',
                  fill: '#9CA3AF',
                  fontSize: 9,
                }}
              />
            ) : null}
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
              strokeWidth={variant === 'pro' ? 1.5 : 2}
              fill={`url(#${gradId})`}
              connectNulls={false}
              isAnimationActive={!animatePro}
              animationDuration={animatePro ? 0 : 800}
              animationBegin={0}
              animationEasing="ease-out"
            />
            {last && last.value != null ? (
              <ReferenceDot
                x={last.x}
                y={last.value}
                r={variant === 'pro' ? 4 : 5}
                fill={lineColor}
                stroke="#fff"
                strokeWidth={2}
                ifOverflow="visible"
              />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </ChartMountShell>

      {loading ? <p className="mt-1 text-[11px] text-gray-400">당일 차트 불러오는 중...</p> : null}
      {error && !intraday ? (
        <p className="mt-1 text-[11px] text-amber-700">당일 차트: {error}</p>
      ) : null}
    </div>
  )
}
