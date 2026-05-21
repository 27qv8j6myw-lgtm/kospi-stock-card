import type { ReactNode } from 'react'
import { Info } from 'lucide-react'

export type ProIndicatorCardProps = {
  icon?: ReactNode
  label: string
  value: string
  desc?: string
  status?: string
  statusColor?: 'red' | 'blue' | 'amber'
  valueColor?: 'red' | 'blue' | 'default'
  info?: string
}

const statusColorClass: Record<string, string> = {
  red: 'text-red-600',
  blue: 'text-blue-600',
  amber: 'text-amber-600',
}

const valueColorClass: Record<string, string> = {
  red: 'text-red-600',
  blue: 'text-blue-600',
  default: 'text-gray-900',
}

export function ProIndicatorCard({
  icon,
  label,
  value,
  desc,
  status,
  statusColor = 'red',
  valueColor = 'default',
  info,
}: ProIndicatorCardProps) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-2.5 sm:p-3">
      <div className="mb-2 flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1">
          {icon}
          <span className="truncate text-[10px] text-gray-500 sm:text-[11px]">{label}</span>
        </div>
        {status ? (
          <span
            className={`shrink-0 text-[9px] font-semibold sm:text-[10px] ${statusColorClass[statusColor] ?? 'text-gray-500'}`}
          >
            {status}
          </span>
        ) : info ? (
          <span className="shrink-0" title={info}>
            <Info size={10} className="text-gray-300" aria-hidden />
          </span>
        ) : null}
      </div>
      <div
        className={`text-[15px] font-bold leading-tight tabular-nums sm:text-[16px] ${valueColorClass[valueColor] ?? valueColorClass.default}`}
      >
        {value}
      </div>
      {desc ? <div className="mt-1 text-[9px] text-gray-400 sm:text-[10px]">{desc}</div> : null}
    </div>
  )
}
