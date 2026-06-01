export const RISK_OPTIONS = [
  { v: '안정형', d: '원금 보전 최우선' },
  { v: '안정추구형', d: '낮은 위험, 안정적 수익' },
  { v: '위험중립형', d: '위험과 수익 균형' },
  { v: '적극투자형', d: '높은 수익 위해 위험 감수' },
  { v: '공격투자형', d: '고수익 추구, 큰 변동 감내' },
] as const

export const HORIZON_OPTIONS = [
  { v: '단기', d: '~3개월' },
  { v: '중기', d: '~1년' },
  { v: '장기', d: '1년+' },
] as const

export const GOAL_OPTIONS = [
  { v: '안정수익', d: '예금+α 수준' },
  { v: '시장수익', d: '지수 수준' },
  { v: '고수익', d: '시장 초과 추구' },
] as const

export type ProInvestProfile = {
  risk_profile: string | null
  invest_horizon: string | null
  profit_goal: string | null
}

export const EMPTY_PRO_INVEST_PROFILE: ProInvestProfile = {
  risk_profile: null,
  invest_horizon: null,
  profit_goal: null,
}

export function hasProInvestProfile(profile: ProInvestProfile | null | undefined): boolean {
  return Boolean(
    profile?.risk_profile?.trim() ||
      profile?.invest_horizon?.trim() ||
      profile?.profit_goal?.trim(),
  )
}

export const PRO_PROFILE_HINT_STORAGE_KEY = 'pro_profile_hint_seen'
