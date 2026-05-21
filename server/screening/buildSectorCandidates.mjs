import {
  SECTORS,
  filterSectorWhitelistRows,
  resolveScreeningStockDisplayName,
} from './sectorMaster.mjs'
import { getSectorDefinition } from '../lib/sectorDefinitions.mjs'
import { getStockMasterByCode } from '../lib/stocksMasterSearch.mjs'
import { scoreSingleStock, fetchIndexScreeningContext } from './scoreStock.mjs'
import { inquireKospiReturn5D } from '../kisClient.mjs'
import { enrichWithConsensus } from './enrichWithConsensus.mjs'
import { getAIAdditionalCandidates } from '../ai/screeningAnalysis.mjs'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 섹터 id 또는 한글 label 로 섹터를 찾는다.
 * @param {string} sectorKey
 */
function resolveSector(sectorKey) {
  const raw = String(sectorKey || '').trim()
  if (!raw) return null
  const def = getSectorDefinition(raw)
  if (def) {
    return SECTORS.find((s) => s.id === def.id) || null
  }
  return (
    SECTORS.find((s) => s.id === raw) ||
    SECTORS.find((s) => s.label === raw) ||
    SECTORS.find((s) => s.label.replace(/\s/g, '') === raw.replace(/\s/g, '')) ||
    null
  )
}

/**
 * @param {import('../lib/sectorDefinitions.mjs').SectorDefinition} definition
 * @param {string[]} additionalCodes
 */
function mergeUniqueCodes(definition, additionalCodes) {
  const seen = new Set()
  const out = []
  for (const code of [...definition.coreCodes, ...additionalCodes]) {
    const c = String(code).replace(/\D/g, '').padStart(6, '0')
    if (!/^\d{6}$/.test(c) || seen.has(c)) continue
    seen.add(c)
    out.push(c)
  }
  return out
}

/**
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 * @param {string} code
 * @param {{ id: string, label: string }} sector
 * @param {unknown} indexCtx
 * @param {number} kospiReturn5D
 * @param {'core'|'ai_added'} source
 */
async function scoreCodeForSector(appKey, appSecret, env, code, sector, indexCtx, kospiReturn5D, source) {
  const r = await scoreSingleStock(appKey, appSecret, env, code, indexCtx)
  return {
    code: r.code,
    name: resolveScreeningStockDisplayName(r.code, r.name, sector.label),
    sector: sector.label,
    sectorId: sector.id,
    score: r.totalScore,
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
    source,
  }
}

/**
 * 하이브리드: 코어 종목 보장 + AI 추가 후보 → 룰 점수·컨센 병합.
 * @param {string} appKey
 * @param {string} appSecret
 * @param {'prod'|'vps'} env
 * @param {string} sectorKey — `SECTORS[].id` 또는 `label`
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function buildSectorCandidates(appKey, appSecret, env, sectorKey) {
  const sector = resolveSector(sectorKey)
  if (!sector) {
    throw new Error(`알 수 없는 sector: ${sectorKey}`)
  }

  const definition = getSectorDefinition(sector)
  if (!definition) {
    throw new Error(`섹터 정의 없음: ${sectorKey}`)
  }

  const [indexCtx, kospiReturn5D] = await Promise.all([
    fetchIndexScreeningContext(appKey, appSecret, env),
    inquireKospiReturn5D(appKey, appSecret, env).catch(() => 0),
  ])

  let additionalCodes = []
  try {
    additionalCodes = await getAIAdditionalCandidates({
      sector: definition.label,
      description: definition.description,
      excludeCodes: definition.coreCodes,
      aiPromptHint: definition.aiPromptHint,
      excludeKeywords: definition.excludeKeywords,
      targetCount: 10,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`[buildSectorCandidates] AI 추가 후보 실패 (${definition.label}):`, msg)
  }

  const coreSet = new Set(definition.coreCodes.map((c) => String(c).replace(/\D/g, '').padStart(6, '0')))
  const allCodes = mergeUniqueCodes(definition, additionalCodes)
  const aiOnlyCount = allCodes.filter((c) => !coreSet.has(c)).length

  console.log(
    `[Screening] ${definition.label} 코어 ${definition.coreCodes.length}개 + AI 추가 ${aiOnlyCount}개 = 후보 ${allCodes.length}개`,
  )

  const all = []
  for (const code of allCodes) {
    const c6 = String(code).replace(/\D/g, '').padStart(6, '0')
    const source = coreSet.has(c6) ? 'core' : 'ai_added'
    try {
      const row = await scoreCodeForSector(
        appKey,
        appSecret,
        env,
        code,
        sector,
        indexCtx,
        kospiReturn5D,
        source,
      )
      const master = await getStockMasterByCode(code)
      if (master.ok && master.item?.name) {
        row.name = resolveScreeningStockDisplayName(code, master.item.name, sector.label)
      }
      all.push(row)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[buildSectorCandidates] ${code}`, msg)
    }
    await sleep(120)
  }

  const candidatesRaw = all
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)

  const enriched = await enrichWithConsensus(candidatesRaw)
  return filterSectorWhitelistRows(enriched, definition.id)
}
