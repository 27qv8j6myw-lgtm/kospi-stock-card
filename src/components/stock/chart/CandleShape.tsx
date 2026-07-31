import { CHART_DOWN, CHART_FLAT, CHART_UP } from '@/lib/chartFormat'

export type CandleDatum = {
  open: number
  close: number
  high: number
  low: number
}

type ShapeProps = {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: Partial<CandleDatum>
}

/**
 * recharts `Bar` 커스텀 shape — dataKey 가 [low, high] 를 돌려주면
 * y~y+height 가 저가~고가 구간이 되므로, 그 안에서 시가·종가 위치를 비례로 찍는다.
 */
export function CandleShape(props: ShapeProps) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props
  const open = Number(payload?.open)
  const close = Number(payload?.close)
  const high = Number(payload?.high)
  const low = Number(payload?.low)
  if (![open, close, high, low].every((v) => Number.isFinite(v) && v > 0)) return null
  if (width <= 0 || height < 0) return null

  const range = high - low
  const yFor = (v: number) => (range > 0 ? y + ((high - v) / range) * height : y)

  const color = close > open ? CHART_UP : close < open ? CHART_DOWN : CHART_FLAT
  const bodyTop = yFor(Math.max(open, close))
  const bodyHeight = Math.max(1, yFor(Math.min(open, close)) - bodyTop)
  const center = x + width / 2
  const bodyWidth = Math.max(1, Math.min(width * 0.66, 9))

  return (
    <g>
      <line
        x1={center}
        x2={center}
        y1={y}
        y2={y + height}
        stroke={color}
        strokeWidth={1}
        shapeRendering="crispEdges"
      />
      <rect
        x={center - bodyWidth / 2}
        y={bodyTop}
        width={bodyWidth}
        height={bodyHeight}
        fill={color}
        shapeRendering="crispEdges"
      />
    </g>
  )
}
