import Anthropic from '@anthropic-ai/sdk'
import {
  ANALYSIS_COMMON_RULES,
  deepAnalysisRules,
  STOCK_ANALYSIS_SECTIONS,
  STOCK_DEEP_AXES,
} from '../lib/analysisStyle.mjs'
import { STOCK_TOOLS } from '../lib/aiTools.mjs'
import { createAnthropicMessage, createAnthropicStream } from '../lib/anthropicTimed.mjs'
import { getCachedValue, hashKey } from '../lib/cacheHelper.mjs'
import { PRO_ANALYSIS_MAX_TOKENS } from '../lib/opusEngine.mjs'
import { executeTool } from '../lib/toolExecutor.mjs'
import { buildProfileContextPrompt, fetchProUserProfile } from '../lib/proUserProfile.mjs'
import { seoulSnapshotDateKey } from '../lib/snapshotProGroups.mjs'
import { getSupabaseService } from '../lib/supabaseService.mjs'
import { logApiUsage } from '../lib/usageLogger.mjs'
import { resolveModelAndMaxTokens } from '../lib/userModel.mjs'
import { buildArchiveContextPrompt, fetchRecentDiagnoses } from '../lib/diagnosisArchive.mjs'

/** market_cache 보존 시간 — 같은 날 재진입 시 재분석 없이 재사용 */
const STOCK_ANALYSIS_TTL_HOURS = 6

/**
 * 관리자(fable) 심층 모드 출력 상한. 스트리밍 경로에서는 모델이 훨씬 큰 값도 받지만,
 * 실제 생성 시간이 Vercel 함수 상한(300s)을 넘지 않는 범위로 둔다.
 */
const DEEP_MAX_TOKENS = 32000

/** 이어쓰기 라운드를 새로 시작할지 판단하는 경과 시간 상한 (함수 상한 300s 내 여유 확보) */
const CONTINUE_DEADLINE_MS = 210_000

/**
 * 심층 조사에 쓸 도구 — 종목 분석과 무관한 도구(최근 조회 종목·종목 검색 등)는 제외.
 * 보유 진단이 도구로 직접 캐낸 만큼의 근거를 종목카드에서도 확보하기 위한 목록.
 */
const RESEARCH_TOOL_NAMES = new Set([
  'searchNews',
  'getDisclosures',
  'getDailyChart',
  'getInvestorTrend',
  'getValuation',
  'get52Week',
  'getAnalystReports',
  'getMarketIndices',
  'getStockQuote',
])

const RESEARCH_MAX_ITERATIONS = 3
/** 조사에 쓸 수 있는 시간 — 초과하면 모은 만큼만 갖고 작성으로 넘어간다 */
const RESEARCH_BUDGET_MS = 100_000
/** 조사 결과를 프롬프트에 넣을 때의 총량 상한 (입력 토큰 폭증 방지) */
const RESEARCH_MAX_CHARS = 24000

/**
 * 사용자·종목 단위 캐시 범위. 복귀 조회는 이 prefix 로 최신 항목을 찾는다.
 * @param {string | null | undefined} userId
 * @param {string} code
 */
function stockAnalysisCacheScope(userId, code) {
  return `stock-analysis:${userId || 'anon'}:${code}`
}

/**
 * 캐시 키 — 사용자·종목·모델티어·당일·현재가(~1% 밴드)가 같으면 재사용.
 * (포트폴리오 진단과 동일한 밴드 기준)
 * @param {string | null | undefined} userId
 * @param {string} code
 * @param {Record<string, unknown>} summary
 * @param {string} tier
 */
function buildStockAnalysisCacheKey(userId, code, summary, tier) {
  const quote = /** @type {Record<string, unknown> | undefined} */ (summary?.quote)
  const price = Number(quote?.currentPrice)
  const valid = Number.isFinite(price) && price > 0
  const step = Math.max(1, Math.round((valid ? price : 100) * 0.01))
  const band = valid ? Math.floor(price / step) : 0
  return `${stockAnalysisCacheScope(userId, code)}:${seoulSnapshotDateKey()}:${hashKey(`${tier}:${band}`)}`
}

/**
 * @typedef {object} StockAnalysisCacheEntry
 * @property {string} analysis
 * @property {string} [model]
 * @property {number} [pastDiagnoses]
 * @property {string} [generatedAt]
 */

/**
 * 사용자·종목 범위에서 가장 최근에 저장된 분석을 조회 (복귀 조회 전용).
 * 화면이 꺼진 사이 시세가 움직여 캐시 키가 달라졌어도 방금 완료된 결과를 찾아야 하므로
 * 정확한 키가 아니라 prefix 로 조회한다.
 * @param {string | null | undefined} userId
 * @param {string} code
 * @returns {Promise<StockAnalysisCacheEntry | null>}
 */
export async function getLatestStockAnalysis(userId, code) {
  const sb = getSupabaseService()
  if (!sb) return null

  try {
    const { data, error } = await sb
      .from('market_cache')
      .select('data, expires_at')
      .like('cache_key', `${stockAnalysisCacheScope(userId, code)}:%`)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
    if (error || !data?.length) return null
    const entry = data[0]?.data
    return entry && typeof entry === 'object' && entry.analysis ? entry : null
  } catch (e) {
    console.warn('[Stock Analysis cache read]', e instanceof Error ? e.message : String(e))
    return null
  }
}

/**
 * @param {string} cacheKey
 * @param {StockAnalysisCacheEntry} payload
 */
async function saveStockAnalysis(cacheKey, payload) {
  const sb = getSupabaseService()
  if (!sb) return

  try {
    const expiresAt = new Date(Date.now() + STOCK_ANALYSIS_TTL_HOURS * 60 * 60 * 1000).toISOString()
    const { error } = await sb
      .from('market_cache')
      .upsert({ cache_key: cacheKey, data: payload, expires_at: expiresAt }, { onConflict: 'cache_key' })
    if (error) console.warn('[Stock Analysis cache write]', error.message)
  } catch (e) {
    console.warn('[Stock Analysis cache write]', e instanceof Error ? e.message : String(e))
  }
}

/**
 * @param {Record<string, unknown>} summary
 * @param {string} code
 * @param {string} [profileContext]
 * @param {string} [archiveContext]
 * @param {boolean} [isDeep] 관리자(fable) — 형식보다 추론 깊이를 우선하는 심층 모드
 * @param {string} [researchContext] 도구로 직접 조사한 추가 데이터 (심층 모드)
 */
function buildAnalysisPrompt(
  summary,
  code,
  profileContext = '',
  archiveContext = '',
  isDeep = false,
  researchContext = '',
) {
  const name = summary?.name ?? code
  const quote = /** @type {Record<string, unknown> | undefined} */ (summary?.quote)
  const news = Array.isArray(summary?.news) ? summary.news : []
  const disclosures = Array.isArray(summary?.disclosures) ? summary.disclosures : []
  const analyst = /** @type {Record<string, unknown> | undefined} */ (summary?.analyst)

  const currentPrice = Number(quote?.currentPrice)
  const changePct = quote?.changePct

  const upside =
    analyst?.upside != null && Number.isFinite(Number(analyst.upside))
      ? `${Number(analyst.upside) > 0 ? '+' : ''}${analyst.upside}%`
      : '—'

  const market = quote?.market ?? '—'
  const sector = quote?.sector ?? '—'

  return `당신은 한국 주식 단기 트레이딩(1~3개월) 전문 어시스턴트입니다. 아래 데이터만 근거로 종합 분석을 작성하세요. 특정 개인·고정 매매 룰·보유 종목을 가정하지 마세요.${profileContext}

[종목] ${name} (${code})
[시장] ${market}
[업종] ${sector}

[현재 시세]
- 현재가: ${Number.isFinite(currentPrice) ? currentPrice.toLocaleString('ko-KR') : '—'}원
- 등락률: ${changePct ?? '—'}%

[가치·수급·52주]
${JSON.stringify(
  {
    valuation: summary?.valuation,
    week52: summary?.week52,
    investor: summary?.investor,
    earnings: summary?.earnings,
  },
  null,
  2,
)}

[최근 뉴스]
${news.map((n) => `- ${n.title} (${n.pubDate ?? ''})`).join('\n') || '없음'}

[최근 공시]
${disclosures
  .slice(0, 5)
  .map((d) => `- ${d.date}: ${d.report}`)
  .join('\n') || '없음'}

[애널리스트 컨센서스]
${
  analyst?.available
    ? `평균 목표가 ${Number(analyst.targetPrice).toLocaleString('ko-KR')}원 (상승여력 ${upside}), 의견 ${analyst.opinion ?? '—'}`
    : '데이터 없음'
}
${researchContext}
[작성 구조 — 각 섹션 ## 헤더 필수]
${STOCK_ANALYSIS_SECTIONS}${
    isDeep ? '\n## [심층 통찰] 형식·길이 제약 없는 자유 서술 (아래 [심층 분석 모드] 참조)' : ''
  }

${ANALYSIS_COMMON_RULES}
- 1~3개월 단기·스윙 매매 관점으로 작성
${isDeep ? `\n${deepAnalysisRules(STOCK_DEEP_AXES)}\n` : ''}${archiveContext}`
}

/**
 * 심층 모드 사전 조사 — 모델이 필요한 데이터를 도구로 직접 캐게 한다.
 * 최종 서술은 스트리밍을 유지해야 하므로, 조사(도구 루프)와 작성(스트림)을 분리해
 * 여기서는 데이터만 모으고 해석은 시키지 않는다.
 *
 * @param {{
 *   client: Anthropic,
 *   modelId: string,
 *   code: string,
 *   name: string,
 *   userId?: string,
 *   send: (event: string, data: unknown) => void,
 * }} opts
 * @returns {Promise<Array<{ name: string, input: Record<string, unknown>, result: unknown }>>}
 */
async function runToolResearch({ client, modelId, code, name, userId, send }) {
  const tools = STOCK_TOOLS.filter((t) => RESEARCH_TOOL_NAMES.has(t.name))
  const startedAt = Date.now()

  /** @type {import('@anthropic-ai/sdk').MessageParam[]} */
  const messages = [
    {
      role: 'user',
      content: `${name}(${code}) 심층 분석에 필요한 데이터를 도구로 조사해 주세요.
우선순위: 최근 뉴스, 60일 일봉 추세, 20일 수급 동향, 밸류에이션, 최근 공시, 시장 지수.
조사만 하고 해석·의견은 쓰지 마세요. 충분히 모았으면 "조사 완료"라고만 답하세요.`,
    },
  ]

  const collected = []

  for (let i = 0; i < RESEARCH_MAX_ITERATIONS; i += 1) {
    if (Date.now() - startedAt > RESEARCH_BUDGET_MS) break

    const response = await createAnthropicMessage(
      client,
      {
        model: modelId,
        max_tokens: 2000,
        system:
          '당신은 주식 분석용 데이터 조사원입니다. 필요한 데이터를 도구로 조회하기만 하고, 해석이나 투자 의견은 작성하지 않습니다.',
        tools,
        messages,
      },
      60_000,
    )

    if (userId && response.usage) {
      await logApiUsage(userId, 'stock-analysis-research', modelId, response.usage).catch(() => {})
    }

    const toolUses = response.content.filter((c) => c.type === 'tool_use')
    if (toolUses.length === 0) break

    messages.push({ role: 'assistant', content: response.content })

    const executed = await Promise.all(
      toolUses.map(async (toolUse) => {
        const input =
          toolUse.input && typeof toolUse.input === 'object' && !Array.isArray(toolUse.input)
            ? /** @type {Record<string, unknown>} */ (toolUse.input)
            : {}
        send('research', { tool: toolUse.name })
        const result = await executeTool(toolUse.name, input, userId ?? null).catch((e) => ({
          error: e instanceof Error ? e.message : String(e),
        }))
        return { toolUse, input, result }
      }),
    )

    /** @type {import('@anthropic-ai/sdk').ToolResultBlockParam[]} */
    const toolResults = []
    for (const { toolUse, input, result } of executed) {
      collected.push({ name: toolUse.name, input, result })
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      })
    }
    messages.push({ role: 'user', content: toolResults })
  }

  return collected
}

/**
 * 조사 결과를 프롬프트에 붙일 텍스트로 직렬화 (총량 상한 적용)
 * @param {Array<{ name: string, input: Record<string, unknown>, result: unknown }>} collected
 */
function buildResearchContext(collected) {
  if (collected.length === 0) return ''
  let out = '\n[추가 조사 데이터 — 도구로 직접 조회한 실제 값]\n'
  for (const item of collected) {
    const body = JSON.stringify(item.result)
    if (out.length + body.length > RESEARCH_MAX_CHARS) break
    out += `\n### ${item.name}(${JSON.stringify(item.input)})\n${body}\n`
  }
  return `${out}\n`
}

/**
 * @param {{
 *   summary: Record<string, unknown>,
 *   code: string,
 *   userId?: string,
 *   send: (event: string, data: unknown) => void,
 *   force?: boolean,
 * }} opts
 *   force: 캐시를 무시하고 재분석
 */
export async function runProStockAnalysisStream({ summary, code, userId, send, force = false }) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 가 설정되지 않았습니다')
  }

  const {
    userModel,
    modelId: stockModel,
    maxTokens: baseMaxTokens,
  } = await resolveModelAndMaxTokens(userId, {
    opusBase: PRO_ANALYSIS_MAX_TOKENS,
    sonnetBase: 12000,
    cap: 16000,
  })

  /** 관리자(fable) — 형식보다 추론 깊이를 우선하는 심층 모드 */
  const isDeep = userModel === 'fable'
  // 심층 모드는 thinking 블록 + 장문 논증으로 출력이 길어 상한과 이어쓰기 라운드를 늘린다.
  const maxTokens = isDeep ? Math.max(baseMaxTokens, DEEP_MAX_TOKENS) : baseMaxTokens
  const maxContinuations = isDeep ? 3 : 2

  const cacheKey = buildStockAnalysisCacheKey(userId, code, summary, userModel)

  if (!force) {
    const cached = /** @type {StockAnalysisCacheEntry | null} */ (await getCachedValue(cacheKey))
    if (cached?.analysis) {
      send('meta', {
        model: cached.model ?? stockModel,
        pastDiagnoses: cached.pastDiagnoses ?? 0,
        cached: true,
        generatedAt: cached.generatedAt ?? null,
      })
      send('text', { delta: cached.analysis })
      send('done', { cached: true })
      return
    }
  }

  const client = new Anthropic({ apiKey })

  let profileContext = ''
  let archiveContext = ''
  let pastDiagnoses = 0
  if (userId) {
    const supabaseService = getSupabaseService()
    if (supabaseService) {
      const profile = await fetchProUserProfile(supabaseService, userId)
      profileContext = buildProfileContextPrompt(profile)
      // 이 종목에 대한 사용자의 과거 진단(아카이브)을 연속성 참고로 주입
      const archiveRows = await fetchRecentDiagnoses(supabaseService, {
        userId,
        kind: 'holding',
        code,
        limit: 2,
      }).catch(() => [])
      pastDiagnoses = archiveRows.length
      archiveContext = buildArchiveContextPrompt(archiveRows)
    }
  }

  send('meta', { model: stockModel, pastDiagnoses, cached: false })

  // 이어쓰기 판단은 조사 시간까지 포함한 전체 경과 기준이어야 함수 상한을 넘기지 않는다.
  const startedAt = Date.now()

  // 심층 모드는 스냅샷에 없는 일봉 추세·뉴스·시장 지수까지 도구로 직접 조사한 뒤 작성한다.
  let researchContext = ''
  if (isDeep) {
    send('research', { status: 'start' })
    const collected = await runToolResearch({
      client,
      modelId: stockModel,
      code,
      name: String(summary?.name ?? code),
      userId,
      send,
    }).catch((e) => {
      console.warn('[Stock analysis research]', e instanceof Error ? e.message : String(e))
      return []
    })
    researchContext = buildResearchContext(collected)
    send('research', { status: 'done', count: collected.length })
  }

  const prompt = buildAnalysisPrompt(
    summary,
    code,
    profileContext,
    archiveContext,
    isDeep,
    researchContext,
  )

  /** @type {import('@anthropic-ai/sdk').MessageParam[]} */
  let messages = [{ role: 'user', content: prompt }]
  let fullText = ''

  for (let round = 0; round <= maxContinuations; round += 1) {
    const stream = await createAnthropicStream(client, {
      model: stockModel,
      max_tokens: maxTokens,
      messages,
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullText += event.delta.text
        send('text', { delta: event.delta.text })
      }
    }

    const final = await stream.finalMessage()
    if (userId && final.usage) {
      await logApiUsage(userId, 'stock-analysis', stockModel, final.usage)
    }

    if (final.stop_reason !== 'max_tokens' || round >= maxContinuations) break
    // 함수 상한에 걸려 통째로 유실되는 것보다, 여기까지 쓴 분석을 저장하고 끝내는 편이 낫다.
    if (Date.now() - startedAt > CONTINUE_DEADLINE_MS) {
      console.warn(`[Pro Stock Analysis] 이어쓰기 중단 — 시간 초과 임박 (round=${round})`)
      break
    }

    messages = [
      ...messages,
      { role: 'assistant', content: final.content },
      {
        role: 'user',
        content:
          '이전 응답이 중간에 끊겼습니다. 이미 쓴 내용은 반복하지 말고, 남은 섹션만 이어서 작성해 주세요.',
      },
    ]
  }

  // 화면이 꺼져 클라이언트가 끊겼더라도 결과가 남아야 복귀 조회로 살릴 수 있으므로 응답 전에 저장한다.
  const analysis = fullText.trim()
  if (analysis) {
    await saveStockAnalysis(cacheKey, {
      analysis,
      model: stockModel,
      pastDiagnoses,
      generatedAt: new Date().toISOString(),
    })
  }

  send('done', {})
}
