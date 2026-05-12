export type TargetDirection = 'up' | 'down' | 'maintain' | 'unknown'

function toNumber(raw: string): number | undefined {
  const n = Number(raw.replace(/[^\d]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export function extractTargetPrice(text: string): {
  targetPrice?: number
  previousTargetPrice?: number
} {
  const src = text || ''
  const pair =
    src.match(/(\d[\d,]*)\s*원?\s*에서\s*(\d[\d,]*)\s*원?\s*으로\s*(상향|하향)/) ||
    src.match(/목표(?:가|주가).{0,12}?(\d[\d,]*)\s*원?\s*→\s*(\d[\d,]*)\s*원?/)
  if (pair) {
    const a = toNumber(pair[1])
    const b = toNumber(pair[2])
    return { previousTargetPrice: a, targetPrice: b }
  }

  const single =
    src.match(/목표(?:가|주가)\s*(?:는|을|)\s*(\d[\d,]*)\s*원/) ||
    src.match(/\bTP\s*(\d[\d,]*)\s*원?/)
  if (single) return { targetPrice: toNumber(single[1]) }
  return {}
}

export function extractBrokerName(titleOrSource: string): string | undefined {
  const text = titleOrSource || ''
  const brokers = [
    'NH투자증권',
    'KB증권',
    '신한투자증권',
    '미래에셋증권',
    '하나증권',
    '한국투자증권',
    '메리츠증권',
    '대신증권',
    '유안타증권',
    '키움증권',
    '한화투자증권',
  ]
  return brokers.find((b) => text.includes(b))
}

export function extractRating(text: string): string | undefined {
  const src = text || ''
  if (/투자의견\s*매수|BUY|Outperform/i.test(src)) return 'BUY'
  if (/보유|HOLD|중립|Neutral/i.test(src)) return 'HOLD'
  if (/매도|SELL|Underperform/i.test(src)) return 'SELL'
  return undefined
}

export function detectTargetDirection(title: string): TargetDirection {
  const src = title || ''
  if (/목표(?:가|주가).{0,8}(상향|올려|인상)/.test(src)) return 'up'
  if (/목표(?:가|주가).{0,8}(하향|내려|인하)/.test(src)) return 'down'
  if (/유지|동결|maintain/i.test(src)) return 'maintain'
  return 'unknown'
}
