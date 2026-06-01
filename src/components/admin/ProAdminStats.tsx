'use client'

import { useEffect, useState } from 'react'
import { Crown } from 'lucide-react'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'

type ProUserStat = { user_id: string; email: string; count: number }

export function ProAdminStats() {
  const [users, setUsers] = useState<ProUserStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    void authFetch(apiUrl('/api/admin-pro-stats-users'))
      .then(async (uRes) => {
        if (cancelled) return
        if (!uRes.ok) {
          setError('Pro 통계를 불러오지 못했습니다.')
          return
        }
        const u = (await uRes.json()) as { users?: ProUserStat[] }
        setUsers(u.users || [])
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

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <Crown size={14} className="text-amber-600" strokeWidth={2} aria-hidden />
        <h2 className="text-[13px] font-bold text-gray-900">Pro 모드 통계 (최근 7일)</h2>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-[12px] text-gray-400">통계 불러오는 중…</p>
      ) : users.length === 0 ? (
        <p className="text-[12px] text-gray-400">최근 7일 데이터 없음</p>
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
    </div>
  )
}
