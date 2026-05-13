import {
  BarChart3,
  ClipboardList,
  Clock,
  Flag,
  Info,
  PieChart,
  PlusCircle,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import type { ExecutionPlan, StrategyRiskRewardMetrics, ThreeMonthStrategy } from '../types/stock'
import {
  entryDecisionTooltip,
  executionEducationTooltip,
} from '../lib/executionStrategyTooltips'
import type { IconColorToken } from './ui/iconTokens'
import type { SeverityToken } from './ui/iconTokens'
import { formatSignedPct } from '../lib/utils/format'
import { gridSlotColumnIndex, useMediaGridColumns } from '../lib/gridTooltip'
import { IndicatorCard } from './ui/IndicatorCard'

type ExecutionStrategyProps = {
  strategy: ThreeMonthStrategy | null
  riskRewardMetrics: StrategyRiskRewardMetrics | null
  executionPlan: ExecutionPlan | null
  currentPrice: number
  loading?: boolean
}

function krw(n: number) {
  return `${Math.round(n).toLocaleString('ko-KR')}원`
}

function formatManApprox(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0원'
  const man = n / 10_000_000
  if (Math.abs(man) >= 0.05) {
    const s = man >= 0 ? '' : '-'
    return `${s}${Math.abs(man).toFixed(0)}만원`
  }
  return `${Math.round(Math.abs(n)).toLocaleString('ko-KR')}원`
}

function oneRNotionalLossWon(price: number, recPct: number, stopLossPct: number) {
  const notional = (price * recPct) / 100
  return Math.round(notional * (Math.abs(stopLossPct) / 100))
}

function entrySeverity(decision: string): SeverityToken {
  const d = decision.trim()
  if (/익절|청산/.test(d)) return 'warning'
  if (/제외|회피|관망/.test(d)) return 'caution'
  return 'normal'
}

function timeStopPrimary(rule: string): string {
  const lines = rule
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const m0 = lines[0]?.match(/(\d+)거래일/)
  const m1 = lines[1]?.match(/(\d+)거래일/)
  if (m0 && m1) return `${m0[1]}D +5% / ${m1[1]}D +15%`
  return lines[0] ?? '—'
}

function addBuyPrimary(rule: string): string {
  return /금지|불가/.test(rule) ? '금지' : '허용'
}

/** 신규 진입 시나리오를 쓰지 않는 판단 — 손절·익절·목표 본문은 숨김 */
function isInactiveEntry(entryDecision: string): boolean {
  const d = entryDecision.trim()
  return d === '회피' || d === '관망 (과열)'
}

type StratCard = {
  id: string
  label: string
  primary: string
  sub: string
  icon: typeof Target
  iconColor: IconColorToken
  severity?: SeverityToken
  tooltip: Parameters<typeof IndicatorCard>[0]['tooltipContent']
  primaryNumeric?: boolean
  primaryClassName?: string
  span?: 2 | 3
}

export function ExecutionStrategy({
  strategy,
  riskRewardMetrics,
  executionPlan,
  currentPrice,
  loading,
}: ExecutionStrategyProps) {
  const sectionTitleClass = 'text-[15px] font-bold tracking-tight text-primary'
  const gridCols = useMediaGridColumns()

  const plan = executionPlan

  const oneRValue = (() => {
    if (!strategy) return '—'
    const loss = oneRNotionalLossWon(
      currentPrice,
      strategy.recommendedPositionPct,
      strategy.stopLossPct,
    )
    if (loss === 0) return '0원'
    return formatManApprox(-Math.abs(loss))
  })()

  const oneRSub = (() => {
    if (!strategy) return ''
    const p = Number(strategy.stopLossPct)
    if (!Number.isFinite(p)) return '예상 손실'
    return `예상 손실, ${p >= 0 ? '+' : ''}${p.toFixed(1)}% 기준`
  })()

  if (loading && !strategy) {
    return (
      <section className="overflow-x-hidden border-t border-default px-4 py-6 sm:px-8">
        <h3 className={sectionTitleClass}>실행 전략</h3>
        <p className="mt-1 text-xs text-secondary">3개월 +15% 전략</p>
        <p className="mt-3 text-xs text-secondary">종목 데이터를 불러오는 중입니다.</p>
      </section>
    )
  }

  if (!strategy) {
    return (
      <section className="overflow-x-hidden border-t border-default px-4 py-6 sm:px-8">
        <h3 className={sectionTitleClass}>실행 전략</h3>
        <p className="mt-1 text-xs text-secondary">3개월 +15% 전략</p>
        <p className="mt-3 text-xs text-secondary">실행 전략을 계산할 수 없습니다.</p>
      </section>
    )
  }

  const slStop = Number(strategy.stopLossPct)

  const inactive = isInactiveEntry(strategy.entryDecision)
  const stopPrimary = inactive
    ? '진입 비추천'
    : `${krw(strategy.stopPrice)} (${formatSignedPct(Number.isFinite(slStop) ? slStop : NaN, 1)})`
  const tp1Primary = inactive
    ? '진입 비추천'
    : `${krw(strategy.firstTakeProfitPrice)} (${formatSignedPct(Number(strategy.firstTakeProfitPct), 1)})`
  const finalPrimary = inactive
    ? '진입 비추천'
    : `${krw(strategy.finalTargetPrice)} (${formatSignedPct(Number(strategy.finalTargetPct), 1)})`

  const entrySub =
    strategy.warnings && strategy.warnings.length > 0
      ? strategy.warnings.slice(0, 2).join(' · ')
      : '현재 구간 기준 판단'

  const recSub =
    strategy.recommendedPositionPct === 0
      ? '현재 진입 비추천'
      : '분할 진입 시 5%씩'

  const tp1Sub = `${strategy.firstTakeProfitSellPct}% 분할 매도 · RSI·ATR 임계 시 추가 익절 검토`

  const finalSub = `${strategy.maxHoldingPeriod.replace(/^최대\s*/, '약 ')} / 컨센서스 캡 적용`

  const timeSub = '미달 시 재평가 또는 정리'

  const maxValue = Number.isFinite(plan?.maxPositionPct ?? NaN)
    ? `${Math.round(plan!.maxPositionPct)}%`
    : '—'

  const cards: StratCard[] = [
    {
      id: 'entry',
      label: '진입 판단',
      primary: strategy.entryDecision,
      sub: entrySub,
      icon: Target,
      iconColor: 'blue',
      severity: entrySeverity(strategy.entryDecision),
      tooltip: entryDecisionTooltip,
    },
    {
      id: 'rec',
      label: '추천 비중',
      primary: `${strategy.recommendedPositionPct}%`,
      sub: recSub,
      icon: PieChart,
      iconColor: 'green',
      primaryNumeric: true,
      tooltip: executionEducationTooltip('recommendedPosition'),
    },
    {
      id: 'stop',
      label: '손절선',
      primary: stopPrimary,
      sub: strategy.stopReason,
      icon: Shield,
      iconColor: 'rose',
      tooltip: executionEducationTooltip('stopLoss'),
    },
    {
      id: 'tp1',
      label: `1차 익절 (${formatSignedPct(Number(strategy.firstTakeProfitPct), 0)})`,
      primary: tp1Primary,
      sub: tp1Sub,
      icon: TrendingUp,
      iconColor: 'orange',
      tooltip: executionEducationTooltip('baseExecution'),
    },
    {
      id: 'final',
      label: '최종 목표',
      primary: finalPrimary,
      sub: finalSub,
      icon: Flag,
      iconColor: 'purple',
      tooltip: executionEducationTooltip('planSummary'),
    },
    {
      id: 'time',
      label: '타임스탑',
      primary: timeStopPrimary(strategy.timeStopRule),
      sub: timeSub,
      icon: Clock,
      iconColor: 'yellow',
      tooltip: executionEducationTooltip('baseExecution'),
    },
    {
      id: 'add',
      label: '추가매수',
      primary: addBuyPrimary(strategy.addBuyRule),
      sub: strategy.addBuyRule,
      icon: PlusCircle,
      iconColor: 'cyan',
      tooltip: executionEducationTooltip('addBuyRule'),
    },
    {
      id: 'oneR',
      label: '1R 손실금',
      primary: oneRValue,
      sub: oneRSub,
      icon: TrendingDown,
      iconColor: 'rose',
      primaryNumeric: true,
      tooltip: executionEducationTooltip('riskAmount'),
    },
    {
      id: 'max',
      label: '최대 비중',
      primary: maxValue,
      sub: '계좌 대비 종목당 상한',
      icon: BarChart3,
      iconColor: 'pink',
      primaryNumeric: true,
      tooltip: executionEducationTooltip('maxPosition'),
    },
    {
      id: 'sum',
      label: '3개월 전략 요약',
      primary: strategy.summary,
      sub:
        strategy.warnings && strategy.warnings.length > 0
          ? strategy.warnings.join(' · ')
          : '핵심 규칙 한눈에',
      icon: ClipboardList,
      iconColor: 'blue',
      tooltip: executionEducationTooltip('planSummary'),
      span: 2,
    },
  ]

  return (
    <section className="overflow-x-hidden border-t border-default px-4 py-6 sm:px-8">
      <h3 className={sectionTitleClass}>실행 전략</h3>
      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-secondary">
        <span>3개월 +15% 전략</span>
        {riskRewardMetrics ? (
          <>
            <span aria-hidden>·</span>
            <span className="tabular-nums" title="최종 목표 ÷ |손절%| (1차 익절 미반영)">
              순수 R/R {riskRewardMetrics.pureRatio.toFixed(2)} ({riskRewardMetrics.pureVerdict})
            </span>
            <span aria-hidden>·</span>
            <span className="tabular-nums" title="분할 익절 반영 가중 R/R">
              가중 R/R {riskRewardMetrics.weightedRatio.toFixed(2)} ({riskRewardMetrics.weightedVerdict})
            </span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-0.5 tabular-nums" title="확률 가중 기대 R/R">
              <Info className="size-3 shrink-0 text-tertiary" aria-hidden />
              기대 R/R {riskRewardMetrics.expectedProbWeightedRatio.toFixed(2)} (
              {riskRewardMetrics.expectedProbWeightedVerdict})
            </span>
          </>
        ) : null}
      </p>

      <div className="mt-6 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:auto-rows-fr lg:grid-cols-3 lg:auto-rows-fr">
        {cards.map((c, idx) => {
          const Icon = c.icon
          const baseCol = gridSlotColumnIndex(idx, gridCols)
          const tooltipColumnIndex = c.span && c.span >= 2 ? 1 : baseCol
          const spanCls = c.span === 2 ? 'lg:col-span-2' : c.span === 3 ? 'lg:col-span-3' : ''
          return (
            <div key={c.id} className={spanCls || undefined}>
              <IndicatorCard
                icon={<Icon aria-hidden />}
                iconColor={c.iconColor}
                label={c.label}
                primary={c.primary}
                primaryNumeric={c.primaryNumeric}
                primaryClassName={c.primaryClassName}
                sub={c.sub}
                severity={c.severity ?? 'normal'}
                descriptionKey="structure"
                tooltipContent={c.tooltip}
                tooltipColumnIndex={tooltipColumnIndex}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
