/**
 * Pro 투자 프로필 (성향/기간/목표) — user_settings
 */

export const RISK_PROFILE_VALUES = [
  '안정형',
  '안정추구형',
  '위험중립형',
  '적극투자형',
  '공격투자형',
]

export const INVEST_HORIZON_VALUES = ['단기', '중기', '장기']

export const PROFIT_GOAL_VALUES = ['안정수익', '시장수익', '고수익']

/**
 * @param {string} message
 */
function schemaProfileError(message) {
  if (/invest_horizon|risk_profile|profit_goal|schema cache/i.test(message)) {
    const err = new Error(
      '투자 프로필 DB 컬럼이 없습니다. Supabase에서 scripts/supabase-pro-user-profile.sql 을 실행해 주세요.',
    )
    err.status = 503
    return err
  }
  return new Error(message)
}

/**
 * @typedef {{ risk_profile?: string | null, invest_horizon?: string | null, profit_goal?: string | null }} ProUserProfile
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseService
 * @param {string} userId
 * @returns {Promise<ProUserProfile>}
 */
export async function fetchProUserProfile(supabaseService, userId) {
  const { data, error } = await supabaseService
    .from('user_settings')
    .select('risk_profile, invest_horizon, profit_goal')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    const msg = error.message || ''
    if (/invest_horizon|risk_profile|profit_goal|schema cache/i.test(msg)) {
      const err = new Error(
        '투자 프로필 DB 컬럼이 없습니다. Supabase에서 scripts/supabase-pro-user-profile.sql 을 실행해 주세요.',
      )
      err.status = 503
      throw err
    }
    console.warn('[Pro Profile] fetch', msg)
    return {}
  }

  return {
    risk_profile: data?.risk_profile ?? null,
    invest_horizon: data?.invest_horizon ?? null,
    profit_goal: data?.profit_goal ?? null,
  }
}

/**
 * @param {ProUserProfile | null | undefined} profile
 * @returns {boolean}
 */
export function hasProInvestProfile(profile) {
  return Boolean(
    profile?.risk_profile?.trim() ||
      profile?.invest_horizon?.trim() ||
      profile?.profit_goal?.trim(),
  )
}

/**
 * @param {ProUserProfile | null | undefined} profile
 * @returns {string}
 */
export function buildProfileContextPrompt(profile) {
  if (!hasProInvestProfile(profile)) return ''

  const risk = profile?.risk_profile?.trim() || '미설정'
  const horizon = profile?.invest_horizon?.trim() || '미설정'
  const goal = profile?.profit_goal?.trim() || '미설정'

  return `

[보조 — 사용자 투자 프로필] (관점 조정만, 분석 상세도·깊이는 위 [핵심] 지시를 그대로 유지)
- 투자성향: ${risk} / 투자기간: ${horizon} / 목표수익: ${goal}
- 이 성향·기간·목표 관점을 반영하되, 지표·수급·차트·펀더멘털·뉴스·공시 설명은 이전처럼 전부 상세히 작성할 것
- 성향은 진입·목표·손절 판단의 강도·비중 조정에만 반영 (공격형·단기·고수익→모멘텀 가중, 안정형·장기→펀더멘털 가중)
- 요약·간결·생략 지시를 따르지 말 것 — 프로필 때문에 분석을 짧게 쓰지 말 것
- 프로필 무관하게 하방 위험·리스크는 반드시 명확히 경고, 무모한 추천(풀매수 등) 금지, 투자 권유 아님
- 맨 첫 줄만: "📊 ${risk}·${horizon} 관점 분석" (이 줄만 📊 1개 허용)`
}

/**
 * @param {unknown} raw
 * @param {readonly string[]} allowed
 * @returns {string | null | undefined}
 */
function pickAllowed(raw, allowed) {
  if (raw === undefined) return undefined
  if (raw === null || raw === '') return null
  const v = String(raw).trim()
  if (!allowed.includes(v)) {
    const err = new Error(`허용되지 않은 값: ${v}`)
    err.status = 400
    throw err
  }
  return v
}

/**
 * @param {Record<string, unknown>} body
 * @returns {{ risk_profile?: string | null, invest_horizon?: string | null, profit_goal?: string | null }}
 */
export function parseProfilePatch(body) {
  const patch = {
    risk_profile: pickAllowed(body?.risk_profile, RISK_PROFILE_VALUES),
    invest_horizon: pickAllowed(body?.invest_horizon, INVEST_HORIZON_VALUES),
    profit_goal: pickAllowed(body?.profit_goal, PROFIT_GOAL_VALUES),
  }

  if (
    patch.risk_profile === undefined &&
    patch.invest_horizon === undefined &&
    patch.profit_goal === undefined
  ) {
    const err = new Error('risk_profile, invest_horizon, profit_goal 중 하나 이상 필요')
    err.status = 400
    throw err
  }

  return patch
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseService
 * @param {string} userId
 * @param {{ risk_profile?: string | null, invest_horizon?: string | null, profit_goal?: string | null }} patch
 * @returns {Promise<ProUserProfile>}
 */
export async function saveProUserProfile(supabaseService, userId, patch) {
  const { data: existing } = await supabaseService
    .from('user_settings')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  const row = {
    ...patch,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const { error } = await supabaseService.from('user_settings').update(row).eq('user_id', userId)
    if (error) throw schemaProfileError(error.message)
  } else {
    const { error } = await supabaseService.from('user_settings').insert({
      user_id: userId,
      ...row,
    })
    if (error) throw schemaProfileError(error.message)
  }

  return fetchProUserProfile(supabaseService, userId)
}
