import { Sparkles } from 'lucide-react'
import { stockNameFromMaster } from '../../data/sectorMaster'
import type { ScreeningAiAnalysis, TopFiveRow } from '../../data/mockScreening'

export type AiAnalysisCardsProps = {
  analyses: ScreeningAiAnalysis[]
  topFive: TopFiveRow[]
}

function AiCard({
  rank,
  stock,
  analysis,
}: {
  rank: number
  stock: TopFiveRow
  analysis: ScreeningAiAnalysis
}) {
  const nm = stock.name?.trim()
  const displayName =
    nm && nm !== stock.code && !/^\d{6}$/.test(nm.replace(/\s/g, '')) ? nm : stockNameFromMaster(stock.code)
  return (
    <article className="flex min-h-[11rem] flex-col rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-600/95 via-purple-600/90 to-indigo-700/95 p-4 text-white shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{displayName}</p>
          <p className="mt-0.5 font-sans-en text-[11px] tabular-nums text-violet-100">{stock.code}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-violet-50">
          #{rank}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-[13px] font-medium leading-snug text-white">{analysis.summary}</p>
      <div className="mt-auto space-y-2 border-t border-white/20 pt-3 text-[11px] leading-snug">
        <div>
          <p className="font-semibold text-violet-100">매수 근거</p>
          <p className="mt-0.5 line-clamp-2 text-white/95">{analysis.keyDriver}</p>
        </div>
        <div>
          <p className="font-semibold text-violet-100">리스크</p>
          <p className="mt-0.5 line-clamp-2 text-white/95">{analysis.risk}</p>
        </div>
      </div>
    </article>
  )
}

export function AiAnalysisCards({ analyses, topFive }: AiAnalysisCardsProps) {
  if (!analyses?.length) return null
  return (
    <section className="space-y-3" aria-labelledby="ai-screening-heading">
      <div className="flex items-center gap-2">
        <Sparkles className="size-5 shrink-0 text-violet-600" strokeWidth={2} aria-hidden />
        <h2 id="ai-screening-heading" className="text-base font-semibold text-primary">
          AI 분석 — TOP 3
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {analyses.map((a, idx) => {
          const stock = topFive.find((s) => s.code === a.code)
          if (!stock) return null
          return <AiCard key={a.code} rank={idx + 1} stock={stock} analysis={a} />
        })}
      </div>
    </section>
  )
}
