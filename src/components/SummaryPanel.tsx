import { useMemo } from 'react'
import { Activity, Gauge, Info, Target } from 'lucide-react'
import type { SummaryInfo } from '../types/stock'
import type { MetricSummaryResult } from '../lib/summaryLogic'
import type { DetailedInvestmentMemoResult } from '../types/aiBriefing'
import { investmentMemoAtAGlance } from '../lib/investmentMemoAtAGlance'

type SummaryPanelProps = {
  summary: SummaryInfo
  metricSummary: MetricSummaryResult
  investmentMemo: DetailedInvestmentMemoResult | null
  aiLoading?: boolean
}

function LoadingDots({ label = '로딩중' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-slate-500">
      <span>{label}</span>
      <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
      <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]" />
      <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]" />
    </span>
  )
}

export function SummaryPanel({ summary, metricSummary, investmentMemo, aiLoading }: SummaryPanelProps) {
  const { line2 } = useMemo(
    () => (investmentMemo ? investmentMemoAtAGlance(investmentMemo) : { line2: '' }),
    [investmentMemo],
  )
  const memoTitleCompact = useMemo(() => {
    const raw = (investmentMemo?.title || '').trim()
    if (!raw) return ''
    // "삼성전자 (005930) — 투자 메모" -> "투자 메모"
    const noPrefix = raw.replace(/^[^-—–]+[-—–]\s*/u, '').trim()
    const noStock = noPrefix.replace(/\([^)]+\)/g, '').trim()
    return noStock || '투자 메모'
  }, [investmentMemo?.title])
  const toneStyle =
    metricSummary.tone === 'positive'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : metricSummary.tone === 'caution'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : metricSummary.tone === 'danger'
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-blue-200 bg-blue-50 text-blue-700'
  const toneLabel =
    metricSummary.tone === 'positive'
      ? '긍정'
      : metricSummary.tone === 'caution'
        ? '주의'
        : metricSummary.tone === 'danger'
          ? '위험'
          : '중립'

  return (
    <section className="p-6 sm:p-8">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-500">한눈에 보기</h3>
        <p className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${toneStyle}`}>
          {toneLabel}
        </p>
      </div>
      <h4 className="mt-3 text-[17px] font-bold leading-snug text-slate-900 sm:text-lg">
        {aiLoading || !memoTitleCompact ? <LoadingDots /> : memoTitleCompact}
      </h4>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        {aiLoading || !line2 ? <LoadingDots label="전략 생성중" /> : line2}
      </p>

      <ul className="mt-6 space-y-4 border-t border-slate-100 pt-6 text-sm">
        <li className="flex items-center gap-2">
          <Gauge className="size-4 text-amber-500" />
          <span className="text-slate-500">Final Grade</span>
          <span className="ml-auto font-semibold text-amber-600">{summary.finalGrade}</span>
        </li>
        <li className="flex items-center gap-2">
          <Activity className="size-4 text-blue-600" />
          <span className="text-slate-500">Strategy</span>
          <span className="ml-auto font-semibold text-blue-600">{summary.strategy}</span>
        </li>
        <li className="flex items-center gap-2">
          <Target className="size-4 text-rose-500" />
          <span className="text-slate-500">Entry Stage</span>
          <span className="ml-auto font-semibold text-rose-600">{summary.entryStage}</span>
        </li>
        <li className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 text-slate-400" />
          <div className="min-w-0">
            <span className="text-slate-500">Reason</span>
            <p className="mt-1 whitespace-pre-line font-medium leading-relaxed text-slate-800">{summary.reason}</p>
          </div>
        </li>
      </ul>
    </section>
  )
}
