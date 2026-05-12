import type { ScreenerStock } from '../lib/screener'
import {
  Building2,
  CircleGauge,
  Medal,
  TrendingUp,
} from 'lucide-react'

function fmtWon(n: number) {
  return `${Math.round(n).toLocaleString()}원`
}

type Props = { top5: ScreenerStock[] }

export function Top5Ranking({ top5 }: Props) {
  return (
    <section className="space-y-3">
      <h3 className="inline-flex items-center gap-2 text-lg font-bold text-slate-900">
        <Medal className="size-5 text-amber-600" />
        전체 TOP5
      </h3>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {top5.map((stock, idx) => {
          return (
            <article
              key={stock.code}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="rounded-xl bg-white p-3">
                <p className="text-xs font-semibold text-amber-700">TOP{idx + 1}</p>
                <h4 className="mt-1 text-lg font-bold text-slate-900">{stock.name}</h4>
                <p className="mt-1 text-xs text-slate-500">{stock.sector}</p>
              </div>

              <div className="mt-2 space-y-1 rounded-xl bg-white p-3 text-xs text-slate-700">
                <p className="inline-flex w-full items-center gap-1 whitespace-nowrap">
                  <Building2 className="size-3.5 text-slate-500" />
                  현재가 {fmtWon(stock.currentPrice)}
                </p>
                <p className="inline-flex w-full items-center gap-1 whitespace-nowrap text-emerald-700">
                  <TrendingUp className="size-3.5" />
                  1M +{stock.expectedReturnPct.toFixed(1)}%
                </p>
                <p className="inline-flex w-full items-center gap-1 whitespace-nowrap">
                  <CircleGauge className="size-3.5 text-slate-500" />
                  달성확률 {stock.probability1M}%
                </p>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
