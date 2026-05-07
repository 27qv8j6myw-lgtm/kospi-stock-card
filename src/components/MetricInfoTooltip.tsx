import { useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { metricGuides } from '../lib/metricGuide'
import type { LogicMetric } from '../types/stock'

type MetricInfoTooltipProps = {
  metric: LogicMetric
  open: boolean
  onOpen: () => void
  onClose: () => void
  onToggle: () => void
}

export function MetricInfoTooltip({
  metric,
  open,
  onOpen,
  onClose,
  onToggle,
}: MetricInfoTooltipProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [align, setAlign] = useState<'left' | 'right'>('left')
  const guide = metricGuides[metric.descriptionKey]

  const parsedValue = (() => {
    if (typeof metric.score === 'number' && Number.isFinite(metric.score)) return metric.score
    const m = String(metric.value).match(/-?\d+(\.\d+)?/)
    if (!m) return null
    const n = Number(m[0])
    return Number.isFinite(n) ? n : null
  })()

  const activeRange =
    parsedValue == null
      ? null
      : guide.ranges.find((r) => parsedValue >= r.min && parsedValue <= r.max) ?? null

  const syncAlign = () => {
    const el = wrapRef.current
    if (!el || typeof window === 'undefined') return
    const rect = el.getBoundingClientRect()
    const tooltipWidth = 288 // w-72
    const spaceRight = window.innerWidth - rect.left
    setAlign(spaceRight >= tooltipWidth + 24 ? 'left' : 'right')
  }

  return (
    <div
      ref={wrapRef}
      className="relative ml-1 shrink-0"
      onMouseEnter={() => {
        syncAlign()
        onOpen()
      }}
      onMouseLeave={onClose}
    >
      <button
        type="button"
        onClick={() => {
          syncAlign()
          onToggle()
        }}
        aria-label={`${guide.title} 점수 기준 보기`}
        className="rounded-full p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300"
      >
        <Info className="size-3.5" />
      </button>
      <div
        className={`absolute top-6 z-[80] w-72 rounded-lg border border-slate-700 bg-slate-900/95 p-3 text-xs text-slate-100 shadow-2xl backdrop-blur transition-all duration-150 ${
          align === 'left' ? 'left-0' : 'right-0'
        } ${
          open
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-1 opacity-0'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-slate-100">{guide.title} 기준</p>
          <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
            현재 {parsedValue == null ? 'N/A' : `${parsedValue}${guide.unit}`}
          </span>
        </div>
        <div className="mt-2 space-y-1.5">
          {guide.ranges.map((r) => {
            const isActive = activeRange?.min === r.min && activeRange?.max === r.max
            return (
              <div
                key={`${r.min}-${r.max}-${r.label}`}
                className={`rounded-md border px-2.5 py-2 ${
                  isActive
                    ? 'border-blue-400/60 bg-blue-500/20'
                    : 'border-slate-700 bg-slate-800/50'
                }`}
              >
                <p className={`font-semibold ${isActive ? 'text-blue-200' : 'text-slate-200'}`}>
                  {r.min}~{r.max}
                  {guide.unit}: {r.label}
                </p>
                <p className="mt-0.5 text-slate-300">{r.meaning}</p>
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-slate-300">{guide.note}</p>
        {metric.descriptionKey === 'supply' && metric.tooltipSummary ? (
          <p className="mt-2 border-t border-slate-700 pt-2 text-slate-300">{metric.tooltipSummary}</p>
        ) : null}
      </div>
    </div>
  )
}
