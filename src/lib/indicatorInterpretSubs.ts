import type { SectorFlowSnapshot } from '../types/stock'
import { resolveSectorValuationBench } from './valuationCard'

/** 구조 점수 → 한 줄 해석 */
export function structureInterpretSub(score: number): string {
  if (score >= 85) return '추세 매우 강함'
  if (score >= 70) return '추세 양호'
  if (score >= 55) return '추세 보통'
  return '추세 약화'
}

/** 실행 점수 → 한 줄 해석 */
export function executionInterpretSub(score: number): string {
  if (score >= 65) return '타이밍 양호'
  if (score >= 50) return '타이밍 보통'
  return '타이밍 부담'
}

/** ATR 이격 보조 — 20MA 대비 ATR 단위 명시 */
export function atrMaGapInterpretSub(atrGapNum: number | null | undefined): string {
  if (atrGapNum != null && Number.isFinite(atrGapNum)) {
    return `20MA 대비 ${atrGapNum.toFixed(1)}ATR 이격`
  }
  return '20MA 대비 ATR 이격'
}

/** 연속상승 표시값 → 한 줄 해석 */
export function consecutiveRiseInterpretSub(display: string): string {
  const t = display.trim()
  if (!t || t === '없음') return '연속 상승 패턴 없음'
  const m = t.match(/(\d+)/)
  if (m) return `연속 양봉 ${m[1]}거래일`
  return '연속 양봉 추적'
}

/** 섹터 vs 시장 5일 */
export function sectorFiveDayVsMarketSub(snap: SectorFlowSnapshot): string {
  const sf = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}`
  return `섹터 5D ${sf(snap.sectorReturn5D)}% / 시장 ${sf(snap.marketReturn5D)}%`
}

/** 구조 상태 — 국면 한 줄 (괄호 안 보조 문구 제거) */
export function structureStateInterpretSub(structureState: string | undefined): string {
  const raw = (structureState ?? '').trim()
  if (!raw) return '국면·이격 기준 상태'
  return raw.replace(/\s*\([^)]*\)\s*$/, '').trim() || raw
}

/** 캔들질 CLV 기반 한 줄 (secondary) */
export function candleQualityInterpretSub(primary: string): string {
  const m5 = primary.match(/CLV5\s*([+-]?\d+(?:\.\d+)?)/i)
  const m10 = primary.match(/CLV10\s*([+-]?\d+(?:\.\d+)?)/i)
  const n5 = m5 ? Number(m5[1]) : NaN
  const n10 = m10 ? Number(m10[1]) : NaN
  const pick = (n: number) => {
    if (!Number.isFinite(n)) return ''
    if (n >= 0.5) return '강함 (종가 고점 근접)'
    if (n <= -0.5) return '약함 (종가 저점 근접)'
    return '중립 (중간대)'
  }
  const parts: string[] = []
  if (Number.isFinite(n5)) parts.push(`CLV5 ${pick(n5)}`)
  if (Number.isFinite(n10)) parts.push(`CLV10 ${pick(n10)}`)
  return parts.length ? parts.join(' · ') : '종가 위치·매수세 요약'
}

/** 밸류 카드 모델 + 섹터명 → 5Y 대비 괴리 한 줄 */
export function valuationPremiumInterpretSub(params: {
  trailingPER: number
  sectorName: string
}): string {
  const bench = resolveSectorValuationBench(params.sectorName || '')
  const t = params.trailingPER
  if (!(bench.per5yAvg > 0) || !Number.isFinite(t)) return '5Y·섹터 벤치 대비 요약'
  const prem = ((t - bench.per5yAvg) / bench.per5yAvg) * 100
  const sign = prem >= 0 ? '+' : ''
  return `5Y 평균 ${bench.per5yAvg.toFixed(1)}x 대비 ${sign}${prem.toFixed(0)}%`
}

/** RSI·MFI 한 줄 — MFI 수치 + RSI 구간 */
export function indicatorRsiMfiInterpretSub(params: {
  indicatorLine?: string
  rsiNumeric: number
}): string {
  const line = params.indicatorLine ?? ''
  const mfiM = line.match(/MFI\s*(\d+)/i)
  const mfiStr = mfiM ? mfiM[1] : '—'
  const rsi = params.rsiNumeric
  let zone = '중립 구간'
  if (rsi >= 80) zone = '과매수 영역'
  else if (rsi >= 70) zone = '과매수 진입'
  else if (rsi <= 30) zone = '과매도 근접'
  return `MFI ${mfiStr} · ${zone}`
}

/** 통계 카드 — 20일 평균가 대비 */
export function statisticsAvg20InterpretSub(stats: string | undefined): string {
  if (!stats) return '20일 평균 대비 괴리'
  const m = stats.match(/20일\s*평균\s*([\d,]+)\s*원/)
  if (m) return `20일 평균 ${m[1]}원 대비`
  const m2 = stats.match(/([\d,]+)\s*원/)
  if (m2) return `20일 평균 ${m2[1]}원 대비`
  return '20일 평균 대비 괴리'
}
