'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type UseIsProUserResult = {
  isProUser: boolean
  ready: boolean
}

/**
 * `user_settings.pro_enabled` — 본인 설정만 RLS로 조회
 */
export function useIsProUser(user: User | null): UseIsProUserResult {
  const [isProUser, setIsProUser] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!user?.id) {
      setIsProUser(false)
      setReady(true)
      return
    }

    let cancelled = false
    setReady(false)

    void supabase
      .from('user_settings')
      .select('pro_enabled')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.warn('[useIsProUser]', error.message)
          setIsProUser(false)
        } else {
          setIsProUser(data?.pro_enabled === true)
        }
        setReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id])

  return { isProUser, ready }
}
