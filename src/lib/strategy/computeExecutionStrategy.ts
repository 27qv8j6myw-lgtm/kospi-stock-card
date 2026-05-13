import type { StopInfo, ThreeMonthStrategy } from '../../types/stock'
import { computeAddBuyRule } from './addBuyRule'
import { computeEntryDecisionBundle } from './entryDecision'
import { computeFinalTarget } from './finalTargetLevel'
import { computeFirstTakeProfit } from './firstTakeProfitLevel'
import { computeRecommendedPositionPct } from './recommendedPositionPct'
import { computeStopLossLevel } from './stopLossLevel'
import { computeStrategySummaryLine } from './strategySummaryLine'
import { computeTimeStopRule } from './timeStopRule'
import type { ExecutionStrategyInputs, StopMethodTag } from './types'

function mapStopMethodToPanel(m: StopMethodTag): StopInfo['method'] {
  if (m === 'ATR') return 'ATR'
  if (m === 'LOW20') return 'RECENT_LOW'
  return 'FIXED'
}

function buildStopPanel(stop: ReturnType<typeof computeStopLossLevel>): Pick<StopInfo, 'method' | 'candidates'> {
  return {
    method: mapStopMethodToPanel(stop.method),
    candidates: stop.candidates.map((c) => ({
      method: c.method,
      price: c.price,
      lossPct: c.lossPct,
      valid: c.valid,
      reason: c.note,
    })),
  }
}

function buildConsensusNote(i: ExecutionStrategyInputs, finalTargetPrice: number): string {
  const msgs: string[] = []
  const avg = i.consensusAvgTargetPrice
  const ref = i.entryPrice != null && i.entryPrice > 0 ? i.entryPrice : i.price
  if (avg != null && avg > 0) {
    if (ref > avg) {
      msgs.push(
        '현재가가 컨센서스 평균 목표가를 이미 초과했습니다. 최종 목표는 min 규칙으로 상단을 제한합니다.',
      )
    } else {
      const up = ((avg / ref) - 1) * 100
      if (up < 8) msgs.push('컨센서스 기준 상승여력은 제한적입니다.')
      if (up >= 15) msgs.push('컨센서스 기준으로도 15% 내외 상승여력이 남아 있습니다.')
    }
  }
  if (avg != null && finalTargetPrice > avg * 0.95) {
    msgs.push('최종 목표가 컨센서스 평균 목표가의 90% 근처까지 캡됩니다.')
  }
  return msgs.join(' ')
}

/**
 * 3개월 실행 전략 8항목 — 입력은 시세·지표만 (페이지/컴포넌트에서 재계산 금지)
 */
export function computeExecutionStrategy(i: ExecutionStrategyInputs): ThreeMonthStrategy {
  const bundle = computeEntryDecisionBundle(i)
  const entry = bundle.decision
  const recommendedPositionPct = computeRecommendedPositionPct(i, entry, bundle.fund)
  const stop = computeStopLossLevel(i)
  const stopPanel = buildStopPanel(stop)
  const tp1 = computeFirstTakeProfit(i)
  const fin = computeFinalTarget(i)
  const timeStopRule = computeTimeStopRule(i)
  const addBuyRule = computeAddBuyRule(i)
  const summary = computeStrategySummaryLine(entry)
  const consensusNote = buildConsensusNote(i, fin.price)

  const warnings: string[] = []
  if (i.rsi14 >= 80) warnings.push('RSI 80 이상 — 추격매수 금지.')
  if (i.atrDistanceAbs >= 3.5) warnings.push('ATR 이격 3.5 이상 — 추격매수 금지.')
  if (i.atrDistanceAbs >= 5.0) warnings.push('ATR 이격 5.0 이상 — 1차 익절 50% 강제 검토.')
  if (entry === '관망 (과열)') warnings.push('과열권 — 신규 진입 보류.')

  return {
    entryDecision: entry,
    entryRationale: bundle.rationale,
    fundamentalSignal: bundle.fundamentalSignal,
    entryReasonShort: bundle.reasonShort,
    recommendedPositionPct,
    stopPrice: stop.stopPrice,
    stopLossPct: stop.stopLossPct,
    stopReason: stop.reasonLine,
    stopPanelMethod: stopPanel.method,
    stopPanelCandidates: stopPanel.candidates,
    firstTakeProfitPrice: tp1.price,
    firstTakeProfitPct: tp1.pctFromEntry,
    firstTakeProfitSellPct: tp1.sellPct,
    firstTakeProfitDetail: tp1.detailLine,
    finalTargetPrice: fin.price,
    finalTargetPct: fin.pctFromEntry,
    maxHoldingPeriod: '최대 3개월(약 60거래일)',
    timeStopRule,
    addBuyRule,
    summary,
    consensusNote,
    warnings,
  }
}

/** 삼성 P0 시나리오 자체 검증 (개발 시 `import { verifySamsungP0Fixture } ...` 호출) */
export function verifySamsungP0Fixture(): boolean {
  const price = 79_800
  const atr14 = 2_930
  const i: ExecutionStrategyInputs = {
    price,
    structureScore: 99,
    executionScore: 62,
    rsi14: 92,
    atrDistanceAbs: 7.3,
    atr14,
    weightedRiskReward: 1.8,
    consensusAvgTargetPrice: 91_000,
    recentLow20: 74_800,
  }
  const r = computeExecutionStrategy(i)
  const ok =
    r.entryDecision === '전량 익절' &&
    r.recommendedPositionPct === 0 &&
    r.stopLossPct === -4.0 &&
    r.summary === '임계값 초과 — 잔여 전량 청산 검토'
  if (!ok) {
    console.error('Samsung P0 fixture failed', r)
  }
  return ok
}
