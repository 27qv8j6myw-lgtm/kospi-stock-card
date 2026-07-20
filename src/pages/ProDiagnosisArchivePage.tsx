'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Archive, Trash2, X, Star, Search } from 'lucide-react'
import { MarkdownMessage } from '@/components/chat/MarkdownMessage'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { PRO_CONTENT_WRAP } from '@/lib/proStockDesign'

type ArchiveKind = 'holding' | 'portfolio' | 'group'
type Outcome = 'hit' | 'miss' | 'neutral'

type ArchiveMeta = {
  verdict?: string | null
  summary?: string | null
  targetPrices?: number[]
  stopPrices?: number[]
  [key: string]: unknown
}

type ArchiveListItem = {
  id: string
  kind: ArchiveKind
  ref_id: string | null
  code: string | null
  title: string
  profit_pct: number | null
  current_price: number | null
  model: string | null
  meta: ArchiveMeta | null
  pinned: boolean
  created_at: string
  livePrice?: number
  returnSincePct?: number
  outcome?: Outcome
}

type ArchiveDetail = ArchiveListItem & {
  analysis: string
}

type DiagnosisStats = {
  total: number
  scored: number
  hit: number
  miss: number
  neutral: number
  hitRate: number | null
  avgReturnPct: number | null
  verdictDist: Record<string, number>
}

const KIND_TABS: { id: 'all' | ArchiveKind; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'holding', label: '보유종목' },
  { id: 'portfolio', label: '포트폴리오' },
  { id: 'group', label: '그룹' },
]

const KIND_BADGE: Record<ArchiveKind, { label: string; className: string }> = {
  holding: { label: '보유', className: 'bg-blue-50 text-blue-600' },
  portfolio: { label: '포트폴리오', className: 'bg-emerald-50 text-emerald-600' },
  group: { label: '그룹', className: 'bg-purple-50 text-purple-600' },
}

const OUTCOME_BADGE: Record<Outcome, { label: string; className: string }> = {
  hit: { label: '적중', className: 'bg-red-50 text-red-600' },
  miss: { label: '빗나감', className: 'bg-blue-50 text-blue-600' },
  neutral: { label: '보합', className: 'bg-gray-100 text-gray-500' },
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
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

function sortItems(list: ArchiveListItem[]) {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

export default function ProDiagnosisArchivePage() {
  const { navigate } = useAppNavigation()

  // ?code= 타임라인 모드 — pathname만으로는 쿼리 변경을 감지 못하므로 state로 관리
  const [codeFilter, setCodeFilter] = useState(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('code')?.trim() ?? ''
  })

  const [kind, setKind] = useState<'all' | ArchiveKind>('all')
  const [items, setItems] = useState<ArchiveListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [detail, setDetail] = useState<ArchiveDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [stats, setStats] = useState<DiagnosisStats | null>(null)

  useEffect(() => {
    if (codeFilter) return
    let active = true
    void (async () => {
      try {
        const r = await authFetch(apiUrl('/api/pro-diagnosis-archive?stats=1'))
        const d = (await r.json()) as { stats?: DiagnosisStats }
        if (active && d.stats) setStats(d.stats)
      } catch {
        // 성과 통계 실패는 무시 (목록은 정상 표시)
      }
    })()
    return () => {
      active = false
    }
  }, [codeFilter])

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const params = new URLSearchParams({ limit: '100', withOutcome: '1' })
        if (codeFilter) params.set('code', codeFilter)
        const r = await authFetch(apiUrl(`/api/pro-diagnosis-archive?${params.toString()}`))
        const d = (await r.json()) as { items?: ArchiveListItem[]; error?: string }
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
        if (active) {
          setItems(sortItems(d.items ?? []))
          setError(null)
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : String(e))
          setItems([])
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [codeFilter])

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00+09:00`).getTime() : null
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59+09:00`).getTime() : null
    return items.filter((it) => {
      if (kind !== 'all' && it.kind !== kind) return false
      if (q) {
        const hay = `${it.title} ${it.code ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (fromTs != null || toTs != null) {
        const ts = new Date(it.created_at).getTime()
        if (fromTs != null && ts < fromTs) return false
        if (toTs != null && ts > toTs) return false
      }
      return true
    })
  }, [items, kind, search, dateFrom, dateTo])

  const openDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    setDetail(null)
    try {
      const r = await authFetch(apiUrl(`/api/pro-diagnosis-archive?id=${encodeURIComponent(id)}`))
      const d = (await r.json()) as { item?: ArchiveDetail; error?: string }
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
      if (d.item) setDetail(d.item)
    } catch (e) {
      console.error('[Archive detail]', e)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const togglePin = useCallback(
    async (id: string, next: boolean) => {
      setItems((prev) => sortItems(prev.map((it) => (it.id === id ? { ...it, pinned: next } : it))))
      try {
        const r = await authFetch(apiUrl('/api/pro-diagnosis-archive'), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, pinned: next }),
        })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
      } catch (e) {
        console.error('[Archive pin]', e)
        setItems((prev) =>
          sortItems(prev.map((it) => (it.id === id ? { ...it, pinned: !next } : it))),
        )
      }
    },
    [],
  )

  const remove = useCallback(
    async (id: string) => {
      if (!window.confirm('이 진단 기록을 삭제할까요?')) return
      try {
        const r = await authFetch(apiUrl(`/api/pro-diagnosis-archive?id=${encodeURIComponent(id)}`), {
          method: 'DELETE',
        })
        if (!r.ok) {
          const d = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(d.error || `HTTP ${r.status}`)
        }
        setItems((prev) => prev.filter((it) => it.id !== id))
        setDetail((prev) => (prev?.id === id ? null : prev))
      } catch (e) {
        console.error('[Archive delete]', e)
      }
    },
    [],
  )

  const isTimeline = Boolean(codeFilter)

  const handleBack = useCallback(() => {
    if (isTimeline) {
      setLoading(true)
      setCodeFilter('')
      navigate('/pro/archive')
      return
    }
    navigate('/pro')
  }, [isTimeline, navigate])

  return (
    <div className="min-h-screen w-full min-w-0 max-w-full bg-gray-50">
      <div className="max-md:min-h-[calc(100dvh-2rem)] max-md:overflow-y-auto">
        <div className={`${PRO_CONTENT_WRAP} min-w-0 py-4 pb-12`}>
          <div className="mb-1 flex items-center gap-2">
            <button
              type="button"
              onClick={handleBack}
              className="flex-shrink-0 rounded-lg p-1.5 hover:bg-gray-100"
              aria-label="뒤로"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <Archive size={22} className="flex-shrink-0 text-amber-500" strokeWidth={1.8} aria-hidden />
            <h1 className="min-w-0 truncate text-[16px] font-bold text-gray-900 sm:text-[20px]">
              {isTimeline ? `진단 타임라인 · ${codeFilter}` : '진단 아카이브'}
            </h1>
          </div>
          <p className="mb-4 pl-9 text-[11px] text-gray-400">
            {isTimeline
              ? '이 종목의 과거 AI 진단 이력과 진단 이후 성과입니다.'
              : '보유종목·포트폴리오·그룹 AI 진단이 생성될 때마다 자동 보관됩니다.'}
          </p>

          {!isTimeline ? (
            <>
              {stats && stats.scored > 0 ? (
                <div className="mb-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                  <div className="mb-2 text-[12px] font-bold text-gray-700">
                    AI 진단 성과{' '}
                    <span className="font-normal text-gray-400">
                      (보유종목 진단 {stats.scored}건 평가)
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="text-[10px] text-gray-400">적중률</div>
                      <div className="text-[16px] font-bold tabular-nums text-gray-900">
                        {stats.hitRate != null ? `${stats.hitRate.toFixed(0)}%` : '—'}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        적중 {stats.hit} · 빗나감 {stats.miss}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400">평균 진단후 수익률</div>
                      <div
                        className={`text-[16px] font-bold tabular-nums ${
                          stats.avgReturnPct != null ? signedClass(stats.avgReturnPct) : 'text-gray-900'
                        }`}
                      >
                        {stats.avgReturnPct != null
                          ? `${stats.avgReturnPct > 0 ? '+' : ''}${stats.avgReturnPct.toFixed(1)}%`
                          : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400">평가 / 전체</div>
                      <div className="text-[16px] font-bold tabular-nums text-gray-900">
                        {stats.scored}/{stats.total}
                      </div>
                    </div>
                  </div>
                  {Object.keys(stats.verdictDist).length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Object.entries(stats.verdictDist)
                        .sort((a, b) => b[1] - a[1])
                        .map(([v, c]) => (
                          <span
                            key={v}
                            className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                          >
                            {v} {c}
                          </span>
                        ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mb-3 flex gap-1.5">
                {KIND_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setKind(t.id)}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                      kind === t.id
                        ? 'bg-gray-900 text-white'
                        : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

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
                    placeholder="종목명 · 코드 검색"
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
            </>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="size-6 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center text-[13px] text-red-600">
              {error}
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-16 text-center text-[13px] text-gray-400">
              보관된 진단이 없습니다.
            </div>
          ) : (
            <ul className="space-y-2">
              {visibleItems.map((it) => {
                const badge = KIND_BADGE[it.kind]
                const verdict = it.meta?.verdict
                const summary = it.meta?.summary
                const outcome = it.outcome ? OUTCOME_BADGE[it.outcome] : null
                return (
                  <li
                    key={it.id}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => void openDetail(it.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                          {verdict ? (
                            <span className="shrink-0 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                              {verdict}
                            </span>
                          ) : null}
                          {outcome ? (
                            <span
                              className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${outcome.className}`}
                            >
                              {outcome.label}
                            </span>
                          ) : null}
                          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-gray-900">
                            {it.title}
                          </span>
                        </span>
                        {summary ? (
                          <span className="mt-1 block line-clamp-2 text-[12px] leading-relaxed text-gray-500">
                            {summary}
                          </span>
                        ) : null}
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-400">
                          <span className="tabular-nums">{formatDateTime(it.created_at)}</span>
                          {it.current_price != null && it.livePrice != null && it.returnSincePct != null ? (
                            <span className="tabular-nums">
                              {formatWon(it.current_price)} → {formatWon(it.livePrice)}
                              <span className={`ml-1 font-semibold ${signedClass(it.returnSincePct)}`}>
                                ({it.returnSincePct > 0 ? '+' : ''}
                                {it.returnSincePct.toFixed(2)}%)
                              </span>
                            </span>
                          ) : it.profit_pct != null ? (
                            <span className={`font-semibold tabular-nums ${signedClass(it.profit_pct)}`}>
                              진단시 {it.profit_pct > 0 ? '+' : ''}
                              {it.profit_pct.toFixed(2)}%
                            </span>
                          ) : null}
                        </span>
                      </button>
                      <div className="flex flex-shrink-0 flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void togglePin(it.id, !it.pinned)}
                          className={`rounded-lg p-1.5 hover:bg-amber-50 ${
                            it.pinned ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'
                          }`}
                          aria-label={it.pinned ? '핀 해제' : '핀 고정'}
                          title={it.pinned ? '핀 해제' : '핀 고정'}
                        >
                          <Star size={16} fill={it.pinned ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(it.id)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                          aria-label="삭제"
                          title="삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {detail || detailLoading ? (
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
              {detail ? (
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${KIND_BADGE[detail.kind].className}`}
                >
                  {KIND_BADGE[detail.kind].label}
                </span>
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-bold text-gray-900">
                  {detail?.title ?? '불러오는 중...'}
                </div>
                {detail ? (
                  <div className="text-[11px] text-gray-400">{formatDateTime(detail.created_at)}</div>
                ) : null}
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
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {detailLoading || !detail ? (
                <div className="flex justify-center py-16">
                  <div className="size-6 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
                </div>
              ) : (
                <MarkdownMessage content={detail.analysis} />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
