/** Anthropic Claude — JSON 채팅 완성 (서버 전용) */

export function cleanEnvSecret(v) {
  if (v == null || typeof v !== 'string') return ''
  let s = v.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim()
  }
  return s
}

/**
 * @returns {{ apiKey: string, model: string } | null}
 */
export function getAiConfig() {
  const apiKey = cleanEnvSecret(process.env.ANTHROPIC_API_KEY)
  if (!apiKey) return null
  const model = process.env.ANTHROPIC_MODEL?.trim() || 'claude-opus-4-7'
  return { apiKey, model }
}

function stripJsonFences(text) {
  const t = String(text || '').trim()
  const m = t.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i)
  if (m) return m[1].trim()
  return t
}

function apiErrorMessage(data, status, label) {
  const msg =
    (typeof data?.error?.message === 'string' && data.error.message) ||
    (typeof data?.error === 'string' && data.error) ||
    (typeof data?.message === 'string' && data.message) ||
    `${label} 오류 (${status})`
  return msg
}

function anthropicTextContent(blocks) {
  if (!Array.isArray(blocks)) return ''
  return blocks
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('')
}

/**
 * system + user 메시지로 JSON 객체 하나를 받는다.
 * @param {{ system: string, user: string, model?: string }} opts
 * @returns {Promise<Record<string, unknown>>}
 */
export async function completeJsonChat({ system, user, model: modelOverride }) {
  const cfg = getAiConfig()
  if (!cfg) {
    throw new Error('AI API 키가 없습니다. .env에 ANTHROPIC_API_KEY를 설정하세요.')
  }
  const model = (modelOverride && String(modelOverride).trim()) || cfg.model
  const jsonTail =
    '\n\n반드시 JSON 객체만 출력하고, 설명 문장·마크다운 코드펜스(```)는 쓰지 마세요.'

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system,
      messages: [{ role: 'user', content: `${user}${jsonTail}` }],
    }),
  })
  const text = await res.text()
  let data = null
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`Claude 응답 파싱 실패: ${text.slice(0, 200)}`)
  }
  if (!res.ok) throw new Error(apiErrorMessage(data, res.status, 'Claude'))
  const content = anthropicTextContent(data?.content)
  if (!content) throw new Error('Claude 응답에 텍스트 content가 없습니다.')
  let json = null
  try {
    json = JSON.parse(stripJsonFences(content))
  } catch {
    throw new Error('Claude content JSON 파싱 실패')
  }
  return json
}

/**
 * JSON 전용 텍스트 완성 (web_search 없음). 분석 2단계 등.
 * @param {{ system: string, user: string, model?: string, maxTokens?: number, timeoutMs?: number }} opts
 * @returns {Promise<string>} assistant 텍스트 (JSON)
 */
export async function completeAnalyzeStockChat({
  system,
  user,
  model: modelOverride,
  maxTokens = 4000,
  timeoutMs = 90_000,
}) {
  const cfg = getAiConfig()
  if (!cfg) {
    throw new Error('AI API 키가 없습니다. .env에 ANTHROPIC_API_KEY를 설정하세요.')
  }
  const model =
    (modelOverride && String(modelOverride).trim()) ||
    process.env.ANTHROPIC_ANALYZE_MODEL?.trim() ||
    'claude-opus-4-7'

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: cfg.apiKey })

  const jsonTail =
    '\n\n반드시 JSON 객체만 출력하고, 설명 문장·마크다운 코드펜스(```)는 쓰지 마세요.'

  let message
  try {
    message = await client.messages.create(
      {
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: `${user}${jsonTail}` }],
      },
      { timeout: timeoutMs },
    )
  } catch (e) {
    if (e && (e.name === 'AbortError' || /timeout/i.test(String(e.message || '')))) {
      throw new Error(`Claude 분석 요청 시간 초과(${timeoutMs / 1000}s)`)
    }
    throw e
  }

  const text = extractAssistantText(message?.content)
  if (!text.trim()) throw new Error('Claude 분석 응답에 텍스트 content가 없습니다.')
  return text
}

/**
 * 평문 한국어 요약 (JSON 강제 없음). 한눈에 보기 한 줄·전략 종합 요약 등.
 * @param {{ system: string, user: string, model?: string, maxTokens?: number, timeoutMs?: number }} opts
 * @returns {Promise<string>}
 */
export async function completePlainTextChat({
  system,
  user,
  model: modelOverride,
  maxTokens = 512,
  timeoutMs = 60_000,
}) {
  const cfg = getAiConfig()
  if (!cfg) {
    throw new Error('AI API 키가 없습니다. .env에 ANTHROPIC_API_KEY를 설정하세요.')
  }
  const model =
    (modelOverride && String(modelOverride).trim()) ||
    process.env.ANTHROPIC_SUMMARY_MODEL?.trim() ||
    'claude-sonnet-4-5'

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: cfg.apiKey })

  let message
  try {
    message = await client.messages.create(
      {
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      },
      { timeout: timeoutMs },
    )
  } catch (e) {
    if (e && (e.name === 'AbortError' || /timeout/i.test(String(e.message || '')))) {
      throw new Error(`Claude 요약 요청 시간 초과(${timeoutMs / 1000}s)`)
    }
    throw e
  }

  const text = extractAssistantText(message?.content)
  if (!text.trim()) throw new Error('Claude 응답에 텍스트 content가 없습니다.')
  return text.trim()
}

/**
 * 메모 3단계 — Sonnet JSON (도구 없음, max_tokens 기본 3000).
 */
export async function completeWriteMemoChat({
  system,
  user,
  model: modelOverride,
  maxTokens = 3000,
  timeoutMs = 90_000,
}) {
  const cfg = getAiConfig()
  if (!cfg) {
    throw new Error('AI API 키가 없습니다. .env에 ANTHROPIC_API_KEY를 설정하세요.')
  }
  const model =
    (modelOverride && String(modelOverride).trim()) ||
    process.env.ANTHROPIC_MEMO_MODEL?.trim() ||
    'claude-sonnet-4-5'

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: cfg.apiKey })

  const jsonTail =
    '\n\n반드시 JSON 객체만 출력하고, 설명 문장·마크다운 코드펜스(```)는 쓰지 마세요.'

  let message
  try {
    message = await client.messages.create(
      {
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: `${user}${jsonTail}` }],
      },
      { timeout: timeoutMs },
    )
  } catch (e) {
    if (e && (e.name === 'AbortError' || /timeout/i.test(String(e.message || '')))) {
      throw new Error(`Claude 메모 요청 시간 초과(${timeoutMs / 1000}s)`)
    }
    throw e
  }

  const text = extractAssistantText(message?.content)
  if (!text.trim()) throw new Error('Claude 메모 응답에 텍스트 content가 없습니다.')
  return text
}

function extractAssistantText(content) {
  if (!Array.isArray(content)) return ''
  return content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n')
}

/**
 * 리서치 단계: web_search 도구 + JSON 최종 응답 (@anthropic-ai/sdk, 30s timeout).
 */
export async function completeResearchStockChat({
  system,
  user,
  model: modelOverride,
  maxTokens = 4000,
  timeoutMs = 30_000,
}) {
  const cfg = getAiConfig()
  if (!cfg) {
    throw new Error('AI API 키가 없습니다. .env에 ANTHROPIC_API_KEY를 설정하세요.')
  }
  const model =
    (modelOverride && String(modelOverride).trim()) ||
    process.env.ANTHROPIC_RESEARCH_MODEL?.trim() ||
    'claude-sonnet-4-5'

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: cfg.apiKey })

  let message
  try {
    message = await client.messages.create(
      {
        model,
        max_tokens: maxTokens,
        system,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: user }],
      },
      {
        timeout: timeoutMs,
        headers: { 'anthropic-beta': 'web-search-2025-03-05' },
      },
    )
  } catch (e) {
    if (e && (e.name === 'AbortError' || /timeout/i.test(String(e.message || '')))) {
      throw new Error(`Claude 리서치 요청 시간 초과(${timeoutMs / 1000}s)`)
    }
    throw e
  }

  const lastText = extractAssistantText(message?.content)
  if (!lastText.trim()) {
    throw new Error('Claude 리서치 응답에 텍스트 content가 없습니다.')
  }
  return lastText
}
