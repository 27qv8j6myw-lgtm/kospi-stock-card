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
  const capped = Math.min(...caps)
  // 컨센 캡이 현재가(진입가)보다 낮을 때 목표가 역전 방지 (롱 전략 최소 +5%)
  const floor = Math.round(ref * 1.05)
  const price = Math.round(Math.max(capped, floor))
  const pctFromEntry = Number((((price / ref) - 1) * 100).toFixed(1))
  return { price, pctFromEntry }
}
