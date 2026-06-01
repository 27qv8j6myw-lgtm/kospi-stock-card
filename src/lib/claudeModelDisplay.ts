/**
 * UI 표시용 Claude 모델 — Pro 채팅·분석 기본 모델과 동기화
 * (server: PRO_CHAT_MODEL / DEFAULT_MODEL in server/lib/pricing.mjs)
 */
export const PRO_CLAUDE_MODEL_ID = 'claude-opus-4-8'

const MODEL_DISPLAY_LABELS: Record<string, string> = {
  'claude-opus-4-8': 'Opus 4.8',
  'claude-opus-4-6': 'Opus 4.6',
  'claude-sonnet-4-6': 'Sonnet 4.6',
  'claude-sonnet-4-5': 'Sonnet 4.5',
  'claude-haiku-4-5': 'Haiku 4.5',
}

/** 헤더 배지 · 툴팁 */
export const PRO_CLAUDE_MODEL_LABEL =
  MODEL_DISPLAY_LABELS[PRO_CLAUDE_MODEL_ID] ?? 'Opus 4.8'

/** 프로필 옆 배지 (모바일 포함 OPUS 표기) */
export const PRO_CLAUDE_MODEL_BADGE = 'OPUS 4.8'
