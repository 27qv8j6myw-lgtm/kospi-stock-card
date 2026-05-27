import Anthropic from '@anthropic-ai/sdk'
import { createAnthropicMessage } from '../lib/anthropicTimed.mjs'
import { OPUS_TOOL_MODEL } from '../lib/opusEngine.mjs'
import { searchStocksMaster } from '../lib/stocksMasterSearch.mjs'

const HOLDINGS_OCR_PROMPT = `이 이미지는 증권사 앱의 보유종목(잔고) 화면입니다.
표에서 각 종목의 정보를 추출해주세요.

추출할 항목:
- name: 종목명 (한글)
- quantity: 보유 수량 (숫자만)
- avgPrice: 평균 단가/매입가 (숫자만, 원 단위)

규칙:
- 종목명/수량/평단가가 명확한 항목만 추출
- 계좌번호, 잔고, 개인정보는 추출하지 말 것
- 평단가가 "매입가", "평균단가", "매입단가" 등으로 표시될 수 있음
- 수량 단위(주) 제거하고 숫자만
- 가격의 쉼표(,) 제거하고 숫자만

다음 JSON 형식으로만 응답 (다른 설명 없이):
{
  "stocks": [
    { "name": "종목명", "quantity": 숫자, "avgPrice": 숫자 }
  ]
}

추출 불가능하면: { "stocks": [] }`

const ALLOWED_MEDIA = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BASE64_CHARS = 6_500_000

/**
 * @param {string} text
 */
function parseVisionJson(text) {
  const cleaned = String(text || '')
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim()
  try {
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed?.stocks) ? parsed.stocks : []
  } catch {
    const match = cleaned.match(/\{[\s\S]*"stocks"[\s\S]*\}/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        return Array.isArray(parsed?.stocks) ? parsed.stocks : []
      } catch {
        return []
      }
    }
    return []
  }
}

/**
 * @param {unknown} raw
 */
function toPositiveNumber(raw) {
  const n = Number(String(raw ?? '').replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * @param {string} name
 */
async function matchStockByName(name) {
  const trimmed = String(name || '').trim()
  if (!trimmed) return { code: null, matchedName: null }

  const result = await searchStocksMaster(trimmed, 5)
  if (!result.ok || !result.items?.length) {
    return { code: null, matchedName: null }
  }

  const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase()
  const target = norm(trimmed)

  const exact = result.items.find((r) => norm(r.name) === target)
  if (exact) {
    return { code: exact.code, matchedName: exact.name }
  }

  const starts = result.items.find(
    (r) => norm(r.name).startsWith(target) || target.startsWith(norm(r.name)),
  )
  if (starts) {
    return { code: starts.code, matchedName: starts.name }
  }

  const first = result.items[0]
  return { code: first.code, matchedName: first.name }
}

/**
 * @param {string} imageBase64
 * @param {string} [mediaType]
 * @returns {Promise<Array<{ name: string, code: string | null, matchedName: string | null, quantity: number, avgPrice: number }>>}
 */
export async function extractHoldingsFromImage(imageBase64, mediaType = 'image/jpeg') {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 가 설정되지 않았습니다')
  }

  const data = String(imageBase64 || '').replace(/\s/g, '')
  if (!data) {
    throw new Error('이미지 필요')
  }
  if (data.length > MAX_BASE64_CHARS) {
    throw new Error('이미지가 너무 큽니다. 더 작은 이미지로 다시 시도해 주세요.')
  }

  const mt = ALLOWED_MEDIA.has(mediaType) ? mediaType : 'image/jpeg'
  const client = new Anthropic({ apiKey })
  const timeoutMs = Number(process.env.PRO_HOLDINGS_OCR_TIMEOUT_MS) || 90_000

  const response = await createAnthropicMessage(
    client,
    {
      model: OPUS_TOOL_MODEL,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mt,
                data,
              },
            },
            { type: 'text', text: HOLDINGS_OCR_PROMPT },
          ],
        },
      ],
    },
    timeoutMs,
  )

  const text = response.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n')

  const rawStocks = parseVisionJson(text)
  const enriched = []

  for (const row of rawStocks) {
    const name = String(row?.name ?? '').trim()
    const quantity = toPositiveNumber(row?.quantity)
    const avgPrice = toPositiveNumber(row?.avgPrice)
    if (!name || quantity == null || avgPrice == null) continue

    const { code, matchedName } = await matchStockByName(name)
    enriched.push({
      name,
      code,
      matchedName,
      quantity,
      avgPrice,
    })
  }

  return enriched
}
