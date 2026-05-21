import {
  collectMarketData,
  fetchRealtimePrices,
  getKisCredentials,
  mergeRealtimeIntoScreeningBundle,
} from '../lib/marketDataCollector.mjs'
import { selectActiveSectors, requestAdditionalCandidates } from '../ai/sectorSelector.mjs'
import {
  selectTopFiveWithAnalysis,
  dedupeStocksByCode,
  normalizeCandidateLabel,
} from '../ai/screeningAnalysis.mjs'
import { getUserModel, resolveModelId } from '../lib/userModel.mjs'
import { analyzeKeyCandidates, collectInterestCandidates } from '../ai/candidateAnalysis.mjs'
import {
  getCachedAutoScreening,
  makeAutoScreeningCacheKey,
  setCachedAutoScreening,
} from '../lib/screeningCache.mjs'
import { getStockMasterByCode } from '../lib/stocksMasterSearch.mjs'
import { enrichWithConsensus } from './enrichWithConsensus.mjs'
import { scoreSingleStock, fetchIndexScreeningContext } from './scoreStock.mjs'
import { inquireKospiReturn5D } from '../kisClient.mjs'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** @param {string} msg @param {number} [start] */
function logStep(msg, start) {
  const tail = start != null ? ` (+${Date.now() - start}ms)` : ''
  console.log(`[Screening] [${new Date().toISOString()}] ${msg}${tail}`)
}

/**
 * @param {string} name
 * @param {string} code
 */
function hasValidStockName(name, code) {
  const n = String(name ?? '').trim()
  const c = String(code).replace(/\D/g, '').padStart(6, '0')
  if (!n) return false
  if (n === c) return false
  if (/^\d{6}$/.test(n.replace(/\s/g, ''))) return false
  return true
}

/**
 * @param {string} label
 */
function candidateLabelToGrade(label) {
  if (label === '관심후보') return 'A'
  if (label === '주의') return 'C'
  return 'B'
}

/**
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 * @param {string} code
 * @param {unknown} indexCtx
 * @param {number} kospiReturn5D
 * @param {string} sectorName
 */
async function scoreCandidateFromMaster(appKey, appSecret, env, code, indexCtx, kospiReturn5D, sectorName) {
  const c6 = String(code).replace(/\D/g, '').padStart(6, '0')
  if (!/^\d{6}$/.test(c6)) return null

  const master = await getStockMasterByCode(c6)
  if (!master.ok || !master.item?.name) {
    console.warn(`[Screening] ${c6} stocks_master 에 없음 - 제외`)
    return null
  }
  if (!hasValidStockName(master.item.name, c6)) {
    console.warn(`[Screening] ${c6} 유효한 종목명 없음 - 제외`)
    return null
  }

  try {
    const r = await scoreSingleStock(appKey, appSecret, env, c6, indexCtx)
    return {
      code: r.code,
      name: String(master.item.name).trim(),
      market: master.item.market ?? '—',
      sector: sectorName,
      score: r.totalScore,
      totalScore: r.totalScore,
      subScores: {
        structure: Number(r.subScores?.structure) || 0,
        execution: Number(r.subScores?.execution) || 0,
        momentum: Number(r.subScores?.market) || 0,
        supplyDemand: Number(r.subScores?.supplyDemand) || 0,
      },
      per: Number(r.per) || 0,
      fiveYearAvgPer: r.fiveYearAvgPer ?? null,
      operatingMargin: Number(r.operatingMargin) || 0,
      consensusUpside: null,
      currentPrice: Number(r.currentPrice) || 0,
      return5D: Number(r.sectorReturn5D) || 0,
      expected1MPct: Number(r.expected1MPct) || 0,
      kospiReturn5D: Number(kospiReturn5D) || 0,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`[Screening] ${c6} 처리 실패:`, msg)
    return null
  }
}

/**
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 * @param {string[]} codes
 * @param {string} sectorName
 */
async function buildValidCandidates(appKey, appSecret, env, codes, sectorName) {
  const [indexCtx, kospiReturn5D] = await Promise.all([
    fetchIndexScreeningContext(appKey, appSecret, env),
    inquireKospiReturn5D(appKey, appSecret, env).catch(() => 0),
  ])

  const unique = [...new Set(codes.map((c) => String(c).replace(/\D/g, '').padStart(6, '0')))].filter(
    (c) => /^\d{6}$/.test(c),
  )

  const rows = []
  for (const code of unique) {
    const row = await scoreCandidateFromMaster(
      appKey,
      appSecret,
      env,
      code,
      indexCtx,
      kospiReturn5D,
      sectorName,
    )
    if (row) rows.push(row)
    await sleep(100)
  }

  return enrichWithConsensus(rows.sort((a, b) => b.score - a.score).slice(0, 15))
}

/**
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 * @param {Array<Record<string, unknown>>} validCandidates
 * @param {string} sectorName
 * @param {string} [modelId]
 */
async function backfillCandidates(appKey, appSecret, env, validCandidates, sectorName, modelId) {
  if (validCandidates.length >= 5) return validCandidates

  console.log(
    `[Screening] ${sectorName} 후보 부족 (${validCandidates.length}/5) - 추가 요청`,
  )

  const needed = 5 - validCandidates.length + 3
  const additionalCodes = await requestAdditionalCandidates({
    sectorName,
    existing: validCandidates.map((c) => String(c.code)),
    needed,
    modelId,
  })

  const existingSet = new Set(
    validCandidates.map((c) => String(c.code).replace(/\D/g, '').padStart(6, '0')),
  )

  for (const code of additionalCodes) {
    if (validCandidates.length >= 8) break
    const c6 = String(code).replace(/\D/g, '').padStart(6, '0')
    if (existingSet.has(c6)) continue

    const more = await buildValidCandidates(appKey, appSecret, env, [c6], sectorName)
    for (const row of more) {
      const k = String(row.code).replace(/\D/g, '').padStart(6, '0')
      if (existingSet.has(k)) continue
      existingSet.add(k)
      validCandidates.push(row)
      if (validCandidates.length >= 8) break
    }
  }

  return validCandidates.sort((a, b) => b.score - a.score)
}

/**
 * @param {Array<Record<string, unknown>>} validCandidates
 * @param {Array<Record<string, unknown>>} aiItems
 * @param {string} sectorName
 */
function buildStocksFromAnalysis(validCandidates, aiItems, sectorName) {
  const allowed = new Set(
    validCandidates.map((c) => String(c.code).replace(/\D/g, '').padStart(6, '0')),
  )

  let stocks = (aiItems || [])
    .map((it) => {
      const code = String(it.code).replace(/\D/g, '').padStart(6, '0')
      if (!allowed.has(code)) return null
      const base = validCandidates.find(
        (c) => String(c.code).replace(/\D/g, '').padStart(6, '0') === code,
      )
      const name = base?.name ? String(base.name).trim() : ''
      if (!hasValidStockName(name, code)) return null

      const label =
        normalizeCandidateLabel(it.candidateLabel) ||
        normalizeCandidateLabel(it.action) ||
        '관망검토'
      const gradeFromAi = String(it.grade ?? '').trim()
      return {
        code,
        name,
        grade: gradeFromAi || candidateLabelToGrade(label),
        action: label,
        candidateLabel: label,
        changePct: 0,
        currentPrice: null,
        headline: String(it.headline ?? '').trim(),
        summary: String(it.summary ?? '').trim(),
        keyDriver: String(it.keyDriver ?? '').trim(),
        risk: String(it.risk ?? '').trim(),
        rank: Number(it.rank) || 99,
        score: Number(base?.score) || 0,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank)

  if (stocks.length < 5 && validCandidates.length >= 5) {
    console.warn(`[Screening] ${sectorName} AI 가 ${stocks.length}개만 반환 - 자동 보충`)
    const usedCodes = new Set(stocks.map((s) => s.code))
    const fill = validCandidates
      .filter((c) => !usedCodes.has(String(c.code).replace(/\D/g, '').padStart(6, '0')))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5 - stocks.length)
      .map((c, i) => ({
        code: String(c.code).replace(/\D/g, '').padStart(6, '0'),
        name: String(c.name).trim(),
        grade: 'B',
        action: '관망검토',
        changePct: 0,
        currentPrice: null,
        headline: '룰 상위 후보',
        summary: '',
        rank: stocks.length + i + 1,
        score: Number(c.score) || 0,
      }))
      .filter((s) => hasValidStockName(s.name, s.code))

    stocks = [...stocks, ...fill]
  }

  return dedupeStocksByCode(stocks)
    .slice(0, 5)
    .map((s, idx) => ({ ...s, rank: idx + 1 }))
}

/**
 * @param {{ rank: number, name: string, flow: string, reason: string, candidateCodes: string[] }} sector
 * @param {string | null | undefined} userId
 * @param {string} modelId
 */
async function analyzeSector(sector, userId, modelId) {
  const creds = getKisCredentials()
  if (!creds) throw new Error('KIS credentials missing')

  const candidateCodes = [
    ...new Set(
      (sector.candidateCodes || []).map((c) =>
        String(c).replace(/\D/g, '').padStart(6, '0'),
      ),
    ),
  ].filter((c) => /^\d{6}$/.test(c))

  let validCandidates = await buildValidCandidates(
    creds.appKey,
    creds.appSecret,
    creds.env,
    candidateCodes,
    sector.name,
  )

  validCandidates = await backfillCandidates(
    creds.appKey,
    creds.appSecret,
    creds.env,
    validCandidates,
    sector.name,
    modelId,
  )

  if (validCandidates.length === 0) {
    return { ...sector, stocks: [], error: '후보 종목 없음' }
  }

  const aiPack = await selectTopFiveWithAnalysis(validCandidates, userId, {})

  const stocks = buildStocksFromAnalysis(validCandidates, aiPack.items, sector.name)

  return {
    rank: sector.rank,
    name: sector.name,
    flow: sector.flow,
    reason: sector.reason,
    stocks,
    screeningAiModel: aiPack.anthropicModel,
  }
}

/**
 * AI 동적 섹터 스크리닝 번들.
 * @param {{ force?: boolean, userId?: string | null }} opts
 */
export async function runAutoScreening(opts = {}) {
  const force = Boolean(opts.force)
  const userId = opts.userId ?? null
  if (!userId) {
    throw new Error('로그인이 필요합니다')
  }
  const userModel = await getUserModel(userId)
  const modelId = resolveModelId(userModel)
  const cacheKey = makeAutoScreeningCacheKey(userModel)

  if (!force) {
    const cached = await getCachedAutoScreening(cacheKey)
    if (cached) {
      const interestN = collectInterestCandidates(cached.sectors || []).length
      const keyN = Array.isArray(cached.keyAnalyses) ? cached.keyAnalyses.length : 0
      if (interestN === 0 || keyN > 0) {
        return { ...cached, source: 'cache', screeningCacheKey: cacheKey }
      }
      logStep(`캐시 HIT 이지만 관심후보 상세 없음 (${interestN}종목) — 재분석`)
    }
  }

  const start = Date.now()
  logStep('새 분석 시작')

  logStep('시장 데이터 시작', start)
  const marketData = await collectMarketData()
  logStep(
    `시장 데이터 완료 (거래대금 ${marketData.topVolume.length}, 모멘텀 ${marketData.topMomentum.length}, 외국인 ${marketData.topForeign.length})`,
    start,
  )

  logStep('섹터 선정 시작', start)
  const { marketSummary, sectors } = await selectActiveSectors(marketData, { modelId })
  logStep(`섹터 선정 완료 (${sectors.length}개: ${sectors.map((s) => s.name).join(', ')})`, start)

  logStep(`종목 분석 시작 (병렬 ${sectors.length}개 섹터)`, start)
  const sectorsWithStocks = await Promise.all(
    sectors.map(async (sector) => {
      try {
        const row = await analyzeSector(sector, userId, modelId)
        logStep(`섹터 완료: ${sector.name} (${(row.stocks || []).length}종목)`, start)
        return row
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`[Screening] ${sector.name} 분석 실패:`, msg)
        return { ...sector, stocks: [], error: msg }
      }
    }),
  )
  logStep('종목 분석 완료', start)

  logStep('관심후보 상세 분석 시작', start)
  const keyAnalyses = await analyzeKeyCandidates(sectorsWithStocks, { userId, modelId })
  logStep(`관심후보 상세 완료 (${keyAnalyses.length}건)`, start)

  const allCodes = new Set()
  for (const sector of sectorsWithStocks) {
    for (const stock of sector.stocks || []) {
      if (stock?.code) allCodes.add(String(stock.code).replace(/\D/g, '').padStart(6, '0'))
    }
  }
  for (const a of keyAnalyses) {
    if (a?.code) allCodes.add(String(a.code).replace(/\D/g, '').padStart(6, '0'))
  }

  logStep(`실시간 시세 조회 시작 (${allCodes.size}종목)`, start)
  const priceMap = await fetchRealtimePrices([...allCodes])
  logStep('실시간 시세 조회 완료', start)

  const bundleDraft = { sectors: sectorsWithStocks, keyAnalyses }
  mergeRealtimeIntoScreeningBundle(bundleDraft, priceMap)

  const elapsedSec = ((Date.now() - start) / 1000).toFixed(1)
  const generatedAt = new Date().toISOString()

  /** @type {Array<{ code: string, aiCandidateLabel?: string }>} */
  const topFiveFlat = sectorsWithStocks.flatMap((s) =>
    (s.stocks || []).slice(0, 2).map((st) => ({
      code: st.code,
      aiCandidateLabel: st.action,
    })),
  )

  const result = {
    marketSummary,
    model: userModel,
    aiModel: modelId,
    sectors: sectorsWithStocks,
    keyAnalyses,
    topFive: topFiveFlat.slice(0, 5),
    cached: false,
    cachedAt: null,
    generatedAt,
    elapsedSec,
    source: 'fresh',
    screeningCacheKey: cacheKey,
  }

  void setCachedAutoScreening(cacheKey, {
    marketSummary: result.marketSummary,
    model: result.model,
    sectors: result.sectors,
    keyAnalyses: result.keyAnalyses,
    topFive: result.topFive,
    generatedAt: result.generatedAt,
    elapsedSec: result.elapsedSec,
  }).catch(() => {})

  logStep(`전체 완료 ${elapsedSec}s`, start)
  return result
}
