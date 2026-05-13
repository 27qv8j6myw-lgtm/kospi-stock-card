import Anthropic from '@anthropic-ai/sdk'
import { cleanEnvSecret } from '../aiClient.mjs'

/** 비용 절감: 스크리닝 TOP 3만 호출 — Sonnet 4.6 (Opus 아님). `SCREENING_AI_MODEL`로 덮어쓰기 가능 */
const DEFAULT_MODEL = 'claude-sonnet-4-6'

/**
 * 스크리닝 상위 3종목 짧은 분석 (스크리닝 번들과 동일 1시간 캐시 주기에 맞춰 1회/캐시 미스).
 * @param {Array<{ code: string, name: string, sector?: string, score: number, subScores?: object, per?: number, consensusUpside?: number, fiveYearAvgPer?: number }>} topThree
 * @returns {Promise<Array<{ code: string, summary: string, keyDriver: string, risk: string }>>}
 */
export async function analyzeTopThree(topThree) {
  const rows = Array.isArray(topThree) ? topThree.slice(0, 3) : []
  if (rows.length === 0) return []

  const apiKey = cleanEnvSecret(process.env.ANTHROPIC_API_KEY)
  if (!apiKey) {
    console.warn('[Screening AI] ANTHROPIC_API_KEY 없음 — aiAnalyses 생략')
    return []
  }

  const model = process.env.SCREENING_AI_MODEL?.trim() || DEFAULT_MODEL

  const prompt = `다음 3개 한국 주식의 단기 (1개월) 매력도를 간결히 분석하라.

${rows
  .map(
    (s, i) => `
${i + 1}. ${s.name} (${s.code}) - ${s.sector || '—'}
   종합점수: ${s.score}점
   구조 ${s.subScores?.structure ?? '—'}/실행 ${s.subScores?.execution ?? '—'}/모멘텀 ${s.subScores?.momentum ?? s.subScores?.market ?? '—'}/수급 ${s.subScores?.supplyDemand ?? '—'}
   PER ${s.per ?? '—'}x${s.fiveYearAvgPer != null ? ` (5Y 평균 ${s.fiveYearAvgPer}x)` : ''}, 컨센 여력 ${s.consensusUpside ?? '—'}%
`,
  )
  .join('')}

각 종목에 대해 다음 JSON 배열 형식으로만 응답 (다른 텍스트·코드펜스 금지):
[
  { "code": "6자리종목코드", "summary": "1줄 종합 평가 (30자 이내)", "keyDriver": "핵심 매수 근거 (40자 이내)", "risk": "주요 리스크 (40자 이내)" },
  ...
]

평가 기준: 단기 트레이더 관점. 펀더멘털 + 모멘텀 + 밸류에이션 종합.`

  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model,
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = response.content?.[0]
  const text = block && block.type === 'text' ? block.text : ''
  const jsonMatch = String(text).match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    throw new Error('AI 응답에서 JSON 배열 추출 실패')
  }

  const parsed = JSON.parse(jsonMatch[0])
  if (!Array.isArray(parsed)) return []

  return parsed
    .filter((x) => x && typeof x.code === 'string')
    .map((x) => ({
      code: String(x.code).replace(/\D/g, '').padStart(6, '0'),
      summary: String(x.summary ?? '').slice(0, 80),
      keyDriver: String(x.keyDriver ?? '').slice(0, 100),
      risk: String(x.risk ?? '').slice(0, 100),
    }))
}
