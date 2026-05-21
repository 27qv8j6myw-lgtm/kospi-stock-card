import { useState } from 'react'
import { StockChart, type ChartPeriod } from '@/components/stock/StockChart'
import { ProInvestorBox } from './ProInvestorBox'
import { ProRange52Week } from './ProRange52Week'

type Investor = {
  foreign?: { cumulativeNet?: number; buyDays?: number }
  institute?: { cumulativeNet?: number; buyDays?: number }
  days?: number
}

type Week52 = { high52w?: number; low52w?: number }

type Props = {
  code: string
  investor?: Investor | null
  week52?: Week52 | null
  currentPrice?: number
}

const PERIODS: ChartPeriod[] = ['1M', '3M', '1Y']

function ChartTab({
  label,
  active,
  onClick,
}: {
  label: ChartPeriod
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-7 rounded-md px-3 text-[11px] font-semibold transition-colors ${
        active
          ? 'bg-gray-900 text-white'
          : 'border border-gray-200 bg-white text-gray-600 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  )
}

export function ProChartSidePanel({ code, investor, week52, currentPrice }: Props) {
  const [period, setPeriod] = useState<ChartPeriod>('1M')
  const totalDays = investor?.days ?? 5

  return (
    <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <div className="flex h-7 gap-1">
          {PERIODS.map((p) => (
            <ChartTab
              key={p}
              label={p}
              active={period === p}
              onClick={() => setPeriod(p)}
            />
          ))}
        </div>
        <div className="min-h-[200px] flex-1 md:min-h-[160px] [&>*]:h-full">
          <StockChart code={code} variant="pro" period={period} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {investor ? (
          <div className="grid grid-cols-2 gap-2">
            <ProInvestorBox
              label="외국인"
              amount={investor.foreign?.cumulativeNet ?? 0}
              buyDays={investor.foreign?.buyDays}
              totalDays={totalDays}
            />
            <ProInvestorBox
              label="기관"
              amount={investor.institute?.cumulativeNet ?? 0}
              buyDays={investor.institute?.buyDays}
              totalDays={totalDays}
            />
          </div>
        ) : null}

        {week52 ? (
          <ProRange52Week week52={week52} currentPrice={currentPrice} />
        ) : null}
      </div>
    </div>
  )
}
