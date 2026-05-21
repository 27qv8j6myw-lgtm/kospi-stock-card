function parseNumberText(v) {
  if (v == null) return null
  const n = Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

/** FnGuide 컨센서스 JSON — 증권사별 목표가(TARGET_PRC) + 평균(AVG_PRC) */
async function fetchFnGuideConsensus(code6) {
  const code = String(code6).replace(/\D/g, '').padStart(6, '0')
  const gicode = `A${code}`
  const url = `https://comp.fnguide.com/SVO2/json/data/01_06/03_${gicode}.json`
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; kospi-stock-card)',
      accept: 'application/json,text/plain,*/*',
      referer: `https://comp.fnguide.com/SVO2/ASP/SVD_Consensus.asp?pGB=1&gicode=${gicode}`,
    },
  })
  if (!res.ok) return null
  let data
  try {
    const raw = await res.text()
    data = JSON.parse(raw.replace(/^\uFEFF/, ''))
  } catch {
    return null
  }
  const comp = Array.isArray(data?.comp) ? data.comp : []
  if (!comp.length) return null

  const brokerTargets = []
  for (const row of comp) {
    const t = parseNumberText(row.TARGET_PRC)
    if (t != null && t > 0) brokerTargets.push(t)
  }
  if (!brokerTargets.length) return null

  const avgFromConsensus = parseNumberText(comp[0].AVG_PRC)
  const avgTargetPrice =
    avgFromConsensus != null && avgFromConsensus > 0
      ? avgFromConsensus
      : Math.round(brokerTargets.reduce((a, b) => a + b, 0) / brokerTargets.length)
  const maxTargetPrice = Math.max(...brokerTargets)
  const minTargetPrice = Math.min(...brokerTargets)
  const safeMax = Math.max(maxTargetPrice, avgTargetPrice)

  return {
    source: 'fnguide',
    avgTargetPrice,
    maxTargetPrice: safeMax,
    minTargetPrice: Math.min(minTargetPrice, avgTargetPrice),
    analystCount: comp.length,
  }
}

async function fetchNaverConsensus(code6) {
  const code = String(code6).replace(/\D/g, '').padStart(6, '0')
  const url = `https://finance.naver.com/item/main.naver?code=${code}`
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0',
      accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!res.ok) return null
  const html = await res.text()
  const table = html.match(/<table[^>]*summary="투자의견 정보"[\s\S]*?<\/table>/)?.[0] ?? ''
  if (!table) return null
  const recommendationText =
    table.match(/<span class="f_(?:up|down|eq)"><em>[\d.]+<\/em>\s*([^<\s]+)/)?.[1] ?? null
  const targetPrice = parseNumberText(table.match(/<span class="bar">l<\/span>\s*<em>([\d,]+)<\/em>/)?.[1])
  if (!targetPrice || targetPrice <= 0) return null
  return {
    source: 'naver-finance',
    avgTargetPrice: targetPrice,
    maxTargetPrice: targetPrice,
    minTargetPrice: targetPrice,
    recommendationText,
    analystCount: null,
  }
}

/** FnGuide 우선(다증권), 실패 시 네이버 단일 목표가 */
export async function fetchConsensusDetails(code6) {
  const code = String(code6).replace(/\D/g, '').padStart(6, '0')
  const [fg, nv] = await Promise.all([
    fetchFnGuideConsensus(code).catch(() => null),
    fetchNaverConsensus(code).catch(() => null),
  ])
  if (fg) return fg
  if (nv) return nv
  return null
}

