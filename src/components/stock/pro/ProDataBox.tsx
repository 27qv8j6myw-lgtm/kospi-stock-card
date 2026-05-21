import { proDesign } from '@/lib/proStockDesign'

type Props = {
  label: string
  value: string
  valueClassName?: string
}

export function ProDataBox({ label, value, valueClassName }: Props) {
  return (
    <div className={`${proDesign.whiteBox} py-2.5`}>
      <div className="mb-1 text-[11px] font-semibold text-gray-500">{label}</div>
      <div className={`text-[14px] font-bold tabular-nums text-gray-900 ${valueClassName ?? ''}`}>
        {value}
      </div>
    </div>
  )
}
