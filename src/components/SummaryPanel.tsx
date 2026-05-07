import { Activity, Gauge, Info, Target } from 'lucide-react'
import type { SummaryInfo } from '../types/stock'
import type { MetricSummaryResult } from '../lib/summaryLogic'

type SummaryPanelProps = {
  summary: SummaryInfo
  metricSummary: MetricSummaryResult
}

export function SummaryPanel({ summary, metricSummary }: SummaryPanelProps) {
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
        {metricSummary.line1}
      </h4>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{metricSummary.line2}</p>

      <ul className="mt-6 space-y-3 border-t border-slate-200 pt-5 text-sm">
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
            <p className="mt-1 whitespace-pre-line font-medium text-slate-800">{summary.reason}</p>
          </div>
        </li>
      </ul>
    </section>
  )
}
