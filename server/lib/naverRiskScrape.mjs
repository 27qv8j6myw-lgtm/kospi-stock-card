function parseNumberText(v) {
  if (v == null) return null
  const n = Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

/**
 * 네이버 금융 종목메인 — 공매도·신용 (KIS 실패 시 폴백)
 * @param {string} code6
 * @returns {Promise<{ shortRatio: number | null, marginRatio: number | null }>}
 */
export async function fetchNaverShortAndCredit(code6) {
  const code = String(code6).replace(/\D/g, '').padStart(6, '0')
  const url = `https://finance.naver.com/item/main.naver?code=${code}`
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; kospi-stock-card)',
        accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) return { shortRatio: null, marginRatio: null }
    const html = await res.text()

    let shortRatio = null
    const shortBlock = html.match(/공매도[\s\S]{0,400}?<\/tr>/i)?.[0] ?? ''
    const shortPct = shortBlock.match(/([\d.]+)\s*%/)
    if (shortPct) shortRatio = parseNumberText(shortPct[1])

    let marginRatio = null
    const creditBlock = html.match(/신용[\s\S]{0,500}?<\/tr>/i)?.[0] ?? ''
    const creditPct = creditBlock.match(/([\d.]+)\s*%/)
    if (creditPct) marginRatio = parseNumberText(creditPct[1])

    return { shortRatio, marginRatio }
  } catch {
    return { shortRatio: null, marginRatio: null }
  }
}
