import { useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { IntradayChartBody } from '@/components/stock/IntradayChartBody'
import { OpenPriceGauge } from '@/components/stock/OpenPriceGauge'
import { PriceGauge } from '@/components/stock/PriceGauge'
import { StockChart, type ChartPeriod } from '@/components/stock/StockChart'
import { VolumeGauge } from '@/components/stock/VolumeGauge'
import { ProSectionHeader } from './ProSectionHeader'

export type ProChartTab = '당일' | ChartPeriod

const TABS: ProChartTab[] = ['당일', '1W', '1M', '3M', '1Y']
/** 탭 + 가격면 + 거래량/X축이 들어가도록 여유를 둔다 */
const CHART_COL_HEIGHT = 'h-[280px] md:h-[320px]'

export type ProQuoteGaugeData = {
  currentPrice?: number | null
  openPrice?: number | null
  dayHigh?: number | null
  dayLow?: number | null
  volume?: number | null
  tradingAmount?: number | null
  avgVolume20d?: number | null
}

type Week52 = { high52w?: number; low52w?: number; pctFromHigh?: number | null }

type Props = {
  code: string
  market?: string | null
  quote: ProQuoteGaugeData
  week52?: Week52 | null
}

function n(v: number | null | undefined, fallback = 0): number {
  return v != null && Number.isFinite(v) ? v : fallback
}

function fmtPrice(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return '—'
  return `${Math.round(v).toLocaleString()}원`
}

function week52Label(
  current: number,
  high: number,
  pctFromHigh?: number | null,
): string {
  if (pctFromHigh != null && Number.isFinite(pctFromHigh)) {
    return `${pctFromHigh > 0 ? '+' : ''}${pctFromHigh}% from 최고`
  }
  if (high > 0 && current > 0) {
    const p = ((current / high - 1) * 100).toFixed(1)
    return `${Number(p) > 0 ? '+' : ''}${p}% from 최고`
  }
  return '—'
}

export function ProChartQuoteSection({ code, market, quote, week52 }: Props) {
  const [period, setPeriod] = useState<ProChartTab>('당일')

  const current = n(quote.currentPrice)
  const open = n(quote.openPrice)
  const dayHigh = n(quote.dayHigh, current)
  const dayLow = n(quote.dayLow, current)
  const high52 = n(week52?.high52w, current)
  const low52 = n(week52?.low52w, current)
  const volume = n(quote.volume)
  const avgVol = n(quote.avgVolume20d)
  const tradingAmount = n(quote.tradingAmount ?? (quote as { tradingValue?: number }).tradingValue)

  const chartPeriod: ChartPeriod | null = period === '당일' ? null : period

  return (
    <section className="border-b border-gray-100 px-4 py-4 sm:px-5">
      <ProSectionHeader
        icon={<TrendingUp size={24} className="text-blue-500" strokeWidth={1.8} />}
        title="차트 & 시세"
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.6fr_1fr] md:items-stretch md:gap-5">
        <div className={`flex min-w-0 flex-col ${CHART_COL_HEIGHT}`}>
          <div className="mb-1.5 flex justify-end">
            <div className="flex gap-1">
              {TABS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`rounded px-2 py-0.5 text-[10px] font-bold transition-colors ${
                    period === p
                      ? 'bg-gray-900 text-white'
                      : 'border border-gray-200 bg-white text-gray-500 hover:border-gray-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {period === '당일' ? (
              <IntradayChartBody code={code} market={market} />
            ) : chartPeriod ? (
              <StockChart code={code} variant="pro" period={chartPeriod} />
            ) : null}
          </div>
        </div>

        <div className="flex h-auto flex-col justify-between gap-3 md:h-[320px] md:gap-0">
          <PriceGauge
            label="1일 범위"
            current={current}
            currentLabel={fmtPrice(current)}
            min={dayLow}
            max={dayHigh}
            minLabel={`저 ${dayLow > 0 ? dayLow.toLocaleString() : '—'}`}
            maxLabel={`고 ${dayHigh > 0 ? dayHigh.toLocaleString() : '—'}`}
            currentColor="default"
          />

          <PriceGauge
            label="52주 범위"
            current={current}
            currentLabel={week52Label(current, high52, week52?.pctFromHigh)}
            min={low52}
            max={high52}
            minLabel={`저 ${low52 > 0 ? low52.toLocaleString() : '—'}`}
            maxLabel={`고 ${high52 > 0 ? high52.toLocaleString() : '—'}`}
            currentColor={current < high52 ? 'blue' : 'red'}
          />

          <OpenPriceGauge label="시가 대비" openPrice={open} currentPrice={current} />

          <VolumeGauge
            label="거래량"
            currentVolume={volume}
            avgVolume={avgVol}
            tradingAmount={tradingAmount}
          />
        </div>
      </div>
    </section>
  )
}
