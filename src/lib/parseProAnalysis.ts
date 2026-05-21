export type ParsedStrategy = {
  verdict: string | null
  conclusionLine: string | null
  entryPrice: number | null
  targetPrice: number | null
  stopLoss: number | null
  entryReason: string | null
}

function parsePriceFromText(text: string, label: string): number | null {
  const re = new RegExp(`${label}[^\\d]{0,20}([0-9][0-9,]{3,})`, 'i')
  const m = text.match(re)
  if (!m) return null
  const n = Number(m[1].replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * OPUS 마크다운 분석에서 결론·매매 가격 추출 (없으면 null)
 */
export function parseProAnalysis(
  text: string,
  opts?: { currentPrice?: number; analystTarget?: number },
): ParsedStrategy {
  const verdictMatch = text.match(/\*\*\s*(매수|관망|매도)[^*]*\*\*/i)
  const verdict = verdictMatch?.[1] ?? null

  const conclusionBlock = text.match(/(?:###|##)\s*결론[^\n]*\n+([\s\S]*?)(?=\n#{1,3}\s|\n\*\*|$)/i)
  const conclusionLine = conclusionBlock?.[1]?.replace(/\*\*/g, '').trim().split('\n')[0]?.trim() || null

  let entryPrice = parsePriceFromText(text, '진입가')
  let targetPrice = parsePriceFromText(text, '목표가')
  let stopLoss = parsePriceFromText(text, '손절가')

  const current = opts?.currentPrice
  const target = opts?.analystTarget

  if (!entryPrice && current) entryPrice = Math.round(current * 0.98)
  if (!targetPrice && target) targetPrice = target
  else if (!targetPrice && current) targetPrice = Math.round(current * 1.08)
  if (!stopLoss && current) stopLoss = Math.round(current * 0.94)

  return {
    verdict,
    conclusionLine,
    entryPrice,
    targetPrice,
    stopLoss,
    entryReason: entryPrice && current ? '현재가 대비 분할 진입' : null,
  }
}
