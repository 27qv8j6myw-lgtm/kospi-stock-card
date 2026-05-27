import { createUserSupabaseFromRequest } from '../lib/auth.mjs'
import { normalizeKisIscd } from '../lib/stockCode.mjs'
import { runOpusWithTools } from '../lib/opusEngine.mjs'
import { executeTool } from '../lib/toolExecutor.mjs'

const HOLDING_OPUS_SYSTEM = `당신은 한국 주식 단기 트레이딩(1~3개월) 전문 어시스턴트입니다.
보유 종목 진단 시 뉴스·공시·수급·재무·차트는 반드시 제공된 도구로 직접 조회한 뒤 종합 판단합니다.
사용자가 제시한 평단·수익률·비중·보유기간 맥락을 반드시 반영하세요.
정중한 존댓말, 이모지 금지. 가격·기간 범위는 하이픈(-) 대신 물결표(~) 사용 (예: 230,000~250,000원, 1~3개월).
변동률 부호는 +/- 그대로 표기합니다.`

/**
 * @param {import('express').Request} req
 * @param {string} userId
 * @param {string} holdingId
 */
export async function runHoldingOpusDiagnosis(req, userId, holdingId) {
  const userSupabase = createUserSupabaseFromRequest(req)
  if (!userSupabase) {
    const err = new Error('인증 토큰 필요')
    err.status = 401
    throw err
  }

  const { data: holding, error: holdErr } = await userSupabase
    .from('pro_holdings')
    .select('id, code, name, avg_price, quantity, memo, group_id, created_at, updated_at')
    .eq('id', holdingId)
    .maybeSingle()

  if (holdErr) {
    const err = new Error(holdErr.message)
    err.status = 500
    throw err
  }
  if (!holding) {
    const err = new Error('보유 종목이 아닙니다')
    err.status = 404
    throw err
  }

  const code6 = normalizeKisIscd(holding.code)
  const name = String(holding.name || '').trim() || code6
  const avgPrice = Number(holding.avg_price) || 0
  const quantity = Number(holding.quantity) || 0

  const quoteRaw = await executeTool('getStockQuote', { code: code6 }, userId).catch(() => null)
  const quote =
    quoteRaw && typeof quoteRaw === 'object' && !('error' in quoteRaw) ? quoteRaw : null
  const currentPrice = Number(quote?.currentPrice) || 0
  const profitPct =
    avgPrice > 0 && currentPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0
  const isProfit = profitPct >= 0

  const { data: allHoldings } = await userSupabase
    .from('pro_holdings')
    .select('code, quantity, avg_price')

  let portfolioValue = 0
  for (const h of allHoldings || []) {
    const ap = Number(h.avg_price) || 0
    const q = Number(h.quantity) || 0
    portfolioValue += ap * q
  }
  const holdingValue =
    currentPrice > 0 ? currentPrice * quantity : avgPrice > 0 ? avgPrice * quantity : 0
  const weightPct = portfolioValue > 0 ? (holdingValue / portfolioValue) * 100 : 0

  const createdAt = holding.created_at ? new Date(holding.created_at) : new Date()
  const holdingDays = Math.max(
    0,
    Math.floor((Date.now() - createdAt.getTime()) / 86_400_000),
  )

  const profitLabel = profitPct > 0 ? '+' : ''
  const memoNote =
    holding.memo != null && String(holding.memo).trim()
      ? `\n- 메모: ${String(holding.memo).trim()}`
      : ''

  const userMessage = `제가 보유 중인 ${name}(${code6})를 심층 진단해주세요.

[제 보유 정보]
- 평단가: ${avgPrice.toLocaleString('ko-KR')}원
- 현재가: ${currentPrice > 0 ? currentPrice.toLocaleString('ko-KR') : '—'}원
- 수익률: ${profitLabel}${profitPct.toFixed(2)}% (${isProfit ? '수익' : '손실'} 구간)
- 보유수량: ${quantity.toLocaleString('ko-KR')}주
- 보유기간: ${holdingDays}일
- 포트폴리오 비중(평가액 기준 근사): ${weightPct.toFixed(0)}%${memoNote}

이 종목의 최근 뉴스, 공시, 수급(외국인/기관), 재무, 차트를 종합적으로 조사한 뒤 다음을 진단해주세요:

1. [종합 의견] 추가매수 / 홀딩 / 일부익절 / 손절 중 하나와 한 줄 요약
2. [${isProfit ? '수익' : '손실'} 구간 전략] ${
    isProfit
      ? '목표가 여력, 익절 비중, 트레일링 손절'
      : '손절 기준, 물타기 적정성, 반등 시나리오'
  }
3. [시나리오별 액션] 추가매수·익절·손절 각각 구체적 가격(원화)
4. [수급 분석] 외국인/기관 흐름 해석

필요한 데이터는 도구를 사용해 직접 조회하세요.`

  const { text, toolCalls } = await runOpusWithTools({
    messages: [{ role: 'user', content: userMessage }],
    system: HOLDING_OPUS_SYSTEM,
    userId,
    maxIterations: 8,
    maxTokens: 2500,
    timeoutMs: Number(process.env.PRO_HOLDING_OPUS_TIMEOUT_MS) || 120_000,
    emptyText: '분석이 길어지고 있습니다. 잠시 후 다시 시도해 주세요.',
  })

  return {
    holdingId: holding.id,
    code: code6,
    name,
    profitPct,
    isProfit,
    currentPrice: currentPrice || null,
    avgPrice,
    quantity,
    holdingDays,
    weightPct,
    analysis: text,
    toolsUsed: toolCalls.map((t) => ({ name: t.name, input: t.input })),
    updatedAt: new Date().toISOString(),
  }
}
