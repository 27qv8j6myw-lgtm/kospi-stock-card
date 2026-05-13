import {
  adx14,
  avgVolume,
  highestClose,
  returnPct,
  sma,
} from './coreMath'
import type { OhlcvBar } from './types'

export type StructureScoreResult = {
  score: number
  sub: string
  breakdown: {
    maAlignment: number
    adx: number
    relativeStrength: number
    volumeTrend: number
    near52w: number
  }
}

function maAlignmentScore(bars: OhlcvBar[]): { score: number; label: string } {
  const closes = bars.map((b) => b.close)
  const m5 = sma(closes, 5)
  const m20 = sma(closes, 20)
  const m60 = sma(closes, 60)
  const m120 = sma(closes, 120)
  if (m5 == null || m20 == null || m60 == null || m120 == null) {
    return { score: 0, label: 'MA 데이터 부족' }
  }
  let c = 0
  if (m5 > m20) c += 1
  if (m20 > m60) c += 1
  if (m60 > m120) c += 1
  const last = bars[bars.length - 1]?.close
  if (Number.isFinite(last) && m60 != null && last > m60) c += 1
  const score = c * 5
  const label =
    c >= 4
      ? 'MA 정배열·가격 중기선 위'
      : c === 3
        ? 'MA 정배열'
        : c === 2
          ? 'MA 부분 정배열'
          : c === 1
            ? 'MA 혼조'
            : 'MA 역배열'
  return { score, label }
}

function adxScore(bars: OhlcvBar[]): { score: number; label: string } {
  const adx = adx14(bars)
  if (adx == null) return { score: 0, label: 'ADX 산출 불가' }
  if (adx >= 25) return { score: 20, label: '추세 강함' }
  if (adx >= 20) return { score: 10, label: '추세 보통' }
  return { score: 0, label: '추세 약함' }
}

function relativeStrengthScore(
  stockCloses: number[],
  indexCloses: number[],
): { score: number; label: string } {
  const rs = returnPct(stockCloses, 60)
  const rk = returnPct(indexCloses, 60)
  if (rs == null || rk == null) return { score: 0, label: '상대강도 데이터 부족' }
  const ex = rs - rk
  if (ex > 5) return { score: 20, label: '시장 대비 강함' }
  if (ex >= 0) return { score: 10, label: '시장 대비 동행' }
  return { score: 0, label: '시장 대비 약함' }
}

function volumeTrendScore(bars: OhlcvBar[]): { score: number; label: string } {
  const a60 = avgVolume(bars, 60)
  const a120 = avgVolume(bars, 120)
  if (a60 == null || a120 == null || !(a120 > 0)) {
    return { score: 0, label: '거래량 추세 불명' }
  }
  if (a60 > a120) return { score: 20, label: '거래량 증가 추세' }
  return { score: 0, label: '거래량 감소 추세' }
}

function near52wScore(bars: OhlcvBar[]): { score: number; label: string } {
  const hi52 = highestClose(bars, Math.min(252, bars.length))
  const last = bars[bars.length - 1]?.close
  if (hi52 == null || !(last > 0) || !(hi52 > 0)) return { score: 0, label: '신고가 근접 불명' }
  const dd = (last / hi52 - 1) * 100
  if (dd >= -5) return { score: 20, label: '52주 고점 근접' }
  if (dd >= -10) return { score: 10, label: '고점 대비 조정 구간' }
  return { score: 0, label: '고점 대비 이격 큼' }
}

export function computeStructureScore(
  stockBars: OhlcvBar[],
  indexBars: OhlcvBar[],
): StructureScoreResult {
  const ma = maAlignmentScore(stockBars)
  const adx = adxScore(stockBars)
  const stockCloses = stockBars.map((b) => b.close)
  const indexCloses = indexBars.map((b) => b.close)
  const rel = relativeStrengthScore(stockCloses, indexCloses)
  const vol = volumeTrendScore(stockBars)
  const w52 = near52wScore(stockBars)
  const raw = ma.score + adx.score + rel.score + vol.score + w52.score
  const score = Math.round(Math.max(0, Math.min(100, raw)))
  const parts = [
    { k: 'ma', s: ma.score, l: ma.label },
    { k: 'adx', s: adx.score, l: adx.label },
    { k: 'rel', s: rel.score, l: rel.label },
    { k: 'vol', s: vol.score, l: vol.label },
    { k: '52w', s: w52.score, l: w52.label },
  ]
  const top = parts.reduce((a, b) => (b.s > a.s ? b : a))
  const sub = top.s > 0 ? top.l : '체크 항목 점수 낮음'
  return {
    score,
    sub,
    breakdown: {
      maAlignment: ma.score,
      adx: adx.score,
      relativeStrength: rel.score,
      volumeTrend: vol.score,
      near52w: w52.score,
    },
  }
}
