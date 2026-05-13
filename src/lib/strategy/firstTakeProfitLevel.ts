import type { ExecutionStrategyInputs } from './types'

export type FirstTakeProfitResult = {
  price: number
  pctFromEntry: number
  sellPct: number
  forceTriggerCount: number
  detailLine: string
}

const SELL_PCT = 50

/**
 * [4. 1차 익절]
 */
export function computeFirstTakeProfit(i: ExecutionStrategyInputs): FirstTakeProfitResult {
  const ref = i.entryPrice != null && i.entryPrice > 0 ? i.entryPrice : i.price
  const { atr14, rsi14, atrDistanceAbs } = i
  const price = Math.round(Math.max(ref * 1.09, ref + 1.5 * atr14))
  const pctFromEntry = Number((((price / ref) - 1) * 100).toFixed(1))
  let forceTriggerCount = 0
  if (rsi14 >= 80) forceTriggerCount += 1
  if (atrDistanceAbs >= 5.0) forceTriggerCount += 1
  const detailLine = `1차 익절 ${price.toLocaleString('ko-KR')}원 (+${pctFromEntry}%) / ${SELL_PCT}% 매도 / 강제 트리거 ${forceTriggerCount}개 활성`
  return { price, pctFromEntry, sellPct: SELL_PCT, forceTriggerCount, detailLine }
}
