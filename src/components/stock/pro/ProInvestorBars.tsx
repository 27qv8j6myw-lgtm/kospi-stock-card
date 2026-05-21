import { stockCardTokens, changeToneClass } from '@/lib/stockCardDesignTokens'
import { formatKRW } from '@/lib/format'

type Investor = {
  foreign?: { cumulativeNet?: number; buyDays?: number }
  institute?: { cumulativeNet?: number; buyDays?: number }
}

export function ProInvestorBars({ investor }: { investor: Investor }) {
  const fA = investor.foreign?.cumulativeNet ?? 0
  const iA = investor.institute?.cumulativeNet ?? 0
  const max = Math.max(Math.abs(fA), Math.abs(iA), 1)
  const box = stockCardTokens.dataBox.wrap

  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { name: '외국인', amount: fA, days: investor.foreign?.buyDays },
        { name: '기관', amount: iA, days: investor.institute?.buyDays },
      ].map((d) => (
        <div key={d.name} className={box}>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-secondary">
            {d.name}
          </div>
          <div className={`mb-1 text-[16px] font-bold tabular-nums ${changeToneClass(d.amount)}`}>
            {formatKRW(d.amount, { showPlus: d.amount > 0 })}
          </div>
          <div className="h-1 overflow-hidden rounded-full border border-default bg-card">
            <div
              className={`h-full rounded-full ${d.amount > 0 ? 'bg-red-600' : 'bg-blue-600'}`}
              style={{ width: `${Math.min((Math.abs(d.amount) / max) * 100, 100)}%` }}
            />
          </div>
          <div className="mt-1.5 text-[10px] text-secondary">
            {d.days ?? 0}일 매수 / 5일 누적
          </div>
        </div>
      ))}
    </div>
  )
}
