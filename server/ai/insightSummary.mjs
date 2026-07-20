import Anthropic from '@anthropic-ai/sdk'
import { cleanEnvSecret } from '../aiClient.mjs'
import { getUserModel, resolveModelId } from '../lib/userModel.mjs'

const cache = new Map()
const CACHE_TTL_MS = 30 * 60 * 1000
/** 프롬프트·길이 정책 바뀔 때만 올려 캐시 무효화 */
const CACHE_PROMPT_VERSION = '4'

/**
 * @param {string} code
 * @param {'opus'|'sonnet'} userModel
 */
function cacheBucketKey(code, userModel) {
  // 티어별 캐시 분리 (fable 관리자가 sonnet 캐시를 받지 않도록 원본 티어 유지)
  const m = userModel === 'sonnet' ? 'sonnet' : userModel === 'fable' ? 'fable' : 'opus'
  return `${CACHE_PROMPT_VERSION}-${m}-${code}-${Math.floor(Date.now() / CACHE_TTL_MS)}`
}

/** 유니코드 문자 기준 최대 글자수 (한글·이모지 1글자 = 1) */
function clipChars(s, max) {
  const arr = Array.from(String(s ?? ''))
  return arr.length <= max ? arr.join('') : arr.slice(0, max).join('')
}

/**
 * summary: 마침표 보정 + 과장 시 첫 문장만 + 50자 캡
 * @param {string} raw
 * @returns {string}
 */
function finalizeInsightSummary(raw) {
  let s = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return ''

  if (!/[.。]$/.test(s)) {
    console.warn('[AI Insight] summary 마침표 없음, 보정:', s.slice(0, 80))
    s = `${s}.`
  }

  if (Array.from(s).length > 60) {
    const dot = s.indexOf('.')
    if (dot > 0) s = s.slice(0, dot + 1).trim()
  }

  return clipChars(s, 50)
}

/**
 * 한눈에 보기용 초단문 AI 요약
 * @param {string} code
 * @param {object} data - 종목 카드 핵심 데이터
 * @param {string | null | undefined} userId
 */
export async function summarizeInsight(code, data, userId) {
  const apiKey = cleanEnvSecret(process.env.ANTHROPIC_API_KEY)
  if (!apiKey) {
    console.warn('[AI Insight] ANTHROPIC_API_KEY 없음')
    return null
  }

  const userModel = userId ? await getUserModel(userId) : 'sonnet'
  const model = resolveModelId(userModel)

  const cacheKey = cacheBucketKey(code, userModel)
  if (cache.has(cacheKey)) {
    return { ...cache.get(cacheKey), source: 'cache', model: userModel }
  }
  const client = new Anthropic({ apiKey })

  const sub = data.subScores || {}
  const mom = sub.momentum ?? sub.market
  const prompt = `다음 종목의 현재 상태를 짧게 진단하라.

종목: ${data.name} (${code})
현재가: ${data.currentPrice != null ? Number(data.currentPrice).toLocaleString('ko-KR') : '—'}원, 등락 ${data.changePct != null && Number.isFinite(Number(data.changePct)) ? Number(data.changePct).toFixed(2) : '—'}%
종합점수: ${data.totalScore != null ? data.totalScore : '—'}점
RSI ${data.rsi != null && Number.isFinite(Number(data.rsi)) ? Number(data.rsi).toFixed(0) : '—'} / ATR 이격 ${data.atrGap != null && Number.isFinite(Number(data.atrGap)) ? Number(data.atrGap).toFixed(1) : '—'}
구조 ${sub.structure ?? '—'} / 실행 ${sub.execution ?? '—'} / 모멘텀 ${mom ?? '—'} / 수급 ${sub.supplyDemand ?? '—'}
PER ${data.per != null && Number(data.per) > 0 ? Number(data.per).toFixed(1) : '—'}x (5Y ${data.fiveYearAvgPer != null && Number(data.fiveYearAvgPer) > 0 ? Number(data.fiveYearAvgPer).toFixed(1) : '—'}x)
영업이익률 ${data.operatingMargin != null && Number.isFinite(Number(data.operatingMargin)) ? Number(data.operatingMargin).toFixed(1) : '—'}%
컨센 여력 ${data.consensusUpside != null && Number.isFinite(Number(data.consensusUpside)) ? Number(data.consensusUpside).toFixed(0) : '—'}%

JSON 형식으로만 응답 (다른 텍스트 금지):
{
  "headline": "현재 국면 진단 (10자 이내, 명사형)",
  "summary": "핵심 액션 1문장 (반드시 50자 이내, 유니코드 글자 수 기준, 마침표로 끝)",
  "action": "신규매수|분할매수|보유|일부익절|전량익절|회피 중 하나"
}

⚠️ 절대 금지:
- 줄바꿈 (\\n 사용 금지)
- 50자 초과
- 마침표(.) 없이 끝내기
- 추상어: "관망", "양호", "보입니다"

✅ 좋은 예시 (모두 50자 이내):
- "RSI 79 과매수에 종합 38점. 신규 진입 중단."
- "구조 75점 강세, 컨센 +18%. 현재가 분할 진입."
- "RSI 93 극과열. 즉시 청산 후 -10% 조정 대기."

❌ 나쁜 예시:
- 80자 넘는 장문 (잘림 발생)
- 마침표 없음`

  const runOnce = async (userContent) => {
    const response = await client.messages.create({
      model,
      max_tokens: 700,
      messages: [{ role: 'user', content: userContent }],
    })
    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    return JSON.parse(jsonMatch[0])
  }

  try {
    let result = await runOnce(prompt)
    if (!result || typeof result !== 'object') {
      console.error('[AI Insight] JSON 추출 실패')
      return null
    }

    let summary = finalizeInsightSummary(result.summary)

    if (!summary || Array.from(summary).length < 8) {
      const retryPrompt = `${prompt}

⚠️ 직전 응답이 비었거나 너무 짧음. summary 를 20~50자 한 문장으로, 반드시 마침표로 끝내라.`
      const second = await runOnce(retryPrompt)
      if (second && typeof second === 'object') {
        result = { ...result, headline: second.headline ?? result.headline, action: second.action ?? result.action }
        summary = finalizeInsightSummary(second.summary)
      }
    }

    const normalized = {
      headline: clipChars(result.headline, 10),
      summary,
      action: String(result.action ?? '').slice(0, 20),
    }
    cache.set(cacheKey, normalized)
    return { ...normalized, source: 'fresh', model: userModel }
  } catch (e) {
    console.error('[AI Insight] 실패:', e instanceof Error ? e.message : e)
    return null
  }
}
