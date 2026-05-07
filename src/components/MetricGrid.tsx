import { useState } from 'react'
import {
  Activity,
  CandlestickChart,
  CircleAlert,
  Droplets,
  Globe2,
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
import { formatKrwAmountToEok } from '../lib/signalLogic'
import { MetricInfoTooltip } from './MetricInfoTooltip'
import type { LogicMetric } from '../types/stock'

const iconMap: Record<string, LucideIcon> = {
  Layers,
  Zap,
  Ruler,
  TrendingUp,
  Globe2,
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
  const signedTone = (n: number) =>
    n > 0 ? 'text-rose-600' : n < 0 ? 'text-sky-600' : 'text-slate-500'

  return (
    <section className="overflow-visible border-t border-slate-200 px-6 py-6 sm:px-8">
      <h3 className="text-[15px] font-bold text-slate-900">로직 지표</h3>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      <div className="mt-4 grid grid-cols-2 gap-2.5 overflow-visible md:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = iconMap[metric.icon] ?? Activity
          const key = `${metric.title}:${metric.value}`
          return (
            <article
              key={metric.title}
              className="relative min-h-[128px] overflow-visible rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Icon className={`size-4 ${toneClass[metric.tone]}`} />
                <p className="text-[11px] font-medium text-slate-500">{metric.title}</p>
                <MetricInfoTooltip
                  metric={metric}
                  open={openMetric === key}
                  onOpen={() => setOpenMetric(key)}
                  onClose={() => setOpenMetric((prev) => (prev === key ? null : prev))}
                  onToggle={() =>
                    setOpenMetric((prev) => (prev === key ? null : key))
                  }
                />
              </div>
              <p className="mt-2 text-[13px] font-semibold leading-snug text-slate-900">{metric.value}</p>
              {metric.supplyDetails ? (
                <p className="mt-2 text-[12px] leading-snug text-slate-700">
                  외국인 <span className={`font-semibold ${signedTone(metric.supplyDetails.foreignNetAmount)}`}>{formatKrwAmountToEok(metric.supplyDetails.foreignNetAmount)}</span>
                  {' · '}
                  기관 <span className={`font-semibold ${signedTone(metric.supplyDetails.institutionNetAmount)}`}>{formatKrwAmountToEok(metric.supplyDetails.institutionNetAmount)}</span>
                  {' · '}
                  개인 <span className={`font-semibold ${signedTone(metric.supplyDetails.retailNetAmount)}`}>{formatKrwAmountToEok(metric.supplyDetails.retailNetAmount)}</span>
                </p>
              ) : null}
              {metric.subValue ? (
                <p className="mt-1 text-[12px] leading-snug text-slate-700">{metric.subValue}</p>
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
