/**
 * 당일 차트 x축 — 09:00 기준 경과 분.
 * NXT 프리마켓은 음수(08:00 = -60), 애프터마켓은 390(15:30) 초과 값이 된다.
 */
export const REGULAR_SESSION_MAX = 390

const WIDE_TICKS = [-60, 0, 120, 240, 390, 510, 660]
const NARROW_TICKS = [-60, 0, 210, 390, 540]
/** 축 끝 눈금과 겹치는 라벨은 버린다 (분) */
const TICK_MIN_GAP = 25

export function offsetMinutesToClock(offset: number): string {
  const total = 9 * 60 + Math.round(offset)
  const hh = Math.floor(total / 60)
  const mm = ((total % 60) + 60) % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function intradayXDomain(
  chart?: { xMin?: number | null; xMax?: number | null } | null,
): [number, number] {
  const min = typeof chart?.xMin === 'number' && Number.isFinite(chart.xMin) ? chart.xMin : 0
  const max =
    typeof chart?.xMax === 'number' && Number.isFinite(chart.xMax) && chart.xMax > min
      ? chart.xMax
      : REGULAR_SESSION_MAX
  return [Math.min(min, 0), Math.max(max, REGULAR_SESSION_MAX)]
}

export function intradayXTicks([min, max]: [number, number], narrow = false): number[] {
  const candidates = narrow ? NARROW_TICKS : WIDE_TICKS
  const inner = candidates.filter(
    (t) => t - min > TICK_MIN_GAP && max - t > TICK_MIN_GAP && t > min && t < max,
  )
  return [min, ...inner, max]
}
