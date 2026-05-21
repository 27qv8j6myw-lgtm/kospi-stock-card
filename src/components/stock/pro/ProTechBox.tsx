import { useState } from 'react'
import { Info } from 'lucide-react'
import { proDesign } from '@/lib/proStockDesign'

type Props = {
  label: string
  value: string
  status: string
  statusColor?: string
  desc: string
}

export function ProTechBox({ label, value, status, statusColor = 'text-gray-600', desc }: Props) {
  const [showDesc, setShowDesc] = useState(false)

  return (
    <div className="relative">
      <div
        className={`${proDesign.whiteBox} cursor-help py-2.5 text-center`}
        onMouseEnter={() => setShowDesc(true)}
        onMouseLeave={() => setShowDesc(false)}
        onClick={() => setShowDesc((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setShowDesc((v) => !v)
        }}
      >
        <div className="mb-1 flex items-center justify-center gap-1">
          <span className="text-[10px] font-semibold text-gray-500">{label}</span>
          <Info size={9} className="text-gray-400" strokeWidth={2} />
        </div>
        <div className="text-[13px] font-bold tabular-nums text-gray-900">{value}</div>
        <div className={`mt-0.5 text-[10px] font-semibold ${statusColor}`}>{status}</div>
      </div>

      {showDesc ? (
        <div className="absolute top-full left-1/2 z-20 mt-1 w-44 -translate-x-1/2 rounded-lg bg-gray-900 p-2 text-left text-[10px] leading-relaxed text-white shadow-lg">
          {desc}
          <div className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rotate-45 bg-gray-900" />
        </div>
      ) : null}
    </div>
  )
}
