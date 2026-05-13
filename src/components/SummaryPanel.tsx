import { useMemo } from 'react'
import { Activity, Info, Sparkles, Target } from 'lucide-react'
import type { DetailedInvestmentMemoResult } from '../types/aiBriefing'
import type { SummaryInfo } from '../types/stock'
import type { MetricSummaryResult } from '../lib/summaryLogic'
import { investmentMemoAtAGlance } from '../lib/investmentMemoAtAGlance'
import { entryStageToBadgeStatus, strategyToBadgeStatus } from '../lib/strategyBadges'
import { InsightCard } from './ui/InsightCard'
import { StatusBadge } from './ui/StatusBadge'
import { UnifiedEntryStageCard } from './ExecutionStageCard'

type SummaryPanelProps = {
  summary: SummaryInfo
  metricSummary: MetricSummaryResult
  investmentMemo: DetailedInvestmentMemoResult | null
  aiLoading?: boolean
}

function LoadingDots({ label = '로딩중' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-secondary">
      <span>{label}</span>
      <span className="size-1.5 animate-bounce rounded-full bg-tertiary [animation-delay:0ms]" />
      <span className="size-1.5 animate-bounce rounded-full bg-tertiary [animation-delay:120ms]" />
      <span className="size-1.5 animate-bounce rounded-full bg-tertiary [animation-delay:240ms]" />
    </span>
  )
}

export function SummaryPanel({ summary, metricSummary, investmentMemo, aiLoading }: SummaryPanelProps) {
  const { line1, line2 } = useMemo(
    () => (investmentMemo ? investmentMemoAtAGlance(investmentMemo) : { line1: '', line2: '' }),
    [investmentMemo],
  )
  const memoTitleCompact = useMemo(() => {
    const raw = (investmentMemo?.title || '').trim()
    if (!raw) return ''
    const noPrefix = raw.replace(/^[^-—–]+[-—–]\s*/u, '').trim()
    const noStock = noPrefix.replace(/\([^)]+\)/g, '').trim()
    return noStock || '투자 메모'
  }, [investmentMemo?.title])

  const toneMini =
    metricSummary.tone === 'positive'
      ? 'rounded-full border border-light bg-success-bg px-2 py-0.5 text-xxs font-semibold text-success-text'
      : metricSummary.tone === 'caution'
        ? 'rounded-full border border-light bg-warning-bg px-2 py-0.5 text-xxs font-semibold text-warning-text'
        : metricSummary.tone === 'danger'
          ? 'rounded-full border border-light bg-danger-bg px-2 py-0.5 text-xxs font-semibold text-danger-text'
          : 'rounded-full border border-light bg-info-bg px-2 py-0.5 text-xxs font-semibold text-info-text'
  const toneLabel =
    metricSummary.tone === 'positive'
      ? '긍정'
      : metricSummary.tone === 'caution'
        ? '주의'
        : metricSummary.tone === 'danger'
          ? '위험'
          : '중립'

  const titleNode = aiLoading || !memoTitleCompact ? <LoadingDots /> : memoTitleCompact
  const subtitleNode = aiLoading || !line2 ? <LoadingDots label="전략 생성중" /> : line2

  const rows = useMemo(
    () => [
      {
        icon: <Sparkles className="shrink-0" aria-hidden />,
        label: '핵심 한 줄',
        value: <span className="font-medium">{line1 || '—'}</span>,
      },
      {
        icon: <Activity className="shrink-0" aria-hidden />,
        label: '전략',
        value: (
          <span className="inline-flex flex-wrap items-center justify-end gap-2">
            <span className="font-sans-en font-semibold">{summary.executionUi.strategyLabelKo}</span>
            <StatusBadge status={strategyToBadgeStatus(summary.strategy)} size="sm" />
          </span>
        ),
      },
      {
        icon: <Target className="shrink-0" aria-hidden />,
        label: '진입 신호',
        value: (
          <span className="inline-flex flex-wrap items-center justify-end gap-2">
            <StatusBadge status={entryStageToBadgeStatus(summary.entryStageCode)} size="sm" />
            <span className="text-xs font-medium text-secondary">{summary.executionUi.entryStageAction}</span>
          </span>
        ),
      },
      {
        icon: <Info className="shrink-0" aria-hidden />,
        label: 'Reason',
        value: <span className="whitespace-pre-line font-medium leading-relaxed">{summary.reason}</span>,
        valueFullWidth: true,
      },
    ],
    [line1, summary],
  )

  return (
    <section className="p-6 sm:p-8">
      <InsightCard
        title={titleNode}
        subtitle={subtitleNode}
        belowSubtitle={<UnifiedEntryStageCard ui={summary.executionUi} />}
        headerTrailing={
          <span className="flex flex-wrap items-center justify-end gap-1.5">
            <span className={toneMini}>{toneLabel}</span>
          </span>
        }
        rows={rows}
      />
    </section>
  )
}
