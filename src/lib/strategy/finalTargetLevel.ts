import type { ExecutionStrategyInputs } from './types'

export type FinalTargetResult = {
  price: number
  pctFromEntry: number
}

/**
 * [5. 최종 목표] min(진입×1.15, 컨센서스 평균×0.9, 진입+3ATR)
 */
export function computeFinalTarget(i: ExecutionStrategyInputs): FinalTargetResult {
  const ref = i.entryPrice != null && i.entryPrice > 0 ? i.entryPrice : i.price
  const caps: number[] = [ref * 1.15, ref + 3 * i.atr14]
  const c = i.consensusAvgTargetPrice
  if (c != null && c > 0) caps.push(c * 0.9)
  const price = Math.round(Math.min(...caps))
  const pctFromEntry = Number((((price / ref) - 1) * 100).toFixed(1))
  return { price, pctFromEntry }
}
