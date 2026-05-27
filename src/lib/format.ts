export type FormatKRWOptions = {
  showPlus?: boolean
}

/**
 * 원화 금액을 조/억/만 단위로 표시
 */
export function formatKRW(amount: number | null | undefined, options: FormatKRWOptions = {}): string {
  if (amount == null || Number.isNaN(amount)) return '—'

  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : options.showPlus ? '+' : ''

  if (abs >= 1e12) {
    return `${sign}${(abs / 1e12).toFixed(2)}조`
  }
  if (abs >= 1e8) {
    return `${sign}${Math.round(abs / 1e8).toLocaleString()}억`
  }
  if (abs >= 1e4) {
    return `${sign}${Math.round(abs / 1e4).toLocaleString()}만`
  }
  return `${sign}${Math.round(abs).toLocaleString()}`
}

/**
 * 만/억 축약 표기 (부호 없음 — 호출부에서 +/- 처리)
 * @example formatKRWCompact(26920000) → "2,692만"
 */
export function formatKRWCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e8) {
    const [intPart, decPart] = (abs / 1e8).toFixed(2).split('.')
    const intWithComma = Number(intPart).toLocaleString('ko-KR')
    return decPart ? `${intWithComma}.${decPart}억` : `${intWithComma}억`
  }
  if (abs >= 1e4) {
    return `${Math.round(abs / 1e4).toLocaleString('ko-KR')}만`
  }
  return Math.round(abs).toLocaleString('ko-KR')
}
