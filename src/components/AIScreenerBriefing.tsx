import type { ScreenerStock } from '../lib/screener'
import { AlertTriangle, Lightbulb, MessageSquareQuote, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchMarketBriefing } from '../lib/aiBriefingApi'
import type { DetailedInvestmentMemoResult } from '../types/aiBriefing'

type Props = { stocks: ScreenerStock[] }

export function AIScreenerBriefing({ stocks }: Props) {
  const [memoMap, setMemoMap] = useState<Record<string, DetailedInvestmentMemoResult>>({})

  useEffect(() => {
    let cancelled = false
    Promise.allSettled(
      stocks.map((stock) =>
        fetchMarketBriefing({
          stockName: stock.name,
          stockCode: stock.code,
          metrics: {
            finalScore: stock.finalScore,
            executionScore: stock.executionScore,
            supplyScore: stock.supplyScore,
            sectorFlowScore: stock.sectorFlowScore,
            consensusUpsidePct: stock.consensusUpsidePct,
            rsi14: stock.rsi14,
            atrDistance: stock.atrDistance,
          },
          strategy: {
            targetPrice1M: stock.targetPrice1M,
            expectedReturnPct: stock.expectedReturnPct,
            probability1M: stock.probability1M,
          },
        }),
      ),
    ).then((results) => {
      if (cancelled) return
      const next: Record<string, DetailedInvestmentMemoResult> = {}
      for (let i = 0; i < results.length; i += 1) {
        const r = results[i]
        if (r.status === 'fulfilled') {
          next[stocks[i].code] = r.value.briefing
        }
      }
      setMemoMap(next)
    })
    return () => {
      cancelled = true
    }
  }, [stocks])

  return (
    <section className="space-y-3">
      <h3 className="inline-flex items-center gap-2 text-lg font-bold text-slate-900">
        <MessageSquareQuote className="size-5 text-indigo-600" />
        종목별 상세 AI 분석
      </h3>
      <div className="space-y-3">
        {stocks.map((stock) => (
          (() => {
            const memo = memoMap[stock.code]
            return (
          <article
            key={`${stock.code}-brief`}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <h4 className="text-base font-semibold text-slate-900">
                {stock.name} <span className="text-xs font-normal text-slate-500">({stock.sector})</span>
              </h4>
              <div className="inline-flex items-center gap-2 text-xs text-slate-600">
                <span className="rounded-full bg-slate-100 px-2 py-0.5">상승여력 {stock.consensusUpsidePct.toFixed(1)}%</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">비중 {stock.recommendedWeightPct}%</span>
              </div>
            </header>

            <div className="mt-3 grid gap-2 md:grid-cols-[170px_1fr]">
              <p className="inline-flex items-start gap-1 text-sm font-semibold text-slate-700">
                <Lightbulb className="mt-0.5 size-3.5 text-blue-600" />
                상승 가능성
              </p>
              <p className="text-sm leading-6 text-slate-700">
                {memo?.paragraphs?.[1] ||
                  stock.aiWhyNow ||
                  `${stock.sector} 내 상대강도와 수급 동행이 확인되어 단기 추세 지속 확률이 높습니다.`}
              </p>

              <p className="inline-flex items-start gap-1 text-sm font-semibold text-amber-700">
                <AlertTriangle className="mt-0.5 size-3.5" />
                리스크
              </p>
              <p className="text-sm leading-6 text-amber-800">
                {memo?.riskPoints?.[0] ||
                  memo?.risks?.[0] ||
                  stock.aiRisk ||
                  `RSI ${stock.rsi14.toFixed(1)}로 단기 과열 구간 재진입 변동성을 주의하셔야 합니다.`}
              </p>

              <p className="inline-flex items-start gap-1 text-sm font-semibold text-emerald-700">
                <ShieldCheck className="mt-0.5 size-3.5" />
                지금 전략
              </p>
              <p className="text-sm leading-6 text-emerald-800">
                {memo?.strategyComment ||
                  stock.aiStrategy ||
                  '+10% 분할익절, -5~-7% 손절 기준으로 눌림 분할 접근을 권장드립니다.'}
              </p>
            </div>
          </article>
            )
          })()
        ))}
      </div>
    </section>
  )
}
