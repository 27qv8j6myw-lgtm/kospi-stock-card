'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { useIsAdmin } from './useIsAdmin'

export type AiUserModel = 'opus' | 'sonnet' | 'fable'

/**
 * 본인에게 적용되는 AI 티어 (표시 전용 — 변경은 관리자만).
 * 관리자는 본인이 고른 모델(user_settings.ai_model 이 'opus' 면 opus, 그 외 fable).
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

    let cancelled = false
    setLoading(true)

    ;(async () => {
      try {
        if (isAdmin) {
          const { data } = await supabase
            .from('user_settings')
            .select('ai_model')
            .eq('user_id', user.id)
            .maybeSingle()
          if (!cancelled) setModel(data?.ai_model === 'opus' ? 'opus' : 'fable')
          return
        }

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
