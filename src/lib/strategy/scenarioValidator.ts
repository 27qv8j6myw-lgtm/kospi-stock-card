import type { ThreeMonthStrategy } from '../../types/stock'
import type { ExecutionEntryDecision } from './types'

function isBuyLikeAction(action: string | null | undefined): boolean {
  const a = String(action ?? '')
    .replace(/\s+/g, '')
    .trim()
  if (!a) return false
  if (/매도|회피|익절|관망|주의/.test(a)) return false
  return /매수|관심|보유유지|보유/.test(a)
}

export function isBuyLikeEntry(entryDecision: string | null | undefined): boolean {
  const d = String(entryDecision ?? '').trim()
  if (!d) return false
  if (/익절|회피|관망/.test(d)) return false
  return /매수|보유 유지/.test(d)
}

function isWaitLikeEntry(entryDecision: string | null | undefined): boolean {
  const d = String(entryDecision ?? '').trim()
  return /관망/.test(d) && !/익절|회피/.test(d)
}

export type ExecutionStrategyPrices = {
  entryPrice?: number | null
  targetPrice?: number | null
  stopLoss?: number | null
  entryReason?: string
  targetReason?: string
  stopLossReason?: string
}

export function validateExecutionStrategy(
  strategy: ExecutionStrategyPrices | null | undefined,
  currentPrice: number,
  action: string | null | undefined,
): ExecutionStrategyPrices | null | undefined {
  if (!strategy || !currentPrice || !(currentPrice > 0)) return strategy

  const cur = Math.round(currentPrice)
  const out = { ...strategy }
  const errors: string[] = []
  const corrections: string[] = []

  const isBuy = isBuyLikeAction(action)

  if (isBuy) {
    const target = Number(out.targetPrice)
    if (Number.isFinite(target) && target > 0 && target <= cur) {
      errors.push(`매수 추천인데 목표가(${target}) <= 현재가(${cur})`)
      out.targetPrice = Math.round(cur * 1.1)
      corrections.push('목표가 자동 보정: 현재가 +10%')
    }

    const stop = Number(out.stopLoss)
    if (Number.isFinite(stop) && stop > 0 && stop >= cur) {
      errors.push(`매수 추천인데 손절가(${stop}) >= 현재가(${cur})`)
      out.stopLoss = Math.round(cur * 0.93)
      corrections.push('손절가 자동 보정: 현재가 -7%')
    }

    const entry = Number(out.entryPrice)
    if (Number.isFinite(entry) && entry > 0) {
      const dev = Math.abs(entry - cur) / cur
      if (dev > 0.05) {
        errors.push(`진입가(${entry})가 현재가(${cur})에서 5% 이상 벗어남`)
        out.entryPrice = cur
        corrections.push('진입가 자동 보정: 현재가')
      }
    }
  }

  if (errors.length > 0 && typeof console !== 'undefined') {
    console.warn('[시나리오 검증] executionStrategy', { errors, corrections, action, currentPrice: cur })
  }

  return out
}

export function validateThreeMonthStrategy(
  strategy: ThreeMonthStrategy,
  currentPrice: number,
  entryDecision: ExecutionEntryDecision | string,
  entryRef?: number,
): ThreeMonthStrategy {
  if (!strategy || !currentPrice || !(currentPrice > 0)) return strategy

  const cur = Math.round(currentPrice)
  const ref =
    entryRef != null && Number.isFinite(entryRef) && entryRef > 0 ? Math.round(entryRef) : cur

  const out = { ...strategy }
  const errors: string[] = []
  const corrections: string[] = []

  if (isBuyLikeEntry(entryDecision)) {
    if (out.finalTargetPrice > 0 && out.finalTargetPrice <= cur) {
      errors.push(`매수 추천인데 최종 목표(${out.finalTargetPrice}) <= 현재가(${cur})`)
      out.finalTargetPrice = Math.round(Math.max(cur * 1.1, ref * 1.05))
      out.finalTargetPct = Number((((out.finalTargetPrice / ref) - 1) * 100).toFixed(1))
      corrections.push('최종 목표 자동 보정')
    }

    if (out.firstTakeProfitPrice > 0 && out.firstTakeProfitPrice <= cur) {
      errors.push(`매수 추천인데 1차 익절(${out.firstTakeProfitPrice}) <= 현재가(${cur})`)
      out.firstTakeProfitPrice = Math.round(Math.max(cur * 1.05, ref * 1.05))
      out.firstTakeProfitPct = Number((((out.firstTakeProfitPrice / ref) - 1) * 100).toFixed(1))
      corrections.push('1차 익절 자동 보정')
    }

    if (out.stopPrice > 0 && out.stopPrice >= cur) {
      errors.push(`매수 추천인데 손절(${out.stopPrice}) >= 현재가(${cur})`)
      out.stopPrice = Math.round(cur * 0.93)
      out.stopLossPct = Number((((out.stopPrice / ref) - 1) * 100).toFixed(1))
      corrections.push('손절 자동 보정')
    }
  }

  if (isWaitLikeEntry(entryDecision) && out.stopPrice > 0 && out.stopPrice >= cur) {
    out.stopPrice = Math.round(cur * 0.95)
    out.stopLossPct = Number((((out.stopPrice / ref) - 1) * 100).toFixed(1))
    corrections.push('관망 손절 보정')
  }

  if (errors.length > 0 && typeof console !== 'undefined') {
    console.warn('[시나리오 검증] threeMonth', {
      errors,
      corrections,
      entryDecision,
      currentPrice: cur,
      entryRef: ref,
    })
  }

  return out
}
