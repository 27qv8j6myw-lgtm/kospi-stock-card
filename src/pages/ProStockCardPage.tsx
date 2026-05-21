import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ProActionButtons,
  ProChartQuoteSection,
  ProNewsSection,
  ProOpusSection,
  ProSectionGrid,
  ProStickySearch,
} from '@/components/stock/pro'
import { useAppNavigation } from '@/hooks/useAppNavigation'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import {
  buildProStockCardSections,
  proSectionIcons,
  type ProSummaryExtended,
  type TechnicalSnapshot,
} from '@/lib/buildProStockCardSections'
import { proDesign } from '@/lib/proStockDesign'

function detectCodeFromPath(pathname: string): string | undefined {
  const m = pathname.match(/^\/pro\/stock\/(\d{6})\/?$/)
  return m?.[1]
}

function useInitialStockName(): string | null {
  return useMemo(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('name')
  }, [])
}

function changeClass(pct: number): string {
  if (pct > 0) return 'text-red-600'
  if (pct < 0) return 'text-blue-600'
  return 'text-gray-600'
}

export default function ProStockCardPage() {
  const { pathname } = useAppNavigation()
  const code = useMemo(() => detectCodeFromPath(pathname), [pathname])
  const initialName = useInitialStockName()

  const [summary, setSummary] = useState<ProSummaryExtended | null>(null)
  const [technical, setTechnical] = useState<TechnicalSnapshot>(null)
  const [analysis, setAnalysis] = useState('')
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)

  const loadAnalysis = useCallback(async (summaryData: ProSummaryExtended, stockCode: string) => {
    setLoadingAnalysis(true)
    setAnalysis('')

    try {
      const response = await authFetch(apiUrl('/api/pro-stock-analysis'), {
        method: 'POST',
        body: JSON.stringify({ code: stockCode, summary: summaryData }),
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
            const parsed = JSON.parse(dataStr) as { delta?: string }
            if (eventName === 'text' && parsed.delta) {
              setAnalysis((prev) => prev + parsed.delta)
            }
          } catch {
            // ignore malformed chunk
          }
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingAnalysis(false)
    }
  }, [])

  useEffect(() => {
    if (code) window.scrollTo(0, 0)
  }, [code])

  useEffect(() => {
    if (!code) return

    let cancelled = false
    setLoadingSummary(true)
    setSummary(null)
    setTechnical(null)
    setAnalysis('')

    void authFetch(apiUrl(`/api/pro-stock-summary?code=${code}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ProSummaryExtended | null) => {
        if (cancelled) return
        setSummary(d)
        if (d) void loadAnalysis(d, code)
      })
      .catch((e) => console.error('Summary error:', e))
      .finally(() => {
        if (!cancelled) setLoadingSummary(false)
      })

    void authFetch(apiUrl(`/api/pro-stock-technical?code=${code}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((d: TechnicalSnapshot) => {
        if (!cancelled) setTechnical(d)
      })
      .catch(() => {
        if (!cancelled) setTechnical(null)
      })

    return () => {
      cancelled = true
    }
  }, [code, loadAnalysis])

  const displayName = summary?.name || initialName || code || '—'
  const pct = summary?.quote?.changePct ?? 0
  const subtitleParts = [code, summary?.quote?.market, summary?.quote?.sector].filter(Boolean)

  const sections = useMemo(
    () => (summary ? buildProStockCardSections(summary, technical) : null),
    [summary, technical],
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {code ? <ProStickySearch currentCode={code} /> : null}

      <div className={proDesign.page}>
        {loadingSummary ? (
          <div className={proDesign.card}>
            <div className="border-b border-gray-100 px-5 py-4">
              <h1 className="text-[22px] font-bold text-gray-900">{initialName || code || '—'}</h1>
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
                <h1 className="text-[22px] font-bold tracking-tight text-gray-900">{displayName}</h1>
                <span className={proDesign.proBadge}>PRO</span>
              </div>
              {subtitleParts.length > 0 ? (
                <p className="mb-3 text-[12px] text-gray-500">{subtitleParts.join(' · ')}</p>
              ) : null}
              <div className="flex items-baseline gap-2.5">
                <span className="text-[28px] font-bold tabular-nums tracking-tight text-gray-900">
                  {summary.quote?.currentPrice != null
                    ? `${summary.quote.currentPrice.toLocaleString()}원`
                    : '—'}
                </span>
                <span className={`text-[15px] font-semibold tabular-nums ${changeClass(pct)}`}>
                  {pct > 0 ? '+' : ''}
                  {pct.toFixed(2)}%
                </span>
              </div>
            </div>

            <ProOpusSection analysis={analysis} loading={loadingAnalysis} />

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

            <ProSectionGrid
              icon={proSectionIcons.risk}
              title="시장 리스크"
              cards={sections?.risk ?? []}
            />

            <ProNewsSection news={summary.news ?? []} newsSummary={summary.newsSummary} />

            <ProActionButtons code={code} name={summary.name || code} />
          </div>
        )}
      </div>
    </div>
  )
}
