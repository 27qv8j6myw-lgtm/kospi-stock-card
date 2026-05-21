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
