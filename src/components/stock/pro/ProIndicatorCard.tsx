'use client'

import { useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { InfoModal } from '@/components/ui/InfoModal'

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
  const [showInfo, setShowInfo] = useState(false)

  return (
    <>
      <div className="rounded-md border border-gray-200 bg-white p-3 md:p-4">
        <div className="mb-2 flex items-center justify-between gap-1">
          <div className="flex min-w-0 items-center gap-1.5">
            {icon}
            <span className="truncate text-[11px] font-semibold text-gray-500">{label}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {status ? (
              <span
                className={`text-[10px] font-bold ${statusColorClass[statusColor] ?? 'text-gray-500'}`}
              >
                {status}
              </span>
            ) : null}
            {info ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowInfo(true)
                }}
                className="rounded p-0.5 hover:bg-gray-100"
                aria-label={`${label} 설명`}
              >
                <Info size={11} className="text-gray-300" strokeWidth={2} />
              </button>
            ) : null}
          </div>
        </div>
        <div
          className={`text-[15px] font-bold leading-tight tabular-nums md:text-[17px] ${valueColorClass[valueColor] ?? valueColorClass.default}`}
        >
          {value}
        </div>
        {desc ? <div className="mt-1 text-[9px] text-gray-400 sm:text-[10px]">{desc}</div> : null}
      </div>

      {showInfo && info ? (
        <InfoModal title={label} content={info} onClose={() => setShowInfo(false)} />
      ) : null}
    </>
  )
}
