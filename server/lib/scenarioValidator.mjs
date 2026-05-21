/**
 * 실행 전략·AI 시나리오 가격 논리 검증 (롱 포지션 기준 자동 보정).
 */

/**
 * @param {string | null | undefined} action
 */
function isBuyLikeAction(action) {
  const a = String(action ?? '')
    .replace(/\s+/g, '')
    .trim()
  if (!a) return false
  if (/매도|회피|익절|관망|주의/.test(a)) return false
  return /매수|관심|보유유지|보유/.test(a)
}

/**
 * @param {string | null | undefined} entryDecision
 */
export function isBuyLikeEntry(entryDecision) {
  const d = String(entryDecision ?? '').trim()
  if (!d) return false
  if (/익절|회피|관망/.test(d)) return false
  return /매수|보유 유지/.test(d)
}


/**
 * @param {Record<string, unknown> | null | undefined} strategy
 * @param {number} currentPrice
 * @param {string | null | undefined} action
 * @returns {Record<string, unknown> | null | undefined}
 */
export function validateExecutionStrategy(strategy, currentPrice, action) {
  if (!strategy || !currentPrice || !(Number(currentPrice) > 0)) return strategy

  const cur = Math.round(Number(currentPrice))
  const out = { ...strategy }
  const errors = []
  const corrections = []

  const isBuy = isBuyLikeAction(action)
  const isWait = !isBuy && /관망|주의/.test(String(action ?? ''))

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

  if (isWait) {
    const entry = Number(out.entryPrice)
    if (Number.isFinite(entry) && entry > 0 && entry > cur) {
      errors.push(`관망인데 진입가(${entry}) > 현재가(${cur})`)
      out.entryPrice = Math.round(cur * 0.95)
      corrections.push('진입가 자동 보정: 현재가 -5%')
    }

    const target = Number(out.targetPrice)
    const entryPx = Number(out.entryPrice)
    if (
      Number.isFinite(target) &&
      Number.isFinite(entryPx) &&
      target > 0 &&
      entryPx > 0 &&
      target <= entryPx
    ) {
      errors.push(`목표가(${target}) <= 진입가(${entryPx})`)
      out.targetPrice = Math.round(entryPx * 1.08)
      corrections.push('목표가 자동 보정: 진입가 +8%')
    }
  }

  if (errors.length > 0) {
    console.warn('[시나리오 검증] executionStrategy', { errors, corrections, action, currentPrice: cur })
  }

  return out
}

/**
 * 3개월 실행 전략 카드 (룰 엔진) — `finalTargetPrice`·익절·손절 논리 보정.
 * @param {Record<string, unknown>} strategy
 * @param {number} currentPrice — 실시간 현재가
 * @param {string | null | undefined} entryDecision
 * @param {number} [entryRef] — 진입가 기준(없으면 currentPrice)
 * @returns {Record<string, unknown>}
 */
export function validateThreeMonthStrategy(strategy, currentPrice, entryDecision, entryRef) {
  if (!strategy || !currentPrice || !(Number(currentPrice) > 0)) return strategy

  const cur = Math.round(Number(currentPrice))
  const ref =
    entryRef != null && Number.isFinite(Number(entryRef)) && Number(entryRef) > 0
      ? Math.round(Number(entryRef))
      : cur

  const out = { ...strategy }
  const errors = []
  const corrections = []

  if (isBuyLikeEntry(entryDecision)) {
    const finalPx = Number(out.finalTargetPrice)
    if (Number.isFinite(finalPx) && finalPx > 0 && finalPx <= cur) {
      errors.push(`매수 추천인데 최종 목표(${finalPx}) <= 현재가(${cur})`)
      out.finalTargetPrice = Math.round(Math.max(cur * 1.1, ref * 1.05))
      out.finalTargetPct = Number((((out.finalTargetPrice / ref) - 1) * 100).toFixed(1))
      corrections.push('최종 목표 자동 보정: 현재가 +10%')
    }

    const tp1 = Number(out.firstTakeProfitPrice)
    if (Number.isFinite(tp1) && tp1 > 0 && tp1 <= cur) {
      errors.push(`매수 추천인데 1차 익절(${tp1}) <= 현재가(${cur})`)
      out.firstTakeProfitPrice = Math.round(Math.max(cur * 1.05, ref * 1.05))
      out.firstTakeProfitPct = Number((((out.firstTakeProfitPrice / ref) - 1) * 100).toFixed(1))
      corrections.push('1차 익절 자동 보정: 현재가 +5%')
    }

    const stop = Number(out.stopPrice)
    if (Number.isFinite(stop) && stop > 0 && stop >= cur) {
      errors.push(`매수 추천인데 손절(${stop}) >= 현재가(${cur})`)
      out.stopPrice = Math.round(cur * 0.93)
      out.stopLossPct = Number((((out.stopPrice / ref) - 1) * 100).toFixed(1))
      corrections.push('손절 자동 보정: 현재가 -7%')
    }
  }

  if (isWaitLikeEntry(entryDecision)) {
    const stop = Number(out.stopPrice)
    if (Number.isFinite(stop) && stop > 0 && stop >= cur) {
      out.stopPrice = Math.round(cur * 0.95)
      out.stopLossPct = Number((((out.stopPrice / ref) - 1) * 100).toFixed(1))
      corrections.push('관망 손절 보정')
    }
  }

  if (errors.length > 0) {
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
