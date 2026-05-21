import { useEffect, useMemo, useState } from 'react'

export type ChartIndexPeriod = '당일' | '1W' | '1M' | '3M' | '1Y'

export type ChartIndexPoint = { date?: string; time?: string }

export type ChartIndexLabelsProps = {
  period: ChartIndexPeriod
  chartData?: ChartIndexPoint[]
}

function useIsNarrow() {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const fn = () => setNarrow(mq.matches)
    fn()
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return narrow
}

function formatMMDD(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}/${dd}`
}

function formatMMYY(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(2)
  return `${mm}/${yy}`
}

function formatDateLabel(dateStr: string, period: ChartIndexPeriod): string {
  const s = String(dateStr).replace(/\D/g, '')
  if (s.length >= 8) {
    if (period === '1Y') return `${s.slice(4, 6)}/${s.slice(2, 4)}`
    return `${s.slice(4, 6)}/${s.slice(6, 8)}`
  }
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-')
    if (parts.length >= 3) {
      if (period === '1Y') return `${parts[1]}/${parts[0].slice(2)}`
      return `${parts[1]}/${parts[2]}`
    }
  }
  return dateStr
}

function generateLabels(period: ChartIndexPeriod, narrow: boolean): string[] {
  const today = new Date()

  if (period === '당일') {
    return narrow ? ['09:00', '12:00', '15:30'] : ['09:00', '11:00', '13:00', '15:30']
  }

  const count = period === '3M' ? (narrow ? 3 : 4) : narrow ? 3 : 5

  switch (period) {
    case '1W': {
      const labels: string[] = []
      for (let i = count - 1; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const dayOfWeek = d.getDay()
        if (dayOfWeek === 0) d.setDate(d.getDate() - 2)
        if (dayOfWeek === 6) d.setDate(d.getDate() - 1)
        labels.push(formatMMDD(d))
      }
      return [...new Set(labels)].slice(0, count)
    }
    case '1M': {
      const labels: string[] = []
      const step = Math.max(1, Math.floor(28 / (count - 1)))
      for (let i = count - 1; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(d.getDate() - i * step)
        labels.push(formatMMDD(d))
      }
      return labels
    }
    case '3M': {
      const labels: string[] = []
      for (let i = count - 1; i >= 0; i--) {
        const d = new Date(today)
        d.setMonth(d.getMonth() - i)
        labels.push(formatMMDD(d))
      }
      return labels
    }
    case '1Y': {
      const labels: string[] = []
      for (let i = count - 1; i >= 0; i--) {
        const d = new Date(today)
        d.setMonth(d.getMonth() - i * 3)
        labels.push(formatMMYY(d))
      }
      return labels
    }
    default:
      return []
  }
}

function generateLabelsFromData(
  period: ChartIndexPeriod,
  data: ChartIndexPoint[],
  count: number,
): string[] {
  if (!data.length) return []

  const labels: string[] = []
  for (let i = 0; i < count; i++) {
    const idx =
      count === 1 ? 0 : Math.min(Math.round((i / (count - 1)) * (data.length - 1)), data.length - 1)
    const row = data[idx]
    const raw = row.time || row.date
    if (!raw) continue
    if (row.time && period === '당일') {
      labels.push(raw)
    } else if (row.date) {
      labels.push(formatDateLabel(row.date, period))
    } else {
      labels.push(raw)
    }
  }
  return labels
}

function resolveLabels(
  period: ChartIndexPeriod,
  chartData: ChartIndexPoint[] | undefined,
  narrow: boolean,
): string[] {
  if (period === '당일') {
    return generateLabels('당일', narrow)
  }

  const count = period === '3M' ? (narrow ? 3 : 4) : narrow ? 3 : 5

  if (chartData && chartData.length > 0) {
    const fromData = generateLabelsFromData(period, chartData, count)
    if (fromData.length > 0) return fromData
  }

  return generateLabels(period, narrow)
}

function chartDataKey(points: ChartIndexPoint[] | undefined): string {
  if (!points?.length) return ''
  const first = points[0]
  const last = points[points.length - 1]
  return `${points.length}:${first?.date ?? first?.time ?? ''}:${last?.date ?? last?.time ?? ''}`
}

export function ChartIndexLabels({ period, chartData }: ChartIndexLabelsProps) {
  const narrow = useIsNarrow()
  const dataKey = chartDataKey(chartData)
  const labels = useMemo(
    () => resolveLabels(period, chartData, narrow),
    [period, dataKey, narrow],
  )

  if (!labels.length) return null

  return (
    <div className="mt-1.5 flex justify-between border-t border-gray-100 pt-1.5 text-[10px] tabular-nums text-gray-500">
      {labels.map((label, i) => (
        <span key={`${label}-${i}`}>{label}</span>
      ))}
    </div>
  )
}
