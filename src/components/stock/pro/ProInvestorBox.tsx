import { formatKRW } from '@/lib/format'
import { investorDaysLabel } from '@/lib/proStockDesign'
import { proDesign } from '@/lib/proStockDesign'

type Props = {
  label: string
  amount: number
  buyDays?: number
  totalDays?: number
}

export function ProInvestorBox({ label, amount, buyDays = 0, totalDays = 5 }: Props) {
  const colorClass = amount > 0 ? 'text-red-600' : amount < 0 ? 'text-blue-600' : 'text-gray-700'

  return (
    <div className={`${proDesign.whiteBox} py-2`}>
      <div className="mb-1 text-[10px] font-bold text-gray-500">{label}</div>
      <div className={`text-[14px] font-bold tabular-nums ${colorClass}`}>
        {formatKRW(amount, { showPlus: amount > 0 })}
      </div>
      <div className="mt-1 text-[10px] text-gray-500">
        {investorDaysLabel(amount, buyDays, totalDays)}
      </div>
    </div>
  )
}
