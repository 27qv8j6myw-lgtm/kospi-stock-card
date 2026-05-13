import type { ExecutionStrategyInputs, StopCandidateRow, StopLossResult, StopMethodTag } from './types'

type Cand = { price: number; tag: StopMethodTag; note: string }

/**
 * [3. 손절선] 후보 중 현재가에 가장 가까운(가장 보수적 = 손절가 최대) 값
 */
export function computeStopLossLevel(i: ExecutionStrategyInputs): StopLossResult {
  const ref = i.entryPrice != null && i.entryPrice > 0 ? i.entryPrice : i.price
  const { atr14, rsi14, recentLow20 } = i
  const atrPct = ref > 0 && atr14 > 0 ? atr14 / ref : 0

  const list: Cand[] = []
  const rows: StopCandidateRow[] = []
  const push = (price: number | null | undefined, tag: StopMethodTag, note: string) => {
    if (price == null || !Number.isFinite(price) || !(price > 0) || !(price < ref)) return
    const rounded = Math.round(price)
    const lossPct = Number((((rounded / ref) - 1) * 100).toFixed(1))
    list.push({ price: rounded, tag, note })
    rows.push({ method: tag, price: rounded, lossPct, valid: rounded < ref, note })
  }

  push(ref * 0.94, 'FIXED', '고정 -6%')
  if (atr14 > 0) push(ref - 1.5 * atr14, 'ATR', '진입가 − 1.5×ATR(14)')
  if (recentLow20 > 0 && recentLow20 < ref) {
    push(recentLow20, 'LOW20', '최근 20일 종가 최저')
  }
  if (atrPct >= 0.03) push(ref * 0.96, 'TIGHT_VOL', '고변동(ATR/가격≥3%) −4%')
  if (rsi14 >= 80) push(ref * 0.96, 'TIGHT_RSI', 'RSI≥80 과열 — −4% 타이트')

  if (!list.length) {
    const sp = Math.round(ref * 0.94)
    const pct = Number((((sp / ref) - 1) * 100).toFixed(1))
    return {
      stopPrice: sp,
      stopLossPct: pct,
      method: 'FIXED',
      reasonLine: `Stop ${sp.toLocaleString('ko-KR')}원 / ${pct}% / 기준: FIXED / 후보 산출 실패로 -6% 기본`,
      candidates: [],
    }
  }

  const best = list.reduce((a, b) => (a.price >= b.price ? a : b))
  const stopLossPct = Number((((best.price / ref) - 1) * 100).toFixed(1))
  const tagKr =
    best.tag === 'FIXED'
      ? 'FIXED'
      : best.tag === 'ATR'
        ? 'ATR'
        : best.tag === 'LOW20'
          ? '20-low'
          : best.tag === 'TIGHT_VOL'
            ? 'TIGHT-4% (변동성)'
            : 'TIGHT-4% (RSI)'

  const rsiNote = rsi14 >= 80 ? 'RSI 과열권으로 손절 타이트' : '리스크 대비 손절 간격'
  return {
    stopPrice: best.price,
    stopLossPct,
    method: best.tag,
    reasonLine: `Stop ${best.price.toLocaleString('ko-KR')}원 / ${stopLossPct}% / 기준: ${tagKr} / ${best.note} · ${rsiNote}`,
    candidates: rows,
  }
}
