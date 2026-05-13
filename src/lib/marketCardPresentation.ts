import type { MetricCardAccent } from '../types/stock'

/** 시장 헤드라인에서 괄호 앞 한글 판정만 (예: "강세장 (Trend Up)" → "강세장") */
export function marketPrimaryKorean(headline: string | undefined | null): string {
  const s = String(headline || '').trim()
  if (!s) return '데이터 없음'
  const p = s.indexOf('(')
  return (p > 0 ? s.slice(0, p).trim() : s) || '데이터 없음'
}

export function marketCardAccentFromHeadline(headline: string | undefined | null): MetricCardAccent {
  const k = marketPrimaryKorean(headline)
  if (k.includes('강세장')) return 'info'
  if (k.includes('변동성')) return 'danger'
  if (k.includes('약세장')) return 'warning'
  if (k.includes('조정장')) return 'caution'
  return 'neutral'
}
