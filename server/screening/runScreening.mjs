import {
  ALL_STOCK_CODES,
  SECTORS,
  filterSectorWhitelistRows,
  getSectorStockCodes,
  resolveScreeningStockDisplayName,
  sanitizePowerEquipmentInBundle,
} from './sectorMaster.mjs'
import { scoreSingleStock, fetchIndexScreeningContext } from './scoreStock.mjs'
import { inquireKospiReturn5D } from '../kisClient.mjs'
import { selectTopFiveWithAnalysis } from '../ai/screeningAnalysis.mjs'
import { getUserModel, resolveModelId } from '../lib/userModel.mjs'
import { getCachedScreening, setCachedScreening, makeCacheKey } from '../lib/screeningCache.mjs'
import { enrichWithConsensus } from './enrichWithConsensus.mjs'

/** @type {Map<string, { result: object, at: number }>} */
const screeningRunCache = new Map()
const CACHE_TTL_MS = 60 * 60 * 1000

/**
 * @param {string | null | undefined} userId
 * @param {boolean} [skipTopFiveAi]
 */
async function screeningCacheScopeKey(userId, skipTopFiveAi = false) {
  const hourKey = Math.floor(Date.now() / CACHE_TTL_MS)
  const um = await getUserModel(userId)
  const id = resolveModelId(um).replace(/[^a-z0-9._-]/gi, '')
  const uidKey = userId ? String(userId) : 'anon'
  const aiTag = skipTopFiveAi ? 'noai' : 'full'
  return `top5-${uidKey}-${um}-${id}-${aiTag}-${hourKey}`
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 * @param {string | null | undefined} userId — Bearer 로 식별된 사용자 (없으면 sonnet 기준 공유 캐시 키 `anon`)
 * @param {{ skipTopFiveAi?: boolean, force?: boolean }} [opts] — AI 비활성 사용자: Anthropic TOP5 생략(룰 기반 TOP5만); force 시 캐시 무시
 */
export async function runScreening(appKey, appSecret, env, userId = null, opts = {}) {
  const skipTopFiveAi = Boolean(opts.skipTopFiveAi)
  const force = Boolean(opts.force)

  if (skipTopFiveAi) {
    const scopeKey = await screeningCacheScopeKey(userId, true)
    const hit = screeningRunCache.get(scopeKey)
    if (hit && Date.now() - hit.at < CACHE_TTL_MS && !force) {
      return sanitizePowerEquipmentInBundle({
        ...hit.result,
        source: 'cache',
        screeningCacheKey: scopeKey,
        cached: true,
        cachedAt: typeof hit.result?.generatedAt === 'string' ? hit.result.generatedAt : null,
      })
    }
  }

  const userModel = await getUserModel(userId)
  if (!skipTopFiveAi && !force) {
    const hitDb = await getCachedScreening('global', userModel)
    if (hitDb) {
      return sanitizePowerEquipmentInBundle({
        ...hitDb,
        screeningUserModel: hitDb.screeningUserModel ?? userModel,
        screeningAiModel: hitDb.screeningAiModel ?? resolveModelId(userModel),
        source: 'cache',
        cached: true,
        cachedAt: hitDb.cachedAt ?? hitDb.generatedAt ?? null,
        screeningCacheKey: makeCacheKey('global', userModel),
      })
    }
  }

  let memScopeKey = null
  if (skipTopFiveAi) {
    memScopeKey = await screeningCacheScopeKey(userId, true)
  }

  const coreJobCount = SECTORS.reduce((n, s) => n + getSectorStockCodes(s).length, 0)
  console.log(`[Screening v2] Starting fresh analysis for ${coreJobCount} core stocks`)
  const startTime = Date.now()

  const [indexCtx, kospiReturn5D] = await Promise.all([
    fetchIndexScreeningContext(appKey, appSecret, env),
    inquireKospiReturn5D(appKey, appSecret, env).catch(() => 0),
  ])

  const jobs = SECTORS.flatMap((sector) =>
    getSectorStockCodes(sector).map((code) => ({ sector, code })),
  )

  const CONCURRENCY = 5
  const allResults = []
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const slice = jobs.slice(i, i + CONCURRENCY)
    const batch = await Promise.all(
      slice.map(async ({ sector, code }) => {
        try {
          const r = await scoreSingleStock(appKey, appSecret, env, code, indexCtx)
          return {
            ...r,
            sectorId: sector.id,
            sectorLabel: sector.label,
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          console.error(`[Screening v2] ${code} failed:`, msg)
          return null
        }
      }),
    )
    allResults.push(...batch.filter(Boolean))
    await sleep(250)
  }

  const sectors = SECTORS.map((sector) => {
    const stocks = filterSectorWhitelistRows(allResults)
      .filter((r) => r.sectorId === sector.id)
      .sort((a, b) => b.totalScore - a.totalScore)

    const avgScore =
      stocks.length > 0 ? Math.round(stocks.reduce((sum, x) => sum + x.totalScore, 0) / stocks.length) : 0

    const sectorReturn5D =
      stocks.length > 0
        ? stocks.reduce((s, x) => s + (Number(x.sectorReturn5D) || 0), 0) / stocks.length
        : 0

    return {
      id: sector.id,
      label: sector.label,
      icon: sector.icon,
      tone: sector.tone,
      avgScore,
      sectorReturn5D: Math.round(sectorReturn5D * 10) / 10,
      kospiReturn5D: Math.round(Number(kospiReturn5D) * 10) / 10,
      isLeading: false,
      topStocks: stocks.slice(0, 3).map((s) => ({
        code: s.code,
        name: resolveScreeningStockDisplayName(s.code, s.name, sector.label),
        score: s.totalScore,
      })),
    }
  })

  const leadingSectorIds = sectors
    .filter((s) => s.avgScore >= 75)
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 2)
    .map((s) => s.id)

  for (const s of sectors) {
    s.isLeading = leadingSectorIds.includes(s.id)
  }

  console.log(`[Screening v2] 1단계: ${allResults.length}종목 룰 점수`)
  const candidatesRaw = filterSectorWhitelistRows(allResults)
    .slice()
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 15)
    .map((s) => ({
      code: s.code,
      name: resolveScreeningStockDisplayName(s.code, s.name, s.sectorLabel),
      sector: s.sectorLabel,
      sectorId: s.sectorId,
      score: s.totalScore,
      subScores: {
        structure: Number(s.subScores?.structure) || 0,
        execution: Number(s.subScores?.execution) || 0,
        momentum: Number(s.subScores?.market) || 0,
        supplyDemand: Number(s.subScores?.supplyDemand) || 0,
      },
      per: Number(s.per) || 0,
      fiveYearAvgPer: s.fiveYearAvgPer ?? null,
      operatingMargin: Number(s.operatingMargin) || 0,
      consensusUpside: null,
      currentPrice: Number(s.currentPrice) || 0,
      return5D: Number(s.sectorReturn5D) || 0,
      expected1MPct: Number(s.expected1MPct) || 0,
    }))

  console.log('[Screening v2] 2단계: 상위 15개 컨센서스 호출')
  const candidates = await enrichWithConsensus(candidatesRaw)

  let aiTopFive = []
  let screeningAiModel = resolveModelId('sonnet')
  let screeningUserModel = 'sonnet'
  if (!skipTopFiveAi) {
    try {
      console.log('[Screening v2] 3단계: AI TOP 5 선정')
      const aiPack = await selectTopFiveWithAnalysis(candidates, userId, {})
      aiTopFive = aiPack.items
      screeningAiModel = aiPack.anthropicModel
      screeningUserModel = aiPack.modelUsed
      console.log(`[Screening v2] AI selected ${aiTopFive.length} stocks`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[Screening v2] AI selection failed:', msg)
    }
  } else {
    console.log('[Screening v2] 3단계: AI TOP 5 생략 (ai_enabled=false)')
  }

  const merged = aiTopFive
    .map((ai) => {
      const c = candidates.find((x) => x.code === ai.code)
      if (!c) return null
      return {
        rank: Number.isFinite(Number(ai.rank)) ? Math.max(1, Math.round(Number(ai.rank))) : 99,
        code: c.code,
        name: resolveScreeningStockDisplayName(c.code, c.name, c.sector),
        sectorLabel: c.sector || '—',
        sectorId: c.sectorId,
        sectorIsLeading: leadingSectorIds.includes(c.sectorId),
        score: c.score,
        expected1MPct: c.expected1MPct,
        subScores: c.subScores,
        per: c.per,
        consensusUpside: c.consensusUpside,
        fiveYearAvgPer: c.fiveYearAvgPer ?? undefined,
        aiCandidateLabel: ai.candidateLabel,
        aiHeadline: ai.headline,
        aiSummary: ai.summary,
        aiKeyDriver: ai.keyDriver,
        aiRisk: ai.risk,
        aiSplitPrices: Array.isArray(ai.splitPrices) ? ai.splitPrices.slice(0, 3).map((n) => Math.round(Number(n) || 0)) : [],
        consensusEstimate: ai.consensusEstimate ?? null,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 5)
    .map((row, idx) => ({ ...row, rank: idx + 1 }))

  const topFive =
    merged.length > 0
      ? merged
      : candidates.slice(0, 5).map((c, idx) => ({
          rank: idx + 1,
          code: c.code,
          name: resolveScreeningStockDisplayName(c.code, c.name, c.sector),
          sectorLabel: c.sector || '—',
          sectorId: c.sectorId,
          sectorIsLeading: leadingSectorIds.includes(c.sectorId),
          score: c.score,
          expected1MPct: c.expected1MPct,
          subScores: c.subScores,
          per: c.per,
          consensusUpside: c.consensusUpside,
          fiveYearAvgPer: c.fiveYearAvgPer ?? undefined,
          aiCandidateLabel: '관망검토',
          aiHeadline: '룰 상위 후보',
          aiSummary: 'AI 응답 없음으로 룰 점수 상위 종목을 우선 표시.',
          aiKeyDriver: '',
          aiRisk: '',
          aiSplitPrices: [],
          consensusEstimate: null,
        }))

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1)

  const generatedAt = new Date().toISOString()
  const result = {
    generatedAt,
    elapsedSec,
    headlineSub: `룰 기반 점수 · 코어 ${ALL_STOCK_CODES.length}종목`,
    sectors,
    topFive,
    aiAnalyses: [],
    analysesByCode: {},
    source: 'fresh',
    screeningCacheKey: skipTopFiveAi ? memScopeKey : makeCacheKey('global', userModel),
    screeningAiModel,
    screeningUserModel,
    top15Codes: candidates.map((c) => c.code).join(','),
    cached: false,
    cachedAt: generatedAt,
  }

  if (skipTopFiveAi && memScopeKey) {
    screeningRunCache.set(memScopeKey, { result, at: Date.now() })
  } else if (!skipTopFiveAi) {
    const payload = sanitizePowerEquipmentInBundle({
      generatedAt: result.generatedAt,
      elapsedSec: result.elapsedSec,
      headlineSub: result.headlineSub,
      sectors: result.sectors,
      topFive: result.topFive,
      aiAnalyses: result.aiAnalyses,
      analysesByCode: result.analysesByCode,
      screeningAiModel: result.screeningAiModel,
      screeningUserModel: result.screeningUserModel,
      top15Codes: result.top15Codes,
    })
    void setCachedScreening('global', userModel, payload, userId).catch(() => {})
  }

  console.log(`[Screening v2] Completed in ${elapsedSec}s`)
  return sanitizePowerEquipmentInBundle(result)
}
