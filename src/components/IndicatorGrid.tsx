import type { ReactNode } from 'react'
import type { LogicMetric } from '../types/stock'
import type { IndicatorGridSlotInput } from '../lib/indicatorGridSlots'
import { normalizeIndicatorPrimary } from '../lib/indicatorGridSlots'
import { formatSignedPct } from '../lib/utils/format'
import { formatSupplyFlowAmountWon } from '../lib/supplyCardFormat'
import { IndicatorCard } from './ui/IndicatorCard'
import { resolveIndicatorPresentation } from './ui/metricDescriptionIcons'
import {
  primaryValueClass,
  resolveIndicatorSeverity,
  subValueClass,
} from './ui/metricSeverity'
import { gridSlotColumnIndex, useMediaGridColumns } from '../lib/gridTooltip'

export type IndicatorGridProps = {
  subtitle?: string
  slots: IndicatorGridSlotInput[]
  /** 추후 우측 drawer 연동 — 현재는 시그니처만 유지 */
  onIndicatorClick?: (id: string, metric: LogicMetric) => void
}

function looksNumericPrimary(s: string): boolean {
  return /[\d.%$]/.test(s)
}

function supplyPrimaryRows(foreignWon: number, institutionWon: number) {
  return [
    {
      label: '외국인',
      value: formatSupplyFlowAmountWon(foreignWon),
      valueColorClass: foreignWon > 0 ? 'text-[#DC2626]' : foreignWon < 0 ? 'text-[#2563EB]' : 'text-primary',
    },
    {
      label: '기관',
      value: formatSupplyFlowAmountWon(institutionWon),
      valueColorClass:
        institutionWon > 0 ? 'text-[#DC2626]' : institutionWon < 0 ? 'text-[#2563EB]' : 'text-primary',
    },
  ]
}

function parseConsensusVsMaxPct(sub?: string): number | null {
  if (!sub?.trim()) return null
  const m = sub.match(/최고\s*대비\s*([+-]?\d+(?:\.\d+)?)%/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

function consensusPrimarySlot(avgWon: number, maxWon: number, sub?: string): ReactNode {
  const pct = parseConsensusVsMaxPct(sub)
  const pctClass =
    pct == null ? 'text-secondary' : pct > 0 ? 'text-price-up' : pct < 0 ? 'text-price-down' : 'text-secondary'
  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex w-full items-baseline justify-between gap-2">
        <span className="min-w-[60px] shrink-0 text-[13px] font-medium text-secondary">평균</span>
        <span className="text-right font-sans-en text-lg font-bold tabular-nums text-primary">
          {avgWon.toLocaleString('ko-KR')}원
        </span>
      </div>
      <div className="flex w-full items-baseline justify-between gap-2">
        <div className="flex min-w-0 shrink-0 items-baseline gap-1.5">
          <span className="text-[13px] font-medium text-secondary">최고</span>
          {pct != null ? (
            <span className={`font-sans-en text-xs font-semibold tabular-nums ${pctClass}`}>
              대비 {formatSignedPct(pct, 0)}
            </span>
          ) : null}
        </div>
        <span className="shrink-0 text-right font-sans-en text-lg font-bold tabular-nums text-primary">
          {maxWon.toLocaleString('ko-KR')}원
        </span>
      </div>
    </div>
  )
}

function parseClvValues(value: string): { c5: number | null; c10: number | null } {
  const m5 = value.match(/CLV5\s*([+-]?\d+(?:\.\d+)?)/i)
  const m10 = value.match(/CLV10\s*([+-]?\d+(?:\.\d+)?)/i)
  return {
    c5: m5 ? Number(m5[1]) : null,
    c10: m10 ? Number(m10[1]) : null,
  }
}

function clvSegment(label: 'CLV5' | 'CLV10', n: number): ReactNode {
  const text = n === 0 ? `0.00` : n > 0 ? `+${n.toFixed(2)}` : `${n.toFixed(2)}`
  const color = n > 0 ? 'text-[#DC2626]' : n < 0 ? 'text-[#2563EB]' : 'text-primary'
  return (
    <span className="inline-flex items-baseline gap-1" key={label}>
      <span className="text-sm font-medium text-secondary">{label}</span>
      <span className={`font-sans-en text-lg font-bold tabular-nums ${color}`}>{text}</span>
    </span>
  )
}

function candleQualityPrimarySlot(raw: string): ReactNode {
  const { c5, c10 } = parseClvValues(raw)
  if (c5 != null && c10 != null && Number.isFinite(c5) && Number.isFinite(c10)) {
    return (
      <div className="flex w-full flex-wrap items-baseline gap-x-1.5 gap-y-1">
        {clvSegment('CLV5', c5)}
        <span className="text-sm font-medium text-secondary" aria-hidden>
          ·
        </span>
        {clvSegment('CLV10', c10)}
      </div>
    )
  }
  return <span className="text-lg font-bold text-primary">{raw}</span>
}

export function IndicatorGrid({ subtitle, slots, onIndicatorClick }: IndicatorGridProps) {
  const gridCols = useMediaGridColumns()
  const trendSubClass = (sub?: string): string | undefined => {
    if (!sub) return undefined
    if (sub.includes('▲')) return 'text-[#DC2626]'
    if (sub.includes('▼')) return 'text-[#2563EB]'
    return undefined
  }

  return (
    <section className="overflow-x-hidden border-t border-default px-4 py-6 sm:px-8">
      <h3 className="text-[15px] font-bold tracking-tight text-primary">로직 지표</h3>
      {subtitle ? <p className="mt-1 text-xs text-secondary">{subtitle}</p> : null}
      <div className="mt-6 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:auto-rows-fr lg:grid-cols-3 lg:auto-rows-fr">
        {slots.map(({ metric, showSectorInterestBadge }, index) => {
          const key = `${metric.descriptionKey}:${metric.title}:${index}`
          const tooltipColumnIndex = gridSlotColumnIndex(index, gridCols)
          const { Icon, iconColor } = resolveIndicatorPresentation(metric)
          const severity = resolveIndicatorSeverity(metric)

          const supplySplit =
            metric.descriptionKey === 'supply' &&
            metric.supplyForeignWon != null &&
            metric.supplyInstitutionWon != null

          const consensusSplit =
            metric.descriptionKey === 'consensus' &&
            metric.consensusAvgWon != null &&
            metric.consensusMaxWon != null

          const candleSplit = metric.descriptionKey === 'candleQuality'

          const primaryRows = supplySplit
            ? supplyPrimaryRows(metric.supplyForeignWon!, metric.supplyInstitutionWon!)
            : undefined
          const primarySlot = candleSplit
            ? candleQualityPrimarySlot(metric.value)
            : consensusSplit
              ? consensusPrimarySlot(metric.consensusAvgWon!, metric.consensusMaxWon!, metric.subValue)
              : undefined

          const primary = primarySlot || primaryRows ? '\u00a0' : normalizeIndicatorPrimary(metric)
          const isIndicators = metric.descriptionKey === 'indicators'
          const primaryNumeric = !primarySlot && looksNumericPrimary(primary) && !isIndicators
          const hideSub = supplySplit || consensusSplit

          return (
            <IndicatorCard
              key={key}
              data-uniform-cell
              icon={<Icon aria-hidden />}
              iconColor={iconColor}
              label={metric.title}
              primary={primary}
              primaryRows={primaryRows}
              primarySlot={primarySlot}
              primaryNumeric={primaryNumeric}
              primaryClassName={
                isIndicators
                  ? 'text-lg font-bold text-primary font-sans-en tabular-nums'
                  : metric.descriptionKey === 'statistics' || metric.descriptionKey === 'epsGrowth'
                    ? 'text-lg font-bold text-primary font-sans-en tabular-nums'
                    : primaryValueClass(metric.valueEmphasis)
              }
              sub={metric.subValue}
              hideSub={hideSub}
              subClassName={
                metric.descriptionKey === 'consensus'
                  ? subValueClass(metric.subValueEmphasis)
                  : metric.descriptionKey === 'roe'
                    ? (trendSubClass(metric.subValue) ?? subValueClass(metric.subValueEmphasis))
                    : subValueClass(metric.subValueEmphasis)
              }
              severity={severity}
              descriptionKey={metric.descriptionKey}
              tooltipContent={metric.indicatorTooltipOverride}
              cornerBadge={metric.cornerBadge}
              supportTag={showSectorInterestBadge ? '관심' : undefined}
              tooltipColumnIndex={tooltipColumnIndex}
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              onClick={() => {
                onIndicatorClick?.(metric.descriptionKey, metric)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onIndicatorClick?.(metric.descriptionKey, metric)
                }
              }}
            />
          )
        })}
      </div>
    </section>
  )
}
