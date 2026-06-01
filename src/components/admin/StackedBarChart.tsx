'use client'

import { useEffect, useState } from 'react'

export type StackedBarDay = {
  day: string
  total: number
  [key: string]: number | string
}

export type StackedBarSeries = {
  key: string
  color: string
  label: string
  roundedTop?: boolean
  roundedBottom?: boolean
}

type StackedBarChartProps = {
  title: string
  subtitle?: string
  days: StackedBarDay[]
  series: StackedBarSeries[]
  formatTooltip: (day: StackedBarDay) => string
  desktopCount?: number
  mobileCount?: number
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

export function StackedBarChart({
  title,
  subtitle,
  days,
  series,
  formatTooltip,
  desktopCount = 14,
  mobileCount = 7,
}: StackedBarChartProps) {
  const isMobile = useIsMobile()
  const displayDays = isMobile ? days.slice(-mobileCount) : days.slice(-desktopCount)
  const maxVal = Math.max(...displayDays.map((d) => Number(d.total) || 0), 0.01)
  const dayLabel = isMobile ? `${mobileCount}일` : `${desktopCount}일`

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div>
          <div className="text-[13px] font-bold text-gray-900">
            {title} ({dayLabel})
          </div>
          {subtitle ? <div className="text-[10px] text-gray-400">{subtitle}</div> : null}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-[10px] text-gray-600">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-sm ${s.color}`} />
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex h-28 items-end gap-1">
        {displayDays.map((d) => (
          <div
            key={d.day}
            className="group relative flex h-full flex-1 flex-col items-center gap-1"
          >
            <div className="flex h-full w-full flex-col justify-end">
              {series.map((s) => {
                const val = Number(d[s.key]) || 0
                if (val <= 0) return null
                const rounded =
                  s.roundedTop && s.roundedBottom
                    ? 'rounded'
                    : s.roundedTop
                      ? 'rounded-t'
                      : s.roundedBottom
                        ? 'rounded-b'
                        : ''
                return (
                  <div
                    key={s.key}
                    className={`w-full ${s.color} ${rounded}`}
                    style={{ height: `${(val / maxVal) * 100}%` }}
                  />
                )
              })}
            </div>
            <span className="text-[8px] text-gray-400">{d.day.slice(8)}</span>
            <div className="absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded bg-gray-900 px-1.5 py-1 text-[9px] text-white group-hover:block">
              {formatTooltip(d)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
