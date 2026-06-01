const OVERLOADED_USER_MESSAGE =
  'AI 서버가 잠시 혼잡해요. 잠시 후 다시 시도해주세요 🙏'

export type ProChatErrorType = 'overloaded' | 'general'

/** 에러 카드용 — overloaded vs 일반 */
export function classifyProChatError(message: string): ProChatErrorType {
  const s = String(message || '')
  if (/혼잡|overloaded_error|Overloaded|"type"\s*:\s*"overloaded_error"/i.test(s)) {
    return 'overloaded'
  }
  if (/529|rate\s*limit/i.test(s) && /error|overloaded/i.test(s)) return 'overloaded'
  if (s.length > 120 && s.includes('{') && /overloaded/i.test(s)) return 'overloaded'
  return 'general'
}

/** 채팅 UI — raw Anthropic overloaded JSON 숨김 */
export function friendlyProChatError(message: string): string {
  const s = String(message || '').trim()
  if (!s) return s
  if (/혼잡/.test(s)) return OVERLOADED_USER_MESSAGE
  if (/overloaded_error|Overloaded|"type"\s*:\s*"overloaded_error"/i.test(s)) {
    return OVERLOADED_USER_MESSAGE
  }
  if (/529|rate\s*limit/i.test(s) && /error|overloaded/i.test(s)) {
    return OVERLOADED_USER_MESSAGE
  }
  if (s.length > 120 && s.includes('{') && /overloaded/i.test(s)) {
    return OVERLOADED_USER_MESSAGE
  }
  return s
}
