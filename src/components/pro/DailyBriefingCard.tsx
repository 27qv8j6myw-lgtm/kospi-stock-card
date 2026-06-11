'use client'

import { useEffect, useState } from 'react'
import { Sunset } from 'lucide-react'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'

type Briefing = {
  brief_date: string
  content: string
  stats?: {
    top?: Array<{ name: string; changePct: number }>
    bottom?: Array<{ name: string; changePct: number }>
  } | null
}

function formatBriefDate(d: string): string {
  if (!d || d.length < 10) return d || ''
  return `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`
}

/** Pro 대시보드 "오늘의 요약" — 브리핑이 없으면 아무것도 표시하지 않음 */
export function DailyBriefingCard() {
  const [briefing, setBriefing] = useState<Briefing | null>(null)

  useEffect(() => {
    let cancelled = false
    void authFetch(apiUrl('/api/pro-daily-briefing'))
      .then((r) => (r.ok ? r.json() : { briefing: null }))
      .then((d: { briefing?: Briefing | null }) => {
        if (!cancelled && d.briefing?.content) setBriefing(d.briefing)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!briefing) return null

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="mb-2 flex items-center gap-1.5">
        <Sunset size={14} className="text-amber-600" strokeWidth={2} aria-hidden />
        <h2 className="text-[12px] font-bold uppercase tracking-wider text-amber-800">
          오늘의 요약
        </h2>
        <span className="text-[10px] text-amber-700/60">
          {formatBriefDate(briefing.brief_date)} 장 마감
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-gray-800">{briefing.content}</p>
    </div>
  )
}
