/** 차트 공통 색·축 표기 */

export const CHART_UP = '#DC2626'
export const CHART_DOWN = '#2563EB'
export const CHART_FLAT = '#9CA3AF'
export const CHART_GRID = '#F1F2F4'
export const CHART_AXIS_TEXT = '#9CA3AF'
export const CHART_MA5 = '#F59E0B'
export const CHART_MA20 = '#7C3AED'

/** 등락 방향 색 (기준값 대비) */
export function trendColor(value: number | null | undefined, base: number | null | undefined) {
  if (value == null || base == null || !Number.isFinite(value) || !Number.isFinite(base)) {
    return CHART_FLAT
  }
  if (value > base) return CHART_UP
  if (value < base) return CHART_DOWN
  return CHART_FLAT
}

export function formatPriceAxis(v: number): string {
  if (!Number.isFinite(v)) return ''
  return Math.round(v).toLocaleString('ko-KR')
}

/** 거래량 축·툴팁 — 1.2억 / 3,450만 / 8,200 */
export function formatVolumeAxis(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return '0'
  const abs = Math.abs(v)
  if (abs >= 1e8) return `${(v / 1e8).toFixed(1)}억`
  if (abs >= 1e4) return `${Math.round(v / 1e4).toLocaleString('ko-KR')}만`
  return Math.round(v).toLocaleString('ko-KR')
}

/** 값 범위에 여유를 준 y축 도메인 */
export function priceDomain(
  values: Array<number | null | undefined>,
  fallback = 50_000,
  padRatio = 0.008,
): [number, number] {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v) && v > 0)
  if (!nums.length) return [fallback * 0.99, fallback * 1.01]
  const lo = Math.min(...nums)
  const hi = Math.max(...nums)
  if (hi === lo) return [lo * (1 - padRatio), hi * (1 + padRatio)]
  const pad = (hi - lo) * padRatio + (hi - lo) * 0.06
  return [lo - pad, hi + pad]
}

/** 도메인 안에서 1·2·2.5·5 배수로 떨어지는 눈금 — 개수가 목표에 가장 가까운 간격을 고른다 */
export function niceTicks([min, max]: [number, number], count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return []
  const span = max - min
  const mag = 10 ** Math.floor(Math.log10(span / Math.max(1, count)))
  const candidates = [1, 2, 2.5, 5, 10, 20].map((m) => m * mag).filter((s) => s > 0)

  let best: number[] = []
  let bestGap = Infinity
  for (const step of candidates) {
    const ticks: number[] = []
    for (let t = Math.ceil(min / step) * step; t <= max; t += step) ticks.push(Math.round(t))
    if (ticks.length < 2) continue
    const gap = Math.abs(ticks.length - count)
    if (gap < bestGap) {
      bestGap = gap
      best = ticks
    }
  }
  return best
}

/** 축 라벨이 차트 좌우 끝에서 잘리지 않게 위치를 고른다 */
export function edgeAwarePosition(
  ratio: number,
  fallback: 'top' | 'bottom',
): 'top' | 'bottom' | 'left' | 'right' {
  if (ratio <= 0.12) return 'right'
  if (ratio >= 0.88) return 'left'
  return fallback
}

/**
 * 이동평균처럼 가격 범위를 크게 벗어날 수 있는 값은 일부만 반영한다.
 * @param base 봉 기준 도메인
 * @param extras 추가로 담고 싶은 값
 * @param maxExtend 봉 범위 대비 최대 확장 비율
 */
export function extendDomain(
  base: [number, number],
  extras: Array<number | null | undefined>,
  maxExtend = 0.12,
): [number, number] {
  const nums = extras.filter((v): v is number => v != null && Number.isFinite(v) && v > 0)
  if (!nums.length) return base
  const span = base[1] - base[0]
  const limit = span * maxExtend
  const lo = Math.max(base[0] - limit, Math.min(base[0], ...nums))
  const hi = Math.min(base[1] + limit, Math.max(base[1], ...nums))
  return [lo, hi]
}
