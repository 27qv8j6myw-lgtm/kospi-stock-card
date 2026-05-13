import { mean, trueRange } from './coreMath'
import type { OhlcvBar } from './types'

/** True Range 시퀀스 (bars[0]은 전일 종가 prevClose 용도로만 사용됨 인덱스 1부터). */
export function trueRangesFromBars(bars: OhlcvBar[]): number[] {
  const trs: number[] = []
  for (let i = 1; i < bars.length; i++) {
    trs.push(trueRange(bars[i], bars[i - 1].close))
  }
  return trs
}

/**
 * ATR(14) — 최근 14개 TR의 산술평균 (Wilder RMA 아님, 검증·폴백용).
 * 단위: 원 절대값. TR 합계/14가 아니라 **평균**이므로 합계 오류와 구분됩니다.
 */
export function calculateAtr14Sma(bars: OhlcvBar[], period = 14): number | null {
  if (bars.length < period + 1) return null
  const trs = trueRangesFromBars(bars)
  if (trs.length < period) return null
  return mean(trs.slice(-period))
}
