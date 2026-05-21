export type PriceGaugeColor = 'default' | 'red' | 'blue'

export type PriceGaugeProps = {
  label: string
  current: number
  currentLabel: string
  min: number
  max: number
  minLabel: string
  maxLabel: string
  currentColor?: PriceGaugeColor
}

export function PriceGauge({
  label,
  current,
  currentLabel,
  min,
  max,
  minLabel,
  maxLabel,
  currentColor = 'default',
}: PriceGaugeProps) {
  const range = max - min
  const position =
    range > 0 ? Math.min(Math.max(((current - min) / range) * 100, 0), 100) : 50

  const colorClass = {
    default: 'text-gray-900',
    red: 'text-red-600',
    blue: 'text-blue-600',
  }[currentColor]

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-semibold text-gray-500">{label}</span>
        <span className={`text-[11px] font-bold tabular-nums ${colorClass}`}>{currentLabel}</span>
      </div>

      <div className="relative mb-1 h-1.5 rounded-full bg-gradient-to-r from-blue-200 via-gray-200 to-red-200">
        <div
          className="absolute -top-1 h-3.5 w-[3px] rounded-sm bg-gray-900"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        />
      </div>

      <div className="flex justify-between text-[9px] tabular-nums text-gray-500">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  )
}
