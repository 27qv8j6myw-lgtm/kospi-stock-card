import Anthropic from '@anthropic-ai/sdk'
import { createAnthropicStream } from '../lib/anthropicTimed.mjs'
import { PRO_ANALYSIS_MAX_TOKENS } from '../lib/opusEngine.mjs'
import { buildProfileContextPrompt, fetchProUserProfile } from '../lib/proUserProfile.mjs'
import { getSupabaseService } from '../lib/supabaseService.mjs'
import { logApiUsage } from '../lib/usageLogger.mjs'
import { resolveModelAndMaxTokens } from '../lib/userModel.mjs'
import { buildArchiveContextPrompt, fetchRecentDiagnoses } from '../lib/diagnosisArchive.mjs'

/**
 * @param {Record<string, unknown>} summary
 * @param {string} code
 * @param {string} [profileContext]
 * @param {string} [archiveContext]
 */
function buildAnalysisPrompt(summary, code, profileContext = '', archiveContext = '') {
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
## [이슈] 최근 뉴스·공시 요약 (호재/악재 구분, 2~3개)
## [전략] 진입가·목표가·손절가 (현재가 기준 구체적 원화 가격, 범위는 물결표 ~ 사용)
## [리스크] 주의 사항 2~3개

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
- 각 섹션을 완결되게 작성 (글자수 제한 없음, 중간에 끊기지 않도록)${archiveContext}`
}

/**
 * @param {{ summary: Record<string, unknown>, code: string, userId?: string, send: (event: string, data: unknown) => void }} opts
 */
export async function runProStockAnalysisStream({ summary, code, userId, send }) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 가 설정되지 않았습니다')
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

  const prompt = buildAnalysisPrompt(summary, code, profileContext, archiveContext)

  const { modelId: stockModel, maxTokens } = await resolveModelAndMaxTokens(userId, {
    opusBase: PRO_ANALYSIS_MAX_TOKENS,
    sonnetBase: 12000,
    cap: 16000,
  })

  send('meta', { model: stockModel, pastDiagnoses })

  /** @type {import('@anthropic-ai/sdk').MessageParam[]} */
  let messages = [{ role: 'user', content: prompt }]
  const maxContinuations = 2

  for (let round = 0; round <= maxContinuations; round += 1) {
    const stream = await createAnthropicStream(client, {
      model: stockModel,
      max_tokens: maxTokens,
      messages,
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        send('text', { delta: event.delta.text })
      }
    }

    const final = await stream.finalMessage()
    if (userId && final.usage) {
      await logApiUsage(userId, 'stock-analysis', stockModel, final.usage)
    }

    if (final.stop_reason !== 'max_tokens' || round >= maxContinuations) break

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

  send('done', {})
}
