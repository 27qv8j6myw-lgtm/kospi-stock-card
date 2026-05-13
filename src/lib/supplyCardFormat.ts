/** 1억 원 */
const WON_PER_EOK = 100_000_000
/** 1조 원 */
const WON_PER_JO = 1_000_000_000_000

/**
 * 수급 카드용 순매수 금액 문자열.
 *
 * @param valueWon 부호 있는 금액 — **대한민국 원(KRW) 정수** (API·`supplyDetails`와 동일 단위).
 *   `foreignNetAmount3D` 등은 원 단위 누적 순매수액이다.
 * @returns
 *   - `0` → `"0원"`
 *   - 절댓값 ≥ 1조원 → `"±X.X조"` (10조 미만은 소수 1자리, 그 외 정수 조 단위)
 *   - 그 외 → `"±X,XXX억"` (원을 억으로 반올림)
 */
export function formatSupplyFlowAmountWon(valueWon: number): string {
  if (!Number.isFinite(valueWon) || valueWon === 0) return '0원'

  const sign = valueWon < 0 ? -1 : 1
  const abs = Math.abs(valueWon)

  if (abs >= WON_PER_JO) {
    const jo = abs / WON_PER_JO
    const decimals = jo >= 10 ? 0 : 1
    const body = jo.toLocaleString('ko-KR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    return sign < 0 ? `-${body}조` : `+${body}조`
  }

  const eok = Math.round(abs / WON_PER_EOK)
  const body = eok.toLocaleString('ko-KR')
  return sign < 0 ? `-${body}억` : `+${body}억`
}
