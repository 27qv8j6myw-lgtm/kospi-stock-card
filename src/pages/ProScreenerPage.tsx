'use client'

import { useCallback, useMemo, useState } from 'react'
import { Archive, ArrowLeft, RotateCw, SlidersHorizontal, Sparkles } from 'lucide-react'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { useResumeAiResult } from '@/hooks/useResumeAiResult'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { PRO_CONTENT_WRAP } from '@/lib/proStockDesign'

type SubScores = {
  structure: number
  execution: number
  market: number
  supplyDemand: number
  rsi: number
  atrGap: number
}

type ScreenerStock = {
  code: string
  name: string
  sectorId: string
  sectorLabel: string
  totalScore: number
  subScores: SubScores
  per: number
  expected1MPct: number
  currentPrice: number
  changePct: number
  sectorReturn5D: number
  entryStage: string
}

type SectorSummary = {
  id: string
  label: string
  avgScore: number
  sectorReturn5D: number
  kospiReturn5D: number
  isLeading: boolean
}

type TopFiveStock = {
  rank: number
  code: string
  name: string
  sectorLabel: string
  score: number
  expected1MPct: number
  per?: number
  consensusUpside?: number | null
  aiCandidateLabel?: string
  aiHeadline?: string
  aiSummary?: string
  aiKeyDriver?: string
  aiRisk?: string
  aiSplitPrices?: number[]
  consensusEstimate?: string | null
  /** 심층 통찰 — 관리자(Fable) 심층 모드에서만 채워진다 */
  aiDeepInsight?: string
}

type ScreenerResponse = {
  generatedAt: string | null
  sectors: SectorSummary[]
  allStocks: ScreenerStock[]
  topFive: TopFiveStock[]
  source: string | null
  cached: boolean
}

type SortKey = 'total' | 'structure' | 'execution' | 'supplyDemand' | 'expected' | 'change'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'total', label: '종합점수' },
  { key: 'structure', label: '구조' },
  { key: 'execution', label: '실행' },
  { key: 'supplyDemand', label: '수급' },
  { key: 'expected', label: '기대수익' },
  { key: 'change', label: '등락률' },
]

const MIN_SCORE_OPTIONS = [0, 60, 70, 80]

const SCREENER_GUIDE_LINES = [
  'AI 추천 TOP5와 룰 기반 종합점수(구조·실행·시장 가중)를 제공합니다.',
  '실행 시 KIS 시세·AI 분석을 호출합니다.',
  '결과는 1시간 캐시로 공유되며 새로고침 시 재호출됩니다.',
]

function formatTime(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function scoreTextClass(s: number) {
  if (s >= 80) return 'text-red-600'
  if (s >= 70) return 'text-amber-600'
  if (s >= 60) return 'text-gray-900'
  return 'text-gray-400'
}

function scoreBadgeClass(s: number) {
  if (s >= 80) return 'bg-red-50 text-red-600'
  if (s >= 70) return 'bg-amber-50 text-amber-600'
  if (s >= 60) return 'bg-gray-100 text-gray-700'
  return 'bg-gray-100 text-gray-400'
}

function changeClass(pct: number) {
  if (pct > 0) return 'text-red-600'
  if (pct < 0) return 'text-blue-600'
  return 'text-gray-500'
}

function sortValue(s: ScreenerStock, key: SortKey): number {
  switch (key) {
    case 'structure':
      return s.subScores.structure
    case 'execution':
      return s.subScores.execution
    case 'supplyDemand':
      return s.subScores.supplyDemand
    case 'expected':
      return s.expected1MPct
    case 'change':
      return s.changePct
    case 'total':
    default:
      return s.totalScore
  }
}

export default function ProScreenerPage() {
  const { navigate } = useAppNavigation()
  const [data, setData] = useState<ScreenerResponse | null>(null)
  // 진입 시 자동 실행하지 않음 — 사용자가 "스크리닝 실행" 버튼을 눌러야 조회
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [sectorFilter, setSectorFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('total')
  const [minScore, setMinScore] = useState(0)

  const fetchScreener = useCallback(async (force: boolean) => {
    const r = await authFetch(apiUrl(`/api/pro-screener${force ? '?force=1' : ''}`))
    const d = (await r.json().catch(() => ({}))) as ScreenerResponse & { error?: string }
    if (!r.ok) throw new Error(d.error || r.statusText)
    return d
  }, [])

  /** 복귀 조회 — 서버가 백그라운드로 끝낸 결과가 캐시에 있을 때만 반환 (재계산 없음) */
  const fetchCachedScreener = useCallback(async () => {
    const r = await authFetch(apiUrl('/api/pro-screener?cachedOnly=1'))
    const d = (await r.json().catch(() => ({}))) as ScreenerResponse & {
      pending?: boolean
      error?: string
    }
    if (!r.ok || d.pending || !d.generatedAt) return null
    return d
  }, [])

  const {
    pending: resuming,
    start: markStarted,
    finish: markFinished,
  } = useResumeAiResult<ScreenerResponse>({
    key: 'screener',
    fetchCached: fetchCachedScreener,
    onResolved: (d) => {
      setData(d)
      setError(null)
    },
  })

  const handleRun = useCallback(async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    markStarted()
    try {
      const d = await fetchScreener(false)
      setData(d)
      markFinished()
    } catch (e) {
      // 표식은 유지 — 화면이 꺼져 끊긴 경우 복귀 시 캐시에서 결과를 살린다
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [fetchScreener, loading, markFinished, markStarted])

  const handleRefresh = useCallback(async () => {
    if (refreshing) return
    setRefreshing(true)
    markStarted()
    try {
      const d = await fetchScreener(true)
      setData(d)
      setError(null)
      markFinished()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRefreshing(false)
    }
  }, [fetchScreener, markFinished, markStarted, refreshing])

  const sectors = data?.sectors ?? []
  const stocks = useMemo(() => data?.allStocks ?? [], [data])
  const topFive = useMemo(
    () => (data?.topFive ?? []).slice().sort((a, b) => a.rank - b.rank),
    [data],
  )

  const visibleStocks = useMemo(() => {
    const filtered = stocks.filter(
      (s) =>
        (sectorFilter === 'all' || s.sectorId === sectorFilter) && s.totalScore >= minScore,
    )
    return filtered
      .slice()
      .sort((a, b) => sortValue(b, sortKey) - sortValue(a, sortKey) || b.totalScore - a.totalScore)
  }, [stocks, sectorFilter, minScore, sortKey])

  return (
    <div className="min-h-screen w-full min-w-0 max-w-full bg-gray-50">
      <div className="max-md:min-h-[calc(100dvh-2rem)] max-md:overflow-y-auto">
        <div className={`${PRO_CONTENT_WRAP} min-w-0 py-4 pb-12`}>
          <div className="mb-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/pro')}
              className="flex-shrink-0 rounded-lg p-1.5 hover:bg-gray-100"
              aria-label="Pro 홈"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <SlidersHorizontal
              size={22}
              className="flex-shrink-0 text-amber-500"
              strokeWidth={1.8}
              aria-hidden
            />
            <h1 className="min-w-0 truncate text-[16px] font-bold text-gray-900 sm:text-[20px]">
              스크리너
            </h1>
            {data?.generatedAt ? (
              <span className="ml-auto text-[11px] tabular-nums text-gray-400">
                {formatTime(data.generatedAt)} 기준
              </span>
            ) : (
              <span className="ml-auto" />
            )}
            <button
              type="button"
              onClick={() => navigate('/pro/screener/archive')}
              aria-label="스크리너 아카이브"
              title="스크리너 아카이브"
              className="flex-shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              <Archive size={18} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={refreshing || loading}
              aria-label="새로고침"
              title="새로고침 (시세·AI 재조회)"
              className="flex-shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            >
              <RotateCw size={18} className={refreshing ? 'animate-spin' : ''} strokeWidth={2} />
            </button>
          </div>
          {loading ? (
            <div className="py-12 text-center text-[13px] text-gray-400">스크리닝 실행 중...</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-center">
              <div className="text-[13px] text-red-700">{error}</div>
              {resuming ? (
                <div className="mt-2 text-[12px] leading-relaxed text-gray-500">
                  서버에서 분석이 계속 진행 중일 수 있습니다. 완료되면 자동으로 표시됩니다.
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => void handleRun()}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-red-700"
              >
                <RotateCw size={15} strokeWidth={2.2} />
                다시 실행
              </button>
            </div>
          ) : !data && resuming ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 px-4 py-14 text-center">
              <RotateCw
                size={30}
                className="mx-auto mb-3 animate-spin text-amber-500"
                strokeWidth={1.8}
                aria-hidden
              />
              <div className="text-[14px] font-semibold text-gray-800">백그라운드에서 분석 중</div>
              <p className="mx-auto mt-1 max-w-xs text-[12px] leading-relaxed text-gray-500">
                화면이 꺼져도 서버에서 계속 진행됩니다. 완료되면 자동으로 표시됩니다.
              </p>
            </div>
          ) : !data ? (
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-14 text-center">
              <SlidersHorizontal
                size={32}
                className="mx-auto mb-3 text-amber-400"
                strokeWidth={1.6}
                aria-hidden
              />
              <div className="text-[14px] font-semibold text-gray-800">스크리닝을 실행하세요</div>
              <div className="mx-auto mt-1 max-w-xs text-[12px] leading-relaxed text-gray-400">
                {SCREENER_GUIDE_LINES.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void handleRun()}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-5 py-2.5 text-[14px] font-bold text-white hover:bg-amber-600"
              >
                <SlidersHorizontal size={16} strokeWidth={2.2} />
                스크리닝 실행
              </button>
            </div>
          ) : (
            <>
              {resuming && !refreshing ? (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-[12px] text-amber-800">
                  <RotateCw size={14} className="animate-spin" strokeWidth={2} aria-hidden />
                  백그라운드에서 분석 중입니다. 완료되면 자동으로 갱신됩니다.
                </div>
              ) : null}

              {/* AI 추천 TOP5 */}
              {topFive.length > 0 ? (
                <div className="mb-4">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Sparkles size={15} className="text-amber-500" strokeWidth={2} aria-hidden />
                    <h2 className="text-[13px] font-bold text-gray-900">AI 추천 TOP5</h2>
                  </div>
                  <div className="space-y-2">
                    {topFive.map((t) => (
                      <button
                        key={t.code}
                        type="button"
                        onClick={() =>
                          navigate(`/pro/stock/${t.code}?name=${encodeURIComponent(t.name)}`)
                        }
                        className="block w-full rounded-2xl border border-amber-200 bg-amber-50/40 p-3 text-left transition-colors hover:bg-amber-50"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white tabular-nums">
                            {t.rank}
                          </span>
                          <span className="truncate text-[14px] font-bold text-gray-900">
                            {t.name}
                          </span>
                          <span className="flex-shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-500 ring-1 ring-gray-200">
                            {t.sectorLabel}
                          </span>
                          {t.aiCandidateLabel ? (
                            <span className="flex-shrink-0 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {t.aiCandidateLabel}
                            </span>
                          ) : null}
                          <span
                            className={`ml-auto flex-shrink-0 rounded-md px-2 py-0.5 text-[13px] font-bold tabular-nums ${scoreBadgeClass(t.score)}`}
                          >
                            {t.score}
                          </span>
                        </div>

                        {t.aiHeadline ? (
                          <p className="mt-2 text-[12px] font-semibold text-gray-800">
                            {t.aiHeadline}
                          </p>
                        ) : null}
                        {t.aiSummary ? (
                          <p className="mt-1 text-[11px] leading-relaxed text-gray-600">
                            {t.aiSummary}
                          </p>
                        ) : null}

                        <div className="mt-2 space-y-0.5">
                          {t.aiKeyDriver ? (
                            <div className="flex gap-1 text-[11px]">
                              <span className="flex-shrink-0 font-bold text-emerald-600">동인</span>
                              <span className="text-gray-600">{t.aiKeyDriver}</span>
                            </div>
                          ) : null}
                          {t.aiRisk ? (
                            <div className="flex gap-1 text-[11px]">
                              <span className="flex-shrink-0 font-bold text-rose-600">리스크</span>
                              <span className="text-gray-600">{t.aiRisk}</span>
                            </div>
                          ) : null}
                        </div>

                        {t.aiDeepInsight ? (
                          <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/60 p-2.5">
                            <div className="mb-1 text-[10px] font-bold text-indigo-700">심층 통찰</div>
                            <p className="whitespace-pre-line text-[11px] leading-relaxed text-gray-700">
                              {t.aiDeepInsight}
                            </p>
                          </div>
                        ) : null}

                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] tabular-nums text-gray-500">
                          {t.expected1MPct > 0 ? (
                            <span className="font-bold text-red-600">기대 +{t.expected1MPct}%</span>
                          ) : null}
                          {Array.isArray(t.aiSplitPrices) && t.aiSplitPrices.length > 0 ? (
                            <span>
                              분할매수{' '}
                              <span className="font-medium text-gray-700">
                                {t.aiSplitPrices.map((p) => p.toLocaleString()).join(' / ')}
                              </span>
                            </span>
                          ) : null}
                          {t.consensusEstimate ? (
                            <span>컨센서스 {t.consensusEstimate}</span>
                          ) : typeof t.consensusUpside === 'number' && t.consensusUpside !== 0 ? (
                            <span>
                              컨센 상승여력{' '}
                              <span className="font-bold text-red-600">+{t.consensusUpside}%</span>
                            </span>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* 섹터 요약 + 필터 */}
              {sectors.length > 0 ? (
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setSectorFilter('all')}
                    className={`flex-shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors ${
                      sectorFilter === 'all'
                        ? 'bg-gray-900 text-white'
                        : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-gray-300'
                    }`}
                  >
                    전체
                  </button>
                  {sectors.map((sec) => {
                    const active = sectorFilter === sec.id
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => setSectorFilter(sec.id)}
                        className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors ${
                          active
                            ? 'bg-gray-900 text-white'
                            : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-gray-300'
                        }`}
                      >
                        <span>{sec.label}</span>
                        <span
                          className={`tabular-nums ${active ? 'text-gray-300' : scoreTextClass(sec.avgScore)}`}
                        >
                          {sec.avgScore}
                        </span>
                        {sec.isLeading ? (
                          <span className="rounded bg-amber-400/90 px-1 text-[9px] font-bold text-white">
                            주도
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ) : null}

              {/* 정렬 + 최소 점수 */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="flex gap-0.5 overflow-x-auto rounded-lg bg-gray-100 p-0.5">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setSortKey(opt.key)}
                      className={`flex-shrink-0 rounded px-2.5 py-1 text-[11px] font-bold transition-colors ${
                        sortKey === opt.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <span className="text-[11px] text-gray-400">최소점수</span>
                  {MIN_SCORE_OPTIONS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setMinScore(v)}
                      className={`rounded-md px-2 py-1 text-[11px] font-bold tabular-nums transition-colors ${
                        minScore === v
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {v === 0 ? '전체' : v}
                    </button>
                  ))}
                </div>
              </div>

              {/* 종목 리스트 */}
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                {visibleStocks.length === 0 ? (
                  <div className="py-12 text-center text-[13px] text-gray-400">
                    조건에 맞는 종목이 없습니다.
                  </div>
                ) : (
                  visibleStocks.map((s, idx) => (
                    <button
                      key={s.code}
                      type="button"
                      onClick={() =>
                        navigate(`/pro/stock/${s.code}?name=${encodeURIComponent(s.name)}`)
                      }
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                        idx !== visibleStocks.length - 1 ? 'border-b border-gray-100' : ''
                      }`}
                    >
                      <span className="w-5 flex-shrink-0 text-center text-[12px] font-bold tabular-nums text-gray-400">
                        {idx + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[14px] font-bold text-gray-900">
                            {s.name}
                          </span>
                          <span className="flex-shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                            {s.sectorLabel}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] tabular-nums text-gray-500">
                          <span>{s.currentPrice > 0 ? `${s.currentPrice.toLocaleString()}원` : '—'}</span>
                          {Number.isFinite(s.changePct) ? (
                            <span className={`font-bold ${changeClass(s.changePct)}`}>
                              {s.changePct > 0 ? '+' : ''}
                              {s.changePct.toFixed(1)}%
                            </span>
                          ) : null}
                          <span className="text-gray-300">·</span>
                          <span>구조 {s.subScores.structure}</span>
                          <span>실행 {s.subScores.execution}</span>
                          <span>수급 {s.subScores.supplyDemand}</span>
                          {s.expected1MPct > 0 ? (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className="font-bold text-red-600">
                                기대 +{s.expected1MPct}%
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex-shrink-0 text-right">
                        <div
                          className={`inline-flex items-center justify-center rounded-md px-2 py-1 text-[14px] font-bold tabular-nums ${scoreBadgeClass(s.totalScore)}`}
                        >
                          {s.totalScore}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <p className="mt-3 text-[10px] text-gray-400">
                참고용 정량 점수이며 투자 권유가 아닙니다. 새로고침은 시세를 재조회합니다.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
