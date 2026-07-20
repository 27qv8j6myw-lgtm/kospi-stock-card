'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { useIsAdmin } from './useIsAdmin'

export type AiUserModel = 'opus' | 'sonnet' | 'fable'

/**
 * 본인에게 적용되는 AI 티어 (표시 전용 — 변경은 관리자만).
 * 관리자는 최상위 모델(fable)로 표시.
 */
export function useUserModel(): { model: AiUserModel; loading: boolean } {
  const { user } = useAuth()
  const { isAdmin, ready: adminRoleReady } = useIsAdmin(user)
  const [model, setModel] = useState<AiUserModel>('sonnet')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setModel('sonnet')
      setLoading(false)
      return
    }

    if (!adminRoleReady) {
      setLoading(true)
      return
    }

    if (isAdmin) {
      setModel('fable')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    ;(async () => {
      try {
        const { data, error } = await supabase.rpc('get_user_model', { target_user_id: user.id })
        if (cancelled) return
        if (error) {
          console.error('[useUserModel]', error.message)
          setModel('sonnet')
        } else {
          const m = typeof data === 'string' ? data.trim().toLowerCase() : ''
          setModel(m === 'fable' ? 'fable' : m === 'opus' ? 'opus' : 'sonnet')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id, isAdmin, adminRoleReady])

  return { model, loading }
}
