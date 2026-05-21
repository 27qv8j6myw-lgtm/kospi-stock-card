import Anthropic from '@anthropic-ai/sdk'
import { cleanEnvSecret } from '../aiClient.mjs'
import { createAnthropicMessage, SCREENING_AI_TIMEOUT_MS } from '../lib/anthropicTimed.mjs'
import { safeJsonParse } from '../lib/safeJson.mjs'
import { getUserModel, resolveModelId } from '../lib/userModel.mjs'
import { getStockMasterByCode } from '../lib/stocksMasterSearch.mjs'
import { resolveScreeningStockDisplayName } from '../screening/sectorMaster.mjs'

/** TOP5·섹터 선정·후보 보충 — `SCREENING_AI_MODEL` / `SCREENING_CANDIDATE_AI_MODEL` 로 롤백 가능 */
export const SCREENING_AI_DEFAULT_MODEL = 'claude-opus-4-7'

/** 섹터 선정·추가 후보 (기본 Opus, 자동 스크리닝과 동일 깊이) */
export const SCREENING_CANDIDATE_AI_MODEL =
  process.env.SCREENING_CANDIDATE_AI_MODEL?.trim() || SCREENING_AI_DEFAULT_MODEL

const ALLOWED_LABEL = new Set(['관심후보', '관망검토', '주의'])

/**
 * 종목 코드 기준 중복 제거 (첫 항목 유지).
 * @param {Array<{ code?: string }>} stocks
 * @returns {Array<Record<string, unknown>>}
 */
export function dedupeStocksByCode(stocks) {
  const seen = new Set()
  return (Array.isArray(stocks) ? stocks : []).filter((s) => {
    const code = String(s?.code ?? '')
      .replace(/\D/g, '')
      .padStart(6, '0')
    if (!code || !/^\d{6}$/.test(code)) return false
    if (seen.has(code)) return false
    seen.add(code)
    return true
  })
}

/** @returns {string} */
export function screeningAiModel() {
  return process.env.SCREENING_AI_MODEL?.trim() || SCREENING_AI_DEFAULT_MODEL
}

function clipChars(s, max) {
  const arr = Array.from(String(s ?? '').replace(/\s+/g, ' ').trim())
  return arr.length <= max ? arr.join('') : arr.slice(0, max).join('')
}

/** 요약·근거·리스크: 임의 잘림 방지, 비정상적으로 긴 응답만 상한 */
function normalizeLongText(raw, maxChars) {
  const t = String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
  if (!t) return ''
  if (t.length <= maxChars) return t
  return t.slice(0, maxChars).trimEnd() + '…'
}

/**
 * @param {string} raw
 * @returns {'관심후보'|'관망검토'|'주의'|null}
 */
export function normalizeCandidateLabel(raw) {
  const t = String(raw ?? '').trim()
  if (ALLOWED_LABEL.has(t)) return t
  if (/관심\s*후보|후보\s*관심|강\s*관심/.test(t)) return '관심후보'
  if (/관망\s*검토|검토\s*관망|과열\s*조정|조정\s*대기/.test(t)) return '관망검토'
  if (/주의|신중|펀더\s*약/.test(t)) return '주의'
  /** 구 JSON recommendation → 후보 라벨로만 승격 (매매 지시 아님) */
  if (/신규|분할|매수/.test(t)) return '관심후보'
  if (/보유|관망/.test(t)) return '관망검토'
  if (/회피|진입\s*금지|제외/.test(t)) return '주의'
  return null
}

/**
 * @param {'관심후보'|'관망검토'|'주의'} label
 * @param {number} currentPrice
 */
function fallbackSplitPrices(label, currentPrice) {
  const p = Number(currentPrice) > 0 ? Number(currentPrice) : 50_000
  const q = (n) => Math.round(n)
  if (label === '관심후보') return [q(p), q(p * 0.95), q(p * 0.9)]
  if (label === '주의') return [q(p * 0.85), q(p * 0.8), q(p * 0.75)]
  return [q(p * 0.95), q(p * 0.9), q(p * 0.85)]
}

function normalizeSplitPricesFromResponse(arr, label, currentPrice) {
  if (!Array.isArray(arr) || arr.length < 3) return fallbackSplitPrices(label, currentPrice)
  const a = arr.map((n) => Number(n))
  if (!a.every((n) => Number.isFinite(n) && n > 0)) return fallbackSplitPrices(label, currentPrice)
  return [Math.round(a[0]), Math.round(a[1]), Math.round(a[2])]
}

function normalizeConsensusEstimate(raw) {
  const t = clipChars(raw, 48)
  if (!t || t === '-' || /^null$/i.test(t)) return null
  return t
}

/**
 * 룰 상위 후보 15개를 AI가 재선정하여 TOP 5 + 상세 분석을 반환.
 * @param {Array<{ code: string, name: string, sector?: string, score: number, currentPrice?: number, return5D?: number, operatingMargin?: number, subScores?: object, per?: number, consensusUpside?: number, fiveYearAvgPer?: number }>} candidates
 * @param {string | null | undefined} userId — Supabase 사용자 UUID (없으면 sonnet)
 * @param {{ forcedModel?: 'opus'|'sonnet' }} [opts] — 캐시 키와 동일 모델로 강제 호출 시 사용
 * @returns {Promise<{ items: Array<Record<string, unknown>>, modelUsed: 'opus'|'sonnet', anthropicModel: string }>}
 */
/**
 * 섹터별 AI 추가 후보 종목 코드 (코어 제외).
 * @param {{ sector: string, description: string, excludeCodes: string[], aiPromptHint: string, excludeKeywords?: string[], targetCount?: number }} params
 * @returns {Promise<string[]>}
 */
export async function getAIAdditionalCandidates(params) {
  const {
    sector,
    description,
    excludeCodes,
    aiPromptHint,
    excludeKeywords = [],
    targetCount = 10,
  } = params

  const apiKey = cleanEnvSecret(process.env.ANTHROPIC_API_KEY)
  if (!apiKey) {
    console.warn('[Screening AI Candidates] ANTHROPIC_API_KEY 없음 — 추가 후보 생략')
    return []
  }

  const excludeSet = new Set(
    (excludeCodes || []).map((c) => String(c).replace(/\D/g, '').padStart(6, '0')),
  )
  const modelId = SCREENING_CANDIDATE_AI_MODEL

  const prompt = `당신은 한국 주식 시장 전문가입니다.

[섹터 정의]
${sector}: ${description}

[가이드]
${aiPromptHint}

[제외 종목 (이미 포함됨)]
${[...excludeSet].join(', ')}

[제외 키워드]
${excludeKeywords.length > 0 ? excludeKeywords.join(', ') : '(없음)'}

[요청]
한국 증시 (KOSPI + KOSDAQ) 에서 이 섹터에 정확히 속하는 추가 종목 ${targetCount}개를 선정해주세요.

선정 기준:
1. 위 섹터 정의에 명확히 부합
2. 최근 3개월 모멘텀 또는 수주/실적 모멘텀 (가능한 경우)
3. 시가총액 1,000억 이상 (소형주 제외)
4. 코스피200 + 코스닥150 우선

[출력 형식 - JSON]
{
  "codes": ["종목코드", "종목코드", ...]
}

설명 없이 JSON 만 반환.`

  const client = new Anthropic({ apiKey })

  try {
    const response = await createAnthropicMessage(
      client,
      {
        model: modelId,
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      },
      SCREENING_AI_TIMEOUT_MS,
    )

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const parsed = safeJsonParse(text, { context: 'AI Screening Candidates' })
    const rawCodes = Array.isArray(parsed?.codes) ? parsed.codes : []
    const out = []
    const seen = new Set(excludeSet)

    for (const raw of rawCodes) {
      const code = String(raw).replace(/\D/g, '').padStart(6, '0')
      if (!/^\d{6}$/.test(code) || seen.has(code)) continue

      const master = await getStockMasterByCode(code)
      const name =
        master.ok && master.item?.name ? String(master.item.name).trim() : ''

      if (excludeKeywords.length > 0 && name) {
        const blocked = excludeKeywords.some((kw) => kw && name.includes(kw))
        if (blocked) continue
      }

      seen.add(code)
      out.push(code)
      if (out.length >= targetCount) break
    }

    console.log(
      `[Screening AI Candidates] sector=${sector} model=${modelId} 추가=${out.length} codes=${out.join(',')}`,
    )
    return out
  } catch (e) {
    console.error('[Screening AI Candidates] 실패:', e instanceof Error ? e.message : e)
    return []
  }
}

export async function selectTopFiveWithAnalysis(candidates, userId = null, opts = {}) {
  const forced =
    opts.forcedModel === 'opus' || opts.forcedModel === 'sonnet' ? opts.forcedModel : null
  const rows = Array.isArray(candidates) ? candidates.slice(0, 20) : []
  const userModel = forced ?? (await getUserModel(userId))
  const envOverride = process.env.SCREENING_AI_MODEL?.trim()
  const modelId = envOverride || resolveModelId(userModel)
  const maxTokens = userModel === 'opus' ? 4000 : 2500

  if (rows.length === 0) {
    return { items: [], modelUsed: userModel, anthropicModel: modelId }
  }

  const apiKey = cleanEnvSecret(process.env.ANTHROPIC_API_KEY)
  if (!apiKey) {
    console.warn('[Screening AI] ANTHROPIC_API_KEY 없음 — aiTopFive 생략')
    return { items: [], modelUsed: userModel, anthropicModel: modelId }
  }

  const client = new Anthropic({ apiKey })

  const prompt = `너는 한국 주식 단기 스크리너로서, ${rows.length}개 후보 중 다음 주 매수 검토 가치 있는 정확히 5개를 엄선한다.

⚠️ 반드시 정확히 5개 종목을 선정하세요. 4개 또는 6개는 불가.

분석 기준 (복합 추론):
1. 단순 점수 합산 X. 다음을 종합적으로 평가:
   - 펀더멘털: PER vs 5Y 평균, 영업이익률, 컨센 여력
   - 모멘텀: 5일 등락률 + 수급 (외국인/기관 순매수)
   - 타이밍: RSI 과열 정도, 단기 과열 후 조정 가능성
   - 섹터 모멘텀: 같은 섹터 다른 종목 대비 매력

2. 다음 종목은 강력 페널티 (TOP 5 거의 불가):
   - PER 100x 초과 + 영업이익률 5% 미만
   - 컨센 -20% 이상 하향
   - RSI 95+ 극과열

3. 충돌 인지 (중요):
   - 종목 카드는 단기 RSI/ATR 기준 매수/매도 결정
   - 너는 1주~1개월 후보 발굴
   - 같은 종목이라도 "관망검토" 라벨 가능 (즉시 매수 X)

다음 ${rows.length}개 후보를 분석하라:

${rows
  .map((s, i) => {
    const px = s.currentPrice != null && Number.isFinite(Number(s.currentPrice)) ? Number(s.currentPrice) : 0
    const r5 =
      s.return5D != null && Number.isFinite(Number(s.return5D)) ? Number(s.return5D).toFixed(1) : '-'
    const om =
      s.operatingMargin != null && Number.isFinite(Number(s.operatingMargin))
        ? Number(s.operatingMargin).toFixed(1)
        : '-'
    const per = s.per != null && Number(s.per) > 0 ? Number(s.per).toFixed(1) : '-'
    const fy =
      s.fiveYearAvgPer != null && Number(s.fiveYearAvgPer) > 0
        ? Number(s.fiveYearAvgPer).toFixed(1)
        : '-'
    const cu =
      s.consensusUpside != null && Number.isFinite(Number(s.consensusUpside)) && Number(s.consensusUpside) !== 0
        ? Number(s.consensusUpside).toFixed(0)
        : null
    return `${i + 1}. ${resolveScreeningStockDisplayName(s.code, s.name, s.sector)} (${s.code}) - ${s.sector || '—'}
   현재가: ${px > 0 ? px.toLocaleString('ko-KR') : '-'}원, 5일등락 ${r5}%
   룰 점수 ${s.score}점 (구조 ${s.subScores?.structure ?? 0} / 실행 ${s.subScores?.execution ?? 0} / 모멘텀 ${s.subScores?.momentum ?? s.subScores?.market ?? 0} / 수급 ${s.subScores?.supplyDemand ?? 0})
   PER ${per}x (5Y ${fy}x), 영업이익률 ${om}%
   컨센 여력 ${cu != null ? `${cu}%` : '데이터 없음'}`
  })
  .join('\n\n')}

다음 JSON 형식으로만 응답하라 (다른 텍스트 금지):
[
  {
    "code": "종목코드",
    "rank": 1,
    "grade": "A+|A|B+|B|C 등",
    "action": "강력 매수|매수|관심 후보|관망|주의 중 하나 (또는 관심후보|관망검토|주의)",
    "headline": "후보 선정 핵심 (15자 이내, 명사형)",
    "summary": "선정 이유 + 진입 가이드 (자연스러운 길이, 1~3문장, 잘리지 않게 완결)",
    "keyDriver": "핵심 매력 (1~2문장, 구체 수치 + 맥락)",
    "risk": "주의 사항 (1~2문장, 구체 수치 + 맥락)",
    "candidateLabel": "관심후보|관망검토|주의 중 하나 (action 과 동일 계열)",
    "consensusEstimate": "AI 추정 컨센 여력 % 부호 포함 (실제 컨센 데이터 없을 때만, 있으면 null)"
  }
]

⚠️ 가격·등락률·시가총액·목표가(원) 등 절대가격 숫자는 응답에 포함하지 마.
위 프롬프트의 현재가·등락률은 참고용이며 JSON에 다시 넣지 마.
splitPrices, currentPrice, changePct 필드 출력 금지.

⚠️ 절대 금지:
- 추상어: "양호", "관망", "부담", "보입니다"
- candidateLabel 에 "신규매수/분할매수/회피" 사용 (혼란)
- 글자수 제한에 맞춰 인위적으로 문장 중간에서 끊기기

✅ 좋은 응답 예 (존댓말):
- headline: "AI반도체 모멘텀 강세"
- summary: "AI 반도체 사이클 회복으로 5일 +23.4% 급등하며 컨센 +12% 여력이 확보되었습니다. 다만 RSI 93 단기 과열 상태로 즉시 진입보다는 -5~10% 조정 후 분할 매수를 검토하시는 편이 합리적입니다. PER 33.5x도 섹터 평균 대비 과도하지 않아 펀더멘털 뒷받침이 유효합니다."
- keyDriver: "메모리 사이클 회복과 외국인 245억 순매수 4주 연속이 확인되며, 컨센 +12% 추가 여력이 있습니다."
- risk: "RSI 93 극과열로 단기 -10% 조정 가능성이 있으며, 종목 카드에서 TAKE_PROFIT 신호 발생 시 부분 익절을 우선 검토하시기 바랍니다."

❌ 나쁜 예:
- candidateLabel: "분할매수"
- summary: "지금 즉시 매수하라" (금지)
- keyDriver: "외국인 매수세 강함" (반말 금지)

[톤 가이드 - 매우 중요]
headline, summary, keyDriver, risk 등 모든 텍스트는 정중한 존댓말로 작성합니다.
- "~합니다", "~됩니다", "~예상됩니다" 사용
- 반말 ("~함", "~됨", "~예상") 금지
- 매매 권장: "~추천드립니다", "~권장됩니다", "~검토하시기 바랍니다", "~유리할 수 있습니다"
- 분석 표현: "~판단됩니다", "~보여집니다", "~확인됩니다"

예시:
❌ "외국인 매수세 강함" → ✅ "외국인 매수세가 강합니다"
❌ "조정 후 진입 권장" → ✅ "조정 후 진입을 권장드립니다"
❌ "단기 반등 가능" → ✅ "단기 반등이 가능할 것으로 판단됩니다"

[출력 형식]
- JSON 배열만 반환. 추가 설명 텍스트 X
- 응답 첫 글자는 [, 마지막 글자는 ]
- markdown 코드블록 X
`

  console.log('[Screening AI] user model:', userModel, '→', modelId)

  try {
    const response = await createAnthropicMessage(
      client,
      {
        model: modelId,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      },
      SCREENING_AI_TIMEOUT_MS,
    )

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const parsed = safeJsonParse(text, { context: 'AI Screening' })
    if (parsed == null) {
      console.error('[AI Screening] JSON 파싱 실패, tail:', text.slice(-200))
      return { items: [], modelUsed: userModel, anthropicModel: modelId }
    }
    if (!Array.isArray(parsed)) {
      console.error('[AI Screening] 파싱 결과가 배열이 아님:', typeof parsed)
      return { items: [], modelUsed: userModel, anthropicModel: modelId }
    }

    const inputsByCode = new Map(
      rows.map((r) => [String(r.code).replace(/\D/g, '').padStart(6, '0'), r]),
    )

    const mapped = parsed
      .filter((x) => x && typeof x.code === 'string')
      .map((x) => {
        const code = String(x.code).replace(/\D/g, '').padStart(6, '0')
        const input = inputsByCode.get(code)
        if (!input) return null
        const fromField =
          normalizeCandidateLabel(x.candidateLabel) ||
          normalizeCandidateLabel(x.action) ||
          normalizeCandidateLabel(x.recommendation)
        const candidateLabel = fromField || '관망검토'
        return {
          code,
          rank: Number.isFinite(Number(x.rank)) ? Math.max(1, Math.round(Number(x.rank))) : 999,
          grade: clipChars(x.grade, 8),
          action: clipChars(x.action, 24) || candidateLabel,
          headline: clipChars(x.headline, 18),
          summary: normalizeLongText(x.summary, 1200),
          keyDriver: normalizeLongText(x.keyDriver, 600),
          risk: normalizeLongText(x.risk, 600),
          candidateLabel,
          consensusEstimate: normalizeConsensusEstimate(x.consensusEstimate),
        }
      })
      .filter((x) => x != null)
      .filter((x) => ALLOWED_LABEL.has(x.candidateLabel))
      .sort((a, b) => a.rank - b.rank)

    const top = dedupeStocksByCode(mapped).slice(0, 5)

    console.log(`[Screening AI] model=${modelId} rows=${top.length}`)
    return { items: top, modelUsed: userModel, anthropicModel: modelId }
  } catch (e) {
    console.error('[AI Screening] 실패:', e instanceof Error ? e.message : e)
    return { items: [], modelUsed: userModel, anthropicModel: modelId }
  }
}
