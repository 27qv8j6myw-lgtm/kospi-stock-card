/** Pro 종목카드 전용 디자인 클래스 */
export const proDesign = {
  /** 종목카드·검색창 공통 가로 정렬 (max-width + padding) */
  contentWrap: 'mx-auto w-full max-w-[1200px] px-3 sm:px-4',
  page: 'mx-auto w-full max-w-[1200px] px-3 py-4 sm:px-4',
  card: 'overflow-hidden rounded-2xl border border-gray-200 bg-white',
  section: 'border-b border-gray-100 px-5 py-4 last:border-b-0',
  whiteBox: 'rounded-md border border-gray-200 bg-white p-3',
  whiteBoxSm: 'rounded-md border border-gray-200 bg-white p-2.5 hover:border-gray-300',
  proBadge: 'rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-900',
  stickyBar: 'safe-top sticky top-0 z-30 border-b border-gray-200 bg-white',
  sectionTitle: 'text-[16px] font-bold text-gray-900',
  sectionMeta: 'text-[12px] text-gray-500',
  dataLabel: 'text-[12px] text-gray-500',
  dataValue: 'text-[12px] font-bold text-gray-900 tabular-nums',
} as const

export const PRO_ICON = { size: 20, strokeWidth: 1.8 } as const

export function getNewsSource(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function formatNewsDate(pubDate?: string): string {
  if (!pubDate) return '—'
  try {
    return new Date(pubDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
  } catch {
    return '—'
  }
}

export function newsSectionMeta(
  news: Array<{ pubDate?: string }>,
): string {
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000
  const recent = news.filter((n) => {
    if (!n.pubDate) return false
    const t = new Date(n.pubDate).getTime()
    return Number.isFinite(t) && t >= threeDaysAgo
  })
  const count = recent.length > 0 ? recent.length : news.length
  return `3일 · ${count}건`
}

export function investorDaysLabel(amount: number, buyDays: number, totalDays = 5): string {
  if (amount > 0 && buyDays > 0) return `${buyDays}일 연속 매수`
  if (amount < 0) {
    const sellDays = Math.max(1, totalDays - buyDays)
    return `${sellDays}일 연속 매도`
  }
  return '5일 누적 중립'
}

type StrategyInput = {
  quote?: { currentPrice?: number }
  analyst?: { targetPrice?: number }
  week52?: { low52w?: number }
}

export function deriveTradingStrategy(summary: StrategyInput): {
  entry: number
  target: number
  stop: number
} | null {
  const price = summary.quote?.currentPrice
  if (price == null || !Number.isFinite(price)) return null

  const target =
    summary.analyst?.targetPrice != null && Number.isFinite(summary.analyst.targetPrice)
      ? Math.round(summary.analyst.targetPrice)
      : Math.round(price * 1.08)

  const low52 = summary.week52?.low52w
  const stop =
    low52 != null && low52 < price
      ? Math.round(low52 * 0.98)
      : Math.round(price * 0.95)

  return {
    entry: Math.round(price),
    target,
    stop,
  }
}
