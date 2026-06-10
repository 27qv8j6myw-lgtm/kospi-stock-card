import { createUserSupabaseFromRequest } from '../lib/auth.mjs'
import { isValidStockCode, normalizeKisIscd } from '../lib/stockCode.mjs'
import { PRO_ANALYSIS_MAX_TOKENS, runOpusWithTools } from '../lib/opusEngine.mjs'
import { getKisQuote } from '../lib/toolExecutor.mjs'

const GROUP_OPUS_SYSTEM = `당신은 한국 주식 단기 트레이딩(1~3개월) 전문 어시스턴트입니다.
그룹 진단 시 각 종목의 뉴스·공시·수급은 반드시 제공된 도구로 직접 조회한 뒤 그룹 관점에서 종합 판단합니다.
정중한 존댓말, 이모지 금지. 가격·기간 범위는 물결표(~) 사용.
각 섹션을 완결되게 작성 (글자수 제한 없음, 중간에 끊기지 않도록).
투자 권유가 아닌 참고 의견임을 전제로 합니다.`

/**
 * @param {unknown} raw
 */
function normalizeCode6(raw) {
  const code = normalizeKisIscd(raw)
  return isValidStockCode(code) && code !== '000000' ? code : ''
}

/**
 * @param {import('express').Request} req
 * @param {string} userId
 * @param {string | null} groupId
 */
export async function runGroupOpusDiagnosis(req, userId, groupId) {
  const userSupabase = createUserSupabaseFromRequest(req)
  if (!userSupabase) {
    const err = new Error('인증 토큰 필요')
    err.status = 401
    throw err
  }

  if (!groupId) {
    const err = new Error('groupId 필요')
    err.status = 400
    throw err
  }

  const { data: g } = await userSupabase
    .from('pro_groups')
    .select('name')
    .eq('id', groupId)
    .maybeSingle()
  const groupName = String(g?.name || '').trim() || '그룹'

  const query = userSupabase.from('pro_holdings').select('*').eq('group_id', groupId)

  const { data: holdings, error } = await query
  if (error) throw error

  if (!holdings?.length) {
    return {
      analysis: '이 그룹에 종목이 없습니다.',
      groupName,
      count: 0,
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

  const userMessage = `제 "${groupName}" 그룹의 종목들을 종합 진단해주세요.

[그룹 종목]
${summaryLines.join('\n')}

각 종목의 최근 뉴스, 수급(외국인/기관)을 도구로 조사한 뒤 그룹 관점에서 진단해주세요:

1. [그룹 평가] 이 그룹 구성의 강점/약점, 전략 부합도
2. [종목별 액션] 각 종목 익절/홀딩/손절 + 우선순위
3. [비중 조절] 그룹 내 비중 조절 제안

필요한 데이터는 도구를 사용해 직접 조회하세요.`

  const { text, toolCalls } = await runOpusWithTools({
    messages: [{ role: 'user', content: userMessage }],
    system: GROUP_OPUS_SYSTEM,
    userId,
    maxIterations: 10,
    maxTokens: PRO_ANALYSIS_MAX_TOKENS,
    timeoutMs: Number(process.env.PRO_GROUP_OPUS_TIMEOUT_MS) || 150_000,
    emptyText: '분석이 길어지고 있습니다. 잠시 후 다시 시도해 주세요.',
    usageLog: { userId, endpoint: 'group-diagnosis' },
  })

  return {
    analysis: text,
    groupName,
    count: holdings.length,
    toolsUsed: toolCalls.map((t) => ({ name: t.name, input: t.input })),
  }
}
