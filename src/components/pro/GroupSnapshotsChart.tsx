'use client'

import { useEffect, useMemo, useState } from 'react'
import { LineChart } from 'lucide-react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'

type SnapshotRow = {
  group_id: string
  snapshot_date: string
  stock_value: number
  return_pct: number | null
}

type GroupSnapshotsChartProps = {
  /** null = 전체 그룹 (ProHoldingsPage 그룹 보기 필터와 동일) */
  selectedGroupIds: Set<string> | null
  allSelected: boolean
}

type DateBucket = {
  date: string
  stockValue: number
  totalCost: number
}

type ChartPoint = {
  sortKey: string
  date: string
  종목평가액: number
  수익률: number
}

type Period = '1W' | '2W' | '1M' | '3M' | '1Y'

const PERIODS: { key: Period; days: number }[] = [
  { key: '1W', days: 7 },
  { key: '2W', days: 14 },
  { key: '1M', days: 30 },
  { key: '3M', days: 90 },
  { key: '1Y', days: 365 },
]

/** 서울 기준 N일 전 날짜를 YYYY-MM-DD 로 반환 (스냅샷 date 문자열과 사전순 비교용) */
function seoulCutoffDate(days: number): string {
  const now = new Date()
  now.setDate(now.getDate() - days)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

const CHART_HEIGHT = 240
/** Y축 폭(px) — 좌/우 동일 */
const AXIS_WIDTH = 40
/** X축 영역 높이(px) */
const X_AXIS_HEIGHT = 20
/** 막대 최대 폭(px) — 소수 구간 과대폭 방지 */
const BAR_MAX_WIDTH = 40
/** X축에 표시할 날짜 라벨 목표 개수 (겹침 방지, 상세는 호버 툴팁) */
const TICK_TARGET = 6
const CHART_MARGIN = { top: 4, right: 8, left: 4, bottom: 0 } as const

const leftTickFormatter = (v: number, maxValue: number) =>
  v <= maxValue * 1.1 ? `${(Number(v) / 10000).toFixed(0)}만` : ''
const rightTickFormatter = (v: number) => `${Number(v).toFixed(0)}%`

function ChartLegend() {
  return (
    <div className="mb-1 flex items-center justify-center gap-4 text-[11px] text-gray-600">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gray-300" aria-hidden />
        종목평가액
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-4 rounded bg-amber-500" aria-hidden />
        수익률
      </span>
    </div>
  )
}

export function GroupSnapshotsChart({ selectedGroupIds, allSelected }: GroupSnapshotsChartProps) {
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('1W')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setFetchError(null)
      try {
        const r = await authFetch(apiUrl('/api/pro-group-snapshots'))
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error || r.statusText)
        }
        const data = (await r.json()) as { snapshots?: SnapshotRow[] }
        if (!cancelled) setSnapshots(data.snapshots || [])
      } catch (e) {
        if (!cancelled) {
          setFetchError(e instanceof Error ? e.message : String(e))
          setSnapshots([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const chartData = useMemo(() => {
    const cutoff = seoulCutoffDate(PERIODS.find((p) => p.key === period)?.days ?? 30)
    const filtered = snapshots.filter(
      (s) =>
        (selectedGroupIds === null || selectedGroupIds.has(s.group_id)) &&
        s.snapshot_date >= cutoff,
    )

    const byDate: Record<string, DateBucket> = {}
    for (const s of filtered) {
      const key = s.snapshot_date
      const stockValue = Number(s.stock_value) || 0
      const returnPct = s.return_pct
      if (!byDate[key]) {
        byDate[key] = { date: key, stockValue: 0, totalCost: 0 }
      }
      byDate[key].stockValue += stockValue
      if (returnPct != null && Number.isFinite(returnPct)) {
        const denom = 1 + returnPct / 100
        if (denom > 0 && stockValue > 0) {
          byDate[key].totalCost += stockValue / denom
        }
      }
    }

    return Object.values(byDate)
      .map((d): ChartPoint => {
        const stockValue = d.stockValue
        const totalCost = d.totalCost
        const returnPct =
          totalCost > 0
            ? Number((((stockValue - totalCost) / totalCost) * 100).toFixed(2))
            : 0
        return {
          sortKey: d.date,
          date: d.date.slice(5),
          종목평가액: Math.round(stockValue),
          수익률: returnPct,
        }
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  }, [snapshots, selectedGroupIds, period])

  /** 기간이 길어도 폭에 맞게 압축: X축 라벨 ~6개 이내, 점은 많으면 숨김 */
  const xInterval =
    chartData.length > TICK_TARGET ? Math.ceil(chartData.length / TICK_TARGET) - 1 : 0
  const showDots = chartData.length <= 40

  const axisLayout = useMemo(() => {
    if (!chartData.length) return null
    const maxValue = Math.max(...chartData.map((d) => d.종목평가액), 1)
    const returns = chartData.map((d) => d.수익률)
    const minRet = Math.min(...returns, 0)
    const maxRet = Math.max(...returns, 0)
    const range = maxRet - minRet || 10
    const pad = range * 0.2
    return {
      maxValue,
      leftDomain: [0, maxValue * 2] as [number, number],
      rightDomain: [Math.floor(minRet - pad), Math.ceil(maxRet + pad)] as [number, number],
    }
  }, [chartData])

  const filterLabel =
    selectedGroupIds && selectedGroupIds.size > 0 && !allSelected
      ? `${selectedGroupIds.size}개 그룹`
      : '전체'

  if (loading) {
    return (
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 text-[14px] font-bold text-gray-900">
          <LineChart size={16} className="text-indigo-500" strokeWidth={1.8} aria-hidden />
          <span>그룹별 일별 추이</span>
        </div>
        <p className="py-8 text-center text-[12px] text-gray-400">불러오는 중…</p>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-[12px] text-red-800">
        {fetchError}
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[14px] font-bold text-gray-900">
          <LineChart size={16} className="text-indigo-500" strokeWidth={1.8} aria-hidden />
          <span>그룹별 일별 추이</span>
        </span>
        <span className="text-[10px] text-gray-400">{filterLabel}</span>
      </div>

      {snapshots.length > 0 ? (
        <div className="mb-3 flex items-center gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={`rounded-md px-2 py-0.5 text-[11px] transition-colors ${
                period === p.key
                  ? 'bg-indigo-50 font-semibold text-indigo-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {p.key}
            </button>
          ))}
        </div>
      ) : null}

      {chartData.length === 0 ? (
        <div className="py-8 text-center text-[12px] text-gray-300">
          {snapshots.length > 0
            ? '이 기간에는 데이터가 없습니다 · 다른 기간을 선택해 보세요'
            : '데이터 수집 중입니다 · 매일 장 마감 후 기록돼요'}
        </div>
      ) : (
        <>
          <ChartLegend />
          <div className="-mx-4 sm:mx-0" style={{ height: CHART_HEIGHT }}>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <ComposedChart data={chartData} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="date"
                  interval={xInterval}
                  minTickGap={16}
                  height={X_AXIS_HEIGHT}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                />
                <YAxis
                  yAxisId="left"
                  domain={axisLayout?.leftDomain}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  tickFormatter={(v) => leftTickFormatter(Number(v), axisLayout?.maxValue ?? 0)}
                  width={AXIS_WIDTH}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={axisLayout?.rightDomain}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  tickFormatter={(v) => rightTickFormatter(Number(v))}
                  width={AXIS_WIDTH}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 8, lineHeight: 1.3 }}
                  labelStyle={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}
                  itemStyle={{ fontSize: 11, padding: 0, color: '#374151' }}
                  formatter={(value, name) => {
                    const n = Number(value)
                    if (name === '종목평가액') {
                      return Number.isFinite(n) ? `${n.toLocaleString('ko-KR')}원` : '—'
                    }
                    if (!Number.isFinite(n)) return '—'
                    const color = n > 0 ? '#dc2626' : n < 0 ? '#2563eb' : '#374151'
                    return (
                      <span style={{ color, fontWeight: 600 }}>
                        {n > 0 ? '+' : ''}
                        {n.toFixed(1)}%
                      </span>
                    )
                  }}
                  labelFormatter={(label) => String(label)}
                />
                <ReferenceLine yAxisId="right" y={0} stroke="#d1d5db" strokeDasharray="3 3" />
                <Bar
                  yAxisId="left"
                  dataKey="종목평가액"
                  fill="#e5e7eb"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={BAR_MAX_WIDTH}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="수익률"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={
                    showDots
                      ? (props) => {
                          const { cx, cy, payload } = props
                          const pct = Number((payload as ChartPoint | undefined)?.수익률) || 0
                          const fill = pct >= 0 ? '#dc2626' : '#2563eb'
                          return <circle cx={cx} cy={cy} r={3} fill={fill} stroke={fill} />
                        }
                      : false
                  }
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
