'use client'

import { GripVertical } from 'lucide-react'
import type { HoldingDnDRow } from './HoldingsGroupDroppable'

type Props = {
  holding: HoldingDnDRow | undefined
}

export function DragHoldingPreview({ holding: h }: Props) {
  if (!h) return null

  return (
    <div className="flex items-center gap-3 rounded-lg border border-blue-300 bg-white px-5 py-3 shadow-lg">
      <GripVertical size={16} className="text-gray-400" strokeWidth={1.8} />
      <div className="flex-1">
        <div className="text-[14px] font-bold text-gray-900">{h.name}</div>
        <div className="text-[11px] tabular-nums text-gray-500">
          {Number(h.quantity).toLocaleString('ko-KR')}주
        </div>
      </div>
      <div
        className={`text-[14px] font-bold tabular-nums ${
          h.profitPct >= 0 ? 'text-red-600' : 'text-blue-600'
        }`}
      >
        {h.profitPct >= 0 ? '+' : ''}
        {h.profitPct.toFixed(1)}%
      </div>
    </div>
  )
}
