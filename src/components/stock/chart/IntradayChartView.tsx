import { useCallback, useId, useMemo, useState } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { activeRow, chartHoverState } from '@/components/stock/chart/activeRow'
import {
  CHART_AXIS_TEXT,
  CHART_GRID,
  edgeAwarePosition,
  formatPriceAxis,
  formatVolumeAxis,
  niceTicks,
  priceDomain,
  trendColor,
} from '@/lib/chartFormat'
import {
  REGULAR_SESSION_MAX,
  intradayXDomain,
  intradayXTicks,
  offsetMinutesToClock,
} from '@/lib/intradayAxis'
import type { IntradaySeriesPoint } from '@/types/intradayChart'

/** 가격 축 폭 — 거래량 패널의 우측 여백과 같아야 x 위치가 맞는다 */
const AXIS_WIDTH = 52
/** 첫 시각 눈금이 왼쪽에서 잘리지 않을 만큼의 여백 */
const LEFT_MARGIN = 16
/** 거래량 봉 + X축 시각 라벨이 잘리지 않을 높이 */
const VOLUME_HEIGHT = 58
/** 저가 라벨이 가격면 아래로 삐져나오지 않게 */
const PRICE_BOTTOM_PAD = 10
const OFF_HOURS_FILL = '#F8FAFC'
const OFF_HOURS_STROKE = '#E2E8F0'

export type IntradayChartViewProps = {
  series: IntradaySeriesPoint[]
  /** 전일 종가 — 기준선·등락 색의 기준 */
  prevClose?: number | null
  xMin?: number | null
  xMax?: number | null
  extended?: { pre: boolean; after: boolean; sessionEndX: number } | null
  /** 축 눈금·툴팁 글자 크기를 줄인 조밀 모드 */
  compact?: boolean
  className?: string
}

type Hover = { x: number; value: number; time: string; volume: number | null } | null

function IntradayTooltip({
  active,
  payload,
  prevClose,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: IntradaySeriesPoint }>
  prevClose: number | null
}) {
  const row = active ? payload?.[0]?.payload : null
  if (!row || row.value == null || !Number.isFinite(row.value)) return null

  const diff = prevClose != null && prevClose > 0 ? row.value - prevClose : null
  const pct = diff != null && prevClose ? (diff / prevClose) * 100 : null
  const diffCls = diff == null || diff === 0 ? 'text-gray-500' : diff > 0 ? 'text-red-600' : 'text-blue-600'

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] shadow-lg">
      <p className="tabular-nums text-gray-500">{row.time}</p>
      <p className="mt-0.5 font-bold tabular-nums text-gray-900">
        {formatPriceAxis(row.value)}원
      </p>
      {pct != null ? (
        <p className={`mt-0.5 text-[10px] font-semibold tabular-nums ${diffCls}`}>
          {diff != null && diff > 0 ? '+' : ''}
          {formatPriceAxis(diff ?? 0)} ({pct > 0 ? '+' : ''}
          {pct.toFixed(2)}%)
          <span className="ml-1 font-normal text-gray-400">전일 대비</span>
        </p>
      ) : null}
      {row.volume != null && row.volume > 0 ? (
        <p className="mt-0.5 text-[10px] tabular-nums text-gray-400">
          거래량 {formatVolumeAxis(row.volume)}
        </p>
      ) : null}
    </div>
  )
}

/**
 * 당일 차트 — 선 + 거래량. 전일 종가 기준선, 고가·저가 라벨,
 * NXT 시간외 구간 음영, 크로스헤어 축 라벨을 포함한다.
 */
export function IntradayChartView({
  series,
  prevClose = null,
  xMin,
  xMax,
  extended,
  compact = false,
  className = '',
}: IntradayChartViewProps) {
  const uid = useId().replace(/:/g, '')
  const gradId = `intraday-grad-${uid}`
  const syncId = `intraday-sync-${uid}`
  const [hover, setHover] = useState<Hover>(null)

  const xDomain = useMemo(() => intradayXDomain({ xMin, xMax }), [xMin, xMax])
  const xTicks = useMemo(() => intradayXTicks(xDomain, compact), [xDomain, compact])
  const sessionEndX = extended?.sessionEndX ?? REGULAR_SESSION_MAX

  const filled = useMemo(
    () => series.filter((p): p is IntradaySeriesPoint & { value: number } => p.value != null),
    [series],
  )
  const lastPoint = filled.length ? filled[filled.length - 1] : null
  const hasPrevClose = prevClose != null && prevClose > 0
  const base = hasPrevClose ? prevClose : (filled[0]?.value ?? null)
  const baseLabel = hasPrevClose ? '전일' : '시작'
  const lineColor = trendColor(lastPoint?.value ?? null, base)

  const yDomain = useMemo(
    () => priceDomain([...filled.map((p) => p.value), base]),
    [filled, base],
  )
  const yTicks = useMemo(() => niceTicks(yDomain, compact ? 3 : 5), [yDomain, compact])

  const { highPoint, lowPoint } = useMemo(() => {
    let hi: (IntradaySeriesPoint & { value: number }) | null = null
    let lo: (IntradaySeriesPoint & { value: number }) | null = null
    for (const p of filled) {
      if (!hi || p.value > hi.value) hi = p
      if (!lo || p.value < lo.value) lo = p
    }
    return { highPoint: hi, lowPoint: lo }
  }, [filled])

  const xRatio = useCallback(
    (x: number) => {
      const span = xDomain[1] - xDomain[0]
      return span > 0 ? (x - xDomain[0]) / span : 0.5
    },
    [xDomain],
  )

  const maxVolume = useMemo(
    () => Math.max(1, ...series.map((p) => (p.volume != null ? p.volume : 0))),
    [series],
  )

  const onMove = useCallback(
    (state: unknown) => {
      const row = activeRow(chartHoverState(state), series)
      if (!row || row.value == null) {
        setHover(null)
        return
      }
      setHover({ x: row.x, value: row.value, time: row.time, volume: row.volume ?? null })
    },
    [series],
  )
  const onLeave = useCallback(() => setHover(null), [])

  const axisTick = { fill: CHART_AXIS_TEXT, fontSize: compact ? 9 : 10 }
  const labelFont = compact ? 8 : 9
  const offHours: Array<[number, number]> = []
  if (extended?.pre && xDomain[0] < 0) offHours.push([xDomain[0], 0])
  if (extended?.after && xDomain[1] > sessionEndX) offHours.push([sessionEndX, xDomain[1]])

  return (
    <div className={`flex h-full min-h-0 w-full flex-col ${className}`.trim()}>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={series}
            syncId={syncId}
            margin={{ top: 6, right: 0, bottom: PRICE_BOTTOM_PAD, left: LEFT_MARGIN }}
            onMouseMove={onMove}
            onMouseLeave={onLeave}
            onTouchMove={onMove}
            onTouchEnd={onLeave}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.14} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_GRID} strokeWidth={1} vertical={false} />
            {offHours.map(([x1, x2], i) => (
              <ReferenceArea
                key={`off-${i}`}
                x1={x1}
                x2={x2}
                fill={OFF_HOURS_FILL}
                fillOpacity={1}
                stroke={OFF_HOURS_STROKE}
                strokeDasharray="2 3"
                label={{
                  value: '시간외',
                  position: 'insideTop',
                  fill: CHART_AXIS_TEXT,
                  fontSize: labelFont,
                }}
              />
            ))}
            <XAxis type="number" dataKey="x" domain={xDomain} hide allowDecimals={false} />
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
            {base != null ? (
              <ReferenceLine
                y={base}
                stroke={CHART_AXIS_TEXT}
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{
                  value: baseLabel,
                  position: 'insideLeft',
                  fill: CHART_AXIS_TEXT,
                  fontSize: labelFont,
                }}
              />
            ) : null}
            <Tooltip
              content={(tp) => (
                <IntradayTooltip
                  active={tp.active}
                  payload={tp.payload as never}
                  prevClose={base}
                />
              )}
              cursor={{ stroke: lineColor, strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Area
              type="linear"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={1.6}
              fill={`url(#${gradId})`}
              connectNulls={false}
              isAnimationActive={false}
              activeDot={{ r: 3, fill: lineColor, stroke: '#fff', strokeWidth: 1.5 }}
            />
            {highPoint && lowPoint && highPoint.value !== lowPoint.value ? (
              <>
                <ReferenceDot
                  x={highPoint.x}
                  y={highPoint.value}
                  r={0}
                  ifOverflow="visible"
                  label={{
                    value: `고 ${formatPriceAxis(highPoint.value)}`,
                    position: edgeAwarePosition(xRatio(highPoint.x), 'top'),
                    fill: '#B91C1C',
                    fontSize: labelFont,
                  }}
                />
                <ReferenceDot
                  x={lowPoint.x}
                  y={lowPoint.value}
                  r={0}
                  ifOverflow="visible"
                  label={{
                    value: `저 ${formatPriceAxis(lowPoint.value)}`,
                    position: edgeAwarePosition(xRatio(lowPoint.x), 'bottom'),
                    fill: '#1D4ED8',
                    fontSize: labelFont,
                  }}
                />
              </>
            ) : null}
            {hover ? (
              <ReferenceLine
                y={hover.value}
                stroke={lineColor}
                strokeDasharray="3 3"
                strokeWidth={1}
                ifOverflow="visible"
                label={{
                  value: formatPriceAxis(hover.value),
                  position: 'right',
                  fill: lineColor,
                  fontSize: labelFont,
                  fontWeight: 700,
                }}
              />
            ) : null}
            {lastPoint ? (
              <ReferenceDot
                x={lastPoint.x}
                y={lastPoint.value}
                r={3.5}
                fill={lineColor}
                stroke="#fff"
                strokeWidth={1.5}
                ifOverflow="visible"
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{ height: VOLUME_HEIGHT }} className="shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={series}
            syncId={syncId}
            margin={{ top: 2, right: AXIS_WIDTH, bottom: 2, left: LEFT_MARGIN }}
            onMouseMove={onMove}
            onMouseLeave={onLeave}
          >
            {offHours.map(([x1, x2], i) => (
              <ReferenceArea
                key={`off-vol-${i}`}
                x1={x1}
                x2={x2}
                fill={OFF_HOURS_FILL}
                fillOpacity={1}
                stroke="none"
              />
            ))}
            <XAxis
              type="number"
              dataKey="x"
              domain={xDomain}
              ticks={xTicks}
              tickFormatter={(v) => offsetMinutesToClock(Number(v))}
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: CHART_GRID }}
              tickMargin={2}
              height={18}
              allowDecimals={false}
            />
            <YAxis hide domain={[0, maxVolume * 1.15]} />
            <Tooltip
              content={() => null}
              cursor={{ stroke: lineColor, strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            {hover ? (
              <ReferenceLine
                x={hover.x}
                stroke={lineColor}
                strokeWidth={0}
                label={{
                  value: hover.time,
                  position: 'insideBottom',
                  fill: lineColor,
                  fontSize: labelFont,
                  fontWeight: 700,
                }}
              />
            ) : null}
            <Bar dataKey="volume" isAnimationActive={false} maxBarSize={6}>
              {series.map((p, i) => {
                const prev = i > 0 ? series[i - 1].value : null
                return (
                  <Cell
                    key={`v-${p.x}`}
                    fill={trendColor(p.value, prev ?? p.value)}
                    fillOpacity={0.35}
                  />
                )
              })}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
