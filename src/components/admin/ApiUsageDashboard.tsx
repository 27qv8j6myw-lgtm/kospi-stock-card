'use client'

import { useCallback, useEffect, useState } from 'react'
import { DollarSign, Loader2 } from 'lucide-react'
import { StackedBarChart } from '@/components/admin/StackedBarChart'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'

type UsageStats = {
  days: number
  summary: {
    totalCalls: number
    inputTokens: number
    outputTokens: number
    costUsd: number
  }
  byEndpoint: Array<{
    endpoint: string
    calls: number
    inputTokens: number
    outputTokens: number
    costUsd: number
  }>
  topUsers: Array<{
    userId: string
    email: string
    calls: number
    inputTokens: number
    outputTokens: number
    costUsd: number
  }>
  byDayCost: Array<{
    day: string
    analysis: number
    chat: number
    diagnosis: number
    total: number
  }>
}

const COST_BAR_SERIES = [
  { key: 'analysis', color: 'bg-gray-400', label: '종목분석', roundedBottom: true },
  { key: 'chat', color: 'bg-blue-400', label: '채팅' },
  { key: 'diagnosis', color: 'bg-amber-400', label: '진단', roundedTop: true },
] as const

type SummaryUser = {
  id: string
  email: string
  full_name?: string | null
  avatar_url?: string | null
  isPro: boolean
  activity: { view_stock: number; chat: number; diagnosis: number }
  cost: number
}

type SummaryData = {
  users: SummaryUser[]
}

const ENDPOINT_LABEL: Record<string, string> = {
  'stock-analysis': '종목 분석',
  'news-summary': '뉴스 요약',
  chat: '채팅',
  'chat-stream': '채팅(스트림)',
  'group-diagnosis': '그룹 진단',
  'portfolio-diagnosis': '포트폴리오 진단',
  'holding-diagnosis': '보유 진단',
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(4)}`
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function displayName(u: { full_name?: string | null; email: string }): string {
  const n = String(u.full_name || '').trim()
  if (n) return n
  const local = (u.email || '').split('@')[0] || ''
  return local || u.email || '?'
}

export function ApiUsageDashboard() {
  const [days, setDays] = useState(7)
  const [data, setData] = useState<UsageStats | null>(null)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [usageRes, summaryRes] = await Promise.all([
        authFetch(apiUrl(`/api/admin-usage-stats?days=${days}`)),
        authFetch(apiUrl('/api/admin-user-summary')),
      ])

      if (!usageRes.ok) {
        const body = (await usageRes.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || usageRes.statusText)
      }
      if (!summaryRes.ok) {
        const body = (await summaryRes.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || summaryRes.statusText)
      }

      const [usageData, summaryData] = await Promise.all([
        usageRes.json() as Promise<UsageStats>,
        summaryRes.json() as Promise<SummaryData>,
      ])
      setData(usageData)
      setSummary(summaryData)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setData(null)
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-amber-600" aria-hidden />
          <h2 className="text-sm font-bold text-primary">API 비용 (Opus)</h2>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                days === d ? 'bg-gray-900 text-white' : 'bg-neutral-bg text-secondary'
              }`}
            >
              {d}일
            </button>
          ))}
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-default px-2 py-1 text-[11px] text-secondary hover:bg-neutral-bg"
          >
            새로고침
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs text-secondary">
        Claude Opus 4.8 — 입력 $5 / 출력 $25 per 1M tokens (추정)
      </p>

      {loading ? (
        <div className="flex justify-center py-8 text-secondary">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="호출 수" value={String(data.summary.totalCalls)} />
            <Stat label="입력 토큰" value={fmtTokens(data.summary.inputTokens)} />
            <Stat label="출력 토큰" value={fmtTokens(data.summary.outputTokens)} />
            <Stat label="추정 비용" value={fmtUsd(data.summary.costUsd)} highlight />
          </div>

          {data.byDayCost?.length ? (
            <StackedBarChart
              title="일별 비용"
              days={data.byDayCost}
              series={[...COST_BAR_SERIES]}
              formatTooltip={(d) =>
                `분석 $${Number(d.analysis).toFixed(3)} · 채팅 $${Number(d.chat).toFixed(3)} · 진단 $${Number(d.diagnosis).toFixed(3)}`
              }
            />
          ) : null}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-default bg-card shadow-sm">
              <h3 className="border-b border-default px-4 py-3 text-xs font-bold text-primary">
                기능별
              </h3>
              <ul className="divide-y divide-default">
                {data.byEndpoint.length === 0 ? (
                  <li className="px-4 py-6 text-center text-sm text-secondary">데이터 없음</li>
                ) : (
                  data.byEndpoint.map((row) => (
                    <li
                      key={row.endpoint}
                      className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
                    >
                      <span className="font-medium text-primary">
                        {ENDPOINT_LABEL[row.endpoint] || row.endpoint}
                      </span>
                      <span className="shrink-0 tabular-nums text-secondary">
                        {row.calls}회 · {fmtUsd(row.costUsd)}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="rounded-2xl border border-default bg-card shadow-sm">
              <h3 className="border-b border-default px-4 py-3 text-xs font-bold text-primary">
                사용자 TOP
              </h3>
              <ul className="divide-y divide-default">
                {data.topUsers.length === 0 ? (
                  <li className="px-4 py-6 text-center text-sm text-secondary">데이터 없음</li>
                ) : (
                  data.topUsers.map((row) => (
                    <TopUserRow key={row.userId} row={row} summaryUsers={summary?.users || []} />
                  ))
                )}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-default bg-card shadow-sm">
            <h3 className="border-b border-default px-4 py-3 text-xs font-bold text-primary">
              사용자별 활동/비용
            </h3>
            <ul className="divide-y divide-default">
              {summary?.users?.length ? (
                [...summary.users]
                  .sort((a, b) => b.cost - a.cost)
                  .map((u) => (
                    <li key={u.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-full bg-gray-100 object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[12px] font-bold text-gray-500">
                          {(u.email?.[0] || '?').toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold text-gray-900">
                          {displayName(u)}
                        </div>
                        <div className="truncate text-[11px] text-gray-400">{u.email}</div>
                      </div>
                      <div className="shrink-0 text-right text-[11px] text-secondary">
                        <div className="tabular-nums">
                          조회 {u.activity.view_stock} · 채팅 {u.activity.chat} · 진단 {u.activity.diagnosis}
                        </div>
                        <div className="font-bold tabular-nums text-emerald-700">${u.cost.toFixed(2)}</div>
                      </div>
                    </li>
                  ))
              ) : (
                <li className="px-4 py-6 text-center text-sm text-secondary">데이터 없음</li>
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function TopUserRow({
  row,
  summaryUsers,
}: {
  row: UsageStats['topUsers'][number]
  summaryUsers: SummaryUser[]
}) {
  const profile = summaryUsers.find((u) => u.id === row.userId)
  const email = profile?.email || row.email
  const name = displayName({ full_name: profile?.full_name || null, email })
  const avatarUrl = profile?.avatar_url || null

  return (
    <li className="flex items-center gap-3 px-4 py-2.5 text-[12px]">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-7 w-7 shrink-0 rounded-full bg-gray-100 object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500">
          {(email?.[0] || '?').toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-semibold text-gray-900">{name}</div>
        <div className="truncate text-[10px] text-gray-400">{email}</div>
      </div>
      <span className="shrink-0 tabular-nums text-gray-400">{row.calls}회</span>
      <span className="w-16 shrink-0 text-right font-bold tabular-nums text-emerald-600">
        {fmtUsd(row.costUsd)}
      </span>
    </li>
  )
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="rounded-2xl border border-default bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-secondary">{label}</p>
      <p
        className={`mt-1 font-sans-en text-xl font-bold tabular-nums ${
          highlight ? 'text-amber-700' : 'text-primary'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
