import { fetchConsensusDetails } from '../consensusDetails.mjs'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 상위 후보에 컨센서스 목표가·상승여력 병합 (순차 + 짧은 딜레이).
 * @param {Array<Record<string, unknown>>} candidates
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function enrichWithConsensus(candidates) {
  const out = []
  for (const c of candidates) {
    try {
      const consensus = await fetchConsensusDetails(c.code)
      const avg = consensus?.avgTargetPrice
      const upside =
        avg != null && Number.isFinite(Number(avg)) && Number(c.currentPrice) > 0
          ? ((Number(avg) / Number(c.currentPrice)) - 1) * 100
          : null
      out.push({
        ...c,
        consensusAvg: avg ?? null,
        consensusUpside: upside != null && Number.isFinite(upside) ? Math.round(upside * 10) / 10 : null,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[Screening v2] ${c.code} consensus failed:`, msg)
      out.push({ ...c, consensusAvg: null, consensusUpside: null })
    }
    await sleep(100)
  }
  return out
}
