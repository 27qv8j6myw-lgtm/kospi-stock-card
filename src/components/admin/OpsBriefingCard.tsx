'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RotateCw, Sparkles } from 'lucide-react'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'

type OpsStats = {
  dau: number
  wau: number
  topStock: { code: string; name: string | null; views: number } | null
  todayCostUsd: number
  yesterdayCostUsd: number
  avg7CostUsd: number
  costSpike: boolean
}

type Briefing = {
  content: string
  stats?: OpsStats | null
  generatedAt: string
}

function formatSeoul(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return '—'
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

export function OpsBriefingCard() {
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const r = await authFetch(apiUrl(`/api/admin-ops-briefing${refresh ? '?refresh=1' : ''}`))
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || r.statusText)
      }
      const d = (await r.json()) as { briefing?: Briefing | null }
      setBriefing(d.briefing ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBriefing(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const stats = briefing?.stats

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="mb-2 flex items-center gap-1.5">
        <Sparkles size={14} className="text-amber-600" strokeWidth={2} aria-hidden />
        <h2 className="text-[12px] font-bold uppercase tracking-wider text-amber-800">
          오늘의 운영 요약
        </h2>
        {briefing ? (
          <span className="text-[10px] text-amber-700/60">{formatSeoul(briefing.generatedAt)}</span>
        ) : null}
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          aria-label="운영 요약 다시 생성"
          title="다시 생성 (Opus 4.8 호출)"
          className="ml-auto rounded-lg p-1.5 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
        >
          <RotateCw size={14} className={loading ? 'animate-spin' : undefined} aria-hidden />
        </button>
      </div>

      {loading && !briefing ? (
        <div className="flex items-center gap-2 py-3 text-[13px] text-amber-800">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          운영 요약 생성 중…
        </div>
      ) : error ? (
        <p className="text-[12px] text-amber-800/80">{error}</p>
      ) : briefing ? (
        <>
          <p className="text-[13px] leading-relaxed text-gray-800">{briefing.content}</p>
          {stats ? (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] tabular-nums text-amber-900/70">
              <span>DAU {stats.dau}</span>
              <span>WAU {stats.wau}</span>
              {stats.topStock ? (
                <span>
                  인기 {stats.topStock.name} ({stats.topStock.views})
                </span>
              ) : null}
              <span className={stats.costSpike ? 'font-bold text-red-600' : undefined}>
                오늘 비용 ${stats.todayCostUsd} (평균 ${stats.avg7CostUsd})
                {stats.costSpike ? ' ⚠ 급증' : ''}
              </span>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-[12px] text-amber-800/80">표시할 운영 요약이 없습니다.</p>
      )}
    </section>
  )
}
