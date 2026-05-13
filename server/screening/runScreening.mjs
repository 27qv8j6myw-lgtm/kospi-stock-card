import { SECTORS } from './sectorMaster.mjs'
import { scoreSingleStock, fetchIndexScreeningContext } from './scoreStock.mjs'
import { inquireKospiReturn5D } from '../kisClient.mjs'
import { analyzeTopThree } from '../ai/screeningAnalysis.mjs'

let cachedResult = null
let cachedAt = 0
const CACHE_TTL_MS = 60 * 60 * 1000

/**
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 */
export async function runScreening(appKey, appSecret, env) {
  if (cachedResult && Date.now() - cachedAt < CACHE_TTL_MS) {
    return { ...cachedResult, source: 'cache' }
  }

  console.log('[Screening v2] Starting fresh analysis for 40 stocks')
  const startTime = Date.now()

  const [indexCtx, kospiReturn5D] = await Promise.all([
    fetchIndexScreeningContext(appKey, appSecret, env),
    inquireKospiReturn5D(appKey, appSecret, env).catch(() => 0),
  ])

  const jobs = SECTORS.flatMap((sector) =>
    sector.stockCodes.map((code) => ({ sector, code })),
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
  }

  const sectors = SECTORS.map((sector) => {
    const stocks = allResults
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
        name: s.name,
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

  const topFiveRaw = allResults
    .slice()
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 5)

  const topFive = topFiveRaw.map((s, idx) => ({
    rank: idx + 1,
    code: s.code,
    name: s.name,
    sectorLabel: s.sectorLabel,
    sectorId: s.sectorId,
    sectorIsLeading: leadingSectorIds.includes(s.sectorId),
    score: s.totalScore,
    expected1MPct: s.expected1MPct,
    subScores: {
      structure: Number(s.subScores?.structure) || 0,
      execution: Number(s.subScores?.execution) || 0,
      momentum: Number(s.subScores?.market) || 0,
      supplyDemand: Number(s.subScores?.supplyDemand) || 0,
    },
    per: s.per,
    consensusUpside: s.consensusUpside ?? 0,
    fiveYearAvgPer: s.fiveYearAvgPer,
  }))

  /** TOP 3만 Anthropic 호출 (TOP 5 중 상위 3) — 번들 캐시 1h와 동기 */
  let aiAnalyses = []
  try {
    const topThreeForAi = topFive.slice(0, 3).map((s) => ({
      code: s.code,
      name: s.name,
      sector: s.sectorLabel,
      score: s.score,
      subScores: {
        structure: s.subScores.structure,
        execution: s.subScores.execution,
        momentum: s.subScores.momentum,
        supplyDemand: s.subScores.supplyDemand,
      },
      per: s.per,
      consensusUpside: s.consensusUpside,
      fiveYearAvgPer: s.fiveYearAvgPer,
    }))
    aiAnalyses = await analyzeTopThree(topThreeForAi)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[Screening v2] AI 분석 실패:', msg)
  }

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1)

  const result = {
    generatedAt: new Date().toISOString(),
    elapsedSec,
    headlineSub: '룰 기반 점수 · 40종목',
    sectors,
    topFive,
    aiAnalyses,
    analysesByCode: {},
    source: 'fresh',
  }

  cachedResult = result
  cachedAt = Date.now()
  console.log(`[Screening v2] Completed in ${elapsedSec}s`)
  return result
}
