import type { StockInfo } from '../types/stock'

function formatKrw(v: number) {
  return `${v.toLocaleString('ko-KR')}원`
}

type MainStockCardProps = {
  stock: StockInfo
}

export function MainStockCard({ stock }: MainStockCardProps) {
  const isUp = stock.change >= 0

  return (
    <section className="border-b border-slate-200 px-6 py-5 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xl font-bold text-slate-900">{stock.name}</p>
          <p className="mt-1 text-sm text-slate-500">
            {stock.code} · {stock.market} · {stock.sector}
          </p>
        </div>
        <span className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
          {stock.investmentBadge}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1">
        <p className="text-3xl font-bold tracking-tight text-slate-900">{formatKrw(stock.price)}</p>
        <p className={`text-sm font-semibold ${isUp ? 'text-rose-600' : 'text-sky-600'}`}>
          {isUp ? '+' : ''}
          {stock.change.toLocaleString('ko-KR')}원 ({isUp ? '+' : ''}
          {stock.changePercent.toFixed(2)}%)
        </p>
      </div>
    </section>
  )
}
