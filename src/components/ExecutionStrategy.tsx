import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ClipboardList,
  Clock,
  Flag,
  PieChart,
  PlusCircle,
  ShieldAlert,
  Target,
  TrendingUp,
} from 'lucide-react'
import type { ThreeMonthStrategy } from '../types/stock'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useUniformCellHeights } from '../hooks/useUniformCellHeights'
import { ExecutionInfoTooltip } from './ExecutionInfoTooltip'
import type { ExecutionEducationKey } from '../lib/executionEducation'

type ExecutionStrategyProps = {
  strategy: ThreeMonthStrategy | null
  riskReward: { ratio: number; verdict: string }
  loading?: boolean
}

type RowKey = ExecutionEducationKey | null

function krw(n: number) {
  return `${Math.round(n).toLocaleString('ko-KR')}원`
}

function RowHead({
  icon: Icon,
  iconClass,
  title,
  educationKey,
  openKey,
  rowId,
  onOpen,
  onClose,
  onToggle,
  tooltipSide,
}: {
  icon: LucideIcon
  iconClass: string
  title: string
  educationKey: RowKey
  openKey: string | null
  rowId: string
  onOpen: (id: string) => void
  onClose: () => void
  onToggle: (id: string) => void
  tooltipSide: 'start' | 'end'
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className={`size-6 shrink-0 ${iconClass}`} aria-hidden />
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {educationKey ? (
        <ExecutionInfoTooltip
          educationKey={educationKey}
          open={openKey === rowId}
          onOpen={() => onOpen(rowId)}
          onClose={onClose}
          onToggle={() => onToggle(rowId)}
          tooltipSide={tooltipSide}
        />
      ) : null}
    </div>
  )
}

const articleClass =
  'relative flex h-full min-h-0 flex-col overflow-visible rounded-lg border border-slate-200 bg-white p-3 shadow-sm'

export function ExecutionStrategy({
  strategy,
  riskReward,
  loading,
}: ExecutionStrategyProps) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const isMdUp = useMediaQuery('(min-width: 768px)')
  const cols = isMdUp ? 3 : 2
  const sideAt = (gridIndex: number, fullSpan?: boolean) => {
    if (fullSpan) return 'start' as const
    return gridIndex % cols === cols - 1 ? ('end' as const) : ('start' as const)
  }
  const layoutKey = useMemo(
    () =>
      strategy
        ? `${strategy.entryDecision}-${strategy.stopPrice}-${strategy.summary.slice(0, 40)}`
        : 'none',
    [strategy],
  )
  const gridRef = useUniformCellHeights(layoutKey)

  const openHandlers = {
    onOpen: (id: string) => setOpenKey(id),
    onClose: () => setOpenKey(null),
    onToggle: (id: string) => setOpenKey((k) => (k === id ? null : id)),
  }

  const sectionTitleClass = 'text-lg font-bold tracking-tight text-slate-900'

  if (loading && !strategy) {
    return (
      <section className="overflow-visible border-t border-slate-200 px-6 py-6 sm:px-8">
        <h3 className={sectionTitleClass}>실행 전략</h3>
        <p className="mt-1 text-xs text-slate-500">3개월 +15% 전략</p>
        <p className="mt-3 text-xs text-slate-500">종목 데이터를 불러오는 중입니다.</p>
      </section>
    )
  }

  if (!strategy) {
    return (
      <section className="overflow-visible border-t border-slate-200 px-6 py-6 sm:px-8">
        <h3 className={sectionTitleClass}>실행 전략</h3>
        <p className="mt-1 text-xs text-slate-500">3개월 +15% 전략</p>
        <p className="mt-3 text-xs text-slate-500">실행 전략을 계산할 수 없습니다.</p>
      </section>
    )
  }

  const stopPctStr = `${strategy.stopLossPct >= 0 ? '+' : ''}${strategy.stopLossPct.toFixed(1)}%`
  const finalPctStr = `+${strategy.finalTargetPct}%`

  const timeLines = strategy.timeStopRule.split('\n').filter(Boolean)

  return (
    <section className="overflow-visible border-t border-slate-200 px-6 py-6 sm:px-8">
      <h3 className={sectionTitleClass}>실행 전략</h3>
      <p className="mt-1 text-xs text-slate-500">
        3개월 +15% 전략 · R/R {riskReward.ratio.toFixed(2)} ({riskReward.verdict})
      </p>

      <div ref={gridRef} className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-3">
        <article data-uniform-cell className={articleClass}>
          <RowHead
            icon={Target}
            iconClass="text-violet-600"
            title="1. 진입 판단"
            educationKey={null}
            openKey={openKey}
            rowId="entry"
            tooltipSide={sideAt(0)}
            {...openHandlers}
          />
          <p className="mt-2 text-[13px] font-semibold leading-snug text-slate-900">{strategy.entryDecision}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
            지금 살 수 있는지, 눌림·관망·보유·익절·제외 중 어디에 해당하는지 표시합니다.
          </p>
        </article>

        <article data-uniform-cell className={articleClass}>
          <RowHead
            icon={PieChart}
            iconClass="text-blue-600"
            title="2. 추천 비중"
            educationKey="recommendedPosition"
            openKey={openKey}
            rowId="rec"
            tooltipSide={sideAt(1)}
            {...openHandlers}
          />
          <p className="mt-2 text-[13px] font-semibold leading-snug tabular-nums text-slate-900">
            {strategy.recommendedPositionPct}%
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
            계좌 대비 이 종목에 올릴 상한입니다. 과열·시장·손익비에 따라 자동으로 줄어듭니다.
          </p>
        </article>

        <article data-uniform-cell className={articleClass}>
          <RowHead
            icon={ShieldAlert}
            iconClass="text-sky-600"
            title="3. 손절선"
            educationKey="baseExecution"
            openKey={openKey}
            rowId="stop"
            tooltipSide={sideAt(2)}
            {...openHandlers}
          />
          <p className="mt-2 text-[13px] font-semibold leading-snug tabular-nums">
            <span className="text-slate-900">{krw(strategy.stopPrice)}</span>
            <span className="text-sky-600"> / {stopPctStr}</span>
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-700">{strategy.stopReason}</p>
        </article>

        <article data-uniform-cell className={articleClass}>
          <RowHead
            icon={TrendingUp}
            iconClass="text-rose-600"
            title="4. 1차 익절 (+8~10%)"
            educationKey="baseExecution"
            openKey={openKey}
            rowId="tp1"
            tooltipSide={sideAt(3)}
            {...openHandlers}
          />
          <p className="mt-2 text-[13px] font-semibold leading-snug tabular-nums">
            <span className="text-rose-600">
              1차 익절 {krw(strategy.firstTakeProfitPrice)} (+{strategy.firstTakeProfitPct}%)
            </span>
            <span className="text-slate-800"> / {strategy.firstTakeProfitSellPct}% 매도</span>
          </p>
          <p className="mt-1 text-[12px] text-slate-600">보유 수량 기준 분할 비율입니다.</p>
        </article>

        <article data-uniform-cell className={articleClass}>
          <RowHead
            icon={Flag}
            iconClass="text-emerald-600"
            title="5. 최종 목표"
            educationKey="planSummary"
            openKey={openKey}
            rowId="final"
            tooltipSide={sideAt(4)}
            {...openHandlers}
          />
          <p className="mt-2 text-[13px] font-semibold leading-snug tabular-nums text-rose-600">
            최종 목표 {krw(strategy.finalTargetPrice)} / {finalPctStr} / 최대 3개월
          </p>
          <p className="mt-1 text-[12px] text-slate-500">
            {strategy.maxHoldingPeriod.replace(/^최대\s*3개월/, '').trim() || strategy.maxHoldingPeriod}
          </p>
          {strategy.consensusNote ? (
            <p className="mt-2 text-[11px] leading-relaxed text-slate-600">참고: {strategy.consensusNote}</p>
          ) : null}
        </article>

        <article data-uniform-cell className={articleClass}>
          <RowHead
            icon={Clock}
            iconClass="text-amber-600"
            title="6. 타임스탑"
            educationKey="baseExecution"
            openKey={openKey}
            rowId="time"
            tooltipSide={sideAt(5)}
            {...openHandlers}
          />
          <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-slate-800">
            {timeLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </article>

        <article data-uniform-cell className={articleClass}>
          <RowHead
            icon={PlusCircle}
            iconClass="text-indigo-600"
            title="7. 추가매수"
            educationKey="addBuyRule"
            openKey={openKey}
            rowId="add"
            tooltipSide={sideAt(6)}
            {...openHandlers}
          />
          <p className="mt-2 text-[13px] font-medium leading-relaxed text-slate-900">{strategy.addBuyRule}</p>
        </article>

        <article data-uniform-cell className={`${articleClass} col-span-2 md:col-span-3`}>
          <RowHead
            icon={ClipboardList}
            iconClass="text-slate-600"
            title="8. 3개월 전략 요약"
            educationKey="planSummary"
            openKey={openKey}
            rowId="sum"
            tooltipSide={sideAt(7, true)}
            {...openHandlers}
          />
          <p className="mt-2 text-[13px] font-medium leading-relaxed text-slate-900">{strategy.summary}</p>
          {strategy.warnings.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {strategy.warnings.map((w) => (
                <span
                  key={w}
                  className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900"
                >
                  {w}
                </span>
              ))}
            </div>
          ) : null}
        </article>
      </div>
    </section>
  )
}
