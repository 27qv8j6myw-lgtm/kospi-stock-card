'use client'

import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api'
import { apiUrl } from '@/lib/apiBase'
import { EMPTY_PRO_INVEST_PROFILE, type ProInvestProfile } from '@/lib/proInvestProfile'

export type ProInvestProfileField = 'risk_profile' | 'invest_horizon' | 'profit_goal'

/** Supabase에 user_settings 컬럼 미추가 시 안내 */
export const PRO_PROFILE_SCHEMA_HINT =
  'Supabase SQL Editor에서 scripts/supabase-pro-user-profile.sql 을 실행해 주세요.'

export function friendlyProProfileError(message: string): string {
  const m = message.toLowerCase()
  if (
    m.includes('invest_horizon') ||
    m.includes('risk_profile') ||
    m.includes('profit_goal') ||
    m.includes('schema cache')
  ) {
    return `투자 프로필 DB 컬럼이 없습니다. ${PRO_PROFILE_SCHEMA_HINT}`
  }
  return message
}

type Options = {
  /** false 이면 fetch 하지 않음 */
  enabled?: boolean
}

export function useProInvestProfile(options: Options = {}) {
  const enabled = options.enabled !== false
  const [profile, setProfile] = useState<ProInvestProfile>(EMPTY_PRO_INVEST_PROFILE)
  const [loading, setLoading] = useState(enabled)
  const [saving, setSaving] = useState<ProInvestProfileField | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await authFetch(apiUrl('/api/pro-profile'))
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || '프로필을 불러오지 못했습니다')
      }
      const d = (await r.json()) as ProInvestProfile
      setProfile({
        risk_profile: d.risk_profile ?? null,
        invest_horizon: d.invest_horizon ?? null,
        profit_goal: d.profit_goal ?? null,
      })
    } catch (e) {
      const raw = e instanceof Error ? e.message : '프로필을 불러오지 못했습니다'
      setError(friendlyProProfileError(raw))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) void loadProfile()
  }, [enabled, loadProfile])

  const saveField = useCallback(async (field: ProInvestProfileField, value: string) => {
    const next = value.trim() || null
    const prev = profile[field]
    if (prev === next) return

    setSaving(field)
    setError(null)
    setProfile((p) => ({ ...p, [field]: next }))

    try {
      const r = await authFetch(apiUrl('/api/pro-profile'), {
        method: 'PATCH',
        body: JSON.stringify({ [field]: next }),
      })
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || '저장에 실패했습니다')
      }
      const d = (await r.json()) as ProInvestProfile
      setProfile({
        risk_profile: d.risk_profile ?? null,
        invest_horizon: d.invest_horizon ?? null,
        profit_goal: d.profit_goal ?? null,
      })
    } catch (e) {
      setProfile((p) => ({ ...p, [field]: prev }))
      const raw = e instanceof Error ? e.message : '저장에 실패했습니다'
      setError(friendlyProProfileError(raw))
    } finally {
      setSaving(null)
    }
  }, [profile])

  return { profile, loading, saving, error, saveField, loadProfile }
}
