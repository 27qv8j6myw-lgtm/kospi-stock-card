import { CalendarClock, CalendarDays, CalendarRange, Sunrise } from 'lucide-react'
import type { CalculateTargetPricesResult, TargetPriceRow } from '../types/stock'
import type { TargetPriceDisplayMode } from '../lib/targetPriceDisplayMode'
import { CardHeader } from './ui/CardHeader'

export type ChartHorizonLabel = TargetPriceRow['label']

export type PriceTargetsProps = {
  result: CalculateTargetPricesResult | null
  loading?: boolean
  displayMode?: TargetPriceDisplayMode
  /** 목표가 카드 클릭 시 메인 차트 수평선 연동 (구현 예정) */
  onChartTargetSelect?: (label: ChartHorizonLabel, price: number) => void
}

const ICON_BOX = 'size-5 shrink-0'
const ICON_STROKE = 1.75

function PeriodIcon({ label }: { label: TargetPriceRow['label'] }) {
  switch (label) {
    case '1D':
      return <Sunrise className={`${ICON_BOX} text-[#EA580C]`} strokeWidth={ICON_STROKE} aria-hidden />
    case '7D':
      return <CalendarDays className={`${ICON_BOX} text-[#2563EB]`} strokeWidth={ICON_STROKE} aria-hidden />
    case '1M':
      return <CalendarRange className={`${ICON_BOX} text-[#9333EA]`} strokeWidth={ICON_STROKE} aria-hidden />
    case '3M':
      return <CalendarClock className={`${ICON_BOX} text-[#059669]`} strokeWidth={ICON_STROKE} aria-hidden />
    default:
      return null
  }
}

function formatPriceFigure(v: number) {
  if (!Number.isFinite(v)) return '—'
  return `${Math.round(v).toLocaleString('ko-KR')}원`
}

function formatReturnPct(pct: number) {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

function formatProbPct(p: number) {
  if (!Number.isFinite(p)) return '0%'
  return `${Math.round(p)}%`
}

export function PriceTargets({
  result,
  loading,
  displayMode = 'normal',
  onChartTargetSelect,
}: PriceTargetsProps) {
  const mode = displayMode

  const bannerText =
    mode === 'takeProfitReference'
      ? '현재 익절 단계입니다. 목표가는 참고용입니다.'
      : mode === 'nonEntryReference'
        ? '현재 진입 비추천 단계입니다.'
        : null

  const titleRow = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <h3 className="text-[15px] font-bold tracking-tight text-primary">목표가</h3>
      {mode !== 'normal' ? (
        <span className="rounded-md bg-neutral-bg px-2 py-0.5 text-xs font-medium text-secondary ring-1 ring-[#E5E7EB]">
          참고용
        </span>
      ) : null}
      {bannerText ? <span className="text-sm text-tertiary">{bannerText}</span> : null}
    </div>
  )

  if (loading) {
    return (
      <section className="border-t border-default px-6 py-6 sm:px-8">
        {titleRow}
        <p className="mt-3 text-xs text-secondary">계산 중…</p>
      </section>
    )
  }

  if (!result || result.targets.length === 0) {
    return (
      <section className="border-t border-default px-6 py-6 sm:px-8">
        {titleRow}
        <p className="mt-3 text-xs text-secondary">종목 가격을 불러오면 목표가가 표시됩니다.</p>
      </section>
    )
  }

  const { targets, warnings: rawWarnings, notes: rawNotes } = result
  const warnings = Array.isArray(rawWarnings) ? rawWarnings : []
  const notes = Array.isArray(rawNotes) ? rawNotes : []

  return (
    <section className="border-t border-default px-6 py-6 sm:px-8">
      {titleRow}

      {warnings.length > 0 ? (
        <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-amber-800">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
      {notes.length > 0 ? (
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-secondary">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}

      <div className="mx-auto mt-4 w-full max-w-[1280px] grid grid-cols-2 gap-4 lg:grid-cols-4">
        {targets.map((target) => {
          const up = target.expectedReturnPct >= 0
          const pctClass = up ? 'text-[#DC2626]' : 'text-[#2563EB]'
          const upProb = formatProbPct(target.probability)
          const dnProb = formatProbPct(target.stopHitProbability)
          const nVal =
            typeof target.backtestSampleSize === 'number' && Number.isFinite(target.backtestSampleSize)
              ? target.backtestSampleSize
              : '—'

          return (
            <button
              key={target.label}
              type="button"
              title="차트 목표선(예정)"
              onClick={() => onChartTargetSelect?.(target.label, target.targetPrice)}
              className="flex h-full min-h-[168px] w-full min-w-0 flex-col overflow-visible rounded-[14px] border border-[#E5E7EB] bg-white p-5 text-left shadow-none transition hover:bg-[#FAFAFA]"
            >
              <CardHeader icon={<PeriodIcon label={target.label} />} label={target.label} />

              <span className="mt-2 whitespace-nowrap font-sans-en text-xl font-bold tabular-nums text-primary">
                {formatPriceFigure(target.targetPrice)}
              </span>
              <span
                className={`mt-1 whitespace-nowrap font-sans-en text-base font-semibold tabular-nums ${pctClass}`}
              >
                {formatReturnPct(target.expectedReturnPct)}
              </span>

              <div className="mt-auto flex flex-col gap-1 pt-4">
                <p className="whitespace-nowrap text-sm tabular-nums">
                  <span className="text-[#DC2626]">▲</span>
                  <span className="text-primary"> 상승 도달 {upProb}</span>
                </p>
                <p className="whitespace-nowrap text-sm tabular-nums">
                  <span className="text-[#2563EB]">▼</span>
                  <span className="text-primary"> 손절 도달 {dnProb}</span>
                </p>
                <p className="whitespace-nowrap text-xs tabular-nums text-tertiary">N={nVal}</p>
              </div>
            </button>
          )
        })}
      </div>

      <p className="mt-3 text-xs italic text-tertiary">
        달성확률은 직전 3년 백테스트 N회 기준. ATR 기반 변동성 모델로 보정.
      </p>
    </section>
  )
}
