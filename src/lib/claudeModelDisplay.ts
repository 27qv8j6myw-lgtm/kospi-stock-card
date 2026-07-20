/**
 * UI 표시용 Claude 모델 — Pro 채팅·분석 기본 모델과 동기화
 * (server: PRO_CHAT_MODEL / DEFAULT_MODEL in server/lib/pricing.mjs)
 */
export const PRO_CLAUDE_MODEL_ID = 'claude-opus-4-8'

const MODEL_DISPLAY_LABELS: Record<string, string> = {
  'claude-fable-5': 'Fable 5',
  'claude-opus-4-8': 'Opus 4.8',
  'claude-opus-4-6': 'Opus 4.6',
  'claude-sonnet-4-6': 'Sonnet 4.6',
  'claude-sonnet-4-5': 'Sonnet 4.5',
  'claude-haiku-4-5': 'Haiku 4.5',
}

/**
 * 모델 ID를 표시용 라벨로 변환.
 * 버전 접미사가 붙은 ID(예: claude-opus-4-8-20250101)도 처리한다.
 */
export function formatModelLabel(id: string | null | undefined): string {
  if (!id) return ''
  if (MODEL_DISPLAY_LABELS[id]) return MODEL_DISPLAY_LABELS[id]
  const single = id.match(/claude-(fable|mythos)-(\d+)/i)
  if (single) {
    const fam = single[1].charAt(0).toUpperCase() + single[1].slice(1).toLowerCase()
    return `${fam} ${single[2]}`
  }
  const m = id.match(/claude-(opus|sonnet|haiku)-(\d+)-(\d+)/i)
  if (!m) return id
  const fam = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()
  return `${fam} ${m[2]}.${m[3]}`
}

/** 헤더 배지 · 툴팁 */
export const PRO_CLAUDE_MODEL_LABEL =
  MODEL_DISPLAY_LABELS[PRO_CLAUDE_MODEL_ID] ?? 'Opus 4.8'

/** 프로필 옆 배지 (모바일 포함 OPUS 표기) */
export const PRO_CLAUDE_MODEL_BADGE = 'OPUS 4.8'
