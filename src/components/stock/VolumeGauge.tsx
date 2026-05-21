export type VolumeGaugeProps = {
  label: string
  currentVolume: number
  avgVolume: number
  tradingAmount: number
}

function formatAmount(amt: number): string {
  if (!Number.isFinite(amt) || amt <= 0) return '—'
  if (amt >= 1e12) return `${(amt / 1e12).toFixed(1)}조`
  if (amt >= 1e8) return `${(amt / 1e8).toFixed(0)}억`
  return amt.toLocaleString()
}

function formatVolume(vol: number): string {
  if (!Number.isFinite(vol) || vol <= 0) return '—'
  if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)}M주`
  if (vol >= 1e3) return `${(vol / 1e3).toFixed(0)}K주`
  return `${vol}주`
}

export function VolumeGauge({
  label,
  currentVolume,
  avgVolume,
  tradingAmount,
}: VolumeGaugeProps) {
  const ratio = avgVolume > 0 ? currentVolume / avgVolume : 1
  const changePct = (ratio - 1) * 100
  const position = Math.min((ratio / 2) * 100, 100)
  const avgPosition = 50

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-semibold text-gray-500">{label}</span>
        <span
          className={`text-[11px] font-bold tabular-nums ${
            changePct > 0 ? 'text-red-600' : 'text-blue-600'
          }`}
        >
          {avgVolume > 0 ? `${changePct > 0 ? '+' : ''}${changePct.toFixed(0)}% 평균 대비` : '—'}
        </span>
      </div>

      <div className="relative mb-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className="absolute bottom-0 left-0 top-0 bg-gradient-to-r from-blue-200 to-red-200"
          style={{ width: `${position}%` }}
        />
        <div
          className="absolute bottom-0 top-0 z-10 w-px bg-gray-400"
          style={{ left: `${avgPosition}%` }}
        />
        <div
          className="absolute -top-1 z-20 h-3.5 w-[3px] rounded-sm bg-gray-900"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        />
      </div>

      <div className="flex justify-between text-[9px] tabular-nums text-gray-500">
        <span>
          {formatVolume(currentVolume)} · {formatAmount(tradingAmount)}
        </span>
        <span>20일 평균</span>
      </div>
    </div>
  )
}
