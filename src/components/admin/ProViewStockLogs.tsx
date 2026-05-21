'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'

type ViewLogRow = {
  id: string
  user_email: string
  code: string | null
  stock_name: string
  created_at: string
  is_pro: boolean
}

function formatSeoul(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

export function ProViewStockLogs() {
  const [logs, setLogs] = useState<ViewLogRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void authFetch(apiUrl('/api/admin-logs?limit=50'))
      .then((r) => (r.ok ? r.json() : { logs: [] }))
      .then((d: { logs?: ViewLogRow[] }) => {
        if (!cancelled) setLogs(d.logs || [])
      })
      .catch(() => {
        if (!cancelled) setLogs([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="mt-10">
      <h2 className="text-sm font-bold text-primary">종목 조회 기록</h2>
      <p className="mt-0.5 text-xs text-secondary">activity_logs · view_stock · 최근 50건</p>

      {loading ? (
        <p className="mt-3 text-sm text-secondary">불러오는 중…</p>
      ) : logs.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-default px-4 py-6 text-center text-sm text-secondary">
          조회 기록 없음
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {logs.map((log) => (
            <li
              key={log.id}
              className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5 text-[12px] ${
                log.is_pro
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <span className="shrink-0 tabular-nums text-gray-500">{formatSeoul(log.created_at)}</span>
              <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{log.user_email}</span>
              <span className="truncate text-gray-700">
                {log.stock_name}
                {log.code ? <span className="ml-1 text-gray-400">{log.code}</span> : null}
              </span>
              {log.is_pro ? (
                <span className="shrink-0 rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  PRO
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
