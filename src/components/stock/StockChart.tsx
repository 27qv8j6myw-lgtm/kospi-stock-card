import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'

export type ChartPeriod = '1W' | '1M' | '3M' | '1Y'

type ChartRow = { date: string; close: number }

function chartDataSignature(rows: ChartRow[]): string {
  if (!rows.length) return 'empty'
  return `${rows.length}:${rows[0]?.date}:${rows[rows.length - 1]?.date}`
}

/** API 일봉 → 차트 좌→우 (과거 → 현재) */
function formatChartRows(raw: Array<Record<string, unknown>>): ChartRow[] {
  return raw
    .map((c) => ({
      date: String(c.date ?? c.stck_bsop_date ?? ''),
      close: parseInt(String(c.close ?? c.stck_clpr ?? 0), 10),
    }))
    .filter((c) => c.close > 0 && c.date)
    .sort((a, b) => a.date.localeCompare(b.date))
}

type Props = {
  code: string
  variant?: 'default' | 'pro'
  /** pro 레이아웃: 부모에서 탭·기간 제어 */
  period?: ChartPeriod
  /** Pro: 외부 ChartIndexLabels용 */
  onDataChange?: (data: ChartRow[]) => void
}

export function StockChart({ code, variant = 'default', period: periodProp, onDataChange }: Props) {
  const isBare = variant === 'pro'
  const [internalPeriod, setInternalPeriod] = useState<ChartPeriod>('1M')
  const period = periodProp ?? internalPeriod
  const [data, setData] = useState<ChartRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    void authFetch(apiUrl(`/api/pro-stock-chart?code=${code}&period=${period}`))
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d: { data?: Array<Record<string, unknown>> }) => {
        if (cancelled) return
        setData(formatChartRows(d.data || []))
      })
      .catch(() => {
        if (!cancelled) setData([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [code, period])

  const dataSig = useMemo(() => chartDataSignature(data), [data])

  useEffect(() => {
    if (!onDataChange) return
    onDataChange(data)
  }, [dataSig, onDataChange])

  const firstPrice = data[0]?.close ?? 0
  const lastPrice = data[data.length - 1]?.close ?? 0

  const chartTooltip = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function ChartTooltipContent(props: any) {
        const { active, payload } = props
        if (!active || !payload?.[0] || !lastPrice) return null

        const close = Number(payload[0].value) || 0
        const date = payload[0].payload?.date ?? ''
        const changePct = lastPrice ? (((close - lastPrice) / lastPrice) * 100).toFixed(2) : '0.00'
        const isUp = close > lastPrice
        const periodPct = firstPrice
          ? (((close - firstPrice) / firstPrice) * 100).toFixed(2)
          : '0.00'

        return (
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] shadow-lg">
            <div className="mb-1 text-gray-500">{date}</div>
            <div className="mb-1 font-bold tabular-nums text-gray-900">{close.toLocaleString()}원</div>
            <div
              className={`text-[10px] font-semibold ${isUp ? 'text-red-600' : 'text-blue-600'}`}
            >
              현재 대비 {isUp ? '+' : ''}
              {changePct}%
            </div>
            <div
              className={`text-[10px] ${Number(periodPct) > 0 ? 'text-red-600' : 'text-blue-600'}`}
            >
              기간 시작 대비 {Number(periodPct) > 0 ? '+' : ''}
              {periodPct}%
            </div>
          </div>
        )
      },
    [firstPrice, lastPrice],
  )

  const chartBody = (() => {
    if (loading) {
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
        </div>
      )
    }

    if (!data.length) {
      return (
        <div className="flex h-full w-full items-center justify-center text-[12px] text-gray-400">
          차트 데이터 없음
        </div>
      )
    }

    const isUp = lastPrice >= firstPrice
    const color = isBare ? '#378ADD' : isUp ? '#DC2626' : '#2563EB'
    const gradId = `chartGrad-${code}-${variant}-${period}`

    return (
      <div className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <YAxis domain={['dataMin * 0.98', 'dataMax * 1.02']} hide />
            <Tooltip content={chartTooltip} />
            <Area
              type="monotone"
              dataKey="close"
              stroke={color}
              fill={`url(#${gradId})`}
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  })()

  if (isBare) {
    return <div className="h-full w-full">{chartBody}</div>
  }

  return (
    <div>
      <div className="mb-3 flex gap-1">
        {(['1W', '1M', '3M', '1Y'] as ChartPeriod[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setInternalPeriod(p)}
            className={`rounded-md px-3 py-1 text-[11px] font-semibold transition-colors ${
              period === p
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="h-40 rounded-lg bg-gray-50 p-2">{chartBody}</div>
    </div>
  )
}
