import type { ExecutionStrategyInputs } from './types'

/**
 * [7. 추가매수]
 */
export function computeAddBuyRule(i: ExecutionStrategyInputs): string {
  const { rsi14, atrDistanceAbs, price, ma5, priorSwingHigh, volumeVs5dAvgRatio, pnlSinceEntryPct } =
    i

  const forbid: string[] = []
  if (rsi14 > 80) forbid.push(`RSI ${rsi14.toFixed(0)} 초과`)
  if (atrDistanceAbs > 3.5) forbid.push(`ATR 이격 ${atrDistanceAbs.toFixed(1)} 초과`)
  if (pnlSinceEntryPct != null && pnlSinceEntryPct <= -2) forbid.push('현재 손실 -2% 이상')
  if (i.stopBreachedReentry) forbid.push('손절 이탈 후 재진입')

  if (forbid.length) {
    return `추가매수 금지 (사유: ${forbid.join(', ')})`
  }

  const okMa = ma5 != null && price > ma5
  const okPull =
    priorSwingHigh != null &&
    priorSwingHigh > 0 &&
    price >= priorSwingHigh * (1 - 0.03)
  const okVol = volumeVs5dAvgRatio != null && volumeVs5dAvgRatio >= 1.2
  const okTp = !i.firstTakeProfitReached

  if (okMa && okPull && okVol && okTp) {
    return '추가매수 가능 (조건: 눌림 -3% 이내 + 거래량 증가)'
  }

  const miss: string[] = []
  if (!okMa) miss.push('5일선 위 추세')
  if (!okPull) miss.push('직전 고점 -3% 이내 눌림')
  if (!okVol) miss.push('거래량 +20% 이상')
  if (!okTp) miss.push('1차 익절 미도달')
  return `추가매수 금지 (허용 조건 미충족: ${miss.join(', ')})`
}
