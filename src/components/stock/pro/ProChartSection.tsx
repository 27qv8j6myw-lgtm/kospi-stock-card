import { useState } from 'react'
import { Calendar, Clock, TrendingUp } from 'lucide-react'
import { IntradayChartBody } from '@/components/stock/IntradayChartBody'
import { StockChart, type ChartPeriod } from '@/components/stock/StockChart'
import { isKrxMarketOpen } from '@/lib/isKrxMarketOpen'
import { PRO_ICON } from '@/lib/proStockDesign'

const PERIODS: ChartPeriod[] = ['1M', '3M', '1Y']
const PRO_CHART_HEIGHT = 'h-[160px]'

type Week52 = { high52w?: number; low52w?: number; pctFromHigh?: number | null }

type Props = {
  code: string
  market?: string | null
  week52?: Week52 | null
  currentPrice?: number
}

function week52HeaderLabel(week52: Week52 | null | undefined, currentPrice?: number): string | null {
  if (week52?.pctFromHigh != null && Number.isFinite(week52.pctFromHigh)) {
    const p = week52.pctFromHigh
    return `52주 ${p > 0 ? '+' : ''}${p}% from 최고`
  }
  const high = week52?.high52w
  if (high != null && currentPrice != null && high > 0) {
    const p = (((currentPrice - high) / high) * 100).toFixed(1)
    return `52주 ${p}% from 최고`
  }
  return null
}

export function ProChartSection({ code, market, week52, currentPrice }: Props) {
  const [period, setPeriod] = useState<ChartPeriod>('1M')
  const week52Label = week52HeaderLabel(week52, currentPrice)
  const marketOpen = isKrxMarketOpen()

  return (
    <div className="border-b border-gray-100 px-4 py-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TrendingUp {...PRO_ICON} className="text-blue-500" strokeWidth={1.8} />
        <span className="text-[16px] font-bold text-gray-900">차트</span>
        {week52Label ? (
          <span className="ml-auto text-[11px] tabular-nums text-gray-500">{week52Label}</span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <div className="flex min-w-0 flex-col">
          <div className="mb-2 flex h-6 shrink-0 items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock size={12} className="text-emerald-600" strokeWidth={2} />
              <span className="text-[11px] font-semibold text-gray-500">오늘 (9:00~15:30)</span>
            </div>
            {marketOpen ? (
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
                LIVE
              </span>
            ) : null}
          </div>
          <div className={`${PRO_CHART_HEIGHT} w-full shrink-0 overflow-hidden`}>
            <IntradayChartBody code={code} market={market} compact />
          </div>
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="mb-2 flex h-6 shrink-0 items-center justify-between gap-2">
            <div className="flex shrink-0 items-center gap-1.5">
              <Calendar size={12} className="text-blue-500" strokeWidth={2} />
              <span className="text-[11px] font-semibold text-gray-500">기간</span>
            </div>
            <div className="flex gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                    period === p
                      ? 'bg-gray-900 text-white'
                      : 'border border-gray-200 bg-white text-gray-500'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className={`${PRO_CHART_HEIGHT} w-full shrink-0 overflow-hidden`}>
            <StockChart code={code} variant="pro" period={period} />
          </div>
        </div>
      </div>
    </div>
  )
}
