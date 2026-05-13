import { useEffect, useRef, useState } from 'react'
import { CalendarClock, CalendarDays, CalendarRange, Info, Sunrise } from 'lucide-react'
import type { CalculateTargetPricesResult, TargetPriceRow } from '../types/stock'
import type { TargetPriceDisplayMode } from '../lib/targetPriceDisplayMode'
import { TARGET_PRICE_HEURISTIC_DISCLAIMER } from '../lib/targetPriceDisclaimer'

type TargetPricePanelProps = {
  result: CalculateTargetPricesResult | null
  loading?: boolean
  displayMode?: TargetPriceDisplayMode
}

function formatKrw(v: number) {
  return `${v.toLocaleString('ko-KR')}원`
}

function formatReturnPct(pct: number) {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

function formatStopLossPct(pct: number) {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

/** 상방 휴리스틱 %가 중립대일 때 직설적 표현 */
function upsideProbabilityHint(p: number): string | null {
  if (p >= 48 && p <= 52) return '기대값 중립 (동전 던지기에 가까운 50:50)'
  return null
}

const TP_ICON_BOX = 'size-[18px] shrink-0'
const TP_ICON_STROKE = 1.75

function TargetHorizonIcon({ label }: { label: TargetPriceRow['label'] }) {
  switch (label) {
    case '1D':
      return <Sunrise className={`${TP_ICON_BOX} text-[#EA580C]`} strokeWidth={TP_ICON_STROKE} aria-hidden />
    case '7D':
      return <CalendarDays className={`${TP_ICON_BOX} text-[#2563EB]`} strokeWidth={TP_ICON_STROKE} aria-hidden />
    case '1M':
      return <CalendarRange className={`${TP_ICON_BOX} text-[#9333EA]`} strokeWidth={TP_ICON_STROKE} aria-hidden />
    case '3M':
      return <CalendarClock className={`${TP_ICON_BOX} text-[#059669]`} strokeWidth={TP_ICON_STROKE} aria-hidden />
    default:
      return null
  }
}

function formatProbPct(p: number) {
  if (!Number.isFinite(p)) return '0%'
  return `${Math.round(p)}%`
}

function TargetPriceDisclaimerInfo() {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-expanded={open}
        aria-label="목표가·확률 산출 방식 안내"
        className="-m-1 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-default bg-neutral-bg p-1 text-secondary transition-colors hover:bg-app sm:min-h-0 sm:min-w-0"
      >
        <Info className="size-3.5" aria-hidden />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="목표가 산출 안내"
          className="absolute right-0 top-full z-[100] mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-default bg-card p-3 shadow-lg"
        >
          <p className="text-sm font-medium leading-snug text-primary">{TARGET_PRICE_HEURISTIC_DISCLAIMER}</p>
        </div>
      ) : null}
    </div>
  )
}

export function TargetPricePanel({ result, loading, displayMode = 'normal' }: TargetPricePanelProps) {
  const mode = displayMode
  const sectionTitle =
    mode === 'takeProfitReference'
      ? '참고: 잔여 상승 여력'
      : mode === 'nonEntryReference'
        ? '참고: 목표가'
        : '목표가'

  const titleRow = (
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="text-[15px] font-bold tracking-tight text-primary">{sectionTitle}</h3>
      {mode !== 'normal' ? (
        <span className="rounded-md bg-neutral-bg px-2 py-0.5 text-xs font-medium text-secondary ring-1 ring-[#E5E7EB]">
          참고용
        </span>
      ) : null}
      <TargetPriceDisclaimerInfo />
    </div>
  )

  const banner =
    mode === 'takeProfitReference' ? (
      <div
        className="mt-3 rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2.5 text-[13px] font-medium leading-snug text-amber-950"
        role="status"
      >
        현재 익절 단계입니다. 아래 목표가는 추가 상승 시나리오일 뿐, 매수 근거가 아닙니다.
      </div>
    ) : mode === 'nonEntryReference' ? (
      <div
        className="mt-3 rounded-lg border border-medium/90 bg-app px-3 py-2.5 text-[13px] font-medium leading-snug text-primary"
        role="status"
      >
        현재 진입 권장 단계가 아닙니다. 목표가는 참고용입니다.
      </div>
    ) : null

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

  const { targets, warnings, notes, stopPrice, stopLossPct } = result

  return (
    <section className="border-t border-default px-6 py-6 sm:px-8">
      {titleRow}
      {banner}

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

      <p className="mt-3 text-[11px] leading-relaxed text-secondary">{TARGET_PRICE_HEURISTIC_DISCLAIMER}</p>

      <div className="mx-auto mt-4 grid w-full max-w-[1280px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {targets.map((target) => {
          const hint = upsideProbabilityHint(target.probability)
          const up = target.expectedReturnPct >= 0
          const pctClass = up ? 'text-[#DC2626]' : 'text-[#2563EB]'
          const nVal =
            typeof target.backtestSampleSize === 'number' && Number.isFinite(target.backtestSampleSize)
              ? target.backtestSampleSize
              : '—'

          return (
            <article
              key={target.label}
              title={TARGET_PRICE_HEURISTIC_DISCLAIMER}
              className="flex h-full min-h-[168px] w-full min-w-0 flex-col overflow-visible rounded-[14px] border border-default bg-card p-5 shadow-sm"
            >
              <div className="flex min-h-[22px] items-center gap-2">
                <TargetHorizonIcon label={target.label} />
                <span className="text-base font-medium text-primary">{target.label}</span>
              </div>
              <p className="mt-2 whitespace-nowrap font-sans-en text-xl font-bold tabular-nums text-primary">
                {formatKrw(target.targetPrice)}
              </p>
              <p className={`mt-1 whitespace-nowrap font-sans-en text-base font-semibold tabular-nums ${pctClass}`}>
                {formatReturnPct(target.expectedReturnPct)}
              </p>
              <div className="mt-auto flex flex-col gap-1 pt-4">
                <p className="whitespace-nowrap text-sm tabular-nums">
                  <span className="text-[#DC2626]">▲</span>
                  <span className="text-primary"> 상승 도달 {formatProbPct(target.probability)}</span>
                </p>
                <p className="whitespace-nowrap text-sm tabular-nums">
                  <span className="text-[#2563EB]">▼</span>
                  <span className="text-primary"> 손절 도달 {formatProbPct(target.stopHitProbability)}</span>
                </p>
                <p className="whitespace-nowrap text-xs tabular-nums text-tertiary">N={nVal}</p>
              </div>
              {hint ? <p className="mt-2 text-[11px] leading-snug text-secondary">{hint}</p> : null}
              <p className="mt-3 text-[11px] leading-snug text-secondary">
                손절 {formatKrw(stopPrice)} ({formatStopLossPct(stopLossPct)}) · 전 기간 동일
              </p>
              <p className="mt-1.5 text-[10px] text-tertiary">{target.method}</p>
              {target.note ? (
                <p className="mt-2 text-[11px] leading-snug text-secondary">{target.note}</p>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
