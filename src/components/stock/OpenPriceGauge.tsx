export type OpenPriceGaugeProps = {
  label: string
  openPrice: number
  currentPrice: number
}

export function OpenPriceGauge({ label, openPrice, currentPrice }: OpenPriceGaugeProps) {
  const change = currentPrice - openPrice
  const changePct = openPrice > 0 ? (change / openPrice) * 100 : 0
  const isUp = change >= 0

  const maxPct = 5
  const offsetPct = openPrice > 0 ? Math.max(Math.min(changePct / maxPct, 1), -1) * 50 : 0
  const position = 50 + offsetPct

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-semibold text-gray-500">{label}</span>
        <span
          className={`text-[11px] font-bold tabular-nums ${isUp ? 'text-red-600' : 'text-blue-600'}`}
        >
          {openPrice > 0 ? `${isUp ? '+' : ''}${changePct.toFixed(2)}%` : '—'}
        </span>
      </div>

      <div className="relative mb-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div className="absolute bottom-0 left-1/2 top-0 z-10 w-px bg-gray-400" />
        {isUp ? (
          <div
            className="absolute bottom-0 top-0 bg-red-200"
            style={{ left: '50%', width: `${Math.max(position - 50, 0)}%` }}
          />
        ) : (
          <div
            className="absolute bottom-0 top-0 bg-blue-200"
            style={{ right: '50%', width: `${Math.max(50 - position, 0)}%` }}
          />
        )}
        <div
          className={`absolute -top-1 z-20 h-3.5 w-[3px] rounded-sm ${isUp ? 'bg-red-600' : 'bg-blue-600'}`}
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        />
      </div>

      <div className="flex justify-between text-[9px] tabular-nums text-gray-500">
        <span>시 {openPrice > 0 ? openPrice.toLocaleString() : '—'}</span>
        <span>현 {currentPrice > 0 ? currentPrice.toLocaleString() : '—'}</span>
      </div>
    </div>
  )
}
