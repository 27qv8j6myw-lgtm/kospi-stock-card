import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

export type HomeStockRow = {
  code: string
  name?: string | null
  currentPrice?: number | null
  changePct?: number | null
  return3D?: number | null
  sector?: string | null
  tradingValue?: number | null
  lastViewedAt?: string | null
  [key: string]: unknown
}

export type StockColumnProps = {
  title: string
  icon: ReactNode
  subtitle: string
  stocks: HomeStockRow[]
  showRank: boolean
  metaKey: string
  metaFormatter?: (value: unknown) => string
  changeKey?: string
  emptyMessage?: string
  onStockClick: (code: string, name?: string | null) => void
  loading: boolean
}

export function StockColumn({
  title,
  icon,
  subtitle,
  stocks,
  showRank,
  metaKey,
  metaFormatter,
  changeKey = 'changePct',
  emptyMessage,
  onStockClick,
  loading,
}: StockColumnProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-tight text-gray-900">
          {icon}
          <span>{title}</span>
        </div>
        <span className="text-[10px] tabular-nums tracking-tight text-gray-300">{subtitle}</span>
      </div>

      <div className="flex flex-col gap-1">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={16} className="animate-spin text-gray-300" aria-hidden />
          </div>
        ) : stocks.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-gray-200 bg-white px-3 py-6 text-center text-[11px] tracking-tight text-gray-400">
            {emptyMessage || '데이터 없음'}
          </div>
        ) : (
          stocks.map((stock, idx) => {
            const metaValue = stock[metaKey]
            const displayMeta = metaFormatter ? metaFormatter(metaValue) : metaValue != null ? String(metaValue) : ''
            const rawChange = stock[changeKey] ?? stock.changePct
            const change =
              rawChange != null && typeof rawChange === 'number' && Number.isFinite(rawChange)
                ? rawChange
                : rawChange != null
                  ? Number(rawChange)
                  : null

            return (
              <button
                key={stock.code}
                type="button"
                onClick={() => {
                  console.log('[StockColumn] 클릭됨:', stock.code)
                  onStockClick(stock.code, stock.name ?? null)
                }}
                className="flex items-center gap-2 rounded-[10px] border border-gray-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-gray-900"
              >
                {showRank ? (
                  <span
                    className={`w-3.5 text-center text-[10px] font-medium tabular-nums ${
                      idx < 3 ? 'font-semibold text-gray-900' : 'text-gray-300'
                    }`}
                  >
                    {idx + 1}
                  </span>
                ) : null}

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="truncate text-xs font-medium tracking-tight text-gray-900">
                    {stock.name || stock.code}
                  </div>
                  <div className="truncate text-[10px] tracking-tight text-gray-400">{displayMeta}</div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <div className="text-[11px] font-medium tabular-nums text-gray-900">
                    {stock.currentPrice != null && Number.isFinite(Number(stock.currentPrice))
                      ? Number(stock.currentPrice).toLocaleString('ko-KR')
                      : '—'}
                  </div>
                  {change != null && Number.isFinite(change) ? (
                    <div
                      className={`text-[10px] font-medium tabular-nums ${
                        change > 0 ? 'text-red-600' : change < 0 ? 'text-blue-600' : 'text-gray-500'
                      }`}
                    >
                      {change > 0 ? '+' : ''}
                      {change.toFixed(2)}%
                    </div>
                  ) : null}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
