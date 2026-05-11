import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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
import type { ChartPoint, Timeframe } from '../types/stock'

const tabs: Timeframe[] = ['3D', '1W', '1M', '3M', '1Y']

export function formatKrwPrice(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `${Math.round(value).toLocaleString('ko-KR')}원`
}

/** 한국 시장 관례: 양수 +, 음수 -, 0은 0.00% */
export function formatPercentDiff(percentageDiff: number): string {
  if (!Number.isFinite(percentageDiff) || Math.abs(percentageDiff) < 1e-9) {
    return '0.00%'
  }
  const sign = percentageDiff > 0 ? '+' : ''
  return `${sign}${percentageDiff.toFixed(2)}%`
}

function percentDiffColorClass(percentageDiff: number): string {
  if (!Number.isFinite(percentageDiff) || Math.abs(percentageDiff) < 1e-9) {
    return 'text-slate-400'
  }
  return percentageDiff > 0 ? 'text-red-400' : 'text-blue-400'
}

type CustomTooltipProps = {
  active?: boolean
  /** Recharts payload; value는 숫자(가격)로 사용 */
  payload?: ReadonlyArray<{ value?: unknown }>
  label?: string | number
  currentPrice?: number
}

function CustomTooltip({ active, payload, label, currentPrice }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const raw = payload[0]?.value
  const pointPrice =
    typeof raw === 'number'
      ? raw
      : Array.isArray(raw) && typeof raw[0] === 'number'
        ? raw[0]
        : Number(raw)
  if (!Number.isFinite(pointPrice)) return null

  const showCompare =
    typeof currentPrice === 'number' &&
    Number.isFinite(currentPrice) &&
    currentPrice > 0

  let percentageDiff = 0
  if (showCompare) {
    percentageDiff = ((pointPrice - currentPrice) / currentPrice) * 100
  }

  return (
    <div className="rounded-md border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs text-slate-100 shadow-lg">
      <p className="text-slate-300">{label}</p>
      <p className="mt-1 font-semibold">가격 {formatKrwPrice(pointPrice)}</p>
      {showCompare ? (
        <p className={`mt-1 font-medium ${percentDiffColorClass(percentageDiff)}`}>
          현재가 대비 {formatPercentDiff(percentageDiff)}
        </p>
      ) : null}
    </div>
  )
}

type PriceChartProps = {
  timeframe: Timeframe
  onTimeframeChange: (tf: Timeframe) => void
  data: ChartPoint[]
  /** 기준가(참조선·툴팁 등락률). undefined이면 툴팁에서 현재가 대비 줄을 숨김 */
  currentPrice?: number
  dayChange: number
  status: 'idle' | 'loading' | 'ok' | 'error'
  errorMessage?: string
}

export function PriceChart({
  timeframe,
  onTimeframeChange,
  data,
  currentPrice,
  dayChange,
  status,
  errorMessage,
}: PriceChartProps) {
  const isUp = dayChange >= 0
  const lineColor = isUp ? '#ef4444' : '#3b82f6'
  const refColor = isUp ? '#f87171' : '#60a5fa'
  const lastPoint = data.length ? data[data.length - 1] : null
  const resolvedRefPrice = useMemo(() => {
    if (typeof currentPrice === 'number' && currentPrice > 0 && Number.isFinite(currentPrice)) {
      return currentPrice
    }
    const last = lastPoint?.value
    if (last != null && Number.isFinite(Number(last))) return Number(last)
    return 0
  }, [currentPrice, lastPoint])

  const domain = useMemo(() => {
    if (timeframe === '3D') {
      const pad = Math.max(resolvedRefPrice * 0.015, 1)
      return [resolvedRefPrice - pad * 1.1, resolvedRefPrice + pad * 1.1] as [number, number]
    }
    const values = data
      .map((d) => d.value)
      .filter((n): n is number => n != null && Number.isFinite(Number(n)))
    if (!values.length) return [0, 1] as [number, number]
    const lo = Math.min(...values)
    const hi = Math.max(...values)
    if (hi === lo) return [lo - 1, hi + 1] as [number, number]
    return [lo * 0.995, hi * 1.005] as [number, number]
  }, [data, timeframe, resolvedRefPrice])

  return (
    <section className="flex h-full flex-col border-l border-slate-200 bg-white p-6 text-slate-900 sm:p-8">
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTimeframeChange(tab)}
            className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
              timeframe === tab
                ? 'border-slate-300 bg-slate-100 text-slate-900'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="mt-4 w-full flex-1 min-h-[240px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={timeframe}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="h-full w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 6, right: 24, left: 14, bottom: 20 }}>
                <defs>
                  <linearGradient id="price-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lineColor} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 8" stroke="rgba(148,163,184,0.25)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  interval="preserveStartEnd"
                  minTickGap={14}
                  padding={{ left: 6, right: 6 }}
                />
                <YAxis hide domain={domain} />
                <Tooltip
                  content={(tp) => (
                    <CustomTooltip
                      active={tp.active}
                      payload={tp.payload}
                      label={tp.label}
                      currentPrice={currentPrice}
                    />
                  )}
                  cursor={{ stroke: lineColor, strokeWidth: 1 }}
                />
                <ReferenceLine
                  y={resolvedRefPrice}
                  stroke={refColor}
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  ifOverflow="extendDomain"
                  label={{
                    value: `${Math.round(resolvedRefPrice).toLocaleString('ko-KR')}원`,
                    position: 'right',
                    fill: refColor,
                    fontSize: 11,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={lineColor}
                  strokeWidth={2}
                  fill="url(#price-grad)"
                  connectNulls
                />
                {lastPoint ? (
                  <ReferenceDot
                    x={lastPoint.label}
                    y={lastPoint.value ?? resolvedRefPrice}
                    r={4}
                    fill={lineColor}
                    stroke="#e2e8f0"
                    strokeWidth={1.5}
                    ifOverflow="visible"
                  />
                ) : null}
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        </AnimatePresence>
      </div>
      {status === 'loading' ? (
        <p className="mt-2 text-xs text-slate-500">차트 불러오는 중...</p>
      ) : null}
      {status === 'error' ? (
        <p className="mt-2 text-xs text-amber-700">차트 오류: {errorMessage}</p>
      ) : null}
    </section>
  )
}
