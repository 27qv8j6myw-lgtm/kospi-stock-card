import type { MetricRiskStrip } from '../types/stock'

export type MetricRiskVisual = {
  riskStrip: MetricRiskStrip
  riskBadge?: string
  showRiskInfoIcon?: boolean
}

export function asMetricRiskStrip(s: unknown): MetricRiskStrip | null {
  if (s === 'neutral' || s === 'info' || s === 'warning' || s === 'orange' || s === 'danger') return s
  return null
}

const NEUTRAL: MetricRiskVisual = { riskStrip: 'neutral' }

/** `7.3 ATR` 등에서 배수 추출. 없으면 null (기본값으로 위험 오판 방지) */
export function parseAtrDistanceValue(atrGap: string | undefined): number | null {
  if (!atrGap?.trim() || atrGap.includes('없음') || atrGap.includes('N/A')) return null
  const n = Number(String(atrGap).replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

/** ATR 이격(배수) — 룰북 추격매수 금지 3.5 ATR 기준 */
export function resolveAtrDistanceRiskVisual(atr: number | null): MetricRiskVisual {
  if (atr == null || !Number.isFinite(atr)) return NEUTRAL
  if (atr <= 1.5) return NEUTRAL
  if (atr < 3.5) return { riskStrip: 'info', showRiskInfoIcon: true }
  if (atr < 5) return { riskStrip: 'warning', riskBadge: '추격매수 금지선 초과' }
  if (atr < 7) return { riskStrip: 'orange', riskBadge: '임계값 1.5배 초과' }
  return { riskStrip: 'danger', riskBadge: '임계값 2배 초과 · 익절 우선' }
}

export function parseRsiMfiFromIndicator(s: string | undefined): {
  rsi: number | null
  mfi: number | null
} {
  if (!s?.trim()) return { rsi: null, mfi: null }
  const rsiM = s.match(/RSI\s+([\d.]+|N\/A)/i)
  const mfiM = s.match(/MFI\s+([\d.]+|N\/A)/i)
  const rsiRaw = rsiM?.[1]
  const mfiRaw = mfiM?.[1]
  const rsi =
    rsiRaw && rsiRaw.toUpperCase() !== 'N/A' && Number.isFinite(Number(rsiRaw))
      ? Number(rsiRaw)
      : null
  const mfi =
    mfiRaw && mfiRaw.toUpperCase() !== 'N/A' && Number.isFinite(Number(mfiRaw))
      ? Number(mfiRaw)
      : null
  return { rsi, mfi }
}

function rsiSeverity(rsi: number | null): number {
  if (rsi == null || !Number.isFinite(rsi)) return 0
  if (rsi >= 90) return 4
  if (rsi >= 80) return 3
  if (rsi >= 70) return 2
  return 0
}

/** MFI: 80~90 위험, 90+ 극단 (상단만) */
function mfiSeverity(mfi: number | null): number {
  if (mfi == null || !Number.isFinite(mfi)) return 0
  if (mfi >= 90) return 4
  if (mfi >= 80) return 3
  return 0
}

export function resolveIndicatorRiskVisual(indicatorLine: string | undefined): MetricRiskVisual {
  const { rsi, mfi } = parseRsiMfiFromIndicator(indicatorLine)
  const sev = Math.max(rsiSeverity(rsi), mfiSeverity(mfi))
  if (sev >= 4) {
    const parts: string[] = []
    if (rsi != null && rsi >= 90) parts.push(`RSI ${rsi.toFixed(0)}`)
    if (mfi != null && mfi >= 90) parts.push(`MFI ${mfi.toFixed(0)}`)
    return {
      riskStrip: 'danger',
      riskBadge: parts.length ? `${parts.join(' · ')} 극단` : '과매수 극단',
    }
  }
  if (sev === 3) {
    const parts: string[] = []
    if (rsi != null && rsi >= 80 && rsi < 90) parts.push(`RSI ${rsi.toFixed(0)}`)
    if (mfi != null && mfi >= 80 && mfi < 90) parts.push(`MFI ${mfi.toFixed(0)}`)
    return {
      riskStrip: 'orange',
      riskBadge: parts.length ? `${parts.join(' · ')} 위험` : '과매수 위험',
    }
  }
  if (sev === 2) {
    return {
      riskStrip: 'warning',
      riskBadge: rsi != null && rsi >= 70 && rsi < 80 ? '과매수 진입' : undefined,
    }
  }
  if (rsi != null && rsi <= 30) {
    return { riskStrip: 'info', showRiskInfoIcon: true, riskBadge: '과매도' }
  }
  return NEUTRAL
}

/** `20일 평균 … 대비 +12.34%` 형식에서 % 추출 */
export function parseTwentyDayTrendPct(stats: string | undefined): number | null {
  const m = stats?.match(/대비\s*([+-]?[\d.]+)\s*%/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

export function resolveStatsRiskVisual(
  statsLine: string | undefined,
  trend20PctOverride?: number | null,
): MetricRiskVisual {
  const pct =
    trend20PctOverride != null && Number.isFinite(trend20PctOverride)
      ? trend20PctOverride
      : parseTwentyDayTrendPct(statsLine)
  if (pct == null || !Number.isFinite(pct)) return NEUTRAL
  if (pct > 40) return { riskStrip: 'danger', riskBadge: '이격 극단' }
  if (pct > 25) return { riskStrip: 'orange', riskBadge: '단기 과열' }
  return NEUTRAL
}
