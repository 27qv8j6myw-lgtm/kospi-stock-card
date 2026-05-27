import { normalizeKisIscd } from './stockCode.mjs'
import { getStockMasterByCode } from './stocksMasterSearch.mjs'
import { screeningStockNameKr } from '../screening/sectorMaster.mjs'
import {
  fetchStockMetaFromKis,
  isValidStockDisplayName,
  lookupAndRegisterStock,
  registerStockMaster,
} from './stockMasterKisLookup.mjs'
import { resolveStockDisplayName } from './stockNameResolve.mjs'

export { isValidStockDisplayName } from './stockMasterKisLookup.mjs'

/**
 * stocks_master → KIS → 내장 스크리닝 맵 → 코드
 * @param {string} code
 * @returns {Promise<string>}
 */
export async function resolveStockName(code) {
  const code6 = normalizeKisIscd(code)

  const master = await getStockMasterByCode(code6)
  if (master.ok && master.item && isValidStockDisplayName(master.item.name, code6)) {
    return master.item.name
  }

  try {
    const meta = await fetchStockMetaFromKis(code6)
    if (meta) {
      await registerStockMaster(meta, 'Auto-register')
      return meta.name
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`[resolveStockName] KIS 실패 ${code6}:`, msg)
  }

  const external = await resolveStockDisplayName(code6, {})
  if (isValidStockDisplayName(external, code6)) {
    await registerStockMaster(
      { code: code6, name: external, market: 'KOSPI', sector: '—' },
      'Auto-register',
    )
    return external
  }

  const fromScreening = screeningStockNameKr(code6)
  if (isValidStockDisplayName(fromScreening, code6)) {
    await registerStockMaster(
      { code: code6, name: fromScreening, market: 'KOSPI', sector: '—' },
      'Auto-register',
    )
    return fromScreening
  }

  return code6
}
