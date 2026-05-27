'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, PieChart, Sparkles, TrendingUp, Wallet } from 'lucide-react'
import { MarkdownMessage } from '@/components/chat/MarkdownMessage'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { formatKRWCompact } from '@/lib/format'

type SectorRow = { sector: string; amount: number; weight: number }

type PortfolioSummary = {
  totalEval: number
  totalCost: number
  totalProfit: number
  totalProfitPct: number
  count: number
}

type CapitalSummary = {
  totalInitialCapital: number
  totalCash: number
  capitalProfit: number
  capitalProfitPct: number | null
}

type ProfitComposition = {
  profitCount: number
  lossCount: number
  profitSum: number
  lossSum: number
  maxProfit: { name: string; pct: number } | null
  maxLoss: { name: string; pct: number } | null
}

type PortfolioAnalysisData = {
  summary: PortfolioSummary
  sectors: SectorRow[]
  concentration: string | null
  profitComposition: ProfitComposition
  flowWarnings: Array<{ name: string; code: string; type: string; value: number }>
  flowPositive: Array<{ name: string; code: string; foreign: number; institution: number }>
  holdings?: Array<{
    code: string
    name: string
    sector: string
    profitPct: number
    evalAmount: number
  }>
}

export type PortfolioFilterHolding = {
  code: string
  name: string
  evalAmount: number
  costAmount: number
  profit: number
  profitPct: number
}

const SECTOR_COLORS = ['#378ADD', '#1D9E75', '#7F77DD', '#D85A30', '#D4537E', '#999999']

function changeClass(n: number): string {
  if (n > 0) return 'text-red-600'
  if (n < 0) return 'text-blue-600'
  return 'text-gray-600'
}

function profitCompositionFromHoldings(
  holdings: PortfolioFilterHolding[],
): ProfitComposition {
  const profitStocks = holdings.filter((h) => h.profit > 0)
  const lossStocks = holdings.filter((h) => h.profit < 0)

  let maxProfit: { name: string; pct: number } | null = null
  let maxLoss: { name: string; pct: number } | null = null
  for (const h of holdings) {
    if (h.profit > 0 && (!maxProfit || h.profitPct > maxProfit.pct)) {
      maxProfit = { name: h.name, pct: h.profitPct }
    }
    if (h.profit < 0 && (!maxLoss || h.profitPct < maxLoss.pct)) {
      maxLoss = { name: h.name, pct: h.profitPct }
    }
  }

  return {
    profitCount: profitStocks.length,
    lossCount: lossStocks.length,
    profitSum: profitStocks.reduce((s, h) => s + h.profit, 0),
    lossSum: lossStocks.reduce((s, h) => s + h.profit, 0),
    maxProfit,
    maxLoss,
  }
}

function sectorsFromHoldings(
  holdings: PortfolioFilterHolding[],
  codeToSector: Map<string, string>,
): { sectors: SectorRow[]; concentration: string | null } {
  const totalEval = holdings.reduce((s, h) => s + (Number(h.evalAmount) || 0), 0)
  const sectorMap: Record<string, number> = {}
  for (const h of holdings) {
    const sector = codeToSector.get(h.code) || '기타'
    sectorMap[sector] = (sectorMap[sector] || 0) + (Number(h.evalAmount) || 0)
  }
  const sectors = Object.entries(sectorMap)
    .map(([sector, amount]) => ({
      sector,
      amount,
      weight: totalEval > 0 ? (amount / totalEval) * 100 : 0,
    }))
    .sort((a, b) => b.weight - a.weight)

  const topSector = sectors[0]
  const concentration =
    topSector && topSector.weight > 40
      ? `${topSector.sector} 집중도 높음 (${topSector.weight.toFixed(0)}%)`
      : null

  return { sectors, concentration }
}

type Props = {
  refreshKey?: number
  /** pro-holdings 요약 — 분석 API 로딩 중에도 자산 현황 표시 */
  holdingsSummary?: PortfolioSummary | null
  capitalSummary?: CapitalSummary | null
  /** 선택 그룹 종목 — 섹터/수익구성/수급 필터용 */
  filterHoldings?: PortfolioFilterHolding[]
}

export function PortfolioAnalysis({
  refreshKey = 0,
  holdingsSummary = null,
  capitalSummary = null,
  filterHoldings,
}: Props) {
  const [data, setData] = useState<PortfolioAnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [opus, setOpus] = useState<string | null>(null)
  const [opusLoading, setOpusLoading] = useState(false)

  const loadAnalysis = useCallback(async () => {
    setLoading(true)
    setOpus(null)
    try {
      const r = await authFetch(apiUrl('/api/pro-portfolio-analysis'))
      if (r.ok) {
        const d = (await r.json()) as { analysis?: PortfolioAnalysisData | null }
        setData(d.analysis ?? null)
      }
    } catch (e) {
      console.error('[PortfolioAnalysis]', e)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAnalysis()
  }, [loadAnalysis, refreshKey])

  const runOpus = async () => {
    setOpusLoading(true)
    try {
      const r = await authFetch(apiUrl('/api/pro-portfolio-opus'), {
        method: 'POST',
        body: JSON.stringify({}),
      })
      if (r.ok) {
        const d = (await r.json()) as { analysis?: string }
        setOpus(d.analysis || '')
      } else {
        const err = (await r.json().catch(() => ({}))) as { error?: string }
        alert(err.error || '진단 실패')
      }
    } catch {
      alert('진단 요청 실패')
    } finally {
      setOpusLoading(false)
    }
  }

  const visibleCodes = useMemo(
    () => (filterHoldings?.length ? new Set(filterHoldings.map((h) => h.code)) : null),
    [filterHoldings],
  )

  const codeToSector = useMemo(() => {
    const map = new Map<string, string>()
    for (const h of data?.holdings || []) {
      if (!map.has(h.code)) map.set(h.code, h.sector)
    }
    return map
  }, [data?.holdings])

  const filteredView = useMemo(() => {
    if (!filterHoldings) return null

    const profitComposition = profitCompositionFromHoldings(filterHoldings)
    const { sectors, concentration } = sectorsFromHoldings(filterHoldings, codeToSector)

    const flowWarnings =
      visibleCodes && data?.flowWarnings
        ? data.flowWarnings.filter((w) => visibleCodes.has(w.code))
        : []

    return { sectors, concentration, profitComposition, flowWarnings }
  }, [filterHoldings, codeToSector, visibleCodes, data?.flowWarnings])

  const summary = holdingsSummary ?? data?.summary
  const sectors = filteredView?.sectors ?? data?.sectors
  const concentration = filteredView?.concentration ?? data?.concentration
  const profitComposition = filteredView?.profitComposition ?? data?.profitComposition
  const flowWarnings = filteredView?.flowWarnings ?? data?.flowWarnings

  if (!summary && loading) {
    return (
      <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-8 text-center text-[13px] text-gray-400">
        포트폴리오 분석 중...
      </div>
    )
  }

  if (!summary) return null

  return (
    <div className="mb-4">
      <div className="mb-4 grid grid-cols-1 items-stretch gap-3 md:grid-cols-2">
        {/* 1. 자산 현황 */}
        <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <Wallet size={18} className="text-gray-700" strokeWidth={1.8} aria-hidden />
            <span className="text-[14px] font-bold text-gray-900">자산 현황</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] text-gray-500">종목 평가액</span>
              <span className="text-[16px] font-bold tabular-nums text-gray-900">
                {formatKRWCompact(summary.totalEval)}원
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] text-gray-500">평단대비</span>
              <span
                className={`text-[14px] font-bold tabular-nums ${changeClass(summary.totalProfit)}`}
              >
                {summary.totalProfit >= 0 ? '+' : ''}
                {summary.totalProfitPct.toFixed(1)}%
              </span>
            </div>

            {capitalSummary?.capitalProfitPct != null ? (
              <>
                <div className="flex items-baseline justify-between gap-2 border-t border-gray-100 pt-2">
                  <span className="text-[12px] text-gray-500">최초원금</span>
                  <span className="text-[13px] font-bold tabular-nums text-gray-700">
                    {formatKRWCompact(capitalSummary.totalInitialCapital)}원
                  </span>
                </div>
                {capitalSummary.totalCash > 0 ? (
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12px] text-gray-500">현금잔고</span>
                    <span className="text-[13px] tabular-nums text-gray-600">
                      {formatKRWCompact(capitalSummary.totalCash)}원
                    </span>
                  </div>
                ) : null}
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] text-gray-500">원금대비 수익</span>
                  <span
                    className={`text-[15px] font-bold tabular-nums ${changeClass(capitalSummary.capitalProfit)}`}
                  >
                    {capitalSummary.capitalProfit >= 0 ? '+' : ''}
                    {formatKRWCompact(capitalSummary.capitalProfit)} (
                    {capitalSummary.capitalProfit >= 0 ? '+' : ''}
                    {capitalSummary.capitalProfitPct.toFixed(1)}%)
                  </span>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {/* 2. 섹터 비중 */}
        <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <PieChart size={18} className="text-blue-500" strokeWidth={1.8} aria-hidden />
            <span className="text-[14px] font-bold text-gray-900">섹터 비중</span>
            {concentration ? (
              <span className="ml-auto text-[10px] font-bold text-amber-600">{concentration}</span>
            ) : null}
          </div>
          {loading && !data && !filterHoldings?.length ? (
            <div className="py-4 text-center text-[12px] text-gray-400">집계 중...</div>
          ) : sectors?.length ? (
            <div className="space-y-1.5">
              {sectors.slice(0, 5).map((s, i) => (
                <div key={s.sector} className="flex items-center gap-2">
                  <span className="w-14 truncate text-[11px] text-gray-600">{s.sector}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, s.weight)}%`,
                        backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length],
                      }}
                    />
                  </div>
                  <span className="w-8 text-right text-[11px] font-bold tabular-nums text-gray-900">
                    {s.weight.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-2 text-[12px] text-gray-400">섹터 데이터 없음</div>
          )}
        </div>

        {/* 3. 수익 구성 */}
        <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-500" strokeWidth={1.8} aria-hidden />
            <span className="text-[14px] font-bold text-gray-900">수익 구성</span>
          </div>
          {loading && !data && !filterHoldings?.length ? (
            <div className="py-4 text-center text-[12px] text-gray-400">집계 중...</div>
          ) : profitComposition ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-gray-500">
                  수익 {profitComposition.profitCount}종목
                </div>
                <div className="text-[14px] font-bold tabular-nums text-red-600">
                  +{formatKRWCompact(profitComposition.profitSum)}
                </div>
                {profitComposition.maxProfit ? (
                  <div className="mt-0.5 truncate text-[10px] text-gray-400">
                    최대 {profitComposition.maxProfit.name} +
                    {profitComposition.maxProfit.pct.toFixed(1)}%
                  </div>
                ) : null}
              </div>
              <div>
                <div className="text-[11px] text-gray-500">
                  손실 {profitComposition.lossCount}종목
                </div>
                <div className="text-[14px] font-bold tabular-nums text-blue-600">
                  {formatKRWCompact(profitComposition.lossSum)}
                </div>
                {profitComposition.maxLoss ? (
                  <div className="mt-0.5 truncate text-[10px] text-gray-400">
                    최대 {profitComposition.maxLoss.name}{' '}
                    {profitComposition.maxLoss.pct.toFixed(1)}%
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="py-2 text-[12px] text-gray-400">데이터 없음</div>
          )}
        </div>

        {/* 4. 수급 주의 */}
        <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle size={18} className="text-amber-500" strokeWidth={1.8} aria-hidden />
            <span className="text-[14px] font-bold text-gray-900">수급 주의</span>
          </div>
          {loading && !data && !filterHoldings?.length ? (
            <div className="py-4 text-center text-[12px] text-gray-400">집계 중...</div>
          ) : flowWarnings && flowWarnings.length > 0 ? (
            <div className="space-y-1.5">
              {flowWarnings.slice(0, 5).map((w) => (
                <div key={w.code} className="flex items-center gap-1.5 text-[12px]">
                  <AlertCircle size={12} className="shrink-0 text-amber-500" aria-hidden />
                  <span className="font-bold text-gray-900">{w.name}</span>
                  <span className="text-[11px] text-gray-500">{w.type}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-2 text-[12px] text-gray-400">외국인 이탈 종목 없음</div>
          )}
        </div>
      </div>

      {/* OPUS 포트폴리오 진단 — 전체 폭 */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={20} className="text-amber-600" strokeWidth={1.8} aria-hidden />
          <span className="text-[15px] font-bold text-amber-900">OPUS 포트폴리오 진단</span>
        </div>

        {!opus && !opusLoading ? (
          <button
            type="button"
            onClick={() => void runOpus()}
            className="w-full rounded-xl bg-amber-600 py-3 text-[14px] font-bold text-white hover:bg-amber-700"
          >
            포트폴리오 종합 진단 받기
          </button>
        ) : null}

        {opusLoading ? (
          <div className="py-6 text-center text-[13px] text-amber-700">
            전체 종목 조사 중... (1~2분 소요될 수 있습니다)
          </div>
        ) : null}

        {opus ? (
          <div className="rounded-xl bg-white p-4">
            <MarkdownMessage content={opus} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
