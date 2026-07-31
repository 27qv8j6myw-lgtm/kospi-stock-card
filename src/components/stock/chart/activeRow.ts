/**
 * recharts 3 의 차트 이벤트는 payload 가 아니라 활성 인덱스만 준다.
 * (`MouseHandlerDataParam` — activeTooltipIndex / isTooltipActive)
 */
export type ActiveState = {
  activeTooltipIndex?: number | string | null
  isTooltipActive?: boolean
}

/** recharts 3 차트 이벤트 payload → activeRow 입력 */
export function chartHoverState(state: unknown): ActiveState | null {
  if (!state || typeof state !== 'object') return null
  const s = state as ActiveState
  if (!s.isTooltipActive) return null
  return s
}

export function activeRow<T>(state: ActiveState | null | undefined, rows: T[]): T | null {
  if (!state?.isTooltipActive) return null
  if (state.activeTooltipIndex == null) return null
  const idx = Number(state.activeTooltipIndex)
  if (!Number.isInteger(idx) || idx < 0 || idx >= rows.length) return null
  return rows[idx]
}
