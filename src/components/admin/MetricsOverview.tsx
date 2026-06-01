'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { StackedBarChart } from '@/components/admin/StackedBarChart'
import type { UserStockItem } from '@/components/UserStockList'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'

export type ByDayRow = {
  day: string
  view_card: number
  view_chat: number
  diagnosis: number
  total: number
}

export type AdminMetrics = {
  dau: number
  wau: number
  totalUsers: number
  totalHoldings: number
  topStocks: Array<{ code: string; name: string; count: number }>
  chatByUser: UserStockItem[]
  viewByUser: UserStockItem[]
  byDay: ByDayRow[]
}

const AdminMetricsContext = createContext<{
  metrics: AdminMetrics | null
  error: string | null
  loading: boolean
}>({ metrics: null, error: null, loading: true })

function useAdminMetricsContext() {
  return useContext(AdminMetricsContext)
}

export function AdminMetricsProvider({ children }: { children: ReactNode }) {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const r = await authFetch(apiUrl('/api/admin-metrics'))
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error || r.statusText)
        }
        const data = (await r.json()) as AdminMetrics
        if (!cancelled) setMetrics(data)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setMetrics(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <AdminMetricsContext.Provider value={{ metrics, error, loading }}>
      {children}
    </AdminMetricsContext.Provider>
  )
}

function MetricsLoadingOrError({ children }: { children: ReactNode }) {
  const { metrics, error, loading } = useAdminMetricsContext()
  if (error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
    )
  }
  if (loading || !metrics) {
    return (
      <div className="flex justify-center py-8 text-gray-400">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    )
  }
  return children
}

export function MetricsKpiGrid() {
  const { metrics: m } = useAdminMetricsContext()
  if (!m) return null
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="text-[11px] text-gray-500">DAU (오늘 활성)</div>
        <div className="text-[22px] font-bold tabular-nums text-gray-900">{m.dau}</div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="text-[11px] text-gray-500">WAU (14일 활성)</div>
        <div className="text-[22px] font-bold tabular-nums text-gray-900">{m.wau}</div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="text-[11px] text-gray-500">총 사용자</div>
        <div className="text-[22px] font-bold tabular-nums text-gray-900">{m.totalUsers}</div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="text-[11px] text-gray-500">총 보유종목</div>
        <div className="text-[22px] font-bold tabular-nums text-gray-900">{m.totalHoldings}</div>
      </div>
    </div>
  )
}

const ACTIVITY_BAR_SERIES = [
  { key: 'view_card', color: 'bg-gray-400', label: '조회', roundedBottom: true },
  { key: 'view_chat', color: 'bg-blue-400', label: '채팅' },
  { key: 'diagnosis', color: 'bg-amber-400', label: '진단', roundedTop: true },
] as const

export function DailyActivityChart() {
  const { metrics: m } = useAdminMetricsContext()
  if (!m) return null

  return (
    <StackedBarChart
      title="일별 활동"
      subtitle="종목조회(카드/채팅) + 진단"
      days={m.byDay}
      series={[...ACTIVITY_BAR_SERIES]}
      formatTooltip={(d) =>
        `조회 ${d.view_card} · 채팅 ${d.view_chat} · 진단 ${d.diagnosis}`
      }
    />
  )
}

export function PopularStocksPanel() {
  const { metrics: m } = useAdminMetricsContext()
  if (!m) return null
  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2 text-[13px] font-bold text-gray-900">인기 종목 (조회 TOP)</div>
      {m.topStocks.length === 0 ? (
        <p className="text-[12px] text-gray-400">조회 로그 없음</p>
      ) : (
        <div className="min-h-0 flex-1 space-y-1">
          {m.topStocks.map((s, i) => (
            <div key={s.code} className="flex items-center gap-2 text-[12px]">
              <span className="w-4 text-gray-400">{i + 1}</span>
              <span className="flex-1 text-gray-700">{s.name}</span>
              <span className="font-bold tabular-nums">{s.count}회</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** @deprecated Use AdminMetricsProvider + section components in AdminPage */
export function MetricsOverview() {
  return (
    <AdminMetricsProvider>
      <MetricsLoadingOrError>
        <div className="space-y-3">
          <MetricsKpiGrid />
          <DailyActivityChart />
          <PopularStocksPanel />
        </div>
      </MetricsLoadingOrError>
    </AdminMetricsProvider>
  )
}

export { MetricsLoadingOrError }
