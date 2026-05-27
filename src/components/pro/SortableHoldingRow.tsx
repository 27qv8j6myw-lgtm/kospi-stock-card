'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2 } from 'lucide-react'
import type { HoldingDnDRow } from './HoldingsGroupDroppable'

type Props = {
  holding: HoldingDnDRow
  formatKRW: (n: number) => string
  changeClass: (n: number) => string
  onNavigate: (path: string) => void
  onDelete: () => void
}

export function SortableHoldingRow({
  holding: h,
  formatKRW,
  changeClass,
  onNavigate,
  onDelete,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: h.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5 last:border-b-0 hover:bg-gray-50"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex-shrink-0 touch-none cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing"
        aria-label={`${h.name} 드래그`}
      >
        <GripVertical size={14} strokeWidth={1.8} />
      </button>

      <button
        type="button"
        onClick={() => onNavigate(`/pro/holdings/${h.id}`)}
        className="min-w-0 flex-1 text-left"
      >
        <div className="truncate text-[13px] font-bold text-gray-900">{h.name}</div>
        <div className="truncate text-[10px] tabular-nums text-gray-400">
          {Number(h.quantity).toLocaleString('ko-KR')}주 ·{' '}
          {Number(h.avg_price).toLocaleString('ko-KR')}
          {h.weight != null && h.weight > 0 ? ` · ${h.weight.toFixed(0)}%` : ''}
        </div>
      </button>

      <div className="flex-shrink-0 text-right">
        <div
          className={`text-[13px] font-bold tabular-nums whitespace-nowrap ${changeClass(h.profitPct)}`}
        >
          {h.profitPct >= 0 ? '+' : ''}
          {h.profitPct.toFixed(1)}%
        </div>
        <div
          className={`text-[10px] tabular-nums whitespace-nowrap ${changeClass(h.profit)}`}
        >
          {h.profit >= 0 ? '+' : ''}
          {formatKRW(h.profit)}
        </div>
      </div>

      <button
        type="button"
        onClick={onDelete}
        className="flex-shrink-0 rounded p-0.5 text-gray-300 hover:text-red-500"
        aria-label={`${h.name} 삭제`}
      >
        <Trash2 size={12} strokeWidth={1.8} />
      </button>
    </div>
  )
}
