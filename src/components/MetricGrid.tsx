import { useMemo, useState } from 'react'
import {
  Activity,
  CandlestickChart,
  CircleAlert,
  Droplets,
  Globe2,
  Landmark,
  Layers,
  Map,
  Percent,
  RefreshCw,
  Ruler,
  SlidersHorizontal,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { parseClvFromMetricValue, formatClvSigned } from '../lib/metricEducation'
import { formatKrwAmountToEok, formatSignedSharesKr } from '../lib/signalLogic'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useUniformCellHeights } from '../hooks/useUniformCellHeights'
import { MetricInfoTooltip } from './MetricInfoTooltip'
import type { LogicMetric } from '../types/stock'

const iconMap: Record<string, LucideIcon> = {
  Layers,
  Zap,
  Ruler,
  TrendingUp,
  Globe2,
  Landmark,
  RefreshCw,
  Map,
  Users,
  SlidersHorizontal,
  CandlestickChart,
  Droplets,
  Activity,
  CircleAlert,
  Percent,
}

const toneClass: Record<LogicMetric['tone'], string> = {
  blue: 'text-blue-600',
  violet: 'text-violet-600',
  amber: 'text-amber-600',
  sky: 'text-sky-600',
  emerald: 'text-emerald-600',
  indigo: 'text-indigo-600',
  orange: 'text-orange-600',
  cyan: 'text-cyan-600',
  teal: 'text-teal-600',
  rose: 'text-rose-600',
  slate: 'text-slate-600',
  red: 'text-red-600',
}

type MetricGridProps = {
  metrics: LogicMetric[]
  subtitle?: string
}

export function MetricGrid({ metrics, subtitle }: MetricGridProps) {
  const [openMetric, setOpenMetric] = useState<string | null>(null)
  const isMdUp = useMediaQuery('(min-width: 768px)')
  const cols = isMdUp ? 3 : 2
  const layoutKey = useMemo(
    () => metrics.map((m) => `${m.title}:${m.value}`).join('|'),
    [metrics],
  )
  const gridRef = useUniformCellHeights(layoutKey)

  const signedTone = (n: number) =>
    n > 0 ? 'text-rose-600' : n < 0 ? 'text-sky-600' : 'text-slate-500'

  return (
    <section className="overflow-visible border-t border-slate-200 px-6 py-6 sm:px-8">
      <h3 className="text-lg font-bold tracking-tight text-slate-900">로직 지표</h3>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      <div
        ref={gridRef}
        className="mt-4 grid grid-cols-2 gap-2.5 overflow-visible md:grid-cols-3"
      >
        {metrics.map((metric, index) => {
          const Icon = iconMap[metric.icon] ?? Activity
          const key = `${metric.title}:${metric.value}`
          const col = index % cols
          const tooltipSide = col === cols - 1 ? 'end' : 'start'
          return (
            <article
              key={metric.title}
              data-uniform-cell
              className="relative flex h-full min-h-0 flex-col overflow-visible rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <Icon className={`size-6 ${toneClass[metric.tone]}`} />
                <p className="text-sm font-semibold text-slate-700">{metric.title}</p>
                {metric.statusBadge ? (
                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
                    {metric.statusBadge}
                  </span>
                ) : null}
                <MetricInfoTooltip
                  metric={metric}
                  open={openMetric === key}
                  onOpen={() => setOpenMetric(key)}
                  onClose={() => setOpenMetric((prev) => (prev === key ? null : prev))}
                  onToggle={() =>
                    setOpenMetric((prev) => (prev === key ? null : key))
                  }
                  tooltipSide={tooltipSide}
                />
              </div>
              <p className="mt-2 text-[13px] font-semibold leading-snug text-slate-900">{metric.value}</p>
              {metric.descriptionKey === 'candleQuality' ? (() => {
                const { clv5, clv10 } = parseClvFromMetricValue(metric.value)
                if (clv5 == null && clv10 == null) return null
                return (
                  <div className="mt-2 space-y-0.5 text-[12px] tabular-nums leading-snug">
                    {clv5 != null ? (
                      <p>
                        <span className="text-slate-500">CLV5 </span>
                        <span className={`font-semibold ${signedTone(clv5)}`}>
                          {formatClvSigned(clv5)}
                        </span>
                      </p>
                    ) : null}
                    {clv10 != null ? (
                      <p>
                        <span className="text-slate-500">CLV10 </span>
                        <span className={`font-semibold ${signedTone(clv10)}`}>
                          {formatClvSigned(clv10)}
                        </span>
                      </p>
                    ) : null}
                  </div>
                )
              })() : null}
              {metric.descriptionKey === 'supply' && metric.supplyDetails ? (
                <div className="mt-2 space-y-1 text-[12px] leading-snug text-slate-700">
                  <p>
                    <span className="text-slate-500">외국인 3일: </span>
                    <span className={`font-semibold tabular-nums ${signedTone(metric.supplyDetails.foreignNetShares3D)}`}>
                      {formatSignedSharesKr(metric.supplyDetails.foreignNetShares3D)}
                    </span>
                    <span className="text-slate-400"> / </span>
                    <span className={`font-semibold ${signedTone(metric.supplyDetails.foreignNetAmount3D)}`}>
                      {formatKrwAmountToEok(metric.supplyDetails.foreignNetAmount3D)}
                    </span>
                  </p>
                  <p>
                    <span className="text-slate-500">기관 3일: </span>
                    <span className={`font-semibold tabular-nums ${signedTone(metric.supplyDetails.institutionNetShares3D)}`}>
                      {formatSignedSharesKr(metric.supplyDetails.institutionNetShares3D)}
                    </span>
                    <span className="text-slate-400"> / </span>
                    <span className={`font-semibold ${signedTone(metric.supplyDetails.institutionNetAmount3D)}`}>
                      {formatKrwAmountToEok(metric.supplyDetails.institutionNetAmount3D)}
                    </span>
                  </p>
                  <p>
                    <span className="text-slate-500">개인 3일: </span>
                    <span className={`font-semibold tabular-nums ${signedTone(metric.supplyDetails.retailNetShares3D)}`}>
                      {formatSignedSharesKr(metric.supplyDetails.retailNetShares3D)}
                    </span>
                    <span className="text-slate-400"> / </span>
                    <span className={`font-semibold ${signedTone(metric.supplyDetails.retailNetAmount3D)}`}>
                      {formatKrwAmountToEok(metric.supplyDetails.retailNetAmount3D)}
                    </span>
                  </p>
                </div>
              ) : null}
              {metric.subValue ? (
                <p
                  className={`mt-1 text-[12px] leading-snug text-slate-700 ${
                    metric.descriptionKey === 'sectorFlow' ? 'whitespace-pre-line' : ''
                  }`}
                >
                  {metric.subValue}
                </p>
              ) : null}
              {metric.meta ? (
                <p className="mt-1 text-[11px] text-slate-500">{metric.meta}</p>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
