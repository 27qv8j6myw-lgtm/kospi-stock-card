import {
  ANALYSIS_COMMON_RULES,
  deepAnalysisRules,
  holdingAnalysisSections,
  STOCK_DEEP_AXES,
} from '../lib/analysisStyle.mjs'
import { createUserSupabaseFromRequest } from '../lib/auth.mjs'
import { normalizeKisIscd } from '../lib/stockCode.mjs'
import { PRO_ANALYSIS_MAX_TOKENS, runOpusWithTools } from '../lib/opusEngine.mjs'
import { buildProfileContextPrompt, fetchProUserProfile } from '../lib/proUserProfile.mjs'
import { getSupabaseService } from '../lib/supabaseService.mjs'
import { executeTool } from '../lib/toolExecutor.mjs'
import { resolveModelAndMaxTokens } from '../lib/userModel.mjs'
import { seoulSnapshotDateKey } from '../lib/snapshotProGroups.mjs'
import {
  archiveDiagnosis,
  buildArchiveContextPrompt,
  fetchRecentDiagnoses,
} from '../lib/diagnosisArchive.mjs'

const HOLDING_OPUS_CACHE_TTL_MS = 6 * 60 * 60 * 1000

/** 현재가를 평단 기준 ~1% 밴드로 버킷화 (가격 변동 시 캐시 무효화용) */
function priceBucket(currentPrice, avgPrice) {
  if (!(currentPrice > 0)) return 0
  const step = Math.max(1, Math.round((avgPrice > 0 ? avgPrice : currentPrice) * 0.01))
  return Math.floor(currentPrice / step)
}

const HOLDING_OPUS_SYSTEM = `당신은 한국 주식 단기 트레이딩(1~3개월) 전문 어시스턴트입니다.
보유 종목 진단 시 뉴스·공시·수급·재무·차트는 반드시 제공된 도구로 직접 조회한 뒤 종합 판단합니다.
사용자가 제시한 평단·수익률·비중·보유기간 맥락을 반드시 반영하세요.

${ANALYSIS_COMMON_RULES}`

/**
 * @param {import('express').Request} req
 * @param {string} userId
 * @param {string} holdingId
 * @param {{ cachedOnly?: boolean, force?: boolean }} [opts]
 *   cachedOnly: 캐시가 있으면 반환, 없으면 생성하지 않고 pending 반환 (자동 비용 방지)
 *   force: 캐시 무시하고 재생성
 */
export async function runHoldingOpusDiagnosis(req, userId, holdingId, opts = {}) {
  const cachedOnly = Boolean(opts.cachedOnly)
  const force = Boolean(opts.force)
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

이 종목의 최근 뉴스, 공시, 수급(외국인/기관), 재무, 차트를 도구로 직접 조사한 뒤 아래 구조로 진단해주세요.

[작성 구조 — 각 섹션 ## 헤더 필수]
${holdingAnalysisSections({ isProfit, avgPrice, weightPct })}`

  const supabaseService = getSupabaseService()

  // 서버 캐시: 같은 종목 재진입 시 비용/지연 0 (가격 ~1% 밴드 + 당일 키)
  const cacheKey = `holding-opus:${holdingId}:${seoulSnapshotDateKey()}:${priceBucket(currentPrice, avgPrice)}`
  if (supabaseService && !force) {
    const { data: cachedRow } = await supabaseService
      .from('market_cache')
      .select('data, expires_at')
      .eq('cache_key', cacheKey)
      .maybeSingle()
    if (
      cachedRow?.data &&
      cachedRow.expires_at &&
      new Date(cachedRow.expires_at).getTime() > Date.now()
    ) {
      return { ...cachedRow.data, cached: true }
    }
  }

  // 캐시가 없고 cachedOnly 모드면 생성하지 않고 대기 상태 반환(자동 호출 비용 방지)
  if (cachedOnly) {
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
      analysis: '',
      toolsUsed: [],
      cached: false,
      pending: true,
    }
  }

  const profile = supabaseService ? await fetchProUserProfile(supabaseService, userId) : {}
  const profileContext = buildProfileContextPrompt(profile)
  const system = HOLDING_OPUS_SYSTEM + profileContext

  // 도구 사용(에이전트형) 루프는 항상 opus 고정.
  // sonnet 은 도구를 여러 턴에 나눠 호출해 왕복이 많아 매우 느리고,
  // 누적 입력 토큰까지 늘어 비용 이점도 사라지기 때문이다. (작업량 배수는 유지)
  const { userModel, modelId, maxTokens } = await resolveModelAndMaxTokens(userId, {
    opusBase: PRO_ANALYSIS_MAX_TOKENS,
    cap: 16000,
    forceModel: 'opus',
  })

  /** 관리자(fable) — 형식보다 추론 깊이를 우선하는 심층 모드 */
  const isDeep = userModel === 'fable'
  const deepBlock = isDeep
    ? `\n## [심층 통찰] 형식·길이 제약 없는 자유 서술\n\n${deepAnalysisRules(STOCK_DEEP_AXES)}\n`
    : ''

  // 같은 종목의 과거 진단을 참고 맥락으로 주입 (연속성/입장 변화 비교)
  const archiveContext = supabaseService
    ? buildArchiveContextPrompt(
        await fetchRecentDiagnoses(supabaseService, {
          userId,
          kind: 'holding',
          code: code6,
          limit: 2,
        }),
      )
    : ''

  const { text, toolCalls } = await runOpusWithTools({
    messages: [{ role: 'user', content: userMessage + deepBlock + archiveContext }],
    system,
    userId,
    modelId,
    maxIterations: isDeep ? 10 : 8,
    maxTokens,
    timeoutMs: Number(process.env.PRO_HOLDING_OPUS_TIMEOUT_MS) || 120_000,
    emptyText: '분석이 길어지고 있습니다. 잠시 후 다시 시도해 주세요.',
    usageLog: { userId, endpoint: 'holding-diagnosis', model: modelId },
  })

  const payload = {
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
    model: modelId,
    toolsUsed: toolCalls.map((t) => ({ name: t.name, input: t.input })),
    updatedAt: new Date().toISOString(),
  }

  // 의미 있는 분석이 나온 경우에만 캐시 (빈/실패 응답은 캐시하지 않음)
  if (supabaseService && text && text.length > 80) {
    const expiresAt = new Date(Date.now() + HOLDING_OPUS_CACHE_TTL_MS).toISOString()
    void supabaseService
      .from('market_cache')
      .upsert({ cache_key: cacheKey, data: payload, expires_at: expiresAt }, { onConflict: 'cache_key' })
      .then(({ error }) => {
        if (error) console.warn('[Holding OPUS cache]', error.message)
      })

    // 새 진단 생성 시점에만 아카이브 보관
    void archiveDiagnosis(supabaseService, {
      userId,
      kind: 'holding',
      refId: holding.id,
      code: code6,
      title: `${name}(${code6})`,
      analysis: text,
      profitPct: profitPct,
      currentPrice: currentPrice || null,
      model: modelId,
      meta: { quantity, holdingDays, weightPct },
    })
  }

  return { ...payload, cached: false }
}
