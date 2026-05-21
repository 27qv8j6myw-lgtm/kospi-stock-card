'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

/**
 * 로그인 사용자의 차단 여부. 비로그인 시 `null`, 확인 전·중에도 `null`.
 * @returns {boolean | null}
 */
export function useIsBlocked(): boolean | null {
  const { user } = useAuth()
  const [blocked, setBlocked] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) {
      setBlocked(null)
      return
    }

    setBlocked(null)
    let cancelled = false

    const check = async () => {
      const { data, error } = await supabase.from('blocked_users').select('id').eq('user_id', user.id).maybeSingle()

      if (cancelled) return
      if (error) {
        console.error('[useIsBlocked]', error.message)
        setBlocked(false)
        return
      }
      setBlocked(!!data)
    }

    void check()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  return blocked
}
