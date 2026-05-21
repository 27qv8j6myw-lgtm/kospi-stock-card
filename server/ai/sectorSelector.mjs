import Anthropic from '@anthropic-ai/sdk'
import { cleanEnvSecret } from '../aiClient.mjs'
import { safeJsonParse } from '../lib/safeJson.mjs'
import {
  createAnthropicMessage,
  SCREENING_AI_TIMEOUT_MS,
  SCREENING_SECTOR_AI_TIMEOUT_MS,
} from '../lib/anthropicTimed.mjs'
import { SCREENING_CANDIDATE_AI_MODEL } from './screeningAnalysis.mjs'

/**
 * @param {number | null | undefined} n
 */
function fmtPct(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '-'
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}`
}

/**
 * @param {import('../lib/marketDataCollector.mjs').collectMarketData extends () => Promise<infer R> ? R : never} marketData
 */
function buildSectorSelectionPrompt(marketData) {
  const volLines = (marketData.topVolume || [])
    .slice(0, 50)
    .map(
      (s) =>
        `${s.code} ${s.name} (${s.sector || '?'}) - 거래대금 ${(Number(s.tradingValue) / 1e8).toFixed(0)}억, ${fmtPct(s.changePct)}%`,
    )
    .join('\n')

  const momLines = (marketData.topMomentum || [])
    .slice(0, 30)
    .map((s) => `${s.code} ${s.name} (${s.sector || '?'}) - 3일 ${fmtPct(s.return3D)}%`)
    .join('\n')

  const frgnLines = (marketData.topForeign || [])
    .slice(0, 30)
    .map(
      (s) =>
        `${s.code} ${s.name} (${s.sector || '?'}) - 순매수 ${(Number(s.foreignNet) / 1e8).toFixed(0)}억`,
    )
    .join('\n')

  return `당신은 한국 주식 시장 분석가입니다. 오늘의 시장 데이터를 분석해 자금이 집중된 섹터를 선정하세요.

[시장 데이터]
거래대금 상위 50개:
${volLines || '(없음)'}

3일 모멘텀 상위 30개:
${momLines || '(없음)'}

외국인 순매수 상위 30개:
${frgnLines || '(없음)'}

[분석 가이드]
1. 위 데이터에서 섹터별 자금 흐름 파악
2. 정말 강세인 섹터 1~5개 선정 (강제로 5개 채우지 마. 1개만 압도적이면 1개, 5개 골고루면 5개)
3. 각 섹터의 핵심 종목 코드 8-10개 추출 (TOP 5 선정용 후보)
4. 시장 전체 흐름 한 줄 요약

[섹터 분류 가이드]
한국 시장 주요 섹터:
- 반도체 (메모리/장비/소재/패키지 - FC-BGA, HBM)
- AI 인프라/전력기기 (변압기, 차단기, 송배전)
- 원자력/SMR
- 조선 (조선업체, 엔진, 기자재)
- 방산 (무기체계, 항공우주)
- 건설/플랜트
- 2차전지 (셀, 4대 소재)
- 자동차 (완성차, 부품)
- 바이오, 화학, 엔터, 금융, 통신 등 (필요 시)

⚠️ 무관 종목 제외 (예: 가전 회사를 전력기기로 분류 X)

[출력 형식 - JSON 만, 설명 X]
{
  "marketSummary": "오늘 시장 한 줄 요약 (60자 이내). 정중한 존댓말로 작성. 예: '반도체 약세 속 방산·전력기기 종목으로 자금이 유입되고 있습니다'",
  "sectors": [
    {
      "rank": 1,
      "name": "섹터명",
      "flow": "+8.4",
      "reason": "자금 유입 이유 (50자 이내, 존댓말. '~습니다', '~됩니다' 어미)",
      "candidateCodes": ["267260", "062040"]
    }
  ]
}

[톤 가이드 - 매우 중요]
모든 텍스트 출력(marketSummary, reason)은 정중한 존댓말로 작성합니다.
- "~합니다", "~됩니다", "~예상됩니다" 사용
- 반말 ("~함", "~됨", "~예상") 금지
- 분석 표현: "~판단됩니다", "~보여집니다", "~확인됩니다"

예시:
❌ "외국인 매수세 강함"
✅ "외국인 매수세가 강합니다"

❌ "조정 후 진입 권장"
✅ "조정 후 진입을 권장드립니다"

❌ "단기 반등 가능"
✅ "단기 반등이 가능할 것으로 판단됩니다"

❌ "데이터센터 전력 수요 폭증, 외국인 변압기 종목 집중 매수"
✅ "데이터센터 전력 수요가 증가하고 있으며, 외국인 변압기 종목 매수가 집중되고 있습니다"

응답 첫 글자는 {, 마지막 글자는 } 여야 합니다.`
}

/**
 * @param {Awaited<ReturnType<import('../lib/marketDataCollector.mjs').collectMarketData>>} marketData
 * @param {{ modelId?: string }} [opts]
 */
export async function selectActiveSectors(marketData, opts = {}) {
  const apiKey = cleanEnvSecret(process.env.ANTHROPIC_API_KEY)
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 없음')
  }

  const client = new Anthropic({ apiKey })
  const prompt = buildSectorSelectionPrompt(marketData)
  const model = opts.modelId?.trim() || SCREENING_CANDIDATE_AI_MODEL

  const response = await createAnthropicMessage(
    client,
    {
      model,
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    },
    SCREENING_SECTOR_AI_TIMEOUT_MS,
  )

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const parsed = safeJsonParse(text, { context: 'AI Sector Select' })

  if (!parsed?.sectors || !Array.isArray(parsed.sectors)) {
    throw new Error('AI 섹터 선정 응답 형식 오류')
  }

  const sectors = parsed.sectors
    .slice(0, 5)
    .map((s, idx) => ({
      rank: Number.isFinite(Number(s.rank)) ? Math.round(Number(s.rank)) : idx + 1,
      name: String(s.name ?? '').trim() || `섹터${idx + 1}`,
      flow: String(s.flow ?? '').trim() || '+0',
      reason: String(s.reason ?? '').trim(),
      candidateCodes: Array.isArray(s.candidateCodes)
        ? [
            ...new Set(
              s.candidateCodes
                .map((c) => String(c).replace(/\D/g, '').padStart(6, '0'))
                .filter((c) => /^\d{6}$/.test(c)),
            ),
          ].slice(0, 12)
        : [],
    }))
    .filter((s) => s.candidateCodes.length > 0)

  return {
    marketSummary: String(parsed.marketSummary ?? '').trim(),
    sectors,
  }
}

/**
 * 섹터 후보 부족 시 추가 종목 코드 요청 (Sonnet).
 * @param {{ sectorName: string, existing: string[], needed: number, modelId?: string }} params
 * @returns {Promise<string[]>}
 */
export async function requestAdditionalCandidates({ sectorName, existing, needed, modelId }) {
  const apiKey = cleanEnvSecret(process.env.ANTHROPIC_API_KEY)
  if (!apiKey || needed <= 0) return []

  const excludeSet = new Set(
    (existing || []).map((c) => String(c).replace(/\D/g, '').padStart(6, '0')),
  )

  const prompt = `한국 주식 시장 ${sectorName} 섹터의 종목 중 다음에 포함되지 않은 종목 ${needed}개를 추가로 알려주세요.

[이미 포함된 종목]
${[...excludeSet].join(', ') || '(없음)'}

[조건]
- 한국 증시 (KOSPI + KOSDAQ) 상장 종목
- 실제 존재하는 종목 코드만 (확실하지 않으면 제외)
- 시가총액 500억 이상

[출력 형식 - JSON 만]
{ "codes": ["종목코드", "종목코드", ...] }`

  const client = new Anthropic({ apiKey })
  const model = modelId?.trim() || SCREENING_CANDIDATE_AI_MODEL

  try {
    const response = await createAnthropicMessage(
      client,
      {
        model,
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      },
      SCREENING_AI_TIMEOUT_MS,
    )

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const parsed = safeJsonParse(text, { context: 'AI Additional Candidates' })
    const rawCodes = Array.isArray(parsed?.codes) ? parsed.codes : []
    const out = []
    for (const raw of rawCodes) {
      const code = String(raw).replace(/\D/g, '').padStart(6, '0')
      if (!/^\d{6}$/.test(code) || excludeSet.has(code)) continue
      excludeSet.add(code)
      out.push(code)
      if (out.length >= needed) break
    }
    return out
  } catch (e) {
    console.error(
      '[AI Additional Candidates] 실패:',
      e instanceof Error ? e.message : e,
    )
    return []
  }
}
