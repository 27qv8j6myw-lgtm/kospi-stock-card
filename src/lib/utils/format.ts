export function getValueColor(value: number): string {
  if (value > 0) return '#DC2626'
  if (value < 0) return '#2563EB'
  return '#1F1F1F'
}

export function formatSignedNumber(value: number, unit = ''): { text: string; color: string } {
  const sign = value > 0 ? '+' : ''
  return {
    text: `${sign}${value.toLocaleString()}${unit}`,
    color: getValueColor(value),
  }
}

/** 퍼센트 포인트 표기 (예: +6.2%) — 양수에만 `+` 붙임, 음수는 `toFixed`에 `-` 포함 */
export function formatPct(value: number, fractionDigits = 1): string {
  if (value > 0) return `+${value.toFixed(fractionDigits)}%`
  if (value < 0) return `${value.toFixed(fractionDigits)}%`
  return `${value.toFixed(fractionDigits)}%`
}

/** 실행 전략·목표가 등 부호가 한 번만 붙는 % 문자열 (예: +9.0%, -4.0%) */
export function formatSignedPct(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '—'
  if (value > 0) return `+${value.toFixed(decimals)}%`
  if (value < 0) return `${value.toFixed(decimals)}%`
  return `${value.toFixed(decimals)}%`
}
