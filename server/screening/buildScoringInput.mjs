import { inquireDomesticPrice, inquireInvestorByStock, inquireDailyBars } from '../kisClient.mjs'

/**
 * 스크리닝 점수용 입력 조합 (KIS 3종 + 시세 내 펀더멘털).
 * @param {string} appKey
 * @param {string} appSecret
 * @param {string} env
 * @param {string} code6
 * @param {{ dailyBars?: number }} [opts]
 */
export async function buildScoringInput(appKey, appSecret, env, code6, opts = {}) {
  const dailyBars = opts.dailyBars ?? 66
  const [basicInfo, dailyChart, investorTrading] = await Promise.all([
    inquireDomesticPrice(appKey, appSecret, env, code6),
    inquireDailyBars(appKey, appSecret, env, code6, dailyBars),
    inquireInvestorByStock(appKey, appSecret, env, code6),
  ])

  const fundamental = {
    per: basicInfo.per,
    pbr: basicInfo.pbr,
    eps: basicInfo.eps,
    bps: basicInfo.bps,
    roeTtmApprox: basicInfo.roeTtmApprox,
    operatingMarginTtm: basicInfo.operatingMarginTtm,
    debtRatio: basicInfo.debtRatio,
  }

  const raw = basicInfo.raw && typeof basicInfo.raw === 'object' ? basicInfo.raw : {}
  const nameFromApi =
    basicInfo.nameKr ||
    raw.hts_kor_isnm ||
    raw.hts_kor_isnm1 ||
    raw.prdt_name ||
    basicInfo.code

  return {
    basicInfo: {
      ...basicInfo,
      stockCode: basicInfo.code,
      stockName: nameFromApi,
    },
    dailyChart,
    investorTrading,
    fundamental,
  }
}
