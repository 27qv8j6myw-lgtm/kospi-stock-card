'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Crown } from 'lucide-react'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'

type ProUserStat = { user_id: string; email: string; count: number }
type ProStockStat = { code: string; name: string; pro: number; normal: number; total: number }
type ProHourStat = { hour: number; pro: number; normal: number }
type WatchlistStat = { code: string; name: string; count: number }

export function ProAdminStats() {
  const [users, setUsers] = useState<ProUserStat[]>([])
  const [stocks, setStocks] = useState<ProStockStat[]>([])
  const [hours, setHours] = useState<ProHourStat[]>([])
  const [watchlist, setWatchlist] = useState<WatchlistStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    void Promise.all([
      authFetch(apiUrl('/api/admin-pro-stats-users')),
      authFetch(apiUrl('/api/admin-pro-stats-stocks')),
      authFetch(apiUrl('/api/admin-pro-stats-hours')),
      authFetch(apiUrl('/api/admin-pro-watchlist-stats')),
    ])
      .then(async ([uRes, sRes, hRes, wRes]) => {
        if (cancelled) return
        if (!uRes.ok || !sRes.ok || !hRes.ok || !wRes.ok) {
          setError('Pro 통계를 불러오지 못했습니다.')
          return
        }
        const [u, s, h, w] = await Promise.all([
          uRes.json() as Promise<{ users?: ProUserStat[] }>,
          sRes.json() as Promise<{ stocks?: ProStockStat[] }>,
          hRes.json() as Promise<{ hours?: ProHourStat[] }>,
          wRes.json() as Promise<{ watchlist?: WatchlistStat[] }>,
        ])
        setUsers(u.users || [])
        setStocks(s.stocks || [])
        setHours(h.hours || [])
        setWatchlist(w.watchlist || [])
      })
      .catch(() => {
        if (!cancelled) setError('Pro 통계 로드 실패')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const maxHour = Math.max(1, ...hours.map((h) => h.pro + h.normal))

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center gap-2">
        <Crown size={14} className="text-amber-600" strokeWidth={2} aria-hidden />
        <h2 className="text-sm font-bold text-primary">Pro 모드 통계 (최근 7일)</h2>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-secondary">통계 불러오는 중…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <StatPanel title="Pro 사용자 조회 (TOP)">
            {users.length === 0 ? (
              <EmptyHint />
            ) : (
              <ul className="space-y-1.5">
                {users.map((u) => (
                  <li key={u.user_id} className="flex justify-between text-[12px]">
                    <span className="truncate text-gray-800">{u.email}</span>
                    <span className="shrink-0 font-bold tabular-nums text-amber-700">{u.count}회</span>
                  </li>
                ))}
              </ul>
            )}
          </StatPanel>

          <StatPanel title="종목 조회 (Pro vs 일반)">
            {stocks.length === 0 ? (
              <EmptyHint />
            ) : (
              <ul className="space-y-1.5">
                {stocks.map((s) => (
                  <li key={s.code} className="flex justify-between gap-2 text-[12px]">
                    <span className="min-w-0 truncate text-gray-800">
                      {s.name}{' '}
                      <span className="text-gray-400">{s.code}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      <span className="font-bold text-amber-700">{s.pro}</span>
                      <span className="text-gray-400"> / </span>
                      <span className="text-gray-600">{s.normal}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </StatPanel>

          <StatPanel title="시간대별 조회 (KST)">
            {hours.every((h) => h.pro + h.normal === 0) ? (
              <EmptyHint />
            ) : (
              <div className="flex h-24 items-end gap-0.5">
                {hours.map((h) => (
                    <div key={h.hour} className="flex flex-1 flex-col items-center gap-0.5">
                      <div
                        className="flex w-full flex-col justify-end overflow-hidden rounded-t bg-gray-100"
                        style={{ height: '72px' }}
                        title={`${h.hour}시 Pro ${h.pro} / 일반 ${h.normal}`}
                      >
                        {h.normal > 0 ? (
                          <div
                            className="w-full bg-gray-400"
                            style={{ height: `${(h.normal / maxHour) * 72}px` }}
                          />
                        ) : null}
                        {h.pro > 0 ? (
                          <div
                            className="w-full bg-amber-500"
                            style={{ height: `${(h.pro / maxHour) * 72}px` }}
                          />
                        ) : null}
                      </div>
                      <span className="text-[9px] text-gray-400">{h.hour}</span>
                    </div>
                ))}
              </div>
            )}
          </StatPanel>

          <StatPanel title="즐겨찾기 인기 종목">
            {watchlist.length === 0 ? (
              <EmptyHint />
            ) : (
              <ul className="space-y-1.5">
                {watchlist.map((w) => (
                  <li key={w.code} className="flex justify-between text-[12px]">
                    <span className="truncate text-gray-800">
                      {w.name} <span className="text-gray-400">{w.code}</span>
                    </span>
                    <span className="shrink-0 font-bold tabular-nums text-gray-700">{w.count}명</span>
                  </li>
                ))}
              </ul>
            )}
          </StatPanel>
        </div>
      )}
    </section>
  )
}

function StatPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-default bg-card p-4 shadow-sm">
      <h3 className="mb-3 text-[12px] font-bold text-secondary">{title}</h3>
      {children}
    </div>
  )
}

function EmptyHint() {
  return <p className="text-[12px] text-gray-400">최근 7일 데이터 없음</p>
}
