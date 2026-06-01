import { createUserSupabaseFromRequest } from '../lib/auth.mjs'
import { isValidStockCode, normalizeKisIscd } from '../lib/stockCode.mjs'
import { runOpusWithTools } from '../lib/opusEngine.mjs'
import { buildProfileContextPrompt, fetchProUserProfile } from '../lib/proUserProfile.mjs'
import { getSupabaseService } from '../lib/supabaseService.mjs'
import { executeTool, getKisQuote } from '../lib/toolExecutor.mjs'

const PORTFOLIO_OPUS_SYSTEM = `당신은 한국 주식 단기 트레이딩(1~3개월) 전문 어시스턴트입니다.
포트폴리오 진단 시 각 보유 종목의 뉴스·공시·수급·섹터 동향을 반드시 제공된 도구로 직접 조회한 뒤 전체 관점에서 종합 판단합니다.
정중한 존댓말, 이모지 금지 (투자 프로필 있으면 맨 첫 줄 "📊 ○○형·○○ 관점 분석" 1줄만 예외). 가격·기간 범위는 하이픈(-) 대신 물결표(~) 사용.
변동률 부호는 +/- 그대로 표기합니다.`

/**
 * @param {unknown} raw
 */
function normalizeCode6(raw) {
  const code = normalizeKisIscd(raw)
  return isValidStockCode(code) && code !== '000000' ? code : ''
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} userSupabase
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseService
 * @param {string | null} userId
 */
export async function buildPortfolioAnalysis(userSupabase, supabaseService, userId) {
  const { data: holdings, error } = await userSupabase.from('pro_holdings').select('*')
  if (error) throw error
  if (!holdings?.length) {
    return { analysis: null }
  }

  const enriched = await Promise.all(
    holdings.map(async (h) => {
      const code = normalizeCode6(h.code)
      if (!code) return null

      try {
        const [quote, investorRaw] = await Promise.all([
          getKisQuote(code).catch(() => null),
          executeTool('getInvestorTrend', { code, days: 5 }, userId).catch(() => null),
        ])

        const investor =
          investorRaw && typeof investorRaw === 'object' && !('error' in investorRaw)
            ? investorRaw
            : null

        const quantity = Number(h.quantity) || 0
        const avgPrice = Number(h.avg_price) || 0
        const currentPrice = Number(quote?.currentPrice) || 0
        const evalAmount = currentPrice > 0 ? currentPrice * quantity : avgPrice * quantity
        const costAmount = avgPrice * quantity
        const profit = evalAmount - costAmount
        const profitPct = costAmount > 0 ? (profit / costAmount) * 100 : 0

        let sector = String(quote?.sector || '').trim() || null
        if (supabaseService) {
          const { data: master } = await supabaseService
            .from('stocks_master')
            .select('sector')
            .eq('code', code)
            .maybeSingle()
          const masterSector = String(master?.sector || '').trim()
          if (masterSector && masterSector !== '—') {
            sector = masterSector
          }
        }
        if (!sector) sector = '기타'

        const foreign5d = Number(investor?.foreign?.cumulativeNet) || 0
        const institution5d = Number(investor?.institute?.cumulativeNet) || 0

        return {
          code,
          name: String(h.name || '').trim() || quote?.name || code,
          sector,
          quantity,
          avgPrice,
          currentPrice,
          evalAmount,
          costAmount,
          profit,
          profitPct,
          foreign5d,
          institution5d,
        }
      } catch {
        return null
      }
    }),
  )

  const valid = enriched.filter(Boolean)
  if (!valid.length) {
    return { analysis: null }
  }

  const totalEval = valid.reduce((s, h) => s + h.evalAmount, 0)
  const totalCost = valid.reduce((s, h) => s + h.costAmount, 0)
  const totalProfit = totalEval - totalCost

  /** @type {Record<string, number>} */
  const sectorMap = {}
  for (const h of valid) {
    sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.evalAmount
  }

  const sectors = Object.entries(sectorMap)
    .map(([sector, amount]) => ({
      sector,
      amount,
      weight: totalEval > 0 ? (amount / totalEval) * 100 : 0,
    }))
    .sort((a, b) => b.weight - a.weight)

  const topSector = sectors[0]
  const concentration =
    topSector && topSector.weight > 40
      ? `${topSector.sector} 집중도 높음 (${topSector.weight.toFixed(0)}%)`
      : null

  const profitStocks = valid.filter((h) => h.profit > 0)
  const lossStocks = valid.filter((h) => h.profit < 0)

  /** @type {typeof valid[0] | null} */
  let maxProfit = null
  /** @type {typeof valid[0] | null} */
  let maxLoss = null
  for (const h of valid) {
    if (!maxProfit || h.profitPct > maxProfit.profitPct) maxProfit = h
    if (!maxLoss || h.profitPct < maxLoss.profitPct) maxLoss = h
  }

  const flowWarnings = valid
    .filter((h) => h.foreign5d < 0)
    .map((h) => ({
      name: h.name,
      code: h.code,
      type: '외국인 순매도',
      value: h.foreign5d,
    }))

  const flowPositive = valid
    .filter((h) => h.foreign5d > 0 || h.institution5d > 0)
    .map((h) => ({
      name: h.name,
      code: h.code,
      foreign: h.foreign5d,
      institution: h.institution5d,
    }))

  return {
    analysis: {
      summary: {
        totalEval,
        totalCost,
        totalProfit,
        totalProfitPct: totalCost > 0 ? (totalProfit / totalCost) * 100 : 0,
        count: valid.length,
      },
      sectors,
      concentration,
      profitComposition: {
        profitCount: profitStocks.length,
        lossCount: lossStocks.length,
        profitSum: profitStocks.reduce((s, h) => s + h.profit, 0),
        lossSum: lossStocks.reduce((s, h) => s + h.profit, 0),
        maxProfit: maxProfit
          ? { name: maxProfit.name, pct: maxProfit.profitPct }
          : null,
        maxLoss: maxLoss ? { name: maxLoss.name, pct: maxLoss.profitPct } : null,
      },
      flowWarnings,
      flowPositive,
      holdings: valid.map((h) => ({
        code: h.code,
        name: h.name,
        sector: h.sector,
        profitPct: h.profitPct,
        evalAmount: h.evalAmount,
      })),
    },
  }
}

/**
 * @param {unknown} raw
 * @returns {string[] | null}
 */
function parseGroupIds(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const ids = raw.map((id) => String(id ?? '').trim()).filter(Boolean)
  return ids.length > 0 ? ids : null
}

/**
 * @param {import('express').Request} req
 * @param {string} userId
 */
export async function runPortfolioOpusDiagnosis(req, userId) {
  const userSupabase = createUserSupabaseFromRequest(req)
  if (!userSupabase) {
    const err = new Error('인증 토큰 필요')
    err.status = 401
    throw err
  }

  const groupIds = parseGroupIds(req.body?.groupIds)

  let holdingsQuery = userSupabase.from('pro_holdings').select('*')
  if (groupIds) {
    holdingsQuery = holdingsQuery.in('group_id', groupIds)
  }

  const { data: holdings, error } = await holdingsQuery
  if (error) throw error
  if (!holdings?.length) {
    return {
      analysis: groupIds ? '선택된 그룹에 종목이 없습니다.' : '보유종목이 없습니다.',
      toolsUsed: [],
    }
  }

  const summaryLines = await Promise.all(
    holdings.map(async (h) => {
      const code = normalizeCode6(h.code)
      const name = String(h.name || '').trim() || code
      const quantity = Number(h.quantity) || 0
      const avgPrice = Number(h.avg_price) || 0
      const quote = await getKisQuote(code).catch(() => null)
      const cp = Number(quote?.currentPrice) || 0
      const pct = avgPrice > 0 && cp > 0 ? ((cp - avgPrice) / avgPrice) * 100 : 0
      const sign = pct > 0 ? '+' : ''
      return `${name}(${code}): ${quantity.toLocaleString('ko-KR')}주, 평단 ${avgPrice.toLocaleString('ko-KR')}원, 현재 ${cp > 0 ? cp.toLocaleString('ko-KR') : '—'}원 (${sign}${pct.toFixed(1)}%)`
    }),
  )

  const scopeLabel = groupIds ? '선택한 그룹' : '전체'

  const userMessage = `제 포트폴리오(${scopeLabel})를 진단해주세요.

[보유 종목]
${summaryLines.join('\n')}

각 종목의 최근 뉴스, 수급(외국인/기관), 섹터 동향을 도구로 조사한 뒤 포트폴리오 관점에서 진단해주세요:

1. [전체 평가] 포트폴리오 구성의 강점과 약점
2. [섹터 분산] 편중 여부와 분산 제안
3. [리밸런싱] 비중 조절이 필요한 종목 (늘릴/줄일)
4. [수급 주의] 외국인/기관 이탈 중인 보유 종목 경고
5. [액션 우선순위] 가장 먼저 검토할 종목 1~2개

필요한 데이터는 도구를 사용해 직접 조회하세요.`

  const supabaseService = getSupabaseService()
  const profile = supabaseService ? await fetchProUserProfile(supabaseService, userId) : {}
  const profileContext = buildProfileContextPrompt(profile)
  const system = PORTFOLIO_OPUS_SYSTEM + profileContext

  const { text, toolCalls } = await runOpusWithTools({
    messages: [{ role: 'user', content: userMessage }],
    system,
    userId,
    maxIterations: 12,
    maxTokens: 3000,
    timeoutMs: Number(process.env.PRO_PORTFOLIO_OPUS_TIMEOUT_MS) || 180_000,
    emptyText: '분석이 길어지고 있습니다. 잠시 후 다시 시도해 주세요.',
    usageLog: { userId, endpoint: 'portfolio-diagnosis' },
  })

  return {
    analysis: text,
    toolsUsed: toolCalls.map((t) => ({ name: t.name, input: t.input })),
  }
}
