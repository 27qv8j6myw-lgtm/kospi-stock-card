import Anthropic from '@anthropic-ai/sdk'
import { cleanEnvSecret } from '../aiClient.mjs'
import { safeJsonParse } from '../lib/safeJson.mjs'
import { getUserModel, resolveModelId } from '../lib/userModel.mjs'

const CACHE_TTL_MS = 60 * 60 * 1000
const cache = new Map()

const DEFAULT_MODEL = 'claude-opus-5'

/** @returns {string} 실제 호출에 쓰는 Anthropic 모델 ID (환경 변수 기본) */
export function scenarioAiModel() {
  return process.env.ANTHROPIC_SCENARIO_MODEL?.trim() || DEFAULT_MODEL
}

function formatAmount(v) {
  if (v == null || v === '') return '-'
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return '-'
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(1)}조`
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(0)}억`
  return `${Math.round(n).toLocaleString('ko-KR')}`
}

/**
 * 분할 매수가가 현재가보다 높지 않도록 보정 (매수 권고 시).
 * @param {Record<string, unknown>} rec
 * @param {number} currentPrice
 */
function validateScenarioRecommendation(rec, currentPrice) {
  const out = { ...rec }
  const action = String(out.action ?? '')
  const isBuy = /매수|관심/.test(action.replace(/\s+/g, '')) && !/회피|관망|매도/.test(action)
  if (!isBuy || !Array.isArray(out.splitPrices)) return out

  const cur = Math.round(currentPrice)
  const fixed = out.splitPrices.map((p) => {
    const n = Number(p)
    if (!Number.isFinite(n) || n <= 0) return p
    if (n > cur) return Math.round(cur * 0.97)
    return Math.round(n)
  })
  const hadHigh = fixed.some((p, i) => Number(out.splitPrices[i]) > cur)
  if (hadHigh) {
    console.warn('[AI Scenario] splitPrices 현재가 초과 — 보정', { code: currentPrice, action })
  }
  out.splitPrices = fixed
  return out
}

function rsiTag(rsi) {
  if (rsi == null || !Number.isFinite(Number(rsi))) return '(중립)'
  const r = Number(rsi)
  if (r >= 70) return '(과매수)'
  if (r <= 30) return '(과매도)'
  return '(중립)'
}

/**
 * 4시나리오 + 종합 권고 (AI 서술만; Final Grade·Strategy·Entry Stage 는 룰 엔진).
 * 종목코드·시간대별 1시간 캐시 (키에 `opus` 포함, 구 Sonnet 캐시와 분리).
 * @param {string} code6
 * @param {Record<string, unknown>} stockData
 * @param {string | null | undefined} userId
 * @returns {Promise<Record<string, unknown> & { source: string } | null>}
 */
export async function analyzeStockScenario(code6, stockData, userId = null) {
  const apiKey = cleanEnvSecret(process.env.ANTHROPIC_API_KEY)
  if (!apiKey) {
    console.error('[AI Scenario] ANTHROPIC_API_KEY 없음')
    return null
  }

  const code = String(code6 || '').replace(/\D/g, '').padStart(6, '0')
  const userModel = await getUserModel(userId)
  const envModel = process.env.ANTHROPIC_SCENARIO_MODEL?.trim()
  const modelId = envModel || resolveModelId(userModel)
  const maxTokens = userModel === 'sonnet' ? 2500 : userModel === 'fable' ? 7000 : 3500

  const bucket = Math.floor(Date.now() / CACHE_TTL_MS)
  const cacheKey = `${code}-${userModel}-${bucket}`
  const hit = cache.get(cacheKey)
  if (hit) {
    return {
      ...hit,
      source: 'cache',
      aiModel: typeof hit.aiModel === 'string' && hit.aiModel.trim() ? hit.aiModel : modelId,
      aiUserModel: hit.aiUserModel ?? userModel,
    }
  }

  const client = new Anthropic({ apiKey })

  const px = stockData.currentPrice != null ? Number(stockData.currentPrice) : Number.NaN
  const ch = stockData.changePct != null ? Number(stockData.changePct) : Number.NaN
  const rsiN = stockData.rsi != null ? Number(stockData.rsi) : Number.NaN
  const atrN = stockData.atrGap != null ? Number(stockData.atrGap) : Number.NaN
  const r5 = stockData.return5D != null ? Number(stockData.return5D) : Number.NaN

  const prompt = `너는 단기 트레이딩 시나리오 분석가다. 1개월 시계에서 4가지 시나리오의 확률과 진입 가이드를 제시한다.

종목: ${stockData.name} (${code}) - ${stockData.sector || ''}
현재가: ${Number.isFinite(px) ? px.toLocaleString('ko-KR') : '-'}원, 등락 ${Number.isFinite(ch) ? ch.toFixed(2) : '-'}%

기술 지표:
- 종합점수 ${stockData.totalScore != null ? stockData.totalScore : '-'}점
- 구조 ${stockData.subScores?.structure ?? 0} / 실행 ${stockData.subScores?.execution ?? 0} / 모멘텀 ${stockData.subScores?.momentum ?? stockData.subScores?.market ?? 0}
- RSI ${Number.isFinite(rsiN) ? rsiN.toFixed(0) : '-'} ${rsiTag(stockData.rsi)}
- ATR 이격 ${Number.isFinite(atrN) ? atrN.toFixed(1) : '-'}
- 5D 등락 ${Number.isFinite(r5) ? r5.toFixed(1) : '-'}%

펀더멘털:
- PER ${stockData.per != null ? Number(stockData.per).toFixed(1) : '-'}x (5Y 평균 ${stockData.fiveYearAvgPer != null ? Number(stockData.fiveYearAvgPer).toFixed(1) : '-'}x)
- 영업이익률 ${stockData.operatingMargin != null ? Number(stockData.operatingMargin).toFixed(1) : '-'}%
- 컨센 평균 ${stockData.consensusAvg != null ? Number(stockData.consensusAvg).toLocaleString('ko-KR') : '-'}원 (현재 대비 ${stockData.consensusUpside != null ? Number(stockData.consensusUpside).toFixed(0) : '-'}%)

수급 (3일):
- 외국인 ${formatAmount(stockData.foreign3D)}
- 기관 ${formatAmount(stockData.institution3D)}

분석 기준 (복합 추론):
1. 4시나리오 확률은 단순 분배 X. 다음을 종합 추론:
   - 추세 강도: 5일 등락 + RSI + 모멘텀 점수 종합
   - 펀더 뒷받침: PER vs 5Y, 영업이익률, 컨센 여력
   - 단기 과열: RSI 70+ 시 조정 가능성 가중
   - 수급: 외국인/기관 일관성

2. 시나리오 4가지는 다음 분류 사용:
   - "강한 추세 지속" (현재 흐름 유지)
   - "단기 조정 후 재상승" (조정 매수 기회)
   - "추세 반전" (펀더 약화 또는 매크로 충격)
   - "횡보" (방향성 부재)

3. 분할 매수가 산출:
   - 시나리오별 확률 가중치 반영
   - 시나리오 2번 (조정 후 재상승) 확률 높으면 → 1차가 현재가 -3~5%, 2차 -7%, 3차 -12%
   - 시나리오 1번 (강한 추세) 확률 높으면 → 1차 현재가, 2차 -5%, 3차 -10%
   - 시나리오 3번 (반전) 확률 25%+ 이면 → 1차 -10%, 2차 -15%, 3차 -20%

4. 종합 권고 액션 4가지:
   - "신규매수": 시나리오 1+2 합산 70%+ AND 펀더 강세
   - "분할매수": 시나리오 2 주도 (조정 후 재상승)
   - "조정대기": 단기 과열 + 시나리오 3 우려
   - "회피": 시나리오 3 우세 OR 펀더 심각

[실행 전략·분할 매수 가격 규칙 - 매우 중요]
위 현재가(${Number.isFinite(px) ? px.toLocaleString('ko-KR') : '-'}원)를 정확한 기준으로 사용합니다. 학습 데이터의 옛 가격은 사용하지 마세요.

A) action 이 "신규매수" / "분할매수" / "관심후보" 계열:
   - splitPrices 3개: 모두 현재가 이하 (조정·분할 매수 구간). 현재가보다 높은 분할가 금지.
   - rationale 에서 목표·상승 전망을 말할 때 현재가 대비 +% 로 표현 (절대가격으로 현재가보다 낮은 '목표' 표현 금지).

B) action 이 "조정대기" / "회피":
   - splitPrices: 현재가 대비 -3% ~ -12% (조정 대기 구간).

⚠️ 절대 규칙:
- 매수·분할매수 권고인데 splitPrices 가 현재가보다 높으면 논리 모순
- 손절·분할 매수가는 롱 기준 진입가(또는 현재가)보다 낮아야 함

JSON 형식으로만 응답 (다른 텍스트 금지):
{
  "scenarios": [
    { "name": "강한 추세 지속", "probability": 40, "priceRange": "+10~15%", "duration": "2-4주", "rationale": "근거 (자연스러운 길이, 구체적 수치 포함)" },
    { "name": "단기 조정 후 재상승", "probability": 35, "priceRange": "-5~10% 조정 후 상승", "duration": "2-4주", "rationale": "..." },
    { "name": "추세 반전", "probability": 15, "priceRange": "-15~20%", "duration": "2-4주", "rationale": "..." },
    { "name": "횡보", "probability": 10, "priceRange": "±5%", "duration": "2-4주", "rationale": "..." }
  ],
  "recommendation": {
    "action": "신규매수|분할매수|조정대기|회피|보유",
    "splitPrices": [1차가격, 2차가격, 3차가격],
    "rationale": "종합 권고 근거 (자연스러운 길이, 구체적 가격 + 시나리오 비중 + 액션 포인트)"
  }
}

⚠️ 절대 금지:
- 추상어: "양호", "관망", "부담", "보입니다", "예상됩니다"
- 시나리오 확률 합 ≠ 100% (반드시 100% 맞춤)
- 분할 가격이 현재가 +10% 이상 (조정 매수가 아닌 추격)

✅ 좋은 응답 예:
- 시나리오 1 rationale: "AI 반도체 사이클 회복으로 외국인 3주 연속 순매수 245억, 5일 +23.4% 모멘텀이 종목 카드 RSI 93 과열 신호를 일시 무시할 수 있는 수준"
- recommendation rationale: "시나리오 2번 (조정 후 재상승) 확률 45% 최대. 1차 1,820,000원 (-7%)부터 분할 진입 시작 권장, RSI 75 이하 복귀 확인 후 2차 진입"

[출력 형식]
- JSON 객체만 반환. 추가 설명 텍스트 X
- 응답 첫 글자는 {, 마지막 글자는 }
- markdown 코드블록 X
`

  console.log('[AI Scenario] user model:', userModel, '→', modelId)

  try {
    const response = await client.messages.create({
      model: modelId,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    })
    const text =
      response.content.find((b) => b.type === 'text')?.text ?? ''
    const parsed = safeJsonParse(text, { context: 'AI Scenario' })
    if (parsed == null) {
      console.error('[AI Scenario] JSON 파싱 실패, tail:', text.slice(-200))
      throw new Error('시나리오 JSON 파싱 실패')
    }
    if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.scenarios)) {
      console.error('[AI Scenario] scenarios 배열 없음 또는 형식 오류:', JSON.stringify(parsed).slice(0, 300))
      throw new Error('시나리오 scenarios 배열 검증 실패')
    }
    if (!parsed.recommendation || typeof parsed.recommendation !== 'object') {
      console.error('[AI Scenario] recommendation 객체 없음')
      throw new Error('시나리오 recommendation 검증 실패')
    }
    const result = /** @type {Record<string, unknown>} */ (parsed)
    if (result.recommendation && typeof result.recommendation === 'object' && Number.isFinite(px)) {
      result.recommendation = validateScenarioRecommendation(
        /** @type {Record<string, unknown>} */ (result.recommendation),
        px,
      )
    }
    const enriched = { ...result, aiModel: modelId, aiUserModel: userModel }
    console.log(`[AI Scenario] model=${modelId} code=${code}`)
    cache.set(cacheKey, enriched)
    return { ...enriched, source: 'fresh' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[AI Scenario] 실패:', msg)
    return null
  }
}
