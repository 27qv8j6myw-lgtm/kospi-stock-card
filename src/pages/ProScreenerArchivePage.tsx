'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Archive, Trash2, X, Search } from 'lucide-react'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { PRO_CONTENT_WRAP } from '@/lib/proStockDesign'

type ScreenerArchiveItem = {
  rank: number
  code: string
  name: string
  sectorLabel?: string | null
  score?: number | null
  currentPrice?: number | null
  per?: number | null
  consensusUpside?: number | null
  expected1MPct?: number | null
  aiCandidateLabel?: string | null
  aiHeadline?: string | null
  aiSummary?: string | null
  aiKeyDriver?: string | null
  aiRisk?: string | null
  livePrice?: number
  returnSincePct?: number
}

type ScreenerArchiveRecord = {
  id: string
  archive_date: string
  generated_at: string | null
  model: string | null
  items: ScreenerArchiveItem[]
  pinned: boolean
  created_at: string
  avgReturnPct?: number | null
  positiveCount?: number
  scored?: number
}

function formatDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00+09:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(d)
}

function signedClass(pct: number) {
  if (pct > 0) return 'text-red-600'
  if (pct < 0) return 'text-blue-600'
  return 'text-gray-500'
}

function formatWon(n: number) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(n))
}

function modelLabel(model: string | null) {
  if (!model) return null
  if (model === 'fable') return 'Fable'
  if (model === 'opus') return 'Opus'
  if (model === 'sonnet') return 'Sonnet'
  return model
}

function candidateClass(label?: string | null) {
  if (label === '관심후보') return 'bg-red-50 text-red-600'
  if (label === '주의') return 'bg-blue-50 text-blue-600'
  return 'bg-amber-50 text-amber-700'
}

function sortRecords(list: ScreenerArchiveRecord[]) {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

export default function ProScreenerArchivePage() {
  const { navigate } = useAppNavigation()

  const [records, setRecords] = useState<ScreenerArchiveRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [detail, setDetail] = useState<ScreenerArchiveRecord | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const r = await authFetch(apiUrl('/api/pro-screener-archive?limit=100&withOutcome=1'))
        const d = (await r.json()) as { items?: ScreenerArchiveRecord[]; error?: string }
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
        if (active) {
          setRecords(sortRecords(d.items ?? []))
          setError(null)
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : String(e))
          setRecords([])
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const visibleRecords = useMemo(() => {
    const q = search.trim().toLowerCase()
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00+09:00`).getTime() : null
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59+09:00`).getTime() : null
    return records.filter((rec) => {
      if (q) {
        const hay = `${rec.archive_date} ${(rec.items ?? [])
          .map((it) => `${it.name} ${it.code}`)
          .join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (fromTs != null || toTs != null) {
        const ts = new Date(`${rec.archive_date}T12:00:00+09:00`).getTime()
        if (fromTs != null && ts < fromTs) return false
        if (toTs != null && ts > toTs) return false
      }
      return true
    })
  }, [records, search, dateFrom, dateTo])

  const remove = useCallback(async (id: string) => {
    if (!window.confirm('이 스크리너 기록을 삭제할까요?')) return
    try {
      const r = await authFetch(apiUrl(`/api/pro-screener-archive?id=${encodeURIComponent(id)}`), {
        method: 'DELETE',
      })
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(d.error || `HTTP ${r.status}`)
      }
      setRecords((prev) => prev.filter((rec) => rec.id !== id))
      setDetail((prev) => (prev?.id === id ? null : prev))
    } catch (e) {
      console.error('[Screener archive delete]', e)
    }
  }, [])

  return (
    <div className="min-h-screen w-full min-w-0 max-w-full bg-gray-50">
      <div className="max-md:min-h-[calc(100dvh-2rem)] max-md:overflow-y-auto">
        <div className={`${PRO_CONTENT_WRAP} min-w-0 py-4 pb-12`}>
          <div className="mb-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/pro/screener')}
              className="flex-shrink-0 rounded-lg p-1.5 hover:bg-gray-100"
              aria-label="뒤로"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <Archive size={22} className="flex-shrink-0 text-amber-500" strokeWidth={1.8} aria-hidden />
            <h1 className="min-w-0 truncate text-[16px] font-bold text-gray-900 sm:text-[20px]">
              스크리너 아카이브
            </h1>
          </div>
          <p className="mb-4 pl-9 text-[11px] text-gray-400">
            스크리너를 조회한 날의 AI 추천 TOP5가 매일 1건씩 자동 보관되며, 추천 시점 주가 대비 현재
            수익률을 비교합니다.
          </p>

          <div className="mb-4 flex flex-col gap-2">
            <div className="relative w-full">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="종목명 · 코드 · 날짜 검색"
                className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-[12px] text-gray-800 placeholder:text-gray-400 focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div className="flex w-full items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-700 focus:border-amber-400 focus:outline-none"
                aria-label="시작일"
              />
              <span className="shrink-0 text-[12px] text-gray-400">~</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-700 focus:border-amber-400 focus:outline-none"
                aria-label="종료일"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="size-6 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center text-[13px] text-red-600">
              {error}
            </div>
          ) : visibleRecords.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-16 text-center text-[13px] text-gray-400">
              보관된 스크리너 기록이 없습니다.
            </div>
          ) : (
            <ul className="space-y-2">
              {visibleRecords.map((rec) => {
                const model = modelLabel(rec.model)
                const items = Array.isArray(rec.items) ? rec.items : []
                const avg = rec.avgReturnPct
                return (
                  <li
                    key={rec.id}
                    className="relative rounded-xl border border-gray-200 bg-white px-4 py-3"
                  >
                    <button
                      type="button"
                      onClick={() => setDetail(rec)}
                      className="block w-full text-left"
                    >
                        <span className="flex flex-wrap items-center gap-1.5 pr-7">
                          <span className="shrink-0 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            TOP{items.length}
                          </span>
                          {model ? (
                            <span className="shrink-0 rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                              {model}
                            </span>
                          ) : null}
                          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-gray-900">
                            {formatDate(rec.archive_date)}
                          </span>
                          {avg != null ? (
                            <span className={`shrink-0 text-[12px] font-bold tabular-nums ${signedClass(avg)}`}>
                              평균 {avg > 0 ? '+' : ''}
                              {avg.toFixed(1)}%
                            </span>
                          ) : null}
                        </span>

                        {rec.scored != null && rec.scored > 0 ? (
                          <span className="mt-1 block text-[11px] text-gray-400">
                            상승 {rec.positiveCount ?? 0} / 평가 {rec.scored}종목
                          </span>
                        ) : null}

                        <span className="mt-2 block space-y-1">
                          {items.slice(0, 5).map((it) => {
                            const rec0 = Number(it.currentPrice) || 0
                            const live = it.livePrice
                            const ret = it.returnSincePct
                            return (
                              <span key={`${it.code}-${it.rank}`} className="flex items-center gap-2">
                                <span className="w-4 shrink-0 text-[11px] font-bold tabular-nums text-gray-400">
                                  {it.rank}
                                </span>
                                <span className="min-w-0 flex-1 text-[12px] font-medium text-gray-800">
                                  {it.name}
                                </span>
                                {rec0 > 0 && live != null && ret != null ? (
                                  <span className="shrink-0 whitespace-nowrap text-right text-[11px] tabular-nums text-gray-400">
                                    {formatWon(rec0)}→{formatWon(live)}
                                    <span className={`ml-1 font-semibold ${signedClass(ret)}`}>
                                      {ret > 0 ? '+' : ''}
                                      {ret.toFixed(1)}%
                                    </span>
                                  </span>
                                ) : rec0 > 0 ? (
                                  <span className="shrink-0 whitespace-nowrap text-right text-[11px] tabular-nums text-gray-400">
                                    {formatWon(rec0)}원
                                  </span>
                                ) : null}
                              </span>
                            )
                          })}
                        </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(rec.id)}
                      className="absolute right-2 top-2 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      aria-label="삭제"
                      title="삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {detail ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setDetail(null)}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <Archive size={18} className="shrink-0 text-amber-500" strokeWidth={1.8} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-bold text-gray-900">
                  {formatDate(detail.archive_date)} TOP{(detail.items ?? []).length}
                </div>
                <div className="text-[11px] text-gray-400">
                  {modelLabel(detail.model) ?? '—'}
                  {detail.avgReturnPct != null
                    ? ` · 평균 ${detail.avgReturnPct > 0 ? '+' : ''}${detail.avgReturnPct.toFixed(1)}%`
                    : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="flex-shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {(detail.items ?? []).map((it) => {
                const rec0 = Number(it.currentPrice) || 0
                const live = it.livePrice
                const ret = it.returnSincePct
                return (
                  <div
                    key={`${it.code}-${it.rank}`}
                    className="rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-2.5"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/pro/stock/${it.code}?name=${encodeURIComponent(it.name)}`)
                      }
                      className="flex w-full items-center gap-2 text-left"
                    >
                      <span className="w-4 shrink-0 text-[12px] font-bold tabular-nums text-amber-600">
                        {it.rank}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-gray-900">
                        {it.name}
                        <span className="ml-1 text-[11px] font-normal text-gray-400">{it.code}</span>
                      </span>
                      {it.aiCandidateLabel ? (
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${candidateClass(it.aiCandidateLabel)}`}
                        >
                          {it.aiCandidateLabel}
                        </span>
                      ) : null}
                    </button>
                    {rec0 > 0 ? (
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] tabular-nums text-gray-500">
                        <span>추천가 {formatWon(rec0)}원</span>
                        {live != null && ret != null ? (
                          <>
                            <span className="text-gray-300">→</span>
                            <span>현재 {formatWon(live)}원</span>
                            <span className={`font-semibold ${signedClass(ret)}`}>
                              ({ret > 0 ? '+' : ''}
                              {ret.toFixed(2)}%)
                            </span>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                    {it.aiHeadline ? (
                      <div className="mt-1.5 text-[12px] font-semibold text-gray-800">
                        {it.aiHeadline}
                      </div>
                    ) : null}
                    {it.aiSummary ? (
                      <div className="mt-1 text-[12px] leading-relaxed text-gray-600">
                        {it.aiSummary}
                      </div>
                    ) : null}
                    {it.aiKeyDriver ? (
                      <div className="mt-1.5 text-[11px] leading-relaxed text-gray-500">
                        <span className="font-semibold text-emerald-600">동인 </span>
                        {it.aiKeyDriver}
                      </div>
                    ) : null}
                    {it.aiRisk ? (
                      <div className="mt-1 text-[11px] leading-relaxed text-gray-500">
                        <span className="font-semibold text-rose-500">리스크 </span>
                        {it.aiRisk}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
