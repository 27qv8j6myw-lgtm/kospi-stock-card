import Anthropic from '@anthropic-ai/sdk'
import { createAnthropicStream } from '../lib/anthropicTimed.mjs'
import { getCachedValue, hashKey } from '../lib/cacheHelper.mjs'
import { PRO_ANALYSIS_MAX_TOKENS } from '../lib/opusEngine.mjs'
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
 */
function buildAnalysisPrompt(
  summary,
  code,
  profileContext = '',
  archiveContext = '',
  isDeep = false,
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

[작성 구조 — 각 섹션 ## 헤더 필수]
## [결론] 강한 매수 / 매수 / 관망 / 매도 중 하나 + 한 줄 요약
## [지표] 핵심 데이터 (표 권장: 현재가, PER/PBR, 수급, 52주, 컨센서스 등)
## [이슈] 최근 뉴스·공시 요약 (${isDeep ? '호재/악재 구분, 유의미한 건은 개수 제한 없이' : '호재/악재 구분, 2~3개'})
## [전략] 진입가·목표가·손절가 (현재가 기준 구체적 원화 가격, 범위는 물결표 ~ 사용)
## [리스크] 주의 사항 ${isDeep ? '(발생 조건과 파급 경로까지)' : '2~3개'}${
    isDeep ? '\n## [심층 통찰] 형식·길이 제약 없는 자유 서술 (아래 [심층 분석 모드] 참조)' : ''
  }

[작성 규칙]
- 정중한 존댓말, 이모지 금지 (단, 투자 프로필이 있으면 맨 첫 줄 "📊 ○○형·○○ 관점 분석" 1줄만 예외)
- 가격·금액 범위: 하이픈(-) 대신 물결표(~) 사용
  예: "230,000~250,000원" (X "230,000-250,000원")
- 기간 범위도 동일: "1~3개월" (X "1-3개월")
- 변동률 부호는 +/- 그대로 (예: +5.2%, -3.1%)
- 표는 마크다운 표 형식

[톤]
- 1~3개월 단기·스윙 매매 관점
- 데이터 없는 항목은 "데이터 없음" 명시, 추측은 "추정" 표기
- 마크다운 (##, **, |표|, >, 리스트)
- 각 섹션을 완결되게 작성 (글자수 제한 없음, 중간에 끊기지 않도록)
${
  isDeep
    ? `
[심층 분석 모드 — 최우선 지침]
이 요청은 전문 투자자를 위한 심층 분석이다. 형식의 간결함보다 추론의 깊이를 우선한다.

- 각 섹션에서 결론만 제시하지 말고 "왜 그런가"의 인과를 근거와 함께 논증한다.
  분량을 줄이려고 근거를 생략하지 않는다.
- [심층 통찰] 에는 표면 요약이 아니라 다른 곳에서 보기 어려운 해석을 담는다.
  아래 중 이 종목에 유의미한 축을 골라 깊게 다룬다 (전부 나열할 필요 없음):
  · 섹터 사이클 상 현재 위치와 남은 국면
  · 밸류에이션(PER·PBR)이 정당한지, 괴리라면 그 원인
  · 수급(외국인·기관)의 방향이 아니라 지속성에 대한 해석
  · 실적 모멘텀의 질 — 일회성인지 구조적인지
  · 시나리오 분기(강세/기본/약세)와 각 분기의 관찰 가능한 선행 신호
  · 시장 컨센서스와 다르게 보는 지점이 있다면 그 근거
- 데이터가 없는 축은 억지로 채우지 말고, 무엇을 더 확인해야 하는지 밝힌다.
- 근거 없는 단정과 새로운 수치 창작은 금지 (제공된 데이터 범위를 지킨다).
`
    : ''
}${archiveContext}`
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

  const prompt = buildAnalysisPrompt(summary, code, profileContext, archiveContext, isDeep)

  send('meta', { model: stockModel, pastDiagnoses, cached: false })

  /** @type {import('@anthropic-ai/sdk').MessageParam[]} */
  let messages = [{ role: 'user', content: prompt }]
  let fullText = ''
  const startedAt = Date.now()

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
