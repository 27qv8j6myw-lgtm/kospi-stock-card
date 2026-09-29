/**
 * UI 표시용 Claude 모델 라벨 — 서버가 내려준 실제 모델 ID 기준
 * (server: resolveModelId / modelRegistry 가 /v1/models 최신을 자동 선택)
 */

/**
 * 모델 ID를 표시용 라벨로 변환.
 * 예: claude-opus-5-5 → Opus 5.5, claude-fable-5-1 → Fable 5.1, claude-opus-5 → Opus 5,
 * 날짜 스냅샷 접미사(claude-haiku-4-5-20251001)는 버전으로 보지 않는다.
 */
export function formatModelLabel(id: string | null | undefined): string {
  if (!id) return ''
  const m = id.match(/claude-(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d+))?/i)
  if (!m) return id
  const fam = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()
  const minor = m[3] && !/^\d{8}$/.test(m[3]) ? `.${m[3]}` : ''
  return `${fam} ${m[2]}${minor}`
}
