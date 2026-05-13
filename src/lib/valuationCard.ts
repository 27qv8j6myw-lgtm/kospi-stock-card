import type { MetricRiskStrip } from '../types/stock'

/** 업종별 Trailing PER·PBR 대표값(실제 5년 시계열 API 부재 시 벤치마크로 사용) */
const SECTOR_VALUATION_BENCH: { test: RegExp; per5yAvg: number; pbr5yAvg: number }[] = [
  { test: /반도체/, per5yAvg: 13.2, pbr5yAvg: 1.85 },
  { test: /전기|전자|디스플레이/, per5yAvg: 14.5, pbr5yAvg: 1.35 },
  { test: /금융|은행|증권|보험/, per5yAvg: 8.5, pbr5yAvg: 0.55 },
  { test: /화학|정유|석유/, per5yAvg: 11.0, pbr5yAvg: 1.1 },
  { test: /바이오|제약|의료/, per5yAvg: 22.0, pbr5yAvg: 3.2 },
  { test: /자동차|운송장비/, per5yAvg: 10.5, pbr5yAvg: 0.95 },
  { test: /건설|건축/, per5yAvg: 9.0, pbr5yAvg: 0.75 },
  { test: /유통|소비|식품|음료/, per5yAvg: 16.0, pbr5yAvg: 1.65 },
  { test: /통신|방송/, per5yAvg: 13.0, pbr5yAvg: 1.05 },
  { test: /철강|금속|소재/, per5yAvg: 9.5, pbr5yAvg: 0.85 },
  { test: /기계|장비|조선/, per5yAvg: 12.0, pbr5yAvg: 1.15 },
]

const DEFAULT_BENCH = { per5yAvg: 13.0, pbr5yAvg: 1.2 }

function premiumRiskStrip(premiumPct: number): MetricRiskStrip {
  if (premiumPct > 100) return 'danger'
  if (premiumPct > 50) return 'warning'
  return 'neutral'
}

export function resolveSectorValuationBench(sectorName: string): {
  per5yAvg: number
  pbr5yAvg: number
} {
  const s = sectorName.trim()
  for (const row of SECTOR_VALUATION_BENCH) {
    if (row.test.test(s)) return { per5yAvg: row.per5yAvg, pbr5yAvg: row.pbr5yAvg }
  }
  return { ...DEFAULT_BENCH }
}

/** 컨센서스 목표 상승폭으로 이익 성장을 거칠게 가정해 Forward PER 추정 (EPS·PER 실데이터 없을 때 보조) */
function estimateForwardPER(params: {
  trailingPER: number
  price: number
  eps: number | null
  consensusAvgUpsidePct: number | null
}): number | null {
  const { trailingPER, price, eps, consensusAvgUpsidePct } = params
  if (!(trailingPER > 0) || !(price > 0)) return null

  const g =
    consensusAvgUpsidePct != null && Number.isFinite(consensusAvgUpsidePct)
      ? Math.min(0.45, Math.max(0.03, consensusAvgUpsidePct / 100 / 2.8))
      : 0.12

  if (eps != null && eps > 0) {
    const forwardEps = eps * (1 + g)
    return price / forwardEps
  }

  return trailingPER / (1 + g)
}

function premiumVsBench(current: number, bench: number): number {
  if (!(bench > 0) || !Number.isFinite(current)) return 0
  return ((current - bench) / bench) * 100
}

function formatPerPercentileLine(trailing: number, bench: number): string {
  const ratio = bench > 0 ? trailing / bench : 1
  const prem = premiumVsBench(trailing, bench)
  if (prem > 150 || ratio >= 2.4) return '역사적 고밸류 구간에 근접'
  if (prem > 100 || ratio >= 2.0) return '5Y·섹터 벤치 대비 상위 5~10%대(추정)'
  if (prem > 50 || ratio >= 1.55) return '5Y·섹터 벤치 대비 상위권(추정)'
  if (prem < -25 || ratio <= 0.82) return '5Y·섹터 벤치 대비 하위권(추정)'
  return '5Y·섹터 벤치 대비 중위권(추정)'
}

function formatPbrContextLine(pbr: number, benchPbr: number): string | null {
  if (!(pbr > 0) || !(benchPbr > 0)) return null
  const prem = premiumVsBench(pbr, benchPbr)
  const sign = prem >= 0 ? '+' : ''
  return `PBR ${pbr.toFixed(2)}x · 벤치 ${benchPbr.toFixed(2)}x · 대비 ${sign}${prem.toFixed(0)}%`
}

function formatFetchedAtFooter(fetchedAt: string | null): string {
  if (!fetchedAt) return 'PER·PBR: 한국투자증권 시세 API · TTM(거래소 표시) 기준'
  const d = new Date(fetchedAt)
  if (Number.isNaN(d.getTime())) return 'PER·PBR: 한국투자증권 시세 API · TTM 기준'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `PER·PBR: 한국투자증권 시세 API · TTM(거래소 표시) · 시세 기준일 ${y}-${m}-${day}`
}

export type ValuationCardModel = {
  value: string
  subValue: string
  meta: string
  riskStrip: MetricRiskStrip
  /** calculateValuationScore 입력 */
  valuationInputs: {
    trailingPER: number
    forwardPER: number
    forwardEPSGrowthPct: number
    sectorAveragePER: number
    historicalPERPercentile: number
  }
}

export function buildValuationCardModel(params: {
  trailingPER: number | null
  price: number
  eps: number | null
  pbr: number | null
  sectorName: string
  consensusAvgUpsidePct: number | null
  fetchedAt: string | null
}): ValuationCardModel | null {
  const trailing = params.trailingPER
  if (trailing == null || !Number.isFinite(trailing) || !(trailing > 0)) return null

  const bench = resolveSectorValuationBench(params.sectorName || '')
  const forward = estimateForwardPER({
    trailingPER: trailing,
    price: params.price,
    eps: params.eps,
    consensusAvgUpsidePct: params.consensusAvgUpsidePct,
  })

  const line1 =
    forward != null && Number.isFinite(forward) && forward > 0
      ? `Trailing PER ${trailing.toFixed(1)}x · Forward ${forward.toFixed(1)}x`
      : `Trailing PER ${trailing.toFixed(1)}x`

  const prem = premiumVsBench(trailing, bench.per5yAvg)
  const sign = prem >= 0 ? '+' : ''
  const line2 = `5Y·섹터 벤치 평균 PER ${bench.per5yAvg.toFixed(1)}x · 현재 ${sign}${prem.toFixed(0)}%`
  const line3 = formatPerPercentileLine(trailing, bench.per5yAvg)

  const pbrLine =
    params.pbr != null && Number.isFinite(params.pbr) && params.pbr > 0
      ? formatPbrContextLine(params.pbr, bench.pbr5yAvg)
      : null
  const subValue = [line2, line3, pbrLine].filter(Boolean).join('\n')

  const trailingEps = params.eps != null && params.eps > 0 ? params.eps : params.price / trailing
  const forwardEps =
    forward != null && forward > 0 && params.price > 0 ? params.price / forward : trailingEps
  const forwardEPSGrowthPct =
    trailingEps > 0 ? ((forwardEps - trailingEps) / trailingEps) * 100 : 0

  const ratio = trailing / bench.per5yAvg
  const historicalPERPercentile = clamp(Math.round(50 + (ratio - 1) * 28), 1, 99)

  return {
    value: line1,
    subValue,
    meta: `${formatFetchedAtFooter(params.fetchedAt)} · 벤치마크는 업종별 대표값 추정이며 실제 5년 PER 시계열과 다를 수 있습니다.`,
    riskStrip: premiumRiskStrip(prem),
    valuationInputs: {
      trailingPER: trailing,
      forwardPER: forward ?? trailing,
      forwardEPSGrowthPct,
      sectorAveragePER: bench.per5yAvg,
      historicalPERPercentile,
    },
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}
