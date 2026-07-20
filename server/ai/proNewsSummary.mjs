import Anthropic from '@anthropic-ai/sdk'
import { createAnthropicMessage } from '../lib/anthropicTimed.mjs'
import { logApiUsage } from '../lib/usageLogger.mjs'
import { resolveLightTaskModelId } from '../lib/userModel.mjs'

const NEWS_SUMMARY_TIMEOUT_MS = 25_000

/**
 * 잘린 응답이면 마지막 완성 문장까지만 반환
 * @param {string | null | undefined} text
 * @returns {string | null}
 */
function ensureCompleteSentence(text) {
  if (!text) return text ?? null
  const lastPeriod = Math.max(
    text.lastIndexOf('.'),
    text.lastIndexOf('다.'),
    text.lastIndexOf('니다.'),
    text.lastIndexOf('습니다.'),
  )
  if (lastPeriod > text.length * 0.5) {
    return text.slice(0, lastPeriod + 1)
  }
  return text
}

/**
 * @param {string} stockName
 * @param {Array<{ title?: string }>} news
 * @param {{ userId?: string, code?: string }} [opts]
 * @returns {Promise<string | null>}
 */
export async function summarizeProNewsHeadlines(stockName, news, opts = {}) {
  if (!Array.isArray(news) || news.length < 3) return null

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return null

  const titles = news
    .slice(0, 10)
    .map((n) => `- ${String(n?.title ?? '').trim()}`)
    .filter((line) => line.length > 2)
    .join('\n')

  if (!titles) return null

  const client = new Anthropic({ apiKey })
  // 경량 요약 작업: 비관리자(sonnet 기본)는 haiku 로 비용 절감, opus 부여 사용자는 opus 유지
  const newsModel = await resolveLightTaskModelId(opts.userId)

  try {
    const summaryResp = await createAnthropicMessage(
      client,
      {
        model: newsModel,
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `다음 ${stockName} 관련 최근 뉴스 헤드라인을 단기 매매(1~3개월) 관점에서 3~4문장으로 요약해 주세요.

핵심:
- 주가에 영향 줄 단기 모멘텀 요소
- 호재/악재를 명확히 구분
- 정중한 존댓말, 이모지 금지
- 가격·금액 범위 표기 시 물결표(~) 사용 (예: "5,000~6,000원", X "5,000-6,000원")
- 반드시 완성된 문장으로 마무리
- 특정 개인 호칭·고정 매매 룰 언급 금지

뉴스:
${titles}

요약:`,
          },
        ],
      },
      NEWS_SUMMARY_TIMEOUT_MS,
    )

    if (opts.userId && summaryResp.usage) {
      await logApiUsage(opts.userId, 'news-summary', newsModel, summaryResp.usage)
    }

    const block = summaryResp.content?.find((b) => b.type === 'text')
    const raw = block && 'text' in block ? String(block.text).trim() : ''
    const text = ensureCompleteSentence(raw)
    return text || null
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.warn('[News Summary] 실패:', message)
    return null
  }
}
