'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'

type SummaryUser = {
  id: string
  email: string
  isPro: boolean
  lastSeen: string | null
  activity: { view_stock: number; chat: number; diagnosis: number }
  cost: number
}

type SummaryData = {
  users: SummaryUser[]
  total: number
  proCount: number
}

function timeAgo(iso: string | null): string {
  if (!iso) return '없음'
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return '방금'
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

export function UserSummary() {
  const [data, setData] = useState<SummaryData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const r = await authFetch(apiUrl('/api/admin-user-summary'))
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || r.statusText)
      }
      setData((await r.json()) as SummaryData)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setData(null)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
    )
  }

  if (!data) {
    return (
      <div className="flex justify-center py-8 text-gray-400">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-[12px]">
        <span className="font-bold">사용자 {data.total}명</span>
        <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-700">Pro {data.proCount}</span>
      </div>
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-[12px] text-gray-500">
        사용자 상세 목록은 비용 탭에서 확인해 주세요.
      </div>
    </div>
  )
}
