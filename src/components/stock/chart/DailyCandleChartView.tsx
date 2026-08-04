import { useCallback, useId, useMemo, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { activeRow, chartHoverState } from '@/components/stock/chart/activeRow'
import { CandleShape } from '@/components/stock/chart/CandleShape'
import {
  CHART_AXIS_TEXT,
  CHART_DOWN,
  CHART_GRID,
  CHART_MA5,
  CHART_MA20,
  CHART_UP,
  edgeAwarePosition,
  extendDomain,
  formatPriceAxis,
  formatVolumeAxis,
  niceTicks,
  priceDomain,
} from '@/lib/chartFormat'

/** 가격 축 폭 — 거래량 패널의 우측 여백과 같아야 x 위치가 맞는다 */
const AXIS_WIDTH = 52
/** 당일 차트와 좌우 여백을 맞춰 탭을 바꿔도 그림 틀이 흔들리지 않게 한다 */
const LEFT_MARGIN = 16
/** 거래량 봉 + X축 날짜 라벨이 잘리지 않을 높이 */
const VOLUME_HEIGHT = 58
/** 저가 라벨이 가격면 아래로 삐져나오지 않게 */
const PRICE_BOTTOM_PAD = 10

export type DailyBar = {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume?: number | null
  ma5?: number | null
  ma20?: number | null
}

export type DailyCandleChartViewProps = {
  rows: DailyBar[]
  /** 1Y 은 연·월, 그 밖은 월/일로 축을 찍는다 */
  longRange?: boolean
  compact?: boolean
  className?: string
}

type Hover = { date: string; close: number } | null

function formatAxisDate(raw: string, longRange: boolean): string {
  if (raw.length < 8) return raw
  const yy = raw.slice(2, 4)
  const mm = raw.slice(4, 6)
  const dd = raw.slice(6, 8)
  return longRange ? `${yy}.${Number(mm)}월` : `${Number(mm)}/${Number(dd)}`
}

function formatFullDate(raw: string): string {
  if (raw.length < 8) return raw
  return `${raw.slice(0, 4)}.${raw.slice(4, 6)}.${raw.slice(6, 8)}`
}

/** 축 라벨이 겹치지 않게 균등 간격으로 고른다 */
function pickTicks(rows: DailyBar[], count: number): string[] {
  if (rows.length <= count) return rows.map((r) => r.date)
  const step = (rows.length - 1) / (count - 1)
  const picked = new Set<string>()
  for (let i = 0; i < count; i += 1) picked.add(rows[Math.round(i * step)].date)
  return [...picked]
}

function CandleTooltip({
  active,
  payload,
  prevCloseOf,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: DailyBar }>
  prevCloseOf: (date: string) => number | null
}) {
  const row = active ? payload?.[0]?.payload : null
  if (!row) return null

  const prev = prevCloseOf(row.date)
  const diff = prev != null && prev > 0 ? row.close - prev : null
  const pct = diff != null && prev ? (diff / prev) * 100 : null
  const diffCls =
    diff == null || diff === 0 ? 'text-gray-500' : diff > 0 ? 'text-red-600' : 'text-blue-600'

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] shadow-lg">
      <p className="tabular-nums text-gray-500">{formatFullDate(row.date)}</p>
      <p className="mt-0.5 font-bold tabular-nums text-gray-900">
        {formatPriceAxis(row.close)}원
      </p>
      {pct != null ? (
        <p className={`mt-0.5 text-[10px] font-semibold tabular-nums ${diffCls}`}>
          {diff != null && diff > 0 ? '+' : ''}
          {formatPriceAxis(diff ?? 0)} ({pct > 0 ? '+' : ''}
          {pct.toFixed(2)}%)
        </p>
      ) : null}
      <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] tabular-nums text-gray-500">
        <span>시 {formatPriceAxis(row.open)}</span>
        <span>고 {formatPriceAxis(row.high)}</span>
        <span>저 {formatPriceAxis(row.low)}</span>
        <span>종 {formatPriceAxis(row.close)}</span>
      </div>
      {row.volume ? (
        <p className="mt-0.5 text-[10px] tabular-nums text-gray-400">
          거래량 {formatVolumeAxis(row.volume)}
        </p>
      ) : null}
    </div>
  )
}

/**
 * 기간 차트 — 일봉 캔들 + 거래량. 이동평균 5·20일, 기간 고가·저가 라벨,
 * 크로스헤어 축 라벨을 포함한다.
 */
export function DailyCandleChartView({
  rows,
  longRange = false,
  compact = false,
  className = '',
}: DailyCandleChartViewProps) {
  const [hover, setHover] = useState<Hover>(null)
  const syncId = `candle-sync-${useId().replace(/:/g, '')}`

  const prevCloseMap = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((r, i) => {
      if (i > 0) m.set(r.date, rows[i - 1].close)
    })
    return m
  }, [rows])
  const prevCloseOf = useCallback(
    (date: string) => prevCloseMap.get(date) ?? null,
    [prevCloseMap],
  )

  const yDomain = useMemo(() => {
    const candles = priceDomain([...rows.map((r) => r.high), ...rows.map((r) => r.low)])
    // 이평선이 봉 범위를 크게 벗어난 구간에서 캔들이 납작해지지 않게 확장을 제한한다
    return extendDomain(candles, [
      ...rows.map((r) => r.ma5 ?? null),
      ...rows.map((r) => r.ma20 ?? null),
    ])
  }, [rows])
  const yTicks = useMemo(() => niceTicks(yDomain, compact ? 3 : 5), [yDomain, compact])
  const xTicks = useMemo(() => pickTicks(rows, compact ? 3 : 4), [rows, compact])
  const maxVolume = useMemo(
    () => Math.max(1, ...rows.map((r) => r.volume ?? 0)),
    [rows],
  )
  const hasMa20 = useMemo(() => rows.some((r) => r.ma20 != null), [rows])

  type Extreme = { bar: DailyBar; ratio: number }
  const { highBar, lowBar } = useMemo(() => {
    let hi: Extreme | null = null
    let lo: Extreme | null = null
    const last = Math.max(1, rows.length - 1)
    rows.forEach((r, i) => {
      if (!hi || r.high > hi.bar.high) hi = { bar: r, ratio: i / last }
      if (!lo || r.low < lo.bar.low) lo = { bar: r, ratio: i / last }
    })
    return { highBar: hi as Extreme | null, lowBar: lo as Extreme | null }
  }, [rows])

  const onMove = useCallback(
    (state: unknown) => {
      const row = activeRow(chartHoverState(state), rows)
      setHover(row ? { date: row.date, close: row.close } : null)
    },
    [rows],
  )
  const onLeave = useCallback(() => setHover(null), [])

  const axisTick = { fill: CHART_AXIS_TEXT, fontSize: compact ? 9 : 10 }
  const labelFont = compact ? 8 : 9
  const candleRange = useCallback((d: DailyBar) => [d.low, d.high], [])

  return (
    <div className={`flex h-full min-h-0 w-full flex-col ${className}`.trim()}>
      <div className="flex h-3.5 shrink-0 items-center gap-2 pl-0.5 text-[9px] font-semibold leading-none">
        <span style={{ color: CHART_MA5 }}>— 5일 이평</span>
        {hasMa20 ? <span style={{ color: CHART_MA20 }}>— 20일 이평</span> : null}
      </div>

      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            syncId={syncId}
            margin={{ top: 10, right: 0, bottom: PRICE_BOTTOM_PAD, left: LEFT_MARGIN }}
            onMouseMove={onMove}
            onMouseLeave={onLeave}
            onTouchMove={onMove}
            onTouchEnd={onLeave}
          >
            <CartesianGrid stroke={CHART_GRID} strokeWidth={1} vertical={false} />
            <XAxis type="category" dataKey="date" hide />
            <YAxis
              orientation="right"
              domain={yDomain}
              ticks={yTicks.length ? yTicks : undefined}
              width={AXIS_WIDTH}
              tickFormatter={(v) => formatPriceAxis(Number(v))}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              content={(tp) => (
                <CandleTooltip
                  active={tp.active}
                  payload={tp.payload as never}
                  prevCloseOf={prevCloseOf}
                />
              )}
              cursor={{ stroke: CHART_AXIS_TEXT, strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Bar
              dataKey={candleRange}
              shape={<CandleShape />}
              isAnimationActive={false}
              legendType="none"
            />
            <Line
              type="linear"
              dataKey="ma5"
              stroke={CHART_MA5}
              strokeWidth={1.2}
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="ma20"
              stroke={CHART_MA20}
              strokeWidth={1.2}
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
            {highBar && lowBar && highBar.bar.high !== lowBar.bar.low ? (
              <>
                <ReferenceDot
                  x={highBar.bar.date}
                  y={highBar.bar.high}
                  r={0}
                  ifOverflow="visible"
                  label={{
                    value: `고 ${formatPriceAxis(highBar.bar.high)}`,
                    position: edgeAwarePosition(highBar.ratio, 'top'),
                    fill: '#B91C1C',
                    fontSize: labelFont,
                  }}
                />
                <ReferenceDot
                  x={lowBar.bar.date}
                  y={lowBar.bar.low}
                  r={0}
                  ifOverflow="visible"
                  label={{
                    value: `저 ${formatPriceAxis(lowBar.bar.low)}`,
                    position: edgeAwarePosition(lowBar.ratio, 'bottom'),
                    fill: '#1D4ED8',
                    fontSize: labelFont,
                  }}
                />
              </>
            ) : null}
            {hover ? (
              <ReferenceLine
                y={hover.close}
                stroke={CHART_AXIS_TEXT}
                strokeDasharray="3 3"
                strokeWidth={1}
                ifOverflow="visible"
                label={{
                  value: formatPriceAxis(hover.close),
                  position: 'right',
                  fill: '#374151',
                  fontSize: labelFont,
                  fontWeight: 700,
                }}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{ height: VOLUME_HEIGHT }} className="shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            syncId={syncId}
            margin={{ top: 2, right: AXIS_WIDTH, bottom: 2, left: LEFT_MARGIN }}
            onMouseMove={onMove}
            onMouseLeave={onLeave}
          >
            <XAxis
              type="category"
              dataKey="date"
              ticks={xTicks}
              tickFormatter={(v) => formatAxisDate(String(v), longRange)}
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: CHART_GRID }}
              tickMargin={2}
              height={18}
              interval="preserveStartEnd"
            />
            <YAxis hide domain={[0, maxVolume * 1.15]} />
            <Tooltip
              content={() => null}
              cursor={{ stroke: CHART_AXIS_TEXT, strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Bar dataKey="volume" isAnimationActive={false} maxBarSize={9}>
              {rows.map((r) => (
                <Cell
                  key={`v-${r.date}`}
                  fill={r.close >= r.open ? CHART_UP : CHART_DOWN}
                  fillOpacity={0.3}
                />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
