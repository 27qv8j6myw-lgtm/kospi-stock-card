import { X } from 'lucide-react'
import type { LogicMetric } from '../types/stock'

type MetricDetailDrawerProps = {
  metric: LogicMetric | null
  onClose: () => void
}

function EarningsSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const w = 260
  const h = 52
  const pad = 6
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2)
      const y = pad + (1 - (v - min) / span) * (h - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <div className="mt-4 border-t border-light pt-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-secondary">직전 분기 서프라이즈 추이</p>
      <svg
        width={w}
        height={h}
        className="mt-2 text-info-text"
        viewBox={`0 0 ${w} ${h}`}
        aria-hidden
      >
        <polyline fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" points={pts} />
      </svg>
      <p className="mt-1 text-[10px] text-tertiary">과거 4분기 · 컨센 대비 % (좌→우 최근)</p>
    </div>
  )
}

export function MetricDetailDrawer({ metric, onClose }: MetricDetailDrawerProps) {
  if (!metric) return null
  const body = metric.detailForDrawer?.trim()
  const showEarningsSpark =
    metric.descriptionKey === 'earnings' && Array.isArray(metric.sparkline) && metric.sparkline.length >= 2
  if (!body && !showEarningsSpark) return null

  return (
    <div className="fixed inset-0 z-[140] flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-primary/40"
        aria-label="닫기"
        onClick={onClose}
      />
      <div className="relative flex h-full w-full max-w-sm flex-col border-l border-default bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-light px-4 py-3">
          <p className="text-sm font-semibold text-primary">{metric.title}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-secondary hover:bg-app hover:text-primary"
            aria-label="패널 닫기"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {body ? (
            <p className="whitespace-pre-line text-xs leading-relaxed text-secondary">{body}</p>
          ) : null}
          {showEarningsSpark ? <EarningsSparkline values={metric.sparkline!} /> : null}
          {metric.descriptionKey === 'consensus' && metric.tooltipSummary ? (
            <div className="mt-6 border-t border-light pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-secondary">
                투자의견 점수 안내
              </p>
              <p className="mt-2 text-xs leading-relaxed text-secondary">{metric.tooltipSummary}</p>
            </div>
          ) : null}
          {metric.descriptionKey === 'supply' && metric.tooltipSummary ? (
            <div className="mt-6 border-t border-light pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-secondary">수급 안내</p>
              <p className="mt-2 text-xs leading-relaxed text-secondary">{metric.tooltipSummary}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
