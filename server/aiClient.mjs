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
