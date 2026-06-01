'use client'

import { useEffect, useMemo, useState } from 'react'
import { LineChart } from 'lucide-react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
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

export function GroupSnapshotsChart({ selectedGroupIds, allSelected }: GroupSnapshotsChartProps) {
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

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
    const filtered = snapshots.filter(
      (s) => selectedGroupIds === null || selectedGroupIds.has(s.group_id),
    )

    /** @type {Record<string, { date: string; stockValue: number; totalCost: number }>} */
    const byDate = {}
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
      .map((d) => {
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
  }, [snapshots, selectedGroupIds])

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

      {chartData.length === 0 ? (
        <div className="py-8 text-center text-[12px] text-gray-300">
          데이터 수집 중입니다 · 매일 장 마감 후 기록돼요
        </div>
      ) : (
        <div className="h-60 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis
                yAxisId="left"
                domain={axisLayout?.leftDomain}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickFormatter={(v) =>
                  axisLayout && v <= axisLayout.maxValue * 1.1
                    ? `${(Number(v) / 10000).toFixed(0)}만`
                    : ''
                }
                width={40}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={axisLayout?.rightDomain}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                width={40}
              />
              <Tooltip
                formatter={(value: number, name: string) =>
                  name === '종목평가액' ? `${Number(value).toLocaleString('ko-KR')}원` : `${value}%`
                }
                labelFormatter={(label) => String(label)}
              />
              <ReferenceLine yAxisId="right" y={0} stroke="#d1d5db" strokeDasharray="3 3" />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                yAxisId="left"
                dataKey="종목평가액"
                fill="#e5e7eb"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="수익률"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload } = props
                  const pct = Number(payload?.수익률) || 0
                  const fill = pct >= 0 ? '#dc2626' : '#2563eb'
                  return <circle cx={cx} cy={cy} r={3} fill={fill} stroke={fill} />
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
