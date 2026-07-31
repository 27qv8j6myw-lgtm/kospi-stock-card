import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Archive, Download, Loader2, RotateCw, Share2 } from 'lucide-react'
import {
  ProActionButtons,
  ProChartQuoteSection,
  ProDisclosuresSection,
  ProNewsSection,
  ProOpusSection,
  ProSectionGrid,
  ProStickySearch,
  ProStockShareCard,
} from '@/components/stock/pro'
import { QuoteBasisBadge } from '@/components/pro/QuoteBasisBadge'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { useKrxDataPolling } from '@/hooks/useKrxDataPolling'
import { clearAiTaskPending, markAiTaskPending, useResumeAiResult } from '@/hooks/useResumeAiResult'
import { useVisibilityDataRefresh } from '@/hooks/useVisibilityDataRefresh'
import { authFetch } from '@/lib/api'
import { friendlyProChatError } from '@/lib/friendlyAnthropicError'
import { apiUrl } from '@/lib/apiBase'
import {
  buildProStockCardSections,
  proSectionIcons,
  type ProSummaryExtended,
  type TechnicalSnapshot,
} from '@/lib/buildProStockCardSections'
import { PRO_STOCK_SCROLL_OFFSET, proDesign } from '@/lib/proStockDesign'
import { captureToBlob, downloadImage, shareStockImage } from '@/lib/shareStockCard'
import { STOCK_CODE_PATH_RE } from '@/lib/stockCode'

function detectCodeFromPath(pathname: string): string | undefined {
  const m = pathname.match(/^\/pro\/stock\/([^/]+)\/?$/)
  const raw = m?.[1]
  if (!raw || !STOCK_CODE_PATH_RE.test(raw)) return undefined
  return raw.toUpperCase()
}

function useStockNameFromUrl(code: string | undefined): string | null {
  const { pathname } = useAppNavigation()
  return useMemo(() => {
    if (typeof window === 'undefined' || !code) return null
    if (!pathname.includes(`/pro/stock/${code}`)) return null
    const raw = new URLSearchParams(window.location.search).get('name')
    return raw?.trim() || null
  }, [pathname, code])
}

function changeClass(pct: number): string {
  if (pct > 0) return 'text-red-600'
  if (pct < 0) return 'text-blue-600'
  return 'text-gray-600'
}

/** 심층 분석 사전 조사 단계에서 서버가 보내는 도구 이름 → 사용자 표시 문구 */
const RESEARCH_TOOL_LABELS: Record<string, string> = {
  searchNews: '최근 뉴스',
  getDisclosures: '공시',
  getDailyChart: '일봉 추세',
  getInvestorTrend: '수급 동향',
  getValuation: '밸류에이션',
  get52Week: '52주 가격대',
  getAnalystReports: '증권사 컨센서스',
  getMarketIndices: '시장 지수',
  getStockQuote: '실시간 시세',
}

function researchLabel(parsed: { tool?: string }): string {
  const label = parsed.tool ? RESEARCH_TOOL_LABELS[parsed.tool] : null
  return label ? `${label} 조사 중` : '데이터 조사 중'
}

type StoredAnalysis = {
  analysis?: string
  model?: string
  generatedAt?: string | null
  pastDiagnoses?: number
  pending?: boolean
}

/** null 필드는 기존 값을 덮어쓰지 않도록 걸러낸다 */
function omitNulls<T extends object>(obj: T): { [K in keyof T]?: Exclude<T[K], null> } {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null)) as {
    [K in keyof T]?: Exclude<T[K], null>
  }
}

export default function ProStockCardPage() {
  const { pathname, navigate } = useAppNavigation()
  const code = useMemo(() => detectCodeFromPath(pathname), [pathname])
  const urlName = useStockNameFromUrl(code)

  const [summary, setSummary] = useState<ProSummaryExtended | null>(null)
  const [technical, setTechnical] = useState<TechnicalSnapshot>(null)
  const [analysis, setAnalysis] = useState('')
  const [analysisModel, setAnalysisModel] = useState<string | null>(null)
  const [analysisGeneratedAt, setAnalysisGeneratedAt] = useState<string | null>(null)
  const [pastDiagnoses, setPastDiagnoses] = useState(0)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState<string | null>(null)

  const analysisTaskKey = `stock-analysis:${code ?? ''}`

  const loadAnalysis = useCallback(
    async (summaryData: ProSummaryExtended, stockCode: string, opts?: { force?: boolean }) => {
      setLoadingAnalysis(true)
      setAnalysis('')
      setAnalysisModel(null)
      setAnalysisGeneratedAt(null)
      setAnalysisProgress(null)
      setPastDiagnoses(0)
      markAiTaskPending(`stock-analysis:${stockCode}`)

      try {
        const response = await authFetch(apiUrl('/api/pro-stock-analysis'), {
          method: 'POST',
          body: JSON.stringify({
            code: stockCode,
            summary: summaryData,
            force: opts?.force === true,
          }),
        })

        if (!response.ok || !response.body) throw new Error('No stream')

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const events = buffer.split('\n\n')
          buffer = events.pop() || ''

          for (const eventBlock of events) {
            if (!eventBlock.trim()) continue
            const lines = eventBlock.split('\n')
            let eventName = ''
            let dataStr = ''
            for (const line of lines) {
              if (line.startsWith('event: ')) eventName = line.slice(7)
              if (line.startsWith('data: ')) dataStr = line.slice(6)
            }
            if (!dataStr) continue
            try {
              const parsed = JSON.parse(dataStr) as {
                delta?: string
                message?: string
                model?: string
                pastDiagnoses?: number
                generatedAt?: string | null
                status?: string
                tool?: string
              }
              if (eventName === 'meta') {
                if (parsed.model) setAnalysisModel(parsed.model)
                if (typeof parsed.pastDiagnoses === 'number') setPastDiagnoses(parsed.pastDiagnoses)
                setAnalysisGeneratedAt(parsed.generatedAt ?? null)
              }
              if (eventName === 'research') {
                setAnalysisProgress(
                  parsed.status === 'done' ? '조사한 데이터로 분석 작성 중' : researchLabel(parsed),
                )
              }
              if (eventName === 'text' && parsed.delta) {
                setAnalysisProgress(null)
                setAnalysis((prev) => prev + parsed.delta)
              }
              if (eventName === 'error') {
                setAnalysis(friendlyProChatError(parsed.message || '분석에 실패했습니다'))
              }
            } catch {
              // ignore malformed chunk
            }
          }
        }

        clearAiTaskPending(`stock-analysis:${stockCode}`)
      } catch (e) {
        // 표식은 유지 — 화면이 꺼져 스트림이 끊긴 경우 복귀 시 저장된 분석을 가져온다
        console.error(e)
      } finally {
        setLoadingAnalysis(false)
      }
    },
    [],
  )

  /** 저장된 분석만 조회 — 없으면 null (새 분석을 시작하지 않는다) */
  const fetchCachedAnalysis = useCallback(async () => {
    if (!code) return null
    const r = await authFetch(apiUrl('/api/pro-stock-analysis'), {
      method: 'POST',
      body: JSON.stringify({ code, cachedOnly: true }),
    })
    const d = (await r.json().catch(() => null)) as StoredAnalysis | null
    if (!r.ok || !d?.analysis) return null
    return d
  }, [code])

  const applyStoredAnalysis = useCallback((d: StoredAnalysis) => {
    setAnalysis(d.analysis ?? '')
    if (d.model) setAnalysisModel(d.model)
    setAnalysisGeneratedAt(d.generatedAt ?? null)
    if (typeof d.pastDiagnoses === 'number') setPastDiagnoses(d.pastDiagnoses)
    setLoadingAnalysis(false)
  }, [])

  const { pending: analysisResuming } = useResumeAiResult<StoredAnalysis>({
    key: analysisTaskKey,
    // 스트리밍이 살아 있는 동안에는 복귀 조회가 화면을 덮어쓰지 않도록 비활성
    enabled: Boolean(code) && !loadingAnalysis,
    fetchCached: fetchCachedAnalysis,
    onResolved: applyStoredAnalysis,
  })

  /** 진입 시엔 저장된 분석만 살린다. 새 분석은 사용자가 버튼을 눌러야 시작한다. */
  const storedProbedForRef = useRef<string | null>(null)
  useEffect(() => {
    if (!code) return
    if (storedProbedForRef.current === code) return
    storedProbedForRef.current = code

    let cancelled = false
    // 다른 종목의 분석이 남아 보이지 않도록 먼저 비운다
    setAnalysis('')
    setAnalysisModel(null)
    setAnalysisGeneratedAt(null)
    setAnalysisProgress(null)
    setPastDiagnoses(0)
    setLoadingAnalysis(true)

    void fetchCachedAnalysis()
      .then((d) => {
        if (cancelled || !d) return
        applyStoredAnalysis(d)
      })
      .catch((e) => {
        console.error('[Pro Stock Analysis cache]', e)
      })
      .finally(() => {
        if (!cancelled) setLoadingAnalysis(false)
      })

    return () => {
      cancelled = true
    }
  }, [code, fetchCachedAnalysis, applyStoredAnalysis])

  useEffect(() => {
    if (code) window.scrollTo(0, 0)
  }, [code])

  const pollQuote = useCallback(async () => {
    if (!code) return
    try {
      const r = await authFetch(apiUrl(`/api/pro-stock-quote?code=${encodeURIComponent(code)}`))
      if (!r.ok) return
      const d = (await r.json()) as {
        quote?: {
          currentPrice?: number | null
          change?: number | null
          changePct?: number | null
          openPrice?: number | null
          dayHigh?: number | null
          dayLow?: number | null
          volume?: number | null
          tradingAmount?: number | null
          basisLabel?: string | null
        }
      }
      if (!d.quote) return
      const { basisLabel, ...fields } = d.quote
      setSummary((prev) =>
        prev
          ? {
              ...prev,
              quote: {
                ...prev.quote,
                ...omitNulls(fields),
                basisLabel: basisLabel ?? null,
              },
            }
          : prev,
      )
    } catch {
      // ignore poll errors
    }
  }, [code])

  const reloadSnapshot = useCallback(
    async (opts?: { reset?: boolean }) => {
      if (!code) return
      setLoadingSummary(true)
      if (opts?.reset) {
        setSummary(null)
        setTechnical(null)
      }

      try {
        const [summaryRes, techRes] = await Promise.all([
          authFetch(apiUrl(`/api/pro-stock-summary?code=${code}`)),
          authFetch(apiUrl(`/api/pro-stock-technical?code=${code}`)),
        ])

        const summaryData = summaryRes.ok
          ? ((await summaryRes.json()) as ProSummaryExtended | null)
          : null
        const techData = techRes.ok ? ((await techRes.json()) as TechnicalSnapshot) : null

        setSummary(summaryData)
        setTechnical(techData)

        await pollQuote()
      } catch (e) {
        console.error('Summary error:', e)
      } finally {
        setLoadingSummary(false)
      }
    },
    [code, pollQuote],
  )

  useEffect(() => {
    if (!code) return
    void reloadSnapshot({ reset: true })
  }, [code, reloadSnapshot])

  const refetchData = useCallback(async () => {
    await reloadSnapshot()
  }, [reloadSnapshot])

  /** 사용자가 버튼을 눌렀을 때만 분석 호출 (진입만으로는 과금하지 않는다) */
  const startAnalysis = useCallback(() => {
    if (!code || !summary || loadingAnalysis) return
    void loadAnalysis(summary, code)
  }, [code, summary, loadingAnalysis, loadAnalysis])

  /** 저장된 분석을 버리고 새로 생성 (같은 날·같은 시세 구간에서도 재분석) */
  const regenerateAnalysis = useCallback(() => {
    if (!code || !summary || loadingAnalysis) return
    void loadAnalysis(summary, code, { force: true })
  }, [code, summary, loadingAnalysis, loadAnalysis])

  useVisibilityDataRefresh(refetchData)
  useKrxDataPolling(pollQuote)

  const displayName = summary?.name || urlName || code || '—'
  const pct = summary?.quote?.changePct ?? 0
  const subtitleParts = [code, summary?.quote?.market, summary?.quote?.sector].filter(Boolean)

  const sections = useMemo(
    () => (summary ? buildProStockCardSections(summary, technical) : null),
    [summary, technical],
  )

  const shareRef = useRef<HTMLDivElement>(null)
  const [sharing, setSharing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [toast, setToast] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const shareReady = analysis.trim().length > 0 && !loadingAnalysis

  const showToast = useCallback((kind: 'ok' | 'error', text: string) => {
    setToast({ kind, text })
    window.setTimeout(() => setToast(null), 2600)
  }, [])

  const captureWithRetry = useCallback(async (node: HTMLElement): Promise<Blob> => {
    try {
      return await captureToBlob(node)
    } catch {
      return await captureToBlob(node)
    }
  }, [])

  const handleShare = useCallback(async () => {
    const node = shareRef.current
    if (!node || sharing) return
    setSharing(true)
    try {
      const blob = await captureWithRetry(node)
      const result = await shareStockImage(blob, {
        filename: `${displayName}_${code ?? 'stock'}.png`,
        title: `${displayName} 종목 분석`,
        text: `${displayName} AI 종목 분석`,
      })
      if (result === 'shared') showToast('ok', '공유했어요')
      else if (result === 'copied') showToast('ok', '클립보드에 복사했어요 (붙여넣기 하세요)')
      else showToast('ok', '이미지를 저장했어요')
    } catch (e) {
      console.error('[share]', e)
      showToast('error', '공유에 실패했어요')
    } finally {
      setSharing(false)
    }
  }, [sharing, displayName, code, showToast, captureWithRetry])

  const handleDownload = useCallback(async () => {
    const node = shareRef.current
    if (!node || downloading) return
    setDownloading(true)
    try {
      const blob = await captureWithRetry(node)
      downloadImage(blob, `${displayName}_${code ?? 'stock'}.png`)
      showToast('ok', '이미지를 저장했어요')
    } catch (e) {
      console.error('[download]', e)
      showToast('error', '저장에 실패했어요')
    } finally {
      setDownloading(false)
    }
  }, [downloading, displayName, code, showToast, captureWithRetry])

  return (
    <div className="min-h-screen w-full min-w-0 max-w-full bg-gray-50">
      {code ? <ProStickySearch currentCode={code} /> : null}

      <div
        className={`${proDesign.page} ${PRO_STOCK_SCROLL_OFFSET} max-md:overflow-y-auto max-md:overscroll-y-contain`}
      >
        {loadingSummary ? (
          <div className={proDesign.card}>
            <div className="border-b border-gray-100 px-5 py-4">
              <h1 className="text-[22px] font-bold text-gray-900">{urlName || code || '—'}</h1>
              {code ? <p className="mt-1 text-[12px] text-gray-500">{code}</p> : null}
              <div className="flex justify-center py-10">
                <div className="size-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
              </div>
              <p className="pb-2 text-center text-[13px] text-gray-500">종합 데이터 조회 중...</p>
            </div>
          </div>
        ) : !summary || !code ? (
          <div className="py-12 text-center text-[13px] text-gray-500">데이터 조회 실패</div>
        ) : (
          <div className={proDesign.card}>
            <div className="border-b border-gray-100 px-4 py-4 sm:px-5">
              <div className="mb-1 flex items-center gap-2">
                <h1 className="min-w-0 flex-1 truncate text-[22px] font-bold tracking-tight text-gray-900 md:text-[28px]">
                  {displayName}
                </h1>
                <span className={`shrink-0 ${proDesign.proBadge}`}>PRO</span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void refetchData()}
                    disabled={loadingSummary}
                    aria-label="새로고침"
                    title="새로고침"
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2 py-1.5 text-[12px] font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 sm:px-3"
                  >
                    <RotateCw size={14} aria-hidden />
                    <span className="hidden sm:inline">새로고침</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleShare()}
                    disabled={sharing || downloading || !shareReady}
                    aria-label="OPUS 분석 공유"
                    title={shareReady ? 'OPUS 분석 공유' : '분석 생성 후 가능합니다'}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2 py-1.5 text-[12px] font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 sm:px-3"
                  >
                    {sharing ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                    ) : (
                      <Share2 size={14} aria-hidden />
                    )}
                    <span className="hidden sm:inline">공유</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownload()}
                    disabled={sharing || downloading || !shareReady}
                    aria-label="이미지로 저장"
                    title={shareReady ? '이미지로 저장' : '분석 생성 후 가능합니다'}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2 py-1.5 text-[12px] font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 sm:px-3"
                  >
                    {downloading ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                    ) : (
                      <Download size={14} aria-hidden />
                    )}
                    <span className="hidden sm:inline">이미지 저장</span>
                  </button>
                </div>
              </div>
              {subtitleParts.length > 0 ? (
                <p className="mb-3 text-[12px] text-gray-500">{subtitleParts.join(' · ')}</p>
              ) : null}
              <div className="flex items-baseline gap-2.5">
                <span className="text-[28px] font-bold tabular-nums tracking-tight text-gray-900 md:text-[36px]">
                  {summary.quote?.currentPrice != null
                    ? `${summary.quote.currentPrice.toLocaleString()}원`
                    : '—'}
                </span>
                <span className={`text-[15px] font-semibold tabular-nums ${changeClass(pct)}`}>
                  {pct > 0 ? '+' : ''}
                  {pct.toFixed(2)}%
                </span>
                <QuoteBasisBadge label={summary.quote?.basisLabel} />
              </div>
            </div>

            {pastDiagnoses > 0 ? (
              <div className="px-4 pt-2 pb-1 sm:px-5">
                <button
                  type="button"
                  onClick={() => navigate(`/pro/archive?code=${encodeURIComponent(code)}`)}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-700 underline-offset-2 hover:underline"
                >
                  <Archive size={13} aria-hidden />
                  과거 진단 {pastDiagnoses}건 보기
                </button>
              </div>
            ) : null}
            <ProOpusSection
              analysis={analysis}
              loading={loadingAnalysis}
              model={analysisModel}
              generatedAt={analysisGeneratedAt}
              onStart={startAnalysis}
              onRegenerate={regenerateAnalysis}
              resuming={analysisResuming}
              progress={analysisProgress}
            />

            <ProChartQuoteSection
              code={code}
              market={summary.quote?.market}
              quote={summary.quote ?? {}}
              week52={summary.week52}
            />

            {sections?.strategy.length ? (
              <ProSectionGrid
                icon={proSectionIcons.strategy}
                title="매매 전략"
                meta="Pro"
                cards={sections.strategy}
              />
            ) : null}

            <ProSectionGrid
              icon={proSectionIcons.investor}
              title="수급"
              meta={`${summary.investor?.days ?? 5}일`}
              cards={sections?.investor ?? []}
            />

            <ProSectionGrid
              icon={proSectionIcons.valuation}
              title="가치 평가"
              meta="KIS 실시간"
              cards={sections?.valuation ?? []}
            />

            <ProSectionGrid
              icon={proSectionIcons.technical}
              title="기술 지표"
              cards={sections?.technical ?? []}
            />

            <ProNewsSection news={summary.news ?? []} newsSummary={summary.newsSummary} />

            <ProDisclosuresSection disclosures={summary.disclosures ?? []} />

            <ProActionButtons code={code} name={summary.name || code} />
          </div>
        )}
      </div>

      {summary && code ? (
        <div
          aria-hidden
          style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none', zIndex: -1 }}
        >
          <ProStockShareCard
            ref={shareRef}
            displayName={displayName}
            code={code}
            market={summary.quote?.market}
            sector={summary.quote?.sector}
            price={summary.quote?.currentPrice ?? null}
            changePct={pct}
            analysis={analysis}
            model={analysisModel}
            generatedAt={new Date()}
          />
        </div>
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div
            role="status"
            className={`pointer-events-auto rounded-full px-4 py-2 text-[13px] font-semibold text-white shadow-lg ${
              toast.kind === 'ok' ? 'bg-gray-900' : 'bg-red-600'
            }`}
          >
            {toast.text}
          </div>
        </div>
      ) : null}
    </div>
  )
}
