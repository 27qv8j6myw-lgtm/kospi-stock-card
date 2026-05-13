import { useEffect, useId, useMemo, useState } from 'react'
import { formatRelativeTime } from '../lib/utils/format'
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
import { CircleDot, Eye, Info, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ChartPoint, Strategy, Timeframe } from '../types/stock'
import type { IntradayChartApiResponse, IntradaySeriesPoint } from '../types/intradayChart'
import type { IntradayInterval } from '../hooks/useKisChart'
import { ChartMountShell } from './chart/ChartMountShell'
import { Card } from './ui/Card'
import { StatusBadge } from './ui/StatusBadge'
import { strategyToBadgeStatus } from '../lib/strategyBadges'
import { formatKrwPrice, formatPercentDiff } from './PriceChart'

const TIMEFRAMES: Timeframe[] = ['1D', '5D', '1M', '3M', '1Y']

const TIMEFRAME_LABEL: Record<Timeframe, string> = {
  '1D': '당일',
  '5D': '5D',
  '1M': '1M',
  '3M': '3M',
  '1Y': '1Y',
}

const INTRADAY_IV_OPTS: IntradayInterval[] = ['1m', '5m', '15m']

const UP_HEX = '#DC2626'
const DOWN_HEX = '#2563EB'

export type StockHeroStock = {
  code: string
  name: string
  /** 한 줄 부제 (예: 005930 · KOSPI200 · 전기·전자) */
  subtitle: string
  logoUrl?: string | null
  market: string
  price: number
  change: number
  changePct: number
  /** 시세 자동 갱신 (선택) */
  quoteRefresh?: { lastUpdated: Date | null; isFetching: boolean }
}

export type EntrySplitPricesGlance = {
  first: number
  second: number
  third: number
  firstNote: string
}

export type StockHeroInsight = {
  title: string
  /** @deprecated 제거됨 — 타입 호환용으로만 유지 */
  subtitle?: string
  finalGrade: string
  /** Final Grade 글자색 토큰 */
  finalGradeTone?: 'default' | 'positive' | 'caution' | 'danger'
  strategy: Strategy
  /** Entry Stage 셀에 표시할 문구 (예: 익절) */
  entryStageDisplay: string
  /** 위험 구간 등 빨간 텍스트 */
  entryStageEmphasis?: 'danger' | 'default'
  reason: string
  /** 룰 엔진 분할 매수 참고가 (회피·익절 단계는 null) */
  entrySplitPrices?: EntrySplitPricesGlance | null
  entryRecommendedAction?: 'immediate' | 'partial' | 'wait' | 'avoid'
}

export type StockHeroChartProps = {
  timeframe: Timeframe
  onTimeframeChange: (tf: Timeframe) => void
  data: ChartPoint[]
  currentPrice?: number
  dayChange: number
  status: 'idle' | 'loading' | 'ok' | 'error'
  errorMessage?: string
  /** 당일(Yahoo 분봉) */
  intraday?: IntradayChartApiResponse | null
  intradayInterval?: IntradayInterval
  onIntradayIntervalChange?: (iv: IntradayInterval) => void
  /** 당일 분봉 자동 갱신 시각 */
  intradayLastUpdated?: Date | null
  intradayRefreshing?: boolean
}

export type StockHeroProps = {
  stock: StockHeroStock
  insight: StockHeroInsight
  chart: StockHeroChartProps
  /** 메인 차트 블록 바로 아래 (AI 종합 요약 등) */
  chartFooter?: ReactNode
}

function usePeriodicNow(active: boolean, intervalMs = 5000) {
  const [t, setT] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setT(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [active, intervalMs])
  return t
}

function formatKrwWhole(v: number) {
  return `${Math.round(v).toLocaleString('ko-KR')}원`
}

function HeroSplitPriceCell({
  label,
  price,
  emphasize,
}: {
  label: string
  price: number
  emphasize?: boolean
}) {
  return (
    <div
      className={`rounded-lg border border-[#E5E7EB] px-2 py-2 text-center ${
        emphasize ? 'bg-[#EFF6FF]' : 'bg-white'
      }`}
    >
      <p className="text-xxs font-medium text-secondary sm:text-xs">{label}</p>
      <p className="mt-1 font-sans-en text-sm font-semibold tabular-nums text-primary sm:text-base">
        {Math.round(price).toLocaleString('ko-KR')}원
      </p>
    </div>
  )
}

function gradeValueColor(grade: string): string {
  const g = String(grade || '').trim().toUpperCase()
  if (g === 'A') return '#059669'
  if (g === 'B') return '#2563EB'
  if (g === 'C') return '#D97706'
  if (g === 'D') return '#EA580C'
  if (g === 'E') return '#C53030'
  return '#1F1F1F'
}

function strategyValueColor(strategy: Strategy): string {
  if (strategy === 'BUY_AGGRESSIVE') return '#15803D'
  if (strategy === 'BUY') return '#059669'
  if (strategy === 'HOLD') return '#2563EB'
  if (strategy === 'WATCH_ONLY') return '#D97706'
  if (strategy === 'TAKE_PROFIT') return '#EA580C'
  if (strategy === 'REJECT') return '#C53030'
  return '#1F1F1F'
}

function entryStageValueColor(entryStage: string): string {
  const s = String(entryStage || '')
  if (s.includes('적극 매수')) return '#15803D'
  if (s.includes('회피')) return '#C53030'
  if (s.includes('전량 익절')) return '#DC2626'
  if (s.includes('익절')) return '#EA580C'
  if (s.includes('관망 (과열)')) return '#EA580C'
  if (s.includes('관망')) return '#D97706'
  if (s.includes('보유')) return '#2563EB'
  if (s.includes('분할 매수')) return '#16A34A'
  if (s.includes('신규')) return '#059669'
  return '#1F1F1F'
}

function logoHueFromCode(code: string): number {
  let h = 0
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0
  return h % 360
}

const X_SESSION_MAX = 390

function offsetMinutesToClock(off: number): string {
  const total = 9 * 60 + off
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function DailyChartTooltip({
  active,
  payload,
  label,
  currentPrice,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ value?: unknown; payload?: { label?: string; value?: number | null } }>
  label?: string | number
  currentPrice?: number
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  const pointPrice =
    row && typeof row.value === 'number' && Number.isFinite(row.value)
      ? row.value
      : Number(payload[0]?.value)
  if (!Number.isFinite(pointPrice)) return null

  const showCompare =
    typeof currentPrice === 'number' && Number.isFinite(currentPrice) && currentPrice > 0
  let percentageDiff = 0
  if (showCompare) {
    percentageDiff = ((pointPrice - currentPrice) / currentPrice) * 100
  }
  const diffCls =
    !Number.isFinite(percentageDiff) || Math.abs(percentageDiff) < 1e-9
      ? 'text-secondary'
      : percentageDiff > 0
        ? 'text-[#DC2626]'
        : 'text-[#2563EB]'

  const line1 = String(label ?? row?.label ?? '—')

  return (
    <div
      className="relative min-w-[140px] rounded-xl border border-[#E5E7EB] bg-white px-[14px] py-2.5 font-sans-kr shadow-[0_4px_12px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)]"
      style={{ fontFamily: 'var(--font-sans-kr), Pretendard, system-ui, sans-serif' }}
    >
      <p className="font-sans-en text-xs text-secondary">{line1}</p>
      <p className="mt-1 font-sans-en text-base font-bold text-primary">{formatKrwPrice(pointPrice)}</p>
      {showCompare ? (
        <p className={`mt-1 font-sans-en text-sm font-semibold ${diffCls}`}>
          {formatPercentDiff(percentageDiff)}{' '}
          <span className="text-xs font-normal text-secondary">(현재가 대비)</span>
        </p>
      ) : null}
      <div
        className="absolute -bottom-1 left-1/2 size-0 -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-white"
        style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.06))' }}
        aria-hidden
      />
    </div>
  )
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
    Math.abs(pct) < 1e-9 ? 'text-secondary' : pct > 0 ? 'text-[#DC2626]' : 'text-[#2563EB]'

  return (
    <div
      className="relative min-w-[140px] rounded-xl border border-[#E5E7EB] bg-white px-[14px] py-2.5 font-sans-kr shadow-[0_4px_12px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)]"
      style={{ fontFamily: 'var(--font-sans-kr), Pretendard, system-ui, sans-serif' }}
    >
      <p className="font-sans-en text-xs text-secondary">{row.time}</p>
      <p className="mt-1 font-sans-en text-base font-bold text-primary">{formatKrwPrice(row.value)}</p>
      <p className={`mt-1 font-sans-en text-sm font-semibold ${diffCls}`}>
        {formatPercentDiff(pct)}{' '}
        <span className="text-xs font-normal text-tertiary">(시가 대비)</span>
      </p>
      <div
        className="absolute -bottom-1 left-1/2 size-0 -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-white"
        style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.06))' }}
        aria-hidden
      />
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

function HeroChartInner({
  chart,
  lineColor,
  gradId,
}: {
  chart: StockHeroChartProps
  lineColor: string
  gradId: string
}) {
  const narrow = useNarrowChart()
  const {
    timeframe,
    data,
    currentPrice,
    status,
    errorMessage,
    intraday,
    intradayInterval = '5m',
    onIntradayIntervalChange,
  } = chart

  /** 일봉 차트용 — 1D 분기에서도 훅 개수를 맞추기 위해 항상 계산 (1D 경로에서는 미사용) */
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
    if (timeframe === '5D') {
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

  if (timeframe === '1D') {
    return (
      <IntradayChartBlock
        chart={chart}
        lineColor={lineColor}
        gradId={gradId}
        intraday={intraday}
        intradayInterval={intradayInterval}
        onIntradayIntervalChange={onIntradayIntervalChange}
        narrow={narrow}
        intradayLastUpdated={chart.intradayLastUpdated}
        intradayRefreshing={chart.intradayRefreshing}
      />
    )
  }

  return (
    <div className="flex min-h-[280px] w-full min-w-0 flex-1 flex-col lg:max-w-[min(100%,520px)]">
      <div className="flex flex-wrap gap-1">
        {TIMEFRAMES.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => chart.onTimeframeChange(tab)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              chart.timeframe === tab
                ? 'bg-[#DBEAFE] font-semibold text-[#2563EB]'
                : 'bg-transparent text-secondary hover:bg-[#F3F4F6]'
            }`}
          >
            {TIMEFRAME_LABEL[tab]}
          </button>
        ))}
      </div>
      <ChartMountShell height={280} className="mt-3">
        <ResponsiveContainer width="100%" height={280} minHeight={280} minWidth={0}>
          <AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.08} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#F3F4F6" strokeWidth={0.5} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--color-tertiary)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval="preserveStartEnd"
              minTickGap={28}
              padding={{ left: 4, right: 4 }}
            />
            <YAxis orientation="right" domain={domain} hide />
            <Tooltip
              content={(tp) => (
                <DailyChartTooltip
                  active={tp.active}
                  payload={tp.payload as never}
                  label={tp.label}
                  currentPrice={currentPrice}
                />
              )}
              cursor={{ stroke: lineColor, strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={2}
              fill={`url(#${gradId})`}
              connectNulls
            />
            {lastPoint && lastPoint.value != null ? (
              <ReferenceDot
                x={lastPoint.label}
                y={lastPoint.value}
                r={5}
                fill={lineColor}
                stroke="#fff"
                strokeWidth={2}
                ifOverflow="visible"
              />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </ChartMountShell>
      {status === 'loading' ? <p className="mt-1 text-xs text-secondary">차트 불러오는 중...</p> : null}
      {status === 'error' ? <p className="mt-1 text-xs text-amber-700">차트 오류: {errorMessage}</p> : null}
    </div>
  )
}

function IntradayChartBlock({
  chart,
  lineColor,
  gradId,
  intraday,
  intradayInterval,
  onIntradayIntervalChange,
  narrow,
  intradayLastUpdated,
  intradayRefreshing,
}: {
  chart: StockHeroChartProps
  lineColor: string
  gradId: string
  intraday: IntradayChartApiResponse | null | undefined
  intradayInterval: IntradayInterval
  onIntradayIntervalChange?: (iv: IntradayInterval) => void
  narrow: boolean
  intradayLastUpdated?: Date | null
  intradayRefreshing?: boolean
}) {
  const { status, errorMessage, onTimeframeChange, timeframe } = chart
  const chartTick = usePeriodicNow(
    Boolean(intradayLastUpdated || intradayRefreshing),
  )
  const series = intraday?.series ?? []
  const openPx = intraday?.openPrice ?? 0
  const mkt = intraday?.marketStatus ?? 'pre_open'

  const domain = useMemo(() => {
    const vals = series.map((s) => s.value).filter((v): v is number => v != null && Number.isFinite(v))
    const fb =
      typeof chart.currentPrice === 'number' && chart.currentPrice > 0 ? chart.currentPrice : 50_000
    if (!vals.length) return [fb * 0.998, fb * 1.002] as [number, number]
    const lo = Math.min(...vals)
    const hi = Math.max(...vals)
    if (hi === lo) return [lo - 1, hi + 1] as [number, number]
    return [lo * 0.998, hi * 1.002] as [number, number]
  }, [series, chart.currentPrice])

  const last = useMemo(() => {
    for (let i = series.length - 1; i >= 0; i--) {
      if (series[i].value != null && Number.isFinite(series[i].value as number)) return series[i]
    }
    return null
  }, [series])

  const xTicks = narrow ? [0, 210, X_SESSION_MAX] : [0, 120, 240, X_SESSION_MAX]

  return (
    <div className="flex min-h-[280px] w-full min-w-0 flex-1 flex-col lg:max-w-[min(100%,520px)]">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {TIMEFRAMES.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onTimeframeChange(tab)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                timeframe === tab
                  ? 'bg-[#DBEAFE] font-semibold text-[#2563EB]'
                  : 'bg-transparent text-secondary hover:bg-[#F3F4F6]'
              }`}
            >
              {TIMEFRAME_LABEL[tab]}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-1">
          {INTRADAY_IV_OPTS.map((iv) => (
            <button
              key={iv}
              type="button"
              onClick={() => onIntradayIntervalChange?.(iv)}
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                intradayInterval === iv
                  ? 'bg-neutral-bg font-semibold text-primary ring-1 ring-[#E5E7EB]'
                  : 'text-secondary hover:bg-[#F3F4F6]'
              }`}
            >
              {iv}
            </button>
          ))}
        </div>
      </div>
      {intradayLastUpdated || intradayRefreshing ? (
        <p className="mt-1 text-xs text-secondary">
          당일 차트
          {intradayRefreshing ? (
            <>
              {' · '}
              <span className="font-medium text-info-text">갱신 중</span>
            </>
          ) : intradayLastUpdated ? (
            <>
              {' · '}
              {formatRelativeTime(intradayLastUpdated, chartTick)}
            </>
          ) : null}
        </p>
      ) : null}

      {mkt === 'pre_open' && status === 'ok' ? (
        <p className="mt-3 text-sm font-medium text-primary">장 시작 대기</p>
      ) : null}

      <ChartMountShell height={280} className="mt-3">
        <ResponsiveContainer width="100%" height={280} minHeight={280} minWidth={0}>
          <AreaChart data={series} margin={{ top: 8, right: 4, left: 4, bottom: 4 }}>
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
              ticks={xTicks}
              tickFormatter={(v) => offsetMinutesToClock(Number(v))}
              tick={{ fill: 'var(--color-tertiary)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
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
                <IntradayChartTooltip active={tp.active} payload={tp.payload as never} openPrice={openPx} />
              )}
              cursor={{ stroke: lineColor, strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={2}
              fill={`url(#${gradId})`}
              connectNulls={false}
              isAnimationActive={false}
            />
            {last && last.value != null ? (
              <ReferenceDot
                x={last.x}
                y={last.value}
                r={5}
                fill={lineColor}
                stroke="#fff"
                strokeWidth={2}
                ifOverflow="visible"
                label={{
                  value: `${Math.round(last.value).toLocaleString('ko-KR')}원`,
                  position: 'right',
                  fill: lineColor,
                  fontSize: 10,
                }}
              />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </ChartMountShell>
      {status === 'loading' ? <p className="mt-1 text-xs text-secondary">차트 불러오는 중...</p> : null}
      {status === 'error' ? <p className="mt-1 text-xs text-amber-700">차트 오류: {errorMessage}</p> : null}
    </div>
  )
}

export function StockHero({ stock, insight, chart, chartFooter }: StockHeroProps) {
  const uid = useId()
  const gradId = `hero-grad-${uid.replace(/:/g, '')}`
  const isUp = stock.change >= 0
  const lineColor = isUp ? UP_HEX : DOWN_HEX
  const hue = logoHueFromCode(stock.code)
  const quoteTick = usePeriodicNow(
    Boolean(stock.quoteRefresh?.lastUpdated || stock.quoteRefresh?.isFetching),
  )

  return (
    <Card variant="elevated" padding="lg" radius="xl" className="overflow-hidden shadow-lg">
      {/* 헤더 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          {stock.logoUrl ? (
            <img
              src={stock.logoUrl}
              alt=""
              className="size-14 shrink-0 rounded-full border border-[#F3F4F6] object-cover"
            />
          ) : (
            <div
              className="flex size-14 shrink-0 items-center justify-center rounded-full border border-[#F3F4F6] text-lg font-bold"
              style={{
                backgroundColor: `hsl(${hue} 52% 92%)`,
                color: `hsl(${hue} 45% 32%)`,
              }}
              aria-hidden
            >
              {stock.name.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-tight text-primary">{stock.name}</h2>
            <p className="mt-1 text-sm text-secondary">{stock.subtitle}</p>
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-col items-stretch gap-1 sm:w-auto sm:min-w-[11rem] sm:items-end">
          <p className="text-3xl font-bold leading-none text-primary sm:text-right">
            <span className="font-sans-en tabular-nums">{formatKrwWhole(stock.price)}</span>
          </p>
          <p
            className={`mt-1.5 text-xl font-semibold tabular-nums font-sans-en sm:text-right ${isUp ? 'text-[#DC2626]' : 'text-[#2563EB]'}`}
          >
            {isUp ? '+' : ''}
            {stock.change.toLocaleString('ko-KR')}원 ({isUp ? '+' : ''}
            {stock.changePct.toFixed(2)}%)
          </p>
          {stock.quoteRefresh &&
          (stock.quoteRefresh.lastUpdated || stock.quoteRefresh.isFetching) ? (
            <p className="mt-1 text-xs text-secondary sm:text-right">
              시세
              {stock.quoteRefresh.isFetching ? (
                <>
                  {' · '}
                  <span className="font-medium text-info-text">갱신 중</span>
                </>
              ) : stock.quoteRefresh.lastUpdated ? (
                <>
                  {' · '}
                  {formatRelativeTime(stock.quoteRefresh.lastUpdated, quoteTick)}
                </>
              ) : null}
            </p>
          ) : null}
          <div className="mt-2 flex w-full justify-start sm:justify-end">
            <StatusBadge status={strategyToBadgeStatus(insight.strategy)} size="glance" />
          </div>
        </div>
      </div>

      <hr className="my-6 border-0 border-t border-solid border-[#F3F4F6]" />

      {/* 본문: 한눈에 보기 + 차트 — lg에서 min-height 제거 시 Recharts가 -1 측정 */}
      <div className="flex min-h-[280px] min-w-0 flex-col gap-8 lg:flex-row lg:items-stretch lg:min-h-[280px]">
        <div className="flex min-h-[280px] min-w-0 flex-1 flex-col lg:max-w-[min(100%,420px)]">
          <p className="text-sm text-secondary">한눈에 보기</p>
          <h3 className="mt-1 text-[22px] font-bold leading-snug text-primary sm:text-[24px]">{insight.title}</h3>

          <ul className="mt-4 space-y-0">
            <li className="flex min-w-0 items-center gap-2.5 py-3.5">
              <Star className="size-5 shrink-0 text-[#D97706]" strokeWidth={2} aria-hidden />
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <span className="shrink-0 text-base font-semibold leading-snug text-primary">Final Grade</span>
                <span
                  className="min-w-0 truncate text-right font-sans-en text-base font-semibold"
                  style={{ color: gradeValueColor(insight.finalGrade) }}
                >
                  {insight.finalGrade}
                </span>
              </div>
            </li>
            <li className="flex min-w-0 items-center gap-2.5 py-3.5">
              <Eye className="size-5 shrink-0 text-[#2563EB]" strokeWidth={2} aria-hidden />
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <span className="shrink-0 text-base font-semibold leading-snug text-primary">Strategy</span>
                <span
                  className="min-w-0 truncate text-right font-sans-en text-base font-semibold"
                  style={{ color: strategyValueColor(insight.strategy) }}
                >
                  {insight.strategy}
                </span>
              </div>
            </li>
            <li className="flex min-w-0 items-center gap-2.5 py-3.5">
              <CircleDot className="size-5 shrink-0 text-[#EA580C]" strokeWidth={2} aria-hidden />
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <span className="shrink-0 text-base font-semibold leading-snug text-primary">Entry Stage</span>
                <span
                  className="min-w-0 max-w-[min(100%,220px)] truncate text-right text-base font-semibold sm:max-w-[280px]"
                  style={{ color: entryStageValueColor(insight.entryStageDisplay) }}
                >
                  {insight.entryStageDisplay}
                </span>
              </div>
            </li>
            <li className="flex min-w-0 items-center gap-2.5 py-3.5">
              <Info className="size-5 shrink-0 text-[#9333EA]" strokeWidth={2} aria-hidden />
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <span className="shrink-0 text-base font-semibold leading-snug text-primary">Reason</span>
                <span
                  className="min-w-0 max-w-[min(100%,200px)] truncate text-right text-base font-semibold text-primary sm:max-w-[min(52%,320px)]"
                  title={insight.reason}
                >
                  {insight.reason}
                </span>
              </div>
            </li>
            {insight.entrySplitPrices &&
            insight.entryRecommendedAction &&
            insight.entryRecommendedAction !== 'avoid' ? (
              <li className="border-t border-[#F3F4F6] py-3.5">
                <p className="text-sm font-semibold text-primary">
                  추천 분할 매수 가격
                  {insight.entrySplitPrices.firstNote !== '현재가 즉시' ? (
                    <span className="ml-1.5 font-normal text-secondary">
                      · {insight.entrySplitPrices.firstNote}
                    </span>
                  ) : null}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <HeroSplitPriceCell
                    label="1차"
                    price={insight.entrySplitPrices.first}
                    emphasize={insight.entrySplitPrices.firstNote === '현재가 즉시'}
                  />
                  <HeroSplitPriceCell label="2차 (-5%)" price={insight.entrySplitPrices.second} />
                  <HeroSplitPriceCell label="3차 (-10%)" price={insight.entrySplitPrices.third} />
                </div>
              </li>
            ) : null}
          </ul>
        </div>

        <div className="flex min-h-[280px] min-w-0 flex-1 flex-col">
          <HeroChartInner chart={chart} lineColor={lineColor} gradId={gradId} />
        </div>
      </div>

      {chartFooter ? <div className="min-w-0">{chartFooter}</div> : null}
    </Card>
  )
}

/** 0~100 점수 → 등급 문자 */
export function scoreToLetterGrade(score: number): string {
  if (!Number.isFinite(score)) return 'C'
  if (score >= 82) return 'A'
  if (score >= 68) return 'B'
  if (score >= 52) return 'C'
  return 'D'
}

export function letterGradeToTone(letter: string): StockHeroInsight['finalGradeTone'] {
  if (letter === 'A') return 'positive'
  if (letter === 'B') return 'caution'
  if (letter === 'D') return 'danger'
  return 'default'
}
