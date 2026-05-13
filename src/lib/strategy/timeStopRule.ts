import type { ExecutionStrategyInputs } from './types'

/**
 * [6. 타임스탑] 고변동(ATR/가격≥3%) 시 15/45, 기본 20/60
 */
export function computeTimeStopRule(i: ExecutionStrategyInputs): string {
  const ref = i.entryPrice != null && i.entryPrice > 0 ? i.entryPrice : i.price
  const highVol = ref > 0 && i.atr14 / ref >= 0.03
  const shortD = highVol ? 15 : 20
  const longD = highVol ? 45 : 60
  const lines = [
    `${shortD}거래일 내 +5% 미달 → "재평가 필요" 알림`,
    `${longD}거래일 내 +15% 미달 → "정리 또는 재선정" 알림`,
    '진입 후 경과일은 포지션 진입일 저장 시 자동 추적합니다.',
  ]
  return lines.join('\n')
}
